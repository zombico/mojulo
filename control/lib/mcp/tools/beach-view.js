/**
 * create_beach_view — mint an animated SHORELINE in the traversable three.js World: the sea rolling in
 * and lapping onto a sloped sand beach. Rides the same Gerstner surface channel as ocean-view, but the
 * wave trains travel onshore and SHOAL — height + slope taper to nothing at the waterline, the shallows
 * lighten, and a foam swash line laps up the sand.
 *
 * Same philosophy as the other science views: the operator passes a tiny RECIPE (a sea state); the
 * substrate stores ONLY the recipe (`kind: 'beach-view'`, no geometry) and regenerates the wave
 * spectrum + sand wedge on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planBeachScene, BEACH_SCENARIOS } from '@/lib/graph/landscape/beach-view';

export function mintBeachView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'beach-view',
    scenario: BEACH_SCENARIOS.includes(scenario) ? scenario : 'calm',
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planBeachScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} beach`,
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

export async function createBeachViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_beach_view requires a recipe object');
  }
  const { title, scenario, amplitude, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintBeachView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef });
}
