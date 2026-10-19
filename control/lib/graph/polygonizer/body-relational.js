/** body-relational.js — the BODY as a form field: the realistic register's vertical slice. The hero's trunk read the way
 * head-relational.js reads the head: bone where it shows and the muscle masses placed from the hero's REST JOINTS (so the
 * field rides any cast and any tune), summed into one skin (log-sum-exp: each mass a bump in one wave, the valleys
 * between them the grooves an artist cuts), and the hero's torso cage re-sampled onto it, denser.
 *
 *   positions  x and y in W (the half biacromial: the shoulder joint's x), z as t along the torso bone (0 the navel,
 *              1 the neck hub); every length in W
 *   the base   the core (the spine's column, so every ring's centre sits inside), the ribcage's egg, the abdomen, the
 *              seat round the pelvis, the neck's column: summed with a wide blend (`kBase`)
 *   muscles    each a belly (an ellipsoid) SEATED on the base: cast from the trunk's axis toward the front, the back or an
 *              azimuth, its centre on the base's surface pushed out by `proud` less its depth, its fibre laid in the
 *              surface's tangent plane; or a cone between two points (the clavicle, the upper trapezius). A mass off the
 *              midline is mirrored; summed onto the base with a tight blend (`kMuscle`), so where two meet a groove
 *   dimples    smooth subtractions (the navel)
 *
 * formSlice(recipe, R, build) re-samples the torso: rings between the authored stations (the address keeps its u), more
 * slots round each (the front slot 0, the back half way), each slot pushed along its ring's radial line (from the ring's
 * centre through the authored cage's point there) to the field's first crossing outward. The bind follows the authored
 * one (its station and slot shares interpolated), the dials' station blends by u, so the rig poses it unchanged. The
 * pectoral and bust parts leave: the field carries their form. A dev path for the body lane (`body-study --form`), not
 * the door: no minted hero changes. Pure and deterministic (dmath). */
