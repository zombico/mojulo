/**
 * create_galaxy_view — mint an artistic-but-structurally-honest MILKY WAY spiral galaxy rendered by a
 * per-pixel VOLUME raymarcher: a full-screen fragment shader that integrates EMISSION and ABSORPTION
 * through a 3-D stellar-density field along each view ray (the mesh renderer can only scatter points;
 * the shader gives real luminous participating media — dust-lane extinction, glow haze, depth).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination + exposure); the substrate stores ONLY the recipe (`kind: 'galaxy-view'`,
 * no geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planGalaxyScene, GALAXY_SCENARIOS } from '@/lib/graph/views/science/galaxy-view';

export function mintGalaxyView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'galaxy-view',
    scenario: GALAXY_SCENARIOS.includes(scenario) ? scenario : 'oblique',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planGalaxyScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} galaxy`,
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
    stats: { scenario: plan.stats.scenario, inclination: plan.stats.inclination, exposure: plan.stats.exposure },
  };
}

export async function createGalaxyViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_galaxy_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintGalaxyView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}
