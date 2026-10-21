/**
 * THE REALISTIC BODY for plating (`form: 'realistic'`): its trunk (torso, pelvis) and limbs re-sampled onto the form field,
 * each part's stations `u` from its top to its bottom (the torso 0 the waist … 4 the collar; the pelvis 0 the crotch … 6
 * its hem; the thigh 0 … 4; the upper arm, the forearm, the shank 0 … 2). The undersuit is a field garment
 * (body-relational-garment.js): close over every ring of the trunk and the limbs.
 *
 *   realisticBody(recipe, R, build, map) → the adapter (../expand.js)
 *   plating(recipe, R, build, map, spec, { id, group }) → wearPlating on it
 *
 * Pure and deterministic.
 */
import { fieldGarment } from '../../polygonizer/body-relational-garment.js';
import { wearPlating } from '../expand.js';

/** each segment's `u` at its far end */
const U_MAX = { torso: 4, pelvis: 6, upperArm: 2, foreArm: 2, thigh: 4, shank: 2 };
/** the suit's cloth: close, over the forms, spanning the grooves a little */
const SUIT = { looser: 1.5, reach: 0.02, taut: false, span: 0.02, along: 2, soft: true };

export function realisticBody(recipe, R, build, map) {
  return {
    sides: ['R', 'L'],
    part: (name) => recipe.parts[name],
    u: (kind, share) => (U_MAX[kind] ?? 2) * share,
    suit: (suit, { id, group }) => fieldGarment(recipe, R, build, map, { id, covers: null, on: Object.keys(U_MAX), ...SUIT, ease: suit.ease ?? 0.002, group }).parts,
  };
}

/** The suit on the realistic body. */
export const plating = (recipe, R, build, map, spec = 'powerSuit', opts = {}) => wearPlating(realisticBody(recipe, R, build, map), spec, opts);