import * as dmath from '../../util/dmath.js';
import { BREAST_FIELD, breastHeight } from './breast-field.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : [0, 0, 1]; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** an ellipsoid's signed distance (the bound Inigo Quilez's k0·(k0 − 1)/k1: exact on the surface, close near it) */
function sdEgg(p, e) {
  const d = sub(p, e.c), q = [dot(d, e.ax[0]) / e.r[0], dot(d, e.ax[1]) / e.r[1], dot(d, e.ax[2]) / e.r[2]];
  const k0 = len(q), k1 = len([q[0] / e.r[0], q[1] / e.r[1], q[2] / e.r[2]]);
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(...e.r);
}
/** a round cone's signed distance (the hull of two spheres; vajra.js's, on arrays) */
function sdCone(p, a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr;
  if (l2 < 1e-12 || a2 <= 1e-12) return Math.min(len(sub(p, a)) - r1, len(sub(p, b)) - r2);
  const il2 = 1 / l2, pa = sub(p, a), y = dot(pa, ba), z = y - l2;
  const xv = sub(scl(pa, l2), scl(ba, y)), x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
/** a mass's signed distance, unclipped (an egg or a round cone, as the fields build them) */
const sdPrim = (p, q) => (p.cone ? sdConeOf(p, q) : sdEgg(q, p));
/** a round cone's distance, `squash`ed front to back (its section an ellipse, depth `squash` of its width: the seat's
 * taper, as wide as the waist and no deeper than the belly; the stretched distance scaled back, a bound) */
function sdConeOf(p, q) {
  if (!p.squash) return sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]);
  const cy = (p.cone[0][1] + p.cone[1][1]) / 2;
  return sdCone([q[0], cy + (q[1] - cy) / p.squash, q[2]], p.cone[0], p.cone[1], p.r[0], p.r[1]) * p.squash;
}
/** the skin wave: −k · ln Σ e^(−dᵢ/k) (the union's surface, each mass a bump in it; shifted by the least for range) */
function lse(ds, k) {
  let m = Infinity; for (const d of ds) if (d < m) m = d;
  let s = 0; for (const d of ds) s += dmath.exp(-(d - m) / k);
  return m - k * dmath.log(s);
}
const smaxp = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

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
    { id: 'core', cone: [[0, -0.09, -0.42], [0, -0.09, 1.0]], r: [0.3, 0.27] },
    { id: 'ribcage', egg: [0, -0.06, 0.5], r: [0.62, 0.44, 0.8] },
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
    { joint: true, id: 'trapeziusUpper', cone: [[0.12, -0.15, 1.3], [0.7, -0.06, 0.98]], r: [0.14, 0.1] },
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
  // the arms (the right; the left its mirror): s along the bone, az round it (0 the front, 90 the outside)
  kLimb: 0.03,
  limbs: {
    // (each limb thickened across, `thick`: the girths had stood 10 to 28 % under the body's own, ANSUR II's means)
    upperArm: { from: 'shoulderR', to: 'elbowR', rings: 19, thick: { bone: 1.35, belly: 1.25 }, masses: [
      { id: 'humerus', cone: [0, 1], r: [0.15, 0.13] },
      { id: 'deltoidAnterior', s: 0.16, az: 25, off: 0.11, r: [0.3, 0.16, 0.13] },
      { id: 'deltoidLateral', s: 0.2, az: 90, off: 0.12, r: [0.32, 0.19, 0.14] },
      { id: 'deltoidPosterior', s: 0.18, az: 155, off: 0.11, r: [0.3, 0.16, 0.12] },
      { id: 'biceps', s: 0.56, az: 5, off: 0.1, r: [0.36, 0.17, 0.15] },
      { id: 'brachialis', s: 0.74, az: 70, off: 0.09, r: [0.2, 0.13, 0.11] },
      { id: 'tricepsLong', s: 0.44, az: 200, off: 0.11, r: [0.42, 0.17, 0.14] },
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
  },
};
/** a build's masses with their radii (and a belly's proud) scaled: one hand on a whole group's mass */
const scaled = (masses, f, proud = f) => masses.map((m) => (m.chain ? { ...m, chain: m.chain.map(([a, b, c, r]) => [a, b, c, r * f]) } : { ...m, r: m.r.map((x) => x * f), ...(m.proud !== undefined ? { proud: m.proud * proud } : {}) }));
/** a limb's masses thickened across, not lengthened (a build limb's `thick`: { bone, belly }): the bone's cone by `bone`,
 * a belly off the axis (an `az`) and a chain's beads by `belly`, an egg in its round and out radii only; the joints on
 * the axis (the knee, the elbow) as they are, where a limb is narrowest (a limb read thin between its bellies, the
 * bellies ballooned off a slim bone; the joints thickened with the bone stood out as knobs) */
const thick = (masses, { bone, belly }) => masses.map((m) => {
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
  bust: { t: 0.5, rb: 0.3, front: 0.15, field: { cleft: -1.5, proj: 0.85, round: 0.6, reach: { up: 1.3, down: 0.95, out: 1.25, in: 1.35 }, profile: { up: 1.8, down: 0.6, out: 2.4, in: 1.3 } } },
  // the fold under the bust: the torso's rays there come down from above (t the fold's height on the torso bone, w the
  // window's half width in t, h the raise in W)
  lift: { t: 0.31, w: 0.2, h: 0.8 },
  lower: NORRIN.lower,
  // (her navel shallower: on her finer cage the man's dimple read as a pit)
  dimples: [{ ...NORRIN.dimples[0], r: 0.016, k: 0.04 }],
  kLimb: 0.035,
  limbs: {
    upperArm: { ...NORRIN.limbs.upperArm, thick: { bone: 1.4, belly: 1.32 }, masses: scaled(NORRIN.limbs.upperArm.masses, 0.98) },
    foreArm: { ...NORRIN.limbs.foreArm, thick: { bone: 1.1, belly: 1.02 }, masses: scaled(NORRIN.limbs.foreArm.masses, 1.02) },
    thigh: { ...NORRIN.limbs.thigh, thick: { bone: 1.3, belly: 1.22 }, masses: scaled(NORRIN.limbs.thigh.masses, 1.04, 0.8) },
    shank: { ...NORRIN.limbs.shank, thick: { bone: 1.55, belly: 1.42 }, masses: scaled(NORRIN.limbs.shank.masses, 0.92, 0.8) },
  },
};
export const BODY_BUILDS = Object.freeze({ norrin: NORRIN, shalla: SHALLA });


/** the build's measures from the rest joints: the half biacromial W, the navel joint's height z0 and the torso bone's
 * length T; a height t up the torso bone is `zOf(t)`, z0 + t T, but under the ribs a build with a `lower` frame lays its
 * heights on the anatomy's own landmarks: the rig's navel joint is a joint of the spine at the ribs' lower edge, not the
 * navel, and the hip's joint is the leg's. Three knots, by t: `top` (above it z0 + t T, the chest as built), `navel` (the
 * navel's dimple, set `at` of the way from the hip's joint to the shoulder's, the body's own ratio) and `hip` (the hip's
 * joint's height as the build was laid out, set `lift` T over the joint); straight between the knots, and under the
 * hip's knot the build's own spacing. So the lower trunk rides the hip's joint wherever the leg puts it. `slope(t)` is
 * how much a height is stretched there (a mass's height scales with it), `tOf` the inverse */
export function bodyFrame(R, build = null) {
  // (W the body's own breadth: the half biacromial the build's tune left, by its `frame`, so a tune that brings the
  // arms in, `shoulders`, moves them over a body that stays; `Sx` where the shoulder's joint now stands, of W, which the
  // masses the arm hangs from (`joint`: the girdle, the collarbone, the trapezius's fall, the armpit) are drawn in by)
  const J = R.joints, W = (J.shoulderR[0] / (build?.tune?.shoulders ?? 1)) * (build?.frame ?? 1), Sx = J.shoulderR[0] / W, z0 = J.navel[2], T = J.neckHub[2] - J.navel[2], lin = (t) => z0 + t * T;
  const Lw = build?.lower;
  let zOf = lin, tOf = (z) => (z - z0) / T;
  if (Lw) {
    const hz = J.hipR[2], kt = [Lw.hip, Lw.navel, Lw.top], kz = [hz + Lw.lift * T, hz + Lw.at * (J.shoulderR[2] - hz), lin(Lw.top)];
    if (!(kz[0] < kz[1] && kz[1] < kz[2])) throw new Error(`body-relational: the lower frame's knots are out of order (${kz.map((z) => z.toFixed(3)).join(', ')})`);
    const seg = (x, xs, ys) => { const i = x <= xs[1] ? 0 : 1; return ys[i] + ((x - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]); };
    zOf = (t) => (t >= Lw.top ? lin(t) : t <= Lw.hip ? kz[0] + (t - Lw.hip) * T : seg(t, kt, kz));
    tOf = (z) => (z >= kz[2] ? (z - z0) / T : z <= kz[0] ? Lw.hip + (z - kz[0]) / T : seg(z, kz, kt));
  }
  const slope = (t) => (zOf(t + 0.01) - zOf(t - 0.01)) / (0.02 * T);
  return { W, Sx, z0, T, zOf, tOf, slope, at: ([x, y, t]) => [x * W, y * W, zOf(t)] };
}

/** the field: { sd(p), base(p), masses } for a build on a rig's rest */
export function bodyField(R, build, { extra = [] } = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  const F = bodyFrame(R, B), W = F.W;
  const frameOf = (along, n) => { const u = unit(sub(along, scl(n, dot(along, n)))), v = cross(n, u); return [u, v, n]; };
  // (a radius `i` stretched by the frame's `slope`, as far as it runs up the body, `up` of it)
  const tall = (r, i, up, sl) => r.map((x, j) => (j === i ? x * (1 + (sl - 1) * up) : x));
  const prim = (m) => {
    const at = m.joint ? ([x, y, t]) => F.at([x * F.Sx, y, t]) : F.at;
    if (m.cone) return { cone: [at(m.cone[0]), at(m.cone[1])], r: m.r.map((x) => x * W), ...(m.squash ? { squash: m.squash } : {}) };
    // an egg without a fibre lies on the world's axes (r: x, y, z); with one, r is along, across, depth (depth forward);
    // its height stretched as the frame stretches it there
    const ax = m.along ? frameOf(unit(m.along), [0, 1, 0]) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    return { egg: true, c: at(m.egg), ax, r: tall(m.r, m.along ? 0 : 2, m.along ? Math.abs(unit(m.along)[2]) : 1, F.slope(m.egg[2])).map((x) => x * W) };
  };
  const mirror = (p) => (p.cone ? { ...p, cone: p.cone.map(([x, y, z]) => [-x, y, z]) } : { ...p, c: [-p.c[0], p.c[1], p.c[2]], ax: p.ax.map(([x, y, z]) => [-x, y, z]) });
  const sides = (m, p) => (m.mid || (p.cone ? p.cone.every((q) => q[0] === 0) : p.c[0] === 0) ? [p] : [p, mirror(p)]);
  // (a mass with `clip` is cut smoothly under a cone round the trunk's axis, rising outward from (rho, z) at `slope`:
  // what a neighbour's field owns under it stays out of this one, and the cut faces outward, so a ray from the axis
  // leaves through it once; a level cut left a flat underside the rays grazed)
  const sdOf = (p, q) => {
    const d = p.cone ? sdConeOf(p, q) : sdEgg(q, p); if (!p.clip) return d;
    // (or cut under a level, `below`: the thigh's root, owned by the pelvis above the hip's handover)
    const c = p.clip, cut = c.below !== undefined ? c.below - q[2] : (c.slope * (Math.hypot(q[0], q[1]) - c.rho) - (q[2] - c.z)) / Math.hypot(1, c.slope);
    return smaxp(d, cut, c.k);
  };
  const baseP = B.base.flatMap((m) => sides(m, { ...prim(m), id: m.id })), kB = B.kBase * W, kM = B.kMuscle * W;
  const base = (q) => lse(baseP.map((p) => sdOf(p, q)), kB);
  const grad = (fn, q) => { const e = 1e-4; return unit([fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))]); };
  // a point seated on the base: cast from the trunk's axis at height t toward the face, the base's first crossing
  const seat = (on) => {
    const z = F.zOf(on.t), o = [0, 0, z];
    const dir = on.az !== undefined ? [dmath.sin((on.az * Math.PI) / 180), dmath.cos((on.az * Math.PI) / 180), 0] : [0, on.face === 'back' ? -1 : 1, 0];
    const from = on.az !== undefined ? o : [on.x * W, 0, z];
    const s = crossing(base, from, dir, 0.6) ?? from;
    return { s, n: grad(base, s) };
  };
  const muscles = B.muscles.flatMap((m) => {
    const k = m.k ? { k: m.k * W } : {};
    if (m.cone || m.egg) return sides(m, { ...prim(m), id: m.id, ...k });
    const { s, n } = seat(m.on), r = tall(m.r, 0, Math.abs(unit(m.along)[2]), F.slope(m.on.t)).map((x) => x * W);
    const ax = frameOf(unit(m.along), n);
    return sides(m, { egg: true, c: add(s, scl(n, m.proud * W - r[2])), ax, r, id: m.id, ...k });
  });
  // masses another field owns and this one shares (the arm's deltoid heads: the shoulder's cap, so both shells agree)
  muscles.push(...extra.flatMap((p) => [p, mirror(p)]));
  const dimples = (B.dimples || []).flatMap((d) => { const { s } = seat(d.on); return [{ id: d.id, c: s, r: d.r * W, k: d.k * W }]; });
  // a mass with its own blend `k` (tighter: a border the eye reads, the pectoral's lower edge) joins after the rest
  const soft = muscles.filter((p) => !p.k), sharp = muscles.filter((p) => p.k);
  // THE BUST (`bust`): the summed skin pushed out by the breast's FIELD (breast-field.js: the footprint, the poles'
  // profiles, the cleft; gated on the field itself), the apex `t` up the torso bone and the field's cleft off the
  // midline, `rb` its radius (W). It rides on what is under it, the pectoral's slope its upper pole; the pair is the
  // greater of the two heights, so they meet in the field's own valley; on the front only
  const bustH = B.bust ? (() => {
    const Fb = { ...BREAST_FIELD, ...(B.bust.field || {}) }, rb = B.bust.rb * W, za = F.zOf(B.bust.t), cx = -Fb.cleft * rb, y0 = B.bust.front * W;
    return (q) => {
      const v = (q[2] - za) / rb, f = Math.max(0, Math.min(1, (q[1] - y0) / (0.2 * W))), fr = f * f * (3 - 2 * f); if (!fr) return 0;
      // (the pair's crossing a smooth max: the hard one creased the cleft's floor, and its rings boxed there)
      return fr * rb * smaxp(breastHeight((q[0] - cx) / rb, v, Fb), breastHeight((-q[0] - cx) / rb, v, Fb), 0.15);
    };
  })() : null;
  // THE SPINE'S CURVE (`spine`): the back's surface carried forward at the lumbar curve and back at the thoracic, by a
  // warp of the field over the back half only (the front, the belly and the chest, as built): each curve a bump at `t`
  // up the torso bone, `depth` in W (+ forward), `w` its half reach in t. The trunk stood as a straight column in profile
  const curve = (B.spine || []).map((c) => ({ z: F.zOf(c.t), h: (F.zOf(c.t + c.w) - F.zOf(c.t - c.w)) / 2, d: c.depth * W }));
  const warp = curve.length ? (q) => {
    const back = Math.max(0, Math.min(1, -q[1] / (0.3 * W))); if (!back) return q;
    let dy = 0; for (const c of curve) { const x = (q[2] - c.z) / c.h; if (Math.abs(x) < 1) dy += c.d * (1 - x * x) * (1 - x * x); }
    return [q[0], q[1] - dy * back * back * (3 - 2 * back), q[2]];
  } : (q) => q;
  const sd = (q0) => {
    const q = warp(q0);
    let d = lse([base(q), ...soft.map((p) => sdOf(p, q))], kM);
    for (const p of sharp) d = lse([d, sdOf(p, q)], p.k);
    if (bustH) d -= bustH(q);
    for (const h of dimples) d = smaxp(d, -(len(sub(q, h.c)) - h.r), h.k);
    return d;
  };
  // a field of some masses alone (by id): a part whose rings run inside another's (the neck's root in the torso) reads
  // only its own, or its rays catch the shoulder's
  const only = (ids) => { const sel = [...baseP, ...muscles].filter((p) => ids.includes(p.id)); return (q) => lse(sel.map((p) => sdOf(p, q)), kM); };
  return { build: B, frame: F, base, sd, only, masses: { base: baseP, muscles, dimples } };
}

