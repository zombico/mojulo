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
