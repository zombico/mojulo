/**
 * create_atmosphere_view — mint ATMOSPHERIC SCATTERING (why the sky is blue and sunsets are red),
 * derived the textbook-correct way: a single-scattering VOLUME integral of sunlight along the view ray,
 * ray-marched. Light-transport, not a colour gradient — the blue zenith, the reddened terminator, the
 * forward sun-halo, and the backlit limb glow all fall out of Rayleigh (λ⁻⁴) + Mie scattering.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * lighting scenario + optional brightness); the substrate stores ONLY the recipe (`kind:
 * 'atmosphere-view'`, no geometry) and regenerates the shader on render. Orbit-only object study —
 * returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planAtmosphereScene, ATMOSPHERE_SCENARIOS } from '@/lib/graph/atmosphere-view';

export function mintAtmosphereView({ title, scenario, brightness, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'atmosphere-view',
    scenario: ATMOSPHERE_SCENARIOS.includes(scenario) ? scenario : 'day',
    ...(Number.isFinite(+brightness) ? { brightness: +brightness } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planAtmosphereScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} atmosphere`,
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
    stats: { scenario: plan.stats.scenario, brightness: plan.stats.sunI, render: plan.stats.render },
  };
}

export async function createAtmosphereViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_atmosphere_view requires a recipe object');
  }
  const { title, scenario, brightness, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintAtmosphereView({ title, scenario, brightness, viewBox, scene, ref, folderRef });
}

export function registerAtmosphereViewTools() {
  registerTool({
    name: 'create_atmosphere_view',
    description:
      "Mint ATMOSPHERIC SCATTERING — the textbook-correct reason the SKY IS BLUE and SUNSETS ARE RED — "
      + "as a per-pixel VOLUME raymarcher that integrates sunlight scattering along each view ray (this is "
      + "the honest physics, NOT a colour gradient or a painted sky). You orbit a planet lit by the sun; "
      + "Rayleigh scattering ∝ λ⁻⁴ makes blue scatter ~5× more than red (→ the blue day disk), the long "
      + "slant path at the terminator scatters the blue OUT leaving red (→ sunset reddening), forward Mie "
      + "scattering puts a white halo around the sun, and the backlit night side shows the thin blue limb "
      + "glow seen from orbit. Three lighting looks: 'day' (sun behind the camera → the full blue marble), "
      + "'sunset' (sun to the side → the day/night terminator with a reddened limb), and 'limb' (sun behind "
      + "the planet → the backlit airglow ring, 'sunrise from the ISS'). A `brightness` knob tunes the sun "
      + "intensity. Drag to ORBIT, scroll to zoom. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'atmosphere-view'`, no geometry) and regenerates the shader on render. "
      + "ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing "
      + "like 'why is the sky blue / show me atmospheric scattering / a sunset / the blue marble / Earth "
      + "from space / the atmosphere limb'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...ATMOSPHERE_SCENARIOS], description: "The lighting look (default 'day'): 'day' (full lit blue marble), 'sunset' (the day/night terminator, reddened limb), 'limb' (backlit night-side airglow ring)." },
        brightness: { type: 'number', description: 'Sun intensity (4–60). Higher = brighter, more saturated scattering. Overrides the scenario default.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#01030a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createAtmosphereViewHandler,
  });
}
