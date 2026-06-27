/**
 * create_double_slit_view — mint the double-slit experiment as a RIPPLE TANK in the traversable
 * three.js World: an incoming wave hits a barrier with two slits, each slit re-emits a circular wave,
 * and their overlap forms the interference fringes, projected on a screen.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * scenario + slit separation); the substrate stores ONLY the recipe (`kind: 'double-slit-view'`, no
 * geometry) and regenerates the wavefield on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planDoubleSlitScene, DOUBLE_SLIT_SCENARIOS } from '@/lib/graph/double-slit-view';

export function mintDoubleSlitView({ title, scenario, separation, slitWidth, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'double-slit-view',
    scenario: DOUBLE_SLIT_SCENARIOS.includes(scenario) ? scenario : 'double',
    ...(Number.isFinite(+separation) ? { separation: +separation } : {}),
    ...(Number.isFinite(+slitWidth) ? { slitWidth: +slitWidth } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planDoubleSlitScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} double-slit`,
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
    stats: { scenario: plan.stats.scenario, separation: plan.stats.separation },
  };
}

export async function createDoubleSlitViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_double_slit_view requires a recipe object');
  }
  const { title, scenario, separation, slit_width: slitWidth, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintDoubleSlitView({ title, scenario, separation, slitWidth, scale, viewBox, scene, ref, folderRef });
}

export function registerDoubleSlitViewTools() {
  registerTool({
    name: 'create_double_slit_view',
    description:
      "Mint the DOUBLE-SLIT EXPERIMENT as a live RIPPLE TANK in the traversable three.js World. An "
      + "incoming wave hits a barrier with two slits; each slit re-emits a CIRCULAR wave, and their "
      + "overlap IS the interference pattern — the bright/dark fan — with the fringes projected on a "
      + "screen (bright where the waves add, dark where they cancel; fringe spacing Δ = λL/d). Three "
      + "scenarios: 'double' (two slits → interference fringes), 'single' (one slit → smooth diffraction, "
      + "NO two-source fringes — the contrast), and 'particles' (the quantum punchline: individual "
      + "particles each land at ONE spot, yet collectively build the fringe pattern — dots distributed "
      + "by |ψ|², the interference probability). The `separation` knob sets the slit spacing d (wider d → "
      + "finer fringes). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` "
      + "(drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'double-slit-view'`, no geometry) and regenerates the wavefield on render. "
      + "ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing "
      + "like 'double-slit experiment / wave interference / quantum interference / how light/electrons "
      + "interfere / diffraction fringes'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...DOUBLE_SLIT_SCENARIOS], description: "Which to depict (default 'double'): 'double' (two slits, interference), 'single' (one slit, diffraction only), 'particles' (quantum buildup of the fringes from individual hits)." },
        separation: { type: 'number', description: 'Slit separation d (default 14; wider d → finer fringe spacing λL/d).' },
        slit_width: { type: 'number', description: 'Slit width a (default 8). Sets the single-slit diffraction envelope (∝ λ/a) the fringes fade under; narrower → broader envelope.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#060912" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createDoubleSlitViewHandler,
  });
}
