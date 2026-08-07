/**
 * create_probability_view — mint a GALTON BOARD: balls drop through a triangle of pegs, bounce left/right,
 * and pile into bins that form a BELL CURVE (the Central Limit Theorem made visceral). The bars are the
 * exact binomial; a Gaussian is overlaid so you watch the binomial approach the normal.
 * few/classic/tall/skew. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus optional
 * board knobs); the substrate stores ONLY the recipe (`kind: 'probability-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planProbabilityScene, PROBABILITY_SCENARIOS } from '@/lib/graph/views/math/probability-view';

export function mintProbabilityView({ title, scenario, rows, p, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'probability-view',
    scenario: PROBABILITY_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+rows) ? { rows: +rows } : {}),
    ...(Number.isFinite(+p) ? { p: +p } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planProbabilityScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Galton board (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createProbabilityViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_probability_view requires a recipe object');
  const { title, scenario, rows, p, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintProbabilityView({ title, scenario, rows, p, scale, viewBox, scene, ref, folderRef });
}
