/**
 * GET /api/sketches/[ref]/beats — serve a stored beats artifact as a live,
 * self-contained audio player page (the audio sibling of /world and /scene).
 *
 * Like those backends, the stored manifest is a tiny RECIPE (beats.plan.md):
 * the player HTML + synthesis kernel are regenerated per request and every
 * sound is synthesized in the browser — no media bytes are stored or served.
 */

import { NextResponse } from 'next/server';

import { BeatsAnnotationRepository } from '@/lib/db/repositories/beats';
import { resolveBeatsAt, BeatsHttpError } from '@/lib/graph/beats/beats-resolve';
import { emitBeatsPlayer } from '@/lib/graph/beats/beats-player';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    // alias of /api/beats/[ref] (B9) — same resolution, same `?rev=`.
    const { manifest, rev } = resolveBeatsAt(ref, new URL(request.url).searchParams.get('rev'));
    const html = emitBeatsPlayer(manifest, {
      ref,
      rev,
      annotations: BeatsAnnotationRepository.list(ref, { status: 'open' }),
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
    if (err instanceof BeatsHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to render beats player' },
      { status: 500 },
    );
  }
}
