/**
 * create_galaxy_view — mint an artistic-but-structurally-honest MILKY WAY spiral galaxy rendered by a
 * per-pixel VOLUME raymarcher: a full-screen fragment shader that integrates EMISSION and ABSORPTION
 * through a 3-D stellar-density field along each view ray (the mesh renderer can only scatter points;
 * the shader gives real luminous participating media — dust-lane extinction, glow haze, depth).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination + exposure); the substrate stores ONLY the recipe (`kind: 'galaxy-view'`,
 * no geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planGalaxyScene, GALAXY_SCENARIOS } from '@/lib/graph/galaxy-view';

export function mintGalaxyView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'galaxy-view',
    scenario: GALAXY_SCENARIOS.includes(scenario) ? scenario : 'oblique',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planGalaxyScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} galaxy`,
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
    stats: { scenario: plan.stats.scenario, inclination: plan.stats.inclination, exposure: plan.stats.exposure },
  };
}

export async function createGalaxyViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_galaxy_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintGalaxyView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}

export function registerGalaxyViewTools() {
  registerTool({
    name: 'create_galaxy_view',
    description:
      "Mint an artistic-but-structurally-honest MILKY WAY spiral galaxy rendered by a per-pixel VOLUME "
      + "raymarcher — a full-screen fragment shader that integrates EMISSION and ABSORPTION through a 3-D "
      + "stellar-density field along each view ray (the mesh renderer can only scatter discrete points; "
      + "this gives real luminous participating media). You get the structurally-honest Milky Way: a "
      + "central BAR + bulge, LOGARITHMIC spiral arms (pitch ≈ 12°, 2 major + a harmonic), an exponential "
      + "disk, flocculent fbm texture, and — the part meshes can't do — real DUST LANES via wavelength-"
      + "dependent extinction (dust in front genuinely occludes and REDDENS the light behind it). Colour "
      + "comes from stellar POPULATION (old-yellow bulge, young-blue arms, pink Hα knots), not from "
      + "brightness, and a single ACES filmic tone-map keeps the void black and rolls off the core (no "
      + "additive-bloom 'brightness vomit'). Drag to ORBIT the camera around the galaxy, scroll to zoom. "
      + "Three looks: 'oblique' (the flattering 3/4 'Andromeda' view, default), 'face-on' (the full "
      + "pinwheel), and 'edge-on' (the thin disk + dust-lane silhouette); an `inclination` knob (0 = "
      + "face-on, 90 = edge-on) and an `exposure` knob tune it further. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'galaxy-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY "
      + "object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me "
      + "a galaxy / the Milky Way / a spiral galaxy / a barred spiral'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...GALAXY_SCENARIOS], description: "The look (default 'oblique'): 'oblique' (3/4 Andromeda view), 'face-on' (full pinwheel), 'edge-on' (thin disk + dust-lane silhouette)." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees (0–90). 0 = face-on (pinwheel); 90 = edge-on (the Milky Way band). Overrides the scenario default.' },
        exposure: { type: 'number', description: 'Global exposure applied once before tone-map (0.4–4). Higher = brighter. Overrides the scenario default.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#00030a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createGalaxyViewHandler,
  });
}
