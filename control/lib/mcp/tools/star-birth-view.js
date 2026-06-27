/**
 * create_star_birth_view — mint a single-star birth scene: a dusty molecular cloud collapsing around a
 * protostar, with accretion disk and bipolar outflows, ray-marched as luminous participating media.
 *
 * Same fractal-generation philosophy as galaxy-view: the operator passes a tiny RECIPE; the substrate
 * stores ONLY the recipe (`kind: 'star-birth-view'`, no geometry) and regenerates the shader on render.
 * Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planStarBirthScene, STAR_BIRTH_SCENARIOS } from '@/lib/graph/star-birth-view';

export function mintStarBirthView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'star-birth-view',
    scenario: STAR_BIRTH_SCENARIOS.includes(scenario) ? scenario : 'protostar',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+exposure) ? { exposure: +exposure } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planStarBirthScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} star birth`,
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
    stats: {
      scenario: plan.stats.scenario,
      inclination: plan.stats.inclination,
      exposure: plan.stats.exposure,
      render: plan.stats.render,
    },
  };
}

export async function createStarBirthViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_star_birth_view requires a recipe object');
  }
  const { title, scenario, inclination, exposure, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintStarBirthView({ title, scenario, inclination, exposure, viewBox, scene, ref, folderRef });
}

export function registerStarBirthViewTools() {
  registerTool({
    name: 'create_star_birth_view',
    description:
      "Mint the BIRTH OF A SINGLE STAR — a dusty molecular cloud collapsing into one embedded protostar, "
      + "with an accretion disk and bipolar outflow cavities, rendered by the same per-pixel VOLUME "
      + "raymarcher that powers galaxy-view. This is the right tool when the prompt is about a stellar "
      + "nursery / protostar / star forming out of gas and dust: the medium is luminous participating "
      + "matter, so the shader integrates emission and absorption through the cloud instead of drawing a "
      + "mesh or point sprite. You get a reddened dust envelope, a hot hidden core, an orange accretion "
      + "disk, blue scattering jets, and H-alpha-like knots. Three looks: 'collapse' (mostly cold cloud, "
      + "small core), 'protostar' (default: disk + embedded core), and 'outflow' (strong bipolar cavities). "
      + "Use `inclination` (0 = pole-on, 90 = edge-on disk) and `exposure` (0.4-4) to tune the view. Served "
      + "as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe "
      + "(`manifest.kind === 'star-birth-view'`, no geometry) and regenerates the shader on render. "
      + "ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...STAR_BIRTH_SCENARIOS], description: "The look (default 'protostar'): 'collapse', 'protostar', or 'outflow'." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees (0-88). 0 = pole-on; 90 = edge-on disk/outflow silhouette.' },
        exposure: { type: 'number', description: 'Global exposure applied once before tone-map (0.4-4). Higher = brighter.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120x780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#01020a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createStarBirthViewHandler,
  });
}
