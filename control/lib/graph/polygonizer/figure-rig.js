/**
 * PROTOFORM HUMAN FIGURE — world-space canonical records + rig metadata, both sexes.
 *
 * The figure is sculpted in `figure-readable-envelope.spike` (`litFigureFaces`,
 * stitched) over the locked manji armature (`figure-vajra.js`). It is parametrized
 * by ONE adjustment set: global knobs (height, stockiness, articulation) + the
 * dimorphic pole `DIMORPH[sex]`. Male and female are EQUIVALENT — same principles,
 * same schema — differing only by that pole. The female is a locked primitive.
 *
 * `DIMORPH` is the single source of truth for the poles and is imported by the
 * geometry (the spike) and by the rig builder here, so a bound shape and its rig
 * slot always agree. `buildRig(dim)` emits an L0–L2 rig (per
 * `lite-template/integration/0610/rig-schema.plan.md`): `tier:'mechanical'`,
 * `archetype:'biped'`, `frame.forward` (fixes front), world-space `slots` (limb
 * extensions + the dimorphic shoulder/hip proportions baked in), `chains`,
 * `joints` (hinge limits from the armature `LIMITS`), `symmetry`, `roles`.
 */
import { FIGURE_NODES, LIMITS, articulate } from './figure-vajra.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ── Sexual dimorphism poles — the shared adjustment set ───────────────────
// shoulder/hip scale the landmark widths → the rig SLOTS (and the flesh that
// follows them). ribW/waist/glute/limb scale flesh regions; breast is the chest
// form (pec plates ↔ breasts). Male = identity pole; female = the locked basis.
export const DIMORPH = {
  male:   { sex: 'male',   shoulder: 1.0,  hip: 1.0,  ribW: 1.0,  waist: 1.0,  glute: 1.0,  limb: 1.0,  breast: 0 },
  female: { sex: 'female', shoulder: 0.86, hip: 1.16, ribW: 0.90, waist: 1.6,  glute: 1.22, limb: 0.82, breast: 1 },
};

// World-space slots: armature neutral → dimorphic shoulder/hip proportions (limbs
// follow; legs only partway so the thighs angle inward) → world-space limb
// extensions (forearm +40%, thigh +15%, calf +20%) + feet. Matches the geometry.
function worldSlots(dim) {
  const A = articulate({ kneeL: 6, kneeR: 6, elbowL: 12, elbowR: 12 });
  const w = {};
  for (const k of Object.keys(FIGURE_NODES)) w[k] = { ...A[k] };
  for (const L of ['L', 'R']) {
    const dSh = w[`shoulder${L}`].x * (dim.shoulder - 1);
    w[`shoulder${L}`].x += dSh; w[`elbow${L}`].x += dSh; w[`wrist${L}`].x += dSh;   // arm follows the shoulder
    const dHip = w[`hip${L}`].x * (dim.hip - 1), dLeg = dHip * 0.45;
    w[`hip${L}`].x += dHip; w[`knee${L}`].x += dLeg; w[`ankle${L}`].x += dLeg;       // leg follows partway → thighs angle in
  }
  for (const L of ['L', 'R']) {
    const el = w[`elbow${L}`], wr0 = w[`wrist${L}`], hip = w[`hip${L}`], knee = w[`knee${L}`], ankle = w[`ankle${L}`];
    w[`wrist${L}`] = { x: el.x + (wr0.x - el.x) * 1.4, y: el.y + (wr0.y - el.y) * 1.4, z: el.z + (wr0.z - el.z) * 1.4 };
    const Kz = knee.z + (knee.z - hip.z) * 0.15;
    w[`knee${L}`] = { x: knee.x, y: knee.y, z: Kz };
    w[`ankle${L}`] = { x: knee.x + (ankle.x - knee.x) * 1.2, y: knee.y + (ankle.y - knee.y) * 1.2, z: Kz + (ankle.z - knee.z) * 1.2 };
    const B = w[`ankle${L}`];
    w[`heel${L}`] = { x: B.x, y: B.y - 0.030, z: B.z - 0.048 };
    w[`toe${L}`] = { x: B.x, y: B.y + 0.122, z: B.z - 0.048 };
  }
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, [r4(v.x), r4(v.y), r4(v.z)]]));
}

