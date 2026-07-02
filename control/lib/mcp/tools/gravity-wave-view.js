/**
 * create_gravity_wave_view — mint a SPACETIME MEMBRANE rippling under a compact-binary INSPIRAL in the
 * traversable three.js World: a grid mesh deformed every frame by the quadrupole GRAVITATIONAL-WAVE
 * STRAIN of two masses spiralling together — the chirp, merger and ringdown of an LIGO-style event.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * binary scenario); the substrate stores ONLY the recipe (`kind: 'gravity-wave-view'`, no geometry) and
 * regenerates the strain field on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planGravityWaveScene, GRAVITY_WAVE_SCENARIOS } from '@/lib/graph/views/science/gravity-wave-view';

export function mintGravityWaveView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'gravity-wave-view',
    scenario: GRAVITY_WAVE_SCENARIOS.includes(scenario) ? scenario : 'inspiral',
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planGravityWaveScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} gravitational waves`,
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
    stats: plan.stats.scenario === 'ring'
      ? { scenario: 'ring', strain: plan.stats.strain, period: plan.stats.period, masses: plan.stats.masses }
      : { scenario: plan.stats.scenario, chirpMassMsun: plan.stats.chirpMassMsun, cycles: plan.stats.cycles },
  };
}

export async function createGravityWaveViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_gravity_wave_view requires a recipe object');
  }
  const { title, scenario, amplitude, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintGravityWaveView({ title, scenario, amplitude, scale, viewBox, scene, ref, folderRef });
}

export function registerGravityWaveViewTools() {
  registerTool({
    name: 'create_gravity_wave_view',
    description:
      "Mint an interactive GRAVITATIONAL-WAVE inspiral — a live spacetime MEMBRANE that ripples as two "
      + "compact masses spiral together, rendered in the traversable three.js World. The Einsteinian "
      + "sibling of create_ocean_view: a grid mesh deformed every frame, but the height is the "
      + "quadrupole GW STRAIN, not a water wave. Honest leading-order physics: the binary loses energy "
      + "to gravitational radiation so the orbital frequency RISES toward merger (the 'chirp', f ∝ "
      + "(1−τ)^(−3/8)) and the separation shrinks; the radiated strain is a rotating two-armed "
      + "QUADRUPOLE that propagates outward at retarded time, so the membrane shows a two-armed SPIRAL "
      + "of ripples; amplitude grows as f^(2/3), peaks at MERGER, then RINGS DOWN as the remnant "
      + "settles. The two bodies ride the sheet and merge into a hot remnant; a readout shows the chirp "
      + "mass and the GW frequency sweeping up in Hz (inspiral → merger → ringdown). Five scenarios — "
      + "four binary MEMBRANES: 'inspiral' (two ~30 M☉ black holes, a long gentle chirp), 'merger' (a "
      + "GW150914-like 36+29 M☉ violent merger), 'neutron-stars' (1.4+1.35 M☉, long high-frequency "
      + "inspiral), 'extreme-mass-ratio' (a 10⁶ M☉ massive black hole + a small companion, the LISA "
      + "band); plus 'ring' — a ring of free TEST MASSES showing the wave's effect on MATTER (the "
      + "rotating quadrupole breathes the ring, each mass tracing a small circle — the textbook LIGO "
      + "picture). An `amplitude` knob scales the strain. Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom) — the top-down camera reveals the "
      + "spiral arms. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'gravity-wave-view'`, no geometry) and regenerates the strain field on "
      + "render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on "
      + "framing like 'gravitational waves / binary black hole inspiral / LIGO chirp / spacetime "
      + "ripples / two black holes merging / curvature of spacetime'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...GRAVITY_WAVE_SCENARIOS], description: "Binary (default 'inspiral'): 'inspiral' (two ~30 M☉ BHs), 'merger' (GW150914-like), 'neutron-stars' (1.4+1.35 M☉), 'extreme-mass-ratio' (massive BH + small companion)." },
        amplitude: { type: 'number', description: 'Strain-height multiplier (default 1; e.g. 0.5 subtler, 2 stronger).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05060f" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createGravityWaveViewHandler,
  });
}
