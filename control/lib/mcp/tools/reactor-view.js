/**
 * create_reactor_view — mint a CONTROLLED chain reaction: the cascade-view branching reaction plus
 * CONTROL RODS that absorb neutrons, telling the reactor-vs-bomb story (the heart of nuclear ENERGY).
 * A supercritical core that would run away is shut down by dropping in the rods (a SCRAM).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'reactor-view'`, no geometry) and regenerates the deterministic
 * (seeded) run on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planReactorScene, REACTOR_SCENARIO_NAMES } from '@/lib/graph/views/science/reactor-view';

export function mintReactorView({ title, scenario, rods, seed, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'reactor-view',
    scenario: REACTOR_SCENARIO_NAMES.includes(scenario) ? scenario : 'scram',
    ...(Number.isFinite(+rods) ? { rods: +rods } : {}),
    ...(Number.isFinite(+seed) ? { seed: +seed } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planReactorScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `reactor ${manifest.scenario}`,
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

export async function createReactorViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_reactor_view requires a recipe object');
  }
  const { title, scenario, rods, seed, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintReactorView({ title, scenario, rods, seed, scale, viewBox, scene, ref, folderRef });
}

export function registerReactorViewTools() {
  registerTool({
    name: 'create_reactor_view',
    description:
      "Mint a CONTROLLED nuclear chain reaction — the branching cascade plus CONTROL RODS that absorb "
      + "neutrons, telling the reactor-vs-bomb story (the heart of nuclear ENERGY): a supercritical core "
      + "that WOULD run away is held in check by inserting neutron-absorbing rods. Two scenarios: 'scram' "
      + "(the core ignites and the neutron population climbs, then the rods DROP IN and absorb the "
      + "neutrons — the chain collapses and most of the fuel is left unspent) and 'runaway' (the rods stay "
      + "withdrawn and the chain consumes the whole assembly — what the rods are there to prevent). The "
      + "live HUD reads the neutron population — watch it crash the instant the rods drop. Deterministic "
      + "(seeded) — same recipe regenerates the identical run. The mesh companion to create_cascade_view "
      + "(the uncontrolled chain) and create_fission_view (the single split). Drag to ORBIT the camera, "
      + "scroll to zoom; it loops on its own. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === "
      + "'reactor-view'`, no geometry) and regenerates it on render. ORBIT-ONLY object study: no CSS-3D "
      + "`/scene` form; open the worldUrl. Reach for this on framing like 'show me how a nuclear reactor "
      + "works / control rods / a reactor SCRAM / how a chain reaction is controlled'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...REACTOR_SCENARIO_NAMES], description: "Which run (default 'scram'): 'scram' (rods drop in and shut the reaction down) or 'runaway' (rods stay out and the chain consumes the assembly — the contrast)." },
        rods: { type: 'number', description: 'Number of control rods (1–5, default 5). Fewer rods absorb less — a partial SCRAM.' },
        seed: { type: 'number', description: 'PRNG seed — same seed reproduces the identical run (default 3).' },
        scale: { type: 'number', description: 'Overall size multiplier (0.2–3, default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#07080d" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createReactorViewHandler,
  });
}
