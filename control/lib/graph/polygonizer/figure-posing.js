/**
 * figure-posing — a small, analytic posing LANGUAGE that compiles intent into the
 * raw `dof` object that figure-vajra's `articulate()` already consumes.
 *
 * This adds NO new kinematics: it is a front door over the engine. You say what
 * you mean in body-relative cardinal directions ("aim the left arm forward, bend
 * the elbow half, twist the spine left") and it resolves to the signed joint
 * angles `articulate()` expects — which still owns every rotation and the LIMITS
 * clamp. So a pose authored here can never break the form, and raw `dof` still
 * works for fine control.
 *
 * Frame: BODY-relative and view-independent. The figure faces +y; +z is up; +x is
 * the figure's RIGHT. (Camera-relative directions are a deliberate non-goal here —
 * keeping posing independent of the camera; that's a later tier.)
 *
 *   resolvePose(spec)  ─▶  dof  ─▶  articulate()  ─▶  posed armature
 *
 * Tier 1 vocabulary:
 *   - aim a limb along a direction:  { armL:'forward', legR:['back','outward'] }
 *   - bend a hinge (word or degrees): { elbowL:'half', kneeR:90 }
 *   - bend the spine with words:      { spine:{ curl:.3, sideBend:['right',.4], twist:['left',.5] } }
 */
import { basePositions } from './figure-vajra.js';
import { dragCyclic } from '../../motion/easing.js';

const DEG = 180 / Math.PI;
const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x / l, a.y / l, a.z / l); };
const wrap = (a) => { let r = (a + Math.PI) % (2 * Math.PI); if (r < 0) r += 2 * Math.PI; return r - Math.PI; };

// ── body-frame cardinal directions ───────────────────────────────────────────
// (+y forward / +z up / +x = figure's right). `outward`/`inward` are limb-relative
// (away from / toward the midline) and resolve per side.
const DIRS = { up: v(0, 0, 1), down: v(0, 0, -1), forward: v(0, 1, 0), back: v(0, -1, 0), right: v(1, 0, 0), left: v(-1, 0, 0) };

/**
 * Resolve a direction spec → a unit vector in the body frame.
 * @param {string|string[]|{x,y,z}} d  a cardinal name, a {x,y,z}, or a list of
 *   names summed then normalised (e.g. ['forward','up'] = a 45° diagonal).
 * @param {number} side  -1 for a left limb, +1 for a right limb (for inward/outward)
 */
export function resolveDir(d, side = 0) {
  if (d == null) return null;
  if (Array.isArray(d)) {
    let s = v(0, 0, 0);
    for (const n of d) { const u = resolveDir(n, side); s = v(s.x + u.x, s.y + u.y, s.z + u.z); }
    return norm(s);
  }
  if (typeof d === 'object') return norm(d);
  if (d === 'outward') return side < 0 ? DIRS.left : DIRS.right;
  if (d === 'inward') return side < 0 ? DIRS.right : DIRS.left;
  const u = DIRS[d];
  if (!u) throw new Error(`figure-posing: unknown direction '${d}'`);
  return u;
}

// Rest-pose bone unit vectors (pivot → child) from the base armature. These are
// what each swivel joint rotates; aiming = the rotation that points them at a goal.
const B = basePositions();
const REST = {
  shL: norm(sub(B.elbowL, B.shoulderL)), shR: norm(sub(B.elbowR, B.shoulderR)),
  hipL: norm(sub(B.kneeL, B.hipL)), hipR: norm(sub(B.kneeR, B.hipR)),
  neck: norm(sub(B.headBase, B.neckHub)),   // neck column (flex/tilt the whole head)
  head: norm(sub(B.headTop, B.headBase)),   // skull on the atlas (nod/ear-tilt)
};

/**
 * Analytic 2-DOF swivel solve. `articulate`'s swivelSub applies yaw (about world-y)
 * THEN pitch (about world-x) to a joint's subtree; this finds the (yaw,pitch), in
 * degrees, that points the rest bone `r0` along target `t`. Returns the lower-
 * magnitude of the two valid yaw branches (the natural, least-rotation solution).
 * Out-of-cone targets are NOT clamped here — `articulate` clamps to LIMITS, so the
 * arm simply aims as far toward the goal as the form allows.
 */