/** the first crossing outward (inside → outside) of a field along a ray, within `reach` metres; null when none */
export function crossing(fn, o, dir, reach, step = 0.0015) {
  let t0 = 0, f0 = fn(o);
  if (f0 > 0) {   // the start outside: find the field first, then leave it
    for (let t = step; t <= reach; t += step) { if (fn(add(o, scl(dir, t))) <= 0) { t0 = t; f0 = -1; break; } }
    if (f0 > 0) return null;
  }
  for (let t = t0 + step; t <= reach; t += step) {
    if (fn(add(o, scl(dir, t))) > 0) {
      let a = t - step, b = t;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (fn(add(o, scl(dir, m))) > 0) b = m; else a = m; }
      return add(o, scl(dir, (a + b) / 2));
    }
  }
  return null;
}

/** a point carried onto a field's zero set down its gradient (Newton on the distance; steps capped) */
export function project(fn, p, iters = 24) {
  let q = p;
  for (let i = 0; i < iters; i++) {
    const d = fn(q); if (Math.abs(d) < 1e-6) break;
    const e = 1e-4, g = [fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))].map((x) => x / (2 * e));
    const gg = dot(g, g); if (gg < 1e-12) return null;
    const step = scl(g, -d / gg), l = len(step); q = add(q, l > 0.01 ? scl(step, 0.01 / l) : step);
  }
  return Math.abs(fn(q)) < 1e-4 ? q : null;
}

/** a ring of N slot names: the front, N/2 − 1 down the right, the back, and the left back to the front (midline parts
 * mirror right to left by name) */
