/**
 * figure-animal — the 'animal-realm' concern: the canonical vajra figure WARPED to
 * fit other bodies, starting with quadrupeds.
 *
 * This works at the MANJI / VAJRA layer only — the joint graph and the vajra
 * ring-form, NOT the humanoid protoform flesh (an animal will not wear the human
 * fleshform). It produces a reoriented ARMATURE; the same `figureJointGraph` /
 * `figureVajraSpecs` (figure-vajra.js) that read the upright figure read this one.
 *
 * The thesis: a quadruped is the human armature with ONE move — the spine
 * reoriented from vertical to horizontal. The four limb vajras already carry the
 * right curves (two arms + two legs → four legs); we only re-aim them at the
 * ground and re-place the head/neck vajra off the FRONT of the now-horizontal
 * spine. No new primitives — just new landmark positions over the locked node set.
 *
 * Units are figure-frame STAND units (the renderer owns scale); ground is z = 0.
 * Later: broaden the same reorientation to bodies that crawl / slither / swim.
 */
import { normalize3, sub3, cross3, FIGURE_RADII } from './figure-vajra.js';

// Generic mid-size quadruped (a dog-ish body plan). All STAND units; ground z = 0.
// Leg joint heights are FRACTIONS of backHeight, so leg length scales with stature
// (a tall equine gets long legs from one knob); the fore/aft offsets (the joint
// bend) stay absolute. Girth multipliers re-radius the canonical nodes by region.
export const QUADRUPED_DEFAULT = {
  backHeight: 0.40,     // girdle / topline height above the ground
  trunkLength: 0.46,    // hips (rear) → shoulders (front) along +y; > rest 0.31 → a barrel
  backArch: 0.018,      // gentle topline rise at the mid-back (the loin)
  spineTilt: 0,         // rock the whole front of the body up about the hips (deg) —
                        //   hind legs stay planted → a rearing / upright stance (the bear)
  hipHalf: 0.085,       // rear track half-width
  shoulderHalf: 0.098,  // front track half-width
  neckLength: 0.25,     // neck reach off the front of the spine
  neckAngle: 36,        // neck rise above horizontal (deg) — head carried up & forward
  headPitch: -14,       // muzzle drop off the neck line (deg)
  headLength: 0.10,
  // leg joint heights as a fraction of backHeight (ground = 0, girdle = 1):
  foreKneeFrac: 0.52, foreFootFrac: 0.21,
  hindKneeFrac: 0.51, hindFootFrac: 0.14,
  // joint fore/aft bend (STAND) — the stance, not a straight post:
  foreKneeBack: 0.045, foreFootFwd: 0.02, hindKneeFwd: 0.05, hindFootBack: 0.025,
  // fore-limb mode: 'ground' (quadruped — drops to the floor) or 'tuck' (BIPED — a
  // small raised arm near the chest, NOT weight-bearing; the hind legs alone carry
  // the body). Theropods tuck. Offsets are off the shoulder (forward +y, down -z).
  // fore-limb mode: 'ground' (quadruped — drops to the floor), 'tuck' (biped — a
  // small raised arm near the chest), or 'wing' (AVIAN — the forelimb spreads out as
  // the wing skeleton: humerus + forearm + hand, the theropod→bird transition). The
  // wing SURFACE (a flat feathered membrane) is a separate primitive the round vajra
  // can't carry — see the plan.
  foreMode: 'ground',
  tuckElbowFwd: 0.05, tuckElbowDrop: 0.12, tuckWristFwd: 0.12, tuckWristDrop: 0.17,
  // wing skeleton — elbow off the shoulder, wrist (wingtip) off the elbow. `Out` is
  // lateral (±x), `Back` is +y→fwd / −y→aft, `Rise` is ±z. Folded defaults (tucked
  // along the flank); a spread wing raises Out and drops Back→0.
  wingElbowOut: 0.03, wingElbowBack: -0.05, wingElbowRise: -0.02,
  wingWristOut: 0.0, wingWristBack: -0.15, wingWristRise: -0.03,
  // girth (radius) multipliers on the canonical node radii, by region:
  girthBody: 1,         // spine hubs (neck/navel/pelvis)
  girthFore: 1,         // shoulder cap + fore-limb bones
  girthHind: 1,         // hip cap + hind-limb bones
  girthHead: 1,         // head nodes
};

