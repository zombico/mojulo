/**
 * figure-musculature — the PARAMETRIC figure builder.
 *
 * Lifts the figure out of hardcoded "one regular human" into three separable,
 * data-driven specs that programmatically determine the output:
 *
 *   proportions — anthropometry. Landmark heights (fraction of total height,
 *                 0 = feet, 1 = crown) + half-widths. The canonical human is
 *                 ONE preset; tall/lean, stocky, child, heroic are just other
 *                 numbers. (Was the hardcoded STAND in figure-vajra.js.)
 *   musculature — muscle radii as RATIOS of their bone-segment length, so they
 *                 scale with the frame automatically (this is what frees it
 *                 from one body size), plus the twist field (the pose-torsion
 *                 of girdles + core spiral).
 *   pose        — (future) joint dof; first cut applies only the twist field.
 *
 * The skeleton is still figure-vajra.js: this module generates proportioned
 * landmark positions, then returns the bone vajra specs + the taiji muscle
 * specs that ride them — both consumable by the renderer / MCP. Muscle bellies
 * sit mid-segment (joints stay thin); girdles are single contralateral taijis;
 * the core is the two stacked spine vajras wrapped as one crossing helix.
 *
 * Design: lite-template/integration/0609/taiji-primitive.plan.md + the
 * figure-taiji exploration spikes.
 */

import { figureVajraSpecs } from './figure-vajra.js';

// ─── Proportions (the canonical human reproduces figure-vajra's STAND) ─
export const CANONICAL_PROPORTIONS = {
  heights: { ankle: 0.02, knee: 0.25, wrist: 0.45, hip: 0.47, elbow: 0.60, navel: 0.625, shoulder: 0.78, crown: 0.93 },
  widths: { shoulder: 0.13, hip: 0.10, elbow: 0.155, wrist: 0.195, knee: 0.10, ankle: 0.10 },
};

// Generate the 16 landmark positions from a proportions spec. With
// CANONICAL_PROPORTIONS this is byte-identical to figure-vajra's STAND.
export function buildSkeletonPositions(proportions = CANONICAL_PROPORTIONS) {
  const h = proportions.heights, w = proportions.widths;
  return {
    headTop: { x: 0, y: 0, z: h.crown },
    neckHub: { x: 0, y: 0, z: h.shoulder },     // neck base / heart
    navel: { x: 0, y: 0, z: h.navel },
    pelvisHub: { x: 0, y: 0, z: h.hip },         // groin
    shoulderL: { x: -w.shoulder, y: 0, z: h.shoulder },
    shoulderR: { x: w.shoulder, y: 0, z: h.shoulder },
    hipL: { x: -w.hip, y: 0, z: h.hip },
    hipR: { x: w.hip, y: 0, z: h.hip },
    elbowL: { x: -w.elbow, y: 0, z: h.elbow },
    elbowR: { x: w.elbow, y: 0, z: h.elbow },
    wristL: { x: -w.wrist, y: 0, z: h.wrist },
    wristR: { x: w.wrist, y: 0, z: h.wrist },
    kneeL: { x: -w.knee, y: 0, z: h.knee },
    kneeR: { x: w.knee, y: 0, z: h.knee },
    ankleL: { x: -w.ankle, y: 0, z: h.ankle },
    ankleR: { x: w.ankle, y: 0, z: h.ankle },
  };
}

// ─── Musculature (radii as ratios of bone length; twist field = pose) ──
// The canonical ratios reproduce the hand-tuned absolute radii from the
// figure-taiji spike at canonical proportions.
export const CANONICAL_MUSCULATURE = {
  ratios: {
    upperArm: 0.158, forearm: 0.131, thigh: 0.132, calf: 0.172,
    girdleShoulder: 0.385, girdleHip: 0.58, axis: 0.29,
  },
  // twist field: girdles + core spiral take contrapposto signs (shoulder +,
  // hip −, sign-flip at the navel); limbs mirror L/R.
  twists: {
    shoulder: 0.5, hip: -0.5, axisUp: 0.5, axisLo: -0.5,
    upperArm: 0.8, forearm: 1.4, thigh: 0.6, calf: 0.9,
  },
};