export function ringSlots(N) {
  const h = N / 2, pad = (k) => String(k).padStart(2, '0');
  return ['front', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(k + 1)}R`), 'back', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(h - 1 - k)}L`)];
}

const mixW = (a, b, t) => {
  const w = {}; for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const v = r6((a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t); if (v > 0) w[k] = v; }
  const ks = Object.keys(w), big = ks.reduce((x, k) => (w[k] > w[x] ? k : x), ks[0]); w[big] = r6(1 - ks.filter((k) => k !== big).reduce((t2, k) => t2 + w[k], 0)); return w;
};
const stationId = (u) => (Number.isInteger(u) ? `st${u}` : `st${Math.floor(u)}_st${Math.ceil(u)}_${String(Math.round((u - Math.floor(u)) * 1000)).padStart(3, '0')}`);

/** a closed part re-sampled onto a field: `rings` stations over its authored u, `around` slots round each, each slot on
 * the ray from `origin(c)` (the ring's centre by default) through the authored cage's point there, at the field's first
 * crossing outward; `ease(u)` how far the field wins over the authored point (1 everywhere by default). The bind's
 * shares interpolated: per slot where the authored bind names slots, by station elsewhere; a HARD limb (`bind.zone`)
 * keeps its bone rigid, a joint's share easing in only within the zone of the joint's ring (the refine pass's rule) */
export function resamplePart(P, sd, { around, rings, origin = (c) => c, ease = () => 1, relax = 0, capsAlong = null, shrinkOutside = 0 } = {}) {
  // (stations without a `u` are at their index, as the compiler reads them)
  const st = P.stations.map((x, i) => ({ ...x, u: x.u ?? i })), SL = P.slots, n0 = SL.length, U = st[st.length - 1].u, b = P.bind, own = { [b.bone]: 1 };
  const centre = (s) => scl(SL.reduce((a, k) => add(a, s.points[k]), [0, 0, 0]), 1 / n0);
  const ptAt = (s, q) => { const f = q * n0, k = Math.floor(f) % n0, t = f - Math.floor(f); return add(scl(s.points[SL[k]], 1 - t), scl(s.points[SL[(k + 1) % n0]], t)); };
  const bracket = (u) => { let i = 0; while (i < st.length - 2 && st[i + 1].u < u) i++; const a = st[i], c = st[i + 1]; return [a, c, (u - a.u) / (c.u - a.u)]; };
  const cageAt = (u, q) => { const [a, c, t] = bracket(u); return add(scl(ptAt(a, q), 1 - t), scl(ptAt(c, q), t)); };
  const byId = Object.fromEntries(st.map((x) => [x.id, x]));
  const perSlot = Object.keys(b.blend || {}).some((k) => k.includes('.'));
  const shareAt = (sx, q) => (perSlot && b.blend[`${sx.id}.${SL[Math.round(q * n0) % n0]}`]) || b.blend?.[sx.id] || own;
  // a hard limb: the shares by the integer stations, eased within the zone of the joint's ring
  const atInt = (i) => b.blend?.[`st${i}`] ?? own, rigid = (w) => Object.keys(w).length === 1 && w[b.bone] === 1;
  const zoneShare = (u, c) => {
    const i0 = Math.floor(u), i1 = Math.ceil(u), lo = atInt(i0), hi = atInt(i1); if (i0 === i1) return lo;
    let t = u - i0; const loR = rigid(lo), hiR = rigid(hi);
    if (loR !== hiR) { const cj = centre(byId[`st${loR ? i1 : i0}`]), d = len(sub(c, cj)), x = Math.max(0, Math.min(1, 1 - d / b.zone)), sm = x * x * (3 - 2 * x); t = loR ? sm : 1 - sm; }
    return mixW(lo, hi, t);
  };
  const slots = ringSlots(around), blend = { ...(b.blend?.back ? { back: b.blend.back } : {}), ...(b.blend?.tip ? { tip: b.blend.tip } : {}) };
  const stations = [];
  for (let i = 0; i < rings; i++) {
    const u = r6((U * i) / (rings - 1)), [a, c2, t] = bracket(u), id = stationId(u);
    const c = add(scl(centre(a), 1 - t), scl(centre(c2), t)), o = origin(c), points = {}, e = ease(u);
    // a ring the field does not reach at all (`origin` finds no point of the skin to cast from: the thigh's top rings
    // above the hip's joint, inside the pelvis's skin) keeps the authored ring drawn in toward its centre by
    // `shrinkOutside`, ordered and hidden: cast onto the field from elsewhere, those rings folded back on one another
    const outside = shrinkOutside && !o;
    if (b.zone > 0) { const w = zoneShare(u, c); if (!rigid(w)) blend[id] = w; }
    slots.forEach((sl, j) => {
      const q = j / around, p0 = cageAt(u, q);
      if (outside) { points[sl] = add(c, scl(sub(p0, c), shrinkOutside)).map(r6); if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; } return; }
      const hit = crossing(sd, o, unit(sub(p0, o)), 2.5 * len(sub(p0, o)) + 0.05);
      // (a ray that finds no skin, the pelvis's lowest ring between the thighs, takes the nearest skin to the authored
      // point, not the authored point itself: those stood off the new skin in a jagged hem under the seat)
      const got = hit ?? project(sd, p0);
      points[sl] = (got ? add(scl(p0, 1 - e), scl(got, e)) : p0).map(r6);
      if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; }
    });
    stations.push({ id, u, points });
  }
  if (relax) relaxOnto(stations, slots, sd, relax, (i) => ease(stations[i].u) >= 1);
  // a limb's poles (`capsAlong`, the bone's direction): each end ring's centre carried a third of its radius on along
  // the bone, inside the neighbour's skin as the end ring is (an authored pole stood proud of the new skin, a tent on the
  // shoulder; one cast onto the field from a ring whose centre lay outside it stayed behind the ring and turned the fan)
  const caps = P.caps && capsAlong ? Object.fromEntries(Object.entries(P.caps).map(([k, q]) => {
    const ring = stations[k === 'back' ? 0 : stations.length - 1], pts = slots.map((sl) => ring.points[sl]);
    const c = scl(pts.reduce((a, x) => add(a, x), [0, 0, 0]), 1 / pts.length), rad = pts.reduce((a, x) => a + len(sub(x, c)), 0) / pts.length;
    return [k, add(c, scl(capsAlong, (k === 'back' ? -1 : 1) * rad / 3)).map(r6)];
  })) : P.caps;
  const { slotT: _t, ...rest } = P;
  return { ...rest, slots, stations, ...(caps ? { caps } : {}), bind: { ...b, blend } };
}
/** the sampled grid RELAXED onto the field: each inner point drawn toward its four neighbours' mean, then carried back
 * onto the skin down the field's gradient, `iters` times. Where a ring's rays crossed a pocket (the armpit's front, the
 * nape) they landed by turns on its two walls, in fins, or folded back on the ring below; the mean evens them and the
 * projection keeps the anatomy (a groove is the field's, so the points return into it). Only the rings the field owns
 * (`owned`): one eased toward the authored cage would be pulled off it */