const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
// Rotate a STAND vector about world-x (the EW / sagittal axis) by deg.
function rotEW(d, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: d.x, y: d.y * c - d.z * s, z: d.y * s + d.z * c };
}

/**
 * Build the reoriented quadruped armature in STAND space: the spine laid
 * HORIZONTAL along +y (hips at the rear, shoulder girdle at the front), the
 * head/neck projecting forward-and-up off the front, and all four limbs dropped
 * to the ground. Node identities match FIGURE_NODES, so `figureJointGraph` /
 * `figureVajraSpecs` render this exactly as they render the upright figure.
 * @param {object} [cfg] proportion knobs (QUADRUPED_DEFAULT)
 * @returns {Object<string,{x,y,z}>} the armature node positions
 */
export function quadrupedNodes(cfg = {}) {
  const c = { ...QUADRUPED_DEFAULT, ...cfg };
  const H = c.backHeight, T = c.trunkLength;
  const q = {};
  // ── spine beam (rear → front), with a gentle loin arch at the mid-back ──
  q.pelvisHub = v(0, 0, H);
  q.navel     = v(0, T * 0.45, H + c.backArch);
  q.neckHub   = v(0, T, H);
  // ── neck + head, forward and up off the front of the spine ──
  const neckDir = rotEW(v(0, 1, 0), c.neckAngle);                 // +y rotated up by neckAngle
  q.headBase = add(q.neckHub, mul(neckDir, c.neckLength));
  const headDir = rotEW(neckDir, c.headPitch);                    // muzzle drops off the neck line
  q.headTop = add(q.headBase, mul(headDir, c.headLength));
  // ── girdles (the limb roots) sit on the spine ends; limbs drop to the ground ──
  for (const [s, sgn] of [['L', -1], ['R', 1]]) {
    q['hip' + s]      = v(sgn * c.hipHalf, 0, H);
    q['shoulder' + s] = v(sgn * c.shoulderHalf, T, H);
    // hind leg: hip → knee (stifle forward) → ankle (hock back), to the ground
    q['knee' + s]  = v(sgn * c.hipHalf, c.hindKneeFwd, H * c.hindKneeFrac);
    q['ankle' + s] = v(sgn * c.hipHalf, -c.hindFootBack, H * c.hindFootFrac);
    if (c.foreMode === 'tuck') {
      // biped: a small raised arm held near the chest (forward + down off the shoulder)
      q['elbow' + s] = v(sgn * c.shoulderHalf, T + c.tuckElbowFwd, H - c.tuckElbowDrop);
      q['wrist' + s] = v(sgn * c.shoulderHalf, T + c.tuckWristFwd, H - c.tuckWristDrop);
    } else if (c.foreMode === 'wing') {
      // avian: the wing skeleton — elbow out off the shoulder, wingtip (wrist) off the elbow
      const el = v(sgn * (c.shoulderHalf + c.wingElbowOut), T + c.wingElbowBack, H + c.wingElbowRise);
      q['elbow' + s] = el;
      q['wrist' + s] = v(el.x + sgn * c.wingWristOut, el.y + c.wingWristBack, el.z + c.wingWristRise);
    } else {
      // fore leg: shoulder → elbow (carpus back) → wrist (foot forward), to the ground
      q['elbow' + s] = v(sgn * c.shoulderHalf, T - c.foreKneeBack, H * c.foreKneeFrac);
      q['wrist' + s] = v(sgn * c.shoulderHalf, T + c.foreFootFwd, H * c.foreFootFrac);
    }
  }
  // spineTilt — rock the front of the body up about the hips (a rear / upright stance):
  // rotate the trunk-front, head, and fore-limbs about pelvisHub; the grounded hind
  // legs + the tail root stay put, so the bear stands up while its feet stay planted.
  if (c.spineTilt) {
    const pivot = q.pelvisHub;
    const tiltPt = (p) => add(pivot, rotEW(sub3(p, pivot), c.spineTilt));
    for (const k of ['navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR']) q[k] = tiltPt(q[k]);
  }
  return q;
}

