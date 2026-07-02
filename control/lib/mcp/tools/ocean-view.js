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
import { registerTool } from '@/lib/mcp/server';
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

export function registerOceanViewTools() {
  registerTool({
    name: 'create_ocean_view',
    description:
      "Mint an interactive ANIMATED OCEAN SURFACE — a live sea that heaves and rolls, rendered in the "
      + "traversable three.js World. The surface is a grid mesh deformed every frame by a GERSTNER "
      + "'waveform sequence': a superposition of moving wave trains (height Σ A·sin θ, with the Gerstner "
      + "horizontal pull that sharpens crests and broadens troughs), lit by a sun so it catches "
      + "highlights, with foam on the whitecaps and red/gold buoys that ride the swell — tracing the "
      + "circular orbital motion of the water. Accurate physics: deep-water dispersion ω = √(g·k), so "
      + "longer waves travel faster. Three sea states: 'swell' (long, low, smooth — a calm ocean), "
      + "'chop' (short steep wind waves, foamy), 'storm' (big mixed seas, whitecaps); an `amplitude` "
      + "knob scales the whole sea. Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe (a sea "
      + "state); the substrate stores ONLY the recipe (`manifest.kind === 'ocean-view'`, no geometry) "
      + "and regenerates the wave spectrum on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; "
      + "open the worldUrl. Reach for this on framing like 'animate an ocean / ocean waves / a stormy "
      + "sea / water surface waves / a rolling swell'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...OCEAN_SCENARIOS], description: "Sea state (default 'swell'): 'swell' (long smooth), 'chop' (short steep wind waves), 'storm' (big whitecaps)." },
        amplitude: { type: 'number', description: 'Wave-height multiplier (default 1; e.g. 0.5 calmer, 2 rougher).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0a1a2e" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createOceanViewHandler,
  });
}
