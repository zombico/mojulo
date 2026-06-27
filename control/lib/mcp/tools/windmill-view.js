/**
 * create_windmill_view — mint a WINDMILL turned by the wind, in the traversable three.js World: the
 * blades are airfoils (lift), the wind is a flow (streaming particles), and the rotor SPINS.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a windmill type + wind speed); the substrate stores ONLY the recipe (`kind: 'windmill-view'`, no
 * geometry) and regenerates it on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planWindmillScene, WINDMILL_SCENARIOS } from '@/lib/graph/windmill-view';

export function mintWindmillView({ title, scenario, wind, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'windmill-view',
    scenario: WINDMILL_SCENARIOS.includes(scenario) ? scenario : 'turbine',
    ...(Number.isFinite(+wind) ? { wind: +wind } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planWindmillScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} windmill`,
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
    stats: { scenario: plan.stats.scenario, wind: plan.stats.wind, rpm: plan.stats.rpm },
  };
}

export async function createWindmillViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_windmill_view requires a recipe object');
  }
  const { title, scenario, wind, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintWindmillView({ title, scenario, wind, scale, viewBox, scene, ref, folderRef });
}

export function registerWindmillViewTools() {
  registerTool({
    name: 'create_windmill_view',
    description:
      "Mint an interactive WINDMILL turned by the wind — air moving a rotor, rendered in the traversable "
      + "three.js World. It depicts the whole chain from first principles: the blades are AIRFOILS, the "
      + "wind makes LIFT on them, lift's tangential component is a TORQUE, and the rotor SPINS. Wind "
      + "streamlines stream past as flowing particles; the rotor turns live. Two types: 'turbine' (a "
      + "modern 3-blade horizontal-axis wind turbine — tower, nacelle, airfoil blades, tip-speed ratio "
      + "λ = ωR/V) and 'classic' (a Dutch 4-sail tower windmill). The `wind` knob (m/s) drives the "
      + "rotation rate and the particle speed. Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK the rotor/tower for facts. "
      + "You pass a tiny recipe (a windmill type + wind speed); the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'windmill-view'`, no geometry) and regenerates it on render. ORBIT-ONLY "
      + "object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show "
      + "me a wind turbine / how a windmill works / air turning a rotor / wind power / a spinning "
      + "windmill in the wind'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...WINDMILL_SCENARIOS], description: "Windmill type (default 'turbine'): 'turbine' (modern 3-blade wind turbine), 'classic' (Dutch 4-sail windmill)." },
        wind: { type: 'number', description: 'Wind speed in m/s (default 10 for turbine, 8 for classic). Higher → faster rotation and faster streaming particles.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#9cc4e8" } for the sky colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createWindmillViewHandler,
  });
}
