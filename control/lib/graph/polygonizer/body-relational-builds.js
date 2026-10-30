/** body-relational-builds.js — THE BUILDS of the form field (norrin, shalla: data, each mass naming its anatomy) and the PHYSIQUE
 * over them (bulk, tone, weight, height). */
import { r6 } from './body-relational-vec.js';

/** THE BUILDS. Each mass names its anatomy; a belly is { on: { x, t, face } | { az, t }, along, r: [along, across,
 * depth], proud }, `along` a direction laid into the surface (world axes: +x out to the right, +y forward, +z up), `az`
 * the azimuth from the front toward the right (degrees). `mid` keeps a mass on the midline unmirrored. */
const NORRIN = {
  note: 'lean, sculpted, the anatomy legible under one smooth skin: the male slice (a Silver Surfer-like body)',
  // the hero's own tune under the build: the shoulders 10 % closer (every mass rides W, so the frame narrows with them)
  // (the arms 20 % in by the hero's own tune, over a body 10 % narrower than the hero's, `frame`: in Leonardo's figure
  // the pectoral runs into the shoulder; the arm 10 % in with the body 10 % narrower had left a ledge between them)
  tune: { shoulders: 0.8 }, frame: 0.9,
  // the spine's S: the lumbar curve carrying the lower back in above the seat, the thoracic rounding it out behind
  spine: [{ t: -0.05, depth: 0.16, w: 0.4 }, { t: 0.62, depth: -0.08, w: 0.38 }],
  // the pectoral's lower border is an overhang: the torso's rays there come down from above (as under the bust)
  lift: { t: 0.4, w: 0.18, h: 0.5 },
  // the lower trunk on the anatomy (bodyFrame): the navel 30 % of the way from the hip's joint to the shoulder's, the
  // seat and the crotch carried 0.15 T over where the build laid them (the navel had stood at the ribs' edge, the
  // crotch 11 cm under the hip's joint: the belly ran 1.8 times the body's own from navel to crotch)
  lower: { top: 0.5, navel: -0.02, hip: -1.0, at: 0.3, lift: 0.15 },
  kBase: 0.12, kMuscle: 0.03,
  base: [
    // (the column and the ribcage's dome end at the thoracic inlet: reaching 6 cm up inside the neck, the wide blend filled
    // from them to the neck in a tent, the neck widening from under the jaw straight down to the shoulder, a pyramid)
    { id: 'core', cone: [[0, -0.09, -0.42], [0, -0.09, 0.86]], r: [0.3, 0.27] },
    { id: 'ribcage', egg: [0, -0.06, 0.44], r: [0.62, 0.44, 0.66] },
    // (the belly's mass over the navel: under the lower frame the navel came down from the ribs' edge, and the run from
    // it up to the chest is the belly's to fill)
    { id: 'abdomen', egg: [0, -0.02, 0.15], r: [0.58, 0.4, 0.5] },
    // (the neck thin at the top and flaring out to its root, into the trapezius: a column read pinched at the base)
    { id: 'neck', cone: [[0, -0.05, 0.86], [0, -0.06, 1.8]], r: [0.31, 0.2] },
    { joint: true, id: 'girdle', cone: [[0.25, -0.06, 0.8], [0.9, -0.02, 0.84]], r: [0.26, 0.2] },
    // THE SEAT, one mass round the pelvis (the operator's: an upside-down heart seen from the front and from behind, a
    // teardrop from the side): two LOBES low on the hip's joints, each wrapping the hip from the front round to the back
    // (behind, the glutes, the dip between them the cleft; in front, the thighs' tops, the dip the crotch), and a TAPER
    // up the middle from above them to the heart's point under the navel in front and on the sacrum behind, its sides
    // the heart's flanks, squashed front to back to the belly's depth (begun between the lobes, its round end filled
    // the cleft). The lobes are centred a little behind the hip's joint as hero laws 3 sets it (LEG_SET), the groin in
    // front of it and the glute behind. Widest at the hip's joints, as the body is (a basin, a flank and separate glutes made a shelf at
    // the iliac crest, wider than the waist above and the thighs below)
    { id: 'seatLobe', egg: [0.48, -0.07, -1.02], r: [0.27, 0.46, 0.44] },
    { id: 'seatTaper', cone: [[0, -0.08, -0.72], [0, -0.04, -0.3]], r: [0.66, 0.58], squash: 0.65 },
    { id: 'pubis', egg: [0, 0.22, -1.2], r: [0.3, 0.3, 0.28] },
  ],
  muscles: [
    // the pectoral: the sternal head thickest at its lower border (the line the eye reads, its own tight blend `k`), its
    // fibres gathering up and out to the arm; the clavicular head a thinner sheet along the collarbone
    { id: 'pectoralSternal', on: { x: 0.36, t: 0.56, face: 'front' }, along: [1, 0, 0.5], r: [0.44, 0.27, 0.12], proud: 0.12, k: 0.012 },
    { id: 'pectoralClavicular', on: { x: 0.32, t: 0.84, face: 'front' }, along: [1, 0, -0.15], r: [0.3, 0.15, 0.07], proud: 0.07, k: 0.02 },
    // the sternum between the pectorals' heads: a low ridge, so they meet over it in a shallow groove (their tight blend
    // alone cut a V down the midline)
    { id: 'sternum', on: { x: 0, t: 0.62, face: 'front' }, along: [0, 0, 1], r: [0.5, 0.12, 0.08], proud: 0.08, mid: true },
    // the rectus abdominis: three segments evenly from the chest down to the navel (on the lower frame the run above the
    // navel is stretched, so their heights here are short), and under the navel one long smooth sheet to the pubis (the
    // third segment and a short lower one, squeezed under the navel, read as a belt's crease)
    { id: 'rectus1', on: { x: 0.15, t: 0.33, face: 'front' }, along: [0, 0, 1], r: [0.084, 0.14, 0.05], proud: 0.05 },
    { id: 'rectus2', on: { x: 0.15, t: 0.19, face: 'front' }, along: [0, 0, 1], r: [0.084, 0.14, 0.05], proud: 0.055 },
    { id: 'rectus3', on: { x: 0.15, t: 0.05, face: 'front' }, along: [0, 0, 1], r: [0.084, 0.14, 0.05], proud: 0.055 },
    { id: 'rectus4', on: { x: 0.12, t: -0.45, face: 'front' }, along: [0, 0, 1], r: [0.35, 0.2, 0.05], proud: 0.03 },
    { id: 'obliqueExternal', on: { az: 74, t: -0.3 }, along: [0, 0.3, 1], r: [0.3, 0.22, 0.08], proud: 0.03 },
    { id: 'serratus1', on: { az: 60, t: 0.3 }, along: [0, 1, -0.5], r: [0.13, 0.05, 0.035], proud: 0.03 },
    { id: 'serratus2', on: { az: 62, t: 0.44 }, along: [0, 1, -0.45], r: [0.13, 0.05, 0.035], proud: 0.03 },
    { id: 'serratus3', on: { az: 64, t: 0.58 }, along: [0, 1, -0.4], r: [0.12, 0.05, 0.035], proud: 0.03 },
    { id: 'latissimus', on: { az: 118, t: 0.42 }, along: [0.35, 0, 1], r: [0.6, 0.24, 0.1], proud: 0.09 },
    { id: 'infraspinatus', on: { x: 0.42, t: 0.68, face: 'back' }, along: [1, 0, -0.35], r: [0.26, 0.18, 0.11], proud: 0.05 },
    { id: 'trapeziusLower', on: { x: 0, t: 0.62, face: 'back' }, along: [0, 0, 1], r: [0.6, 0.36, 0.12], proud: 0.035, mid: true },
    { id: 'erector', on: { x: 0.14, t: -0.2, face: 'back' }, along: [0, 0, 1], r: [0.5, 0.13, 0.08], proud: 0.07 },
    // the sternocleidomastoid: from behind the ear down and in to the sternum's head, the neck's V from the front
    { id: 'sternocleidomastoid', cone: [[0.22, -0.06, 1.58], [0.06, 0.2, 0.98]], r: [0.07, 0.06] },
    // (the upper trapezius leaving the neck's side low, not at the jaw's height: the neck a column to its root)
    { joint: true, id: 'trapeziusUpper', cone: [[0.2, -0.14, 1.12], [0.7, -0.06, 0.97]], r: [0.13, 0.1] },
    // the armpit FILLED (the hanging arm covers it): the pectoral's and the latissimus's tendons into the arm and the
    // hollow between them, a cone from a point low on the chest's wall up to the shoulder, its side only ever moving
    // out as it rises. Without it the torso's rays at the shoulder's height crossed a gap between the chest's wall and
    // the deltoid's cap, by turns, in fins; a round mass only moved the gap under its own overhang
    { joint: true, id: 'axilla', cone: [[0.5, -0.03, 0.0], [0.76, -0.03, 0.68]], r: [0.05, 0.17] },
    // the pectoral's tendon running under the anterior deltoid into the arm (the pocket between them, by turns the
    // pec's wall and the deltoid's, read as fins)
    { joint: true, id: 'pectoralTendon', egg: [0.8, 0.14, 0.74], r: [0.22, 0.18, 0.18] },
    { joint: true, id: 'clavicle', cone: [[0.1, 0.24, 0.94], [0.7, 0.06, 0.98]], r: [0.06, 0.07] },
  ],
  dimples: [{ id: 'navel', on: { x: 0, t: -0.02, face: 'front' }, r: 0.025, k: 0.03 }],
  // THE PAULDRON: the mass bunched over the shoulder blade by a raised arm (formSlice's corrective; never in the bind)
  // (a water bag on the blade: narrow at its top over the blade's spine and full at its foot over the lower blade, so it
  // hangs as the trunk stands; grown from 60 degrees of raise, whole at 160. And the corner the raised arm leaves by
  // the neck filled: the trapezius's cap over the shoulder's top (60 to 150), a PLATE wide and tall but a third as deep,
  // so the front and the back see it and the profile hardly does; and the deltoid's top bunched over the joint (100 to
  // 170), sampled into the arm's top as well (an arm straight up turns its deltoid's outside toward the head: the
  // corner is the arm's own skin), rounder but less deep than wide. Round and deep, the two had stood out of the
  // profile like armour; the deltoid's as a thin plate, the arm's skin rose in a fin toward the head)
  pauldron: [
    { joint: true, id: 'pauldronBag', cone: [[0.66, -0.34, 0.95], [0.6, -0.34, 0.7]], r: [0.14, 0.26], drive: { from: 60, full: 160 } },
    { joint: true, id: 'pauldronCap', egg: [0.64, -0.05, 0.98], r: [0.46, 0.14, 0.22], drive: { from: 60, full: 150 } },
    { joint: true, id: 'pauldronDeltoid', egg: [1.02, -0.02, 0.9], r: [0.32, 0.28, 0.4], drive: { from: 100, full: 170 }, arm: true },
  ],
  // the arms (the right; the left its mirror): s along the bone, az round it (0 the front, 90 the outside)
  kLimb: 0.03,
  limbs: {
    // (each limb thickened across, `thick`: the girths had stood 10 to 28 % under the body's own, ANSUR II's means)
    upperArm: { from: 'shoulderR', to: 'elbowR', rings: 19, thick: { bone: 1.35, belly: 1.25 }, masses: [
      { id: 'humerus', cone: [0, 1], r: [0.15, 0.13] },
      { id: 'deltoidAnterior', s: 0.16, az: 25, off: 0.11, r: [0.3, 0.16, 0.13] },
      { id: 'deltoidLateral', s: 0.2, az: 90, off: 0.12, r: [0.32, 0.19, 0.14] },
      { id: 'deltoidPosterior', s: 0.18, az: 155, off: 0.11, r: [0.3, 0.16, 0.12] },
      // THE BICEPS AND THE TRICEPS, linked into the shoulder and the elbow (chains, as the thigh's sweep): the biceps from
      // the socket's front under the deltoid (its long head's tendon), swelling to its peak low on the arm, its tendon
      // into the elbow's crease; the triceps' long head from the shoulder blade behind the joint (the armpit's back wall),
      // fullest high on the arm's back, flattening to its tendon at the elbow's point. Eggs at mid-arm, each stood alone:
      // a dip under the deltoid, a lump, and a fall to the elbow
      { id: 'biceps', chain: [[-0.02, 15, 0.05, 0.06], [0.25, 8, 0.08, 0.11], [0.62, 3, 0.1, 0.15], [0.84, 0, 0.09, 0.11], [0.98, -10, 0.06, 0.06]] },
      { id: 'brachialis', s: 0.74, az: 70, off: 0.09, r: [0.2, 0.13, 0.11] },
      { id: 'tricepsLong', chain: [[-0.08, 210, 0.06, 0.07], [0.15, 200, 0.1, 0.14], [0.4, 188, 0.1, 0.16], [0.72, 180, 0.08, 0.12], [0.98, 180, 0.05, 0.07]] },
      { id: 'tricepsLateral', s: 0.38, az: 135, off: 0.11, r: [0.3, 0.15, 0.12] },
      { id: 'elbow', s: 0.98, r: [0.13, 0.17, 0.13] },
    ] },
    foreArm: { from: 'elbowR', to: 'wristR', rings: 17, thick: { bone: 1.2, belly: 1.12 }, masses: [
      { id: 'radiusUlna', cone: [0, 1], r: [0.14, 0.085] },
      { id: 'elbow', s: 0.02, r: [0.12, 0.16, 0.13] },
      { id: 'brachioradialis', s: 0.22, az: 45, off: 0.1, r: [0.36, 0.15, 0.13] },
      { id: 'flexors', s: 0.28, az: -55, off: 0.1, r: [0.38, 0.16, 0.13] },
      { id: 'extensors', s: 0.3, az: 135, off: 0.09, r: [0.34, 0.15, 0.11] },
      { id: 'wrist', s: 0.97, r: [0.1, 0.1, 0.14] },
    ] },
    // the legs (the right; the left its mirror): the thigh from the hip's socket, the shank from the knee
    // (the thigh rounder and finer than the other limbs: under the hip's level it takes the seat's fold and the crotch)
    thigh: { from: 'hipR', to: 'kneeR', rings: 33, around: 32, thick: { bone: 1.2, belly: 1.1 }, masses: [
      // (the bone slim, begun below the joint: a 6 cm ball at the hip's socket, forward of the trunk, read through the
      // pelvis's skin as an action figure's ball joint; the thigh's breadth up top is its muscles')
      { id: 'femur', cone: [0.12, 1], r: [0.17, 0.17] },
      // (the thigh's outside up top, over the greater trochanter: the hip flows down into it, not over it)
      { id: 'tensorFasciae', s: 0.12, az: 80, off: 0.16, r: [0.32, 0.2, 0.14] },
      { id: 'rectusFemoris', s: 0.42, az: 5, off: 0.2, r: [0.65, 0.22, 0.2] },
      { id: 'vastusLateralis', s: 0.48, az: 80, off: 0.2, r: [0.7, 0.27, 0.22] },
      { id: 'vastusMedialis', s: 0.8, az: -45, off: 0.17, r: [0.3, 0.22, 0.18] },
      { id: 'adductors', s: 0.25, az: -100, off: 0.16, r: [0.45, 0.24, 0.2] },
      // (the adductors' origin, fanning from the pubis into the thigh's inside just under the groin: the stretch's stuff
      // when the leg opens, which had pulled the inner thigh's top across the crotch in a thin web)
      { id: 'adductorOrigin', s: 0.17, az: -80, off: 0.22, r: [0.3, 0.22, 0.16] },
      { id: 'hamstrings', s: 0.5, az: 175, off: 0.16, r: [0.55, 0.22, 0.17] },
      // THE SWEEP (the operator's): one mass spiralling round the femur from the hip's side under the glute, down behind
      // the thigh (the hamstrings) and in to the knee's inside (the adductor magnus, the tendons' insertion), so the
      // thigh's back and inside read as one form from the side and from the front, and its volume rises into the seat
      { id: 'sweep', chain: [[-0.05, 120, 0.16, 0.22], [0.16, 178, 0.32, 0.3], [0.4, 196, 0.22, 0.25], [0.66, 235, 0.14, 0.18], [0.9, 268, 0.1, 0.11]] },
      { id: 'knee', s: 1, r: [0.22, 0.27, 0.25] },
      { id: 'patella', s: 0.96, az: 0, off: 0.17, r: [0.13, 0.13, 0.07] },
    ] },
    shank: { from: 'kneeR', to: 'ankleR', rings: 23, thick: { bone: 1.35, belly: 1.15 }, masses: [
      { id: 'tibia', cone: [0, 1], r: [0.22, 0.12] },
      { id: 'knee', s: 0, r: [0.2, 0.26, 0.23] },
      { id: 'gastrocnemiusMedial', s: 0.27, az: -150, off: 0.15, r: [0.38, 0.19, 0.17] },
      { id: 'gastrocnemiusLateral', s: 0.25, az: 150, off: 0.14, r: [0.33, 0.17, 0.15] },
      { id: 'soleus', s: 0.52, az: 180, off: 0.1, r: [0.42, 0.24, 0.14] },
      { id: 'tibialisAnterior', s: 0.35, az: 45, off: 0.12, r: [0.45, 0.13, 0.1] },
      { id: 'achilles', cone: [0.62, 0.95], az: 180, off: [0.1, 0.08], r: [0.07, 0.06] },
      { id: 'ankle', s: 0.98, r: [0.12, 0.17, 0.12] },
    ] },
    // THE FOOT AND THE TOES (the right; the left its mirror), on one field with the shank's own skin: the bone near level,
    // so az 0 is the dorsum (`front`, the world's up laid square to the bone), 90 the outside, 180 the sole. `foot` marks
    // a limb formSlice re-samples as a foot (body-relational-feet.js: the sole cut flat on the ground, the ankle out of the shank's
    // skin, the heel's and the toes' ends closed in domes); `k` its own blend, tighter than the limbs' (the toes' grooves)
    // the foot: the heel (the calcaneus) behind and under the ankle, the arch's two columns from it (the medial lifted off
    // the ground, the lateral on it), the midfoot's mass and the instep over them, the ankle's two bones (the inner
    // higher and forward), the ball across the metatarsals' heads (the inner end forward: the toe line's slant)
    foot: { from: 'ankleR', to: 'toeBaseR', front: [0, 0, 1], foot: true, k: 0.02, rings: 36, around: 48, masses: [
      { id: 'calcaneus', s: -0.303, az: 175, off: 0.115, r: [0.165, 0.155, 0.15] },
      { id: 'archLateral', chain: [[-0.067, 147, 0.203, 0.07], [0.892, 120, 0.207, 0.06]] },
      { id: 'archMedial', chain: [[-0.023, -144, 0.101, 0.08], [1.029, -119, 0.137, 0.08]] },
      { id: 'midfoot', chain: [[0.033, 173, 0.077, 0.15], [0.97, 180, 0.066, 0.09]] },
      { id: 'dorsum', s: 0.353, az: 0, off: 0, r: [0.2, 0.15, 0.125] },
      { id: 'malleolusLateral', s: -0.135, az: 78, off: 0.184, r: [0.07, 0.06, 0.05] },
      { id: 'malleolusMedial', s: -0.038, az: -63, off: 0.191, r: [0.07, 0.06, 0.05] },
      { id: 'ball', chain: [[1.113, -115, 0.165, 0.075], [0.915, 117, 0.224, 0.06]] },
    ] },
    // the toes: the big toe apart and the four beside it, each a bead from its knuckle to its pad, the tips on the
    // toe line's diagonal (the second toe's a little short of the big toe's)
    toes: { from: 'toeBaseR', to: 'toeTipR', front: [0, 0, 1], foot: true, k: 0.012, slant: 12, rings: 21, around: 48, masses: [
      { id: 'hallux', chain: [[0.073, -114, 0.164, 0.075], [0.885, -112, 0.173, 0.06]] },
      { id: 'toe2', chain: [[0.101, -161, 0.091, 0.05], [0.825, -166, 0.085, 0.04]] },
      { id: 'toe3', chain: [[0.052, 151, 0.105, 0.047], [0.727, 144, 0.111, 0.037]] },
      { id: 'toe4', chain: [[-0.01, 129, 0.155, 0.045], [0.615, 124, 0.169, 0.035]] },
      { id: 'toe5', chain: [[-0.096, 120, 0.213, 0.042], [0.428, 116, 0.233, 0.032]] },
    ] },
  },
};
/** a build's masses with their radii (and a belly's proud) scaled: one hand on a whole group's mass */
const scaled = (masses, f, proud = f) => masses.map((m) => (m.chain ? { ...m, chain: m.chain.map(([a, b, c, r]) => [a, b, c, r * f]) } : { ...m, r: m.r.map((x) => x * f), ...(m.proud !== undefined ? { proud: m.proud * proud } : {}) }));
/** a limb's masses thickened across, not lengthened (a build limb's `thick`: { bone, belly }): the bone's cone by `bone`,
 * a belly off the axis (an `az`) and a chain's beads by `belly`, an egg in its round and out radii only; the joints on
 * the axis (the knee, the elbow) as they are, where a limb is narrowest (a limb read thin between its bellies, the
 * bellies ballooned off a slim bone; the joints thickened with the bone stood out as knobs) */
