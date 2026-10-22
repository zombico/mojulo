/**
 * THE REALISTIC HAND (`form: 'realistic'`): the hero's authored hand (hero-hand.js: the palm `hand<S>`, four rings of
 * eight points, `front` the back of the hand and the R slots the thumb's side; the digits `thumb<S>` … `little<S>`, five
 * rings of six, `front` the nail's side), and its forearm re-sampled onto the form field. The glove's cuff up the forearm
 * is a field garment (body-relational-garment.js: leather close over the forearm's forms, a window from the wrist up).
 *
 *   realisticHand(recipe, R, build, map) → the adapter (../index.js)
 *   handwear(recipe, R, build, map, spec, { id, group }) → wearHandwear on it
 *
 * Pure and deterministic.
 */
import { fieldGarment } from '../../polygonizer/body-relational-garment.js';
import { wearHandwear } from '../expand.js';
import { rigNodesAt } from '../../polygonizer/station-loft-rig.js';

/** the glove's leather up the forearm: close, over its forms; `ease` its thickness */
const LEATHER = { ease: 0.0025, looser: 1.2, reach: 0.02, taut: false, span: 0.03, along: 2, soft: true };
/** each segment's `u` at its far end (the palm's and the digits' stations carry none: their index) */
const U_MAX = { foreArm: 2, hand: 3, thumb: 4, index: 4, middle: 4, ring: 4, little: 4 };

/** the hand's joints by name, at rest and with the digits closed by a hand word (the rig's own pose, at the bind): what
 * every body built by hero-hand.js shares */
export const HAND_JOINTS = Object.freeze(['wrist', 'knuckles', ...['Cmc', 'Mcp', 'Ip', 'Tip'].map((j) => `thumb${j}`), ...['index', 'middle', 'ring', 'little'].flatMap((d) => ['Mcp', 'Pip', 'Dip', 'Tip'].map((j) => d + j))]);
export function rigHandJoints(recipe, R) {
  const J = recipe.rig?.joints ?? {}, at = (k) => J[k]?.at ?? J[k];
  return {
    joints: (S) => Object.fromEntries(HAND_JOINTS.map((k) => [k, at(`${k}${S}`)])),
    gripJoints: (S, grip) => { const N = R?.hands?.[S] ? rigNodesAt(R, grip ? { [`fingers${S}`]: grip } : {}).nodes : null; return N ? Object.fromEntries(HAND_JOINTS.map((k) => [k, N[`${k}${S}`]])) : null; },
  };
}

export function realisticHand(recipe, R, build, map) {
  return {
    sides: ['R', 'L'],
    seg: (kind, S) => (recipe.parts[`${kind}${S}`] ? `${kind}${S}` : null),
    // (the joints, and the hand's joints with its digits closed by a hand word: what a mitten's shell is made round)
    ...rigHandJoints(recipe, R),
    bare: (name) => recipe.parts[name],
    cuff: (glove, { id, group }) => fieldGarment(recipe, R, build, map, { id, covers: null, on: ['foreArm'], window: { foreArm: [2 - 2 * glove.cuff, 2] }, ...LEATHER, ease: glove.thick ?? LEATHER.ease, group }).parts,
    u: (kind, share) => (U_MAX[kind] ?? 4) * share,
  };
}

/** The handwear on the realistic body. */
export const handwear = (recipe, R, build, map, spec = 'gloves', opts = {}) => wearHandwear(realisticHand(recipe, R, build, map), spec, opts);
