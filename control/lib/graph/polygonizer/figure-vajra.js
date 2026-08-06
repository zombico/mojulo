/**
 * figure-vajra — the fundamental figure shape.
 *
 * The empty figure skeleton as a harmonized vajra graph: a fixed set of
 * landmark NODES (each a manji point with ONE radius, so spheres that
 * coincide at a shared hub merge) joined by EDGES (a vajra over a node
 * triple). It is a single coherent primitive with three manifestations
 * of the SAME data:
 *
 *   manji  — the joint graph: one sphere per node, connected by lines
 *            (`figureJointGraph`). The mandala-space read of the character.
 *   wave   — the vajra ring-form: each edge a vajra, with anatomical
 *            ball-in-socket at the limb roots (`figureVajraSpecs`).
 *   world  — the rendered manifestation a renderer paints from the wave
 *            specs (faces / mesh). Owned by the renderer, not this module.
 *
 * Articulation is a kinematic model: every joint is a constrained
 * rotation (swivel cones for ball joints, one-way hinges for elbow/knee,
 * twist+bend for the core) clamped to anatomical LIMITS, so a pose can
 * never exceed its range or hinge the wrong way (`articulate`). Hand
 * authoring (rotate-about / set ops) is also available via `applyPose`.
 *
 * Units are figure-frame STAND units; the renderer owns scale, the view
 * rotation, projection, shading, and layout.
 *
 * History: distilled from the figure-mandala-vajra-shoulder spike, which
 * is now just one renderer of this primitive.
 */