// ─── Per-region girth → a radii map for the vajra reads ─────────────────
// Scales the canonical FIGURE_RADII by the cfg's girth multipliers, by region, so
// `figureVajraSpecs(nodes, radii)` / `figureJointGraph(nodes, radii)` render a
// stocky or a slender build off the same armature. Nodes not in a group keep base.
const GIRTH_GROUPS = {
  girthBody: ['neckHub', 'navel', 'pelvisHub'],
  girthFore: ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR'],
  girthHind: ['hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'],
  girthHead: ['headTop', 'headBase'],
};
export function quadrupedRadii(cfg = {}) {
  const c = { ...QUADRUPED_DEFAULT, ...cfg };
  const r = { ...FIGURE_RADII };
  for (const [knob, keys] of Object.entries(GIRTH_GROUPS)) for (const k of keys) r[k] = FIGURE_RADII[k] * c[knob];
  return r;
}

// ─── Archetypes — proportion presets over the shared knobs ──────────────
// Cursorial (straight-legged) quadrupeds along three axes: stature / leg-length,
// body bulk (girth), and fore↔hind balance. Each entry is a partial cfg over
// QUADRUPED_DEFAULT plus an optional `tail` override. Presets, not hardcoded
// shapes — blend or interpolate them later for in-between builds.
export const QUADRUPED_ARCHETYPES = {
  // rats / mice / squirrels / hamsters — small, hunched, BIG hindquarters, short
  // neck, big head, short front paws. ('long rats' like meerkats: raise trunkLength.)
  rodent: {
    backHeight: 0.30, trunkLength: 0.40, backArch: 0.045, hipHalf: 0.10, shoulderHalf: 0.075,
    neckLength: 0.11, neckAngle: 52, headPitch: -6, headLength: 0.105,
    foreKneeFrac: 0.50, foreFootFrac: 0.12, hindKneeFrac: 0.56, hindFootFrac: 0.10,
    // gentle single-direction bend (no fore/aft reversal) so the thin limb vajra bridges
    foreKneeBack: 0.022, foreFootFwd: 0.0, hindKneeFwd: 0.04, hindFootBack: 0.0,
    girthBody: 1.15, girthFore: 0.9, girthHind: 1.5, girthHead: 1.25,
    tail: { length: 0.55, droop: 6, rootR: 0.020, tipR: 0.006, waveAmp: 0.05, waveN: 0.7 },
  },
  // dogs / wolves — the balanced walker: medium legs, deep chest, even fore/hind.
  canine: {
    backHeight: 0.42, trunkLength: 0.50, backArch: 0.015, hipHalf: 0.085, shoulderHalf: 0.095,
    neckLength: 0.20, neckAngle: 40, headPitch: -16, headLength: 0.11,
    girthBody: 1.05, girthFore: 1.0, girthHind: 1.0, girthHead: 0.95,
    tail: { length: 0.5, droop: 24, rootR: 0.026, tipR: 0.008 },
  },
  // cats / big cats — feline sibling of canine: lower, suppler, smaller head,
  // longer tail, slightly leaner.
  feline: {
    backHeight: 0.38, trunkLength: 0.47, backArch: 0.02, hipHalf: 0.082, shoulderHalf: 0.088,
    neckLength: 0.15, neckAngle: 30, headPitch: -10, headLength: 0.095,
    foreKneeFrac: 0.50, hindKneeFrac: 0.50,
    girthBody: 0.95, girthFore: 0.92, girthHind: 0.98, girthHead: 0.82,
    tail: { length: 0.62, droop: 10, rootR: 0.020, tipR: 0.007, waveAmp: 0.05, waveN: 0.8 },
  },
  // rhino / elephant / hippo — STUMPY: heavy barrel, wide track, short thick pillar
  // legs (near-straight = stable), big head, short low neck.
  stumpy: {
    backHeight: 0.44, trunkLength: 0.56, backArch: 0.01, hipHalf: 0.125, shoulderHalf: 0.13,
    neckLength: 0.11, neckAngle: 18, headPitch: -8, headLength: 0.12,
    foreKneeFrac: 0.55, foreFootFrac: 0.16, hindKneeFrac: 0.55, hindFootFrac: 0.12,
    foreKneeBack: 0.02, foreFootFwd: 0.01, hindKneeFwd: 0.02, hindFootBack: 0.01,   // pillar legs
    girthBody: 1.7, girthFore: 1.7, girthHind: 1.7, girthHead: 1.45,
    tail: { length: 0.34, droop: 30, rootR: 0.018, tipR: 0.006, waveAmp: 0.02 },
  },
  // horses — long straight legs, long neck, level back, long head; built for gallop.
  equine: {
    backHeight: 0.58, trunkLength: 0.52, backArch: 0.008, hipHalf: 0.085, shoulderHalf: 0.09,
    neckLength: 0.30, neckAngle: 38, headPitch: -26, headLength: 0.14,
    foreKneeFrac: 0.54, foreFootFrac: 0.10, hindKneeFrac: 0.52, hindFootFrac: 0.08,
    foreKneeBack: 0.03, hindKneeFwd: 0.04,
    girthBody: 1.05, girthFore: 0.85, girthHind: 0.92, girthHead: 0.85,
    tail: { length: 0.5, droop: 34, rootR: 0.022, tipR: 0.01, wavePlane: 'vertical', waveAmp: 0.04 },
  },
  // gazelle / deer — slender hopper: long THIN legs, light body, alert upright neck,
  // small head, more leg bend (spring).
  gazelle: {
    backHeight: 0.55, trunkLength: 0.42, backArch: 0.02, hipHalf: 0.07, shoulderHalf: 0.072,
    neckLength: 0.26, neckAngle: 46, headPitch: -18, headLength: 0.10,
    foreKneeFrac: 0.50, foreFootFrac: 0.09, hindKneeFrac: 0.48, hindFootFrac: 0.08,
    // near-straight cursorial legs (no fore/aft reversal) so the slender limb vajra bridges
    foreKneeBack: 0.02, foreFootFwd: 0.0, hindKneeFwd: 0.03, hindFootBack: 0.0,
    girthBody: 0.82, girthFore: 0.80, girthHind: 0.84, girthHead: 0.78,
    tail: { length: 0.22, droop: 20, rootR: 0.014, tipR: 0.005, waveAmp: 0.02 },
  },
  // sauropods (diplodocus / brachiosaurus / apatosaurus) — a STUMPY derivative:
  // graviportal (heavy barrel, wide track, straight pillar legs) but 'leg-weighted'
  // (taller stance, more ground clearance) and defined by two long CHAIN appendages
  // — a long neck and a long heavy tail — with a tiny head. The built-in head triple
  // is collapsed to a nub at the neck hub; the neck CHAIN carries the real reach.
  sauropod: {
    backHeight: 0.52, trunkLength: 0.64, backArch: 0.02, hipHalf: 0.13, shoulderHalf: 0.125,
    neckLength: 0.05, neckAngle: 40, headPitch: 0, headLength: 0.045,   // collapsed nub — chain carries the neck
    foreKneeFrac: 0.56, foreFootFrac: 0.10, hindKneeFrac: 0.56, hindFootFrac: 0.08,
    foreKneeBack: 0.015, foreFootFwd: 0.0, hindKneeFwd: 0.015, hindFootBack: 0.0,   // straight pillars
    girthBody: 1.8, girthFore: 1.55, girthHind: 1.7, girthHead: 0.7,
    neck: { length: 0.72, droop: 34, rootR: 0.034, tipR: 0.012, segments: 22, waveAmp: 0.04, waveN: 0.6, wavePlane: 'vertical' },
    tail: { length: 0.9, droop: 12, rootR: 0.030, tipR: 0.005, segments: 26, waveAmp: 0.05, waveN: 0.8, wavePlane: 'lateral' },
  },
  // large theropod (T. rex / allosaur) — BIPEDAL: a deep body balanced over the hips
  // on two strong bent hind legs, the trunk cantilevered forward and a long heavy
  // TAIL cantilevered back as the counterweight; tiny tucked forelimbs; a short thick
  // neck carrying a big head (short neckChain, large tipR).
  theropod: {
    backHeight: 0.52, trunkLength: 0.40, backArch: 0.012, hipHalf: 0.10, shoulderHalf: 0.10,
    neckLength: 0.05, neckAngle: 30, headLength: 0.045,           // collapsed nub — neckChain carries the head
    foreMode: 'tuck', tuckElbowFwd: 0.04, tuckElbowDrop: 0.10, tuckWristFwd: 0.09, tuckWristDrop: 0.14,
    hindKneeFrac: 0.58, hindFootFrac: 0.06, hindKneeFwd: 0.07, hindFootBack: 0.0,   // strong bent legs, foot under
    girthBody: 1.35, girthFore: 0.55, girthHind: 1.5, girthHead: 0.9,
    neck: { length: 0.26, droop: 30, rootR: 0.034, tipR: 0.026, segments: 14, waveAmp: 0.03, waveN: 0.7, wavePlane: 'vertical' },
    tail: { length: 0.8, droop: 6, rootR: 0.034, tipR: 0.006, segments: 24, waveAmp: 0.05, waveN: 0.7, wavePlane: 'lateral' },
  },
  // raptor (velociraptor / deinonychus) — small agile biped: lighter body, longer
  // grasping forelimbs (still tucked), a horizontal S-neck with a small head, and a
  // long STIFF tail held out for balance (low waveAmp).
  raptor: {
    backHeight: 0.42, trunkLength: 0.34, backArch: 0.015, hipHalf: 0.072, shoulderHalf: 0.072,
    neckLength: 0.05, neckAngle: 34, headLength: 0.04,
    foreMode: 'tuck', tuckElbowFwd: 0.07, tuckElbowDrop: 0.10, tuckWristFwd: 0.15, tuckWristDrop: 0.13,
    hindKneeFrac: 0.56, hindFootFrac: 0.06, hindKneeFwd: 0.06, hindFootBack: 0.0,
    girthBody: 0.92, girthFore: 0.6, girthHind: 1.05, girthHead: 0.7,
    neck: { length: 0.26, droop: 42, rootR: 0.024, tipR: 0.012, segments: 16, waveAmp: 0.05, waveN: 0.8, wavePlane: 'vertical' },
    tail: { length: 0.62, droop: 2, rootR: 0.022, tipR: 0.006, segments: 22, waveAmp: 0.015, waveN: 0.5, wavePlane: 'lateral' },
  },
  // avian (bird) — the theropod carried to its descendants: a compact biped on
  // strong digitigrade legs, the forelimbs now WINGS (foreMode 'wing', folded along
  // the flank by default), an S-curved neck with a small beaked head, and a short
  // broad tail (the feather fan). Wings can be spread by raising the wing*Out knobs.
  avian: {
    backHeight: 0.40, trunkLength: 0.30, backArch: 0.02, hipHalf: 0.058, shoulderHalf: 0.07,
    neckLength: 0.05, neckAngle: 42, headLength: 0.038,
    foreMode: 'wing',                                       // folded-wing defaults
    wingElbowOut: 0.03, wingElbowBack: -0.06, wingElbowRise: -0.02,
    wingWristOut: 0.0, wingWristBack: -0.17, wingWristRise: -0.04,
    hindKneeFrac: 0.54, hindFootFrac: 0.05, hindKneeFwd: 0.06, hindFootBack: 0.0,
    girthBody: 1.0, girthFore: 0.5, girthHind: 0.82, girthHead: 0.6,
    neck: { length: 0.30, droop: 52, rootR: 0.022, tipR: 0.009, segments: 16, waveAmp: 0.07, waveN: 1.0, wavePlane: 'vertical' },   // S-neck
    tail: { length: 0.28, droop: 4, rootR: 0.024, tipR: 0.014, segments: 12, waveAmp: 0.02, waveN: 0.5 },                            // short fan
  },
  // ursine (bear) — a heavy plantigrade quadruped: bulky barrel, robust limbs (both
  // fore and hind, slightly forequarter-heavy for the shoulder mass), big head on a
  // short thick neck (the built-in head triple, no neckChain), and a stub tail. It
  // also REARS — see URSINE_REAR, which reuses the theropod biped primitives.
  ursine: {
    backHeight: 0.42, trunkLength: 0.52, backArch: 0.028, hipHalf: 0.108, shoulderHalf: 0.118,
    neckLength: 0.13, neckAngle: 24, headPitch: -12, headLength: 0.125,
    foreKneeFrac: 0.54, foreFootFrac: 0.12, hindKneeFrac: 0.52, hindFootFrac: 0.10,
    foreKneeBack: 0.022, foreFootFwd: 0.0, hindKneeFwd: 0.03, hindFootBack: 0.0,   // near-straight, no reversal (plantigrade)
    girthBody: 1.45, girthFore: 1.5, girthHind: 1.42, girthHead: 1.2,
    tail: { length: 0.12, droop: 30, rootR: 0.016, tipR: 0.006, segments: 8, waveAmp: 0.008 },   // stub tail
  },
};

