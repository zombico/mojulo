/**
 * create_lightning_storm_view — mint a volumetric storm-cloud deck threaded with lightning: fbm clouds
 * plus an electric-arc primitive whose strikes appear, travel along an arc, flash, and vanish.
 *
 * Same fractal-generation philosophy as star-birth-view: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'lightning-storm-view'`, no geometry) and regenerates the
 * shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planLightningStormScene, LIGHTNING_STORM_SCENARIOS } from '@/lib/graph/views/science/lightning-storm-view';

export function mintLightningStormView({ title, scenario, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'lightning-storm-view',
    scenario: LIGHTNING_STORM_SCENARIOS.includes(scenario) ? scenario : 'cloud-to-ground',
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planLightningStormScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} lightning`,
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
      scenario: plan.stats.scenario,
      exposure: plan.stats.exposure,
      render: plan.stats.render,
    },
  };
}

export async function createLightningStormViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_lightning_storm_view requires a recipe object');
  }
  const { title, scenario, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintLightningStormView({ title, scenario, exposure, viewBox, scene, ref, folderRef });
}
