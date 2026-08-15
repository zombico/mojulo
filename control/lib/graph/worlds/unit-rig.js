/**
 * unit-rig — bake an assembled BIPED unit into the renderer's rig-figure body,
 * so a mobile suit can WALK in a world (mobile-suit-builder.plan.md R3:
 * "gait → walking units in worlds").
 *
 * The seam is deliberately short: suits are rigid-part assemblies, which is
 * exactly what the `delivery:'rig'` body already models (rigid parts + per-clip
 * pose curves; see figures/rig-bake.js and the `figure-rig` branch of
 * channels.js). This module produces the same packed shape rig-bake does, with
 * two suit-specific upgrades over the generic baker:
 *
 *   • STATION-EXACT part binding — faces bind to bones through the derived
 *     station→bone map (deriveBipedRig), not nearest-segment distance. A skirt
 *     plate near a thigh stays on the pelvis because its station says so.
 *   • EXACT bone curves — pose keys come from articulateTransforms' per-bone
 *     rigid AFFINES, not shortest-arc node pairs. Axial moves (hip yaw in a
 *     strafe) rotate a bone about its own axis without changing its direction;
 *     asymmetric armor cannot hide a dropped twist the way tube flesh can.
 *
 * The runtime formula `M·v = head' + q·(v − restHead)` is exact for any point
 * rigid with the bone, so each key stores q = quat(m) and head' = m·rh + t —
 * no approximation anywhere between the vajra kinematics and the screen.
 *
 * Frames: geometry and joints are rotated from the suit frame into the RIG
 * frame (+y forward — the frame every figure body faces; the entity's heading
 * + yawOffset orients it in the world), centered on x/y, feet at z=0.
 *
 * Stated limits (inherited from unit-pose): sealed superposition opens at
 * extreme joint angles, so the walk clip caps knee flexion below the figure
 * gait's; no ankle DOF — feet ride shins (the military-stomp read).
 */

import { articulateTransforms } from '../polygonizer/figure-vajra.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { matToQuat, packRigMesh } from '../figures/rig-bake.js';
import { DODGE_POSES } from './dodge-poses.js';
import { deriveBipedRig, SUIT_WAIST_SWIVEL } from './unit-pose.js';
import { deriveUnitAnchors } from './unit-anchors.js';
import { lowerAssemblerBuild } from './workbench-assembler.js';
import { bakeAmbientOcclusion, bakeSkyShadow } from '../effects/ao-bake.js';
import { facingYaw, WORKBENCH_LIGHT } from './workbench.js';
import { env } from './pose-env.js';
import { stampUniformMaterial } from '../polygonizer/ms-materials.js';

const DEG = Math.PI / 180;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rotZdeg = (deg) => {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};
const mvec = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
// row-major → column list (rig-bake's matToQuat reads columns)
const cols = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const mmulRows = (A, B) => A.map((r) => [
  r[0] * B[0][0] + r[1] * B[1][0] + r[2] * B[2][0],
  r[0] * B[0][1] + r[1] * B[1][1] + r[2] * B[2][1],
  r[0] * B[0][2] + r[1] * B[1][2] + r[2] * B[2][2],
]);

// Bone order is the packing contract (clips index bones by position). `head`
// names each bone's proximal joint in the derived rig — the rest reference
// point the runtime subtracts. Ids match articulateTransforms' bone table.
export const UNIT_BONES = [
  { id: 'pelvis', head: 'pelvisHub' },
  { id: 'torso', head: 'navel' },
  { id: 'head', head: 'headBase' },
  { id: 'upperArmL', head: 'shoulderL' },
  { id: 'forearmL', head: 'elbowL' },
  { id: 'upperArmR', head: 'shoulderR' },
  { id: 'forearmR', head: 'elbowR' },
  { id: 'thighL', head: 'hipL' },
  { id: 'shinL', head: 'kneeL' },
  { id: 'thighR', head: 'hipR' },
  { id: 'shinR', head: 'kneeR' },
];

// The suit gait shelf: the figure walk's phase relationships (megaboy's clips,
// the proven cadence) at reduced amplitude — hips −15%, knee capped at 38° so
// sealed superposition stays closed through the swing (a deep bend shows the
// model-kit seam), arms damped (armor mass swings less than flesh).
//
// The TRUNK works with the steps instead of riding rigid: the armature's root
// is the pelvis, so heave is expressed as articulation above it — the chest
// pitches forward at DOUBLE step frequency (each footstrike absorbs into a
// slight spine flex — `heave` peaks at p≈.25/.75, the strike phases of the
// ±sin hip swing), sways laterally toward the stance leg at step frequency,
// and the neck counter-pitches (sign verified: +pitch opposes forward flex)
// so the head stays near level while the chest does the work — the mass-shift
// read of a heavy machine, not a bob of the whole rigid body.
// A clip is either a bare poseFn (back-compat; NOT grounded) or
// { pose: poseFn, ground: bool }. GROUNDED clips get per-key SOLE GROUNDING at
// bake time: the key's whole pose shifts down so the lowest shin-bone point
// (feet ride shins) stays on z=0 — a fixed-pelvis-root armature can only
// express a crouch/bob this way (bending both knees lifts the FEET otherwise).
// On the walk, grounding is the natural gait BOB: the stance leg's pitch arc
// raises its sole, so the body dips cyclically. Ungrounded clips (boost, leap)
// hover — airborne/thruster poses own their height.
//
// env(p, pts) — the piecewise-linear envelope helper — lives in pose-env.js (a
// LEAF module): the pack's swing shelf needs it too, and importing it back out
// of THIS module would deadlock the guarded top-level-await pack seam below
// (circular TLA). See pose-env.js.

// sideKickBoost(s) — the directional lateral-dash pose builder (s = +1 dashes
// right, −1 left): travel-side leg chambered knee-up, trailing leg abducted
// out near-straight, trunk banked into the travel. See the boost_left /
// boost_right entry below for the full read.
const sideKickBoost = (s) => ({
  ground: false,
  skirt: 26,
  pose: (p) => {
    const tremor = Math.sin(p * Math.PI * 2);
    // the CHAMBERED (travel-side) leg and the EXTENDED (trailing) leg
    const chamberHip = { pitch: 56 + 2 * tremor };
    const chamberKnee = 94;
    const extendHip = { pitch: 8, yaw: 44 };   // yaw sign resolved per side below (outward abduction)
    const extendKnee = 10;
    return {
      spine: { sagittal: 0.08 + 0.01 * tremor, lateral: 0.13 * s },
      ...(s > 0
        ? { hipR: chamberHip, kneeR: chamberKnee, hipL: { pitch: extendHip.pitch, yaw: extendHip.yaw }, kneeL: extendKnee }
        : { hipL: chamberHip, kneeL: chamberKnee, hipR: { pitch: extendHip.pitch, yaw: -extendHip.yaw }, kneeR: extendKnee }),
      shL: { pitch: (s > 0 ? -26 : -12) + 2 * tremor }, shR: { pitch: (s > 0 ? -12 : -26) - 2 * tremor },
      elbowL: 16, elbowR: 16,
      neck: { pitch: 5 },
    };
  },
});

// TOPPLE_HEAP — the collapsed pose a knocked-down unit ends up in: the deepest
// buckle, folded low over jackknifed legs. It is the SEAM shared by the two
// halves of a knockdown — the `topple` fall ENDS here (p1) and the `getup` rise
// STARTS here (p0) — so the fall→rise handoff is byte-seamless, and a DOWNED
// unit simply holds this frame. One authored source of truth for both clips.
export const TOPPLE_HEAP = {
  spine: { sagittal: 0.52, lateral: -0.12 },
  hinge: 40,
  hipL: { yaw: 11, pitch: 78 }, hipR: { yaw: -11, pitch: 62 },
  kneeL: 132, kneeR: 118,
  pelvis: 16,
  neck: { pitch: 22 },
};

// TOPPLE_FLAT — the SPRAWLED pose the unit holds while LYING FLAT on the ground.
// It is a pose only: the "flat on its back" read is the ROOT TILT (a ~90° whole-
// body rotation about the lateral axis, driven by controllable-world stepReaction
// into e.tumble, grounded on a low pivot) — the articulation just opens the ball
// of the heap into a loose sprawl (legs a touch out and bent, trunk unfolded,
// head tipped back) so that once the root lays it down it reads as a felled
// machine, not a curled one. topple ENDS here (root tilted flat); getup STARTS
// here and rocks back up through the heap.
export const TOPPLE_FLAT = {
  spine: { sagittal: 0.10, lateral: 0 },
  hinge: 4,
  hipL: { yaw: 16, pitch: 34 }, hipR: { yaw: -16, pitch: 22 },
  kneeL: 54, kneeR: 40,
  pelvis: 0,
  neck: { pitch: -14 },
};

// The reaction ROOT-TILT schedule (degrees of whole-body lateral rotation, 0 =
// upright, 90 = flat on the ground). It pairs with the topple/getup POSES: the
// pose does the articulation, this does the going-OVER — a pelvis-rooted armature
// can't lay itself flat. bakeUnitRig applies it as a whole-body rotation about a
// low ground pivot per key (then grounds the whole silhouette), so it rides in
// the baked clip curves — no runtime channel. env() over [phase, degrees].
export const TOPPLE_TILT = (p) => env(p, [[0, 0], [0.5, 0], [1, 90]]);            // upright through the heap, then tip flat
export const GETUP_TILT = (p) => env(p, [[0, 90], [0.3, 45], [0.55, 12], [0.75, 0], [1, 0]]);   // sit up → plant → heap → stand

// Whole-body forward lean (deg) for the combat-crouch `forward` walk — the root-tilt
// angle the pelvis + legs + torso rotate through as one. Tune here.
const LEAN_TILT = 14;
// Forward BOOST attitude: whole-body forward pelvis tilt (deg) + how far to raise the
// pelvis off its rest height (normalized units, figure ≈ 11 tall). Tune here.
const BOOST_TILT = 20;
const BOOST_LIFT = 1.4;

