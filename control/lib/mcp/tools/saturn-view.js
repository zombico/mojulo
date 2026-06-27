up/**
 * create_saturn_view — mint Saturn and its rings, rendered by a per-pixel ray-tracing fragment shader
 * (the same raymarch-mode path as the black hole). The shader does what meshes can't cleanly: the
 * rings cast a shadow on the planet, the planet casts its shadow across the rings, the rings are
 * semi-transparent, and backlit they glow by forward-scattered light.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * look + viewing inclination); the substrate stores ONLY the recipe (`kind: 'saturn-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planSaturnScene, SATURN_SCENARIOS, SATURN_PLANETS } from '@/lib/graph/saturn-view';

export function mintSaturnView({ title, planet, gallery, scenario, inclination, ringOuter, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'saturn-view',
    ...(gallery === true ? { gallery: true } : {}),
    ...(SATURN_PLANETS.includes(planet) ? { planet } : {}),
    scenario: SATURN_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+inclination) ? { inclination: +inclination } : {}),
    ...(Number.isFinite(+ringOuter) ? { ringOut: +ringOuter } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planSaturnScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `Saturn (${manifest.scenario})`,
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
    stats: plan.stats.gallery
      ? { gallery: true, planets: plan.stats.planets }
      : { planet: plan.stats.planet, scenario: plan.stats.scenario, inclination: plan.stats.inclination, backlit: plan.stats.backlit },
  };
}

export async function createSaturnViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_saturn_view requires a recipe object');
  }
  const { title, planet, gallery, scenario, inclination, ring_outer: ringOuter, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintSaturnView({ title, planet, gallery, scenario, inclination, ringOuter, scale, viewBox, scene, ref, folderRef });
}

export function registerSaturnViewTools() {
  registerTool({
    name: 'create_saturn_view',
    description:
      "Mint a PLANET of the solar system — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus or "
      + "Neptune — OR a GALLERY stepper through all eight, rendered by a per-pixel ray-tracing fragment "
      + "shader (the same shader path as the black hole). The shader does what a mesh renderer can't do "
      + "cleanly: for ringed planets the RINGS CAST A SHADOW on the globe, the PLANET CASTS ITS SHADOW "
      + "across the rings, the rings are SEMI-TRANSPARENT, and backlit they GLOW by forward-scattered "
      + "light. Each planet has its true character: rocky cratered worlds (Mercury, Mars with polar ice "
      + "caps), thick cloud decks (Venus), blue oceans + continents + clouds (Earth), banded gas giants "
      + "with storms (Jupiter's Great Red Spot, Neptune's Great Dark Spot) and rings (Saturn's bright "
      + "C/B/Cassini/A system, Neptune's Adams ring ARCS, Uranus TIPPED ON ITS SIDE with vertical rings). "
      + "Pass `gallery:true` for a one-planet-per-step GALLERY — a ◀ ▶ stepper (also arrow keys) flips "
      + "through all eight in one World. Or pass a single `planet`. Drag to ORBIT, scroll to zoom. Three "
      + "lighting looks (`scenario`): 'classic' (sunlit), 'backlit' (in the planet's shadow — glowing "
      + "rings + bright limb), 'polar' (high angle); an `inclination` knob tunes the viewing angle. Served "
      + "as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate "
      + "stores ONLY the recipe (`manifest.kind === 'saturn-view'`, no geometry) and regenerates the "
      + "shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for "
      + "this on framing like 'show me Saturn / the planets / a solar system gallery / Jupiter's Great Red "
      + "Spot / Earth / Mars / Uranus on its side'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        gallery: { type: 'boolean', description: 'If true, render a GALLERY stepper through all eight planets (◀ ▶ buttons + arrow keys), one per step. Ignores `planet`.' },
        planet: { type: 'string', enum: [...SATURN_PLANETS], description: "Which planet (default 'saturn'): mercury / venus / earth / mars (rocky & cloud & ocean worlds), jupiter (Great Red Spot), saturn (the bright rings), uranus (tipped on its side), neptune (methane blue, ring arcs)." },
        scenario: { type: 'string', enum: [...SATURN_SCENARIOS], description: "The lighting look (default 'classic'): 'classic' (sunlit, open rings, ring shadow on the globe), 'backlit' (in the planet's shadow — glowing translucent rings), 'polar' (high-angle, the full ring system)." },
        inclination: { type: 'number', description: 'Viewing inclination in degrees above the ring plane (2–88). Low = edge-on (rings nearly a line); high = face-on (rings wide open). Overrides the scenario default.' },
        ring_outer: { type: 'number', description: 'Outer ring radius in planet-radius units (1.6–3.0; default 2.27 ≈ the real A-ring edge).' },
        scale: { type: 'number', description: 'Reserved (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#01010a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createSaturnViewHandler,
  });
}
