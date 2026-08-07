/**
 * create_comet_view — mint a comet depictor: a comet on a real, highly eccentric Kepler orbit around
 * the Sun, growing a coma + an anti-solar ion tail + a curved dust tail that BLOOM near perihelion and
 * shrink to nothing near aphelion. The "how the trail is made" sibling of create_orbit_view: same
 * Kepler machinery + real-units readout, focused on the tail mechanism.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'comet-view'`, no geometry) and
 * regenerates the comet on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planCometScene, COMET_SCENARIOS } from '@/lib/graph/views/science/comet-view';

export function mintCometView({ title, scenario, scale, tails, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'comet-view',
    scenario: COMET_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.3, +scale) } : {}),
    ...(tails === false ? { tails: false } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCometScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — comet`,
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
    stats: { scenario: plan.stats.scenario, e: plan.stats.e, period: plan.stats.period, perihelionAU: plan.stats.perihelionAU },
  };
}

export async function createCometViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_comet_view requires a recipe object');
  }
  const { title, scenario, scale, tails, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCometView({ title, scenario, scale, tails, viewBox, scene, ref, folderRef });
}
