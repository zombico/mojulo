/**
 * create_double_slit_view — mint the double-slit experiment as a RIPPLE TANK in the traversable
 * three.js World: an incoming wave hits a barrier with two slits, each slit re-emits a circular wave,
 * and their overlap forms the interference fringes, projected on a screen.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * scenario + slit separation); the substrate stores ONLY the recipe (`kind: 'double-slit-view'`, no
 * geometry) and regenerates the wavefield on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planDoubleSlitScene, DOUBLE_SLIT_SCENARIOS } from '@/lib/graph/views/science/double-slit-view';

export function mintDoubleSlitView({ title, scenario, separation, slitWidth, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'double-slit-view',
    scenario: DOUBLE_SLIT_SCENARIOS.includes(scenario) ? scenario : 'double',
    ...(Number.isFinite(+separation) ? { separation: +separation } : {}),
    ...(Number.isFinite(+slitWidth) ? { slitWidth: +slitWidth } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planDoubleSlitScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} double-slit`,
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
    stats: { scenario: plan.stats.scenario, separation: plan.stats.separation },
  };
}

export async function createDoubleSlitViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_double_slit_view requires a recipe object');
  }
  const { title, scenario, separation, slit_width: slitWidth, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintDoubleSlitView({ title, scenario, separation, slitWidth, scale, viewBox, scene, ref, folderRef });
}