export function aimSwivel(r0, t) {
  r0 = norm(r0); t = norm(t);
  const R = Math.hypot(r0.x, r0.z);
  const psi = Math.atan2(r0.z, r0.x);
  const cx = R > 1e-9 ? Math.max(-1, Math.min(1, t.x / R)) : 1;   // bone.x is set by yaw alone
  const base = Math.acos(cx);
  let best = null;
  for (const yawRaw of [psi + base, psi - base]) {
    const yaw = wrap(yawRaw);
    const c1 = Math.cos(yaw), s1 = Math.sin(yaw);
    const az = -r0.x * s1 + r0.z * c1;                              // bone.z after the yaw
    // pitch (EW) rotates the bone's (y,z) onto the target's; if either is ~0 the
    // bone already lies on the x-axis and pitch is a no-op (avoid atan2(0,0)).
    const srcYZ = Math.hypot(r0.y, az), tgtYZ = Math.hypot(t.y, t.z);
    const pitch = (srcYZ < 1e-6 || tgtYZ < 1e-6) ? 0 : wrap(Math.atan2(t.z, t.y) - Math.atan2(az, r0.y));
    const mag = Math.hypot(yaw, pitch);
    if (!best || mag < best.mag) best = { yaw: yaw * DEG, pitch: pitch * DEG, mag };
  }
  return { yaw: best.yaw, pitch: best.pitch };
}

// ── hinges (elbow / knee): a word or a number of degrees ─────────────────────
const BEND_WORDS = { straight: 0, slight: 25, half: 75, bent: 110, full: 145 };
function bendAmount(a) {
  if (typeof a === 'number') return a;
  const d = BEND_WORDS[a];
  if (d == null) throw new Error(`figure-posing: unknown bend '${a}' (use ${Object.keys(BEND_WORDS).join('/')} or degrees)`);
  return d;
}

// ── spine: friendly words → { sagittal, lateral, axial } drives ∈ [-1,1] ─────
// curl = flex forward (+sagittal); arch = extend back (−sagittal); sideBend toward
// a side; twist toward a side (twist 'left' turns the chest to the figure's left).
function resolveSpine(s) {
  const out = { sagittal: 0, lateral: 0, axial: 0 };
  if (s.sagittal != null || s.lateral != null || s.axial != null) {  // raw passthrough
    return { sagittal: s.sagittal || 0, lateral: s.lateral || 0, axial: s.axial || 0 };
  }
  if (s.curl != null) out.sagittal += s.curl;
  if (s.arch != null) out.sagittal -= s.arch;
  if (s.lean) { const [dir, amt] = s.lean; out.sagittal += (dir === 'forward' ? amt : -amt); }
  if (s.sideBend) { const [dir, amt] = s.sideBend; out.lateral += (dir === 'right' ? amt : -amt); }
  if (s.twist) { const [dir, amt] = s.twist; out.axial += (dir === 'left' ? amt : -amt); }
  return out;
}

const LIMB_TO_DOF = { armL: ['shL', -1], armR: ['shR', 1], legL: ['hipL', -1], legR: ['hipR', 1] };
const HINGES = ['elbowL', 'elbowR', 'kneeL', 'kneeR'];

// Raw-dof passthrough: the engine's OWN channels flow straight through resolvePose,
// so a spec can mix friendly words with exact dof — and the same raw dof the
// create_figure `pose` field (and the gait) emit is valid verbatim as a keyframe.
// One vocabulary across the pose field, keyframes, and the gait.
const RAW_SWIVELS = ['shL', 'shR', 'hipL', 'hipR'];
const isAngles = (o) => o != null && typeof o === 'object' && ('yaw' in o || 'pitch' in o || 'roll' in o);

/**
 * Compile a pose intent spec into the raw `dof` for `articulate()`.
 * @param {object} spec
 *   armL/armR/legL/legR : a direction to AIM the limb (string | string[] | {x,y,z})
 *   elbowL/elbowR/kneeL/kneeR : a hinge bend (word or degrees)
 *   head : a direction to aim the head (nod forward/back, tilt left/right; no turn)
 *   spine : { curl, arch, lean:[dir,amt], sideBend:[dir,amt], twist:[dir,amt] }
 *           (or raw { sagittal, lateral, axial })
 * @returns {object} dof — pass straight to articulate()/buildPosedFigure/renderFigure
 */
