/**
 * create_plasma_globe_view — mint a Tesla-style plasma globe: a high-voltage electrode in low-pressure
 * gas, with discrete jagged arcs leaping to the glass, ray-marched as EMISSIVE plasma (no occlusion).
 *
 * Same fractal-generation philosophy as star-birth-view: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'plasma-globe-view'`, no geometry) and regenerates the
 * shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planPlasmaGlobeScene, PLASMA_GLOBE_SCENARIOS } from '@/lib/graph/plasma-globe-view';

export function mintPlasmaGlobeView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'plasma-globe-view',
    scenario: PLASMA_GLOBE_SCENARIOS.includes(scenario) ? scenario : 'neon-argon',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planPlasmaGlobeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} plasma globe`,
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
      inclination: plan.stats.inclination,
      exposure: plan.stats.exposure,
      render: plan.stats.render,
    },
  };
}

export async function createPlasmaGlobeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_plasma_globe_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintPlasmaGlobeView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}

export function registerPlasmaGlobeViewTools() {
  registerTool({
    name: 'create_plasma_globe_view',
    description:
      "Mint a PLASMA GLOBE — the Tesla-style novelty: a high-voltage electrode in low-pressure gas with "
      + "discrete jagged ARCS leaping to a surrounding glass sphere, rendered by the same per-pixel VOLUME "
      + "raymarcher that powers star-birth-view. This is the right tool when the prompt is about a plasma "
      + "globe / plasma ball / electric arcs in a sphere / gas-discharge tube: the arcs are jagged radial "
      + "channels (distance-to-bolt, not a noise cloud), the plasma is EMISSIVE (it glows, it does not "
      + "occlude), and the colour follows real gas-discharge spectra — neon RED at the hot electrode root "
      + "fading to argon/xenon violet-BLUE at the glass. Three gas fills via `scenario`: 'neon-argon' "
      + "(default, pink->violet), 'argon' (more violet), 'xenon' (pink->blue-white). Use `exposure` "
      + "(0.4-4) to tune. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate "
      + "stores ONLY the recipe (`manifest.kind === 'plasma-globe-view'`, no geometry) and regenerates the "
      + "shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...PLASMA_GLOBE_SCENARIOS], description: "The gas fill (default 'neon-argon'): 'neon-argon', 'argon', or 'xenon'." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees (0-88).' },
        exposure: { type: 'number', description: 'Global exposure applied once before tone-map (0.4-4). Higher = brighter.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120x780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#020208" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createPlasmaGlobeViewHandler,
  });
}
