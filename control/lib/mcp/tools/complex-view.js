/**
 * create_complex_view — mint a COMPLEX FUNCTION f(z) shown as an ANALYTIC LANDSCAPE (domain colouring in
 * 3-D): height = log|f| so ZEROS sink into pits and POLES erupt into spikes, while colour = the phase
 * arg(f) swept round a hue wheel. Complex analysis made orbit-able terrain. Part of mojulo's EDUCATION
 * module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'complex-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planComplexScene, COMPLEX_SCENARIOS } from '@/lib/graph/views/math/complex-view';

export function mintComplexView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'complex-view',
    scenario: COMPLEX_SCENARIOS.includes(scenario) ? scenario : 'square',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planComplexScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Complex landscape (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createComplexViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_complex_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintComplexView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}
