/**
 * GET /api/sketches/[ref]/voice-sample.wav — a bound voice sample for a
 * `voice-register` ref (voice-worker.plan.md). Samples are worker-rendered
 * WAVs bound append-only via `bind_voice_sample`, axis-stamped with the
 * (confidence, depth) point they speak. `?c=&d=` serves the NEAREST
 * rendered point to that axis position (how the /maker/voice sliders stay
 * audible edge to edge); omitted, it targets the register's own axes.
 * 404s until a worker binds something — the register is a complete
 * artifact without it.
 */

import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isVoiceRegisterKind } from '@/lib/graph/voice/voice-register';
import { nearestVoiceSample } from '@/lib/graph/voice/voice-sample-store';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!isVoiceRegisterKind(sketch.manifest?.kind)) {
      return NextResponse.json(
        { error: `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — voice samples exist for voice-register refs` },
        { status: 422 },
      );
    }
    const search = new URL(request.url).searchParams;
    const target = {
      confidence: search.has('c') ? Number(search.get('c')) : sketch.manifest?.axes?.confidence,
      depth: search.has('d') ? Number(search.get('d')) : sketch.manifest?.axes?.depth,
    };
    const sample = nearestVoiceSample(sketch.ref, target);
    if (!sample) {
      return NextResponse.json(
        {
          error: 'No bound sample yet — render a line with the register and bind it.',
          hint: `get_voice({ ref: '${ref}' }) has the render command; then bind_voice_sample({ ref, wav_path, axes })`,
        },
        { status: 404 },
      );
    }
    let bytes;
    try {
      bytes = await fs.readFile(sample.path);
    } catch {
      return NextResponse.json({ error: 'sample slot unreadable' }, { status: 404 });
    }
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(bytes.length),
        // Which point answered — the card labels its player with this.
        'X-Voice-Sample-Axes': `c=${sample.confidence};d=${sample.depth}`,
        // Append-only slots never mutate, but "nearest" can change as more
        // points bind.
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'failed to serve voice sample' }, { status: 500 });
  }
}