export const thick = (masses, { bone, belly }) => masses.map((m) => {
  if (/^deltoid/.test(m.id)) return m;   // (the shoulder's breadth is the deltoid's: thickened, it stood 0.31 of the stature)
  if (m.chain) return { ...m, chain: m.chain.map(([a, b, c, r]) => [a, b, c, r * belly]) };
  const f = m.az !== undefined ? belly : m.cone ? bone : 1;
  return { ...m, r: m.cone ? m.r.map((x) => x * f) : [m.r[0], m.r[1] * f, m.r[2] * f] };
});
const byId = (masses, edits) => masses.map((m) => (edits[m.id] ? { ...m, ...edits[m.id] } : m));
const SHALLA = {
  note: 'lean and toned, the anatomy softer under one smooth skin, the bust in the field: the female slice',
  // (her arms 8 % in by the hero's own tune over her body as it was: the pectoral into the shoulder, as his)
  tune: { shoulders: 0.92 },
  kBase: 0.12, kMuscle: 0.04,
  // (the half biacromial already carries her narrower shoulders: on it her waist and seat stand wider than his)
  // (her lumbar curve a little deeper, her thoracic a little softer)
  spine: [{ t: -0.08, depth: 0.15, w: 0.42 }, { t: 0.6, depth: -0.07, w: 0.38 }],
  // (her waist drawn in across against her hips: on the hero's masses it measured 0.67 of the hips' width from the front,
  // his own 0.72, so the two read alike; a woman's runs about 0.6)
  waist: { t: 0.05, w: 0.3, pinch: 0.1 },
  base: byId(NORRIN.base, { abdomen: { r: [0.6, 0.45, 0.6] }, seatLobe: { egg: [0.58, -0.1, -1.05], r: [0.33, 0.5, 0.48] }, seatTaper: { r: [0.76, 0.62] } }),
  muscles: [
    ...byId(scaled(NORRIN.muscles.filter((m) => !/^pectoral(Sternal|Clavicular)$/.test(m.id)), 1, 0.6), {
      rectus1: { proud: 0.025 }, rectus2: { proud: 0.028 }, rectus3: { proud: 0.028 }, rectus4: { proud: 0.03 },
      trapeziusUpper: { r: [0.13, 0.08] }, sternocleidomastoid: { r: [0.07, 0.055] },
    }),
    { id: 'pectoralSternal', on: { x: 0.34, t: 0.6, face: 'front' }, along: [1, 0, 0.45], r: [0.38, 0.24, 0.09], proud: 0.07, k: 0.016 },
  ],
  // the bust as the Female Titan reads (Attack on Titan): firm and high, part of the pectoral's sheet (its upper pole the
  // pec's slope, no shelf), a little apart, the lower pole full over a clean fold: the breast field on the chest, its
  // cleft a little wider than the hero's
  // (firmer than the hero's own breast field: the apex rounder and less proud, the upper pole fuller off the pec, the
  // pair set apart over the sternum (a shallow valley, not the deep cleft that boxed its floor's rings), the
  // lower reach shorter; its pole ratios are the build's, past the field's own gates on purpose)
  cage: { around: 64, rings: 49 },
  bust: { t: 0.5, rb: 0.3, front: 0.15, fold: 0.75, field: { cleft: -1.5, proj: 0.85, round: 0.6, reach: { up: 1.3, down: 0.95, out: 1.25, in: 1.35 }, profile: { up: 1.8, down: 0.6, out: 2.4, in: 1.3 } } },
  // the fold under the bust: the torso's rays there come down from above (t the fold's height on the torso bone, w the
  // window's half width in t, h the raise in W)
  lift: { t: 0.31, w: 0.2, h: 0.8 },
  lower: NORRIN.lower,
  // (her pauldron the hero's, its masses 0.85 of his, as her muscles are lighter)
  pauldron: scaled(NORRIN.pauldron, 0.85),
  // (her navel shallower: on her finer cage the man's dimple read as a pit)
  dimples: [{ ...NORRIN.dimples[0], r: 0.016, k: 0.04 }],
  kLimb: 0.035,
  limbs: {
    upperArm: { ...NORRIN.limbs.upperArm, thick: { bone: 1.4, belly: 1.32 }, masses: scaled(NORRIN.limbs.upperArm.masses, 0.98) },
    foreArm: { ...NORRIN.limbs.foreArm, thick: { bone: 1.1, belly: 1.02 }, masses: scaled(NORRIN.limbs.foreArm.masses, 1.02) },
    thigh: { ...NORRIN.limbs.thigh, thick: { bone: 1.3, belly: 1.22 }, masses: scaled(NORRIN.limbs.thigh.masses, 1.04, 0.8) },
    // (her calf one form: the gastrocnemius's heads and the soleus a third longer and the soleus a little higher, so they
    // run into one another; thickened across alone, they stood as two beads with a waist between, from behind)
    shank: { ...NORRIN.limbs.shank, thick: { bone: 1.55, belly: 1.42 }, masses: scaled(NORRIN.limbs.shank.masses, 0.92, 0.8).map((m) => (/^(gastrocnemius|soleus)/.test(m.id) ? { ...m, ...(m.id === 'soleus' ? { s: 0.47 } : {}), r: [m.r[0] * 1.35, m.r[1], m.r[2]] } : m)) },
    foot: NORRIN.limbs.foot, toes: NORRIN.limbs.toes,
  },
};
export const BODY_BUILDS = Object.freeze({ norrin: NORRIN, shalla: SHALLA });

