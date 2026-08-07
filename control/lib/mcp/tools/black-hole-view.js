/**
 * create_black_hole_view — mint a Schwarzschild black hole rendered with a per-pixel GENERAL-
 * RELATIVITY raymarcher: gravitational lensing of an accretion disk (the Interstellar / EHT look),
 * the photon ring, the event-horizon shadow, and relativistic Doppler beaming.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination); the substrate stores ONLY the recipe (`kind: 'black-hole-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planBlackHoleScene, BLACK_HOLE_SCENARIOS } from '@/lib/graph/views/science/black-hole-view';

export function mintBlackHoleView({ title, scenario, inclination, diskOuter, beta, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'black-hole-view',
    scenario: BLACK_HOLE_SCENARIOS.includes(scenario) ? scenario : 'interstellar',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+diskOuter) ? { diskOut: +diskOuter } : {}),
    ...(Number.isFinite(+beta) ? { beta: +beta } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planBlackHoleScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} black hole`,
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
    stats: { scenario: plan.stats.scenario, inclination: plan.stats.inclination },
  };
}

export async function createBlackHoleViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_black_hole_view requires a recipe object');
  }
  const { title, scenario, inclination, disk_outer: diskOuter, beta, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintBlackHoleView({ title, scenario, inclination, diskOuter, beta, scale, viewBox, scene, ref, folderRef });
}
