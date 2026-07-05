/**
 * create_reactor_view — mint a CONTROLLED chain reaction: the cascade-view branching reaction plus
 * CONTROL RODS that absorb neutrons, telling the reactor-vs-bomb story (the heart of nuclear ENERGY).
 * A supercritical core that would run away is shut down by dropping in the rods (a SCRAM).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'reactor-view'`, no geometry) and regenerates the deterministic
 * (seeded) run on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planReactorScene, REACTOR_SCENARIO_NAMES } from '@/lib/graph/views/science/reactor-view';

export function mintReactorView({ title, scenario, rods, seed, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'reactor-view',
    scenario: REACTOR_SCENARIO_NAMES.includes(scenario) ? scenario : 'scram',
    ...(Number.isFinite(+rods) ? { rods: +rods } : {}),
    ...(Number.isFinite(+seed) ? { seed: +seed } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planReactorScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `reactor ${manifest.scenario}`,
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
    stats: plan.stats,
  };
}

export async function createReactorViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_reactor_view requires a recipe object');
  }
  const { title, scenario, rods, seed, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintReactorView({ title, scenario, rods, seed, scale, viewBox, scene, ref, folderRef });
}