/**
 * THE CERVICAL NECK (realistic laws 3): the neck's column leaning forward up to the skull, as the cervical spine does
 * (from C7 up and forward into the skull's base), and a little fuller under it. The column had risen straight from the
 * trunk's top, so the nape stood under the back of the skull (the occiput 2.4 cm behind it; people 4 to 5) and the jaw
 * jutted 7 to 8 cm past the throat (people 5.5 to 6.5): the head read as hung off the front of a post. The head stays
 * where its fit sets it (the ear over the shoulder); the column's top comes forward under it by `lean` (of W) and widens
 * by `top`, its root where it was, each build its own (`name`).
 */
export const CERVICAL_NECK = Object.freeze({
  // (her jaw had jutted the more, 7 cm past the throat, and her nape stood the further back: the column comes the further
  // forward; his jaw already stood 6 cm past his throat, his occiput alone short behind his nape)
  shalla: Object.freeze({ lean: 0.18, top: 1.2 }),
  norrin: Object.freeze({ lean: 0.1, top: 1.2 }),
});
export function cervicalNeck(build, name) {
  const { lean, top } = CERVICAL_NECK[name];
  return { ...build, base: build.base.map((m) => (m.id === 'neck' ? { ...m, cone: [m.cone[0], [m.cone[1][0], m.cone[1][1] + lean, m.cone[1][2]]], r: [m.r[0], m.r[1] * top] } : m)) };
}

