/**
 * create_pulsar_view — mint a rotating, magnetised neutron star: a tiny bright remnant with twin
 * lighthouse beams sweeping from a tilted magnetic axis, ray-marched as luminous participating media.
 *
 * Same fractal-generation philosophy as star-birth-view: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'pulsar-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planPulsarScene, PULSAR_SCENARIOS } from '@/lib/graph/pulsar-view';

export function mintPulsarView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'pulsar-view',
    scenario: PULSAR_SCENARIOS.includes(scenario) ? scenario : 'oblique',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planPulsarScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} pulsar`,
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

export async function createPulsarViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_pulsar_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintPulsarView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}

export function registerPulsarViewTools() {
  registerTool({
    name: 'create_pulsar_view',
    description:
      "Mint a PULSAR — a rapidly spinning, magnetised NEUTRON STAR with twin radiation beams that sweep "
      + "like a lighthouse, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view "
      + "and galaxy-view. This is the right tool when the prompt is about a pulsar / spinning neutron star "
      + "/ lighthouse beams: a tiny savage point source, twin beams along a magnetic axis TILTED from the "
      + "spin axis (so they sweep as it rotates), a brightening 'pulse' each time a beam crosses the "
      + "sightline, and a faint synchrotron nebula. Three looks via `scenario`: 'oblique' (default), "
      + "'orthogonal' (near-perpendicular rotator, strong sweep), 'aligned' (small tilt, weak pulse). Use "
      + "`inclination` (0 = pole-on, 90 = equator-on) and `exposure` (0.4-4) to tune the view. Served as a "
      + "live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe "
      + "(`manifest.kind === 'pulsar-view'`, no geometry) and regenerates the shader on render. "
      + "ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...PULSAR_SCENARIOS], description: "The look (default 'oblique'): 'oblique', 'orthogonal', or 'aligned'." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees (0-88). 0 = looking down the spin axis; 90 = equator-on.' },
        exposure: { type: 'number', description: 'Global exposure applied once before tone-map (0.4-4). Higher = brighter.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120x780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#01020a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createPulsarViewHandler,
  });
}