// ─── Vector helpers (exported; the renderer shares them) ───────────────
export function normalize3(v) { const len = Math.hypot(v.x, v.y, v.z); if (len < 1e-12) return { x: 0, y: 0, z: 0 }; return { x: v.x / len, y: v.y / len, z: v.z / len }; }
export function sub3(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function cross3(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
export function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

// ─── Landmark coordinates (figure frame, STAND units) ──────────────────
// LEG_FWD: the hip+knee sit slightly forward of the torso centreline (feet stay planted)
// so the thighs come forward and balance the lateral profile — the groin reads as less of an
// isolated front bulge — without changing the front/rear silhouette (a +y shift is pure depth).
const LEG_FWD = 0.045;
const STAND = {
  torsoTop:  { x: 0,      y: 0,       z: 0.78 },
  shoulderL: { x: -0.13,  y: 0,       z: 0.78 },
  shoulderR: { x:  0.13,  y: 0,       z: 0.78 },
  hipL:      { x: -0.10,  y: LEG_FWD, z: 0.47 },
  hipR:      { x:  0.10,  y: LEG_FWD, z: 0.47 },
  elbowL:    { x: -0.155, y: 0,       z: 0.60 },   // flared out so the arms
  elbowR:    { x:  0.155, y: 0,       z: 0.60 },   // clear the hips frontally
  wristL:    { x: -0.195, y: 0,       z: 0.45 },
  wristR:    { x:  0.195, y: 0,       z: 0.45 },
  kneeL:     { x: -0.10,  y: LEG_FWD, z: 0.25 },
  kneeR:     { x:  0.10,  y: LEG_FWD, z: 0.25 },
  ankleL:    { x: -0.10,  y: 0,       z: 0.02 },   // feet stay planted under the body
  ankleR:    { x:  0.10,  y: 0,       z: 0.02 },
};

const NAVEL_Z    = 0.625;   // torso midline
const HEAD_BASE_Z = 0.855;  // atlas / base of skull — the neck↔head pivot
const HEAD_TOP_Z = 0.93;    // head ball (balances the head-vajra prongs)
const DELTOID_R  = 0.040;   // shoulder cap
const HIP_R      = 0.036;   // hip cap (narrowed so L/R hips don't superimpose)
export const BLEND = 0.022; // one blend across the whole armature

// Ball-in-socket — anatomical, per joint (shoulder and hip are opposites):
//   shoulder = large head on a shallow socket ("golf ball on a tee"),
//   hip      = head sunk into a deep socket.
// The head is also offset forward + inward from the shaft (the femoral /
// humeral neck angle). This is a wave (form) refinement only; the manji
// joint graph keeps the clean joint-center mapping.
const BALL_RATIO_SHOULDER = 0.76;
const BALL_RATIO_HIP      = 0.50;
const SOCKET_FORWARD = 0.30;   // anterior (+y) bias, × socket radius
const SOCKET_MEDIAL  = 0.22;   // medial bias (toward the midline)

// One radius per landmark. Joints (elbow/knee/neck/navel/pelvis) are thin
// screws; caps and extremities are beads. Shared hubs carry a single
// value so every edge that touches them agrees (harmonization).
export const FIGURE_NODES = {
  headTop:   { pos: { x: 0, y: 0, z: HEAD_TOP_Z },       r: 0.046 },
  headBase:  { pos: { x: 0, y: 0, z: HEAD_BASE_Z },      r: 0.034 },   // atlas — skull pivots on the neck here
  neckHub:   { pos: { x: 0, y: 0, z: STAND.torsoTop.z }, r: 0.038 },   // head + torso + shoulders meet
  navel:     { pos: { x: 0, y: 0, z: NAVEL_Z },          r: 0.040 },   // head + torso meet
  pelvisHub: { pos: { x: 0, y: 0, z: STAND.hipL.z },     r: 0.043 },   // torso + hips meet
  shoulderL: { pos: STAND.shoulderL, r: DELTOID_R },
  shoulderR: { pos: STAND.shoulderR, r: DELTOID_R },
  hipL:      { pos: STAND.hipL,      r: HIP_R },
  hipR:      { pos: STAND.hipR,      r: HIP_R },
  elbowL:    { pos: STAND.elbowL,    r: 0.024 },
  elbowR:    { pos: STAND.elbowR,    r: 0.024 },
  wristL:    { pos: STAND.wristL,    r: 0.024 },
  wristR:    { pos: STAND.wristR,    r: 0.024 },
  kneeL:     { pos: STAND.kneeL,     r: 0.024 },
  kneeR:     { pos: STAND.kneeR,     r: 0.024 },
  ankleL:    { pos: STAND.ankleL,    r: 0.028 },
  ankleR:    { pos: STAND.ankleR,    r: 0.028 },
};

// The default per-node radii, keyed like the nodes. Passed as the `radii`
// argument to the render-reads below; a caller (e.g. the animal concern) can
// supply its own map to re-girth the figure without touching positions.
export const FIGURE_RADII = Object.fromEntries(Object.entries(FIGURE_NODES).map(([k, n]) => [k, n.r]));

// Each body part is one vajra over [proximal, center, distal] nodes.
// `ball: true` marks a limb whose proximal sphere is a ball-in-socket.
export const FIGURE_EDGES = [
  { tri: ['headTop', 'headBase', 'neckHub'],    stroke: '#a06868' },  // head / neck
  { tri: ['neckHub', 'navel', 'pelvisHub'],     stroke: '#8e4747' },  // torso
  { tri: ['shoulderL', 'neckHub', 'shoulderR'], stroke: '#8e4f4f' },  // shoulder girdle
  { tri: ['hipL', 'pelvisHub', 'hipR'],         stroke: '#7e4646' },  // hip girdle
  { tri: ['shoulderL', 'elbowL', 'wristL'],     stroke: '#a06868', ball: true },  // left arm
  { tri: ['shoulderR', 'elbowR', 'wristR'],     stroke: '#a06868', ball: true },  // right arm
  { tri: ['hipL', 'kneeL', 'ankleL'],           stroke: '#8a5050', ball: true },  // left leg
  { tri: ['hipR', 'kneeR', 'ankleR'],           stroke: '#8a5050', ball: true },  // right leg
];

// ─── Articulation limits ───────────────────────────────────────────────
//   head/neck : swivel cone about the neck base — head 45° + neck 45° = 90°.
//   shoulder  : swivel cone about the SHOULDER socket (ball joint; the upper arm
//               rotates, the shoulder stays put — mirrors the hip).
//   elbow     : one-way hinge, forward only (never behind).
//   core      : twist (upper vs lower against the midline) + a little
//               fwd/back bend that pulls the whole top/bottom with it.
//   hip       : outer sphere swivels the thigh in all directions (cone).
//   knee      : one-way hinge, back only (never forward).
// Shoulder out-ranges the hip — the shoulder is the most mobile joint,
// the hip is deliberately limited for stability. The shoulder cone is measured from
// the rest arm (which hangs straight DOWN), so it must reach ~172° to bring the hand
// fully overhead (real glenohumeral flexion is ~180°); 180 lets the arm raise to
// vertical — needed for overhead gestures like the Statue of Liberty torch arm.
// head/neck split into two joints: the NECK flexes/tilts the whole column at its
// base; the HEAD nods/tilts the skull on top of the neck (atlas). Their cones sum
// to roughly the old headNeck (90).
export const LIMITS = { neck: 45, head: 45, headNeck: 90, shoulder: 180, armRoll: 110, elbow: 150, coreTwist: 35, coreBend: 25, hip: 62, hipRoll: 45, pelvis: 20, hinge: 80, shoulders: 30, knee: 150, wrist: 70, wristTwist: 120 };

// Kinematic subtrees — the nodes a joint carries when it rotates.
export const ARMS_L = ['elbowL', 'wristL'], ARMS_R = ['elbowR', 'wristR'];
export const LEG_L = ['kneeL', 'ankleL'], LEG_R = ['kneeR', 'ankleR'];
export const UPPER_BODY = ['headTop', 'headBase', 'neckHub', 'shoulderL', 'shoulderR', ...ARMS_L, ...ARMS_R];
const LOWER_BODY = ['hipL', 'hipR', ...LEG_L, ...LEG_R];
// The shoulder girdle as a rigid plate (shoulders + arms, NOT the head/neckHub pivot) — the
// transverse-rotation subtree, the upper mirror of LOWER_BODY's hips+legs about the pelvis.
export const SHOULDER_GIRDLE = ['shoulderL', 'shoulderR', ...ARMS_L, ...ARMS_R];

// ─── Spinal articulation — the form's natural capabilities ─────────────
// The spine is NOT a rigid rod hinged at one point. Bend is distributed across
// three trunk pivots (the locked manji nodes), each with its own mobility, so the
// trunk CURVES. Drives are the yin/yang antagonist balance (figure-spine-
// articulation.plan.md): sagittal +flex/−extend, lateral side-bend, axial twist,
// each ∈ [−1,+1]. Per-joint caps (degrees) are the segment's real range — lumbar
// flexes, thoracic rotates — so a pose bends where the form actually can.
// Per-joint caps are tuned so the CUMULATIVE trunk range matches a real
// thoracolumbar spine, not a contortionist's: flex ≈50° (forward fold),
// ext ≈26° (lumbar-dominant arch), lateral ≈30° side-bend, axial ≈35° twist.
export const SPINE_CAP = {
  pelvisHub: { flex: 16, ext: 10, lateral: 10, axial: 5 },    // lumbosacral
  navel:     { flex: 22, ext: 8,  lateral: 12, axial: 9 },    // lumbar / thoracolumbar
  neckHub:   { flex: 12, ext: 8,  lateral: 8,  axial: 21 },   // thoracic (rotates most)
};
const SPINE_ORDER = ['pelvisHub', 'navel', 'neckHub'];   // proximal → distal
// The distal subtree each spine pivot carries when it rotates.
const SPINE_SUB = {
  pelvisHub: ['navel', ...UPPER_BODY],                                   // whole trunk + up
  navel:     [...UPPER_BODY],                                            // above the navel
  neckHub:   ['headTop', 'headBase', 'shoulderL', 'shoulderR', ...ARMS_L, ...ARMS_R], // above the neck root
};

// ─── Rotations ─────────────────────────────────────────────────────────
// Axes: 'EW' = about world-x (sagittal, fwd/back); 'NS' = about world-y
// (frontal plane, arm raise); 'ZN' = about world-z (axial twist).
export function rotateAbout(pos, pivot, axis, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d = { x: pos.x - pivot.x, y: pos.y - pivot.y, z: pos.z - pivot.z };
  let r;
  if (axis === 'EW')      r = { x: d.x,                 y: d.y * c - d.z * s, z: d.y * s + d.z * c };
  else if (axis === 'NS') r = { x: d.x * c + d.z * s,   y: d.y,               z: -d.x * s + d.z * c };
  else                    r = { x: d.x * c - d.y * s,   y: d.x * s + d.y * c, z: d.z };
  return { x: pivot.x + r.x, y: pivot.y + r.y, z: pivot.z + r.z };
}

// Rodrigues rotation of point `p` about `pivot` around unit `axis`.
function rotAxis(p, pivot, axis, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d = sub3(p, pivot);
  const kxd = cross3(axis, d);
  const kd = dot3(axis, d);
  return {
    x: pivot.x + d.x * c + kxd.x * s + axis.x * kd * (1 - c),
    y: pivot.y + d.y * c + kxd.y * s + axis.y * kd * (1 - c),
    z: pivot.z + d.z * c + kxd.z * s + axis.z * kd * (1 - c),
  };
}

// Hinge: fold the distal node about the joint TOWARD `refDir` by `deg`,
// around the axis perpendicular to the segment and refDir. The fold
// direction is fixed (knee → back, elbow → forward), so a joint can only
// flex the natural way no matter how the limb is posed — never hyperextend.
export const REF_BACK = { x: 0, y: -1, z: 0 };
export const REF_FWD  = { x: 0, y:  1, z: 0 };
function hingeFold(m, joint, distal, refDir, deg) {
  if (deg === 0) return;                   // zero flex is an exact no-op
  const seg = normalize3(sub3(m[distal], m[joint]));
  const axis = cross3(seg, refDir);
  const al = Math.hypot(axis.x, axis.y, axis.z);
  if (al < 1e-6) return;
  m[distal] = rotAxis(m[distal], m[joint], { x: axis.x / al, y: axis.y / al, z: axis.z / al }, deg);
}

export function basePositions() {
  const m = {};
  for (const [k, n] of Object.entries(FIGURE_NODES)) m[k] = { ...n.pos };
  return m;
}

// ─── Hand-authored poses (rotate-about / hinge / set ops) ──────────────
// Baseline natural flex appended to every pose — knees and elbows always
// carry a hinge bend in the anatomical direction.
export function naturalJoints(knee, elbow) {
  return [
    { hinge: ['kneeL', 'ankleL'], refDir: REF_BACK, angle: knee },
    { hinge: ['kneeR', 'ankleR'], refDir: REF_BACK, angle: knee },
    { hinge: ['elbowL', 'wristL'], refDir: REF_FWD, angle: elbow },
    { hinge: ['elbowR', 'wristR'], refDir: REF_FWD, angle: elbow },
  ];
}

// Each op rotates `nodes` about `pivot` by `angle` around `axis`, folds a
// distal node toward `refDir` (`hinge`), or places nodes directly (`set`).
// Ops apply in order, so a flex after a swing rides on the moved joint.
export function applyPose(ops) {
  const m = basePositions();
  for (const op of ops) {
    if (op.set) { for (const [k, v] of Object.entries(op.set)) m[k] = { x: v.x, y: v.y, z: v.z }; continue; }
    if (op.hinge) { hingeFold(m, op.hinge[0], op.hinge[1], op.refDir, op.angle); continue; }
    const pivot = typeof op.pivot === 'string' ? m[op.pivot] : op.pivot;
    for (const key of op.nodes) m[key] = rotateAbout(m[key], pivot, op.axis, op.angle);
  }
  return m;
}

// ─── Articulation from degrees-of-freedom (clamped to LIMITS) ──────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function rotateSub(m, keys, pivotKey, axis, deg) {
  const pivot = m[pivotKey];
  for (const k of keys) m[k] = rotateAbout(m[k], pivot, axis, deg);
}
// Two-axis swivel within a cone: yaw (about NS) + pitch (about EW),
// magnitude clamped to `limit`.
function swivelSub(m, keys, pivotKey, yaw, pitch, limit) {
  const mag = Math.hypot(yaw, pitch);
  if (mag > limit) { yaw *= limit / mag; pitch *= limit / mag; }
  rotateSub(m, keys, pivotKey, 'NS', yaw);
  rotateSub(m, keys, pivotKey, 'EW', pitch);
}

// Build a posed armature from a degrees-of-freedom object. Order is
// proximal → distal so each joint rides on its parent.
export function articulate(dof = {}) {
  const m = basePositions();
  const L = LIMITS;
  // Spine: distribute the sagittal/lateral/axial drive across the three trunk
  // pivots (proximal→distal, so each rides its parent → the trunk curves).
  if (dof.spine) {
    const { sagittal = 0, lateral = 0, axial = 0 } = dof.spine;
    let sg = clamp(sagittal, -1, 1), la = clamp(lateral, -1, 1);
    const ax = clamp(axial, -1, 1);
    // Unify the curl: forward-fold and side-bend draw from ONE flexibility
    // budget, so a diagonal bend (down AND to the side) rides a single natural
    // cone instead of summing to a superhuman fold. Twist is its own axis.
    const r = Math.hypot(sg, la);
    if (r > 1) { sg /= r; la /= r; }
    for (const j of SPINE_ORDER) {
      const cap = SPINE_CAP[j], sub = SPINE_SUB[j];
      const bend = sg >= 0 ? sg * cap.flex : sg * cap.ext;   // +flex (forward), −extend (arch)
      if (bend) rotateSub(m, sub, j, 'EW', -bend);           // flex = forward (+y) → negative EW
      if (la)   rotateSub(m, sub, j, 'NS', la * cap.lateral);
      if (ax)   rotateSub(m, sub, j, 'ZN', ax * cap.axial);
    }
  }
  if (dof.bend) rotateSub(m, UPPER_BODY, 'navel', 'EW', clamp(dof.bend, -L.coreBend, L.coreBend));
  if (dof.twist) {
    const t = clamp(dof.twist, -L.coreTwist, L.coreTwist);
    rotateSub(m, UPPER_BODY, 'navel', 'ZN', t);
    rotateSub(m, LOWER_BODY, 'pelvisHub', 'ZN', -t);
  }
  // PELVIC rotation (transverse plane): the rigid pelvis rotates about the vertical axis
  // through its centre, carrying the hips + legs, so one hip leads forward (+ = RIGHT hip
  // forward). A determinant of natural gait — the swing-side hip advances, lengthening the
  // stride and smoothing the COM. The trunk above pelvisHub stays put, so the pelvis counter-
  // rotates against the thorax (the spine's axial drive) the way a real walk does. Applied
  // before the hip swivels so each thigh swings relative to the rotated pelvis.
  if (dof.pelvis) rotateSub(m, LOWER_BODY, 'pelvisHub', 'ZN', clamp(dof.pelvis, -L.pelvis, L.pelvis));
  // HIP HINGE (sagittal pelvic tilt): the rigid pelvis tips ANTERIOR about the hip axis —
  // the line through hipL/hipR, which pelvisHub lies on — carrying the whole trunk (navel +
  // up) forward over the planted, near-straight legs while the hips/legs stay put. The
  // sagittal complement of dof.pelvis (transverse): same pivot, EW (fwd/back) axis, trunk
  // subtree instead of the legs. This is hip FLEXION on the trunk side (pelvis-on-femur), so
  // it has its own limit, distinct from the thigh-side hip cone. + = hinge forward (flat back
  // toward parallel — rows / deadlifts / good-mornings / bowing). Forward = negative EW (as
  // with the spine flex). Applied after the spine drives so the back's flat/rounded shape
  // composes under the inclination, and after the transverse pelvis so the two tilts stack.
  if (dof.hinge) rotateSub(m, ['navel', ...UPPER_BODY], 'pelvisHub', 'EW', -clamp(dof.hinge, 0, L.hinge));
  // SHOULDER-GIRDLE rotation (transverse plane) — the upper mirror of dof.pelvis. The rigid
  // shoulder girdle rotates about the vertical axis through neckHub, carrying the shoulders +
  // arms (NOT the head — the gaze stays level), so one shoulder leads forward (+ = RIGHT
  // shoulder forward). In a walk it counter-rotates against the pelvis (the contralateral
  // coordination); for the upper body it is what the pelvic rotation is for the lower. Applied
  // before the glenohumeral swivels so each arm swings relative to the rotated girdle.
  if (dof.shoulders) rotateSub(m, [...SHOULDER_GIRDLE], 'neckHub', 'ZN', clamp(dof.shoulders, -L.shoulders, L.shoulders));
  // glenohumeral: the upper arm (bicep, shoulder→elbow) swivels about the SHOULDER
  // socket — the shoulder node stays put. Mirrors the hip (thigh about the hip).
  if (dof.shL) swivelSub(m, ARMS_L, 'shoulderL', dof.shL.yaw || 0, dof.shL.pitch || 0, L.shoulder);
  if (dof.shR) swivelSub(m, ARMS_R, 'shoulderR', dof.shR.yaw || 0, dof.shR.pitch || 0, L.shoulder);
  if (dof.hipL) swivelSub(m, LEG_L, 'hipL', dof.hipL.yaw || 0, dof.hipL.pitch || 0, L.hip);
  if (dof.hipR) swivelSub(m, LEG_R, 'hipR', dof.hipR.yaw || 0, dof.hipR.pitch || 0, L.hip);
  hingeFold(m, 'elbowL', 'wristL', REF_FWD, clamp(dof.elbowL || 0, 0, L.elbow));
  hingeFold(m, 'elbowR', 'wristR', REF_FWD, clamp(dof.elbowR || 0, 0, L.elbow));
  hingeFold(m, 'kneeL', 'ankleL', REF_BACK, clamp(dof.kneeL || 0, 0, L.knee));
  hingeFold(m, 'kneeR', 'ankleR', REF_BACK, clamp(dof.kneeR || 0, 0, L.knee));
  // shoulder AXIAL rotation (external/internal) — the 3rd ball-joint DOF. Applied
  // AFTER the elbow bend so it swings the now-bent forearm out of the sagittal
  // plane (e.g. forearm-up for a wave). Rotates the wrist about the upper-arm axis.
  for (const s of ['L', 'R']) {
    const roll = dof['sh' + s] && dof['sh' + s].roll;
    if (!roll) continue;
    const axis = normalize3(sub3(m['elbow' + s], m['shoulder' + s]));
    m['wrist' + s] = rotAxis(m['wrist' + s], m['elbow' + s], axis, clamp(roll, -L.armRoll, L.armRoll));
  }
  // hip AXIAL rotation (external/internal) — the leg's 3rd ball-joint DOF, mirroring the
  // shoulder. Applied AFTER the knee bend so it swings the now-bent shank+foot out of the
  // sagittal plane: rotates the ankle about the femoral (hip→knee) axis, pivoting at the
  // knee. This is how a swing leg circumducts — the knee/foot rolls outward to step AROUND
  // the planted ankle (the gait's stepRoll) instead of cutting straight through it.
  for (const s of ['L', 'R']) {
    const roll = dof['hip' + s] && dof['hip' + s].roll;
    if (!roll) continue;
    const axis = normalize3(sub3(m['knee' + s], m['hip' + s]));
    m['ankle' + s] = rotAxis(m['ankle' + s], m['knee' + s], axis, clamp(roll, -L.hipRoll, L.hipRoll));
  }
  // NECK: flex/tilt the whole column (carries the skull) about the neck root.
  // HEAD: nod/tilt the skull on top of the neck (about the atlas). Applied
  // proximal→distal so the head rides the neck.
  if (dof.neck) swivelSub(m, ['headBase', 'headTop'], 'neckHub', dof.neck.yaw || 0, dof.neck.pitch || 0, L.neck);
  if (dof.head) swivelSub(m, ['headTop'], 'headBase', dof.head.yaw || 0, dof.head.pitch || 0, L.head);
  return m;
}

// ─── Rigid-bone articulation (the same kinematics, as affine transforms) ────
// `articulate` moves POINTS; a rigid-armor consumer (a posed mobile suit, any
// hardware body) needs the rigid TRANSFORM each bone segment underwent, applied
// about ITS OWN skeleton's pivots. `articulateTransforms` replays the exact
// op sequence of `articulate` — same order, same clamps, same computed axes —
// but accumulates a per-bone affine alongside the moving node map, and takes an
// optional `base` so the skeleton can have non-human proportions (a suit's
// joints derived from its stations). With the default base its node output is
// bit-identical to `articulate(dof)` — pinned by the parity test.
//
// Bones and their CARRIER node (the node that rigidly rides the bone, so "ops
// whose subtree contains the carrier" = "ops that move this bone"):
//   pelvis→hipL · torso→neckHub · head→headTop · upperArmL/R→elbowL/R ·
//   forearmL/R→wristL/R (hand rides) · thighL/R→kneeL/R · shinL/R→ankleL/R
//   (the foot rides the shin — the armature has no ankle DOF).
export const BONE_CARRIERS = {
  pelvis: 'hipL', torso: 'neckHub', head: 'headTop',
  upperArmL: 'elbowL', upperArmR: 'elbowR', forearmL: 'wristL', forearmR: 'wristR',
  // the HAND rides the wrist node exactly like the forearm does, so handX
  // accumulates the same arm motion as forearmX — until a wrist DOF rotates it
  // about the wrist joint (articulateTransforms). A held weapon binds to handX,
  // so the wrist AIMS the blade independently of the forearm.
  handL: 'wristL', handR: 'wristR',
  thighL: 'kneeL', thighR: 'kneeR', shinL: 'ankleL', shinR: 'ankleR',
};

const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mmul = (A, B) => A.map((r) => [
  r[0] * B[0][0] + r[1] * B[1][0] + r[2] * B[2][0],
  r[0] * B[0][1] + r[1] * B[1][1] + r[2] * B[2][1],
  r[0] * B[0][2] + r[1] * B[1][2] + r[2] * B[2][2],
]);
const mvec = (M, v) => ({
  x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
  y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
  z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z,
});
const axisMat = { // matches rotateAbout: EW = about x, NS = about y, ZN = about z
  EW: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; },
  NS: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; },
  ZN: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; },
};
// Rodrigues rotation matrix about unit `axis` (matches rotAxis).
function rodMat(axis, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  const { x, y, z } = axis;
  return [
    [c + x * x * t, x * y * t - z * s, x * z * t + y * s],
    [y * x * t + z * s, c + y * y * t, y * z * t - x * s],
    [z * x * t - y * s, z * y * t + x * s, c + z * z * t],
  ];
}