/**
 * THE THROAT LINE (realistic laws 13): the front from under the jaw to the chest one slope. The neck's root, the
 * collarbones' medial heads and the sternocleidomastoids' feet, blended wide, tented forward at the neck's base into a
 * ledge under the chin, the throat bulging forward of the line from the jaw to the chest (17 mm of it, on one hero): the
 * build's field is cut back to the chord from the neck's top to the chest (body-relational-field.js `throat`), each
 * build its own: `top` the chord's upper end under the head's base (W: the throat, under the chin); `chest` its lower,
 * up the torso bone; `x0`, `x1` its reach either side of the midline and its ease out (W); `k` its blend (W).
 */
export const THROAT_LINE = Object.freeze({
  shalla: Object.freeze({ top: 0.49, chest: 0.62, x0: 0.12, x1: 0.18, k: 0.03 }),
  norrin: Object.freeze({ top: 0.49, chest: 0.62, x0: 0.14, x1: 0.2, k: 0.03 }),
});
export const throatLine = (build, name) => ({ ...build, throat: THROAT_LINE[name] });

/** THE PHYSIQUE: four dials over a build, each −1 to 1, 0 the build as authored (the athletic base). `bulk` the muscles'
 * mass (their bellies across, how proud they stand; the bones and the joints as they are; on the plus side the arms set
 * out with the shoulders' muscle, the V of a superhero), `tone` their definition (the blends tighter or looser, the
 * abdomen's segments and the serratus prouder or sunk), `weight` the fat (a layer over the whole skin, thinning down the
 * limbs to none at the wrist and the ankle, where the authored hand and foot meet them, and none at the head's base; the
 * belly forward and the flanks, the seat and the neck fuller; under zero the layer thinner and the belly flat), `height`
 * the stature (a tenth either way, the hero's own tune: the joints, so the build must be minted with the build's tune).
 * Bulk on the plus side also sizes the hands (`hands`: the authored hand, its joints with it, about the wrist).
 * The words are points in it (`PHYSIQUES`). */
