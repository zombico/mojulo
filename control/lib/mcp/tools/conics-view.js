/**
 * create_conics_view — mint where the CONIC SECTIONS come from: slice a double cone with a plane and the
 * cut is a circle, ellipse, parabola, or hyperbola, decided only by how steeply the plane is tilted vs
 * the cone's half-angle. The translucent cone, the cutting plane, and the bright intersection curve are
 * all orbit-able. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'conics-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planConicsScene, CONICS_SCENARIOS } from '@/lib/graph/views/math/conics-view';

export function mintConicsView({ title, scenario, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'conics-view',
    scenario: CONICS_SCENARIOS.includes(scenario) ? scenario : 'ellipse',
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planConicsScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Conic sections (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats,
  };
}

export async function createConicsViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_conics_view requires a recipe object');
  const { title, scenario, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintConicsView({ title, scenario, animate, scale, viewBox, scene, ref, folderRef });
}

export function registerConicsViewTools() {
  registerTool({
    name: 'create_conics_view',
    description:
      "Mint an interactive GEOMETRY explainer — where the CONIC SECTIONS come from, rendered as a live "
      + "traversable three.js World. Slice a double cone with a flat plane and the cut curve is a circle, "
      + "ellipse, parabola, or hyperbola — and which one you get is decided by NOTHING but how steeply the "
      + "plane is tilted compared to the cone's own half-angle. The translucent double cone, the cutting "
      + "plane, and the bright intersection curve all orbit together so you can see the slice from any "
      + "side. Four scenarios, one idea worn many ways: 'circle' (plane perpendicular to the axis), "
      + "'ellipse' (a gentle tilt — the cut is still a closed loop), 'parabola' (plane exactly parallel to "
      + "one side of the cone — the curve opens up, one arm running to infinity), 'hyperbola' (a steep "
      + "tilt — the plane now catches BOTH nappes of the double cone, giving two separate branches). Part "
      + "of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at "
      + "`/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === "
      + "'conics-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on "
      + "framing like 'conic sections / circle ellipse parabola hyperbola / slicing a cone / where conics "
      + "come from'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...CONICS_SCENARIOS], description: "Which slice (default 'ellipse'): 'circle' (plane ⟂ axis), 'ellipse' (gentle tilt, still closed), 'parabola' (plane parallel to a side, opens with one arm to infinity), 'hyperbola' (steep tilt, catches both nappes, two branches)." },
        animate: { type: 'boolean', description: 'Play the slicing morph (default true). false bakes the final cut statically.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createConicsViewHandler,
  });
}
