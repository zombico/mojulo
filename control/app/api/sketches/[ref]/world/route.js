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
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/world-scene';

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

    // The kind → assemble*Scene dispatch lives in lib/graph/world-scene.js so the live
    // World and the downloadable .glb export resolve identical geometry. `payload` is
    // null for any kind with no traversable form.
    // ?view=exterior renders the roofed, on-the-ground massing (basement hidden) as a
    // companion to the default cutaway doll-house. Threaded into the per-kind assembler.
    const view = request.nextUrl.searchParams.get('view') || undefined;
    const { payload, kind } = await resolveWorldScene(sketch, { view });

    if (!payload) {
      return NextResponse.json({
        eligible: false,
        reason:
          'Traversable Worlds currently render box-world kinds (fractal-city, transportation-hub), '
          + 'the open-fronted subway-station interior, the workbench object study, painted-landscape '
          + 'terrain, the planetary body, and furnished two-point rooms. Other forms render as '
          + 'preset-shot scenes or baked stills.',
        scene: `/api/sketches/${ref}/scene`,
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

    // ?wire=1 opens the World straight in construction-wireframe mode (deep-link / baked still);
    // the HUD toggle is always present regardless. A live HUD-only affordance for every World.
    const wireframe = ['1', 'true'].includes(request.nextUrl.searchParams.get('wire'));
    // First-person free-traverse (WASD + Space/Shift) — ON by default for the SPATIAL ("moved
    // through") kinds, where walking the interior/streets is the point. The object-study kinds
    // (workbench, vehicle-instance) and the orbit-only planetary stay free-orbit — walking a
    // celestial sphere or around a single specimen is nonsense. A payload may carry its own
    // `walk` (tuned spawn/speed) to override; ?walk=0 forces orbit, ?walk=1 force-enables anywhere.
    const walkParam = request.nextUrl.searchParams.get('walk');
    // exterior view is an outside massing read → orbit, not walk (unless ?walk=1 forces it).
    const exteriorView = (view ?? sketch.manifest?.view) === 'exterior';
    const walk = ['0', 'false'].includes(walkParam) ? false
      : (['1', 'true'].includes(walkParam) || (!exteriorView && (payload.walk || WALK_KINDS.has(kind))));
    // ?decollide=0 disables the coplanar depth-stagger (z-fight de-collision) for A/B verification.
    // ON by default for every World; this is purely a debug/compare affordance like ?wire.
    const decollide = !['0', 'false'].includes(request.nextUrl.searchParams.get('decollide'));
    const html = emitThreeWorld({ ...payload, wireframe, walk, decollide });
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
