/**
 * create_view kind 'waterfall' — mint a WATERFALL: a river that runs off a cliff, falls, and plunges into a pool, in
 * the traversable three.js World. Three kinds (veil / curtain / horsetail) are the falling-water primitive at
 * different points in its parameter space — a sheet over a lip or a round spout through a notch, glassy at the top,
 * whitening and fraying as it falls, churning a simulated plunge pool.
 *
 * Same fractal-generation philosophy as the other landscape views: the operator passes a tiny RECIPE (a kind + seed);
 * the substrate stores ONLY the recipe (`kind: 'waterfall-view'`, no geometry) and regenerates on render.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planWaterfallScene, WATERFALL_SCENARIOS } from '@/lib/graph/landscape/waterfall-view';

export function mintWaterfallView({ title, scenario, seed, scale, flow, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'waterfall-view',
    scenario: WATERFALL_SCENARIOS.includes(scenario) ? scenario : 'veil',
    ...(Number.isFinite(+seed) ? { seed: Math.floor(+seed) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.4, Math.min(3, +scale)) } : {}),
    ...(Number.isFinite(+flow) && +flow > 0 ? { flow: Math.max(0.05, Math.min(2000, +flow)) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planWaterfallScene(manifest);

  const sketch = SketchRepository.create({
    title: title || `${manifest.scenario} waterfall`,
    manifest, ref, folderRef: folderRef ?? null,
  });

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { scenario: plan.stats.scenario, seed: plan.stats.seed, flow: plan.stats.flow, fall: plan.stats.fall, breakup: plan.stats.breakup },
  };
}

export async function createWaterfallViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_view waterfall requires a recipe object');
  }
  const { title, scenario, seed, scale, flow, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintWaterfallView({ title, scenario, seed, scale, flow, viewBox, scene, ref, folderRef });
}