export const UNIT_CLIPS = {
  // idle — the READY stance held when standing still (the runtime plays a baked
  // `idle` clip in place of the stiff rest pose). A combat-ready mecha does not
  // stand at parade attention: feet planted WIDER (hip abduction — yaw spreads
  // both legs out in the frontal plane), knees BENT with the weight sunk onto
  // the thighs (hip flex + knee bend; GROUNDED, so sole-grounding turns the bend
  // into a real settle instead of lifting the feet), torso leaned slightly
  // FORWARD (spine sagittal + a touch of pelvic hinge) with the neck
  // counter-pitched so the gaze stays level, and the arms brought off the flanks
  // into a low guard with bent elbows (fists carried ready — the closed fist
  // itself is baked geometry on these units, not a rig channel). Static (no
  // phase). On ARMED units the aim lock owns the arm channels, so the ready legs
  // + lean carry the weapon idle; the leg/torso read is shared.
  idle: {
    ground: true,
    pose: () => ({
      hipL: { yaw: 11, pitch: 5 }, hipR: { yaw: -11, pitch: 5 },
      kneeL: 22, kneeR: 22,
      spine: { sagittal: 0.13 },
      hinge: 5,
      shL: { pitch: 7, yaw: 4 }, shR: { pitch: 7, yaw: 4 },
      elbowL: 20, elbowR: 20,
      neck: { pitch: 4 },
    }),
  },
  // forward — the COMBAT-CROUCH walk (2026-07-31): a forward-leaning, thighs-bent
  // stalk instead of the upright march. The lean is a WHOLE-BODY root tilt (spec.tilt),
  // NOT an upper-body hinge: the pelvis, legs, and torso all rotate forward as one
  // rigid unit about a low ground pivot, so the body reads as a single continuous
  // incline from feet to head (an upper-body-only hinge would fold the torso over a
  // level pelvis and open the waist). Because the tilt owns the lean, the pose itself
  // just carries the CROUCH (bent thighs + a base knee bend) and the contralateral
  // swing; spine flex is trimmed to a whisper. The whole-body tilt bypasses the
  // grounding-shift path (so a gimbal unit's torso no longer floats — the tilt grounds
  // the whole silhouette). The neck counter-pitches UP hard so the gaze stays level
  // under the incline. Lean/crouch depth is broken out as constants for tuning.
  forward: {
    ground: true,
    tilt: () => -LEAN_TILT,   // − = tip forward (about +x, low pivot); pelvis+legs+torso as one
    pose: (p) => {
      const sn = Math.sin(p * Math.PI * 2);
      const heave = -Math.cos(p * Math.PI * 4);   // +1 at each footstrike
      const THIGH_FLEX = 26;     // base hip flexion (deg) — brings the feet forward under the leaned body + crouch
      const KNEE_BASE = 18;      // base knee bend (deg) — the crouch under the swing
      return {
        // thighs BENT: both hips flexed forward by THIGH_FLEX, the ±swing on top
        hipL: { pitch: THIGH_FLEX + 24 * sn }, hipR: { pitch: THIGH_FLEX - 24 * sn },
        // knees carry a base bend; the swing leg folds deeper on top of it
        kneeL: KNEE_BASE + Math.max(0, -38 * sn), kneeR: KNEE_BASE + Math.max(0, 38 * sn),
        // arms COUNTER-SWING: each arm opposes its own-side leg (shL vs hipL are
        // opposite-signed) and the two arms are anti-phase to each other (one
        // forward ⇒ the other back) — the natural contralateral gait balance.
        // Trimmed back to 14° (2026-07-23) now that the pauldron RIDES THE ARM
        // again: at the old ±22° the arm-borne cap opened a wedge at the
        // chest-side seam on the unarmed walk. (Armed units aim-lock the arms,
        // so this clip's shL/shR are overridden there — this is the unarmed read.)
        shL: { pitch: -14 * sn }, shR: { pitch: 14 * sn },
        shoulders: -8 * sn, pelvis: 5 * sn,
        spine: { sagittal: 0.06 + 0.045 * heave, lateral: 0.05 * sn },   // the tilt does the lean; spine only breathes
        neck: { pitch: LEAN_TILT + 3 + 2.2 * heave },   // counter the whole-body tilt so the head stays up
      };
    },
  },
  strafe: {
    ground: true,
    pose: (p) => {
      const sn = Math.sin(p * Math.PI * 2);
      const heave = -Math.cos(p * Math.PI * 4);
      return {
        hipL: { yaw: 14 * sn }, hipR: { yaw: -14 * sn },
        kneeL: Math.max(0, 32 * sn), kneeR: Math.max(0, -32 * sn),
        shL: { pitch: 6 }, shR: { pitch: 6 },
        spine: { sagittal: 0.03 + 0.03 * heave, lateral: 0.07 * sn },
        neck: { pitch: 1.5 + 1.5 * heave },
      };
    },
  },
  // turn — the PIVOT-IN-PLACE step (played when the heading is changing but the
  // body isn't translating — mouse-look rotation). A stationary spin would skate
  // the planted feet; instead the legs take alternating cross-steps AROUND the
  // turn. Over the ready base (wide/bent/leaned, so it reads continuous with
  // idle): each foot in turn LIFTS (knee tuck + hip flex) and swings its abducted
  // stance IN across the centerline (yaw drops 11°→−9°), then re-plants — a
  // foot-crossing shuffle. Because the whole body is rotating each frame, the
  // lifted+crossed foot visibly steps around the pivot. GROUNDED so the planted
  // foot stays on z=0. The platform rule drives gaitPhase by the signed turn
  // angle, so the two turn directions play this opposite ways (like the strafe
  // side-steps). No true foot-lock (the rig is FK, not IK) — the STEP masks the
  // residual pivot skate, the same way most mech turn-in-place clips do.
  turn: {
    ground: true,
    pose: (p) => {
      const sn = Math.sin(p * Math.PI * 2);
      const liftL = Math.max(0, sn), liftR = Math.max(0, -sn);   // alternate which foot steps
      return {
        hipL: { yaw: 11 - 20 * liftL, pitch: 5 + 24 * liftL }, hipR: { yaw: -11 + 20 * liftR, pitch: 5 + 24 * liftR },
        kneeL: 22 + 36 * liftL, kneeR: 22 + 36 * liftR,
        spine: { sagittal: 0.13, lateral: 0.05 * sn },   // weight sways onto the planted leg
        shL: { pitch: 7, yaw: 4 }, shR: { pitch: 7, yaw: 4 },
        elbowL: 20, elbowR: 20,
        neck: { pitch: 4 },
      };
    },
  },
  // boost — the thruster-flight pose, HELD (not a stride): hard forward lean
  // (spine flex + pelvic hinge), left knee tucked up, right leg trailing
  // straight back, arms swept back, head counter-pitched so the gaze stays on
  // the horizon. The phase carries only a small high-frequency TREMOR
  // (thruster shake) — and since gaitPhase advances by distance, the shake
  // rate rises with speed for free. Entering/leaving boost is the runtime's
  // existing gait-mix crossfade (advanceGaitMix slerps modes over blendTime),
  // so "going into boosting" and "stopping" are the blend, not extra clips.
  // Ungrounded on purpose: the tuck lifts the feet off the ground plane — the
  // hover read. Sign conventions verified numerically: hip/shoulder pitch + =
  // forward, hinge + = trunk tips forward, neck pitch + counters forward flex.
  boost: {
    ground: false,
    hover: true,               // tilted, but keeps its air (no floor grounding)
    tilt: () => -BOOST_TILT,   // whole-body forward PELVIS tilt (pelvis+legs+torso as one), not just a trunk hinge
    lift: BOOST_LIFT,          // raise the pelvis off its rest height (normalized units)
    skirt: 42,   // skirt plates hinge further forward with the thrust (front tilts forward 42°, rear flares back)
    pose: (p) => {
      const tremor = Math.sin(p * Math.PI * 2);
      return {
        // the root tilt now leads the forward lean through the pelvis, so the trunk hinge/flex
        // is trimmed to a light residual (it used to carry the whole lean over a level pelvis).
        spine: { sagittal: 0.14 + 0.012 * tremor },
        hinge: 5,
        hipL: { pitch: 52 }, kneeL: 68,
        hipR: { pitch: -34 }, kneeR: 12,
        shL: { pitch: -24 + 2 * tremor }, shR: { pitch: -24 - 2 * tremor },
        elbowL: 18, elbowR: 18,
        neck: { pitch: BOOST_TILT + 4 },   // counter the whole-body tilt so the gaze holds the horizon
      };
    },
  },
  // boost_back — the reverse thruster dash (F + S): the forward lean can't fly
  // backward, so the body ARCHES back instead (negative sagittal = extension),
  // legs staggered forward for balance, arms forward, gaze counter-held.
  // Skirts open the same as forward boost — the armor reads "thrusters live"
  // in every direction.
  boost_back: {
    ground: false,
    skirt: 26,
    pose: (p) => {
      const tremor = Math.sin(p * Math.PI * 2);
      return {
        spine: { sagittal: -0.14 + 0.01 * tremor },
        hipL: { pitch: 18 }, kneeL: 22,
        hipR: { pitch: 34 }, kneeR: 40,
        shL: { pitch: 18 + 2 * tremor }, shR: { pitch: 18 - 2 * tremor },
        elbowL: 14, elbowR: 14,
        neck: { pitch: -4 },
      };
    },
  },
  // boost_side — the OLD direction-agnostic lateral hover-dash: a symmetric
  // light double-tuck. Kept on the shelf as the FALLBACK for bodies baked
  // before the boost_left/boost_right split (the renderer's clip resolver
  // tries the directional name, then this, then forward).
  boost_side: {
    ground: false,
    skirt: 26,
    pose: (p) => {
      const tremor = Math.sin(p * Math.PI * 2);
      return {
        spine: { sagittal: 0.10 + 0.01 * tremor },
        hipL: { pitch: 26 }, kneeL: 40,
        hipR: { pitch: 26 }, kneeR: 40,
        shL: { pitch: -18 + 2 * tremor }, shR: { pitch: -18 - 2 * tremor },
        elbowL: 16, elbowR: 16,
        neck: { pitch: 5 },
      };
    },
  },
  // boost_left / boost_right — the DIRECTIONAL lateral dash (operator,
  // 2026-07-21): the flying-kick silhouette, boosting AWAY from the kick.
  // The travel-side leg CHAMBERS (hip flexed high, knee folded up) and the
  // trailing leg EXTENDS out sideways (hip abducted wide, knee near
  // straight) — a dash to the right reads as a right-knee-up flying kick
  // whose extended left leg trails the motion. The trunk BANKS into the
  // travel (spine.lateral: + = tilt toward the right, probe-pinned in the
  // R5.6 strike pass) with a slight forward lean. Abduction signs follow
  // the strike-stance probe: hipL yaw + / hipR yaw − spread the legs
  // OUTWARD. s = +1 dashes right, −1 dashes left.
  boost_right: sideKickBoost(1),
  boost_left: sideKickBoost(-1),
  // squat — the jump ANTICIPATION crouch, authored as a CHARGE RAMP: phase 0
  // is a light ready-crouch, phase ~0.9 the deep full-charge coil. The
  // platform rule drives gaitPhase with the charge fraction (clamped below
  // the wrap point so the ramp never interpolates deep→shallow), so the suit
  // visibly sinks as the jump charges; the brief legacy windup rides the same
  // ramp quickly. GROUNDED: sole grounding drops the whole body so the feet
  // stay planted — which is what turns "both knees bend" (feet would lift;
  // the pelvis is the root) into an actual crouch.
  squat: {
    ground: true,
    pose: (p) => {
      const t = Math.min(1, p / 0.9);
      return {
        spine: { sagittal: 0.10 + 0.16 * t },
        hinge: 6 + 10 * t,
        hipL: { pitch: 18 + 30 * t }, hipR: { pitch: 18 + 30 * t },
        kneeL: 30 + 55 * t, kneeR: 30 + 55 * t,
        shL: { pitch: -10 - 18 * t }, shR: { pitch: -10 - 18 * t },
        elbowL: 12, elbowR: 12,
        neck: { pitch: 4 + 5 * t },
      };
    },
  },
  // kneel — the one-knee-down hold (X in the platform rule): left leg planted
  // forward with the knee high, right leg folded under so the KNEE takes the
  // ground contact. GROUNDED: folding the rear shin back makes its lowest
  // point the knee itself, so sole grounding sits the body down onto it — the
  // kneel falls out of the same mechanism as the squat. Skirts hinge forward
  // so the front plates ride up over the raised thigh instead of clipping it.
  kneel: {
    ground: true,
    skirt: 30,
    pose: () => ({
      spine: { sagittal: 0.12 },
      hinge: 6,
      hipL: { pitch: 55 }, kneeL: 95,
      hipR: { pitch: -15 }, kneeR: 105,
      shL: { pitch: 14 }, elbowL: 38,
      shR: { pitch: -6 }, elbowR: 16,
      neck: { pitch: 3 },
    }),
  },
  // leap — the airborne pose, HELD for the whole flight (the platform rule
  // freezes the gait phase in the air): a light asymmetric tuck, arms back,
  // slight forward lean. Ungrounded — it is airborne by definition. A forward
  // jump plays `boost` instead (same rule, thrusters carry the arc).
  leap: {
    ground: false,
    pose: () => ({
      spine: { sagittal: 0.12 },
      hipL: { pitch: 22 }, kneeL: 34,
      hipR: { pitch: -6 }, kneeR: 14,
      shL: { pitch: -30 }, shR: { pitch: -30 },
      elbowL: 16, elbowR: 16,
      neck: { pitch: 4 },
    }),
  },
  // stagger — the HIT REACTION, a poise-break lurch (one-shot; phase 0->1 driven
  // by time in controllable-world's stepReaction, which ROOTS the unit — no verb
  // runs until it recovers). The read: the torso WHIPS back off the impact
  // (p~.07, spine extends), the knees give and the body JACKKNIFES forward over
  // them (p~.30, the deepest buckle — GROUNDED, so the knee give sinks the whole
  // body toward the ground), then a SLOW push back up to the ready stance (the
  // long tail p .30->1 — "stand up slowly", two-thirds of the clip). Asymmetric
  // knees + a lateral list read caught-off-balance, not a clean squat. Endpoints
  // agree (idle base at p 0 and 1) so it also loops seamlessly for ambient
  // preview. Authored in BODY channels only (spine / hinge / hips / knees / neck):
  // on an armed unit the aim lock owns shL/shR/elbows, so the machine buckles at
  // the waist and legs while clawing to hold its gun level — the lock leaves the
  // trunk free to lurch. Wide planted yaw keeps the base stable through the buckle.
  stagger: {
    ground: true,
    once: true,   // ONE-SHOT (2026-07-28): keys span 0..1 inclusive, sampler clamps — no wrap to key 0
    pose: (p) => ({
      spine: {
        sagittal: env(p, [[0, 0.13], [0.07, -0.24], [0.30, 0.34], [0.55, 0.22], [1, 0.13]]),
        lateral: env(p, [[0, 0], [0.12, 0.11], [0.40, -0.06], [1, 0]]),
      },
      hinge: env(p, [[0, 5], [0.30, 22], [0.6, 12], [1, 5]]),
      hipL: { yaw: 9, pitch: env(p, [[0, 5], [0.30, 42], [0.6, 20], [1, 5]]) },
      hipR: { yaw: -9, pitch: env(p, [[0, 5], [0.30, 30], [0.6, 16], [1, 5]]) },
      kneeL: env(p, [[0, 22], [0.10, 20], [0.32, 90], [0.6, 50], [0.85, 28], [1, 22]]),
      kneeR: env(p, [[0, 22], [0.10, 20], [0.32, 68], [0.6, 44], [0.85, 26], [1, 22]]),
      pelvis: env(p, [[0, 0], [0.30, 8], [1, 0]]),
      neck: { pitch: env(p, [[0, 4], [0.06, -14], [0.32, 16], [0.7, 8], [1, 4]]) },
    }),
  },
  // topple — the KNOCKDOWN FALL: hit → buckle → low HEAP → tip FLAT on the
  // ground. Two things move at once (controllable-world stepReaction drives both
  // off staggerT): this POSE, and the ROOT TILT (a whole-body lateral rotation,
  // 0°→90°, about a low ground pivot — e.tumble — so the machine actually goes
  // OVER and lies on the floor; the pelvis-rooted armature can't lay itself flat,
  // so the "flat" is the root, the pose is the sprawl). Pose waypoints: idle → hit
  // recoil (p~.08, spine extends, head snaps back) → the low HEAP crouch (p~.5,
  // TOPPLE_HEAP — the root is still upright here, the deepest buckle) → the sprawl
  // (p1, TOPPLE_FLAT, as the root tips it flat onto its back). The clip ENDS flat:
  // getup is the SEPARATE rise primitive that rocks it back up, and a DOWNED (hp≤0)
  // unit is FROZEN here (the wreck lies where it fell). Body channels only — the
  // aim lock owns the arms, so it clutches its weapon down and over.
  topple: {
    ground: true,
    once: true,   // ONE-SHOT: the wreck holds the TRUE final key (flat), never wraps toward the upright hit pose
    tilt: TOPPLE_TILT,
    pose: (p) => ({
      spine: {
        sagittal: env(p, [[0, 0.13], [0.08, -0.34], [0.5, TOPPLE_HEAP.spine.sagittal], [1, TOPPLE_FLAT.spine.sagittal]]),
        lateral: env(p, [[0, 0], [0.14, 0.16], [0.5, TOPPLE_HEAP.spine.lateral], [1, TOPPLE_FLAT.spine.lateral]]),
      },
      hinge: env(p, [[0, 5], [0.35, 26], [0.5, TOPPLE_HEAP.hinge], [1, TOPPLE_FLAT.hinge]]),
      hipL: { yaw: env(p, [[0, 11], [0.5, 11], [1, TOPPLE_FLAT.hipL.yaw]]), pitch: env(p, [[0, 5], [0.35, 58], [0.5, TOPPLE_HEAP.hipL.pitch], [1, TOPPLE_FLAT.hipL.pitch]]) },
      hipR: { yaw: env(p, [[0, -11], [0.5, -11], [1, TOPPLE_FLAT.hipR.yaw]]), pitch: env(p, [[0, 5], [0.35, 40], [0.5, TOPPLE_HEAP.hipR.pitch], [1, TOPPLE_FLAT.hipR.pitch]]) },
      kneeL: env(p, [[0, 22], [0.12, 24], [0.4, 108], [0.5, TOPPLE_HEAP.kneeL], [1, TOPPLE_FLAT.kneeL]]),
      kneeR: env(p, [[0, 22], [0.12, 24], [0.4, 84], [0.5, TOPPLE_HEAP.kneeR], [1, TOPPLE_FLAT.kneeR]]),
      pelvis: env(p, [[0, 0], [0.35, 12], [0.5, TOPPLE_HEAP.pelvis], [1, TOPPLE_FLAT.pelvis]]),
      neck: { pitch: env(p, [[0, 4], [0.08, -20], [0.5, TOPPLE_HEAP.neck.pitch], [1, TOPPLE_FLAT.neck.pitch]]) },
    }),
  },
  // getup — the RISE primitive, the recovery half of a knockdown (shared by EVERY
  // suit; the operator's ask — "if they can be toppled, animate them getting up
  // too"). It starts FLAT (TOPPLE_FLAT, root tilted ~90° on the ground) and hauls
  // the machine back onto its feet as the ROOT TILTS BACK DOWN (90°→0°, e.tumble)
  // in concert with this pose: SIT UP (p~.3 — trunk crunches forward off the
  // floor, head comes up, root ~45°), LIFT/PLANT a leg (p~.55 — the RIGHT leg
  // draws in under the hips and the foot plants, root ~12°), rock into the low
  // HEAP crouch (p~.75, TOPPLE_HEAP, both feet under, root flat/0°), then STAND to
  // the ready idle (p1). GROUNDED, so the extending knees lift the body off the
  // floor. Body channels only, like topple. stepReaction runs this INVINCIBLE (the
  // i-frame shimmer) — you can't be juggled while getting up.
  getup: {
    ground: true,
    // ONE-SHOT (2026-07-28) — the "sits down again" fix: keys used to bake at k/keys (the
    // phase-1 STAND was never baked) and the cyclic sampler's last segment interpolated back
    // toward key 0 (TOPPLE_FLAT) — so the final ~8% of a 3.9s rise visibly folded the suit
    // back down before idle snapped in. once-clips bake 0..1 inclusive and clamp at the end.
    once: true,
    tilt: GETUP_TILT,
    pose: (p) => ({
      spine: {
        sagittal: env(p, [[0, TOPPLE_FLAT.spine.sagittal], [0.3, 0.46], [0.55, 0.5], [0.75, TOPPLE_HEAP.spine.sagittal], [1, 0.13]]),
        lateral: env(p, [[0, TOPPLE_FLAT.spine.lateral], [0.55, -0.1], [0.75, TOPPLE_HEAP.spine.lateral], [1, 0]]),
      },
      hinge: env(p, [[0, TOPPLE_FLAT.hinge], [0.3, 20], [0.75, TOPPLE_HEAP.hinge], [1, 5]]),
      hipL: { yaw: 11, pitch: env(p, [[0, TOPPLE_FLAT.hipL.pitch], [0.3, 52], [0.55, 74], [0.75, TOPPLE_HEAP.hipL.pitch], [1, 5]]) },
      hipR: { yaw: -11, pitch: env(p, [[0, TOPPLE_FLAT.hipR.pitch], [0.3, 44], [0.55, 68], [0.75, TOPPLE_HEAP.hipR.pitch], [1, 5]]) },   // R plants first
      kneeL: env(p, [[0, TOPPLE_FLAT.kneeL], [0.3, 96], [0.55, 128], [0.75, TOPPLE_HEAP.kneeL], [1, 22]]),
      kneeR: env(p, [[0, TOPPLE_FLAT.kneeR], [0.3, 84], [0.55, 118], [0.75, TOPPLE_HEAP.kneeR], [1, 22]]),
      pelvis: env(p, [[0, TOPPLE_FLAT.pelvis], [0.75, TOPPLE_HEAP.pelvis], [1, 0]]),
      neck: { pitch: env(p, [[0, TOPPLE_FLAT.neck.pitch], [0.3, 12], [0.75, TOPPLE_HEAP.neck.pitch], [1, 4]]) },
    }),
  },
};

