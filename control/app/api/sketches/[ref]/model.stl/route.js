/**
 * GET /api/sketches/[ref]/model.stl — export a stored sketch as a binary STL.
 *
 * The 3D-printing sibling of /model.glb: the SAME baked geometry (resolved
 * through the shared lib/graph/world-scene seam) packed as bare triangle soup
 * for slicers (PrusaSlicer, Cura, Bambu). Colour, grouping, and materials are
 * deliberately lost — STL carries shape only, and the printer's filament is the
 * colour. Water, ground decals, and surface cards are omitted; instanced
 * repeats expand into real geometry. The mesh is honest triangle soup, not a
 * guaranteed-manifold solid — slicers repair open shells on import.
 *
 * `?scale=` multiplies coordinates (slicers read STL units as millimetres).
 * Kinds with no traversable World form return 422 pointing back at /scene or /svg.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToStl } from '@/lib/graph/scene/scene-stl';

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function stlFilename(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'model')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'model'}.stl`;
}

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

    const scaleRaw = Number.parseFloat(new URL(request.url).searchParams.get('scale'));
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;

    const { payload } = await resolveWorldScene(sketch);
    const exported = payload ? facesToStl(payload, { scale, generator: `mojulo ${ref}` }) : null;
    if (!exported) {
      return NextResponse.json({
        eligible: false,
        reason:
          'STL export currently covers the traversable World kinds (cities, transportation hubs, '
          + 'subway interiors, painted-landscape terrain, workbench/assembler studies, vehicle '
          + 'instances, the science views, and furnished rooms). Diagrams, charts, and CSS-3D-only '
          + 'turntables have no exportable world geometry.',
        scene: `/api/sketches/${ref}/scene`,
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

    return new Response(exported.bytes, {
      status: 200,
      headers: {
        'Content-Type': 'model/stl',
        'Content-Disposition': `attachment; filename="${stlFilename(sketch, ref)}"`,
        'Content-Length': String(exported.byteLength),
        'Cache-Control': 'no-store',
        // a nonBakeable world (live physics/entities/events) exports its FROZEN frame-zero
        // stage — geometry only, no inhabitants or live channels. Recorded here so the
        // degradation is observable, not implied (renderer-emitter.plan.md E4).
        ...(payload.nonBakeable ? { 'X-Mojulo-Degraded': 'frame-zero' } : {}),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to export sketch model' },
      { status: 500 },
    );
  }
}