// Limb segments: belly mid-bone, thin at the joints. side sign mirrors twist.
const LIMB_SEGS = [
  { a: 'shoulderL', b: 'elbowL', ratio: 'upperArm', tw: 'upperArm', sign: 1 },
  { a: 'elbowL', b: 'wristL', ratio: 'forearm', tw: 'forearm', sign: 1 },
  { a: 'shoulderR', b: 'elbowR', ratio: 'upperArm', tw: 'upperArm', sign: -1 },
  { a: 'elbowR', b: 'wristR', ratio: 'forearm', tw: 'forearm', sign: -1 },
  { a: 'hipL', b: 'kneeL', ratio: 'thigh', tw: 'thigh', sign: 1 },
  { a: 'kneeL', b: 'ankleL', ratio: 'calf', tw: 'calf', sign: 1 },
  { a: 'hipR', b: 'kneeR', ratio: 'thigh', tw: 'thigh', sign: -1 },
  { a: 'kneeR', b: 'ankleR', ratio: 'calf', tw: 'calf', sign: -1 },
];

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }

/**
 * Build a figure's bone + muscle specs from proportions + musculature (+ an
 * optional pose twist-field override). Points are in STAND-like units; the
 * caller scales/projects (or converts to a manji-tree manifest).
 *
 * Returns:
 *   positions — the 16 landmarks.
 *   bones     — figureVajraSpecs (the vajra skeleton, scapular offset honored).
 *   muscles   — [{ type, yin, center?, yang, radius, twist, profile, envelope }]:
 *               type 'segment' (limb belly), 'girdle' (contralateral X),
 *               'axis' (core spiral half). Radius is ratio × bone length, so
 *               it scales with the proportions automatically.
 */
export function buildFigureSpecs({ proportions = CANONICAL_PROPORTIONS, musculature = CANONICAL_MUSCULATURE, pose } = {}) {
  const pos = buildSkeletonPositions(proportions);
  const { ratios } = musculature;
  const twists = { ...musculature.twists, ...(pose && pose.twists ? pose.twists : {}) };
  const muscles = [];

  // limb bellies — spindle, thin at joints
  for (const s of LIMB_SEGS) {
    muscles.push({
      type: 'segment', yin: pos[s.a], yang: pos[s.b],
      radius: ratios[s.ratio] * dist(pos[s.a], pos[s.b]),
      twist: s.sign * twists[s.tw], profile: 'spindle', envelope: true,
    });
  }
  // girdles — contralateral taijis, capsule (mass at the poles, thin centers)
  muscles.push({
    type: 'girdle', yin: pos.shoulderL, center: pos.neckHub, yang: pos.shoulderR,
    radius: ratios.girdleShoulder * dist(pos.shoulderL, pos.neckHub),
    twist: twists.shoulder, profile: 'capsule', envelope: true,
  });
  muscles.push({
    type: 'girdle', yin: pos.hipL, center: pos.pelvisHub, yang: pos.hipR,
    radius: ratios.girdleHip * dist(pos.hipL, pos.pelvisHub),
    twist: twists.hip, profile: 'capsule', envelope: true,
  });
  // core spiral — two stacked vajras, crossing at heart + navel, sign-flip at waist
  const axisR = ratios.axis * dist(pos.neckHub, pos.pelvisHub);
  muscles.push({ type: 'axis', yin: pos.headTop, center: pos.neckHub, yang: pos.navel, radius: axisR, twist: twists.axisUp, profile: 'capsule', envelope: false });
  muscles.push({ type: 'axis', yin: pos.neckHub, center: pos.navel, yang: pos.pelvisHub, radius: axisR, twist: twists.axisLo, profile: 'capsule', envelope: false });

  return { positions: pos, bones: figureVajraSpecs(pos), muscles };
}
