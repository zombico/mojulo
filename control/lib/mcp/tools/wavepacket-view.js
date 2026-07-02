/**
 * create_wavepacket_view — mint a QUANTUM WAVEPACKET: a volumetric `|ψ(x,t)|²` probability cloud that
 * EVOLVES IN TIME, ray-marched (the sibling of the static atom-view orbital cloud, but the field moves).
 * Volume + time — impossible as a surface, and the clearest way to SEE quantum behaviour.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * scenario + optional density); the substrate stores ONLY the recipe (`kind: 'wavepacket-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planWavepacketScene, WAVEPACKET_SCENARIOS } from '@/lib/graph/views/science/wavepacket-view';

export function mintWavepacketView({ title, scenario, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'wavepacket-view',
    scenario: WAVEPACKET_SCENARIOS.includes(scenario) ? scenario : 'free',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planWavepacketScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} wavepacket`,
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

export async function createWavepacketViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_wavepacket_view requires a recipe object');
  }
  const { title, scenario, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintWavepacketView({ title, scenario, density, viewBox, scene, ref, folderRef });
}

export function registerWavepacketViewTools() {
  registerTool({
    name: 'create_wavepacket_view',
    description:
      "Mint a QUANTUM WAVEPACKET — a volumetric `|ψ(x,t)|²` probability cloud that EVOLVES IN TIME, "
      + "ray-marched by a per-pixel VOLUME shader (the sibling of the static atom-view orbital cloud, but "
      + "now the field MOVES). Volume + time is impossible to depict as a mesh/surface, and is the clearest "
      + "way to SEE quantum behaviour. Opacity is the `|ψ|²` probability envelope; colour is the phase "
      + "(warm +Re ψ / cool −Re ψ, like the orbital view), so the internal carrier oscillation streaks "
      + "through the cloud. Three scenarios: 'free' (a Gaussian packet travelling and SPREADING — quantum "
      + "DISPERSION made visible), 'coherent' (a harmonic-oscillator coherent state, a non-spreading "
      + "Gaussian sloshing in a parabolic trap — 'the most classical quantum state'), and 'box' (a "
      + "particle-in-a-box two-state superposition whose density sloshes wall to wall, beating at "
      + "(E₂−E₁)/ħ — quantum beats). Drag to ORBIT the camera, scroll to zoom; the packet animates on its "
      + "own. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'wavepacket-view'`, no geometry) and "
      + "regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the "
      + "worldUrl. Reach for this on framing like 'show me a wavepacket / quantum tunnelling-style "
      + "spreading / a particle in a box / a coherent state / how a quantum particle moves'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...WAVEPACKET_SCENARIOS], description: "Which closed-form ψ(x,t) (default 'free'): 'free' (travelling, spreading Gaussian packet — dispersion), 'coherent' (non-spreading Gaussian sloshing in a harmonic trap), 'box' (particle-in-a-box two-state superposition — quantum beats)." },
        density: { type: 'number', description: 'Opacity/brightness of the |ψ|² cloud (1–30). Higher = denser, more opaque. Overrides the scenario default.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#04050d" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createWavepacketViewHandler,
  });
}