export function resolvePose(spec = {}) {
  const dof = {};
  for (const [limb, [dofKey, side]] of Object.entries(LIMB_TO_DOF)) {
    if (spec[limb] != null) dof[dofKey] = aimSwivel(REST[dofKey], resolveDir(spec[limb], side));
  }
  // neck/head: a direction to AIM (friendly), or raw { yaw, pitch } angles passed through.
  if (spec.neck != null) dof.neck = isAngles(spec.neck) ? { ...spec.neck } : aimSwivel(REST.neck, resolveDir(spec.neck, 0));
  if (spec.head != null) dof.head = isAngles(spec.head) ? { ...spec.head } : aimSwivel(REST.head, resolveDir(spec.head, 0));
  // raw shoulder/hip swivels ({ yaw, pitch, roll }) flow straight through.
  for (const k of RAW_SWIVELS) if (isAngles(spec[k])) dof[k] = { ...spec[k] };
  for (const h of HINGES) if (spec[h] != null) dof[h] = bendAmount(spec[h]);
  if (spec.spine) dof.spine = resolveSpine(spec.spine);
  if (spec.squash != null) dof.squash = spec.squash;   // volume-preserving deform (1 = neutral)
  if (spec.weight != null) dof.weight = spec.weight;   // −1 over left foot … +1 over right (0 = centred)
  if (spec.support != null) dof.support = spec.support; // 'both' | 'L' | 'R' | 'none' (airborne)
  if (spec.lift != null) dof.lift = spec.lift;          // root lift off the ground (STAND units; 0 = grounded)
  if (spec.crouch != null) dof.crouch = spec.crouch;    // 0 = stand … 1 = deep squat (pelvis drop, feet planted)
  if (spec.kneeOut != null) dof.kneeOut = spec.kneeOut; // squat knee tracking: + out (Russian), − together
  return dof;
}

// ── keyframe motion ──────────────────────────────────────────────────────────
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// Weighted blend of dof objects: numbers and nested {yaw,pitch,…} are summed by
// weight (an absent key counts as its neutral 0), then divided by the total weight.
function blendDof(items) {
  const acc = {};
  const str = {};       // non-numeric channels (e.g. support) — last weighted one wins
  let W = 0;
  for (const [pose, w] of items) {
    if (w <= 0) continue;
    W += w;
    for (const [k, val] of Object.entries(pose)) {
      if (typeof val === 'string') { str[k] = val; continue; }
      if (typeof val === 'number') acc[k] = (acc[k] || 0) + val * w;
      else { acc[k] = acc[k] || {}; for (const [sk, sv] of Object.entries(val)) acc[k][sk] = (acc[k][sk] || 0) + sv * w; }
    }
  }
  if (W <= 0) return {};
  const out = { ...str };
  for (const [k, val] of Object.entries(acc)) {
    if (typeof val === 'number') out[k] = val / W;
    else { out[k] = {}; for (const [sk, sv] of Object.entries(val)) out[k][sk] = sv / W; }
  }
  return out;
}

/**
 * Build a `phase → dof` motion from a list of keyposes — pass it straight to
 * renderFigureFrames as `manifest.motion`. Each keypose is a posing spec
 * (resolvePose), so a whole animation is authored in words. The motion eases
 * (smoothstep) between consecutive keyposes; `loop` (default) returns to the first
 * so it tiles seamlessly for a GIF.
 * @param {Array<object>} keyposes  posing specs, in order
 * @param {{loop?: boolean}} [opts]
 * @returns {(phase:number)=>object}  phase ∈ [0,1) → dof
 */
export function keyframeMotion(keyposes, { loop = true } = {}) {
  const poses = keyposes.map((k) => resolvePose(k));
  const n = poses.length;
  const segs = loop ? n : Math.max(1, n - 1);
  return (phase) => {
    if (n <= 1) return poses[0] || {};
    const x = (((phase % 1) + 1) % 1) * segs;
    const i = Math.min(segs - 1, Math.floor(x));
    const t = smooth(x - i);
    return blendDof([[poses[i], 1 - t], [poses[(i + 1) % n], t]]);
  };
}

