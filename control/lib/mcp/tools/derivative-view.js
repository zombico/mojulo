/**
 * create_derivative_view — mint the DERIVATIVE as the slope of the tangent, reached as a LIMIT: a second
 * point Q slides toward a fixed point P and the SECANT line through them swings into the TANGENT. The
 * fan of secants for shrinking h converges visibly on one line, the secant slope Δy/Δx converges on
 * f′(a), and a rise/run triangle reads off the slope. Part of mojulo's EDUCATION module (math
 * explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus an
 * optional tangent point); the substrate stores ONLY the recipe (`kind: 'derivative-view'`, no
 * geometry) and regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planDerivativeScene, DERIVATIVE_SCENARIOS } from '@/lib/graph/views/math/derivative-view';

export function mintDerivativeView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'derivative-view',
    scenario: DERIVATIVE_SCENARIOS.includes(scenario) ? scenario : 'parabola',
    ...(Number.isFinite(+at) ? { at: +at } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planDerivativeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Derivative as a limit (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createDerivativeViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_derivative_view requires a recipe object');
  const { title, scenario, at, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintDerivativeView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef });
}
