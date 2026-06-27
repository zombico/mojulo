/**
 * GET /api/sketches/[ref]/scene — serve a stored sketch as a live, dependency-free
 * CSS preserve-3d HTML scene (the "second backend" alongside /svg). Handles:
 *   • kind 'fractal-city' — the stored manifest is a tiny RECIPE (seed + a few params);
 *     the full city geometry is regenerated deterministically here, so nothing heavy is
 *     ever stored or tokenized (the fractal-generation philosophy).
 *   • two-point room manji-trees.
 * Other forms return an eligibility note that points back at the baked /svg.
 *
 * The kind → emitter dispatch lives in @/lib/graph/scene-html so the PNG rasterizer
 * (/api/sketches/[ref]/png) screenshots the exact same scene this serves live.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { renderSceneHtml } from '@/lib/graph/scene-html';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest) {
      return NextResponse.json({ error: `Sketch '${ref}' has no manifest` }, { status: 400 });
    }

    // ?view=exterior renders the roofed exterior massing (companion to the cutaway).
    const view = request.nextUrl.searchParams.get('view') || undefined;
    const html = renderSceneHtml(sketch, { view });
    if (!html) {
      return NextResponse.json({
        eligible: false,
        reason:
          'Live CSS-3D scenes currently render two-point room manji-trees only. '
          + 'Other forms (organic / curved / interpenetrating) use the baked SVG / forge_motion path.',
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

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
      { error: err.message || 'Failed to render sketch scene' },
      { status: 500 },
    );
  }
}