// ── gait: a formalized, parameterized walk cycle ─────────────────────────────
// A gait is a per-leg PHASE MACHINE, not a pose. It returns the same `phase → dof`
// contract keyframeMotion does, and it drives the figure's GROUND/BALANCE primitives:
// each frame both feet anchor the balance solve (support 'both') and a `weight` dial
// lists the body gently toward the bearing leg, so buildPosedFigure's groundBalance
// keeps the centre of mass over a stable base. The swing foot still lifts (its knee
// bends in FK) and groundBalance holds it — a balanced walk, NOT a side-to-side lurch.
//
// (Committing the COM fully onto one foot via single-foot support — `feet:['L']` —
// over-shifts the trunk and warps the basic stance; the balanced both-feet solve with
// a gentle weight bias reads as natural walking weight-shift without the waddle.)
//
// The legs swing in the sagittal plane (hip pitch + knee bend); the planted foot
// glides backward (the treadmill) as the hip extends, the swing foot lifts via the
// knee to clear the floor. The cycle stays in place (a seamless GIF loop); stride
// scales the swing, it does not translate the root. See
// lite-template/integration/0615/figure-walk.plan.md.
const TAU_G = 2 * Math.PI;
const mag3 = (a) => Math.hypot(a.x, a.y, a.z);
const LEG_LEN = mag3(sub(B.kneeL, B.hipL)) + mag3(sub(B.ankleL, B.kneeL));   // thigh + shin (STAND units)

export const WALK_DEFAULTS = {
  strideLength: 0.33,    // fore/aft foot travel (STAND units) → hip swing amplitude (a planted
                         //   step: longer strides force the pelvis to vault deep into a crouch)
  stanceKnee: 10,        // base knee bend, degrees
  swingLift: 46,         // swing-leg knee-bend amplitude (step clearance), degrees
  armSwing: 22,          // shoulder counter-swing, degrees
  elbowBase: 16,         // base elbow bend, degrees
  elbowSwing: 14,        // elbow-bend swing amplitude, degrees
  hipSway: 0.14,         // lateral spine sway, spine-drive units
  spineTwist: 0.18,      // axial thorax counter-rotation, spine-drive units
  weightShift: 0.35,     // gentle COM list toward the bearing leg, 0..1 (0 = dead centre)
  headLevel: 7,          // head counter-yaw that holds the gaze level against the sway, degrees
  lean: 0,               // forward trunk lean / slouch (sagittal drive; + = rounded forward)
  headTilt: 0,           // forward head tilt (degrees; + = head juts forward & down, a slouch/'shaggy' read)
  vault: true,           // plant the stance foot on the floor + bob the pelvis (inverted pendulum);
                         //   false → the fixed-height both-feet balance (feet float slightly fore/aft)
  ankleRoll: 8,          // ankle range across the step: dorsiflex at heel-strike → plantarflex at toe-off (deg)
  toeRoll: 22,           // toes (MTP) dorsiflex as the foot rolls over the ball at toe-off (deg)
  cadence: 1,            // strides per loop (timing only; the walk stays in place)
};

/**
 * Build a parameterized walk cycle: `phase → dof` (pass straight to
 * renderFigureFrames as `manifest.motion`, or wrap in `performance()` for lag/idle).
 * @param {Partial<typeof WALK_DEFAULTS>} [params]
 * @returns {(phase:number)=>object} phase ∈ [0,1) → dof (incl. support/weight)
 */
