/**
 * GET /api/sketches/[ref]/world — serve a stored sketch as a live, TRAVERSABLE
 * three.js (WebGL) World (the third backend alongside /svg and /scene).
 *
 *   • /svg   — server-rasterized still (the "looked at" Scene tier)
 *   • /scene — preserve-3d HTML, preset camera shots ("worlds-lite")
 *   • /world — three.js canvas, free orbit/zoom/pan ("moved through")
 *
 * Like /scene, the stored manifest is a tiny RECIPE; the full world geometry is
 * regenerated deterministically here via the shared `assemble*Scene` seam, so
 * nothing heavy is ever stored. World-eligible kinds (cities, hubs) funnel their
 * baked faces through `emitThreeWorld`; everything else points back at /scene or
 * /svg, which can render it as a still.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { emitThreeWorld } from '@/lib/graph/scene-three';
import { assembleFractalCityScene } from '@/lib/graph/fractal-city';
import { assembleTransportationHubScene } from '@/lib/graph/transportation-hub';
import { assembleSubwayStationScene } from '@/lib/graph/subway-station';

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

    // declarative scene lighting — same normalization as the /scene route.
    const scene = sketch.manifest.scene && typeof sketch.manifest.scene === 'object' ? sketch.manifest.scene : {};
    const time = sketch.manifest.time ?? scene.time;
    const sky = sketch.manifest.sky ?? scene.sky;
    const kind = sketch.manifest.kind;

    const payload = kind === 'fractal-city'
      ? assembleFractalCityScene({ ...sketch.manifest, time, sky, title: sketch.title || sketch.manifest.title || 'mojulo city' })
      : kind === 'transportation-hub'
        ? assembleTransportationHubScene({ ...sketch.manifest, time, sky, title: sketch.title || sketch.manifest.title || 'mojulo transportation hub' })
        : kind === 'subway-station'
          ? assembleSubwayStationScene({ ...sketch.manifest, title: sketch.title || sketch.manifest.title || 'mojulo subway station' })
          : null;

    if (!payload) {
      return NextResponse.json({
        eligible: false,
        reason:
          'Traversable Worlds currently render box-world kinds (fractal-city, transportation-hub) '
          + 'and the open-fronted subway-station interior. '
          + 'Other forms render as preset-shot scenes or baked stills.',
        scene: `/api/sketches/${ref}/scene`,
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

    const html = emitThreeWorld(payload);
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
      { error: err.message || 'Failed to render sketch world' },
      { status: 500 },
    );
  }
}
