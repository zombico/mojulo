/** musculature/adapters/loft.js — the LOFTED hero body (station-loft.js: the tiered body every stylized hero wears, the anime
 * frame's among them) as the muscle shirt reads it: which parts are the body's skin (closed lofts the shirt re-samples
 * and wears), which side each is on, and which parts the shirt takes off (the pectoral layer: the shirt's chest is its
 * own). The hands, the feet and the head are left as they are. */

/** the body's skin by base name (a limb's `R` / `L` implied) */
export const SKIN_PARTS = Object.freeze(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank', 'shoulderBall', 'shoulderCone', 'shoulderWeb', 'elbowBridge', 'wristBridge', 'kneeBridge']);
/** what the shirt takes off: the pectoral layer (its chest group is the chest) */
export const TAKEN_OFF = /^pectoral[RL]$/;

/** each part's TUCK (metres): where two shells overlap and the shirt carries both onto the same muscle, the one that
 * should not show is set this far inside, as far as the shirt moved it (two skins on one surface z-fought in stripes).
 * The torso and the limbs show; the neck under the torso's root, the pelvis under the waist, the thigh under the
 * pelvis, and the joints' bridging shells under all of them */
export const TUCK = Object.freeze({ torso: 0, upperArm: 0, foreArm: 0, shank: 0, neck: 0.002, pelvis: 0.002, thigh: 0.003, shoulderBall: 0.004, shoulderCone: 0.005, shoulderWeb: 0.005, elbowBridge: 0.004, wristBridge: 0.004, kneeBridge: 0.004 });

/** the ends that SHOW and are closed in a dome the shirt is worn over (passes.js densify): the shoulder's top (the
 * web's, the drum's and the arm's). Every other end is a joint's seam under its neighbour and keeps its authored cap (domed, the
 * torso's top rose round the neck's root in a hood) */
export const DOMES = Object.freeze({ shoulderBall: Object.freeze(['back']), shoulderWeb: Object.freeze(['back']), upperArm: Object.freeze(['back']) });

/** a part's base name and side: { base, side: 'R' | 'L' | null } */
export const sideOf = (name) => { const m = /^(.*?)([RL])$/.exec(name); return m && SKIN_PARTS.includes(m[1]) ? { base: m[1], side: m[2] } : { base: name, side: null }; };

/** the recipe's skin parts the shirt wears: the midline ones and the right limbs' (the left mirrored from them), each
 * a closed layer-1 loft; the left partners by right name */
export function skinOf(recipe) {
  const mid = [], right = [], left = {};
  for (const [n, p] of Object.entries(recipe.parts)) {
    if (p.layer !== 1 || !Array.isArray(p.stations) || !Array.isArray(p.slots)) continue;
    const { base, side } = sideOf(n); if (!SKIN_PARTS.includes(base)) continue;
    if (side === null) mid.push(n); else if (side === 'R') right.push(n); else left[`${base}R`] = n;
  }
  return { mid, right, left };
}

/** a side's HAND as the shirt scales it (passes.js handsScaled): its parts (the hand, its digits, the bridge from the
 * forearm) and its joints (the knuckles, the fingers' axis, every digit's), all about the wrist */
export const handParts = (S) => new RegExp(`^(hand|thumb|index|middle|ring|little|wristBridge)${S}$`);
export const handJoints = (S) => new RegExp(`^(knuckles|fingerAxis|thumb|index|middle|ring|little)[A-Za-z]*${S}$`);
/** the bridges eased from the forearm's scale to the hand's (their back at the forearm, their tip at the hand) */
export const handRamp = (name) => /^wristBridge[RL]$/.test(name);
