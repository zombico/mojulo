/**
 * GET /api/sketches/[ref]/beats — serve a stored beats artifact as a live,
 * self-contained audio player page (the audio sibling of /world and /scene).
 *
 * Like those backends, the stored manifest is a tiny RECIPE (beats.plan.md):
 * the player HTML + synthesis kernel are regenerated per request and every
 * sound is synthesized in the browser — no media bytes are stored or served.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { emitBeatsPlayer } from '@/lib/graph/beats/beats-player';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest || !isBeatsKind(sketch.manifest.kind)) {
      return NextResponse.json({
        error: `Sketch '${ref}' is not a beats artifact`,
        hint: 'Beats artifacts have manifest.kind beats-ambient | beats-composition | beats-sfx (create_beats).',
      }, { status: 422 });
    }
    const html = emitBeatsPlayer(sketch.manifest);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to render beats player' },
      { status: 500 },
    );
  }
}
