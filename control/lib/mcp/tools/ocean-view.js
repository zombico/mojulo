/**
 * create_ocean_view — mint an animated OCEAN SURFACE in the traversable three.js World: a grid mesh
 * deformed every frame by a Gerstner "waveform sequence" (a sum of moving wave trains), lit, with
 * buoys riding the swell.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a sea state); the substrate stores ONLY the recipe (`kind: 'ocean-view'`, no geometry) and
 * regenerates the wave spectrum on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planOceanScene, OCEAN_SCENARIOS } from '@/lib/graph/landscape/ocean-view';

export function mintOceanView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'ocean-view',
    scenario: OCEAN_SCENARIOS.includes(scenario) ? scenario : 'swell',
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planOceanScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} ocean`,
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
    stats: { scenario: plan.stats.scenario, components: plan.stats.components, maxAmp: +plan.stats.maxAmp.toFixed(2) },
  };
}

export async function createOceanViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_ocean_view requires a recipe object');
  }
  const { title, scenario, amplitude, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintOceanView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef });
}
