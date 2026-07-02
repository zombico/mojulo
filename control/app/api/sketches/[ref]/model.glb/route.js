/**
 * GET /api/sketches/[ref]/model.glb — export a stored sketch as a binary glTF (.glb).
 *
 * The fourth backend alongside /svg, /scene, and /world. Where /world streams a live
 * WebGL canvas, this streams the SAME baked geometry (resolved through the shared
 * lib/graph/world-scene seam, so the mesh always matches the rendered World) packed as
 * a portable .glb the operator can drop into Blender / Unreal / three.js / Quick Look.
 *
 * Like /world the manifest is a tiny RECIPE regenerated deterministically here; nothing
 * heavy is stored. Kinds with no traversable World form return 422 pointing back at
 * /scene or /svg.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function glbFilename(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'model')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'model'}.glb`;
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
    const exported = payload ? facesToGlb(payload, { generator: `mojulo ${ref}` }) : null;
    if (!exported) {
      return NextResponse.json({
        eligible: false,
        reason:
          'glTF export currently covers the traversable World kinds (cities, transportation hubs, '
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
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': `attachment; filename="${glbFilename(sketch, ref)}"`,
        'Content-Length': String(exported.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to export sketch model' },
      { status: 500 },
    );
  }
}
