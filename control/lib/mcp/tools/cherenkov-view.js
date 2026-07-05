/**
 * create_cherenkov_view — mint CHERENKOV RADIATION: the eerie blue glow of a reactor pool (and the bare
 * shock cone behind a faster-than-light-in-water particle), ray-marched as a time-evolving emission VOLUME.
 * A LIGHT-TRANSPORT subject (the optical analog of a sonic boom), distinct from the topology-change
 * fission/fusion views.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'cherenkov-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planCherenkovScene, CHERENKOV_SCENARIOS } from '@/lib/graph/views/science/cherenkov-view';

export function mintCherenkovView({ title, scenario, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'cherenkov-view',
    scenario: CHERENKOV_SCENARIOS.includes(scenario) ? scenario : 'pool',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCherenkovScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} Cherenkov glow`,
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
    stats: { scenario: plan.stats.scenario, density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createCherenkovViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_cherenkov_view requires a recipe object');
  }
  const { title, scenario, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCherenkovView({ title, scenario, density, viewBox, scene, ref, folderRef });
}
