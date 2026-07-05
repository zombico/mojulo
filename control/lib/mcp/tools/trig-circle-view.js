/**
 * create_trig_circle_view — mint the UNIT CIRCLE, the one machine all of trigonometry comes from. A point
 * rides around the circle; its HEIGHT is sin θ and its WIDTH is cos θ. To the right the angle is
 * UNWRAPPED into the wave — "the circle becomes the wave" — with synced beads riding both. Part of
 * mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * marker angle); the substrate stores ONLY the recipe (`kind: 'trig-circle-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planTrigCircleScene, TRIG_SCENARIOS } from '@/lib/graph/views/math/trig-circle-view';

export function mintTrigCircleView({ title, scenario, angle, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'trig-circle-view',
    scenario: TRIG_SCENARIOS.includes(scenario) ? scenario : 'sine',
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTrigCircleScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Unit circle (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createTrigCircleViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_trig_circle_view requires a recipe object');
  const { title, scenario, angle, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTrigCircleView({ title, scenario, angle, scale, viewBox, scene, ref, folderRef });
}
