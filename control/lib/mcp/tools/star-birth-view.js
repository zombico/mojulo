/**
 * create_star_birth_view — mint a single-star birth scene: a dusty molecular cloud collapsing around a
 * protostar, with accretion disk and bipolar outflows, ray-marched as luminous participating media.
 *
 * Same fractal-generation philosophy as galaxy-view: the operator passes a tiny RECIPE; the substrate
 * stores ONLY the recipe (`kind: 'star-birth-view'`, no geometry) and regenerates the shader on render.
 * Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planStarBirthScene, STAR_BIRTH_SCENARIOS } from '@/lib/graph/views/science/star-birth-view';

export function mintStarBirthView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'star-birth-view',
    scenario: STAR_BIRTH_SCENARIOS.includes(scenario) ? scenario : 'protostar',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planStarBirthScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} star birth`,
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
    stats: {
      scenario: plan.stats.scenario,
      inclination: plan.stats.inclination,
      exposure: plan.stats.exposure,
      render: plan.stats.render,
    },
  };
}

export async function createStarBirthViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_star_birth_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintStarBirthView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}
