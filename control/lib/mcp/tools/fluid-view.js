/**
 * create_fluid_view — mint a fluid-dynamics depictor, opening with LIFT: an airfoil in a real
 * Joukowski POTENTIAL FLOW, rendered in the traversable three.js World. Lift is not drawn — it
 * EMERGES from the computed circulation (the Kutta condition), the faster-over-top flow, and
 * Kutta–Joukowski L = ρ·V·Γ.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario + angle of attack); the substrate stores ONLY the recipe (`kind: 'fluid-view'`, no
 * geometry) and regenerates the flow on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFluidScene, FLUID_SCENARIOS } from '@/lib/graph/landscape/fluid-view';

export function mintFluidView({ title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fluid-view',
    scenario: FLUID_SCENARIOS.includes(scenario) ? scenario : 'airfoil',
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(Number.isFinite(+viscosity) ? { viscosity: +viscosity } : {}),
    ...(Number.isFinite(+spin) ? { spin: +spin } : {}),
    ...(Array.isArray(emitters) ? { emitters } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFluidScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — lift`,
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
    stats: {
      scenario: plan.stats.scenario, faces: plan.faces.length,
      ...(plan.stats.Gamma != null ? { circulation: +plan.stats.Gamma.toFixed(3) } : {}),
      ...(plan.stats.topRatio != null ? { topSpeedRatio: +plan.stats.topRatio.toFixed(2) } : {}),
      ...(plan.stats.rho != null ? { density: plan.stats.rho, state: plan.stats.floats ? (plan.stats.rho > 0.97 ? 'neutral' : 'floats') : 'sinks', submergedFrac: +plan.stats.submergedFrac.toFixed(2) } : {}),
      ...(plan.stats.viscosities ? { viscosities: plan.stats.viscosities } : {}),
      ...(plan.stats.mu != null ? { viscosity: plan.stats.mu } : {}),
    },
  };
}

export async function createFluidViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fluid_view requires a recipe object');
  }
  const { title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFluidView({ title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folderRef });
}