export function articulateTransforms(dof = {}, base = null, opts = {}) {
  const m = base
    ? Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { x: v.x, y: v.y, z: v.z }]))
    : basePositions();
  const T = Object.fromEntries(Object.keys(BONE_CARRIERS).map((b) => [b, { m: I3(), t: { x: 0, y: 0, z: 0 } }]));
  const L = LIMITS;
  // RIGID UPPER BODY (suits): the torso bone is a single rigid chest plate, so
  // its shoulder sockets must turn WITH it. By default the torso bone rides only
  // the lower spine (pelvis + navel joints), lagging the sockets by the neckHub-
  // level spine rotation + the girdle rotation — on flesh that shear is correct,
  // on rigid armor it splits the chest from the arms (the arms end up rooting at
  // the chest's front corner and the back). When set, the torso carrier node is
  // added to those two rotations. It IS their pivot, so no node moves — node
  // output stays bit-identical to articulate() — and only the torso bone's affine
  // picks up the rotation, so the chest turns as one piece with its sockets.
  // Opt-in (bakeUnitRig / compileUnitPose pass it); the default path is unchanged.
  const rigidUpper = opts.rigidUpperBody === true;
  const TORSO_CARRIER = BONE_CARRIERS.torso;
  // WAIST SWIVEL (suits): the shoulder-girdle turn (dof.shoulders) rotates about a
  // vertical axis through the centerline, so with rigidUpper it is a clean waist
  // bearing — chest + sockets + arms turn as one rigid plate, no shear. A mobile
  // suit's waist can rotate far past a human's ~30° scapular range, so the suit
  // path opts into a larger cap; flesh (no opt) keeps L.shoulders exactly.
  const shouldersLim = Number.isFinite(opts.shouldersLimit) ? opts.shouldersLimit : L.shoulders;

  // One op: rotate `keys` by matrix R about the CURRENT position of `pivot`,
  // moving the node map and composing the step into every bone whose carrier moved.
  const step = (keys, pivotPos, R) => {
    const p = { x: pivotPos.x, y: pivotPos.y, z: pivotPos.z };  // freeze (pivot may be in keys)
    const rp = mvec(R, p);
    const st = { x: p.x - rp.x, y: p.y - rp.y, z: p.z - rp.z };
    const keySet = new Set(keys);
    for (const k of keySet) {
      const rv = mvec(R, m[k]);
      m[k] = { x: rv.x + st.x, y: rv.y + st.y, z: rv.z + st.z };
    }
    for (const [bone, carrier] of Object.entries(BONE_CARRIERS)) {
      if (!keySet.has(carrier)) continue;
      const rt = mvec(R, T[bone].t);
      T[bone] = { m: mmul(R, T[bone].m), t: { x: rt.x + st.x, y: rt.y + st.y, z: rt.z + st.z } };
    }
  };
  const rot = (keys, pivotKey, axis, deg) => { if (deg) step(keys, m[pivotKey], axisMat[axis](deg * Math.PI / 180)); };
  const swivel = (keys, pivotKey, yaw, pitch, limit) => {
    const mag = Math.hypot(yaw, pitch);
    if (mag > limit) { yaw *= limit / mag; pitch *= limit / mag; }
    rot(keys, pivotKey, 'NS', yaw);
    rot(keys, pivotKey, 'EW', pitch);
  };
  const hinge = (joint, distal, refDir, deg) => {
    if (deg === 0) return;
    const seg = normalize3(sub3(m[distal], m[joint]));
    const axis = cross3(seg, refDir);
    const al = Math.hypot(axis.x, axis.y, axis.z);
    if (al < 1e-6) return;
    step([distal], m[joint], rodMat({ x: axis.x / al, y: axis.y / al, z: axis.z / al }, deg));
  };

  // ── the exact articulate() sequence ──
  if (dof.spine) {
    const { sagittal = 0, lateral = 0, axial = 0 } = dof.spine;
    let sg = clamp(sagittal, -1, 1), la = clamp(lateral, -1, 1);
    const ax = clamp(axial, -1, 1);
    const r = Math.hypot(sg, la);
    if (r > 1) { sg /= r; la /= r; }
    for (const j of SPINE_ORDER) {
      const cap = SPINE_CAP[j];
      // rigidUpper: the chest bone follows the neckHub joint too (see the flag note) —
      // pelvis/navel already carry it via UPPER_BODY; only neckHub's level is missing.
      const sub = (rigidUpper && j === 'neckHub') ? [...SPINE_SUB[j], TORSO_CARRIER] : SPINE_SUB[j];
      const bend = sg >= 0 ? sg * cap.flex : sg * cap.ext;
      if (bend) rot(sub, j, 'EW', -bend);
      if (la)   rot(sub, j, 'NS', la * cap.lateral);
      if (ax)   rot(sub, j, 'ZN', ax * cap.axial);
    }
  }
  if (dof.bend) rot(UPPER_BODY, 'navel', 'EW', clamp(dof.bend, -L.coreBend, L.coreBend));
  if (dof.twist) {
    const t = clamp(dof.twist, -L.coreTwist, L.coreTwist);
    rot(UPPER_BODY, 'navel', 'ZN', t);
    rot(LOWER_BODY, 'pelvisHub', 'ZN', -t);
  }
  if (dof.pelvis) rot(LOWER_BODY, 'pelvisHub', 'ZN', clamp(dof.pelvis, -L.pelvis, L.pelvis));
  if (dof.hinge) rot(['navel', ...UPPER_BODY], 'pelvisHub', 'EW', -clamp(dof.hinge, 0, L.hinge));
  if (dof.shoulders) rot(rigidUpper ? [...SHOULDER_GIRDLE, TORSO_CARRIER] : [...SHOULDER_GIRDLE], 'neckHub', 'ZN', clamp(dof.shoulders, -shouldersLim, shouldersLim));
  if (dof.shL) swivel(ARMS_L, 'shoulderL', dof.shL.yaw || 0, dof.shL.pitch || 0, L.shoulder);
  if (dof.shR) swivel(ARMS_R, 'shoulderR', dof.shR.yaw || 0, dof.shR.pitch || 0, L.shoulder);
  if (dof.hipL) swivel(LEG_L, 'hipL', dof.hipL.yaw || 0, dof.hipL.pitch || 0, L.hip);
  if (dof.hipR) swivel(LEG_R, 'hipR', dof.hipR.yaw || 0, dof.hipR.pitch || 0, L.hip);
  hinge('elbowL', 'wristL', REF_FWD, clamp(dof.elbowL || 0, 0, L.elbow));
  hinge('elbowR', 'wristR', REF_FWD, clamp(dof.elbowR || 0, 0, L.elbow));
  hinge('kneeL', 'ankleL', REF_BACK, clamp(dof.kneeL || 0, 0, L.knee));
  hinge('kneeR', 'ankleR', REF_BACK, clamp(dof.kneeR || 0, 0, L.knee));
  for (const s of ['L', 'R']) {
    const roll = dof['sh' + s] && dof['sh' + s].roll;
    if (!roll) continue;
    const axis = normalize3(sub3(m['elbow' + s], m['shoulder' + s]));
    step(['wrist' + s], m['elbow' + s], rodMat(axis, clamp(roll, -L.armRoll, L.armRoll)));
  }
  for (const s of ['L', 'R']) {
    const roll = dof['hip' + s] && dof['hip' + s].roll;
    if (!roll) continue;
    const axis = normalize3(sub3(m['knee' + s], m['hip' + s]));
    step(['ankle' + s], m['knee' + s], rodMat(axis, clamp(roll, -L.hipRoll, L.hipRoll)));
  }
  // WRIST — the hand bone (handX) has tracked the forearm exactly so far (shared
  // wrist-node carrier). A wrist DOF now rotates handX about the wrist joint,
  // pitch = flex/extend, yaw = radial/ulnar deviation — composed into the hand
  // bone ONLY (the forearm armor is untouched), so a weapon bound to handX aims
  // independently of the forearm. No wrist dof ⇒ handX stays == forearmX (byte-
  // identical). The wrist node has no geometry past it, so articulate()'s node
  // output is unchanged; only this bone moves.
  for (const s of ['L', 'R']) {
    const w = dof['wrist' + s];
    if (!w || (!w.pitch && !w.yaw && !w.roll)) continue;
    const pitch = clamp(w.pitch || 0, -L.wrist, L.wrist);
    const yaw = clamp(w.yaw || 0, -L.wrist, L.wrist);
    // roll = pronation/supination: the hand TWISTS about the forearm axis (thumb
    // rotates around) without moving the forearm — the DOF a held weapon needs to be
    // gripped thumb-up vs thumb-down. Composed after flex/yaw; absent ⇒ unchanged.
    const roll = clamp(w.roll || 0, -L.wristTwist, L.wristTwist);
    const f = normalize3(sub3(m['wrist' + s], m['elbow' + s]));   // forearm axis
    // build the perp basis from a reference axis that is NOT near-parallel to the
    // forearm — else the cross product collapses when the arm points straight up/down
    // (the wrist axes would degenerate and the blade couldn't be aimed).
    const ref = Math.abs(f.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const devAxis = normalize3(cross3(f, ref));                   // deviation axis (perp to forearm)
    const flexAxis = normalize3(cross3(devAxis, f));              // the other perp (flexion)
    let Rw = rodMat(flexAxis, pitch);
    if (yaw) Rw = mmul(rodMat(devAxis, yaw), Rw);
    if (roll) Rw = mmul(rodMat(f, roll), Rw);                     // twist about the forearm axis
    const Pw = m['wrist' + s];                                    // posed wrist point
    const hb = T['hand' + s];
    const trel = { x: hb.t.x - Pw.x, y: hb.t.y - Pw.y, z: hb.t.z - Pw.z };
    const trot = mvec(Rw, trel);
    T['hand' + s] = { m: mmul(Rw, hb.m), t: { x: trot.x + Pw.x, y: trot.y + Pw.y, z: trot.z + Pw.z } };
  }
  if (dof.neck) swivel(['headBase', 'headTop'], 'neckHub', dof.neck.yaw || 0, dof.neck.pitch || 0, L.neck);
  if (dof.head) swivel(['headTop'], 'headBase', dof.head.yaw || 0, dof.head.pitch || 0, L.head);

  return { nodes: m, bones: T };
}

