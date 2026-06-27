/**
 * create_lightning_storm_view — mint a volumetric storm-cloud deck threaded with lightning: fbm clouds
 * plus an electric-arc primitive whose strikes appear, travel along an arc, flash, and vanish.
 *
 * Same fractal-generation philosophy as star-birth-view: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'lightning-storm-view'`, no geometry) and regenerates the
 * shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planLightningStormScene, LIGHTNING_STORM_SCENARIOS } from '@/lib/graph/lightning-storm-view';

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

export function registerLightningStormViewTools() {
  registerTool({
    name: 'create_lightning_storm_view',
    description:
      "Mint a LIGHTNING STORM — a volumetric storm-cloud deck threaded with lightning, rendered by the "
      + "same per-pixel VOLUME raymarcher that powers star-birth-view. This is the right tool when the "
      + "prompt is about a thunderstorm / lightning / storm clouds / electrical discharge in the sky: the "
      + "clouds are fbm participating media (dense, so they OCCLUDE bolts behind them — sheet lightning), "
      + "and each strike is built from a jagged ELECTRIC-ARC primitive that appears, draws its leader "
      + "along a bowed arc, flashes a return stroke, lights the surrounding cloud, then vanishes. Two "
      + "scenarios: 'cloud-to-ground' (default, jagged bolts plunge toward the ground) and 'cloud-to-cloud' "
      + "(long horizontal arcs leap between cloud cells, bowing and wandering with length). Use `exposure` "
      + "(0.4-4) to tune. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate "
      + "stores ONLY the recipe (`manifest.kind === 'lightning-storm-view'`, no geometry) and regenerates "
      + "the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...LIGHTNING_STORM_SCENARIOS], description: "The strike geometry (default 'cloud-to-ground'): 'cloud-to-ground' or 'cloud-to-cloud'." },
        exposure: { type: 'number', description: 'Global exposure applied once before tone-map (0.4-4). Higher = brighter.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120x780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05060f" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createLightningStormViewHandler,
  });
}
