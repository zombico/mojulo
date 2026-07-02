/**
 * create_comet_view — mint a comet depictor: a comet on a real, highly eccentric Kepler orbit around
 * the Sun, growing a coma + an anti-solar ion tail + a curved dust tail that BLOOM near perihelion and
 * shrink to nothing near aphelion. The "how the trail is made" sibling of create_orbit_view: same
 * Kepler machinery + real-units readout, focused on the tail mechanism.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'comet-view'`, no geometry) and
 * regenerates the comet on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planCometScene, COMET_SCENARIOS } from '@/lib/graph/views/science/comet-view';

export function mintCometView({ title, scenario, scale, tails, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'comet-view',
    scenario: COMET_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.3, +scale) } : {}),
    ...(tails === false ? { tails: false } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCometScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — comet`,
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
    stats: { scenario: plan.stats.scenario, e: plan.stats.e, period: plan.stats.period, perihelionAU: plan.stats.perihelionAU },
  };
}

export async function createCometViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_comet_view requires a recipe object');
  }
  const { title, scenario, scale, tails, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCometView({ title, scenario, scale, tails, viewBox, scene, ref, folderRef });
}

export function registerCometViewTools() {
  registerTool({
    name: 'create_comet_view',
    description:
      "Mint an interactive COMET depictor — a comet on a real, highly eccentric Kepler orbit around the "
      + "Sun that grows a glowing coma + a straight anti-solar ION tail + a curved, lagging DUST tail. "
      + "The headline lesson, made vivid: the tails ALWAYS point AWAY FROM THE SUN (not backward along "
      + "the path — so on the outbound leg the tail LEADS the comet), and they BLOOM near perihelion and "
      + "shrink to nothing near aphelion. ACCURATE MOTION, ARTISTIC SCALE: the true eccentric ellipse "
      + "shape is kept (eccentricity is the whole point) and only scaled to fit one frame, while the "
      + "motion is physically exact — Kepler's 2nd law (the comet whips through perihelion, crawls at "
      + "aphelion, which is exactly when the tail blooms) — and the live readout shows REAL distance "
      + "(AU), REAL speed (vis-viva, km/s), and REAL period. Three scenarios by eccentricity: 'classic' "
      + "(e=0.90, the clean default), 'halley' (e=0.967, Halley-type, ~75 yr period), 'sungrazer' "
      + "(e=0.985, extreme bloom). Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` with TWO bookmarked cameras — 'path' (the whole orbit) and "
      + "'closeup' (the perihelion arc + Sun, where you watch the tail form and reorient) — drag to "
      + "ORBIT, scroll to zoom; CLICK the Sun for its role. You pass a tiny recipe (a scenario); the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'comet-view'`, no geometry) and "
      + "regenerates the comet on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the "
      + "worldUrl. Reach for this on framing like 'show me a comet / how a comet's tail is made / why "
      + "comet tails point away from the Sun / a comet swinging past the Sun'. (The general moving-orrery "
      + "of planets on Kepler orbits is create_orbit_view; this is the tail-growing comet.)",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...COMET_SCENARIOS], description: "Which comet to depict (default 'classic'): 'classic' (e=0.90), 'halley' (e=0.967), 'sungrazer' (e=0.985)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        tails: { type: 'boolean', description: 'Render the ion + dust tails (default true). false → bare nucleus + coma on the orbit.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05070f" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createCometViewHandler,
  });
}
