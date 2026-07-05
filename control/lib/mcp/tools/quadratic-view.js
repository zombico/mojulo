/**
 * create_quadratic_view — mint the PARABOLA y = ax²+bx+c with its ROOTS (x-axis crossings, red), its
 * VERTEX (gold) and the DISCRIMINANT Δ = b²−4ac that decides how many real roots there are. The
 * degenerate-control story: as Δ crosses zero the two roots MERGE into one then VANISH as the parabola
 * lifts off the axis. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * coefficients); the substrate stores ONLY the recipe (`kind: 'quadratic-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planQuadraticScene, QUADRATIC_SCENARIOS } from '@/lib/graph/views/math/quadratic-view';

export function mintQuadraticView({ title, scenario, a, b, c, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'quadratic-view',
    scenario: QUADRATIC_SCENARIOS.includes(scenario) ? scenario : 'two',
    ...(Number.isFinite(+a) ? { a: +a } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(Number.isFinite(+c) ? { c: +c } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planQuadraticScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Quadratic (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createQuadraticViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_quadratic_view requires a recipe object');
  const { title, scenario, a, b, c, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintQuadraticView({ title, scenario, a, b, c, scale, viewBox, scene, ref, folderRef });
}