// ── swing shelf seam (extraction.plan.md W0) ─────────────────────────────────
// The melee strike choreography (SWING_STANCE + the UNIT_SWINGS shelf: chop,
// lunge thrust, diagonal slashes, cleaves, the whip verbs) is game CONTENT —
// it lives in the mobile-suit pack (mobile-suit/unit-swings.js), loaded LAZILY
// and CONTAINED like every pack seam. The merge MECHANISM stays below in
// bakeUnitRig (off-hand guard injection, grip roll, `<set>_<verb>` naming,
// twoHanded/leftHanded/ownOffHand flags). Pack absent → empty shelf: an
// opts.swings entry resolves to nothing and the unit bakes without strike
// clips.
let UNIT_SWINGS = {};
try {
  ({ UNIT_SWINGS } = await import('../mobile-suit/unit-swings.js'));
} catch (err) { console.error('mobile-suit pack absent — swing shelf empty:', err?.message); }

// contrast treatment seam (ms-contrast.plan.md SPIKE): the role-based material
// contrast treatment is game-pack CONTENT like the swing shelf — loaded lazily
// and contained. Pack absent → a `contrast` opt-in no-ops and the unit bakes
// exactly as before.
let applyContrastTreatment = null;
try {
  ({ applyContrastTreatment } = await import('../mobile-suit/ms-contrast.js'));
} catch (err) { console.error('mobile-suit pack absent — contrast treatment unavailable:', err?.message); }

// ── aim lock — arms hold a weapon-aim pose through every clip ────────────────
// The armed-walker read (mobile-suit-builder.plan.md R5): a unit carries a
// weapon rigid with forearmR, and "moving while the gun stays pointed" means
// the ARM channels are owned by the aim, not the gait — legs, pelvis, spine
// and skirts keep every clip's motion, while shL/shR/elbows are replaced and
// the shoulder girdle is zeroed (its counter-rotation would swing the gun).
//
// The trunk still leans (boost's 18° flight lean, the squat's coil), and arms
// are CHILDREN of the trunk — locked channels alone would tip the gun with the
// chest. So each key gets a STABILIZER solve: a small secant iteration on each
// shoulder's pitch delta that restores the forearm's aim orientation under
// that key's trunk channels — the gyro-stabilized weapon read. Deterministic
// (pure functions of phase), exact to <0.1°, weapon-agnostic (it holds the
// FOREARM orientation, and anything rigid with the forearm follows).
// opts.aimArms — per-arm lock mode, so a unit can hold ONE arm on the weapon aim
// while the OTHER swings with the gait (geof: left finger-vulcan hand HELD out,
// right sword hand FREE to swing). Each side is one of:
//   'lock' (default) — aim pose + the per-phase gyro-stabilizer (weapon stays pointed
//           through trunk motion); the standard armed-walker hold.
//   'hold'           — aim pose as a CONSTANT (no stabilizer solve), so the arm rides
//           the trunk's gentle sway instead of micro-correcting each step — smoother,
//           less jitter, for a bodily weapon whose exact aim doesn't matter.
//   'free'           — NOT owned by the aim; the clip's own arm channels pass through,
//           so the arm swings with the gait (idle/forward/strafe/turn). A free arm may
//           be given as { mode:'free', elbow:<deg> } to pin a CONSTANT elbow bend on top
//           of the shoulder swing (the gait clips swing only the shoulder) — a
//           bent-elbow-fist walk swing.
// Absent/`'both'` → both arms 'lock' (every existing bake is byte-identical).
// REST_ARM — the FREE-HAND rest pose (operator, 2026-07-23): a hand holding neither weapon nor
// shield settles here instead of pointing an invisible gun. The upper arm comes a touch forward
// and in, the elbow bends so the forearm angles UP-and-forward with the FIST FACING FORWARD — the
// relaxed ready guard. Used two ways (both below): the `'rest'` aim-arm mode (an always-free
// off-hand, e.g. the shieldless z/toretto left) and the `__rest` overlay selected when a loadout
// slot empties the weapon hand (`show:'none'` — head vulcan / torso beam). Symmetric so either arm
// can take it. Tunable — one pose object.
export const REST_ARM = {
  shL: { pitch: 20, yaw: 6 }, elbowL: 85,
  shR: { pitch: 20, yaw: 6 }, elbowR: 85,
};

export function aimLockClips(clips, aim = {}, joints, opts = {}) {
  const specOf = (side) => {
    const m = opts.aimArms;
    if (!m || m === 'both') return { mode: 'lock' };
    if (typeof m === 'string') return { mode: m };
    const v = m[side] || 'lock';
    return typeof v === 'string' ? { mode: v } : { mode: v.mode || 'free', elbow: v.elbow };
  };
  const specL = specOf('L'), specR = specOf('R');
  const modeL = specL.mode, modeR = specR.mode;
  // a 'rest' arm holds the free-hand REST pose (constant, no weapon-aim stabilizer); every other
  // aim-owned arm holds the weapon `aim`. 'free' keeps the clip's own swing (handled below).
  const poseFor = (mode) => (mode === 'rest' ? REST_ARM : aim);
  const armDof = (dL, dR) => {
    const o = { shoulders: 0 };
    // roll (forearm twist about its own axis) carries the FIST ORIENTATION —
    // the hammer-grip rotation solved at arm time rides every clip. A 'free' arm
    // is omitted here so the clip's own channels survive.
    if (modeL !== 'free') {
      const A = poseFor(modeL);
      o.shL = { yaw: A.shL?.yaw || 0, pitch: (A.shL?.pitch || 0) + (modeL === 'lock' ? dL : 0), ...(A.shL?.roll ? { roll: A.shL.roll } : {}) };
      o.elbowL = A.elbowL || 0;
      // wrist twist (pronation/supination about the FOREARM axis) sets the FIST GRIP —
      // it moves only handX, so it rides every clip on top of the humeral hold. Absent ⇒
      // omitted (byte-identical). NOTE this is wristL, distinct from shL.roll (humeral twist).
      if (A.wristL) o.wristL = A.wristL;
    }
    if (modeR !== 'free') {
      const A = poseFor(modeR);
      o.shR = { yaw: A.shR?.yaw || 0, pitch: (A.shR?.pitch || 0) + (modeR === 'lock' ? dR : 0), ...(A.shR?.roll ? { roll: A.shR.roll } : {}) };
      o.elbowR = A.elbowR || 0;
      if (A.wristR) o.wristR = A.wristR;
    }
    if (aim.neck) o.neck = aim.neck;
    return o;
  };
  const restDir = (side) => {
    const e = joints['elbow' + side], w = joints['wrist' + side];
    const v = [w.x - e.x, w.y - e.y, w.z - e.z];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const U = { L: restDir('L'), R: restDir('R') };
  const pitchOf = (m, u) => {
    const d = mvec(m, u);
    return Math.atan2(d[2], Math.hypot(d[0], d[1])) / DEG;
  };
  // Reference: the pure aim pose (no trunk channels) — the orientation the
  // weapon's rest placement was authored against (arm-unit mint).
  const ref = articulateTransforms(armDof(0, 0), joints).bones;
  const refPitch = { L: pitchOf(ref.forearmL.m, U.L), R: pitchOf(ref.forearmR.m, U.R) };
  const clampD = (d) => Math.max(-50, Math.min(50, d));
  // only 'lock' arms need the gyro-stabilizer solve; 'hold'/'free' don't.
  const needL = modeL === 'lock', needR = modeR === 'lock';
  const solve = (core) => {
    if (!needL && !needR) return armDof(0, 0);
    let dL = 0, dR = 0;
    const err = (a, b) => {
      const T = articulateTransforms({ ...core, ...armDof(a, b) }, joints).bones;
      return [needL ? pitchOf(T.forearmL.m, U.L) - refPitch.L : 0, needR ? pitchOf(T.forearmR.m, U.R) - refPitch.R : 0];
    };
    for (let i = 0; i < 3; i += 1) {
      const [eL, eR] = err(dL, dR);
      if (Math.abs(eL) < 0.05 && Math.abs(eR) < 0.05) break;
      const [eL2, eR2] = err(dL + 1, dR + 1);   // local slope probe (deg/deg)
      if (needL) dL = clampD(dL - eL / ((eL2 - eL) || 1));
      if (needR) dR = clampD(dR - eR / ((eR2 - eR) || 1));
    }
    return armDof(dL, dR);
  };
  const out = {};
  for (const [name, rawClip] of Object.entries(clips)) {
    const spec = typeof rawClip === 'function' ? { pose: rawClip, ground: false }
      : (rawClip && typeof rawClip.pose === 'function' ? rawClip : null);
    if (!spec) continue;
    out[name] = {
      ...spec,
      pose: (p) => {
        const base = spec.pose(p) || {};
        const { shoulders: _s, ...core } = base;
        // the aim OWNS a locked/held arm's channels (strip the clip's); a FREE
        // arm keeps the clip's own shoulder swing — with an optional CONSTANT
        // elbow bend pinned on top (the gait clips swing only the shoulder).
        if (modeL !== 'free') { delete core.shL; delete core.elbowL; }
        else if (specL.elbow != null) core.elbowL = specL.elbow;
        if (modeR !== 'free') { delete core.shR; delete core.elbowR; }
        else if (specR.elbow != null) core.elbowR = specR.elbow;
        return { ...core, ...solve(core) };
      },
    };
  }
  return out;
}

// ── auto inner frame — the manji read of the skeleton as GEOMETRY ────────────
// Joint spheres + bone-link cylinders in inner-frame graphite, bound per bone
// and superposed UNDER the armor. The payoff is at the joints: when sealed
// superposition opens at an articulated angle, the gap shows mechanical frame
// instead of void — the model-kit read, so deeper bends become safe. The vajra
// armature's manji manifestation (one sphere per node, links per edge) is
// exactly this object; here it is generated from the unit's own derived
// joints, so it retrofits any biped without authoring work.
const FRAME_LINKS = [   // [bone, from-joint, to-joint] — cylinder rides the bone
  ['pelvis', 'pelvisHub', 'navel'], ['pelvis', 'pelvisHub', 'hipL'], ['pelvis', 'pelvisHub', 'hipR'],
  ['torso', 'navel', 'neckHub'], ['torso', 'neckHub', 'shoulderL'], ['torso', 'neckHub', 'shoulderR'],
  ['head', 'neckHub', 'headBase'],
  ['upperArmL', 'shoulderL', 'elbowL'], ['forearmL', 'elbowL', 'wristL'],
  ['upperArmR', 'shoulderR', 'elbowR'], ['forearmR', 'elbowR', 'wristR'],
  ['thighL', 'hipL', 'kneeL'], ['shinL', 'kneeL', 'ankleL'],
  ['thighR', 'hipR', 'kneeR'], ['shinR', 'kneeR', 'ankleR'],
];
const FRAME_JOINTS = [  // [bone, joint] — sphere at the pivot, on the DISTAL bone
  ['upperArmL', 'shoulderL'], ['forearmL', 'elbowL'], ['thighL', 'hipL'], ['shinL', 'kneeL'],
  ['upperArmR', 'shoulderR'], ['forearmR', 'elbowR'], ['thighR', 'hipR'], ['shinR', 'kneeR'],
];
const FRAME_RGB = [0x17, 0x19, 0x1b];   // the series cards' inner-frame graphite

const vsub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vcross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Flat-shade a frame quad the way the workbench light would read it (|n·L| —
// frame faces are doubleSided, so the symmetric read is the honest one).
function frameFill(corners) {
  const n = vnorm3(vcross3(vsub3(corners[1], corners[0]), vsub3(corners[2], corners[0])));
  const L = WORKBENCH_LIGHT;
  const s = Math.min(1, L.ambient + L.diffuse * Math.abs(n[0] * L.dir[0] + n[1] * L.dir[1] + n[2] * L.dir[2]));
  return '#' + FRAME_RGB.map((c) => Math.round(c * s).toString(16).padStart(2, '0')).join('');
}
const frameFace = (corners) => ({ corners, fill: frameFill(corners), doubleSided: true });

function frameTube(a, b, r, sides = 8) {
  const axis = vnorm3(vsub3(b, a));
  const ref = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = vnorm3(vcross3(axis, ref)), v = vcross3(axis, u);
  const ring = (c) => Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
    return [c[0] + (u[0] * ct + v[0] * st) * r, c[1] + (u[1] * ct + v[1] * st) * r, c[2] + (u[2] * ct + v[2] * st) * r];
  });
  const ra = ring(a), rb = ring(b), faces = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    faces.push(frameFace([ra[i], ra[j], rb[j], rb[i]]));
  }
  return faces;
}

function frameSphere(c, r, seg = 8, rings = 5) {
  const pt = (ri, si) => {
    const phi = (ri / rings) * Math.PI, th = (si / seg) * Math.PI * 2;
    return [c[0] + r * Math.sin(phi) * Math.cos(th), c[1] + r * Math.sin(phi) * Math.sin(th), c[2] + r * Math.cos(phi)];
  };
  const faces = [];
  for (let ri = 0; ri < rings; ri += 1) for (let si = 0; si < seg; si += 1) {
    const sj = (si + 1) % seg;
    faces.push(frameFace([pt(ri, si), pt(ri, sj), pt(ri + 1, sj), pt(ri + 1, si)]));
  }
  return faces;
}

