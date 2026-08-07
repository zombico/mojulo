/**
 * GET /api/sketches/[ref]/voice-samples — the index of bound sample points
 * for a `voice-register` ref: which (confidence, depth) coordinates have a
 * worker-rendered WAV. The /maker/voice card reads this once to make its
 * sliders audible — every listed point is playable via
 * `/voice-sample.wav?c=&d=`.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isVoiceRegisterKind } from '@/lib/graph/voice/voice-register';
import { listVoiceSamples } from '@/lib/graph/voice/voice-sample-store';

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
    const samples = listVoiceSamples(sketch.ref).map((s) => ({
      confidence: s.confidence,
      depth: s.depth,
      n: s.n,
      url: `/api/sketches/${encodeURIComponent(sketch.ref)}/voice-sample.wav?c=${s.confidence}&d=${s.depth}`,
      text: s.sidecar?.text ?? null,
      source: s.sidecar?.source ?? null,
    }));
    return NextResponse.json({ ref: sketch.ref, samples });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'failed to list voice samples' }, { status: 500 });
  }
}
