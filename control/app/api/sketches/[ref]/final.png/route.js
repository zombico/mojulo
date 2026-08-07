/**
 * GET /api/sketches/[ref]/final.png — the FINISHED page of an
 * image-outcome / sequential-art sketch: the latest bound render per
 * target, composited with the manifest-derived overlay (panel borders,
 * gutters, bubbles, lettering — plan I5). Deterministic given (manifest,
 * bound renders); 404s until every render target is bound, listing what's
 * missing so the worker knows what to generate next.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compositeFinalForSketch } from '@/lib/graph/image-outcomes/final-page';
import {
  KIND_IMAGE_OUTCOME,
  KIND_SEQUENTIAL_ART,
} from '@/lib/graph/image-outcomes/manifest';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    const kind = sketch.manifest?.kind;
    if (kind !== KIND_IMAGE_OUTCOME && kind !== KIND_SEQUENTIAL_ART) {
      return NextResponse.json(
        { error: `Sketch '${ref}' is kind '${kind}' — final pages exist for image-outcome / sequential-art sketches` },
        { status: 422 },
      );
    }

    const { png, missing } = await compositeFinalForSketch(sketch);
    if (!png) {
      return NextResponse.json(
        {
          error: `No final page yet — target(s) without a bound render: ${missing.join(', ')}`,
          hint: 'pull each target via get_image_render_packet, generate, then bind_image_render',
          scaffold: `/api/sketches/${encodeURIComponent(ref)}/png`,
        },
        { status: 404 },
      );
    }

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to composite final page' },
      { status: 500 },
    );
  }
}