export function gait(params = {}) {
  const p = { ...WALK_DEFAULTS, ...params };
  const theta = Math.asin(Math.max(-1, Math.min(1, p.strideLength / (2 * LEG_LEN)))) * DEG;   // hip swing amplitude
  const swing = (ph) => Math.max(0, Math.sin(TAU_G * ph));     // a one-sided lift over the leg's swing half
  // plantedness: 1 through a foot's stance half, dipping smoothly to 0 mid-swing (so the
  // swing foot lifts and the stance↔stance handoff through double support never snaps).
  const planted = (ph) => { const u = (((ph % 1) + 1) % 1); return 1 - (u >= 0.5 ? 0.5 * (1 - Math.cos(TAU_G * (u - 0.5) / 0.5)) : 0); };
  return (rawPhase) => {
    const phase = ((((rawPhase || 0) * p.cadence) % 1) + 1) % 1;
    const cyc = Math.cos(TAU_G * phase);                       // +1 = left leg fully forward
    const sway = Math.sin(TAU_G * (phase - 0.5));              // lists toward the bearing leg
    // Balance: both feet anchor the solve; weight lists gently toward the leg that is
    // bearing (vertical at mid-stance) — over the left near phase .25, the right near
    // .75 — bounded by weightShift so the COM never over-commits past the foot.
    const weight = -p.weightShift * Math.cos(TAU_G * (phase - 0.25));
    return {
      // legs: thigh swings (sagittal), knee bends — more on the swing leg to clear the floor.
      hipL: { pitch: theta * cyc },
      hipR: { pitch: -theta * cyc },
      kneeL: p.stanceKnee + p.swingLift * swing(phase - 0.5),
      kneeR: p.stanceKnee + p.swingLift * swing(phase),
      // ankle rolls dorsiflex (heel-strike) → plantarflex (toe-off); the toes (MTP) break
      // up over the ball at toe-off (late stance), then relax through swing.
      ankleL: p.ankleRoll * cyc,
      ankleR: -p.ankleRoll * cyc,
      toeL: p.toeRoll * Math.max(0, Math.sin(TAU_G * (phase - 0.25))),
      toeR: p.toeRoll * Math.max(0, Math.sin(TAU_G * (phase - 0.75))),
      // arms counter-swing (left arm forward with the right leg).
      shL: { pitch: -p.armSwing * cyc },
      shR: { pitch: p.armSwing * cyc },
      elbowL: p.elbowBase + p.elbowSwing * swing(phase),
      elbowR: p.elbowBase + p.elbowSwing * swing(phase - 0.5),
      // trunk: axial counter-rotation + lateral sway + optional forward lean/slouch.
      spine: { axial: p.spineTwist * Math.sin(TAU_G * phase), lateral: p.hipSway * sway, sagittal: p.lean },
      // neck juts the head forward (headTilt); head yaw counter-holds the gaze against the sway.
      neck: { pitch: -p.headTilt },
      head: { yaw: -p.headLevel * sway },
      support: 'both',
      weight,
      // vault: pin the stance foot to the floor and bob the pelvis (inverted pendulum); the
      // swing foot (low plantedness) lifts via its FK knee. Left stance ≈ [0,.5], right ≈ [.5,1].
      ...(p.vault ? { plant: { L: planted(phase), R: planted(phase - 0.5) } } : {}),
    };
  };
}

// ── sprint: a parameterized RUN cycle (a different gait — flight phase) ───────
// A run is not a walk with bigger numbers: its defining feature is the FLIGHT phase
// — for part of every stride BOTH feet are off the ground (duty factor < 0.5). So
// the sprint drives the stance/ground primitives differently from the balanced walk:
// brief SINGLE-foot contact (support 'L'/'R', the body vaults over one leg) bracketed
// by airborne flight (support 'none' → groundBalance is skipped and `lift` arcs the
// whole body up). On top of that: a hard forward lean, a long stride with a high knee
// drive, and a 90°-bent arm pump. Same `phase → dof` contract; reachable via
// resolveMotion as { sprint: {…} }.
export const SPRINT_DEFAULTS = {
  strideLength: 0.62,    // long, powerful stride → big hip swing (high knee drive in front)
  hipDrive: 1.4,         // extra THIGH lift on the forward/recovery half (high knee), ×amplitude
  stanceKnee: 12,        // base knee bend (contact), degrees
  swingTuck: 115,        // swing-leg knee fold — heel snaps toward the glute on recovery, degrees
  armSwing: 50,          // fore/aft arm pump (forward reach), degrees
  armBack: 1.5,          // extra BACKWARD shoulder drive (elbow drives behind the hip), ×armSwing
  elbowBend: 88,         // elbows held ~90° through the pump, degrees
  lean: 0.34,            // strong forward trunk lean (sagittal drive)
  anklePoint: 16,        // plantarflex bias — the sprinter runs on the forefoot, toes pointed (deg)
  toeFlick: 26,          // toes (MTP) snap up over the ball at push-off (deg)
  spineGive: 0.04,       // small sagittal PULSE around the lean — the braced trunk settles at
                         //   contact, extends through flight (2×/stride). 0 = a rigid rod.
  dutyFactor: 0.36,      // contact fraction per foot (<0.5 → a flight phase; sets the lift timing)
  flightLift: 0.07,      // vertical rise of the body at mid-flight (STAND units)
  hipSway: 0.05,         // minimal lateral sway (a sprinter runs a narrow line)
  spineTwist: 0.1,       // thorax counter-rotation against the arm drive
  headLevel: 4,          // small head counter-yaw (gaze stays downrange)
  cadence: 1,            // strides per loop
};

