/**
 * GET /api/sketches/[ref]/cover.png — the composited raster face of a `cover`
 * sketch: the illustration + title + subtext + metadata flattened (cover-
 * compositor.js). Deterministic given (manifest, bound renders). Unlike
 * final.png this never 404s on missing renders — a directed cover always
 * composites, standing in a palette placeholder + flat title until painted
 * layers (illustration / alpha'd title mark) are bound.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compositeCoverForSketch } from '@/lib/graph/image-outcomes/cover-compositor';
import { COVER_KIND } from '@/lib/graph/image-outcomes/cover-manifest';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (sketch.manifest?.kind !== COVER_KIND) {
      return NextResponse.json(
        { error: `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — cover.png exists for cover sketches` },
        { status: 422 },
      );
    }

    const png = await compositeCoverForSketch(sketch);
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
      { error: err.message || 'Failed to composite cover' },
      { status: 500 },
    );
  }
}
