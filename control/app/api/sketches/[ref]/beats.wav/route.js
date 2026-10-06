/**
 * GET /api/sketches/[ref]/beats.wav — render a stored beats artifact to a WAV
 * download (B8, the audio sibling of /model.glb).
 *
 * Like every beats surface, nothing is stored: the manifest is a tiny seeded
 * RECIPE and the audio is re-synthesized per request through the kernel's own
 * realizer on an OfflineAudioContext — the same bytes every time for the same
 * query. This URL is the reuse primitive: anything page-shaped inside mojulo
 * (a published site, an app frontend, a game shell) can point an <audio src>
 * here; server-side consumers import renderBeatsOffline directly instead.
 *
 * Query params (per-kind duration semantics, see beats-render.js):
 *   bars=N   — beats-ambient: bars to render (default: one progression cycle)
 *   loops=N  — beats-pattern: pattern repetitions (default 2)
 *   cue=id   — beats-sfx: which cue (default: the only one)
 *   variant=N — beats-sfx: a per-hit variation of the cue (0/absent = the cue itself)
 *   tail=S   — seconds of ring-out appended (default 2)
 *   loop=1   — one seamless pass to the bar line, tail folded onto the head, smpl loop chunk
 */

import { NextResponse } from 'next/server';

import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';
import { renderBeatsOffline } from '@/lib/graph/beats/beats-render';

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function wavFilename(sketch, ref, cue) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'beats')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'beats'}${cue ? `-${cue}` : ''}.wav`;
}

function intParam(searchParams, name) {
  const raw = searchParams.get(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`\`${name}\` must be an integer (got '${raw}')`);
  return n;
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const { searchParams } = new URL(request.url);
    // alias of /api/beats/[ref].wav (B9) — same resolution, same `?rev=`.
    const { sketch, manifest } = resolveBeatsAt(ref, searchParams.get('rev'));

    let rendered;
    try {
      const tailRaw = searchParams.get('tail');
      rendered = await renderBeatsOffline(manifest, {
        bars: intParam(searchParams, 'bars'),
        loops: intParam(searchParams, 'loops'),
        cue: searchParams.get('cue') || undefined,
        variant: intParam(searchParams, 'variant'),
        tail: tailRaw === null ? undefined : Number(tailRaw),
        ...(searchParams.get('loop') === null ? {} : { loop: searchParams.get('loop') === '1' }),
      });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    return new Response(rendered.wav, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="${wavFilename(sketch, ref, rendered.meta.cue)}"`,
        'Content-Length': String(rendered.wav.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof BeatsHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to render beats WAV' },
      { status: 500 },
    );
  }
}
