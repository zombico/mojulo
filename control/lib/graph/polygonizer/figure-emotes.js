/**
 * figure-emotes — a NAMED library of body-language emotes over the posing engine.
 *
 * An emote is not new kinematics: it is a short keyframe recipe (each keypose is
 * exactly a `pose`/resolvePose spec — the same dof vocabulary create_figure, the
 * gait, and world `figures` maps speak) wrapped in the `performance()` principles
 * layer so a held beat still breathes and the distal joints trail. Because an
 * emote compiles to the standard `phase → dof` contract, every existing consumer
 * gets it for free: the sketch GIF (renderFigureFrames), a world's `figures` map
 * (renderFigureWorldFrames), rig curves (bakeProtoformRig via figureRigSamples),
 * and still sampling (sampleMotionPose — freeze the peak of a bow as a pose).
 *
 * Reachable as a motion spec: `motion: 'bow'` (a name) or
 * `motion: { emote: 'bow', intensity: 1.3, perform: {…} }` (tuned) — resolved by
 * figure-render's motionFn beside 'wave'/'stretch'. `intensity` maps to the
 * performance `exaggerate` dial (1 = as authored; >1 pushes every pose bolder).
 *
 * Design + roadmap (runtime fx-channel triggers, the facial-rig gap):
 * figure-emotes.plan.md.
 */
import { keyframeMotion, performance } from './figure-posing.js';

// Each emote: `keyframes` (pose specs, in order — repeat a keypose to HOLD it;
// the loop eases last → first so a GIF tiles), optional `loop:false`, and
// `perform` defaults (merged under any caller perform). Rest = {} (the neutral
// stance); keyframes are authored in RAW dof so they pass through resolvePose
// verbatim and stay copy-pastable into a create_figure `pose`.
const REST = {};

