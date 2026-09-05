/**
 * GET /api/sketches/[ref]/model.3mf — export a stored sketch as a 3MF package.
 *
 * The slicer-preferred sibling of /model.stl: the SAME printable set (resolved
 * through the shared lib/graph/world-scene seam, filtered by isPrintableFace)
 * packed as a 3MF — millimetres declared in the file, baked colours as
 * basematerials, instanced repeats as one object + build items. PrusaSlicer,
 * Bambu Studio, OrcaSlicer, and Cura open it directly. Shells are separate
 * objects, not a boolean union — slicers merge them on import.
 *
 * `?scale=` multiplies coordinates (world units → mm).
 * Kinds with no traversable World form return 422 pointing back at /scene or /svg.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesTo3mf } from '@/lib/graph/scene/scene-3mf';

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function filenameFor(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'model')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'model'}.3mf`;
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
    const exported = payload
      ? facesTo3mf(payload, { scale, generator: `mojulo ${ref}`, title: sketch.title || sketch.manifest?.title || ref })
      : null;
    if (!exported) {
      return NextResponse.json({
        eligible: false,
        reason:
          '3MF export covers the traversable World kinds (cities, transportation hubs, '
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
        'Content-Type': 'model/3mf',
        'Content-Disposition': `attachment; filename="${filenameFor(sketch, ref)}"`,
        'Content-Length': String(exported.byteLength),
        'Cache-Control': 'no-store',
        // a nonBakeable world exports its FROZEN frame-zero stage — geometry only.
        // Recorded so the degradation is observable, not implied (renderer-emitter.plan.md E4).
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
