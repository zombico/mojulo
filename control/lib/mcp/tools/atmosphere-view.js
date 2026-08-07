/**
 * create_atmosphere_view — mint ATMOSPHERIC SCATTERING (why the sky is blue and sunsets are red),
 * derived the textbook-correct way: a single-scattering VOLUME integral of sunlight along the view ray,
 * ray-marched. Light-transport, not a colour gradient — the blue zenith, the reddened terminator, the
 * forward sun-halo, and the backlit limb glow all fall out of Rayleigh (λ⁻⁴) + Mie scattering.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * lighting scenario + optional brightness); the substrate stores ONLY the recipe (`kind:
 * 'atmosphere-view'`, no geometry) and regenerates the shader on render. Orbit-only object study —
 * returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planAtmosphereScene, ATMOSPHERE_SCENARIOS } from '@/lib/graph/landscape/atmosphere-view';

export function mintAtmosphereView({ title, scenario, brightness, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'atmosphere-view',
    scenario: ATMOSPHERE_SCENARIOS.includes(scenario) ? scenario : 'day',
    ...(Number.isFinite(+brightness) ? { brightness: +brightness } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planAtmosphereScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} atmosphere`,
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
    stats: { scenario: plan.stats.scenario, brightness: plan.stats.sunI, render: plan.stats.render },
  };
}

export async function createAtmosphereViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_atmosphere_view requires a recipe object');
  }
  const { title, scenario, brightness, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintAtmosphereView({ title, scenario, brightness, viewBox, scene, ref, folderRef });
}
