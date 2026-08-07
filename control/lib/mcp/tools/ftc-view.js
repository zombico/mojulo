/**
 * create_ftc_view — mint the FUNDAMENTAL THEOREM OF CALCULUS in two stacked panels. TOP: a function
 * f(t) with the AREA from 0 to x shaded. BOTTOM: the area-so-far function A(x) = ∫₀ˣ f. The punchline:
 * the RATE the area grows = the HEIGHT of f at x = the SLOPE of A at x, so A′(x) = f(x) — differentiating
 * the area gives the function back. The red height bar up top and the gold tangent slope down below are
 * the SAME number. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus an
 * optional sweep position); the substrate stores ONLY the recipe (`kind: 'ftc-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFtcScene, FTC_SCENARIOS } from '@/lib/graph/views/math/ftc-view';

export function mintFtcView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'ftc-view',
    scenario: FTC_SCENARIOS.includes(scenario) ? scenario : 'linear',
    ...(Number.isFinite(+at) ? { at: +at } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFtcScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Fundamental theorem of calculus (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createFtcViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_ftc_view requires a recipe object');
  const { title, scenario, at, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFtcView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef });
}