// A rearing-bear override (cfg patch): rock the body upright on the hind legs
// (spineTilt) and raise the forepaws to the chest (foreMode 'tuck' — the theropod
// biped primitive). The hind legs stay planted; the bear stands.
export const URSINE_REAR = {
  spineTilt: 60,
  foreMode: 'tuck', tuckElbowFwd: 0.04, tuckElbowDrop: 0.07, tuckWristFwd: 0.10, tuckWristDrop: 0.05,
  hindKneeFwd: 0.02,
};

// A wings-spread override of an archetype (cfg patch) — opens the folded wing out to
// the side for a frontal/top read (the wing skeleton extended).
export const WINGS_SPREAD = {
  wingElbowOut: 0.13, wingElbowBack: 0.0, wingElbowRise: 0.03,
  wingWristOut: 0.20, wingWristBack: -0.04, wingWristRise: 0.0,
};
export const QUADRUPED_ARCHETYPE_NAMES = Object.keys(QUADRUPED_ARCHETYPES);

/**
 * Resolve an archetype name (or a raw cfg) into a full build:
 *   { cfg, nodes, radii, tailCfg } — everything the reads need.
 * @param {string|object} archetype  a QUADRUPED_ARCHETYPES key, or a partial cfg
 */
export function quadrupedArmature(archetype = {}) {
  const preset = typeof archetype === 'string' ? (QUADRUPED_ARCHETYPES[archetype] || {}) : archetype;
  const { tail: tailCfg = {}, neck: neckCfg = null, ...cfg } = preset;
  return { cfg, nodes: quadrupedNodes(cfg), radii: quadrupedRadii(cfg), tailCfg, neckCfg };
}

