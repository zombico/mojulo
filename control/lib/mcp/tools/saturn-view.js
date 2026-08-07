/**
 * create_saturn_view — mint Saturn and its rings, rendered by a per-pixel ray-tracing fragment shader
 * (the same raymarch-mode path as the black hole). The shader does what meshes can't cleanly: the
 * rings cast a shadow on the planet, the planet casts its shadow across the rings, the rings are
 * semi-transparent, and backlit they glow by forward-scattered light.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination); the substrate stores ONLY the recipe (`kind: 'saturn-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planSaturnScene, SATURN_SCENARIOS, SATURN_PLANETS } from '@/lib/graph/views/science/saturn-view';

export function mintSaturnView({ title, planet, gallery, scenario, inclination, ringOuter, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'saturn-view',
    ...(gallery === true ? { gallery: true } : {}),
    ...(SATURN_PLANETS.includes(planet) ? { planet } : {}),
    scenario: SATURN_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+ringOuter) ? { ringOut: +ringOuter } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planSaturnScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `Saturn (${manifest.scenario})`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats.gallery
      ? { gallery: true, planets: plan.stats.planets }
      : { planet: plan.stats.planet, scenario: plan.stats.scenario, inclination: plan.stats.inclination, backlit: plan.stats.backlit },
  };
}

export async function createSaturnViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_saturn_view requires a recipe object');
  }
  const { title, planet, gallery, scenario, inclination, ring_outer: ringOuter, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintSaturnView({ title, planet, gallery, scenario, inclination, ringOuter, scale, viewBox, scene, ref, folderRef });
}