/**
 * The generated inner frame for a derived rig, as [bone → faces] in the RIG
 * frame. Radii default proportional to leg length (the suit's scale proxy);
 * override via { radius } (cylinder) — spheres ride at 1.6×.
 */
export function buildUnitFrameFaces(joints, { radius } = {}) {
  const J = (name) => { const j = joints[name]; return [j.x, j.y, j.z]; };
  const legLen = Math.hypot(...vsub3(J('hipL'), [joints.ankleL.x, joints.ankleL.y, joints.ankleL.z])) || 1;
  const r = radius ?? legLen * 0.055;
  const out = new Map();
  const push = (bone, faces) => { (out.get(bone) || out.set(bone, []).get(bone)).push(...faces); };
  for (const [bone, a, b] of FRAME_LINKS) {
    if (!joints[a] || !joints[b]) continue;
    push(bone, frameTube(J(a), J(b), r));
  }
  for (const [bone, at] of FRAME_JOINTS) {
    if (!joints[at]) continue;
    push(bone, frameSphere(J(at), r * 1.6));
  }
  return out;
}

/**
 * bakeUnitRig(manifest, opts) → the packed rig-figure shape emitThreeWorld's
 * `figures` packing passes through untouched (`rig:true`): bones + rigid parts
 * + per-clip pose curves. Reference it from a world via the `figures` map
 * (`{ unitRef }` — world-scene.js resolves the stored unit here at bake time)
 * and an entity `body:{ type:'figure-rig', figure:<name> }`.
 *
 * @param {object} manifest  a stored `assembler` unit (model:'biped' semantics —
 *   deriveBipedRig must succeed on its stations).
 * @param {number} [opts.keys=12]   pose-curve keys per clip.
 * @param {number} [opts.targetH]   normalize to this height (world units);
 *   default keeps the unit's native scale.
 * @param {object} [opts.clips=UNIT_CLIPS]  clipName → poseFn(phase∈[0,1)) → dof.
 * @param {object} [opts.rig]       precomputed deriveBipedRig result.
 * @param {boolean|object} [opts.frame]  generate the graphite inner frame
 *   (buildUnitFrameFaces) under the armor — joint gaps show frame, not void.
 *   Pass { radius } to tune. Opt-in so existing recipes render byte-identical.
 * @param {object} [opts.aim]  arm dof ({ shL, shR, elbowL, elbowR, neck? }) —
 *   wraps the clip shelf through aimLockClips so the arms (and any weapon
 *   rigid with them) hold this pose, stabilized, through every clip.
 * @param {string[]} [opts.swings]  pack swing-shelf names (mobile-suit/unit-swings.js; ['neutral']) to bake as
 *   `swing_<name>` clips. Merged AFTER the aim wrap, unlocked — a strike's
 *   arm channels ARE the animation, the deliberate aim-lock break.
 * @param {string[]} [opts.dodges]  DODGE_POSES names (dodge_roll/backflip/
 *   sideroll/spin) to bake as the acrobatic-dodge maneuver clips. Merged AFTER
 *   the aim wrap, unlocked — a dodge is a whole-body tumble that breaks the aim
 *   (you roll, you don't hold the gun level). The compact tuck/pike SHAPE is
 *   what this bakes; the head-over-heels root tumble is a runtime channel.
 */
// hover — the toretto-type GROUND locomotion clip: a thruster HOVER, never a
// walk. A SYMMETRIC settled tuck (both legs identical → no stride, no
// footstrike, no leg cycle), `ground:false` so the feet lift off the plane (the
// low ground-hover read), a slight forward glide-lean, arms in a low ready. A
// gentle bob rides the clip phase — the platform rule advances that phase by
// travel distance, so the unit bobs as it slides and settles when it stops.
// The pelvis is the fixed rig root, so the bob is expressed through the legs
// (feet rise/fall) + a spine breath, not a pelvis-z translation (the armature's
// documented crouch/bob limitation). Baked ONLY onto units that declare
// `locomotion:'hover'` (see bakeUnitRig); every other suit is untouched.
export const HOVER_CLIP = {
  ground: false,
  skirt: 10,   // thrusters idling: skirt plates cracked slightly open
  pose: (p) => {
    const bob = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: 0.09 + 0.02 * bob },
      hinge: 4,
      hipL: { yaw: 10, pitch: 16 + 5 * bob }, hipR: { yaw: -10, pitch: 16 + 5 * bob },
      kneeL: 26 + 9 * bob, kneeR: 26 + 9 * bob,
      shL: { pitch: 8, yaw: 5 }, shR: { pitch: 8, yaw: 5 },
      elbowL: 22, elbowR: 22,
      neck: { pitch: 3 + 1.5 * bob },
    };
  },
};

// hover forward — the GLIDE: the settled hover leaned INTO the travel, with the
// skirt plates raised well clear of the under-skirt thrust (22°, between the
// idle crack and the full boost flare). This is what makes a hover unit's rear
// skirt visibly LIFT when it slides forward — idle and glide were the same clip
// before, so ground travel never moved the plates. Same bob mechanism as
// HOVER_CLIP (gaitPhase advances by distance, so the bob rate rides speed).
export const HOVER_FORWARD_CLIP = {
  ground: false,
  skirt: 22,
  pose: (p) => {
    const bob = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: 0.16 + 0.02 * bob },
      hinge: 7,
      hipL: { yaw: 10, pitch: 20 + 5 * bob }, hipR: { yaw: -10, pitch: 20 + 5 * bob },
      kneeL: 30 + 9 * bob, kneeR: 30 + 9 * bob,
      shL: { pitch: 2, yaw: 5 }, shR: { pitch: 2, yaw: 5 },
      elbowL: 22, elbowR: 22,
      neck: { pitch: 6 + 1.5 * bob },
    };
  },
};

// ── SPACE thrust clips (R18) — used ONLY when a unit is baked `space:true` (bakeUnitRig, below).
// A suit never WALKS in space; it thrusts. A 3-rung intensity ladder (idle float → soft forward/strafe
// thrust → full boost, the existing boost_* clips) plus dedicated ascend/descend poses, all
// `ground:false` (feet off the plane) with a tremor that rides the gait phase. The platform space rule
// advances that phase by travel SPEED, so the shake rises with velocity — "boost + ascend + descend
// speed up the animation." Baked ONLY onto space units; every other suit is byte-identical.

// soft forward thrust — the operator's "less intense thrust pose": a gentle version of the boost lean.
const SPACE_FORWARD = {
  ground: false,
  skirt: 14,
  pose: (p) => {
    const tremor = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: 0.18 + 0.02 * tremor },
      hinge: 8,
      hipL: { pitch: 30 }, kneeL: 38,
      hipR: { pitch: -14 }, kneeR: 16,
      shL: { pitch: -8 + 2 * tremor }, shR: { pitch: -8 - 2 * tremor },
      elbowL: 20, elbowR: 20,
      neck: { pitch: 5 },
    };
  },
};
// soft lateral thrust — a gentle symmetric double-tuck (milder boost_side).
const SPACE_STRAFE = {
  ground: false,
  skirt: 14,
  pose: (p) => {
    const tremor = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: 0.10 + 0.02 * tremor },
      hipL: { pitch: 22 }, kneeL: 30,
      hipR: { pitch: 22 }, kneeR: 30,
      shL: { pitch: -10 + 2 * tremor }, shR: { pitch: -10 - 2 * tremor },
      elbowL: 18, elbowR: 18,
      neck: { pitch: 3 },
    };
  },
};
// ascend — thrust UP: the main jets fire DOWNWARD, so the legs extend down-and-together (streamlined
// upward) and the trunk extends (a slight back-arch, gaze up). A stronger tremor than the soft walk.
const SPACE_ASCEND = {
  ground: false,
  skirt: 30,
  pose: (p) => {
    const tremor = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: -0.10 + 0.03 * tremor },   // extension = arch back / look up
      hinge: 0,
      hipL: { pitch: -8, yaw: 6 }, kneeL: 8,
      hipR: { pitch: -8, yaw: -6 }, kneeR: 8,        // legs straight + together, trailing down
      shL: { pitch: 6 + 3 * tremor }, shR: { pitch: 6 - 3 * tremor },
      elbowL: 16, elbowR: 16,
      neck: { pitch: -10 },                          // head up toward the climb
    };
  },
};
// descend — thrust DOWN: the top/retro jets fire UP, so the knees TUCK up and the body curls slightly
// forward (settling), gaze down.
const SPACE_DESCEND = {
  ground: false,
  skirt: 22,
  pose: (p) => {
    const tremor = Math.sin(p * Math.PI * 2);
    return {
      spine: { sagittal: 0.24 + 0.03 * tremor },     // curl forward
      hinge: 20,
      hipL: { pitch: 46 }, kneeL: 54,
      hipR: { pitch: 46 }, kneeR: 54,                // knees drawn up (tuck)
      shL: { pitch: 4 + 3 * tremor }, shR: { pitch: 4 - 3 * tremor },
      elbowL: 22, elbowR: 22,
      neck: { pitch: 14 },                           // head down toward the descent
    };
  },
};

// ── rig-bake LRU (CACHE, not persistence — the same discipline as ao-bake's AO_CACHE) ─────────
// bakeUnitRig is a pure function of (manifest, opts) — deterministic by doctrine (seeded dice
// only) — and an arena LEVEL resolve calls it for the whole roster (7 suits + 7 livery variants),
// at ~1s per bake even with `ao` off. Every one of the game's 35 mode×map levels re-bakes the SAME
// suits, so a keyed cache turns every level bake after the first into a lookup. The key hashes the
// manifest + opts JSON; bakes carrying non-serializable overrides (`clips` pose functions, a `rig`
// override) BYPASS the cache. Hits return a shallow-protected copy — top level, `clips`, and each
// part object are fresh (`previewClip` reassigns clips; `weatherRigParts` replaces part.col), the
// heavy base64 buffers are shared immutably. ~10MB per entry; 32 ≈ the ground + space arena
// rosters with headroom.
const RIG_CACHE = new Map();
const RIG_CACHE_MAX = 32;

function rigCacheKey(manifest, opts) {
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  const mix = (s) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2 ^ (h2 >>> 15), 0x85ebca6b) + c) >>> 0;
    }
  };
  const m = JSON.stringify(manifest), o = JSON.stringify(opts, (k, v) => (v === undefined ? null : v));
  mix(m); mix(' '); mix(o);
  return `${h1.toString(36)}:${h2.toString(36)}:${m.length}:${o.length}`;
}

export function bakeUnitRig(manifest = {}, opts = {}) {
  // Function-bearing overrides don't key — EXCEPT a `prelit` recolour whose caller declares its
  // identity via `prelitKey` (the bound-mesh path; bind slots are append-only, so the path names
  // the bake content). JSON.stringify drops the closure from the key and the path stands in for
  // it, so the arena's GI-baked roster caches across level resolves instead of re-baking all
  // seven suits on every mode×map cell (the post-prelit-fleet cold-load regression).
  if (opts.clips || opts.rig || (opts.prelit && typeof opts.prelitKey !== 'string')) return bakeUnitRigUncached(manifest, opts);
  const key = rigCacheKey(manifest, opts);
  let baked = RIG_CACHE.get(key);
  if (baked) {
    RIG_CACHE.delete(key); RIG_CACHE.set(key, baked);   // LRU touch
  } else {
    baked = bakeUnitRigUncached(manifest, opts);
    RIG_CACHE.set(key, baked);
    if (RIG_CACHE.size > RIG_CACHE_MAX) RIG_CACHE.delete(RIG_CACHE.keys().next().value);
  }
  return { ...baked, clips: { ...baked.clips }, parts: baked.parts.map((p) => (p ? { ...p } : p)) };
}

