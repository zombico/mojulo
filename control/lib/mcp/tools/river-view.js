/**
 * create_river_view — mint a winding RIVER flowing through terrain it has carved into a valley, in the
 * traversable three.js World. Six kinds (creek / river / gorge / canal / lazy / lava) are one primitive
 * at different points in its parameter space — the surface channel's `river` mode over carved fBm terrain.
 *
 * Same fractal-generation philosophy as the other landscape views: the operator passes a tiny RECIPE
 * (a kind + seed); the substrate stores ONLY the recipe (`kind: 'river-view'`, no geometry) and
 * regenerates the valley + flow on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planRiverScene, RIVER_SCENARIOS } from '@/lib/graph/landscape/river-view';

export function mintRiverView({ title, scenario, seed, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'river-view',
    scenario: RIVER_SCENARIOS.includes(scenario) ? scenario : 'river',
    ...(Number.isFinite(+seed) ? { seed: Math.floor(+seed) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.4, Math.min(3, +scale)) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planRiverScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} river`,
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
    stats: { scenario: plan.stats.scenario, seed: plan.stats.seed, flow: plan.stats.flow },
  };
}

export async function createRiverViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_river_view requires a recipe object');
  }
  const { title, scenario, seed, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintRiverView({ title, scenario, seed, scale, viewBox, scene, ref, folderRef });
}
