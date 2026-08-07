/**
 * create_gravity_wave_view — mint a SPACETIME MEMBRANE rippling under a compact-binary INSPIRAL in the
 * traversable three.js World: a grid mesh deformed every frame by the quadrupole GRAVITATIONAL-WAVE
 * STRAIN of two masses spiralling together — the chirp, merger and ringdown of an LIGO-style event.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * binary scenario); the substrate stores ONLY the recipe (`kind: 'gravity-wave-view'`, no geometry) and
 * regenerates the strain field on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planGravityWaveScene, GRAVITY_WAVE_SCENARIOS } from '@/lib/graph/views/science/gravity-wave-view';

export function mintGravityWaveView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'gravity-wave-view',
    scenario: GRAVITY_WAVE_SCENARIOS.includes(scenario) ? scenario : 'inspiral',
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planGravityWaveScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} gravitational waves`,
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
    stats: plan.stats.scenario === 'ring'
      ? { scenario: 'ring', strain: plan.stats.strain, period: plan.stats.period, masses: plan.stats.masses }
      : { scenario: plan.stats.scenario, chirpMassMsun: plan.stats.chirpMassMsun, cycles: plan.stats.cycles },
  };
}

export async function createGravityWaveViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_gravity_wave_view requires a recipe object');
  }
  const { title, scenario, amplitude, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintGravityWaveView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef });
}
