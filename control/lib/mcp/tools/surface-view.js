/**
 * create_surface_view — mint the graph of z = f(x,y) as a 3-D LANDSCAPE with a ball that ROLLS DOWNHILL
 * (gradient descent). Critical points become hilltops, valleys and saddles; optimization becomes a ball
 * finding the bottom. bowl/saddle/monkey/wells/ripple. Multivariable calculus made a place. Part of
 * mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'surface-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planSurfaceScene, SURFACE_SCENARIOS } from '@/lib/graph/surface-view';

export function mintSurfaceView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'surface-view',
    scenario: SURFACE_SCENARIOS.includes(scenario) ? scenario : 'bowl',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planSurfaceScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Surface (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createSurfaceViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_surface_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintSurfaceView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}

export function registerSurfaceViewTools() {
  registerTool({
    name: 'create_surface_view',
    description:
      "Mint an interactive MULTIVARIABLE-CALCULUS explainer — the graph of z = f(x,y) rendered as a 3-D "
      + "LANDSCAPE you can traverse, with a ball that ROLLS DOWNHILL (gradient descent) and traces its path "
      + "as a live three.js World. Critical points (where ∇f = 0) become readable terrain: hilltops, "
      + "valleys and saddles; optimization becomes a ball finding the bottom of a basin. Five scenarios, "
      + "one idea worn many ways: 'bowl' (one global minimum — the ball always finds it), 'saddle' (∇f = 0 "
      + "but NO optimum — the ball rolls away, the control), 'monkey' (three valleys meeting at a degenerate "
      + "critical point), 'wells' (two basins → two LOCAL minima, where you drop the ball decides which one "
      + "it falls into), 'ripple' (many local minima — a bumpy bowl where the starting point determines "
      + "where descent stops). Multivariable calculus made a place: the surface IS the function and the "
      + "ball's path IS the optimizer. Part of mojulo's EDUCATION module (math explainers, sibling to the "
      + "science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'surface-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. "
      + "Reach for this on framing like 'multivariable calculus / gradient descent / critical points / "
      + "saddle / local minima / surface plot'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...SURFACE_SCENARIOS], description: "Which surface (default 'bowl'): 'bowl' (one global min), 'saddle' (∇f=0 but no optimum — the ball rolls away), 'monkey' (three valleys), 'wells' (two basins → local minima), 'ripple' (many local minima — where you start decides where you stop)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createSurfaceViewHandler,
  });
}