export const EMOTES = {
  nod: {
    // head/neck pitch: NEGATIVE = forward/down on this armature (gait's headTilt).
    summary: 'yes — two downward head dips, a breath of spine behind them',
    keyframes: [
      REST,
      { head: { pitch: -24 }, neck: { pitch: -10 }, spine: { sagittal: 0.06 } },
      { head: { pitch: 2 } },
      { head: { pitch: -20 }, neck: { pitch: -8 }, spine: { sagittal: 0.04 } },
      REST,
    ],
    perform: { followThrough: { channels: ['head.pitch', 'head.yaw'] }, idle: { breath: 0.03, sway: 0.02 } },
  },
  headshake: {
    // head.yaw is a lateral TILT on this armature (no axial head-turn DOF — see
    // figure-emotes.plan.md), so the "no" read is a small torso turn (spine
    // axial) with the head tilting against it, damping out.
    summary: 'no — the head sways side to side against a small torso turn',
    keyframes: [
      REST,
      { head: { yaw: 14 }, spine: { axial: 0.18 } },
      { head: { yaw: -14 }, spine: { axial: -0.18 } },
      { head: { yaw: 10 }, spine: { axial: 0.12 } },
      { head: { yaw: -7 }, spine: { axial: -0.08 } },
      REST,
    ],
    perform: { followThrough: { channels: ['head.yaw'] }, idle: { breath: 0.03, sway: 0.02 } },
  },
  bow: {
    summary: 'formal bow — hinge at the hips, head follows, held a beat',
    keyframes: [
      REST,
      { hinge: 36, spine: { sagittal: 0.22 }, neck: { pitch: -12 }, shL: { pitch: 4 }, shR: { pitch: 4 }, kneeL: 7, kneeR: 7 },
      { hinge: 36, spine: { sagittal: 0.22 }, neck: { pitch: -12 }, shL: { pitch: 4 }, shR: { pitch: 4 }, kneeL: 7, kneeR: 7 },
      REST,
    ],
    perform: { anticipation: { channels: ['spine.sagittal'], amount: 0.25, lead: 3 }, idle: { breath: 0.03, sway: 0.015 } },
  },
  shrug: {
    summary: "don't know — elbows in, forearms out, palms up, a head tilt",
    keyframes: [
      REST,
      {
        elbowL: 96, elbowR: 96,
        shL: { yaw: 16, pitch: 4, roll: -55 }, shR: { yaw: -16, pitch: 4, roll: 55 },
        wristL: { flex: -35 }, wristR: { flex: -35 },
        spine: { lateral: 0.08 }, head: { yaw: 9, pitch: -5 },
      },
      {
        elbowL: 96, elbowR: 96,
        shL: { yaw: 16, pitch: 4, roll: -55 }, shR: { yaw: -16, pitch: 4, roll: 55 },
        wristL: { flex: -35 }, wristR: { flex: -35 },
        spine: { lateral: 0.08 }, head: { yaw: 9, pitch: -5 },
      },
      REST,
    ],
    perform: { idle: { breath: 0.035, sway: 0.02 } },
  },
  cheer: {
    summary: 'celebration — both arms pump overhead, chest open',
    keyframes: [
      REST,
      // hands up: raise the upper arm AND bend the elbow + roll the forearm up
      // (straight arms cap at horizontal — the wave/stretch trick).
      { shL: { yaw: 26, pitch: 70, roll: -96 }, shR: { yaw: -26, pitch: 70, roll: 96 }, elbowL: 92, elbowR: 92, spine: { sagittal: -0.3 }, head: { pitch: -6 } },
      { shL: { yaw: 30, pitch: 62, roll: -96 }, shR: { yaw: -30, pitch: 62, roll: 96 }, elbowL: 60, elbowR: 60, spine: { sagittal: -0.2 } },
      { shL: { yaw: 26, pitch: 70, roll: -96 }, shR: { yaw: -26, pitch: 70, roll: 96 }, elbowL: 92, elbowR: 92, spine: { sagittal: -0.3 }, head: { pitch: -6 } },
      REST,
    ],
    perform: { exaggerate: 1.05, followThrough: {}, idle: { breath: 0.04, sway: 0.03 } },
  },
  point: {
    summary: 'indicate — the right arm extends forward, gaze following it',
    keyframes: [
      REST,
      { shR: { pitch: 84, yaw: -8 }, elbowR: 8, fingersR: 35, head: { yaw: -7 }, spine: { axial: -0.08 } },
      { shR: { pitch: 84, yaw: -8 }, elbowR: 8, fingersR: 35, head: { yaw: -7 }, spine: { axial: -0.08 } },
      REST,
    ],
    perform: { anticipation: { channels: ['shR.pitch', 'spine.axial'], amount: 0.3, lead: 3 }, idle: { breath: 0.03, sway: 0.02 } },
  },
  clap: {
    summary: 'applause — the hands meet at the chest, three beats',
    keyframes: [
      REST,
      { shL: { yaw: 34, pitch: 38, roll: -40 }, shR: { yaw: -34, pitch: 38, roll: 40 }, elbowL: 70, elbowR: 70 },
      { shL: { yaw: 8, pitch: 42, roll: -40 }, shR: { yaw: -8, pitch: 42, roll: 40 }, elbowL: 88, elbowR: 88 },
      { shL: { yaw: 30, pitch: 38, roll: -40 }, shR: { yaw: -30, pitch: 38, roll: 40 }, elbowL: 72, elbowR: 72 },
      { shL: { yaw: 8, pitch: 42, roll: -40 }, shR: { yaw: -8, pitch: 42, roll: 40 }, elbowL: 88, elbowR: 88 },
      { shL: { yaw: 30, pitch: 38, roll: -40 }, shR: { yaw: -30, pitch: 38, roll: 40 }, elbowL: 72, elbowR: 72 },
      { shL: { yaw: 8, pitch: 42, roll: -40 }, shR: { yaw: -8, pitch: 42, roll: 40 }, elbowL: 88, elbowR: 88 },
      REST,
    ],
    perform: { followThrough: { channels: ['head.yaw', 'head.pitch'] } },
  },
  think: {
    summary: 'pondering — a hand to the chin, the weight settles, held',
    keyframes: [
      REST,
      {
        shR: { yaw: -8, pitch: 30, roll: 60 }, elbowR: 138, wristR: { flex: 20 }, fingersR: 40,
        shL: { yaw: 10, pitch: 10 }, elbowL: 55,
        head: { pitch: 10, yaw: 7 }, spine: { sagittal: 0.08, axial: 0.06 },
      },
      {
        shR: { yaw: -8, pitch: 30, roll: 60 }, elbowR: 138, wristR: { flex: 20 }, fingersR: 40,
        shL: { yaw: 10, pitch: 10 }, elbowL: 55,
        head: { pitch: 10, yaw: 7 }, spine: { sagittal: 0.08, axial: 0.06 },
      },
      {
        shR: { yaw: -8, pitch: 30, roll: 60 }, elbowR: 138, wristR: { flex: 20 }, fingersR: 40,
        shL: { yaw: 10, pitch: 10 }, elbowL: 55,
        head: { pitch: 10, yaw: 7 }, spine: { sagittal: 0.08, axial: 0.06 },
      },
      REST,
    ],
    perform: { idle: { breath: 0.04, sway: 0.03 } },
  },
};

export const EMOTE_NAMES = Object.keys(EMOTES);

/** True when a motion spec addresses this library: an emote name, or { emote: name }. */
export const isEmoteSpec = (s) =>
  (typeof s === 'string' && !!EMOTES[s]) || !!(s && typeof s === 'object' && typeof s.emote === 'string');

/**
 * Compile an emote into the standard `phase → dof` motion.
 * @param {string|{emote:string, intensity?:number, perform?:object|false}} spec
 * @param {{frames?:number, intensity?:number, perform?:object|false}} [opts]
 *   intensity → the performance `exaggerate` dial (1 = as authored);
 *   perform → merged OVER the emote's own performance defaults (false skips the layer).
 * @returns {(phase:number)=>object}
 */
export function emoteMotion(spec, { frames = 30, intensity, perform } = {}) {
  const name = typeof spec === 'string' ? spec : spec.emote;
  const def = EMOTES[name];
  if (!def) throw new Error(`figure-emotes: unknown emote '${name}' (use ${EMOTE_NAMES.join('/')})`);
  const push = intensity ?? (typeof spec === 'object' ? spec.intensity : undefined);
  const over = perform ?? (typeof spec === 'object' ? spec.perform : undefined);
  const move = keyframeMotion(def.keyframes, { loop: def.loop !== false });
  if (over === false) return move;
  return performance(move, {
    frames,
    ...def.perform,
    ...(over && typeof over === 'object' ? over : {}),
    ...(push != null && push !== 1 ? { exaggerate: push } : {}),
  });
}
