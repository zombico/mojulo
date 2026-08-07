/**
 * create_complete_square_view — mint the geometric move behind the QUADRATIC FORMULA: completing the
 * square. x² + bx is a square of side x plus a b-by-x rectangle; split that rectangle and wrap the two
 * halves around the square and you get an L that is ALMOST (x + b/2)² — short by exactly one corner of
 * (b/2)². So x² + bx = (x + b/2)² − (b/2)²; "completing" means adding the orange corner. Colour-coded
 * algebra tiles: teal x², amber strips = bx, orange = the (b/2)² completion. Part of mojulo's EDUCATION
 * module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus
 * optional knobs); the substrate stores ONLY the recipe (`kind: 'complete-square-view'`, no geometry)
 * and regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planCompleteSquareScene, COMPLETE_SQUARE_SCENARIOS } from '@/lib/graph/views/math/complete-square-view';

export function mintCompleteSquareView({ title, scenario, x, b, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'complete-square-view',
    scenario: COMPLETE_SQUARE_SCENARIOS.includes(scenario) ? scenario : 'square',
    ...(Number.isFinite(+x) ? { x: +x } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCompleteSquareScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Completing the square (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createCompleteSquareViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_complete_square_view requires a recipe object');
  const { title, scenario, x, b, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCompleteSquareView({ title, scenario, x, b, animate, scale, viewBox, scene, ref, folderRef });
}
