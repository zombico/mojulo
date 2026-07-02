/**
 * create_black_hole_view — mint a Schwarzschild black hole rendered with a per-pixel GENERAL-
 * RELATIVITY raymarcher: gravitational lensing of an accretion disk (the Interstellar / EHT look),
 * the photon ring, the event-horizon shadow, and relativistic Doppler beaming.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination); the substrate stores ONLY the recipe (`kind: 'black-hole-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planBlackHoleScene, BLACK_HOLE_SCENARIOS } from '@/lib/graph/views/science/black-hole-view';

export function mintBlackHoleView({ title, scenario, inclination, diskOuter, beta, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'black-hole-view',
    scenario: BLACK_HOLE_SCENARIOS.includes(scenario) ? scenario : 'interstellar',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+diskOuter) ? { diskOut: +diskOuter } : {}),
    ...(Number.isFinite(+beta) ? { beta: +beta } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planBlackHoleScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} black hole`,
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
    stats: { scenario: plan.stats.scenario, inclination: plan.stats.inclination },
  };
}

export async function createBlackHoleViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_black_hole_view requires a recipe object');
  }
  const { title, scenario, inclination, disk_outer: diskOuter, beta, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintBlackHoleView({ title, scenario, inclination, diskOuter, beta, scale, viewBox, scene, ref, folderRef });
}

export function registerBlackHoleViewTools() {
  registerTool({
    name: 'create_black_hole_view',
    description:
      "Mint a SCHWARZSCHILD BLACK HOLE rendered with CONTEMPORARY physics — a per-pixel GENERAL-"
      + "RELATIVITY raymarcher that bends light along real photon geodesics (the mesh renderer can't do "
      + "this; the shader can). You get gravitational LENSING of the accretion disk — the disk's far side "
      + "arcs up and over / down and under the dark shadow (the Interstellar / Event-Horizon-Telescope "
      + "look) — plus the photon ring, the event-horizon SHADOW, and RELATIVISTIC DOPPLER BEAMING (the "
      + "side of the disk orbiting toward you is brighter and bluer) COMBINED with GRAVITATIONAL REDSHIFT "
      + "(light climbing out of the gravity well dims and reddens, strongest at the inner edge). The disk "
      + "is SEMI-TRANSPARENT so its lensed images glow through each other, and a lensed Milky-Way background "
      + "visibly warps around the shadow. Drag to ORBIT the camera around the "
      + "hole, scroll to zoom. Two looks: 'interstellar' (near edge-on → the dramatic over/under lensed "
      + "arcs) and 'eht' (fairly face-on → the photon-ring shadow, like the M87*/Sgr A* images); an "
      + "`inclination` knob (degrees above the disk) tunes the viewing angle, `disk_outer` the disk size, "
      + "`beta` the orbital speed (Doppler asymmetry). Served as a live three.js "
      + "World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the "
      + "recipe (`manifest.kind === 'black-hole-view'`, no geometry) and regenerates the shader on "
      + "render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on "
      + "framing like 'show me a black hole / gravitational lensing / the Interstellar black hole / the "
      + "EHT image / an accretion disk / event horizon'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...BLACK_HOLE_SCENARIOS], description: "The look (default 'interstellar'): 'interstellar' (near edge-on, the over/under lensed arcs), 'eht' (fairly face-on, the photon-ring shadow)." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees above the disk plane (1–89). Low = edge-on (dramatic arcs); high = face-on (ring/shadow). Overrides the scenario default.' },
        disk_outer: { type: 'number', description: 'Outer radius of the accretion disk in Rs units (5–20; default ~8–12 by scenario). Larger = a broader disk.' },
        beta: { type: 'number', description: 'Inner-edge orbital speed as a fraction of c (0.1–0.85; default ~0.46–0.5). Higher = stronger Doppler beaming asymmetry.' },
        scale: { type: 'number', description: 'Reserved (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#01010a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createBlackHoleViewHandler,
  });
}
