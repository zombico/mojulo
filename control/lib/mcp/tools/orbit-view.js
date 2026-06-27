/**
 * create_orbit_view — mint an orbital-mechanics depictor: bodies moving on real Kepler orbits around
 * a central mass, in the traversable three.js World. The "space frame" sibling of create_mechanics_view
 * and the moving-system counterpart to create_planetary's single static body.
 *
 * Accurate motion, artistic scale (an orrery): distances + body sizes are COMPRESSED so everything
 * reads in one frame, while the MOTION stays exact — Kepler's 2nd law (perihelion speed-up) and 3rd
 * law (real period ratios), with the readout showing REAL distance / speed (vis-viva) / period.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'orbit-view'`, no geometry) and
 * regenerates the system on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planOrbitScene, ORBIT_SCENARIOS } from '@/lib/graph/orbit-view';

export function mintOrbitView({ title, scenario, scale, vectors, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'orbit-view',
    scenario: ORBIT_SCENARIOS.includes(scenario) ? scenario : 'system',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(vectors === false ? { vectors: false } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planOrbitScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — orbit`,
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
    stats: { scenario: plan.stats.scenario, bodies: plan.stats.bodies, faces: plan.faces.length },
  };
}

export async function createOrbitViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_orbit_view requires a recipe object');
  }
  const { title, scenario, scale, vectors, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintOrbitView({ title, scenario, scale, vectors, viewBox, scene, ref, folderRef });
}

export function registerOrbitViewTools() {
  registerTool({
    name: 'create_orbit_view',
    description:
      "Mint an interactive ORBITAL-MECHANICS depictor — an orrery where bodies actually MOVE on real "
      + "Kepler orbits around a central mass. Four scenarios: 'circular' (one body, uniform speed, "
      + "constant inward acceleration), 'ellipse' (one eccentric body — Kepler's 2nd law made vivid, a "
      + "big speed swing between perihelion and aphelion), 'system' (the inner solar system — Mercury / "
      + "Venus / Earth / Mars at true elements, Kepler's 3rd law: outer planets slower with longer "
      + "periods), and 'moon' (Earth + Moon). ACCURATE MOTION, ARTISTIC SCALE: distances and body sizes "
      + "are compressed so everything reads in one frame (true scale is invisible — the Moon would be a "
      + "pixel 60 Earth-radii away), but the MOTION is physically exact — the perihelion speed-up "
      + "(equal areas in equal time) and real period ratios — and the live readout shows REAL distance, "
      + "REAL orbital speed (vis-viva, km/s), and REAL period. Each orbit draws as a faint track; the "
      + "featured body carries velocity (green, tangent) + acceleration (orange, pointing at the central "
      + "mass) arrows. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag "
      + "to ORBIT, scroll to zoom); CLICK any body for its orbital elements. You pass a tiny recipe (a "
      + "scenario); the substrate stores ONLY the recipe (`manifest.kind === 'orbit-view'`, no geometry) "
      + "and regenerates the system on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the "
      + "worldUrl. Reach for this on framing like 'show me planetary orbits / the solar system moving / "
      + "Kepler's laws / a planet orbiting a star / the Moon's orbit'. (A SINGLE static space-accurate "
      + "body — Earth as a marble — is create_planetary; this is the moving multi-body orrery.)",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...ORBIT_SCENARIOS], description: "Which orbit primitive to depict (default 'system'): 'circular', 'ellipse', 'system' (inner solar system), 'moon' (Earth + Moon)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        vectors: { type: 'boolean', description: 'Show the velocity/acceleration arrows + numeric readout on the featured body (default true).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05070f" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createOrbitViewHandler,
  });
}