export const PHYSIQUE_DIALS = Object.freeze(['bulk', 'tone', 'weight', 'height']);
export const PHYSIQUES = Object.freeze({
  athletic: Object.freeze({ bulk: 0, tone: 0, weight: 0, height: 0 }),
  skinny: Object.freeze({ bulk: -0.6, tone: -0.2, weight: -0.8, height: 0 }),
  heavyset: Object.freeze({ bulk: 0.2, tone: -0.8, weight: 1, height: 0 }),
  jacked: Object.freeze({ bulk: 1, tone: 0.8, weight: 0.1, height: 0.5 }),
});
// (the masses that are bone or joint, never bulked: the sternum's ridge, the collarbone, the limbs' bones and ends)
const BONY = /^(sternum|clavicle|humerus|radiusUlna|femur|tibia|elbow|wrist|knee|ankle|patella|achilles)$/;
/** a build under a physique: a word (PHYSIQUES), or an object of dials (a word under `from`, the dials over it) */
export function physique(build, dials = 'athletic') {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  const word = typeof dials === 'string' ? dials : dials?.from;
  if (word !== undefined && !PHYSIQUES[word]) throw new Error(`body-relational: unknown physique '${word}' (have ${Object.keys(PHYSIQUES).join(', ')})`);
  const D = { ...PHYSIQUES[word ?? 'athletic'], ...(typeof dials === 'object' ? dials : {}) };
  for (const k of Object.keys(D)) {
    if (k === 'from') continue;
    if (!PHYSIQUE_DIALS.includes(k)) throw new Error(`body-relational: '${k}' is not a physique dial (have ${PHYSIQUE_DIALS.join(', ')})`);
    if (!(Math.abs(D[k]) <= 1)) throw new Error(`body-relational: physique ${k} ${D[k]} is outside −1 to 1`);
  }
  const { bulk: b, tone: t, weight: w, height: h } = D;
  if (!b && !t && !w && !h) return B;   // (the athletic base: the build itself, byte for byte)
  const wp = Math.max(0, w), f = 1 + 0.25 * b, proud = Math.max(0.3, 1 + 0.6 * b), k = 1 - 0.35 * t;
  // the torso's muscles: bellies across and proud by bulk, the blends by tone, the abdomen's and the serratus's relief
  const tor = (m) => {
    if (BONY.test(m.id)) return m;
    const fm = m.id === 'sternocleidomastoid' ? 1 + 0.15 * b : f, out = m.chain || m.cone || m.egg ? scaled([m], fm)[0] : scaled([m], fm, proud)[0];
    const relief = /^rectus[123]$/.test(m.id) ? 1 + 0.4 * t : /^serratus/.test(m.id) ? 1 + 0.5 * t : 1;
    return { ...out, ...(out.proud !== undefined ? { proud: out.proud * relief } : {}), ...(m.k ? { k: m.k * k } : {}) };
  };
  // a limb's muscles across (not along: a longer belly runs into the joint), the deltoid's heads whole. On the plus
  // side the calf fuller still, and the forearm carried full down to a wrist the size of the bigger hand (`hands`): the
  // bellies alone left the forearm a club over a narrow wrist
  const bp = Math.max(0, b), hands = 1 + 0.1 * bp, calf = 1 + 0.25 * bp;
  const limb = (m, id) => {
    // (the FOOT barely: its soft masses across by a twenty-fifth at the dials' ends, the ankle's bones as they are; a
    // foot is its bones and its pads, and the gaits plant its sole)
    if (B.limbs[id]?.foot) {
      const gf = 1 + 0.04 * b + 0.04 * wp; if (/^malleolus/.test(m.id)) return m;
      return m.chain ? { ...m, chain: m.chain.map(([s, az, off, r]) => [s, az, off, r * gf]) } : { ...m, r: [m.r[0], m.r[1] * gf, m.r[2] * gf] };
    }
    if (m.id === 'radiusUlna') return { ...m, r: [m.r[0], m.r[1] * (1 + 0.35 * bp)] };
    if (m.id === 'wrist') return { ...m, r: m.r.map((x) => x * hands) };
    // (the gastrocnemius's heads the calf's bulk, longer as they are fuller, or they round into beads, and set higher: a
    // high diamond over a long taper to a slim ankle, as a superhero's; the soleus under them hardly grows, or the calf
    // swelled low and read as a club)
    if (/^gastrocnemius/.test(m.id)) return { ...m, s: m.s - 0.04 * bp, r: [m.r[0] * calf, m.r[1] * f * calf, m.r[2] * f * calf] };
    if (m.id === 'soleus') return { ...m, r: [m.r[0], m.r[1] * (1 + 0.1 * b), m.r[2] * (1 + 0.1 * b)] };
    if (BONY.test(m.id)) return m;
    // (the THIGH's bulk eased off toward the knee, by where a belly or a bead lies down the femur, and its long front and
    // outer heads set higher: grown alike, the thigh stood widest just over the knee, a barrel from the front)
    const fs = (s) => (id !== 'thigh' || b <= 0 ? f : 1 + (f - 1) * Math.max(0.15, Math.min(1, 1 - (s - 0.45) / 0.45)));
    if (m.chain) return { ...m, chain: m.chain.map(([s, az, off, r]) => [s, az, off, r * fs(s)]) };
    if (m.cone) return { ...m, r: m.r.map((x) => x * f) };
    const g = fs(m.s ?? 0), up = id === 'thigh' && /^(rectusFemoris|vastusLateralis)$/.test(m.id) ? { s: m.s - 0.06 * bp } : {};
    return { ...m, ...up, r: /^deltoid/.test(m.id) ? m.r.map((x) => x * g) : [m.r[0], m.r[1] * g, m.r[2] * g] };
  };
  // the fat: the layer in W, and down each limb its two ends (the hand's and the foot's ends none)
  const fat = w > 0 ? 0.09 * w : 0.03 * w;
  const FAT = { upperArm: [fat, 0.6 * fat], foreArm: [0.6 * fat, 0], thigh: [1.1 * fat, 0.5 * fat], shank: [0.5 * fat, 0] };
  const base = B.base.map((m) => {
    if (m.id === 'abdomen') return { ...m, egg: [m.egg[0], m.egg[1] + 0.08 * wp, m.egg[2] - 0.1 * wp], r: [m.r[0] * (1 + 0.12 * wp), m.r[1] * (w > 0 ? 1 + 0.5 * w : 1 + 0.25 * w), m.r[2] * (1 + 0.15 * wp)] };
    // (the seat's lobes fuller behind and below, not across: grown toward the midline they closed the crotch's gap)
    if (m.id === 'seatLobe') return { ...m, r: [m.r[0], m.r[1] * (1 + 0.12 * w), m.r[2] * (1 + 0.12 * w)] };
    if (m.id === 'neck') return { ...m, r: m.r.map((x) => x * (1 + 0.1 * b + 0.15 * wp)) };
    return m;
  });
  // (the flanks over the hip's crest, the love handles: a mass of the base only where there is fat to carry)
  if (wp > 0) base.push({ id: 'flank', egg: [0.42, -0.06, -0.32], r: [0.3, 0.32, 0.3].map((x) => x * (0.5 + 0.5 * wp)) });
  const S = 1 + 0.08 * bp;
  return {
    ...B,
    note: `${B.note}, under the physique ${PHYSIQUE_DIALS.map((x) => `${x} ${D[x]}`).join(', ')}`,
    physique: Object.fromEntries(PHYSIQUE_DIALS.map((x) => [x, D[x]])),
    tune: { ...(B.tune || {}), ...(S !== 1 ? { shoulders: r6((B.tune?.shoulders ?? 1) * S) } : {}), ...(h ? { stature: r6((B.tune?.stature ?? 1) * (1 + 0.1 * h)) } : {}) },
    kMuscle: B.kMuscle * k, kLimb: B.kLimb * k,
    base,
    muscles: B.muscles.map(tor),
    // (the pauldron grown faster than the muscles on the plus side: bulked, the deltoid and the trapezius stand further
    // off the blade, and a raised arm leaves the bigger corner to fill)
    ...(B.pauldron ? { pauldron: scaled(B.pauldron, f + 0.25 * bp) } : {}),
    ...(B.bust ? { bust: { ...B.bust, rb: B.bust.rb * (1 + 0.12 * w) } } : {}),
    ...(fat ? { fat } : {}),
    ...(hands !== 1 ? { hands } : {}),
    limbs: Object.fromEntries(Object.entries(B.limbs).map(([id, Lb]) => [id, { ...Lb, masses: Lb.masses.map((m) => limb(m, id)), ...(fat && FAT[id] ? { fat: FAT[id] } : {}) }])),
  };
}