function relaxOnto(stations, slots, sd, iters, owned = () => true, w = 0.5) {
  const n = slots.length;
  for (let it = 0; it < iters; it++) {
    const next = stations.map((s) => ({ ...s.points }));
    for (let i = 1; i < stations.length - 1; i++) if (owned(i)) slots.forEach((sl, j) => {
      const P0 = stations[i].points, nb = [P0[slots[(j + 1) % n]], P0[slots[(j + n - 1) % n]], stations[i - 1].points[sl], stations[i + 1].points[sl]];
      const m = scl(nb.reduce((a, q) => add(a, q), [0, 0, 0]), 0.25), p = add(scl(P0[sl], 1 - w), scl(m, w));
      next[i][sl] = (project(sd, p, 12) ?? p).map(r6);
    });
    stations.forEach((s, i) => { s.points = next[i]; });
  }
}

/** a right limb's part mirrored to the left: x negated, R ↔ L on the slots and the bones (the symmetry's contract) */
const swapRL = (k) => k.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
function mirrorPart(P, L) {
  const flip = (p) => [-p[0], p[1], p[2]], swapW = (w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [swapRL(k), v]));
  const blend = Object.fromEntries(Object.entries(P.bind.blend).map(([k, w]) => { const [s, sl] = k.split('.'); return [sl ? `${s}.${swapRL(sl)}` : s, swapW(w)]; }));
  return { ...L, slots: P.slots, stations: P.stations.map((s) => ({ ...s, points: Object.fromEntries(P.slots.map((sl) => [sl, flip(s.points[swapRL(sl)])])) })), ...(P.caps ? { caps: Object.fromEntries(Object.entries(P.caps).map(([k, q]) => [k, flip(q)])) } : {}), bind: { ...L.bind, blend } };
}

/** a limb's field for a build: its masses in the bone's frame (s along it from its head joint, az round it from the
 * front toward the outside, off from its axis; r along, round, out; all in W), summed with the build's `kLimb` */
export function limbField(R, build, limb, extra = []) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build, Lb = B.limbs[limb], F = bodyFrame(R, B), W = F.W, J = R.joints;
  const h = J[Lb.from], tl = J[Lb.to], ax = unit(sub(tl, h)), L = len(sub(tl, h));
  const fr = unit(sub([0, 1, 0], scl(ax, ax[1]))), out = unit(cross(ax, fr));
  const dirAt = (az) => add(scl(fr, dmath.cos((az * Math.PI) / 180)), scl(out, dmath.sin((az * Math.PI) / 180)));
  const at = (s, az = 0, off = 0) => add(add(h, scl(ax, s * L)), scl(dirAt(az), off * W));
  const prims = (Lb.thick ? thick(Lb.masses, Lb.thick) : Lb.masses).flatMap((m) => {
    // a CHAIN: round cones bead to bead, each bead [s, az, off, r] (a mass that spirals round the bone)
    if (m.chain) return m.chain.slice(1).map((b, i) => { const a = m.chain[i]; return { id: `${m.id}${i}`, cone: [at(a[0], a[1], a[2]), at(b[0], b[1], b[2])], r: [a[3] * W, b[3] * W] }; });
    if (m.cone) return { id: m.id, cone: [at(m.cone[0], m.az, m.off?.[0] ?? 0), at(m.cone[1], m.az, m.off?.[1] ?? 0)], r: m.r.map((x) => x * W) };
    const rad = dirAt(m.az ?? 0), tan = unit(cross(ax, rad));
    return { id: m.id, egg: true, c: at(m.s, m.az, m.off ?? 0), ax: [ax, tan, rad], r: m.r.map((x) => x * W) };
  });
  const all = [...prims, ...extra], k = B.kLimb * W;
  const sdOf = (p, q) => (p.cone ? sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]) : sdEgg(q, p));
  return { sd: (q) => lse(all.map((p) => sdOf(p, q)), k), prims };
}

/** the slice: the torso and the arms re-sampled onto the build's field (the torso `around` × `rings`, each limb
 * `limbAround` × its build's rings), the pectoral and bust parts gone (the field carries their form), the dials' station
 * blends extended by u. Returns { recipe, field, removed, landmarks, fields } (`landmarks`: the crotch's and the navel's
 * heights; `fields`: each re-sampled shell's signed distance,
 * its handovers' set-ins included, by part: what a seam's diagnosis reads) */
