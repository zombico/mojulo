/**
 * GET /api/sketches/[ref]/model.usdz — export a stored sketch as a USDZ package.
 *
 * The OpenUSD sibling of /model.glb (interchange-seams.plan.md seam 2): the SAME
 * baked geometry (resolved through the shared lib/graph/world-scene seam) as one
 * uncompressed, 64-byte-aligned USDZ — z-up verbatim, metersPerUnit from the
 * recipe's declared units, per-vertex displayColor, PointInstancers for repeats,
 * level cameras, entity Xforms. Opens in Blender / Houdini / Omniverse, and in
 * AR Quick Look on iOS / visionOS at true scale (the eyes gate for an object).
 *
 * Kinds with no traversable World form return 422 pointing back at /scene or /svg.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToUsdz } from '@/lib/graph/scene/scene-usd';
import { deriveStlScale } from '@/lib/mcp/tools/sketch-model-export';
import { unitsLabel } from '@/lib/graph/scene/world-units';

function filenameFor(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'model')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'model'}.usdz`;
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
    const { payload } = await resolveWorldScene(sketch);
    const unitMm = deriveStlScale(unitsLabel(sketch.manifest));   // the manifest's label, else the kind family's authoring unit (world-units.js)
    const exported = payload
      ? facesToUsdz(payload, { generator: `mojulo ${ref}`, title: sketch.title || sketch.manifest?.title || ref, metersPerUnit: unitMm != null ? unitMm / 1000 : 1 })
      : null;
    if (!exported) {
      return NextResponse.json({
        eligible: false,
        reason:
          'USD export covers the traversable World kinds (cities, transportation hubs, '
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
        'Content-Type': 'model/vnd.usdz+zip',
        'Content-Disposition': `attachment; filename="${filenameFor(sketch, ref)}"`,
        'Content-Length': String(exported.byteLength),
        'Cache-Control': 'no-store',
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
