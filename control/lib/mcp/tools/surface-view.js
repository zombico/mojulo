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
import { planSurfaceScene, SURFACE_SCENARIOS } from '@/lib/graph/views/math/surface-view';

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
