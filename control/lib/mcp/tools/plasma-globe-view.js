/**
 * create_plasma_globe_view — mint a Tesla-style plasma globe: a high-voltage electrode in low-pressure
 * gas, with discrete jagged arcs leaping to the glass, ray-marched as EMISSIVE plasma (no occlusion).
 *
 * Same fractal-generation philosophy as star-birth-view: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'plasma-globe-view'`, no geometry) and regenerates the
 * shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planPlasmaGlobeScene, PLASMA_GLOBE_SCENARIOS } from '@/lib/graph/views/science/plasma-globe-view';

export function mintPlasmaGlobeView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'plasma-globe-view',
    scenario: PLASMA_GLOBE_SCENARIOS.includes(scenario) ? scenario : 'neon-argon',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planPlasmaGlobeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} plasma globe`,
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

export async function createPlasmaGlobeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_plasma_globe_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintPlasmaGlobeView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}