// ─── Manji manifestation — the joint graph ─────────────────────────────
// One sphere per node (the joint-center mapping), plus the center-to-
// center links of every edge. No ball-in-socket here — the manji read
// stays the clean character skeleton. Positions in STAND units; the
// renderer projects.
export function figureJointGraph(positions, radii = FIGURE_RADII) {
  const spheres = Object.keys(FIGURE_NODES).map((key) => ({ pos: positions[key], r: radii[key] }));
  const links = [];
  for (const { tri: [a, b, c] } of FIGURE_EDGES) {
    links.push([positions[a], positions[b]]);
    links.push([positions[b], positions[c]]);
  }
  return { spheres, links };
}

// ─── Wave manifestation — the vajra specs ──────────────────────────────
// One vajra spec per edge, with anatomical ball-in-socket applied to the
// limb roots. Points + radii + blend in STAND units; the renderer scales,
// rotates to the view, samples the vajra, and projects.
export function figureVajraSpecs(positions, radii = FIGURE_RADII) {
  return FIGURE_EDGES.map(({ tri: [p, c, d], stroke, ball }) => {
    let proximal = positions[p];
    let rProximal = radii[p];
    if (ball) {
      // Smaller ball seated at the socket's limb-side edge, offset toward
      // the limb's aim — pushed forward as it articulates — plus a forward
      // + medial bias for the femoral/humeral neck angle.
      const ratio = (p === 'hipL' || p === 'hipR') ? BALL_RATIO_HIP : BALL_RATIO_SHOULDER;
      rProximal = radii[p] * ratio;
      const dir = normalize3(sub3(positions[c], positions[p]));
      const off = radii[p] - rProximal;
      const fwd = radii[p] * SOCKET_FORWARD;
      const med = radii[p] * SOCKET_MEDIAL * -Math.sign(positions[p].x || 1);
      proximal = {
        x: positions[p].x + dir.x * off + med,
        y: positions[p].y + dir.y * off + fwd,
        z: positions[p].z + dir.z * off,
      };
    }
    return {
      proximal, center: positions[c], distal: positions[d],
      rProximal, rCenter: radii[c], rDistal: radii[d],
      blend: BLEND, stroke,
    };
  });
}
