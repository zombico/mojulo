/**
 * create_series_view — mint APPROXIMATION made visible: a true curve f(x) (white) and a family of partial
 * sums (cool = few terms → warm = many) that hug it more closely as terms accrete. Taylor & Fourier series,
 * convergence, and the interval where it holds. taylor-sin/taylor-exp/geometric/fourier-square/fourier-saw.
 * Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'series-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planSeriesScene, SERIES_SCENARIOS } from '@/lib/graph/views/math/series-view';

export function mintSeriesView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'series-view',
    scenario: SERIES_SCENARIOS.includes(scenario) ? scenario : 'taylor-sin',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planSeriesScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Series (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats,
  };
}

export async function createSeriesViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_series_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintSeriesView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}
