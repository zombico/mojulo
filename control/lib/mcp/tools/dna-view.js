/**
 * create_dna_view — mint an interactive DNA DOUBLE HELIX in a traversable World.
 *
 * Same recipe-only philosophy as create_molecule_view: the operator passes a tiny
 * RECIPE (a base sequence, or a base-pair count, plus a few knobs); the substrate
 * stores ONLY that recipe as a sketch manifest (`kind: 'dna-view'`) — no geometry.
 * The helix is regenerated on demand from a single TAIJI primitive (lowered to lit
 * solids) and served as a live three.js World at `/api/sketches/<ref>/world`, where
 * each base pair / backbone is CLICKABLE → a metadata popup.
 *
 * Orbit-only object study (like molecule-view) — no CSS-3D `/scene` form — so this
 * returns a `worldUrl`. The /world route still exposes ?walk=1 for a first-person
 * pass through the helix.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planDnaScene } from '@/lib/graph/views/bio/dna-view';

const LODS = ['draft', 'default', 'hero'];
const HANDS = ['right', 'left'];

export function mintDnaView({ title, sequence, basePairs, bpPerTurn, radius, rise, handedness, profile, palette, lod, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'dna-view',
    ...(typeof sequence === 'string' && sequence.trim() ? { sequence: sequence.trim() } : {}),
    ...(Number.isFinite(+basePairs) ? { basePairs: Math.round(+basePairs) } : {}),
    ...(Number.isFinite(+bpPerTurn) ? { bpPerTurn: +bpPerTurn } : {}),
    ...(Number.isFinite(+radius) ? { radius: +radius } : {}),
    ...(Number.isFinite(+rise) ? { rise: +rise } : {}),
    ...(HANDS.includes(handedness) ? { handedness } : {}),
    ...(profile === 'spindle' || profile === 'capsule' ? { profile } : {}),
    ...(palette && typeof palette === 'object' ? { palette } : {}),
    ...(LODS.includes(lod) ? { lod } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate + return a count readout (no geometry persisted). Throws on a bad
  // recipe (e.g. < 2 base pairs) → surfaced to the caller.
  const plan = planDnaScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `DNA · ${plan.basePairs} bp`,
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
    stats: { basePairs: plan.basePairs, turns: +plan.turns.toFixed(2), handedness: plan.handedness, faces: plan.faces.length, picks: plan.picks.length },
  };
}

export async function createDnaViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_dna_view requires a recipe object');
  }
  const { title, sequence, basePairs, base_pairs, bpPerTurn, bp_per_turn, radius, rise, handedness, profile, palette, lod, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintDnaView({
    title,
    sequence,
    basePairs: basePairs ?? base_pairs,
    bpPerTurn: bpPerTurn ?? bp_per_turn,
    radius,
    rise,
    handedness,
    profile,
    palette,
    lod,
    viewBox,
    scene,
    ref,
    folderRef,
  });
}

export function registerDnaViewTools() {
  registerTool({
    name: 'create_dna_view',
    description:
      "Mint an interactive 3D DNA DOUBLE HELIX — a science/education viewer built from a single chiral "
      + "TAIJI primitive lowered to lit solids. Two sugar-phosphate BACKBONES (beaded teal/gold tubes) wind "
      + "around a shared axis; corresponding strand points are joined by base-pair RUNG rods. Served as a "
      + "live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom; "
      + "append ?walk=1 to walk through it): CLICK any base pair or backbone to raise a metadata popup. You "
      + "pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'dna-view'`, no geometry) "
      + "and regenerates the helix on render. TWO WAYS TO AUTHOR: (1) by SEQUENCE — pass `sequence` as a string "
      + "of A/T/G/C (e.g. 'GATTACA'); the base-pair count comes from its length and each rung is split-coloured "
      + "by base (Watson-Crick complement on the far strand). (2) by COUNT — pass `base_pairs` for a uniform helix "
      + "with no per-base colour. CHIRALITY IS REAL: `handedness:'right'` (default, B-DNA) is a positive twist; "
      + "'left' (Z-DNA) is negative. Geometry knobs: `bp_per_turn` (default 10.5, B-DNA), `radius`, `rise` "
      + "(axial rise per base pair), `profile` ('capsule' uniform width, default; 'spindle' tapers to the poles). "
      + "ORBIT-ONLY: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show DNA in 3D / "
      + "visualize this gene sequence / a double helix for the science view'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        sequence: { type: 'string', description: "Author by SEQUENCE: a string of bases A/T/G/C (case-insensitive; other characters render as a neutral 'unknown' base). Length sets the base-pair count; each rung is split-coloured by base with its complement on the far strand." },
        base_pairs: { type: 'integer', minimum: 2, maximum: 240, description: 'Author by COUNT: number of base pairs for a uniform helix (default 22). Ignored when `sequence` is given.' },
        bp_per_turn: { type: 'number', minimum: 2, maximum: 40, description: 'Base pairs per full helical turn (default 10.5 for B-DNA). Lower = more tightly wound.' },
        radius: { type: 'number', minimum: 0.1, maximum: 20, description: 'Helix radius in model units (default 1.0).' },
        rise: { type: 'number', minimum: 0.02, maximum: 5, description: 'Axial rise per base pair in model units (default 0.34).' },
        handedness: { type: 'string', enum: [...HANDS], description: "Helix handedness: 'right' (default, B/A-DNA) or 'left' (Z-DNA). Sets the sign of the taiji twist." },
        profile: { type: 'string', enum: ['capsule', 'spindle'], description: "Axial envelope: 'capsule' (uniform width, default) or 'spindle' (tapers to teardrop tips at the ends)." },
        palette: { type: 'object', description: 'Optional colour overrides as #rrggbb: { yin, yang } for the two backbones, { rung } for uncoloured rungs, and { A, T, G, C } for base colours.' },
        lod: { type: 'string', enum: [...LODS], description: "Tube/bead tessellation density: 'draft' / 'default' / 'hero' (default 'default')." },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      // no top-level required: supply `sequence` OR `base_pairs` (defaults to 22 if neither given).
    },
    handler: createDnaViewHandler,
  });
}
