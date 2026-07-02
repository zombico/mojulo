/**
 * create_cherenkov_view — mint CHERENKOV RADIATION: the eerie blue glow of a reactor pool (and the bare
 * shock cone behind a faster-than-light-in-water particle), ray-marched as a time-evolving emission VOLUME.
 * A LIGHT-TRANSPORT subject (the optical analog of a sonic boom), distinct from the topology-change
 * fission/fusion views.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'cherenkov-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planCherenkovScene, CHERENKOV_SCENARIOS } from '@/lib/graph/views/science/cherenkov-view';

export function mintCherenkovView({ title, scenario, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'cherenkov-view',
    scenario: CHERENKOV_SCENARIOS.includes(scenario) ? scenario : 'pool',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCherenkovScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} Cherenkov glow`,
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
    stats: { scenario: plan.stats.scenario, density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createCherenkovViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_cherenkov_view requires a recipe object');
  }
  const { title, scenario, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCherenkovView({ title, scenario, density, viewBox, scene, ref, folderRef });
}

export function registerCherenkovViewTools() {
  registerTool({
    name: 'create_cherenkov_view',
    description:
      "Mint CHERENKOV RADIATION — the eerie BLUE GLOW of a submerged reactor core, ray-marched as a "
      + "time-evolving emission VOLUME. A charged particle moving through water FASTER than light travels "
      + "in water (v > c/n, n≈1.33) drags a luminous shock cone behind it — the optical analog of a sonic "
      + "boom — and the light is blue/UV-weighted (Frank–Tamm: intensity ∝ 1/λ², which is WHY it glows "
      + "blue). This is a LIGHT-TRANSPORT subject (distinct from the topology-change fission/fusion "
      + "views). Two scenarios: 'pool' (the iconic reactor-pool glow — brightest at the fuel, fading into "
      + "the water, with energetic particle streaks rising) and 'cone' (the bare shock cone of a single "
      + "relativistic particle, whose half-angle obeys cos θc = 1/(βn) ≈ 0.76, θc ≈ 41°). Drag to ORBIT "
      + "the camera, scroll to zoom; the glow animates on its own. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'cherenkov-view'`, no geometry) and regenerates the shader on render. "
      + "ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing "
      + "like 'show me Cherenkov radiation / the blue glow in a reactor / why reactor pools glow blue'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...CHERENKOV_SCENARIOS], description: "Which depiction (default 'pool'): 'pool' (a submerged reactor core's blue glow with rising particle streaks) or 'cone' (the bare Cherenkov shock cone of one relativistic particle — the light-transport geometry)." },
        density: { type: 'number', description: 'Opacity/brightness of the blue glow (1–30). Higher = denser, more opaque. Overrides the scenario default.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#02040a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createCherenkovViewHandler,
  });
}