function bakeUnitRigUncached(manifest = {}, { keys = 12, targetH = null, clips = UNIT_CLIPS, rig: rigOverride, frame = false, frameOnly = false, pose = null, aim = null, swings = null, dodges = null, space = false, aimArms = null, weldOffHand = false, material = null, contrast = null, ao = null, shade = null, light = null, prelit = null, noWeapons = false } = {}) {
  // pose (posing studio): HOLD a single authored DOF instead of the gait shelf —
  // every clip becomes this static pose, so an ambient clock world displays the suit
  // frozen in it. The clean surface for authoring a pose from scratch (no aim lock, no
  // weapons). A plain DOF object ({ shR:{pitch}, elbowR, hipL:{...}, spine:{...}, … }).
  if (pose && typeof pose === 'object') {
    clips = { idle: { ground: true, pose: () => pose }, forward: { ground: true, pose: () => pose } };
  }
  // frameOnly (skinless read): bake JUST the generated inner frame — the manji
  // stick figure of the derived rig — with NONE of the suit's armor/livery
  // faces. The bones, joints, clips and grounding are IDENTICAL to a full bake,
  // so the walk (and every other clip) reads exactly as it drives the suit;
  // only the skin is stripped. Forces the frame on and skips the armor placement
  // buckets below. Opt-in → a normal bake is byte-identical.
  //   frameOnly: { keep: 'foot' }  — KEEP the armor stations whose id matches
  //   (regex source string, or array of substrings) while stripping the rest:
  //   the stick figure wearing ONLY those pieces. Used to isolate one armor group
  //   (e.g. the feet) so its effect on the walk's sole-grounding can be examined
  //   against the bare frame.
  const frameKeep = (frameOnly && typeof frameOnly === 'object' && frameOnly.keep)
    ? (Array.isArray(frameOnly.keep)
      ? new RegExp(frameOnly.keep.map((s) => String(s)).join('|'), 'i')
      : new RegExp(String(frameOnly.keep), 'i'))
    : null;
  // material (specular finish): stamp one material-shelf finish onto every body panel
  // so the suit catches a live highlight through the World's specular channel. Diffuse-
  // preserving by default (only the highlight is added). null → byte-identical bake.
  // Role-differentiated finishes come from the g/z liveries; this is the uniform
  // clear-coat for a base unit that carries no livery role split.
  if (material != null) manifest = stampUniformMaterial(manifest, material);
  // contrast (ms-contrast.plan.md SPIKE): the opt-in role-based material-contrast
  // treatment — value separation + finishes rewritten on a manifest clone, plus a
  // rim spec carried through to the payload for the gated runtime fresnel term.
  // null → byte-identical bake (the isolation contract).
  let contrastRim = null;
  if (contrast != null && contrast !== false && applyContrastTreatment) {
    const treated = applyContrastTreatment(manifest, contrast);
    manifest = treated.manifest;
    contrastRim = treated.rim;
  }
  const rig = rigOverride || deriveBipedRig(manifest);
  if (space) {
    // SPACE units (R18) — the second play mode: the suit FLOATS and thrusts, never walks. Swap every
    // ground gait clip (idle/forward/strafe/turn) for thrust poses and ADD ascend/descend, so whatever
    // the platform space rule selects, the body thrusts. Idle reuses the HOVER float (thrusters idling).
    // Boost / leap / squat / kneel are left alone. Gated on the bake option → non-space bakes identical.
    clips = { ...clips, idle: HOVER_CLIP, forward: SPACE_FORWARD, strafe: SPACE_STRAFE, turn: SPACE_FORWARD,
      ascend: SPACE_ASCEND, descend: SPACE_DESCEND };
  }
  if (manifest.locomotion === 'hover') {
    // HOVER units (toretto-type) glide on the ground — they never walk. Replace
    // every GROUND gait clip (idle/forward/strafe/turn) with the settled hover
    // float, so whatever the platform rule selects on the ground, the body
    // hovers: it is structurally incapable of showing a walk stride. Forward
    // takes the GLIDE variant (leaned in, rear skirt lifted 22° off the
    // under-skirt thrusters) so traveling visibly differs from idling. Boost /
    // leap / squat / kneel are left alone (airborne dashes + jumps still read).
    // Gated on the unit manifest → non-hover suits bake byte-identically.
    clips = { ...clips, idle: HOVER_CLIP, forward: HOVER_FORWARD_CLIP, strafe: HOVER_CLIP, turn: HOVER_CLIP };
  }
  // the RAW (pre-aim-lock) clip shelf — re-wrapped below with any weapon's alternate
  // arm pose (aimAlt) to bake the per-slot arm overlays (R17, over-shoulder bazooka).
  const preAimShelf = clips;
  // FREE OFF-HAND (opt-in `manifest.restOffHand`): a suit with no shield whose off-hand holds no
  // weapon settles the LEFT arm into the REST pose (bent up, fist forward) instead of the solved
  // off-hand guard. Force that side to the 'rest' aim-arm mode; gated on the absence of shield
  // geometry so it never un-seats a shield arm. `effAimArms` is the aimArms used for every wrap
  // below (base + weapon overlays) so the rest read is consistent across clips and slots.
  const hasShieldItem = Array.isArray(manifest.items) && manifest.items.some((it) => /shield/.test(String(it.id || '').toLowerCase()));
  const restOffHand = manifest.restOffHand === true && !hasShieldItem;
  const normR = (typeof aimArms === 'object' && aimArms && aimArms.R) ? aimArms.R
    : (typeof aimArms === 'string' && aimArms !== 'both' ? aimArms : 'lock');
  const effAimArms = restOffHand ? { L: 'rest', R: normR } : aimArms;
  if (aim && typeof aim === 'object') {
    // Armed idle: an explicit `idle` clip (grounded, legs at rest, arms in the
    // aim) so standing still HOLDS the weapon instead of dropping to the raw
    // rest pose — the runtime plays a baked idle clip when one exists.
    clips = aimLockClips({ idle: { ground: true, pose: () => ({}) }, ...clips }, aim, rig.joints, { aimArms: effAimArms });
  }
  if (Array.isArray(swings) && swings.length) {
    // The off-hand HOLDS through a strike (swing specs author no left-arm
    // channels): inject the unit's own guard — the aim's solved left arm
    // when armed, the authored default guard otherwise — as constants.
    const offHand = restOffHand
      ? { shL: REST_ARM.shL, elbowL: REST_ARM.elbowL }   // a free off-hand rests through the strike too
      : aim && typeof aim === 'object'
        ? { ...(aim.shL ? { shL: aim.shL } : {}), ...(aim.elbowL != null ? { elbowL: aim.elbowL } : {}) }
        : { shL: { pitch: 32, yaw: -18 }, elbowL: 60 };
    // The GRIP ROLL rides the swing: the aim's forearm twist (the hammer-grip
    // fist orientation) is injected into the swing arm's shR, so the blade
    // plane stays PERPENDICULAR to the ground through the whole downswing —
    // without it the fist untwists mid-swing and the blade slaps flat.
    const gripRoll = aim && typeof aim === 'object' && aim.shR && aim.shR.roll ? aim.shR.roll : 0;
    const gripRollL = aim && typeof aim === 'object' && aim.shL && aim.shL.roll ? aim.shL.roll : 0;
    const add = {};
    for (const name of swings) {
      // A swing entry is either a shelf key (string → swing_<key>) or a mapping
      // { as, from, set }: `as` is the VERB the melee rule fires (<set>_<as>,
      // set defaulting to 'swing'), `from` the shelf pose it plays — so a unit
      // can bind its own choreography to a verb (toretto's `neutral` → the
      // diagonal `slash_up`, its `back` → the two-handed `cleave_2h`), and a
      // second melee slot can bake its OWN clip set beside the first (the geof
      // heat rod's `set:'whip'` → whip_<verb>, fired by the slot's swingSet).
      // A spec flagged `twoHanded` authors its OWN left arm (both hands on the
      // hilt), so the off-hand guard is NOT injected over it. A spec flagged
      // `leftHanded` (the whip) authors shL/elbowL as the STRIKE arm — the
      // injected hold flips to the RIGHT arm, which settles into the free-hand
      // rest guard (its weapon is racked while such a slot is active).
      const verb = typeof name === 'string' ? name : name.as;
      const shelfKey = typeof name === 'string' ? name : (name.from || name.as);
      const setName = typeof name === 'string' ? 'swing' : (name.set || 'swing');
      const spec = UNIT_SWINGS[shelfKey];
      if (!spec || !verb) continue;
      const twoHanded = !!spec.twoHanded;
      const leftHanded = !!spec.leftHanded;
      // ownOffHand: the spec authors its OWN off-hand (shL/elbowL) and does NOT want the
      // injected guard stamped over it — e.g. a one-hand swing that holds the free arm
      // relaxed/down instead of the raised guard. (twoHanded implies the same skip.)
      const ownOffHand = twoHanded || !!spec.ownOffHand;
      add[`${setName}_${verb}`] = {
        ...spec,
        pose: (p) => {
          const d = spec.pose(p);
          return leftHanded
            ? {
              ...d,
              ...(gripRollL ? { shL: { ...(d.shL || {}), roll: (d.shL && d.shL.roll) || gripRollL } } : {}),
              ...(twoHanded ? {} : { shR: REST_ARM.shR, elbowR: REST_ARM.elbowR }),
            }
            : {
              ...d,
              ...(gripRoll ? { shR: { ...(d.shR || {}), roll: (d.shR && d.shR.roll) || gripRoll } } : {}),
              ...(ownOffHand ? {} : offHand),
            };
        },
      };
    }
    clips = { ...clips, ...add };
  }
  if (Array.isArray(dodges) && dodges.length) {
    // Dodges bake beside the gait (unlocked, like swings): the acrobatic
    // maneuver owns the whole body, so it merges after the aim wrap.
    const add = {};
    for (const name of dodges) {
      // HOVER units (toretto-type) dodge with an AERIAL acrobatic twirl instead
      // of the bulky grounded brace: keep the clip NAME `dodge_twirl` (so the
      // rule's `dodge:'twirl'` lookup still finds it) but bake the airborne
      // pull-in-spin pose. Every other unit bakes the requested pose verbatim.
      const src = (manifest.locomotion === 'hover' && name === 'dodge_twirl' && DODGE_POSES.dodge_airtwirl)
        ? DODGE_POSES.dodge_airtwirl
        : DODGE_POSES[name];
      if (src) add[name] = src;
    }
    clips = { ...clips, ...add };
  }
  const A = rotZdeg(-facingYaw(manifest.facing));   // suit → rig frame
  // UNSHADED export (interchange.plan.md I5): `light` is FLAT_LIGHT (ambient 1 / diffuse 0),
  // threaded through the assembler's per-part bake so every armor face lowers at raw livery
  // albedo — no Lambert directional term. null (the universal case) → WORKBENCH_LIGHT default in
  // walkAssembler, byte-identical. The suit's own baked darkening passes (ao / shade / contrast /
  // material) are additionally forced off by the caller (world-scene unitRef path) when unshaded.
  const { faces, placements } = lowerAssemblerBuild(manifest, light ? { light } : {});
  if (!faces.length) throw new Error('bakeUnitRig: unit lowered to no faces');

  // Group rig-frame faces per bone through the station map. A bone name outside
  // the render set (an exotic manifest.rig override) rides the torso rather
  // than silently dropping geometry. SKIRT stations (id matches /skirt/, bone
  // pelvis) split off into synthetic skirtF/skirtR bones that RIDE the pelvis
  // but can take a per-clip hinge tilt (the boost read): named front/rear wins,
  // else the station's rig-frame y-center decides (front = +y).
  //
  // PAULDRON stations (id matches /shoulder|pauldron|spaulder|deltoid/, bone
  // upperArmL/R) split off into synthetic shoulderCapL/R bones that RIDE THE
  // ARM (operator, 2026-07-23): the pauldron is armor MOUNTED ON the upper arm,
  // so it moves WITH the arm — it elevates when the gun arm tracks look-pitch
  // (R17.1), and follows swings/dodges — rather than sitting statically affixed
  // to the chest. The cap pivots on the shoulder joint (the arm bone's own
  // head), so riding upperArmL/R rotates the plate EXACTLY as if welded to the
  // bicep. The prior design rode the TORSO to avoid a wedge of void opening at
  // the chest-side seam under a big pitch swing; with armed units the arms are
  // aim-locked (near-static), so the follow win dominates and the residual seam
  // only shows at the extremes (the unarmed walk swing was trimmed to suit —
  // see the forward clip). Still split off as its own synthetic bone so the
  // ride is a one-line dial (rides: 'upperArmL'/'R' ↔ 'torso'). Geometry-driven
  // like the skirt split: a unit with no separate shoulder station is
  // byte-identical.
  const boneFaces = new Map(UNIT_BONES.map((b) => [b.id, []]));
  // FRONT skirt splits per-side (skirtFL/FR ride the pelvis but each is PUSHED by its own
  // thigh's forward swing so the plate rides ON TOP of the leg instead of clipping through it;
  // skirtFC is the center/crotch plate — pelvis-bound, leg-agnostic). REAR stays one bone.
  for (const id of ['skirtFL', 'skirtFC', 'skirtFR', 'skirtR', 'shoulderCapL', 'shoulderCapR']) boneFaces.set(id, []);
  const SYNTH_IDS = new Set(['skirtFL', 'skirtFC', 'skirtFR', 'skirtR', 'shoulderCapL', 'shoulderCapR']);
  const PAULDRON_RE = /shoulder|pauldron|spaulder|deltoid/;
  // WELD OFF-HAND (spike, opt-in `weldOffHand`): the LEFT (off-hand) arm is welded to the CHEST.
  // Every left-arm face buckets into a synthetic `offArmL` bone that RIDES the torso rigidly (the
  // same primitive a racked weapon / shoulder cap use), so the arm holds a CONSTANT shape and
  // rotates ONLY with the chest swivel — it is never posed by shL/elbowL, the aim, or the off-hand
  // injection, which is exactly what was fighting over it. Gated → default bake is byte-identical.
  const LEFT_ARM_BUCKETS = new Set(['upperArmL', 'forearmL', 'handL', 'shoulderCapL']);
  if (weldOffHand) { boneFaces.set('offArmL', []); SYNTH_IDS.add('offArmL'); }
  // CONSOLIDATED MULTI-WEAPON (R15): a manifest may carry `armory.weapons` — several weapons all
  // bound to forearmR at the grip, each TAGGED for a loadout slot. Each tag's faces split off into a
  // synthetic `weapon_<tag>` bone that RIDES forearmR rigidly (like the pauldron caps ride the torso),
  // so the renderer can toggle which weapon is visible on ONE baked body instead of swapping whole
  // per-weapon figures. A single-weapon unit (no armory.weapons) is byte-identical.
  const weaponTagOf = {};
  // per-weapon RIDES override: a weapons[] entry may declare `rides:'torso'` — a RACKED/stowed
  // copy (a saber on the back) that transforms with the chest instead of the fist. Or `rides:'forearmL'`
  // — an OFF-HAND weapon (a dual-wield pistol) riding the left arm exactly as the shield does. Or
  // `rides:'pelvis'` — a waist/skirt rack (geof's back-skirt sword, the heat rod's hip coil) that
  // stays seated through the gait. Still a weapon_<tag> toggle bone, so a slot's `show` list can
  // rack it while another weapon is drawn. (An undeclared/unknown rides falls to forearmR — which
  // silently made the pelvis-declared sword stow SWING with the free right arm; 'pelvis' is now real.)
  const weaponRideOf = {};
  for (const w of (manifest.armory && Array.isArray(manifest.armory.weapons) ? manifest.armory.weapons : [])) {
    if (w && w.id && w.tag) {
      weaponTagOf[w.id] = w.tag;
      // a held weapon rides the HAND bone (handR / off-hand handL) so a wrist DOF
      // aims it; racked copies ride torso/pelvis. handX == forearmX with no wrist
      // dof, so unarmed-of-wrist units stay byte-identical.
      weaponRideOf[w.tag] = w.rides === 'torso' ? 'torso' : w.rides === 'forearmL' ? 'handL'
        : w.rides === 'pelvis' ? 'pelvis' : 'handR';
      boneFaces.set('weapon_' + w.tag, boneFaces.get('weapon_' + w.tag) || []);
    }
  }
  for (const id of Object.keys(weaponTagOf)) SYNTH_IDS.add('weapon_' + weaponTagOf[id]);
  // R19: the off-hand SHIELD splits into a synthetic `shield` bone (rides forearmL rigidly) so the
  // renderer can HIDE it when it breaks — byte-identical to the forearmL-bucketed shield while shown.
  const hasShield = placements.some((pl) => /shield/.test(String(pl.id || '').toLowerCase()));
  if (hasShield) { boneFaces.set('shield', boneFaces.get('shield') || []); SYNTH_IDS.add('shield'); }
  // WRIST DOF: bake the hand bones (handL/handR) ONLY when something binds to them —
  // a face station (rig.bones) or a weapon riding the hand (weaponRideOf). Units with no
  // wrist stay byte-identical (nothing maps to handX, so it's never added). handX rides
  // the wrist node, so at wrist=0 it tracks the forearm exactly — a held saber lands in the
  // FIST. Without this the hand bone is absent from UNIT_BONES, so saber_hand_r → handR
  // fails `boneFaces.has(bone)` and the blade falls to the torso bucket (the "saber adrift"
  // bug on the wrist-patched studio unit).
  const handUse = new Set([...Object.values(rig.bones), ...Object.values(weaponRideOf)]);
  const handBones = [];
  for (const [id, head] of [['handR', 'wristR'], ['handL', 'wristL']]) {
    if (handUse.has(id)) { if (!boneFaces.has(id)) boneFaces.set(id, []); handBones.push({ id, head }); }
  }
  for (const pl of placements) {
    const key = pl.id || String(pl.index);
    // skinless read: strip armor (the frame block below is the whole body), but
    // KEEP any station matching frameKeep — the stick figure wearing only those pieces.
    if (frameOnly && !(frameKeep && frameKeep.test(key))) continue;
    const bone = rig.bones[key];
    const rotated = [];
    for (let i = pl.faceStart; i < pl.faceStart + pl.faceCount; i += 1) {
      const f = faces[i];
      rotated.push({ ...f, corners: f.corners.map((c) => mvec(A, c)) });
    }
    let bucketId = boneFaces.has(bone) && !SYNTH_IDS.has(bone) ? bone : 'torso';
    if (weaponTagOf[key]) bucketId = 'weapon_' + weaponTagOf[key];   // a tagged weapon → its own toggle bone
    else if (/shield/.test(key.toLowerCase())) bucketId = 'shield';   // R19: the shield → its own toggle bone (hide on break)
    else if (bone === 'pelvis' && /skirt/.test(key.toLowerCase())) {
      const lower = key.toLowerCase();
      // front vs rear: named wins, else the plate's y-center (front = +y in the rig frame).
      let front;
      if (/front|fore/.test(lower)) front = true;
      else if (/rear|back/.test(lower)) front = false;
      else {
        let sy = 0, n = 0;
        for (const f of rotated) for (const c of f.corners) { sy += c[1]; n += 1; }
        front = n ? sy / n >= rig.joints.pelvisHub.y : true;
      }
      if (!front) bucketId = 'skirtR';
      else {
        // Split the FRONT skirt per-face by rig-frame x: the left/right side plates ride their
        // own thigh (pushed clear of the leg), the center/crotch plate stays pelvis-bound. The
        // band is inboard of each hip (0.45·hipX) — it falls in the gap between the side plates
        // and the center plate on every skirted suit (g/z/geof), so no plate is torn.
        const midL = rig.joints.hipL.x * 0.45, midR = rig.joints.hipR.x * 0.45;
        for (const f of rotated) {
          let sx = 0, n = 0;
          for (const c of f.corners) { sx += c[0]; n += 1; }
          const cx = n ? sx / n : 0;
          boneFaces.get(cx < midL ? 'skirtFL' : cx > midR ? 'skirtFR' : 'skirtFC').push(f);
        }
        continue;   // faces distributed per-side; skip the bulk push below
      }
    } else if ((bone === 'upperArmL' || bone === 'upperArmR') && PAULDRON_RE.test(key.toLowerCase())) {
      bucketId = bone === 'upperArmL' ? 'shoulderCapL' : 'shoulderCapR';
    }
    if (weldOffHand && LEFT_ARM_BUCKETS.has(bucketId)) bucketId = 'offArmL';   // weld the whole left arm to the chest
    boneFaces.get(bucketId).push(...rotated);
  }
  // Synthetic skirt bones: pivot on the plate's MOUNT line — the top of the bucket's own
  // geometry, at its own x-center. Ride the pelvis + hinge. `front` sets the tilt sign (front
  // plates open forward +, rear flare back −); `push` (L/R) makes the plate PUSHABLE by that
  // thigh's forward swing (below) so it rides on top of the leg instead of clipping it.
  const skirtBones = [];
  for (const [id, front, push] of [
    ['skirtFL', true, 'L'], ['skirtFC', true, null], ['skirtFR', true, 'R'], ['skirtR', false, null],
  ]) {
    const fs = boneFaces.get(id);
    if (!fs.length) { boneFaces.delete(id); continue; }
    let sx = 0, sy = 0, n = 0, topZ = -Infinity;
    for (const f of fs) for (const c of f.corners) { sx += c[0]; sy += c[1]; n += 1; if (c[2] > topZ) topZ = c[2]; }
    skirtBones.push({ id, synthetic: true, rides: 'pelvis', hinge: true, front, push, pivot: [sx / n, sy / n, topZ] });
  }
  // Synthetic shoulder-cap bones: ride the ARM rigidly, pivoting about the
  // shoulder joint (the arm bone's own head), so the pauldron rotates EXACTLY
  // as if welded to the bicep — it swings/elevates with the arm instead of
  // sitting affixed to the chest. (Riding is a one-line dial: 'upperArmL'/'R'
  // here ↔ 'torso' for the old chest-seated read.)
  const capBones = [];
  for (const [id, joint, arm] of [['shoulderCapL', 'shoulderL', 'upperArmL'], ['shoulderCapR', 'shoulderR', 'upperArmR']]) {
    const fs = boneFaces.get(id);
    if (!fs.length) { boneFaces.delete(id); continue; }
    const j = rig.joints[joint];
    capBones.push({ id, synthetic: true, rides: arm, hinge: false, pivot: [j.x, j.y, j.z] });
  }
  // Synthetic OFF-HAND bone (weldOffHand spike): the whole left arm rides the TORSO rigidly —
  // pivot at the left shoulder joint (cancels for a rigid ride, kept for clarity) — so it holds
  // its baked shape and turns ONLY with the chest, exactly as the racked-weapon torso rider does.
  const offArmBones = [];
  if (weldOffHand) {
    const fs = boneFaces.get('offArmL');
    if (fs && fs.length) {
      const j = rig.joints.shoulderL;
      offArmBones.push({ id: 'offArmL', synthetic: true, rides: 'torso', hinge: false, pivot: [j.x, j.y, j.z] });
    } else boneFaces.delete('offArmL');
  }
  // Synthetic WEAPON bones (R15): each rides forearmR rigidly with the pivot at forearmR's own head
  // (elbowR), so it transforms IDENTICALLY to forearmR — the weapon moves exactly as if welded to the
  // arm, but as a separate mesh the renderer can show/hide per loadout slot. Order after the caps.
  const weaponBones = [];
  const elbowR = rig.joints.elbowR;
  const weaponById = {};
  for (const w of (manifest.armory && Array.isArray(manifest.armory.weapons) ? manifest.armory.weapons : [])) { if (w && w.tag) weaponById[w.tag] = w; }
  for (const tag of [...new Set(Object.values(weaponTagOf))]) {
    const fs = boneFaces.get('weapon_' + tag);
    if (!fs || !fs.length) { boneFaces.delete('weapon_' + tag); continue; }
    // per-weapon offset ([dx,dy,dz], rig rest frame): slide the weapon in its grip — e.g. push the
    // saber hilt into the middle of the fist — without re-authoring it. Rides the weapon bone, so
    // a rest shift v+Δ shows as (bone rotation)·Δ in every posed clip. Same lever as shieldOffset.
    const wo = weaponById[tag] && Array.isArray(weaponById[tag].offset) ? weaponById[tag].offset : null;
    if (wo) for (const f of fs) for (const c of f.corners) { c[0] += wo[0] || 0; c[1] += wo[1] || 0; c[2] += wo[2] || 0; }
    // rides override (racked copies): a torso rider pivots at the torso's own head (navel), a
    // forearmL rider (off-hand dual pistol) pivots at elbowL, a pelvis rider (waist rack) at the
    // pelvis hub — each transforms IDENTICALLY to its parent, exactly as the forearmR riders do
    // the right arm.
    const rides = weaponRideOf[tag] || 'handR';
    const pj = rides === 'torso' ? rig.joints.navel : rides === 'handL' ? rig.joints.wristL
      : rides === 'pelvis' ? rig.joints.pelvisHub : rides === 'handR' ? rig.joints.wristR : elbowR;
    weaponBones.push({ id: 'weapon_' + tag, synthetic: true, rides, hinge: false, pivot: [pj.x, pj.y, pj.z] });
  }
  // R19: the shield bone rides forearmL rigidly (pivot at elbowL — forearmL's head), so it transforms
  // exactly as the arm does; a separate mesh the renderer can drop when the shield breaks.
  const shieldBones = [];
  if (boneFaces.has('shield')) {
    const sfs = boneFaces.get('shield');
    if (sfs && sfs.length) {
      const elbowL = rig.joints.elbowL;
      // manifest.shieldOffset ([dx,dy,dz], rig rest frame): a rigid mount tweak for the shield —
      // slide it toward/along the forearm without re-authoring the plate. Applied to the shield
      // faces before binding, so it rides forearmL exactly like the rest of the shield. The runtime
      // transform is q·(v−elbowL)+head', so a rest-frame shift v+Δ shows as q·Δ in every posed clip.
      const so = Array.isArray(manifest.shieldOffset) ? manifest.shieldOffset : null;
      if (so) for (const f of sfs) for (const c of f.corners) { c[0] += so[0] || 0; c[1] += so[1] || 0; c[2] += so[2] || 0; }
      shieldBones.push({ id: 'shield', synthetic: true, rides: 'forearmL', hinge: false, pivot: [elbowL.x, elbowL.y, elbowL.z] });
    } else boneFaces.delete('shield');
  }
  // noWeapons (skin/livery previews): drop the synthetic weapon_<tag> + shield riders so the bake
  // reads as the bare suit — the paint, not the gun. The buckets are held-in-hand/off-arm riders, so
  // excluding them from boneList leaves the body (and the hands) untouched; the prelit transfer still
  // lands on every body face (the posMap's weapon colours just go unqueried). Gated → off = untouched.
  const weaponRiders = noWeapons ? [] : weaponBones;
  const shieldRiders = noWeapons ? [] : shieldBones;
  const boneList = [...UNIT_BONES, ...handBones, ...skirtBones, ...capBones, ...offArmBones, ...weaponRiders, ...shieldRiders];

  // Generated inner frame (opt-in): manji joint spheres + bone links, already
  // in the rig frame (joints are), merged into the bone buckets before
  // normalization so frame and armor share one space.
  if (frame || frameOnly) {
    const frameOpts = frameOnly && typeof frameOnly === 'object' ? frameOnly
      : frame && typeof frame === 'object' ? frame : {};
    const frameFaces = buildUnitFrameFaces(rig.joints, frameOpts);
    for (const [bone, fs] of frameFaces) {
      (boneFaces.get(bone) || boneFaces.get('torso')).push(...fs);
    }
  }

  // Normalization shared by faces, joints, and curve heads: center x/y, feet at
  // z=0, optional height scale. (rotZ preserves z, so the grid contract holds.)
  // The BODY drives the frame: synthetic weapon_<tag> bones (R16 consolidated units) are EXCLUDED
  // from the bounds, so a unit carrying several weapons at once (an axe standing up, a long bazooka)
  // scales by its own body height, not by whichever weapon sticks out most — otherwise figH/targetH
  // would shrink the body to fit the weapons (a consolidated z came out ~78% of the g at equal figH).
  // Single-weapon units keep their weapon in forearmR (not a weapon_ bone), so they are unaffected.
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (const [bid, fs] of boneFaces) {
    if (bid.indexOf('weapon_') === 0) continue;
    for (const f of fs) for (const c of f.corners) {
      if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0];
      if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1];
      if (c[2] < mnz) mnz = c[2]; if (c[2] > mxz) mxz = c[2];
    }
  }
  const s = targetH ? targetH / ((mxz - mnz) || 1) : 1;
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const N = (v) => [(v[0] - cx) * s, (v[1] - cy) * s, (v[2] - mnz) * s];
  const jointArr = (name) => {
    const j = rig.joints[name];
    if (!j) throw new Error(`bakeUnitRig: derived rig has no joint '${name}'`);
    return [j.x, j.y, j.z];
  };

  // Normalized rest-pose face lists per bone — the frame every part meshes in (and the
  // frame the optional AO bake below runs in, so its radius reads in final suit units).
  const normFaces = boneList.map((b) => boneFaces.get(b.id).map((f) => ({ ...f, corners: f.corners.map(N) })));

  // ao (covered-parts shading, opt-in `ao: true | { radius, strength, minAo, steps, sky }`):
  // TWO baked terms over the whole rest-pose body (effects/ao-bake.js), so armor that COVERS
  // a section darkens it — the bicep under a pauldron, the upper thigh under a skirt plate,
  // the abdomen under the chest bell:
  //   • crevice AO (bakeAmbientOcclusion): normal-tap occlusion in junctions and gaps;
  //   • sky shadow (bakeSkyShadow): the top-light "roof" term — a vertical ray per corner
  //     darkens whatever solid geometry sits OVERHEAD within reach. This is the term that
  //     actually reads as coverage; normal taps can't run skyward (a face's own tangent
  //     plane hugs the ray). `sky: false` drops it; `sky: { reach, strength }` tunes it.
  // The combined `vao` factors fold into the per-part vertex colours (faceListToMesh), so
  // the shading rides every posed clip at zero runtime cost. Deterministic by construction
  // (both bakes are pure arithmetic, no dice). Baked in the BIND pose — coverage shadows
  // are pose-invariant by intent (the pauldron rides the arm it shades). Synthetic weapon_/
  // shield kit is EXCLUDED both ways: racked multi-weapon copies stack in one grip, so
  // they would bake phantom shadows for kit the loadout may be hiding. Gated → absent
  // means a byte-identical bake.
  if (ao != null && ao !== false) {
    const aoOpts = ao && typeof ao === 'object' ? ao : {};
    const h = (mxz - mnz) * s || 1;
    const flat = [];
    const spans = [];   // [boneIdx, offset, length] of each body bucket in `flat`
    for (let i = 0; i < boneList.length; i++) {
      const bid = boneList[i].id;
      if (bid.indexOf('weapon_') === 0 || bid === 'shield') continue;
      spans.push([i, flat.length, normFaces[i].length]);
      for (const f of normFaces[i]) flat.push(f);
    }
    let baked = bakeAmbientOcclusion(flat, {
      radius: Number.isFinite(aoOpts.radius) ? aoOpts.radius : h * 0.06,
      strength: Number.isFinite(aoOpts.strength) ? aoOpts.strength : 0.85,
      minAo: Number.isFinite(aoOpts.minAo) ? aoOpts.minAo : 0.35,
      steps: Number.isFinite(aoOpts.steps) ? aoOpts.steps : 4,
    });
    if (aoOpts.sky !== false) {
      const sky = aoOpts.sky && typeof aoOpts.sky === 'object' ? aoOpts.sky : {};
      baked = bakeSkyShadow(baked, {
        reach: Number.isFinite(sky.reach) ? sky.reach : h * 0.12,
        strength: Number.isFinite(sky.strength) ? sky.strength : 0.55,
        minAo: Number.isFinite(sky.minAo) ? sky.minAo : 0.3,
      });
    }
    for (const [i, off, len] of spans) normFaces[i] = baked.slice(off, off + len);
  }

  // shade (MANUAL covered-parts shading, opt-in `shade: true | { strength, bands }`): the
  // hand-authored sibling of `ao` — fixed per-bone gradient BANDS instead of geometric
  // occlusion, for when the ao ray bakes cost too much (game load). Each listed bone darkens
  // toward one end of its own rest-pose z-extent — a black shadow fading over the band:
  //   • upperArmL/R: dark at the TOP (the bicep under its pauldron/shoulder)
  //   • thighL/R:    dark at the TOP (the thigh under the skirt plates)
  //   • torso:       dark at the BOTTOM (the abdomen under the chest bell)
  // factor = 1 − strength·t (t = 1 at the dark end, 0 past the band), multiplied into the
  // same per-corner `vao` the ao bake uses, so it folds into the part vertex colours with
  // zero runtime cost and near-zero bake cost (pure per-vertex arithmetic, no rays). Bands
  // are fractions of each bone's own z-extent, so one table fits every suit height; a spec
  // object overrides per bone: { strength, bands: { <bone>: { from, span, strength? } } }.
  // Composes multiplicatively with `ao` when both are set. Gated → absent = byte-identical.
  if (shade != null && shade !== false) {
    const shOpts = shade && typeof shade === 'object' ? shade : {};
    const strength = Number.isFinite(shOpts.strength) ? shOpts.strength : 0.4;
    // Band SHAPE: full strength across the PLATEAU (the covered stretch, measured from the
    // dark end), then a linear fade over the rest of the span. A plain triangle fade put the
    // dark end exactly where the covering armor HIDES it (thigh top under the skirt), so the
    // visible surface only caught the weak tail and the treatment barely read.
    // Default table: the operator's three sections — upper bicep, upper thigh, torso — PLUS
    // the buckets that actually own those surfaces on a skirt-split biped (bucket-map
    // diagnostic, 2026-08-10): the visible "upper thigh" plates ride the SKIRT bones (the
    // true thigh hides behind them) and the visible waist is the PELVIS top. Suits without
    // those synthetic bones have empty buckets → the entries no-op.
    const bands = {
      upperArmL: { from: 'top', span: 0.6, plateau: 0.5 }, upperArmR: { from: 'top', span: 0.6, plateau: 0.5 },
      thighL: { from: 'top', span: 0.6, plateau: 0.5 }, thighR: { from: 'top', span: 0.6, plateau: 0.5 },
      torso: { from: 'bottom', span: 0.45, plateau: 0.5 },
      pelvis: { from: 'top', span: 0.55, plateau: 0.5 },
      skirtFL: { from: 'top', span: 0.7, plateau: 0.45 }, skirtFC: { from: 'top', span: 0.7, plateau: 0.45 },
      skirtFR: { from: 'top', span: 0.7, plateau: 0.45 }, skirtR: { from: 'top', span: 0.7, plateau: 0.45 },
      ...(shOpts.bands && typeof shOpts.bands === 'object' ? shOpts.bands : {}),
    };
    for (let i = 0; i < boneList.length; i++) {
      const band = bands[boneList[i].id];
      if (!band) continue;
      const fs = normFaces[i];
      let zMin = Infinity, zMax = -Infinity;
      for (const f of fs) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
      const ext = zMax - zMin;
      if (!(ext > 1e-9)) continue;
      const span = Number.isFinite(band.span) && band.span > 0 ? band.span : 0.6;
      const plateau = Number.isFinite(band.plateau) ? Math.max(0, Math.min(0.95, band.plateau)) : 0.5;
      const st = Number.isFinite(band.strength) ? band.strength : strength;
      const bandH = ext * span;
      for (const f of fs) {
        let vao = null;
        for (let k = 0; k < f.corners.length && k < 4; k++) {
          const z = f.corners[k][2];
          // u: 0 at the dark end of the band → 1 at its far edge (past it = open)
          const u = band.from === 'bottom' ? (z - zMin) / bandH : (zMax - z) / bandH;
          if (u >= 1) continue;
          const t = u <= plateau ? 1 : 1 - (u - plateau) / (1 - plateau);
          if (t <= 0) continue;
          if (!vao) vao = Array.isArray(f.vao) && f.vao.length >= 4 ? f.vao.slice() : [1, 1, 1, 1];
          vao[k] *= 1 - st * t;
        }
        if (vao) f.vao = vao;   // normFaces entries are per-bake clones — in-place is safe
      }
    }
  }

  // prelit (prelit-figure.plan.md P0): swap the rig's rest-face colours for externally
  // baked GI colours right before packing. The callback receives the per-bone normFaces
  // (final suit units, one array per boneList entry) and mutates each face's fill/cornerFills
  // in place; faceListToMesh + packRigMesh then pack the baked colours exactly as they pack
  // the vexar ones — nothing downstream changes. Runs AFTER ao/shade by intent (a GI bake
  // already carries its own occlusion). Gated → absent = byte-identical bake.
  // `s` (the targetH height-scale, 1 when native) is handed over so the transfer can undo it
  // before keying — the baked posMap lives in NATIVE space, but normFaces here are already
  // scaled by targetH (the arena normalizes combatants to 24u), which otherwise misses 100%.
  if (typeof prelit === 'function') prelit(normFaces, boneList, s);

  const parts = boneList.map((b, bi) => {
    const fs = normFaces[bi];
    if (!fs.length) return null;
    const gm = faceListToMesh(fs);
    if (!gm.positions.length) return null;
    // indexed + quantized packing (rig-bake.js packRigMesh): shared corners deduped on the
    // (quantized pos, colour, spec) tuple + a triangle index — ~4-5× smaller than the legacy
    // float32 triangle soup at unit face counts, render-equivalent (every triangle keeps its
    // exact corner values; spec rides per unique vertex the same way). The runtime's
    // __makeRigGroup takes the `part.q` branch; vehicle/protoform rigs still pack soup and
    // take the legacy `part.pos` branch.
    return packRigMesh(gm, fs.length);
  });

  // Pose curves: per clip, K keys; per key, per bone, [qx,qy,qz,qw, hx,hy,hz].
  // q and head' come straight off the bone's rigid affine (m, t) over the SUIT
  // skeleton — the same solve compileUnitPose lowers into static manifests.
  // A grounded clip's key is SHIFTED down as a whole (positions only — a rigid
  // translation leaves every quaternion untouched) so the lowest posed point
  // of the shin bones' own faces sits back on z=0.
  // STANCE GROUNDING (default ON for the cyclic GAIT clips; opt out with
  // `manifest.soleStance:false`): ground the walk on the PLANTED foot only — the shin
  // whose ANKLE sits lower — instead of the global min of BOTH feet. A big foot plate
  // rigidly fixed to the lower leg swings with it, so mid-stride its toe pitches BELOW
  // the stance sole; a global-min grounder then reads that airborne toe as the floor
  // and yanks the whole body up (the spiky double-bounce that shows on chunky-footed
  // suits like taisa / g-frame mk2). Tracking only the lower-ankle foot ignores the
  // swing foot's pitched corner, so the bob follows the planted sole smoothly. Scoped
  // to the gait (idle/forward/strafe/turn) — kneel/squat/leap and the tilted reactions
  // keep whole-body grounding. Suits whose feet don't spike (g-frame, geof) bake the
  // SAME either way, so this is a free win everywhere; the tradeoff is that a big swing
  // foot may briefly clip the floor instead of levering the body up. `soleStance:false`
  // restores the legacy global-min grounding.
  const soleStance = manifest.soleStance !== false;
  const ankleZ = (T, bone, j) => { const bt = T[bone]; return bt ? bt.m[2][0] * j.x + bt.m[2][1] * j.y + bt.m[2][2] * j.z + bt.t.z : j.z; };
  const shinMinZ = (T, bone) => {
    let mn = Infinity; const bt = T[bone];
    for (const f of boneFaces.get(bone)) for (const c of f.corners) {
      const z = bt ? bt.m[2][0] * c[0] + bt.m[2][1] * c[1] + bt.m[2][2] * c[2] + bt.t.z : c[2];
      if (z < mn) mn = z;
    }
    return mn;
  };
  // gait = true only for the cyclic locomotion clips (the swing-foot artifact is a walk
  // thing); everything else keeps the global-min so multi-contact poses ground honestly.
  const soleShift = (T, gait) => {
    if (soleStance && gait && rig.joints.ankleL && rig.joints.ankleR) {
      const stance = ankleZ(T, 'shinL', rig.joints.ankleL) <= ankleZ(T, 'shinR', rig.joints.ankleR) ? 'shinL' : 'shinR';
      const mn = shinMinZ(T, stance);
      return Number.isFinite(mn) ? mn - mnz : 0;
    }
    const mn = Math.min(shinMinZ(T, 'shinL'), shinMinZ(T, 'shinR'));
    return Number.isFinite(mn) ? mn - mnz : 0;
  };
  // CHEST GIMBAL (opt-in: `manifest.gimbal === true`, intrinsic to the unit like
  // `locomotion`): on the cyclic GAIT clips only, the TORSO CHAIN — torso, head,
  // arms, and every synthetic bone riding them (shoulder caps, weapon_<tag>) —
  // does NOT take the per-key sole-grounding shift. The legs and pelvis (and the
  // skirts riding it) absorb the walk bob while the upper body glides level, the
  // stabilized-camera read of a heavy machine. Scoped to the walk loop on
  // purpose: a squat/kneel lowers the torso BY the grounding shift, reactions
  // (stagger/topple/getup) own the whole body, and a swing's sink is its weight —
  // gimbaling those would hollow them out. The pelvis→torso seam opens by at
  // most the gait-bob envelope (the sole-shift span, ~0.04·h on taisa) — size
  // the abdomen/belt superposition to cover it. Absent the flag →
  // byte-identical bake.
  const gimbal = manifest.gimbal === true;
  // Resting FRONT-SIDE-skirt open (degrees; opt-in intrinsic like `gimbal`): a per-suit floor on
  // the skirtFL/FR hinge, so the side plates sit FLARED OPEN in the ready stance (and never close
  // below it) instead of hanging flush. The leg push still opens them further on a stride; the
  // center plate is untouched. 0/absent → the plates hang at rest (byte-identical).
  const skirtRest = Number.isFinite(manifest.skirtRest) ? manifest.skirtRest : 0;
  const GIMBAL_CLIPS = new Set(['idle', 'forward', 'strafe', 'turn']);
  const gimbalBone = (b) => {
    const key = b.synthetic ? (b.rides || 'pelvis') : b.id;
    return key === 'torso' || key === 'head' || key.indexOf('upperArm') === 0 || key.indexOf('forearm') === 0;
  };
  // rotate a NORMALIZED point about pivot Pn by the row-matrix R (identity → no-op)
  const tiltN = (R, Pn, v) => (R ? [
    R[0][0] * (v[0] - Pn[0]) + R[0][1] * (v[1] - Pn[1]) + R[0][2] * (v[2] - Pn[2]) + Pn[0],
    R[1][0] * (v[0] - Pn[0]) + R[1][1] * (v[1] - Pn[1]) + R[1][2] * (v[2] - Pn[2]) + Pn[1],
    R[2][0] * (v[0] - Pn[0]) + R[2][1] * (v[1] - Pn[1]) + R[2][2] * (v[2] - Pn[2]) + Pn[2],
  ] : v);
  // whole-body min-z (normalized frame) after the root tilt R — a TILTED reaction
  // clip (topple/getup) lies the body flat and must rest on the floor by its whole
  // silhouette, not the shins the gait grounds on.
  const groundAllTilted = (T, R, Pn) => {
    let mn = Infinity;
    for (const b of boneList) {
      if (b.synthetic) continue;
      const bt = T[b.id]; if (!bt) continue;
      for (const f of boneFaces.get(b.id)) for (const c of f.corners) {
        const px = bt.m[0][0] * c[0] + bt.m[0][1] * c[1] + bt.m[0][2] * c[2] + bt.t.x;
        const py = bt.m[1][0] * c[0] + bt.m[1][1] * c[1] + bt.m[1][2] * c[2] + bt.t.y;
        const pz = bt.m[2][0] * c[0] + bt.m[2][1] * c[1] + bt.m[2][2] * c[2] + bt.t.z;
        const z = tiltN(R, Pn, N([px, py, pz]))[2];
        if (z < mn) mn = z;
      }
    }
    return Number.isFinite(mn) ? mn : 0;
  };
  const packedClips = {};
  for (const [name, rawClip] of Object.entries(clips)) {
    const spec = typeof rawClip === 'function' ? { pose: rawClip, ground: false }
      : (rawClip && typeof rawClip.pose === 'function' ? rawClip : null);
    if (!spec) continue;
    const flat = [];
    for (let k = 0; k < keys; k += 1) {
      // LOOPS sample k/keys (the wrap segment key[K-1]→key[0] closes the cycle); ONE-SHOT
      // clips (spec.once — stagger/topple/getup) sample k/(keys-1), 0..1 INCLUSIVE, so the
      // final key IS the phase-1 pose and the renderer clamps there instead of wrapping.
      const phase = spec.once ? k / (keys - 1) : k / keys;
      // rigidUpperBody: the suit's chest turns as one rigid piece with its shoulder
      // sockets, so a girdle/spine-twist clip never splits the arms off the chest.
      // shouldersLimit: the suit's waist bearing swivels far past human scapular range
      // (a swing can wind the torso past the legs) — match the compileUnitPose cap.
      const { bones: T } = articulateTransforms(spec.pose(phase), rig.joints, { rigidUpperBody: true, shouldersLimit: SUIT_WAIST_SWIVEL });
      // per-clip skirt hinge (degrees; fn of phase or constant): front plates
      // tilt forward, rear plates FLARE back — equal and opposite, the full
      // "armor opens" flight read (the rear plate rises AWAY from the
      // trailing leg, so the full angle only adds clearance).
      const skirtDeg = spec.skirt ? (typeof spec.skirt === 'function' ? spec.skirt(phase) : spec.skirt) : 0;
      // FRONT-SKIRT LEG PUSH: a side plate (skirtFL/FR) is driven open by its OWN thigh's forward
      // swing, so it rides ON TOP of the leg instead of the thigh clipping through it. The angle is
      // the thigh's forward tilt from rest (about the lateral axis) plus a small lead so the plate
      // sits just proud of the leg. A rest deadzone keeps the standing plate hanging (the idle thigh
      // already sits a few degrees forward); a leg swinging BACK doesn't pull the front plate in
      // (clamped ≥0). Same "hinge about the mount" mechanism as the boost skirt-open — the drive is
      // the leg, not the clip. The final front-plate angle is max(clip open, leg push).
      const SKIRT_REST = 6, SKIRT_LEAD = 3, SKIRT_MAX = 58;
      const thighPush = (side) => {
        const bt = T['thigh' + side]; if (!bt) return 0;
        const hip = rig.joints['hip' + side], knee = rig.joints['knee' + side];
        const r0 = [knee.x - hip.x, knee.y - hip.y, knee.z - hip.z];
        const rl = Math.hypot(r0[0], r0[1], r0[2]) || 1;
        const rest = [r0[0] / rl, r0[1] / rl, r0[2] / rl];
        const p = mvec(bt.m, rest);   // posed thigh direction (rotation only — a direction ignores t)
        const ang = (d) => Math.atan2(d[1], -d[2]);   // forward-open tilt about the lateral (x) axis
        const fwd = (ang(p) - ang(rest)) / DEG;
        return fwd > SKIRT_REST ? Math.min(SKIRT_MAX, fwd + SKIRT_LEAD) : 0;
      };
      // optional ROOT TILT (the knockdown clips): a whole-body lateral rotation
      // about a LOW ground pivot (0.15·figH), applied in the normalized frame
      // (matching the study), then the whole body is grounded to the floor. The
      // baked curves carry it — the renderer plays the fall-flat like any clip.
      const tiltDeg = spec.tilt ? spec.tilt(phase) : 0;
      const turnDeg = spec.turn ? (typeof spec.turn === 'function' ? spec.turn(phase) : spec.turn) : 0;
      let R = null; const Pn = [0, 0, (mxz - mnz) * s * 0.15];
      if (tiltDeg) { const a = tiltDeg * DEG, c = Math.cos(a), sn = Math.sin(a); R = [[1, 0, 0], [0, c, -sn], [0, sn, c]]; }   // about +x: +θ tips onto the back
      // spec.turn (deg, fn of phase): whole-body YAW about the vertical axis through the body center —
      // the MS pivots its FACING in place (legs, torso, and the welded off-hand all turn as one). + =
      // the figure's LEFT. Composes over a tilt if both are set.
      if (turnDeg) { const a = turnDeg * DEG, c = Math.cos(a), sn = Math.sin(a); const Rz = [[c, -sn, 0], [sn, c, 0], [0, 0, 1]]; R = R ? mmulRows(Rz, R) : Rz; }
      // spec.lift (normalized units): raise the whole posed body. On an ungrounded HOVER clip
      // (boost) it lifts the pelvis off its rest height; a negative shift IS a raise.
      const lift = Number.isFinite(spec.lift) ? spec.lift : 0;
      const shift = R ? 0 : (spec.ground ? soleShift(T, GIMBAL_CLIPS.has(name)) : -lift);   // untilted grounded clips: shin sole-shift; ungrounded: raise by lift
      // tilted clips normally rest their whole silhouette on the floor (topple/getup). A HOVER
      // clip (spec.hover) keeps its air — the tilt pitches the body without dropping it — and the
      // lift raises it: subtract −lift so head[2] -= tiltGround adds the raise.
      const tiltGround = R ? ((spec.hover ? 0 : groundAllTilted(T, R, Pn)) - lift) : 0;
      for (const b of boneList) {
        let bm, posedHead;
        if (b.synthetic) {
          // synthetic bones RIDE a parent affine (skirts→pelvis, shoulder caps→
          // arm), pivoting about their own mount point (which only moves with
          // the parent). Skirts additionally HINGE about that pivot (rotation
          // about x — front plates open forward, rear flare back; a front side
          // plate also opens to clear its thigh, `push`); caps ride rigidly.
          const bp = T[b.rides || 'pelvis'];
          if (b.hinge) {
            const deg = b.push ? Math.max(skirtDeg, skirtRest, thighPush(b.push)) : skirtDeg;
            const a = deg * (b.front ? 1 : -1) * DEG;
            const c = Math.cos(a), s2 = Math.sin(a);
            const tiltM = [[1, 0, 0], [0, c, -s2], [0, s2, c]];
            bm = bp ? mmulRows(bp.m, tiltM) : tiltM;
          } else {
            bm = bp ? bp.m : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          }
          posedHead = bp
            ? mvec(bp.m, b.pivot).map((v, i) => v + [bp.t.x, bp.t.y, bp.t.z][i])
            : [...b.pivot];
        } else {
          const bt = T[b.id];
          const rh = jointArr(b.head);
          posedHead = bt
            ? mvec(bt.m, rh).map((v, i) => v + [bt.t.x, bt.t.y, bt.t.z][i])
            : rh;
          bm = bt ? bt.m : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        }
        let q, head;
        if (R) {
          // tilted: normalize, rotate the whole body about the ground pivot, rest
          // it on the floor; the orientation gets the tilt pre-composed (R·bm).
          head = tiltN(R, Pn, N(posedHead)); head[2] -= tiltGround;
          q = matToQuat(cols(mmulRows(R, bm)));
        } else {
          if (!(gimbal && GIMBAL_CLIPS.has(name) && gimbalBone(b))) posedHead[2] -= shift;
          head = N(posedHead);
          q = matToQuat(cols(bm));
        }
        flat.push(...q.map(r4), ...head.map(r4));
      }
    }
    if (flat.length) packedClips[name] = spec.once ? { k: keys, b: flat, once: 1 } : { k: keys, b: flat };
  }

  // ── per-slot arm overlays (R17): a weapon entry may declare an ALTERNATE arm pose (`aimAlt`) —
  // e.g. the bazooka's over-shoulder launch. The base clips bake ONE shared aim-locked arm; the
  // alternate rides as an overlay curve for upperArmR + forearmR + the weapon_<tag> bone, selected
  // at runtime while that slot is active (channels.js). Placement is UNCHANGED — the weapon rides
  // forearmR rigidly, so raising the arm carries it and it stays gripped — so the overlay is a pure
  // arm delta with no special geometry. Only the NON-TILT aim-locked clips get an overlay; swing /
  // dodge / topple / getup fall back to the base arm (the tumble/knockdown owns the whole body).
  // Absent any `aimAlt` → no overlays, byte-identical bake.
  // Bake ONE arm overlay: the given arm bones (+ any weapon bone) posed to `altPose` under
  // `altArms`, per non-tilt clip. Returns { bones:[idx], clips } or null. Shared by the weapon
  // overlays (over-shoulder bazooka) and the __rest overlay (empty free hand).
  const bakeArmOverlay = (ovIds, altPose, altArms) => {
    const ovDefs = boneList.filter((b) => ovIds.has(b.id));
    if (!ovDefs.length) return null;
    const ovIdx = ovDefs.map((b) => boneList.indexOf(b));
    const altClips = aimLockClips({ idle: { ground: true, pose: () => ({}) }, ...preAimShelf }, altPose, rig.joints, { aimArms: altArms });
    const ovClips = {};
    for (const [name, rawClip] of Object.entries(altClips)) {
      const spec = typeof rawClip === 'function' ? { pose: rawClip, ground: false }
        : (rawClip && typeof rawClip.pose === 'function' ? rawClip : null);
      if (!spec || spec.tilt) continue;   // tilted reactions (topple/getup) → base arm
      const flat = [];
      for (let k = 0; k < keys; k += 1) {
        const { bones: T } = articulateTransforms(spec.pose(k / keys), rig.joints, { rigidUpperBody: true, shouldersLimit: SUIT_WAIST_SWIVEL });
        const shift = spec.ground ? soleShift(T, GIMBAL_CLIPS.has(name)) : 0;   // overlay grounding matches the base (stance on the gait)
        for (const b of ovDefs) {
          let bm, posedHead;
          if (b.synthetic) {   // the weapon bone rides forearmR (pivot = elbowR)
            const bp = T[b.rides];
            bm = bp ? bp.m : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            posedHead = bp ? mvec(bp.m, b.pivot).map((v, i) => v + [bp.t.x, bp.t.y, bp.t.z][i]) : [...b.pivot];
          } else {
            const bt = T[b.id];
            const rh = jointArr(b.head);
            posedHead = bt ? mvec(bt.m, rh).map((v, i) => v + [bt.t.x, bt.t.y, bt.t.z][i]) : rh;
            bm = bt ? bt.m : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          }
          // overlay bones are all torso-chain (arm + weapon) — the gimbal skips
          // their grounding shift on the gait clips exactly like the base bake.
          if (!(gimbal && GIMBAL_CLIPS.has(name))) posedHead[2] -= shift;
          flat.push(...matToQuat(cols(bm)).map(r4), ...N(posedHead).map(r4));
        }
      }
      if (flat.length) ovClips[name] = { k: keys, b: flat };
    }
    return Object.keys(ovClips).length ? { bones: ovIdx, clips: ovClips } : null;
  };

  const armOverlays = {};
  for (const w of (manifest.armory && Array.isArray(manifest.armory.weapons) ? manifest.armory.weapons : [])) {
    if (!w || !w.id || !w.tag || !w.aimAlt || typeof w.aimAlt !== 'object') continue;
    // an overlay covers the RIGHT arm chain + the weapon bone. A weapon may opt to ALSO
    // drive the LEFT arm (`aimAltFull`) — e.g. geof's heat sword, whose slot grips with
    // the right and RESTS the off-hand, distinct from the base vulcan stance. Default
    // (right-only) keeps every existing overlay (the over-shoulder bazookas) byte-identical.
    // handR rides the overlay too, so the FIST follows the arm to the alt pose (else the hand
    // stays at the base-aim grip while the forearm + weapon move — the weapon detaches from the
    // fist). No-op on hand-less units (ovDefs filters boneList), so they stay byte-identical.
    const ovIds = new Set(['upperArmR', 'forearmR', 'handR', 'weapon_' + w.tag]);
    if (w.aimAltFull) { ovIds.add('upperArmL'); ovIds.add('forearmL'); ovIds.add('handL'); }
    // the overlay holds its OWN slot stance; `aimAltArms` lets a weapon pick the per-arm
    // lock/hold/free just for its overlay (default: the unit's base aimArms).
    const ov = bakeArmOverlay(ovIds, w.aimAlt, w.aimAltArms || effAimArms);
    if (ov) armOverlays[w.tag] = ov;
  }
  // The __rest overlay (R-free-hand): the RIGHT arm holds REST_ARM, selected at runtime when a
  // loadout slot empties the weapon hand (`show:'none'` — head vulcan / torso beam), so the freed
  // hand settles into the ready guard instead of pointing an invisible gun. Baked on any armed
  // unit; unused (byte-inert) unless a show:'none' slot selects it. The left arm is untouched (a
  // shield / a bodily-weapon hand / the restOffHand left keep their own read).
  if (aim && typeof aim === 'object') {
    const ov = bakeArmOverlay(new Set(['upperArmR', 'forearmR', 'handR']), REST_ARM, { L: 'hold', R: 'hold' });
    if (ov) armOverlays['__rest'] = ov;
  }

  // muzzle anchor → bone-local rest point in the SAME normalized rig frame the bone meshes live in
  // (the mesh matrix maps this rest frame → posed, so a locator here tracks the actual weapon tip
  // through every clip). Only present when the unit is armed (deriveUnitAnchors ingests the hardpoint).
  let muzzle = null;
  try {
    const mz = deriveUnitAnchors(manifest, { rig }).anchors.muzzle;
    if (mz && mz.on) {
      const local = N(mvec(A, mz.at));   // suit → rig (rest: bone affine is identity) → normalized
      muzzle = { bone: mz.on, local: local.map(r4) };
    }
  } catch { muzzle = null; }

  // thruster anchors → nozzle rest point + exhaust direction per jet, in the SAME
  // normalized rig frame as `muzzle` (the bone mesh matrix maps rest→posed, so a
  // locator here tracks the live nozzle through every clip, and the flame — built
  // as a child of that locator — leans with the body). The renderer lights an
  // additive plume at each while the entity is boosting (channels.js
  // __updateThrusters). Derived from STATION GEOMETRY so any unit gets jets for
  // free: BACKPACK thruster stations (id ~ thruster/nozzle/booster/vernier, on
  // the torso) fire back-and-down; FOOT stations fire straight down (the
  // liftoff/hover read). A unit with neither station simply gets no jets.
  const thrusters = [];
  {
    const boxOf = (pl) => {
      let mnX = Infinity, mnY = Infinity, mnZ = Infinity, mxX = -Infinity, mxY = -Infinity, mxZ = -Infinity;
      for (let i = pl.faceStart; i < pl.faceStart + pl.faceCount; i += 1) {
        for (const c0 of faces[i].corners) {
          const c = mvec(A, c0);
          if (c[0] < mnX) mnX = c[0]; if (c[0] > mxX) mxX = c[0];
          if (c[1] < mnY) mnY = c[1]; if (c[1] > mxY) mxY = c[1];
          if (c[2] < mnZ) mnZ = c[2]; if (c[2] > mxZ) mxZ = c[2];
        }
      }
      return { mnX, mnY, mnZ, mxX, mxY, mxZ, cx: (mnX + mxX) / 2, cy: (mnY + mxY) / 2 };
    };
    const unit = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
    // flame dims scale with the unit's height (figH), not the station bbox, so a
    // jet reads as a thin, long plume rather than a blob the size of the backpack.
    const figH = (mxz - mnz) * s;
    // OPT-IN JET FAMILIES (`manifest.jets`, operator 2026-08-10) for units whose nozzles are
    // SCULPTED INTO larger stations instead of named ones: 'calf' — a rear-face nozzle high on
    // each lower leg (taisa's leg thrusters); 'torso-back' — a vectoring backpack pair derived
    // off the torso's rear face (the mk2's integrated pack — it carries no separate backpack
    // item, so the name-derivation found nothing and it boosted flameless). Absent → [] and
    // every existing unit bakes byte-identically.
    const jetFams = Array.isArray(manifest.jets) ? manifest.jets : [];
    for (const pl of placements) {
      const key = pl.id || String(pl.index);
      const lk = key.toLowerCase();
      const bone = rig.bones[key];
      if (!bone) continue;
      if (/thrust|nozzle|booster|vernier/.test(lk)) {
        const b = boxOf(pl), halfW = (b.mxX - b.mnX) / 2 || 0.01;
        const dir = unit([0, -1, -0.32]).map(r4);   // trail out the back, angled down
        const zN = b.mnZ;   // the nozzle mouth (bottom of the pack), rearmost face
        const xs = halfW > 0.02 ? [b.cx - halfW * 0.5, b.cx + halfW * 0.5] : [b.cx];
        for (const x of xs) thrusters.push({ bone, kind: 'backpack', dir, size: r4(figH * 0.028), len: r4(figH * 0.19), local: N([x, b.mnY, zN]).map(r4) });
      } else if (/foot|sole/.test(lk)) {
        const b = boxOf(pl);
        thrusters.push({ bone, kind: 'foot', dir: [0, 0, -1], size: r4(figH * 0.024), len: r4(figH * 0.12), local: N([b.cx, b.cy, b.mnZ]).map(r4) });
      } else if (jetFams.includes('calf') && /lower_leg|calf|shin/.test(lk)) {
        // rear-face nozzle high on the calf, firing back-and-down; body-fixed (kind 'calf'
        // skips the backpack vectoring — leg jets ride the leg, like the foot jets).
        const b = boxOf(pl);
        const dir = unit([0, -1, -0.45]).map(r4);
        const z = b.mnZ + (b.mxZ - b.mnZ) * 0.7;
        thrusters.push({ bone, kind: 'calf', dir, size: r4(figH * 0.022), len: r4(figH * 0.14), local: N([b.cx, b.mnY, z]).map(r4) });
      }
    }
    // AUTHORED JETS (`manifest.jets` object entries, operator 2026-08-10): a unit whose nozzles
    // are sculpted into a big station at KNOWN model coords (the mk2's two pack cones at the
    // bottom of its torso-integrated backpack) names them exactly — `{ bone, anchors: [[x,y,z]…],
    // dir: [x,y,z], kind?, size?, len? }`, all in the unit's own MODEL space. Anchors + dir map
    // through the same assembly rotation as the geometry, so the flame roots at the cone mouth
    // and fires along the cone axis. kind 'backpack' vectors with the dash like a named pack.
    for (const jf of jetFams) {
      if (!jf || typeof jf !== 'object' || !Array.isArray(jf.anchors)) continue;
      const bone = jf.bone || 'torso';
      if (!Object.values(rig.bones).includes(bone) && bone !== 'torso') continue;
      const dv = jf.dir ? mvec(A, jf.dir) : [0, -1, -0.32];
      const dir = unit(dv).map(r4);
      for (const a of jf.anchors) {
        thrusters.push({
          bone, kind: jf.kind || 'backpack', dir,
          size: r4(figH * (jf.size || 0.028)), len: r4(figH * (jf.len || 0.19)),
          local: N(mvec(A, a)).map(r4),
        });
      }
    }
  }

  return {
    rig: true,
    bones: boneList.map((b) => ({ id: b.id, head: N(b.synthetic ? b.pivot : jointArr(b.head)).map(r4) })),
    parts,
    clips: packedClips,
    figH: r4((mxz - mnz) * s),
    ...(Object.keys(armOverlays).length ? { armOverlays } : {}),
    ...(muzzle ? { muzzle } : {}),
    ...(thrusters.length ? { thrusters } : {}),
    // rim (ms-contrast SPIKE): [r,g,b,strength,power] — presence gates the runtime
    // fresnel patch (controllable channel); absent → payload byte-identical.
    ...(contrastRim ? { rim: contrastRim } : {}),
  };
}
