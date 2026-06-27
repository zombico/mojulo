/**
 * create_cascade_view — mint a NUCLEAR CHAIN REACTION: a branching cascade of neutrons fissioning a
 * lattice of nuclei, each fission spawning fragments + fresh neutrons. The mesh-based companion to
 * create_fission_view (which ray-marches the single liquid-drop split) — discrete countable bodies on
 * trajectories, played back on a shared clock via the renderer's mover lifetimes.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'cascade-view'`, no geometry) and regenerates the deterministic
 * (seeded) cascade on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planCascadeScene, CASCADE_REGIME_NAMES } from '@/lib/graph/cascade-view';

export function mintCascadeView({ title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'cascade-view',
    regime: CASCADE_REGIME_NAMES.includes(regime) ? regime : 'supercritical',
    ...(Number.isFinite(+nuclei) ? { nuclei: +nuclei } : {}),
    ...(Number.isFinite(+nu) ? { nu: +nu } : {}),
    ...(Number.isFinite(+seed) ? { seed: +seed } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCascadeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.regime} chain reaction`,
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
    stats: plan.stats,
  };
}

export async function createCascadeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_cascade_view requires a recipe object');
  }
  const { title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCascadeView({ title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folderRef });
}

export function registerCascadeViewTools() {
  registerTool({
    name: 'create_cascade_view',
    description:
      "Mint a NUCLEAR CHAIN REACTION — a branching CASCADE of neutrons fissioning a lattice of fissile "
      + "nuclei, rendered as discrete moving bodies (the mesh-based companion to create_fission_view, which "
      + "ray-marches the SINGLE liquid-drop split). A seed neutron strikes a nucleus; that nucleus fissions "
      + "— a flash, two recoiling fragments, and ν≈2.4 fresh neutrons — and each new neutron flies off to "
      + "strike another nucleus, branching generation by generation. The headline is the REGIME: "
      + "'supercritical' (k>1) explodes and consumes the assembly, 'critical' (k≈1) barely sustains, "
      + "'subcritical' (k<1) fizzles out — driven by capture probability (geometry/enrichment) and ν, and "
      + "read live as the neutron population in the HUD (watch it grow or die). The whole branching tree is "
      + "DETERMINISTIC (seeded) — same recipe regenerates the identical cascade. Drag to ORBIT the camera, "
      + "scroll to zoom; the cascade loops on its own. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'cascade-view'`, no geometry) and regenerates it on render. ORBIT-ONLY object "
      + "study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a chain "
      + "reaction / how a nuclear reactor/bomb chain reaction works / critical mass / supercritical vs "
      + "subcritical'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        regime: { type: 'string', enum: [...CASCADE_REGIME_NAMES], description: "Criticality regime (default 'supercritical'): 'supercritical' (k>1, runaway), 'critical' (k≈1, self-sustaining), 'subcritical' (k<1, dies out). Sets capture probability + ν + assembly size." },
        nuclei: { type: 'number', description: 'Number of fissile nuclei in the assembly (12–80). Overrides the regime default. More nuclei = a denser assembly that sustains more readily.' },
        nu: { type: 'number', description: 'Mean neutrons released per fission ν (1–4, default ~2.4). Higher ν drives the reaction harder.' },
        seed: { type: 'number', description: 'PRNG seed — same seed reproduces the identical cascade (default 8). Try other seeds for different lattices; critical (k≈1) varies most run-to-run.' },
        scale: { type: 'number', description: 'Overall size multiplier (0.2–3, default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#07080d" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createCascadeViewHandler,
  });
}