// ─── Chain appendage — the topology extension (tail AND neck) ───────────
// A single vajra triple can only bow once, so a long appendage can't be ONE vajra
// and still hold a sine wave. Instead it's a tapering swept-vajra CHAIN whose base
// centerline is anchored by THREE control points — CORE, ROOT, tip — as a
// Catmull-Rom. Using the core as the point BEFORE the root makes the curve leave
// the root tangent to the spine line (C1 continuity: no kink at the join). The
// sine/cosine then DISPLACES each sample ⟂ to the curve, amplitude enveloped 0→1
// root→tip so the root stays welded and the tip swings most. Advance `phase` → a
// wave travels down the chain.
//
// ONE primitive, two uses (the sauropod forcing function): the TAIL roots at the
// pelvis (core = navel, behind), the NECK roots at the neck hub (core = navel,
// projecting forward-up). Same machinery also serves an elephant trunk, a giraffe
// neck, and — limbs dropped, length up — the slither/swim spine.
export const CHAIN_DEFAULT = {
  coreKey: 'navel',     // the spine node BEFORE the root (sets the tangent → C1 join)
  rootKey: 'pelvisHub', // where the chain attaches (pelvisHub = tail, neckHub = neck)
  length: 0.55,         // chain reach off the root (STAND)
  droop: 16,            // tilt of the base line off the spine continuation (deg; sign
                        //   reads as down for a tail, up for a forward neck — the base
                        //   directions are opposite, so + lifts the neck / drops the tail)
  rootR: 0.032,         // radius at the root (~ the hub it joins, so it merges)
  tipR: 0.009,          // radius at the tip (taper)
  segments: 20,         // rings sampled along the chain
  around: 18,           // points per ring
  // sine/cosine articulation
  waveAmp: 0.06,        // peak ⟂ displacement (STAND) at the tip
  waveN: 0.85,          // number of sine periods along the chain (<1 = a single C/S bow)
  wavePhase: 0,         // radians; advance over time → a traveling wave
  wavePlane: 'lateral', // 'lateral' = sway in x (wag / swim) · 'vertical' = undulate in z
  waveEnvPow: 1,        // amplitude envelope exponent (1 = linear root→tip)
};

