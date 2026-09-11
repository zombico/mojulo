/**
 * GET /api/sketches/[ref]/model.scad — export a stored sketch as an OpenSCAD PROGRAM.
 *
 * The odd one out among the model routes: every sibling (/model.glb, /model.stl,
 * /model.3mf, /model.usdz) serialises the resolved FACE payload, and this one transpiles
 * the RECIPE. The workbench's term list becomes OpenSCAD solids and booleans, so OpenSCAD
 * recomputes the geometry with EXACT booleans — a bore arrives with a sharp lip, where the
 * recipe itself rounds every edge to about one grid cell (openscad-leg.plan.md).
 *
 * A term with no OpenSCAD equivalent (a blend, a stroke, noise, an expr, a warp) is
 * polygonized and frozen as a `polyhedron()` with a comment naming what forced it; the
 * X-Mojulo-Scad-Coverage header carries the tally. Nothing refuses the format — a kind with
 * no workbench manifest arrives fully baked, and /model.stl is the better file for it.
 *
 * `?scale=` multiplies coordinates into millimetres (the file's own `mm_per_unit`).
 * Mojulo never reads .scad back: this is a derived snapshot, not a round trip.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { scadExport } from '@/lib/graph/scene/scene-scad';
import { expandWorkbenchProgram, hasProgram } from '@/lib/graph/worlds/workbench-program';

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function scadFilename(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'model')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'model'}.scad`;
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
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : null;

    const { payload, kind } = await resolveWorldScene(sketch);
    const exported = payload
      ? scadExport({
        manifest: hasProgram(sketch.manifest) ? expandWorkbenchProgram(sketch.manifest).manifest : sketch.manifest,
        payload,
        title: sketch.title || sketch.manifest.title || ref,
        ref,
        kind: kind ?? sketch.manifest.kind,
        units: sketch.manifest.units,
        ...(scale != null ? { mmPerUnit: scale, scaleNote: `scale=${scale} from the request` } : {}),
        why: `'${kind ?? sketch.manifest.kind}' carries no workbench manifest to transpile term by term`,
      })
      : null;
    if (!exported) {
      return NextResponse.json({
        eligible: false,
        reason:
          'OpenSCAD export currently covers the traversable World kinds. Diagrams, charts, and '
          + 'CSS-3D-only turntables have no exportable world geometry. A workbench / code / '
          + 'assembler recipe transpiles term by term; every other kind arrives as one frozen '
          + 'polyhedron, for which /model.stl is the better file.',
        scene: `/api/sketches/${ref}/scene`,
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

    return new Response(exported.bytes, {
      status: 200,
      headers: {
        // there is no registered media type for OpenSCAD; it is source text
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${scadFilename(sketch, ref)}"`,
        'Content-Length': String(exported.byteLength),
        'Cache-Control': 'no-store',
        // the coverage ledger travels with the file, so a caller that only sees headers still
        // learns how much of it is exact and how much is a frozen bake
        'X-Mojulo-Scad-Coverage': `exact=${exported.coverage.exact}; baked=${exported.coverage.baked}; variables=${exported.variables}`,
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
