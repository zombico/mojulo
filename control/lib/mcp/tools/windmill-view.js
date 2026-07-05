/**
 * create_windmill_view — mint a WINDMILL turned by the wind, in the traversable three.js World: the
 * blades are airfoils (lift), the wind is a flow (streaming particles), and the rotor SPINS.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a windmill type + wind speed); the substrate stores ONLY the recipe (`kind: 'windmill-view'`, no
 * geometry) and regenerates it on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planWindmillScene, WINDMILL_SCENARIOS } from '@/lib/graph/vehicles/windmill-view';

export function mintWindmillView({ title, scenario, wind, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'windmill-view',
    scenario: WINDMILL_SCENARIOS.includes(scenario) ? scenario : 'turbine',
    ...(Number.isFinite(+wind) ? { wind: +wind } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planWindmillScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} windmill`,
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
    stats: { scenario: plan.stats.scenario, wind: plan.stats.wind, rpm: plan.stats.rpm },
  };
}

export async function createWindmillViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_windmill_view requires a recipe object');
  }
  const { title, scenario, wind, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintWindmillView({ title, scenario, wind, scale, viewBox, scene, ref, folderRef });
}
