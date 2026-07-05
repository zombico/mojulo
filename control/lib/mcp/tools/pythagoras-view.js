/**
 * create_pythagoras_view — mint the iconic a² + b² = c² figure. 'squares' builds the coloured square on
 * each side (blue a², green b², orange c²) so you SEE the two leg-squares equal the hypotenuse square;
 * 'dissection' is the one-figure proof — four triangles around a tilted c² square inside an (a+b)²
 * square. The `a`/`b` knobs make it any right triangle. Part of mojulo's EDUCATION module (math
 * explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * two legs); the substrate stores ONLY the recipe (`kind: 'pythagoras-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planPythagorasScene, PYTHAGORAS_SCENARIOS } from '@/lib/graph/views/math/pythagoras-view';

export function mintPythagorasView({ title, scenario, a, b, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'pythagoras-view',
    scenario: PYTHAGORAS_SCENARIOS.includes(scenario) ? scenario : 'squares',
    ...(Number.isFinite(+a) ? { a: +a } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planPythagorasScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Pythagoras (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createPythagorasViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_pythagoras_view requires a recipe object');
  const { title, scenario, a, b, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintPythagorasView({ title, scenario, a, b, scale, viewBox, scene, ref, folderRef });
}