const SAGITTAL = [1, 0, 0];   // knee/elbow/ankle hinge axis (sagittal plane)

// Build the L0–L2 rig for a dimorphic pole. Kinematics (chains/joints/limits) are
// shared — only the slots (shoulder/hip proportions) and the chest form differ.
function buildRig(dim) {
  return {
    id: `protoform-human-${dim.sex}`,
    tier: 'mechanical',
    archetype: 'biped',
    frame: { up: [0, 0, 1], forward: [0, 1, 0] },   // z up, +y front — places the camera so frontal is correct
    dimorph: { ...dim },                             // the adjustment set that produced this pole
    slots: worldSlots(dim),
    ground: ['heelL', 'toeL', 'heelR', 'toeR'],
    parts: { head: { from: 'neckHub', to: 'headTop' }, torso: { from: 'pelvisHub', to: 'neckHub' } },
    chains: {
      spine: ['pelvisHub', 'navel', 'neckHub', 'headTop'],
      armL: ['shoulderL', 'elbowL', 'wristL'],
      armR: ['shoulderR', 'elbowR', 'wristR'],
      legL: ['hipL', 'kneeL', 'ankleL', 'toeL'],
      legR: ['hipR', 'kneeR', 'ankleR', 'toeR'],
    },
    joints: {
      neckHub:   { kind: 'cone',  cone: LIMITS.headNeck },
      navel:     { kind: 'core',  twist: LIMITS.coreTwist, bend: LIMITS.coreBend },
      shoulderL: { kind: 'ball',  cone: LIMITS.shoulder },
      shoulderR: { kind: 'ball',  cone: LIMITS.shoulder },
      hipL:      { kind: 'ball',  cone: LIMITS.hip },
      hipR:      { kind: 'ball',  cone: LIMITS.hip },
      elbowL:    { kind: 'hinge', axis: SAGITTAL, min: 0, max: LIMITS.elbow, fold: 'forward' },
      elbowR:    { kind: 'hinge', axis: SAGITTAL, min: 0, max: LIMITS.elbow, fold: 'forward' },
      kneeL:     { kind: 'hinge', axis: SAGITTAL, min: 0, max: LIMITS.knee,  fold: 'back' },
      kneeR:     { kind: 'hinge', axis: SAGITTAL, min: 0, max: LIMITS.knee,  fold: 'back' },
      ankleL:    { kind: 'hinge', axis: SAGITTAL, min: -25, max: 35, fold: 'forward' },
      ankleR:    { kind: 'hinge', axis: SAGITTAL, min: -25, max: 35, fold: 'forward' },
    },
    symmetry: [
      ['shoulderL', 'shoulderR'], ['elbowL', 'elbowR'], ['wristL', 'wristR'],
      ['hipL', 'hipR'], ['kneeL', 'kneeR'], ['ankleL', 'ankleR'], ['heelL', 'heelR'], ['toeL', 'toeR'],
    ],
    roles: {
      head: 'headTop', torso: 'neckHub', spine: 'spine',
      arms: ['wristL', 'wristR'], legs: ['ankleL', 'ankleR'],
      armChains: ['armL', 'armR'], legChains: ['legL', 'legR'],
    },
    shapes: {
      source: 'lib/graph/polygonizer/figure-readable-envelope.spike.gen.test.js#litFigureFaces (stitched)',
      chest: dim.breast ? 'female — overlapping round breast masses (golden-ratio waves), cleavage at centre' : 'male — pec/scapula sleeve-shirt over the lat/oblique tank',
      regions: 'spine = rib-egg trunk + dantien + pelvis diaper + groin · armChains = upperArm + forearm + hand · legChains = thigh/calf + glute + foot',
    },
    provenance: {
      armature: 'lib/graph/polygonizer/figure-vajra.js',
      worldSpace: 'lib/graph/polygonizer/figure-readable-envelope.spike.gen.test.js',
      plans: ['lite-template/integration/0610/figure-proto-params.plan.md', 'lite-template/integration/0610/figure-dimorphism.plan.md'],
    },
  };
}

export const PROTOFORM_HUMAN_MALE = buildRig(DIMORPH.male);
export const PROTOFORM_HUMAN_FEMALE = buildRig(DIMORPH.female);
export default PROTOFORM_HUMAN_MALE;
