/**
 * create_field_view — mint an electromagnetism depictor: a travelling electromagnetic wave, or
 * magnetic field structure (bar magnet / current-carrying wire / solenoid), in the traversable
 * three.js World.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'field-view'`, no geometry) and
 * regenerates the field on render. The field rides emitThreeWorld's field channel (a lattice of
 * vector arrows + field-line curves). Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFieldScene, FIELD_SCENARIOS } from '@/lib/graph/field-view';

export function mintFieldView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'field-view',
    scenario: FIELD_SCENARIOS.includes(scenario) ? scenario : 'em-wave',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFieldScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — field`,
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
    stats: { scenario: plan.stats.scenario, animate: plan.stats.animate, faces: plan.faces.length },
  };
}

export async function createFieldViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_field_view requires a recipe object');
  }
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFieldView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}

export function registerFieldViewTools() {
  registerTool({
    name: 'create_field_view',
    description:
      "Mint an interactive ELECTROMAGNETISM depictor — electromagnetic wave activity and magnetic "
      + "fields, where the field actually MOVES / is shown as a lattice of vectors. Four scenarios: "
      + "'em-wave' (a travelling plane wave — E in red ⊥ B in blue, oscillating IN PHASE as sin(kx − ωt) "
      + "and propagating, with the two sine envelope curves sweeping along), 'bar-magnet' (a dipole — "
      + "N/S body, field lines N→S, and an iron-filings lattice of needles oriented along B), 'wire' (a "
      + "straight current — concentric circular B loops by the right-hand rule, tangent needles, B ∝ "
      + "1/r), and 'solenoid' (a coil — near-uniform field along the bore + dipole return, copper "
      + "windings). Accurate structure, artistic scale: the relationships are honest (E⊥B in phase, "
      + "E/B = c; the dipole line shape; B ∝ 1/r), only the scale is compressed to read in one frame, "
      + "with a real-units readout (λ, f, c = λf). Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK a body (poles, wire, coil) "
      + "for its facts. You pass a tiny recipe (a scenario); the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'field-view'`, no geometry) and regenerates the field on render. ORBIT-ONLY "
      + "object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show "
      + "me an electromagnetic wave / visualize a magnetic field / iron filings round a magnet / the "
      + "field around a wire / how a solenoid works / E and B fields'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...FIELD_SCENARIOS], description: "Which to depict (default 'em-wave'): 'em-wave' (travelling E⊥B wave), 'bar-magnet' (dipole + iron filings), 'wire' (current → circular B), 'solenoid' (coil)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05070f" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFieldViewHandler,
  });
}