/**
 * THE ROUND-OUT (realistic laws 4): the limbs' masses re-proportioned so each segment flows into the next, the way a
 * person's limb does, where the builds had read as an action figure's: each joint pinched between its bellies (the thigh
 * 5 cm of girth under the knee just above it, the wrist half the forearm's belly, people about 0.6), the forearm dropping
 * from its belly to the wrist in a step, a knot of the adductors' origin under the groin, and the limbs' masses joined
 * in tight creases. Read off the body's CT stack (horizontal cuts every centimetre) and each part's rings, and held to the
 * figure-drawing rhythm the bellies already had (the thigh's outside peaking high and its inside low over the knee, the
 * calf behind at a third of the shank, its inner head lower and fuller than the outer): the joints filled, the bellies
 * kept, not a cylinder. Data only, by mass id over a build's limbs: `kLimb` the limbs' blend widened (× the build's), and
 * per limb each named mass's `s` moved and its radii scaled ([along, round, out]: `along` lengthens a belly toward its
 * neighbours, `across` scales round and out). Every edit is relative, so a physique's dials stand over it.
 */
export const ROUND_OUT = Object.freeze({
  kLimb: 1.35,
  // the hinges' segments stitched on one ring at the joint's plane (body-relational.js formSlice `stitch`), the shank
  // rung as the thigh is so the ring is shared point for point
  stitch: Object.freeze([Object.freeze(['thigh', 'shank']), Object.freeze(['upperArm', 'foreArm'])]),
  around: Object.freeze({ shank: 32 }),
  limbs: Object.freeze({
    // the forearm: the bone fuller at the wrist and the wrist's mass a little longer and flatter (wider than deep), the
    // bellies reaching further toward the wrist, so the forearm tapers instead of stepping down to a stalk
    foreArm: Object.freeze({
      radiusUlna: { end: 1.38 },
      wrist: { s: 0.95, along: 1.3, round: 1.08, out: 0.8 },
      brachioradialis: { s: 0.24, along: 1.15 }, flexors: { s: 0.31, along: 1.22 }, extensors: { s: 0.33, along: 1.22 },
    }),
    // the thigh: the outer quadriceps and the hamstrings reaching nearer the knee (round its outside and back the femur's
    // cone alone had met it), the vastus medialis's teardrop longer, the knee's knob slimmer; the adductors' origin a
    // long flat sheet into fuller adductors, the sweep's shoulder under the glute lower
    thigh: Object.freeze({
      vastusLateralis: { s: 0.56, along: 1.25 }, vastusMedialis: { along: 1.25 }, hamstrings: { s: 0.55, along: 1.2 },
      knee: { across: 0.92 },
      sweep: { bead: [1, 0.78] },
      adductorOrigin: { s: 0.2, along: 1.4, round: 0.82, out: 0.8 }, adductors: { s: 0.3, along: 1.22, out: 1.1 },
    }),
    // the shank: the knee's knob slimmer and longer, the calf's outer head higher and reaching up to the knee, its inner
    // head lower and fuller (seen from the front the inner calf the prouder and the lower), the soleus less wide
    shank: Object.freeze({
      knee: { along: 1.2, across: 0.9 },
      gastrocnemiusLateral: { s: 0.23, along: 1.25, out: 1.05 }, gastrocnemiusMedial: { s: 0.3, along: 1.15, round: 1.05, out: 1.12 },
      soleus: { round: 0.85 },
    }),
  }),
});
/** one mass under a ROUND_OUT edit: `s`, a cone's `end` radius, a chain's `bead` [index, × radius], an egg's radii */
function roundMass(m, e) {
  if (m.chain) return e.bead ? { ...m, chain: m.chain.map((b, i) => (i === e.bead[0] ? [b[0], b[1], b[2], b[3] * e.bead[1]] : b)) } : m;
  if (m.cone) return e.end ? { ...m, r: [m.r[0], m.r[1] * e.end] } : m;
  const across = e.across ?? 1;
  return { ...m, ...(e.s !== undefined ? { s: e.s } : {}), r: [m.r[0] * (e.along ?? 1), m.r[1] * (e.round ?? across), m.r[2] * (e.out ?? across)] };
}
/** a build under the ROUND-OUT (realistic laws 4) */
/**
 * THE MAN'S HIPS (realistic laws 9): the male build's hip sockets brought in with its narrowed frame. The build narrows
 * the shoulders (its `tune`, 0.8) but the rig's hips are the heroic cast's, 22 cm apart; the pelvis's skin is carried
 * out to them, so every male physique stood a pinched waist over wide hips (waist to hip 0.76 … 0.79, the female band:
 * hero-core-measures.js CORE_BANDS) and a turntable read a woman from behind and in profile. `hipSpan` scales the hip
 * joints' distance from the midline (the knees, already slanted in under them, stay), so the femur slants less and the
 * sockets sit about 19 cm apart, a man's. The female build is left as it is.
 */