export function formSlice(recipe, R, build, opts = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  // the torso's density: the build's own (`cage`: a bust's fold wants finer rings), else 48 round by 37 rings
  const { around = 48, rings = 37, limbAround = 24 } = { ...B.cage, ...opts };
  // the limbs' fields first: the arm's deltoid heads are the shoulder's cap on the torso too, so the two shells agree
  const limbs = Object.fromEntries(Object.keys(B.limbs || {}).map((k) => [k, limbField(R, B, k)]));
  // THE DELTOID SHARED between the two shells and handed over along one cone round the trunk's axis (`clip`, rising
  // outward from above the armpit): above it the torso's skin shows (the shoulder's cap), below it the arm's. On the
  // torso the heads are cut under the cone (torso rays had slipped between the chest and the arm); the arm keeps them
  // all, set `tuck` inside above the cone (eased in over `band`), so its top ring and its cap sit under the torso's. Both
  // from the same masses, so the skins meet along the cone: the arm standing out of a smaller cap left a ledge on the
  // shoulder, the two on one surface z-fought in a sawtooth, and an arm cut away where the torso's field lay left it
  // hanging from a stalk. The torso's cut is sharp (`k`) and the arm's inset begins `gap` above it, so across the
  // handover only the arm's skin shows: two fades over one band crossed back and forth a few millimetres apart, a sawtooth
  const F0 = bodyFrame(R, B), W0 = F0.W, clip = { rho: 0.9 * W0 * F0.Sx, z: R.joints.shoulderR[2] - 0.6 * W0, slope: 1, k: 0.02 * W0 }, tuck = 0.003, band = 0.01, gap = 0.004;
  const ease = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
  // A LIMB'S TWO SEGMENTS share one field (both segments' masses, the knee's and the elbow's from each side) and hand over
  // by the plane through the joint square to the upper bone, the deltoid's pattern: past it the lower segment's skin
  // shows, the upper's set `tuck` inside; before it the reverse (each segment's own knee mass, of its own size, met the
  // other's in a step). One crossing at the plane: each fades in from it, so the two skins meet there only (two fades
  // begun `gap` either side of it left both on one skin between, and the elbow and the knee wore a line)
  const chain = (a, b, joint) => {
    if (!limbs[a] || !limbs[b]) return;
    const all = [...limbs[a].prims, ...limbs[b].prims], k = B.kLimb * W0, both = (q) => lse(all.map((p) => sdPrim(p, q)), k);
    const J = R.joints[joint], n = unit(sub(J, R.joints[B.limbs[a].from])), past = (q) => dot(sub(q, J), n);
    limbs[a].sd = (q) => both(q) + tuck * ease(past(q) / band);
    limbs[b].sd = (q) => both(q) + tuck * ease(-past(q) / band);
  };
  chain('upperArm', 'foreArm', B.limbs?.upperArm?.to); chain('thigh', 'shank', B.limbs?.thigh?.to);
  const shared = (limbs.upperArm?.prims || []).filter((p) => /^deltoid/.test(p.id)).map((p) => ({ ...p, clip }));
  // THE HIP'S HANDOVER, on one field and one level (`zp`, a little over the crotch, the skin's lowest point on the
  // midline): the pelvis samples the body's field carrying the thighs' masses whole, and about the level the thigh
  // samples the same field, cut at the midline (`hip`), easing back to its own masses over `bz` above the level and
  // down the femur. The pelvis ends at the crotch and is set `deep` inside under the level, the thigh over it, each
  // faded in from the level over `bp`, a ring or so: so the two skins meet at the level only, on one surface, and the
  // skin that shows either side of it is the field's (a thigh faded in slowly stayed within a mesh's error of the
  // pelvis's skin, and poked through it in spikes). Under the level the thighs take the seat's fold, the crotch and the
  // groin.
  // (A seam by which masses own the skin wandered where the thigh and the belly blend shallowly, in teeth; one by
  // height with a gap between the two fades left both on one skin, a sawtooth across the thigh's front; rings of the
  // pelvis under the crotch, cast from inside it, all left through its underside and folded in flaps)
  const ramp = (x) => Math.max(0, Math.min(1, x)), deep = 0.004, bz = 0.04, bp = 0.012;
  const pelvicB = B.base.some((m) => m.id === 'seatLobe');
  let pelvisSd = null, zp = null, crotch = null;
  if (pelvicB && limbs.thigh) {
    const th = limbs.thigh.sd, pf = bodyField(R, B, { extra: limbs.thigh.prims }).sd, zh = R.joints.hipR[2];
    crotch = zh;
    for (let y = -0.1; y <= 0.15; y += 0.01) for (let z = zh - 2 * W0; z < crotch; z += 0.002) if (pf([0, y, z]) < 0) { crotch = z; break; }
    zp = crotch + 0.005 + bp + 0.003;
    const hip = (q) => Math.max(pf(q), -q[0]), w = (z) => ramp((zp + bz - z) / bz) * ramp((z - zp + 0.14) / bz);
    pelvisSd = (q) => pf(q) + deep * ramp((zp - q[2]) / bp);
    limbs.thigh.sd = (q) => { const a = w(q[2]); return (a < 1 ? th(q) * (1 - a) : 0) + (a > 0 ? hip(q) * a : 0) + deep * ramp((q[2] - zp) / bp); };
  }
  const field = bodyField(R, B, { extra: shared }), r = structuredClone(recipe), P = r.parts.torso;
  const under = (q) => (clip.slope * (Math.hypot(q[0], q[1]) - clip.rho) - (q[2] - clip.z)) / Math.hypot(1, clip.slope);
  if (limbs.upperArm) { const arm = limbs.upperArm.sd; limbs.upperArm.sd = (q) => arm(q) + tuck * ease((-under(q) - gap) / band); }
  // the torso: above the chest the rays fan from one point on the trunk's axis (a ring's own radial line grazes the
  // shoulder's slope and the neck's root, where the authored rings tilt; rays from one origin never cross), and under
  // the navel, on a build without a seat, it lands on the authored pelvis's top, the field easing in from the waist's
  // first station
  const bottom = P.stations.find((s) => s.id === 'st1')?.u ?? 1, zFan = R.joints.shoulderR[2] - 0.35 * field.frame.W;
  // and round an undercut (`lift`: the fold under the bust) they come down from a point raised above the ring, so they
  // meet the underside face on (level rays left one ring on the bust's underside and the next on the chest's wall, and
  // the band between them shaded in a sawtooth)
  const Fr = field.frame, L = B.lift, raise = (z) => { if (!L) return 0; const x = Math.min(1, Math.abs(Fr.tOf(z) - L.t) / L.w); return L.h * Fr.W * (1 - x * x * (3 - 2 * x)); };
  // THE PELVIS on the field too (a build with a seat): the torso no longer eases onto the authored pelvis, and the two
  // hand over by height at the middle of their overlap (`zH`), in one crossing: below it the pelvis's skin shows (the
  // torso's set `deep` inside, faded in over `bz` from zH), above it the torso's
  const cz = (st, Pt) => Pt.slots.reduce((a, sl) => a + st.points[sl][2], 0) / Pt.slots.length;
  const pelvic = !!r.parts.pelvis && B.base.some((m) => m.id === 'seatLobe');
  const zH = pelvic ? (cz(P.stations[0], P) + cz(r.parts.pelvis.stations.at(-1), r.parts.pelvis)) / 2 : null;
  const handed = (sd, sign) => (q) => sd(q) + deep * ramp((sign * (zH - q[2])) / bz);
  r.parts.torso = resamplePart(P, pelvic ? handed(field.sd, 1) : field.sd, { around, rings, origin: (c) => (c[2] > zFan ? [c[0], c[1], zFan] : [c[0], c[1], c[2] + raise(c[2])]), ease: pelvic ? () => 1 : (u) => { const e = Math.min(1, u / (bottom || 1)); return e * e * (3 - 2 * e); }, relax: 4 });
  if (pelvic) {
    // its lowest station set on the crotch (`crotch`), wholly under the level. Its centre lies on the crotch's skin, so a
    // ring's rays cast from the first point inside straight above (`up`)
    const psd = handed(pelvisSd ?? field.sd, -1), P0 = structuredClone(r.parts.pelvis), s0 = P0.stations[0];
    if (crotch !== null) for (const k of P0.slots) s0.points[k] = [s0.points[k][0], s0.points[k][1], crotch + 0.005];
    const up = (c) => { if (psd(c) < 0) return c; for (let t = 0.002; t <= 0.12; t += 0.002) { const q = [c[0], c[1], c[2] + t]; if (psd(q) < -0.004) return q; } return c; };
    const Pp = r.parts.pelvis = resamplePart(P0, psd, { around, rings: B.pelvisRings ?? 33, origin: up, relax: 2 });
    // its lowest cap on the crotch's skin, over the lowest ring's centre (the authored pole hung a nub between the thighs)
    const ring = Pp.slots.map((k) => Pp.stations[0].points[k]), o = up(scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length));
    const hit = Pp.caps?.back && psd(o) < 0 ? crossing(psd, o, [0, 0, -1], 0.15) : null;
    if (hit) Pp.caps = { ...Pp.caps, back: [0, r6(hit[1]), r6(hit[2])] };
  }
  // the neck on its own masses of the same field (its column, the sternocleidomastoids, the trapezius's climb), so the
  // torso's top and the neck's root agree
  if (r.parts.neck) r.parts.neck = resamplePart(r.parts.neck, field.only(['neck', 'sternocleidomastoid', 'trapeziusUpper']), { around: 32, rings: 15, relax: 2 });
  // the midline exactly on it, the left the right's mirror (a midline part's contract)
  for (const T of [r.parts.torso, r.parts.neck, pelvic && r.parts.pelvis].filter(Boolean)) for (const s of T.stations) { s.points.front[0] = 0; s.points.back[0] = 0; for (const sl of T.slots) if (sl.endsWith('L')) { const p = s.points[`${sl.slice(0, -1)}R`]; s.points[sl] = [-p[0], p[1], p[2]]; } }
  // the limbs: the right one sampled on its field, the left its mirror
  const done = ['torso', 'neck', ...(pelvic ? ['pelvis'] : [])];
  // THE DELTOID RIDES THE ARM: a point's share of the upper arm's bone by how near it lies to the deltoid's heads (on
  // them, the arm's; `dBand` off them, none), read the same by the torso's cap and the arm's top under it, so the two
  // skins, one over the other at rest, move as one. The cap had been bound to the trunk and the collarbone, the arm's top
  // half to the collarbone: a raised arm swung up out from under its own deltoid, the cap left hanging at the side
  const delt = (limbs.upperArm?.prims || []).filter((p) => /^deltoid/.test(p.id)), dBand = 0.5 * W0;
  // (and none under the armpit: its folds, the pectoral's and the latissimus's, follow the arm, the flank under them
  // does not; a share by nearness alone carried the flank up in a web under a raised arm)
  // (and by how far down the humerus it lies, `down`: none above the joint, the deltoid's origin on the acromion and
  // the collarbone, which stays with the girdle; wholly from its belly down. The whole cap on the arm's bone swung its
  // top in and down about the joint and its side up, a trough over the collarbone and a hump over the arm)
  const sj = R.joints.shoulderR, armDir = unit(sub(R.joints.elbowR, sj)), zAx = sj[2];
  const sm = (v) => { const y = Math.max(0, Math.min(1, v)); return y * y * (3 - 2 * y); };
  // (over a band from a little above the joint to a hand's breadth down: one narrower folded the skin in a ring at the
  // joint's height when the arm swung fore and aft, the sprint's)
  const down = (q) => sm((dot(sub([Math.abs(q[0]), q[1], q[2]], sj), armDir) + 0.3 * W0) / (1.1 * W0));
  const deltoidShare = (q) => {
    const d = Math.min(...delt.map((p) => sdPrim(p, [Math.abs(q[0]), q[1], q[2]])));
    return sm(1 - Math.max(0, d) / dBand) * sm((q[2] - zAx + 1.1 * W0) / (0.6 * W0)) * down(q);
  };
  // (`ownArm`: the arm's own top, between the collarbone and the arm's bone by `down` alone, as the cap over it reads
  // it; the torso mixed toward the arm's bone by the deltoid's share)
  const rideDeltoid = (P, ownArm) => {
    if (!delt.length) return P;
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      if (p[0] === 0) return;
      const S = p[0] < 0 ? 'L' : 'R', arm = `upperArm${S}`;
      if (ownArm) { const f = down(p); if (f < 0.999) blend[key] = mixW({ [`clavicle${S}`]: 1 }, { [arm]: 1 }, f); return; }
      const f = deltoidShare(p); if (f < 1e-3) return;
      const w = mixW(blend[key] || fallback || own, { [arm]: 1 }, f);
      if (Object.keys(w).length <= 4) blend[key] = w;
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    return { ...P, bind: { ...b, blend } };
  };
  // THE GIRDLE RIDES THE COLLARBONE: the skin over the shoulder's girdle (the collarbone, the acromion, the trapezius's
  // fall to it, the scapula's top) bound to the collarbone's bone by its nearness to it (within `gIn`, wholly; `gOut`,
  // not at all), so a raised arm, which lifts the collarbone, levels the shoulder's top from the neck out to the arm.
  // The torso had given the collarbone half a share or less in one band of rings: the joint rose under a shoulder that
  // stayed down
  const c0 = R.joints.clavicleR, c1 = R.joints.shoulderR, gIn = 0.35 * W0, gOut = 0.8 * W0;
  const girdleShare = (q) => {
    if (!c0) return 0;
    const p = [Math.abs(q[0]), q[1], q[2]], ab = sub(c1, c0), t = Math.max(0, Math.min(1, dot(sub(p, c0), ab) / dot(ab, ab))), d = len(sub(p, add(c0, scl(ab, t))));
    // (none inside the collarbone's pivot, its sternal end: rising, the bone turns that side down, and the skin at the
    // neck's root split at the midline)
    // (and faded in over a wider run off the neck: the trapezius at the neck's root, carried by a swinging arm's
    // collarbone while the neck stood, opened a notch there)
    const x = Math.max(0, Math.min(1, (gOut - d) / (gOut - gIn))), m = Math.max(0, Math.min(1, (p[0] - c0[0] - 0.1 * W0) / (0.5 * W0)));
    return x * x * (3 - 2 * x) * m * m * (3 - 2 * m);
  };
  const rideGirdle = (P) => {
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    for (const st of P.stations) for (const sl of P.slots) {
      const p = st.points[sl]; if (p[0] === 0) continue;
      const f = girdleShare(p); if (f < 1e-3) continue;
      const key = `${st.id}.${sl}`, w0 = blend[key] || blend[st.id] || own, cl = `clavicle${p[0] < 0 ? 'L' : 'R'}`, cur = w0[cl] ?? 0;
      if (f <= cur) continue;
      const w = mixW(w0, { [cl]: 1 }, (f - cur) / (1 - cur));
      if (Object.keys(w).length <= 4) blend[key] = w;
    }
    return { ...P, bind: { ...b, blend } };
  };
  r.parts.torso = rideDeltoid(rideGirdle(r.parts.torso), false);
  // THE GROIN STRETCHES: a point's share of the thigh's bone by how far down the femur it lies (`downHip`: none at the
  // hip's joint, the groin, the crotch and the seat's fold staying with the pelvis; wholly a hand's breadth down), through
  // the hip's fold bone (the rig's helper turned half the leg's swing) in the middle, read the same by the pelvis and the
  // thigh's top, so the two stretch as one skin. The thigh's top had been the thigh's bone's from its first rings: an
  // opened leg swung its root away from the pelvis, a notch at the crotch and the seat's edge left as a shelf
  const hj = R.joints.hipR, femDir = unit(sub(R.joints.kneeR, hj)), fold = !!R.joints.hipFoldR;
  const downHip = (q) => sm((dot(sub([Math.abs(q[0]), q[1], q[2]], hj), femDir) - 0.05 * W0) / (0.55 * W0));
  const hipShare = (f, S) => (f <= 0 ? { pelvis: 1 } : !fold ? mixW({ pelvis: 1 }, { [`thigh${S}`]: 1 }, f) : f < 0.5 ? mixW({ pelvis: 1 }, { [`hipFold${S}`]: 1 }, 2 * f) : mixW({ [`hipFold${S}`]: 1 }, { [`thigh${S}`]: 1 }, 2 * f - 1));
  const rideHip = (P, all) => {
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      if (p[0] === 0) return;
      const f = downHip(p), w0 = blend[key] || fallback || own;
      if (f >= 0.999 || (!all && Object.keys(w0).some((k) => !/^(pelvis|lumbar)$/.test(k)))) return;
      // (the pelvis's own skin: its share mixed in by nearness to the leg, the trunk above the hip's crest its own)
      const w = all ? hipShare(f, p[0] < 0 ? 'L' : 'R') : mixW(w0, hipShare(f, p[0] < 0 ? 'L' : 'R'), sm((hj[2] - p[2] + 0.1 * W0) / (0.5 * W0)));
      if (Object.keys(w).length <= 4) blend[key] = w;
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    return { ...P, bind: { ...b, blend } };
  };
  if (pelvic && limbs.thigh) r.parts.pelvis = rideHip(r.parts.pelvis, false);
  // THE KNEE AND THE ELBOW BEND AS ONE SKIN: across a band either side of the joint (`hb`, along the lower bone), the
  // upper segment's and the lower's points alike take the upper bone, the fold's (the rig's helper turned half the bend)
  // and the lower bone by where they lie, so the two shells handed over at the joint's plane move together. Each had
  // been its own bone's nearly to the plane: bent deep (the sprint's knee), the thigh's end swung out from under the
  // shank's top behind the knee, a lobe with an edge
  const hingeBand = (P, joint, toward, upper, fold, lower, hb) => {
    const J0 = R.joints[`${joint}R`], dirL = unit(sub(R.joints[`${toward}R`], J0)), b = P.bind, blend = { ...(b.blend || {}) };
    const mine = new RegExp(`^(${upper}|${fold}|${lower})[RL]$`), own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      const t = dot(sub([Math.abs(p[0]), p[1], p[2]], J0), dirL); if (Math.abs(t) >= hb) return;
      const w0 = blend[key] || fallback || own; if (!Object.keys(w0).every((k) => mine.test(k))) return;
      const S = p[0] < 0 ? 'L' : 'R', f = sm((t + hb) / (2 * hb)), F = R.joints[`${fold}R`] ? `${fold}${S}` : null;
      blend[key] = !F ? mixW({ [`${upper}${S}`]: 1 }, { [`${lower}${S}`]: 1 }, f) : f < 0.5 ? mixW({ [`${upper}${S}`]: 1 }, { [F]: 1 }, 2 * f) : mixW({ [F]: 1 }, { [`${lower}${S}`]: 1 }, 2 * f - 1);
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    // (a hard limb's zone eases its station shares by the joint ring: the band's own shares stand per slot over it)
    return { ...P, bind: { ...b, blend } };
  };
  const HINGES = { thigh: ['knee', 'ankle', 'thigh', 'kneeFold', 'shank'], shank: ['knee', 'ankle', 'thigh', 'kneeFold', 'shank'], upperArm: ['elbow', 'wrist', 'upperArm', 'elbowFold', 'foreArm'], foreArm: ['elbow', 'wrist', 'upperArm', 'elbowFold', 'foreArm'] };
  for (const [limb, Lb] of Object.entries(B.limbs || {})) {
    const pr = `${limb}R`, pl = `${limb}L`; if (!r.parts[pr]) continue;
    // (each ring's rays from its centre, or where the field does not hold that, from the first point the field holds on
    // the way to the bone, a few millimetres in: the thigh's top rings are centred behind the hip's joint, outside the
    // leg's masses, and their rays found nothing to land on; from the bone itself, the joint at those rings' edge, they
    // wrapped the ring's far side backward)
    const a0 = R.joints[Lb.from], ab = sub(R.joints[Lb.to], a0), l2 = dot(ab, ab), lsd = limbs[limb].sd;
    const onBone = (c) => {
      if (lsd(c) < 0) return c;
      const bp = add(a0, scl(ab, Math.max(0, Math.min(1, dot(sub(c, a0), ab) / l2)))), d = sub(bp, c), L = len(d);
      for (let t = 0; t <= L; t += 0.002) { const q = add(c, scl(d, t / L)); if (lsd(q) < -0.004) return q; }
      return null;   // (the bone itself not in the skin: the thigh's top rings above the hip's joint)
    };
    r.parts[pr] = resamplePart(r.parts[pr], limbs[limb].sd, { around: Lb.around ?? limbAround, rings: Lb.rings, capsAlong: unit(ab), origin: onBone, shrinkOutside: 0.7 });
    if (limb === 'upperArm') r.parts[pr] = rideDeltoid(r.parts[pr], true);
    if (limb === 'thigh' && pelvic) r.parts[pr] = rideHip(r.parts[pr], true);
    if (HINGES[limb]) r.parts[pr] = hingeBand(r.parts[pr], ...HINGES[limb], 0.35 * W0);
    if (r.parts[pl]) r.parts[pl] = mirrorPart(r.parts[pr], r.parts[pl]);
    done.push(pr, pl);
  }
  const gone = Object.keys(r.parts).filter((k) => /^(pectoral|bust)[RL]$/.test(k));
  for (const k of gone) delete r.parts[k];
  for (const d of Object.values(r.dials || {})) {
    if (Array.isArray(d.parts)) d.parts = d.parts.filter((p) => !gone.includes(p));
    if (d.blend && d.parts?.some((p) => done.includes(p))) for (const pn of done) for (const s of r.parts[pn]?.stations || []) if (d.blend[s.id] === undefined) { const lo = d.blend[`st${Math.floor(s.u)}`] ?? 0, hi = d.blend[`st${Math.ceil(s.u)}`] ?? 0, t = s.u - Math.floor(s.u); d.blend[s.id] = r6(lo * (1 - t) + hi * t); }
  }
  return { recipe: r, field, removed: gone, landmarks: { crotch, navel: field.masses.dimples.find((d) => d.id === 'navel')?.c[2] ?? null }, fields: Object.fromEntries([['torso', pelvic ? handed(field.sd, 1) : field.sd], ...(pelvic ? [['pelvis', handed(pelvisSd ?? field.sd, -1)]] : []), ...Object.entries(limbs).map(([k, l]) => [k, l.sd])]) };
}
