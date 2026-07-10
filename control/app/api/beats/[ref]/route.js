/**
 * GET /api/beats/[ref] — beats' own namespace (B9), thin handlers over the same
 * emitters as the /api/sketches/[ref]/beats(.wav) aliases (which keep working).
 *
 * Two shapes ride one dynamic segment:
 *   /api/beats/<ref>          — the live player page. `?rev=N` plays any
 *                               revision; open annotations render as markers
 *                               and the annotate-here affordance POSTs back.
 *   /api/beats/<ref>.wav      — deterministic WAV render (`?rev=`, plus the
 *                               beats-render options bars/loops/cue/tail).
 *   /api/beats/<ref>.mid      — the score as a Standard MIDI File (`?rev=`,
 *                               bars/loops) — the musician handoff.
 *
 * Nothing is stored any of these ways: the manifest is a tiny seeded recipe
 * and every surface re-derives per request from the same pure plan.
 */

import { NextResponse } from 'next/server';

import { BeatsAnnotationRepository } from '@/lib/db/repositories/beats';
import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';
import { emitBeatsPlayer } from '@/lib/graph/beats/beats-player';
import { renderBeatsOffline } from '@/lib/graph/beats/beats-render';
import { renderBeatsMidi } from '@/lib/graph/beats/beats-midi';

function exportName(sketch, ref, rev, ext, cue) {
  const base = (sketch.title || ref).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'beats';
  return `${base}${rev ? `-rev${rev}` : ''}${cue ? `-${cue}` : ''}.${ext}`;
}

async function serveMid(ref, searchParams) {
  const { sketch, manifest, rev } = resolveBeatsAt(ref, searchParams.get('rev'));
  let rendered;
  try {
    rendered = renderBeatsMidi(manifest, {
      bars: intParam(searchParams, 'bars'),
      loops: intParam(searchParams, 'loops'),
    });
  } catch (err) {
    if (err instanceof BeatsHttpError) throw err;
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  return new Response(rendered.mid, {
    status: 200,
    headers: {
      'Content-Type': 'audio/midi',
      'Content-Disposition': `attachment; filename="${exportName(sketch, ref, rev, 'mid')}"`,
      'Content-Length': String(rendered.mid.length),
      'Cache-Control': 'no-store',
    },
  });
}

function intParam(searchParams, name) {
  const raw = searchParams.get(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new BeatsHttpError(422, `\`${name}\` must be an integer (got '${raw}')`);
  return n;
}

async function serveWav(ref, searchParams) {
  const { sketch, manifest, rev } = resolveBeatsAt(ref, searchParams.get('rev'));
  let rendered;
  try {
    const tailRaw = searchParams.get('tail');
    rendered = await renderBeatsOffline(manifest, {
      bars: intParam(searchParams, 'bars'),
      loops: intParam(searchParams, 'loops'),
      cue: searchParams.get('cue') || undefined,
      tail: tailRaw === null ? undefined : Number(tailRaw),
    });
  } catch (err) {
    if (err instanceof BeatsHttpError) throw err;
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  return new Response(rendered.wav, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Disposition': `attachment; filename="${exportName(sketch, ref, rev, 'wav', rendered.meta.cue)}"`,
      'Content-Length': String(rendered.wav.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request, { params }) {
  try {
    const { ref: raw } = await params;
    const { searchParams } = new URL(request.url);
    if (raw.endsWith('.wav')) return await serveWav(raw.slice(0, -4), searchParams);
    if (raw.endsWith('.mid')) return await serveMid(raw.slice(0, -4), searchParams);

    const { manifest, rev } = resolveBeatsAt(raw, searchParams.get('rev'));
    const html = emitBeatsPlayer(manifest, {
      ref: raw,
      rev,
      annotations: BeatsAnnotationRepository.list(raw, { status: 'open' }),
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof BeatsHttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message || 'Failed to render beats' }, { status: 500 });
  }
}