export const MALE_HIPS = Object.freeze({ hipSpan: 0.78 });
export const maleHips = (build, name) => (name === 'norrin' ? { ...build, hipSpan: MALE_HIPS.hipSpan } : build);
/** a rig with its hip joints `span` of their distance from the midline (a joint as a point or { at }) */
export function withHipSpan(rig, span) {
  const joints = { ...rig.joints };
  for (const k of ['hipR', 'hipL']) { const v = joints[k]; if (!v) continue; const at = Array.isArray(v) ? v : v.at, moved = [r6(at[0] * span), at[1], at[2]]; joints[k] = Array.isArray(v) ? moved : { ...v, at: moved }; }
  return { ...rig, joints };
}

export function roundOut(build) {
  const R = ROUND_OUT;
  const limbs = Object.fromEntries(Object.entries(build.limbs).map(([k, L]) => [k, R.limbs[k] ? { ...L, masses: L.masses.map((m) => (R.limbs[k][m.id] ? roundMass(m, R.limbs[k][m.id]) : m)) } : L]));
  const rung = Object.fromEntries(Object.entries(limbs).map(([k, L]) => [k, R.around[k] ? { ...L, around: R.around[k] } : L]));
  return { ...build, kLimb: build.kLimb * R.kLimb, limbs: rung, stitch: R.stitch };
}
