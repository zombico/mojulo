/**
 * create_heat_sphere_view — mint the HEAT EQUATION on a sphere: the top pole held hot (red), the bottom
 * pole cold (blue), temperature DIFFUSING across the surface until the ball settles to one lukewarm
 * shade. Exact modal solution T(θ,t) = Σ aₗ Pₗ(cosθ) e^(−l(l+1)κt) — the finest bands vanish first, the
 * broadest hot/cold split lingers longest. poles / cap / dipole / banded. Part of mojulo's EDUCATION
 * module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario + κ); the
 * substrate stores ONLY the recipe (`kind:'heat-sphere-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planHeatSphereScene, HEAT_SPHERE_SCENARIOS } from '@/lib/graph/views/math/heat-sphere-view';

export function mintHeatSphereView({ title, scenario, kappa, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'heat-sphere-view',
    scenario: HEAT_SPHERE_SCENARIOS.includes(scenario) ? scenario : 'poles',
    ...(Number.isFinite(+kappa) ? { kappa: +kappa } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planHeatSphereScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Heat sphere (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createHeatSphereViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_heat_sphere_view requires a recipe object');
  const { title, scenario, kappa, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintHeatSphereView({ title, scenario, kappa, scale, viewBox, scene, ref, folderRef });
}