/**
 * Build a parameterized sprint/run cycle: `phase → dof` (with a flight phase).
 * @param {Partial<typeof SPRINT_DEFAULTS>} [params]
 * @returns {(phase:number)=>object} phase ∈ [0,1) → dof (incl. support/weight/lift)
 */
export function sprint(params = {}) {
  const p = { ...SPRINT_DEFAULTS, ...params };
  const d = Math.max(0.15, Math.min(0.49, p.dutyFactor));     // <0.5 keeps a flight phase
  const theta = Math.asin(Math.max(-1, Math.min(1, p.strideLength / (2 * LEG_LEN)))) * DEG;
  const swing = (ph) => Math.max(0, Math.sin(TAU_G * ph));
  return (rawPhase) => {
    const phase = ((((rawPhase || 0) * p.cadence) % 1) + 1) % 1;
    const cyc = Math.cos(TAU_G * phase);                       // +1 = left thigh driving forward/up
    const sway = Math.sin(TAU_G * (phase - 0.5));
    // The sprint is BALLISTIC: pure FK + a smooth 2×-per-stride vertical bob (raised cosine),
    // zero at each foot's contact centre (under the body, phase .25 / .75) and peaking
    // mid-flight — no lateral COM commit (that snapped ±0.12 every step). For real ground
    // contact (not "running on air") each foot is PINNED to the floor over a brief window at
    // its contact centre — touching down on the FOREFOOT (pin without flatten: a sprinter
    // runs on the ball, not flat). support 'none' keeps the body airborne between contacts.
    const lift = p.flightLift * 0.5 * (1 - Math.cos(2 * TAU_G * (phase - 0.25)));
    const support = 'none';
    const cHW = Math.max(0.12, d * 0.6);                       // contact half-window
    const contact = (c) => { let x = Math.abs((((phase - c) % 1) + 1) % 1); x = Math.min(x, 1 - x); return x < cHW ? 0.5 * (1 + Math.cos(Math.PI * x / cHW)) : 0; };
    // Asymmetric drives: the thigh lifts higher on the forward (high-knee) half, and
    // the shoulder drives harder on the backward swing — the sprint signature.
    const hipFwd = (c) => (c > 0 ? c * p.hipDrive : c);          // boost forward thigh flexion
    const armBk = (c) => (c > 0 ? c * p.armBack : c);            // boost backward arm drive
    return {
      // legs: big thigh swing (high knee in front); the recovery leg snaps the heel up.
      hipL: { pitch: theta * hipFwd(cyc) },
      hipR: { pitch: theta * hipFwd(-cyc) },
      kneeL: p.stanceKnee + p.swingTuck * swing(phase - 0.5),
      kneeR: p.stanceKnee + p.swingTuck * swing(phase),
      // ankles plantarflexed — running on the forefoot, toes pointed; the toes (MTP) flick
      // up over the ball at push-off (when the leg drives back, cyc < 0).
      ankleL: -p.anklePoint,
      ankleR: -p.anklePoint,
      toeL: p.toeFlick * Math.max(0, -cyc),
      toeR: p.toeFlick * Math.max(0, cyc),
      // arms held ~90°, pumped antiphase to the legs with a hard backward drive.
      shL: { pitch: -p.armSwing * armBk(cyc) },
      shR: { pitch: -p.armSwing * armBk(-cyc) },
      elbowL: p.elbowBend,
      elbowR: p.elbowBend,
      // trunk: braced but not rigid — a constant forward lean with a small sagittal pulse
      // (flex at contact, extend through flight), the dominant living motion being the
      // axial counter-rotation against the pelvis. Minimal lateral sway (a narrow line).
      spine: {
        axial: p.spineTwist * Math.sin(TAU_G * phase),
        lateral: p.hipSway * sway,
        sagittal: p.lean + p.spineGive * Math.cos(2 * TAU_G * (phase - 0.25)),
      },
      head: { yaw: -p.headLevel * sway },
      support,
      lift,
      // brief forefoot contact each stride (pin the foot to the floor; footFlat 0 = stay on the ball).
      plant: { L: contact(0.25), R: contact(0.75) },
      footFlat: { L: 0, R: 0 },
    };
  };
}