const catmull3 = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
};

/**
 * Build a chain appendage off a body armature in STAND space. Returns everything
 * the three reads need: ring polylines (wave / world mesh), plus manji joint
 * spheres + links.
 * @param {Object<string,{x,y,z}>} nodes  body armature (needs the core + root nodes)
 * @param {object} [cfg]  chain knobs (CHAIN_DEFAULT) — incl. coreKey / rootKey
 * @param {number} [phase] wave phase in radians (0 = the resting pose; sweep to animate)
 * @returns {{rings:{x,y,z}[][], centers:{x,y,z}[], spheres:{pos,r}[], links:[{x,y,z},{x,y,z}][], stroke:string}}
 */
export function chainAppendage(nodes, cfg = {}, phase = null) {
  const c = { ...CHAIN_DEFAULT, ...cfg };
  const ph = phase == null ? c.wavePhase : phase;
  const core = nodes[c.coreKey], root = nodes[c.rootKey];
  const baseDir = rotEW(normalize3(sub3(root, core)), c.droop);    // spine continuation past the root, tilted
  const tip = add(root, mul(baseDir, c.length));
  const [P0, P1, P2, P3] = [core, root, tip, tip];                 // the three anchors (tip doubled as the phantom end)
  const M = c.segments, A = c.around;
  const samp = [];
  for (let i = 0; i < M; i++) samp.push(catmull3(P0, P1, P2, P3, i / (M - 1)));

  const rings = [], centers = [], spheres = [], links = [];
  let prev = null;
  for (let i = 0; i < M; i++) {
    const s = i / (M - 1), p = samp[i];
    const a = samp[Math.max(0, i - 1)], b = samp[Math.min(M - 1, i + 1)];
    const T = normalize3(sub3(b, a));
    let side = normalize3(cross3({ x: 0, y: 0, z: 1 }, T));
    if (!(Math.abs(side.x) + Math.abs(side.y) + Math.abs(side.z) > 1e-6)) side = { x: 1, y: 0, z: 0 };
    const vert = normalize3(cross3(T, side));
    const env = Math.pow(s, c.waveEnvPow);                          // 0 at root → 1 at tip
    const disp = c.waveAmp * env * Math.sin(2 * Math.PI * c.waveN * s + ph);
    const planeVec = c.wavePlane === 'vertical' ? vert : side;
    const center = add(p, mul(planeVec, disp));
    const r = c.rootR + (c.tipR - c.rootR) * s;
    const poly = [];
    for (let j = 0; j <= A; j++) {
      const ang = (j / A) * Math.PI * 2;
      poly.push(add(center, add(mul(side, r * Math.cos(ang)), mul(vert, r * Math.sin(ang)))));
    }
    rings.push(poly); centers.push(center);
    if (i % 3 === 0 || i === M - 1) spheres.push({ pos: center, r });
    if (prev) links.push([prev, center]);
    prev = center;
  }
  return { rings, centers, spheres, links, stroke: '#7e4646' };
}

// The two named chains over the shared primitive: the tail roots at the pelvis
// (behind), the neck roots at the neck hub (projecting forward-up off the front).
export const tailChain = (nodes, cfg = {}, phase = null) => chainAppendage(nodes, cfg, phase);
export const neckChain = (nodes, cfg = {}, phase = null) => chainAppendage(nodes, { rootKey: 'neckHub', droop: 36, ...cfg }, phase);
