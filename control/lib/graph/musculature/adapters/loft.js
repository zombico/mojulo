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
 * pelvis; the joints' bridges are welded to their neighbours instead (ABUT) */
export const TUCK = Object.freeze({ torso: 0, upperArm: 0, foreArm: 0, shank: 0, neck: 0.002, pelvis: 0.002, thigh: 0.003, shoulderBall: 0.025, shoulderCone: 0.005, shoulderWeb: 0.025, elbowBridge: 0, wristBridge: 0, kneeBridge: 0 });

/** the shells tucked WHOLE, not by how far the shirt moved them: the shoulder's web and drum, under the arm's own skin and
 * dome (which the shirt carries over the shoulder); tucked by their movement, a band of the web showed between the arm's
 * dome and its side. They still bridge the armpit as the arm rises */
export const UNDER = Object.freeze(['shoulderWeb', 'shoulderBall']);
/** which shells show OVER each shell where they meet (base names; a limb's on its own side): the shirt keeps the one
 * under them under (passes.js keptInOrder) and dives its ends inside them (endsInside). Named, not read off the tucks:
 * by the tucks alone the elbow's bridge lay under the pelvis it hangs beside */
export const OVER = Object.freeze({ neck: ['torso'], pelvis: ['torso'] });
/** the joints' BRIDGES and the shells they ABUT, ring to ring on the flat body: the shirt welds each bridge's ends to its
 * neighbours' end rings (passes.js welded), and those ends do not dive */
export const ABUT = Object.freeze({ elbowBridge: ['upperArm', 'foreArm'], wristBridge: ['foreArm'], kneeBridge: ['thigh', 'shank'] });

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
/** a side's FOOT as the shirt scales it: the shoe's two boxes, or the bare foot and its toes; and the joints past the
 * ankle (the toe base and the tip) */
export const footParts = (S) => new RegExp(`^(foot|toes|hallux|toe[2-5])${S}$`);
export const footJoints = (S) => new RegExp(`^(toeBase|toeTip)${S}$`);