// ── performance: the 12-principles layers over a phase→dof motion ─────────────
// A dof "channel" is addressed by a dotted path: 'elbowL' (a number) or
// 'head.yaw' / 'shL.pitch' / 'spine.axial' (a nested angle). These read/write 0
// for an absent channel so a filter can lag a joint the base motion barely touches.
const getCh = (dof, path) => {
  const [a, b] = path.split('.');
  const v = b ? dof[a]?.[b] : dof[a];
  return typeof v === 'number' ? v : 0;
};
const setCh = (dof, path, val) => {
  const [a, b] = path.split('.');
  if (b) { dof[a] = dof[a] || {}; dof[a][b] = val; } else dof[a] = val;
};
const cloneDof = (dof) => {
  const out = {};
  for (const [k, v] of Object.entries(dof)) out[k] = (v && typeof v === 'object') ? { ...v } : v;
  return out;
};

const TAU = 2 * Math.PI;
// Distal channels that should TRAIL the body — the default follow-through set.
const DISTAL = ['shL.pitch', 'shR.pitch', 'elbowL', 'elbowR', 'head.yaw', 'head.pitch'];
// Leading channels that wind UP before a move — the default anticipation set
// (the body/upper-arm initiate; the distal joints then follow through).
const LEAD = ['spine.sagittal', 'spine.lateral', 'spine.axial', 'shL.pitch', 'shR.pitch'];

const scaleLeaves = (dof, s) => {
  for (const [k, v] of Object.entries(dof)) {
    if (k === 'squash' || k === 'weight' || k === 'lift' || k === 'crouch' || k === 'kneeOut') continue;   // deform/stance/root factors, not angles
    if (typeof v === 'number') dof[k] = v * s;
    else if (v && typeof v === 'object') for (const sk in v) v[sk] *= s;   // skip strings (support)
  }
};

/**
 * Wrap a `phase → dof` motion with animation-principle layers and return a new
 * `phase → dof`. Bakes the timeline at `frames` so the channel filters can act
 * over time, so render with the SAME frame count.
 *
 * Layers apply in performance order — push the poses, wind up, act, trail, live:
 *   exaggerate    — a push dial (>1): scale every dof leaf away from neutral, so
 *                   the poses reach further (the action is bolder). 1 = off.
 *   anticipation  — wind-up against the action: the lead channels dip the OTHER
 *                   way `lead` frames before a move (subtract a fraction of the
 *                   upcoming change). false to skip.
 *   followThrough — damped-spring `drag` on the distal channels: the limbs/head
 *                   lag the body and settle (overlapping action). false to skip.
 *   idle          — additive breath (subtle arch, 2×/loop) + weight-sway (1×/loop,
 *                   head counter) summed onto every frame: a held pose still lives.
 *
 * @param {(phase:number)=>object} move
 * @param {{frames?:number, loop?:boolean, exaggerate?:number,
 *          anticipation?:false|{channels?:string[],amount?:number,lead?:number},
 *          followThrough?:false|{channels?:string[],k?:number,c?:number},
 *          idle?:false|{breath?:number,sway?:number}}} [opts]
 */
export function performance(move, { frames = 30, loop = true, exaggerate = 1, anticipation = null, followThrough = {}, idle = null } = {}) {
  const table = [];
  for (let i = 0; i < frames; i++) table.push(cloneDof(move(i / frames)));
  const n = table.length;

  if (exaggerate !== 1) for (const d of table) scaleLeaves(d, exaggerate);

  if (anticipation) {
    const { channels = LEAD, amount = 0.3, lead = 3 } = anticipation;
    for (const path of channels) {
      const s = table.map((d) => getCh(d, path));
      const wound = s.map((v, i) => v - amount * (s[(i + lead) % n] - v));   // dip before the upcoming change
      table.forEach((d, i) => setCh(d, path, wound[i]));
    }
  }

  if (followThrough) {
    const { channels = DISTAL, k = 0.5, c = 0.5 } = followThrough;
    for (const path of channels) {
      const lagged = dragCyclic(table.map((d) => getCh(d, path)), k, c, loop ? 3 : 1);
      table.forEach((d, i) => setCh(d, path, lagged[i]));
    }
  }
  if (idle) {
    const { breath = 0.04, sway = 0.05 } = idle;
    table.forEach((d, i) => {
      const ph = i / frames;
      const sp = d.spine || (d.spine = { sagittal: 0, lateral: 0, axial: 0 });
      sp.sagittal = (sp.sagittal || 0) - breath * Math.sin(TAU * 2 * ph);   // inhale = slight lift/arch
      sp.lateral = (sp.lateral || 0) + sway * Math.sin(TAU * ph);            // slow weight-shift
      const hd = d.head || (d.head = {});
      hd.yaw = (hd.yaw || 0) - 7 * sway * Math.sin(TAU * ph);                // head holds level against the sway
    });
  }

  return (phase) => table[(((Math.round(((phase % 1) + 1) % 1 * n)) % n) + n) % n];
}

// ── resolveMotion: the motion front door (the phase→dof analog of resolvePose) ──
// resolvePose compiles a static pose SPEC into a dof; resolveMotion compiles a motion
// SPEC into a `phase → dof`, so the parameterized gait, keyframe motions (whose
// keyposes ARE resolvePose specs — the same body-relative word vocabulary), and the
// 12-principles `performance()` layer are all described in ONE family and reachable
// from one MCP `motion` field. This is the link: a walk is a parameterized spec in
// the same language as a hand-authored pose, not a separate procedural island.
//
//   'walk'                         → gait()                      (defaults)
//   { walk:{ strideLength, … } }   → gait({ … })                 (tuned dials)
//   { keyframes:[poseSpec, …], loop } → keyframeMotion(...)      (animate in posing words)
//   a function                     → used as-is
//   …any of the above + { perform:{ exaggerate, followThrough, idle, … } }
//                                  → wrapped with the performance layers
const isMotionSpec = (s) => s === 'walk' || s === 'sprint' || s === 'run' || typeof s === 'function'
  || !!(s && typeof s === 'object' && (s.walk || s.gait || s.sprint || s.run || Array.isArray(s.keyframes)));

/**
 * Compile a motion spec into a `phase → dof` function (or null if it isn't a motion).
 * @param {string|function|object} spec  see the table above
 * @param {{frames?:number}} [opts]  frame count for the `perform` bake (match the render)
 * @returns {?(phase:number)=>object}
 */
export function resolveMotion(spec, { frames } = {}) {
  if (typeof spec === 'function') return spec;
  if (spec === 'walk') return gait();
  if (spec === 'sprint' || spec === 'run') return sprint();
  if (!spec || typeof spec !== 'object') return null;
  const { perform, ...m } = spec;
  let move = null;
  if (m.walk || m.gait) move = gait(m.walk || m.gait);
  else if (m.sprint || m.run) move = sprint(m.sprint || m.run);
  else if (Array.isArray(m.keyframes)) move = keyframeMotion(m.keyframes, { loop: m.loop !== false });
  if (!move) return null;
  if (perform) move = performance(move, { frames, ...(perform === true ? {} : perform) });
  return move;
}
export { isMotionSpec };
