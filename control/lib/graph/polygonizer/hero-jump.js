/**
 * hero-jump — the hero's JUMPS: one-shot clips on a station-loft rig, each a timeline of key poses in the vajra pose
 * words (figure-posing.js `resolvePose`: hinge, spine, hips, knees, shoulders, elbows, head) plus three channels of its
 * own per key — `sink` (metres the root drops: the load and the landing's absorb), `heel` (degrees the heels rise: the
 * push off the toes), `ground` (1 the feet planted, 0 in the air) and `foot` (metres the planted toes sit ahead of their
 * rest spot: a directional jump's feet fall behind the travelling body at the push and land ahead of it, the body then
 * rolling over them, as a gait's stance slides).
 *
 *   • IN PLACE. The clip never travels or rises: an engine's physics flies the character (as it moves the walker), the
 *     clip carries the body's motion over its feet — the wind-up, the push, the tuck and reach in the air, the absorb.
 *     Its timing rides along (`air`: take-off and touch-down in seconds, and the height a ballistic flight of that air
 *     time reaches), so a game can fly the arc the body was posed for, or time-scale the air to its own.
 *   • SMOOTH. Every numeric channel is a cubic through its keys (Catmull-Rom on the keys' own times, held flat at both
 *     ends), so a pose eases through a key instead of stopping on it (the stock clips' smoothstep stops at every key).
 *   • THE FEET. Planted, each toe holds its rest spot on the floor and the leg reaches it from the sunk root (the knees
 *     bend by the rig's own leg solve); in the air the legs take the key's own pose; between, the toe glides from one to
 *     the other as `ground` eases, so take-off and touch-down never pop. A toe out of reach rises toward the hip.
 *
 * The four: `jump` (standing, straight up), `jumpForward` (leaning into it, legs trailing then reaching ahead),
 * `jumpBack` (leaning back off the toes, legs forward of the body, the absorb pitching forward to recover) and
 * `doubleJump` (a first jump, a kick down off the air with the arms sweeping, a second deeper tuck, the landing) and
 * `runningJump` (a hurdler's leap out of the sprint and back into it: the lead leg out straight, the trail leg round at
 * the side, the trunk diving over the lead, the opposite arm reaching; its planted feet slide back at the run's `speed`,
 * so it plays between sprint cycles, the engine carrying the body on at that speed), and the ROLLS: `rollForward` (a
 * combat roll over the right shoulder), `rollSide` (a tucked barrel roll to the right) and their mirrors
 * `rollForwardLeft`, `rollSideLeft`.
 * Pure and deterministic.
 */
import { rigNodesAt } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const REACH = 0.998;
const ENV = 0.04;     // a roll's lift envelope: the most within ±4 % of the clip, then blurred
const TOUCH = 0.04;   // metres a blending toe rides above the floor at ground 0, easing to 0 (as (1 − ground)^¼) as ground reaches 1
const G = 9.81;
/** the flesh round a joint (metres): what of the body meets the floor in a roll; an ankle's is its own height over the
 * floor at rest on this rig (the heel under it), so a planted foot rests on its toes and heel, not below them */
export const fleshOf = (k, R) => (/^navel/.test(k) ? 0.12 : /^pelvisHub/.test(k) ? 0.11 : /^head(Base|Top)/.test(k) ? 0.09 : /^neck/.test(k) ? 0.08 : /^(shoulder|hip)/.test(k) ? 0.07 : /^(knee|elbow)/.test(k) ? 0.045 : /^ankle/.test(k) ? (R ? Math.max(0, R.joints[k][2] - FLOOR_OF(R)) : 0.014) : /^toe/.test(k) ? 0 : 0.02);
/** the floor: the lowest of the rest toes (base and tip: a planted foot rests on it) */
const FLOOR_OF = (R) => Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));

// arms: shoulder pitch + forward and up, − back (a raised bent arm rolls elbow-down, hero-elbow.js; past ~100° of
// raise the roll runs out and a bent forearm would fold over the head, so an arm raised that high is kept near straight); legs: hip pitch + thigh forward, knee + bend; hinge + trunk forward
// over the hips; spine.sagittal − arches back; head.pitch + lifts the gaze
const both = (o) => Object.fromEntries(Object.entries(o).flatMap(([k, v]) => [[`${k}L`, v], [`${k}R`, v]]));
const arms = (pitch, elbow) => ({ shL: { pitch }, shR: { pitch }, ...both({ elbow }) });
const legs = (hip, knee) => ({ hipL: { pitch: hip }, hipR: { pitch: hip }, ...both({ knee }) });
const legs2 = (hipL, kneeL, hipR, kneeR) => ({ hipL: { pitch: hipL }, hipR: { pitch: hipR }, kneeL, kneeR });
const STAND = { t: 0, pose: {}, sink: 0, heel: 0, ground: 1 };
const end = (t = 1) => ({ ...STAND, t });

/** the jumps: designed seconds and the key timeline (t a share of the clip) */
const BASE = {
  jump: {
    seconds: 1.1,
    keys: [
      STAND,
      { t: 0.2, pose: { hinge: 28, ...arms(-45, 20), head: { pitch: 12 } }, sink: 0.16, heel: 0, ground: 1 },
      { t: 0.25, pose: { hinge: 24, ...arms(-15, 18), head: { pitch: 10 } }, sink: 0.14, heel: 3, ground: 1 },
      { t: 0.37, pose: { hinge: 5, ...arms(135, 10), head: { pitch: 4 } }, sink: 0, heel: 35, ground: 1 },
      { t: 0.42, pose: { hinge: 4, ...arms(145, 12), ...legs(8, 12) }, sink: 0, heel: 20, ground: 0 },
      { t: 0.57, pose: { hinge: 10, ...arms(115, 25), ...legs(55, 90) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.71, pose: { hinge: 6, ...arms(65, 25), ...legs(18, 22) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.79, pose: { hinge: 10, ...arms(45, 25) }, sink: 0.03, heel: 0, ground: 1 },
      { t: 0.87, pose: { hinge: 25, ...arms(35, 30), head: { pitch: 10 } }, sink: 0.15, heel: 0, ground: 1 },
      { t: 0.94, pose: { hinge: 10, ...arms(10, 22), head: { pitch: 4 } }, sink: 0.05, heel: 0, ground: 1 },
      end(),
    ],
  },
  jumpForward: {
    seconds: 1.2,
    // the engine carries the body forward: the planted feet fall behind at the push and land ahead of the body, which
    // then rolls over them (`foot`: the planted toes' fore-aft place, metres, as the gait's stance slides)
    keys: [
      STAND,
      { t: 0.19, pose: { hinge: 36, ...arms(-60, 20), head: { pitch: 18 } }, sink: 0.17, heel: 0, ground: 1, foot: 0 },
      { t: 0.25, pose: { hinge: 34, ...arms(-25, 18), head: { pitch: 16 } }, sink: 0.15, heel: 5, ground: 1, foot: -0.02 },
      { t: 0.37, pose: { hinge: 24, ...arms(115, 12), head: { pitch: 14 } }, sink: 0, heel: 40, ground: 1, foot: -0.14 },
      { t: 0.44, pose: { hinge: 22, ...arms(125, 15), ...legs(-6, 32), head: { pitch: 14 } }, sink: 0, heel: 20, ground: 0, foot: -0.14 },
      { t: 0.58, pose: { hinge: 20, ...arms(100, 35), ...legs(65, 90), head: { pitch: 12 } }, sink: 0, heel: 0, ground: 0, foot: 0.1 },
      { t: 0.71, pose: { hinge: 14, ...arms(80, 20), ...legs(32, 14), head: { pitch: 10 } }, sink: 0, heel: 0, ground: 0, foot: 0.2 },
      { t: 0.8, pose: { hinge: 22, ...arms(75, 20) }, sink: 0.04, heel: 0, ground: 1, foot: 0.2 },
      { t: 0.88, pose: { hinge: 35, ...arms(70, 30), head: { pitch: 18 } }, sink: 0.17, heel: 0, ground: 1, foot: 0.08 },
      { t: 0.95, pose: { hinge: 14, ...arms(25, 22), head: { pitch: 6 } }, sink: 0.05, heel: 0, ground: 1, foot: 0.02 },
      end(),
    ],
  },
  jumpBack: {
    seconds: 1.2,
    keys: [
      STAND,
      { t: 0.19, pose: { hinge: 14, ...arms(-20, 20), head: { pitch: 6 } }, sink: 0.14, heel: 0, ground: 1, foot: 0 },
      { t: 0.25, pose: { hinge: 10, ...arms(15, 15), head: { pitch: 3 } }, sink: 0.11, heel: 4, ground: 1, foot: 0.02 },
      { t: 0.37, pose: { spine: { sagittal: -0.16 }, ...arms(140, 10), head: { pitch: -6 } }, sink: 0, heel: 30, ground: 1, foot: 0.08 },
      { t: 0.44, pose: { spine: { sagittal: -0.18 }, ...arms(150, 15), ...legs(25, 20), head: { pitch: -6 } }, sink: 0, heel: 15, ground: 0, foot: 0.08 },
      { t: 0.58, pose: { spine: { sagittal: -0.12 }, ...arms(110, 35), ...legs(40, 45) }, sink: 0, heel: 0, ground: 0, foot: -0.05 },
      { t: 0.71, pose: { spine: { sagittal: -0.04 }, ...arms(70, 20), ...legs(-4, 12) }, sink: 0, heel: 0, ground: 0, foot: -0.16 },
      { t: 0.8, pose: { hinge: 12, ...arms(60, 20) }, sink: 0.04, heel: 0, ground: 1, foot: -0.16 },
      { t: 0.88, pose: { hinge: 30, ...arms(70, 30), head: { pitch: 14 } }, sink: 0.15, heel: 0, ground: 1, foot: -0.05 },
      { t: 0.95, pose: { hinge: 12, ...arms(25, 22), head: { pitch: 5 } }, sink: 0.05, heel: 0, ground: 1, foot: -0.01 },
      end(),
    ],
  },
  doubleJump: {
    seconds: 1.7,
    // the second push: at `kick` (a share of the clip) the body is driven up again; the first flight is a standing
    // jump's (`firstAir` seconds were it to land), the second whatever reaches the touch-down
    kick: 0.47, firstAir: 0.42,
    keys: [
      STAND,
      { t: 0.13, pose: { hinge: 26, ...arms(-45, 20), head: { pitch: 12 } }, sink: 0.15, heel: 0, ground: 1 },
      { t: 0.18, pose: { hinge: 22, ...arms(-15, 18), head: { pitch: 10 } }, sink: 0.13, heel: 3, ground: 1 },
      { t: 0.27, pose: { hinge: 5, ...arms(135, 10), head: { pitch: 4 } }, sink: 0, heel: 35, ground: 1 },
      { t: 0.31, pose: { hinge: 4, ...arms(140, 12), ...legs(8, 12) }, sink: 0, heel: 20, ground: 0 },
      { t: 0.39, pose: { hinge: 8, ...arms(95, 35), ...legs(40, 60) }, sink: 0, heel: 0, ground: 0 },
      // the second jump: a kick down off the air, the arms sweeping down to swing up again
      { t: 0.47, pose: { hinge: 2, ...arms(-20, 15), ...legs(-6, 8) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.55, pose: { hinge: 18, ...arms(80, 35), ...legs(50, 75) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.64, pose: { hinge: 30, ...arms(140, 25), ...legs(95, 120), head: { pitch: 10 } }, sink: 0, heel: 0, ground: 0 },
      { t: 0.73, pose: { hinge: 14, ...arms(80, 30), ...legs(35, 35) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.8, pose: { hinge: 8, ...arms(55, 25), ...legs(15, 18) }, sink: 0, heel: 0, ground: 0 },
      { t: 0.86, pose: { hinge: 12, ...arms(45, 25) }, sink: 0.04, heel: 0, ground: 1 },
      { t: 0.92, pose: { hinge: 28, ...arms(40, 30), head: { pitch: 12 } }, sink: 0.17, heel: 0, ground: 1 },
      { t: 0.96, pose: { hinge: 12, ...arms(12, 22), head: { pitch: 5 } }, sink: 0.06, heel: 0, ground: 1 },
      end(),
    ],
  },
  // THE RUNNING JUMP, a hurdler's leap out of the sprint and back into it. The left foot takes off (the trail leg), the
  // right leads. Per-side channels: `groundL/R` (each foot's contact), `footL/R` (where each lands, metres ahead of its
  // rest spot), `heelL/R`; a planted foot then slides back at the run's speed (`run`), as the sprint's stance does.
  // trail leg: hip yaw swings a thigh toward −x, so the LEFT thigh opens out to the side with + yaw
  runningJump: {
    // a sprint-length contact to push off, ~0.4 s of flight, one to land, out on the lead foot's push. The rig's hip
    // flexes ~62° at most, so the lead leg reaches forward and down rather than level; the trunk's dive carries the line
    seconds: 0.82, run: true,
    keys: [
      { t: 0, pose: { hinge: 18, ...legs2(25, 15, -30, 100), shL: { pitch: -40 }, shR: { pitch: 50 }, ...both({ elbow: 84 }), head: { pitch: 12 } }, sink: 0.03, heelL: 0, heelR: 0, groundL: 1, groundR: 0, footL: 0.3, footR: 0 },
      { t: 0.1, pose: { hinge: 22, ...legs2(0, 20, 25, 115), shL: { pitch: 15 }, shR: { pitch: 0 }, ...both({ elbow: 84 }), head: { pitch: 14 } }, sink: 0.06, heelL: 5, heelR: 0, groundL: 1, groundR: 0, footL: 0.3, footR: 0 },
      { t: 0.18, pose: { hinge: 30, ...legs2(-20, 15, 70, 65), shL: { pitch: 80 }, shR: { pitch: -45 }, elbowL: 30, elbowR: 80, head: { pitch: 20 } }, sink: 0, heelL: 35, heelR: 0, groundL: 1, groundR: 0, footL: 0.3, footR: 0 },
      { t: 0.3, pose: { hinge: 36, hipL: { pitch: -15, yaw: 30 }, kneeL: 60, hipR: { pitch: 85 }, kneeR: 6, shL: { pitch: 92 }, shR: { pitch: -50 }, elbowL: 8, elbowR: 85, head: { pitch: 26 } }, sink: 0, heelL: 10, heelR: 0, groundL: 0, groundR: 0, footL: 0, footR: 0 },
      { t: 0.48, pose: { hinge: 40, hipL: { pitch: 15, yaw: 65 }, kneeL: 95, hipR: { pitch: 82 }, kneeR: 5, shL: { pitch: 92 }, shR: { pitch: -50 }, elbowL: 8, elbowR: 85, head: { pitch: 28 } }, sink: 0, heelL: 0, heelR: 0, groundL: 0, groundR: 0, footL: 0, footR: 0 },
      { t: 0.66, pose: { hinge: 24, hipL: { pitch: 55, yaw: 40 }, kneeL: 100, hipR: { pitch: 35 }, kneeR: 6, shL: { pitch: 45 }, shR: { pitch: 0 }, elbowL: 55, elbowR: 84, head: { pitch: 18 } }, sink: 0, heelL: 0, heelR: 0, groundL: 0, groundR: 0, footL: 0, footR: 0.18 },
      { t: 0.79, pose: { hinge: 20, hipL: { pitch: 70, yaw: 15 }, kneeL: 105, hipR: { pitch: 25 }, kneeR: 8, shL: { pitch: 50 }, shR: { pitch: -40 }, ...both({ elbow: 84 }), head: { pitch: 14 } }, sink: 0.1, heelL: 0, heelR: 0, groundL: 0, groundR: 1, footL: 0, footR: 0.18 },
      { t: 0.9, pose: { hinge: 20, hipL: { pitch: 60, yaw: 0 }, kneeL: 100, shL: { pitch: 5 }, shR: { pitch: 5 }, ...both({ elbow: 84 }), head: { pitch: 14 } }, sink: 0.09, heelL: 0, heelR: 5, groundL: 0, groundR: 1, footL: 0, footR: 0.18 },
      { t: 1, pose: { hinge: 18, hipL: { pitch: 45 }, kneeL: 70, shL: { pitch: -40 }, shR: { pitch: 50 }, ...both({ elbow: 84 }), head: { pitch: 12 } }, sink: 0.02, heelL: 0, heelR: 30, groundL: 0, groundR: 1, footL: 0, footR: 0.18 },
    ],
  },
  // THE ROLLS: the whole tucked body turning a full circle along the floor (`pitchBody` forward, `rollBody` to the right,
  // degrees), the floor solve keeping its lowest part on the ground; in place, the engine carries it on at the roll's
  // speed (`roll.speed`). The tuck is the trunk hinged down over the hips with the spine curled (the hip flexes ~62° at
  // most), the chin in, the arms round the shins.
  rollForward: {
    seconds: 1.5, roll: 'forward', side: 'right',
    // over the RIGHT shoulder (the combat roll): tilted onto it before going over, so the back meets the floor on a
    // diagonal, right shoulder to left hip, and the head stays off the ground
    keys: [
      { ...STAND, pitchBody: 0 },
      { t: 0.14, pose: { hinge: 40, spine: { sagittal: 0.1 }, ...arms(55, 15), head: { pitch: -15 } }, sink: 0.32, heel: 0, ground: 1, pitchBody: 0 },
      // the feet leave first (the turn waits for them), then the dive
      { t: 0.2, pose: { hinge: 50, spine: { sagittal: 0.2 }, ...legs(25, 55), ...arms(60, 16), neck: { pitch: -15 }, head: { pitch: -30 } }, sink: 0.31, heel: 25, ground: 0, pitchBody: 3, rollBody: -6 },
      { t: 0.25, pose: { hinge: 62, spine: { sagittal: 0.47 }, ...legs(50, 105), ...arms(62, 18), neck: { pitch: -40, yaw: -30 }, head: { pitch: -45, yaw: -25 } }, sink: 0.3, heel: 20, ground: 0, pitchBody: 15, rollBody: -30 },
      // passing the vertical: tilted furthest onto the shoulder, the head tipped away from it
      { t: 0.29, pose: { hinge: 40, spine: { sagittal: 0.55 }, ...legs(58, 125), ...arms(60, 60), neck: { pitch: -40, yaw: -40 }, head: { pitch: -45, yaw: -35 } }, sink: 0.12, heel: 0, ground: 0, pitchBody: 50, rollBody: -70 },
      { t: 0.36, pose: { hinge: 50, spine: { sagittal: 0.55 }, ...legs(60, 130), ...arms(60, 100), neck: { pitch: -40, yaw: -30 }, head: { pitch: -45, yaw: -25 } }, sink: 0, heel: 0, ground: 0, pitchBody: 115, rollBody: -62 },
      { t: 0.5, pose: { hinge: 70, spine: { sagittal: 0.55 }, ...legs(60, 132), ...arms(60, 100), neck: { pitch: -40, yaw: -30 }, head: { pitch: -45, yaw: -25 } }, sink: 0, heel: 0, ground: 0, pitchBody: 245, rollBody: -30 },
      { t: 0.63, pose: { hinge: 58, spine: { sagittal: 0.45 }, ...legs(58, 132), ...arms(65, 80), neck: { pitch: -40, yaw: -30 }, head: { pitch: -45, yaw: -25 } }, sink: 0, heel: 0, ground: 0, pitchBody: 330, rollBody: -10 },
      { t: 0.72, pose: { hinge: 45, spine: { sagittal: 0.15 }, ...legs(50, 120), ...arms(70, 20), head: { pitch: -5 } }, sink: 0.32, heel: 0, ground: 0, pitchBody: 360 },
      { t: 0.79, pose: { hinge: 40, spine: { sagittal: 0.1 }, ...arms(70, 20) }, sink: 0.32, heel: 0, ground: 1, pitchBody: 360 },
      { t: 0.9, pose: { hinge: 15, ...arms(30, 20), head: { pitch: 4 } }, sink: 0.1, heel: 0, ground: 1, pitchBody: 360 },
      { ...end(), pitchBody: 360 },
    ],
  },
  rollSide: {
    seconds: 1.35, roll: 'side', side: 'right',
    keys: [
      { ...STAND, rollBody: 0 },
      { t: 0.14, pose: { hinge: 30, spine: { sagittal: 0.1 }, ...arms(60, 110), head: { pitch: -15 } }, sink: 0.28, heel: 0, ground: 1, rollBody: 0 },
      { t: 0.2, pose: { hinge: 40, spine: { sagittal: 0.18 }, ...legs(20, 50), ...arms(60, 112), neck: { pitch: -20 }, head: { pitch: -25 } }, sink: 0.27, heel: 15, ground: 0, rollBody: 6 },
      { t: 0.25, pose: { hinge: 50, spine: { sagittal: 0.40 }, ...legs(40, 90), ...arms(60, 115), neck: { pitch: -40 }, head: { pitch: -45 } }, sink: 0.25, heel: 15, ground: 0, rollBody: 45 },
      { t: 0.36, pose: { hinge: 65, spine: { sagittal: 0.50 }, ...legs(60, 130), ...arms(60, 115), neck: { pitch: -40 }, head: { pitch: -45 } }, sink: 0, heel: 0, ground: 0, rollBody: 140 },
      { t: 0.5, pose: { hinge: 65, spine: { sagittal: 0.50 }, ...legs(60, 132), ...arms(60, 115), neck: { pitch: -40 }, head: { pitch: -45 } }, sink: 0, heel: 0, ground: 0, rollBody: 235 },
      { t: 0.63, pose: { hinge: 55, spine: { sagittal: 0.43 }, ...legs(58, 130), ...arms(60, 100), neck: { pitch: -40 }, head: { pitch: -45 } }, sink: 0, heel: 0, ground: 0, rollBody: 325 },
      { t: 0.72, pose: { hinge: 40, spine: { sagittal: 0.12 }, ...legs(50, 120), ...arms(60, 40), head: { pitch: -5 } }, sink: 0.28, heel: 0, ground: 0, rollBody: 360 },
      { t: 0.79, pose: { hinge: 36, spine: { sagittal: 0.1 }, ...arms(55, 30) }, sink: 0.28, heel: 0, ground: 1, rollBody: 360 },
      { t: 0.9, pose: { hinge: 14, ...arms(25, 20), head: { pitch: 4 } }, sink: 0.1, heel: 0, ground: 1, rollBody: 360 },
      { ...end(), rollBody: 360 },
    ],
  },
};
// THE MIRROR: a clip done to the other side — each L / R channel swapped for its twin, and every sideways angle (a
// joint's yaw, roll and turn, the spine's lateral bend and axial twist, the body's roll) turned the other way; the
// pitches, the bends and the timing are a side's own. The rig is symmetric, so the mirror is exact.
const SIDEWAYS = new Set(['yaw', 'roll', 'turn', 'lateral', 'axial', 'rollBody', 'facing', 'glance', 'x']);   // (`x`: a shift's, an aim's across)
const twin = (k) => k.replace(/([LR])$/, (s) => (s === 'L' ? 'R' : 'L'));
export function mirrored(o) {
  if (Array.isArray(o)) return o.map(mirrored);
  if (!o || typeof o !== 'object') return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [/^(sh|elbow|hip|knee|ankle|toe|wrist|fingers|ground|foot|heel|out|splay)[LR]$/.test(k) ? twin(k) : k, SIDEWAYS.has(k) && Number.isFinite(v) ? -v : mirrored(v)]));
}
/** the left-hand rolls: the right ones mirrored (over the LEFT shoulder; rolling to the left) */
export const JUMPS = Object.freeze({
  ...BASE,
  rollForwardLeft: { ...BASE.rollForward, side: 'left', keys: mirrored(BASE.rollForward.keys) },
  rollSideLeft: { ...BASE.rollSide, side: 'left', keys: mirrored(BASE.rollSide.keys) },
});
export const JUMP_NAMES = Object.keys(JUMPS);

// ─── the timeline ──────────────────────────────────────────────────────────
/** every numeric leaf of a pose as a path → value map (`hipL.pitch`, `kneeL`, `spine.sagittal`) */
function flatten(o, pre = '', out = {}) { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object') flatten(v, `${pre}${k}.`, out); else if (Number.isFinite(v)) out[`${pre}${k}`] = v; } return out; }
function unflatten(m) { const o = {}; for (const [p, v] of Object.entries(m)) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] || (c[k] = {}); }); c[ks[ks.length - 1]] = v; } return o; }

/** a cubic through (t, v) keys — Catmull-Rom on non-uniform times, flat at both ends, never overshooting a key pair's range */
function curve(keys) {
  const n = keys.length;
  const slope = keys.map((k, i) => (i === 0 || i === n - 1 ? 0 : (keys[i + 1].v - keys[i - 1].v) / (keys[i + 1].t - keys[i - 1].t)));
  // monotone limit (Fritsch–Carlson): a slope never pushes past the neighbours, so no key is overshot
  for (let i = 0; i < n - 1; i++) {
    const d = (keys[i + 1].v - keys[i].v) / (keys[i + 1].t - keys[i].t);
    if (d === 0) { slope[i] = 0; slope[i + 1] = 0; continue; }
    const a = slope[i] / d, b = slope[i + 1] / d;
    if (a < 0) slope[i] = 0; if (b < 0) slope[i + 1] = 0;
    const r = Math.hypot(a, b); if (r > 3) { slope[i] = (3 * a / r) * d; slope[i + 1] = (3 * b / r) * d; }
  }
  return (t) => {
    if (t <= keys[0].t) return keys[0].v; if (t >= keys[n - 1].t) return keys[n - 1].v;
    let i = 0; while (keys[i + 1].t < t) i++;
    const h = keys[i + 1].t - keys[i].t, s = (t - keys[i].t) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[i].v + (s3 - 2 * s2 + s) * h * slope[i] + (-2 * s3 + 3 * s2) * keys[i + 1].v + (s3 - s2) * h * slope[i + 1];
  };
}

/**
 * A jump on a rig: `fn(t)` (t 0 … 1 over the clip, inclusive: a one-shot) → the rig pose, and `air` — take-off,
 * touch-down and apex in seconds, and the height a ballistic flight of that air time reaches (metres); a double jump's
 * adds the `kick` (seconds), the height it happens at (`kickHeight`), the upward speed it adds (`kickSpeed`, m/s) and the
 * second flight's apex (`apex`, `apexHeight`), the first flight's height being `height`.
 * @param {string} name  a JUMPS name
 * @param {object} R     a validated rig
 */
export function heroJump(name, R, opts = {}) {
  const J = JUMPS[name]; if (!J) throw new Error(`hero-jump: no jump '${name}' (have ${JUMP_NAMES.join(', ')})`);
  return keyedClip(J, R, opts);
}

/** any one-shot timeline in the JUMPS shape (`{ seconds, keys, run?, roll?, side?, kick?, firstAir? }`) on a rig, as heroJump */
export function keyedClip(J, R, opts = {}) {
  const { seconds } = opts;
  const T = seconds ?? J.seconds;
  // one curve per channel over every key (a channel a key leaves out is 0 there: the stand)
  const flat = J.keys.map((k) => flatten(k.pose));
  const paths = [...new Set(flat.flatMap((f) => Object.keys(f)))];
  // the jump's own channels: `sink`, and per side `ground`, `foot`, `heel` (a key's `groundL` over its `ground`, …)
  // (and `out<S>`, metres a planted toe sits out from its rest place: a stance's, hero-stance.js)
  const own = (k, p) => { if (p === '$sink') return k.sink; if (p === '$pitchBody' || p === '$rollBody') return k[p.slice(1)] ?? 0; const [, ch, S] = p.match(/^\$(ground|foot|heel|out)([LR])$/); return k[`${ch}${S}`] ?? k[ch] ?? 0; };
  const outs = J.keys.some((k) => ['out', 'outL', 'outR'].some((c) => k[c] !== undefined));
  const OWN = ['$sink', '$pitchBody', '$rollBody', ...['ground', 'foot', 'heel', ...(outs ? ['out'] : [])].flatMap((c) => ['L', 'R'].map((S) => `$${c}${S}`))];
  const curves = Object.fromEntries([...paths, ...OWN].map((p) => [p, curve(J.keys.map((k, i) => ({ t: k.t, v: OWN.includes(p) ? own(k, p) : (flat[i][p] ?? 0) })))]));
  const rest = R.joints; const sides = Object.keys(R.legs);
  const legOf = Object.fromEntries(sides.map((S) => { const L = R.legs[S]; return [S, { L, reach: REACH * (len(sub(rest[L.knee], rest[L.hip])) + len(sub(rest[L.hock], rest[L.knee]))), heel: sub(rest[L.hock], rest[L.toeBase]), floor: rest[L.toeBase][2] }]; }));
  const speed = J.run ? (opts.speed ?? 5) : 0;
  const M = 400;
  // each foot's contacts (ground above 0), and in each the moment it is FULLY down: the authored `foot` is where the toe
  // is then, and through the whole contact — the blend in, the stance, the blend out — the planted point moves back at
  // the run's speed through it (ahead before, behind after), so no blend ever pulls the toe off the run's pace
  const contacts = Object.fromEntries(['L', 'R'].map((S) => {
    const g = Array.from({ length: M + 1 }, (_, i) => curves[`$ground${S}`](i / M)); const out = []; let on = g[0] > 1e-4 ? 0 : -1;
    const close = (end) => { let full = on; for (let i = on; i <= end; i++) if (g[i] >= 0.999) { full = i; break; } out.push([on / M, end / M, full / M]); };
    for (let i = 1; i <= M; i++) { if (g[i] > 1e-4 && g[i - 1] <= 1e-4) on = i - 1; if (g[i] <= 1e-4 && g[i - 1] > 1e-4 && on >= 0) { close(i); on = -1; } }
    if (on >= 0) close(M);
    return [S, out];
  }));
  const slideOf = (S, t) => {
    if (!speed) return 0;
    const c = contacts[S].find(([a, b]) => t >= a && t <= b); return c ? -speed * (t - c[2]) * T : 0;
  };
  // A ROLL'S HEIGHT: at each moment the lift that sets the body's lowest part on the floor — a polygon of joints rolling
  // has a corner each time the contact passes from one part to the next, so the lift is smoothed into its upper
  // envelope (the most of it within ±ENV, then blurred): never into the floor, never a bump at the hand-offs
  let upOf = () => 0;
  // THE TURN waits for the feet: scaled by how far they are off the ground (planted, none — the leg solve's feet would
  // swing off their spots; airborne, all of it), each angle taken to its nearest equivalent (360° is 0°) so a turn
  // fading out at the landing never unwinds the circle
  const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const turnAt = (t) => { const off = 1 - Math.max(0, Math.min(1, Math.max(curves.$groundL(t), curves.$groundR(t)))); return { pitch: wrap(curves.$pitchBody(t)) * off, roll: wrap(curves.$rollBody(t)) * off, at: rest.navel }; };
  const poseAt = (t) => fnAt(t, true);
  if (J.roll) {
    const raw = Array.from({ length: M + 1 }, (_, i) => { const t = i / M; const out = poseAt(t); const turned = rigNodesAt(R, { ...out, body: turnAt(t) }).nodes; let low = Infinity; for (const [k, p] of Object.entries(turned)) low = Math.min(low, p[2] - fleshOf(k, R)); return FLOOR_OF(R) - low; });
    const W = Math.round(ENV * M); const dil = raw.map((_, i) => { let m = -Infinity; for (let j = Math.max(0, i - W); j <= Math.min(M, i + W); j++) m = Math.max(m, raw[j]); return m; });
    const sg = W / 2, ker = Array.from({ length: 2 * W + 1 }, (_, j) => Math.exp(-((j - W) ** 2) / (2 * sg * sg)));
    const env = dil.map((_, i) => { let a = 0, w = 0; for (let j = -W; j <= W; j++) { const k = Math.max(0, Math.min(M, i + j)); a += dil[k] * ker[j + W]; w += ker[j + W]; } return a / w; });
    // the envelope only while the body is off its feet (fading by their ground): a planted foot keeps the floor exactly
    const lifted = env.map((v, i) => { const w = Math.max(curves.$groundL(i / M), curves.$groundR(i / M)), r = raw[i]; return r + (Math.max(v, r) - r) * (1 - Math.max(0, Math.min(1, w))); });
    upOf = (t) => { const x = Math.max(0, Math.min(1, t)) * M, i = Math.min(M - 1, Math.floor(x)), f = x - i; return lifted[i] * (1 - f) + lifted[i + 1] * f; };
  }
  const fn = (t) => fnAt(t, false);
  function fnAt(t, noRoll) {
    const pose = elbowsDown(R, unflatten(Object.fromEntries(paths.map((p) => [p, curves[p](t)]))));   // a raised arm bends with its elbow down
    const sink = Math.max(0, curves.$sink(t));
    const free = rigNodesAt(R, { ...pose, support: 'none', sink }).nodes;
    // a foot fully off the ground keeps the leg's own pose (no target: the leg solve's knee pole would re-aim a leg
    // turned out at the hip, the hurdler's trail leg); any touch of ground, and the toe is steered
    const feet = {}, heels = {};
    for (const S of sides) {
      const { L, reach, heel: hv0, floor } = legOf[S];
      const w = Math.max(0, Math.min(1, curves[`$ground${S}`](t))), heel = Math.max(0, curves[`$heel${S}`](t)); heels[`heel${S}`] = -heel;
      const planted = [rest[L.toeBase][0] + (outs ? Math.sign(rest[L.hip][0]) * curves[`$out${S}`](t) : 0), rest[L.toeBase][1] + curves[`$foot${S}`](t) + slideOf(S, t), rest[L.toeBase][2]];
      let target = lerp3(free[L.toeBase], planted, w);
      // the toe TOUCHES only once the blend is whole: until then it rides just above the floor (a toe clamped down while
      // still blending from its swing would skate along the ground at the swing's speed)
      // (and the hover itself fades in from no ground at all, or a leaving toe would drop the hover's height at once)
      if (!J.roll) target[2] = Math.max(target[2], floor + TOUCH * Math.pow(1 - w, 0.25) * Math.min(1, w / 0.15));   // a roll's floor is its floor solve's
      // the hock for this heel (the rig turns the toe-base → hock line about x by −heel), and the reach from the hip
      const a = (-heel * Math.PI) / 180; let hv = [hv0[0], hv0[1] * Math.cos(a) - hv0[2] * Math.sin(a), hv0[1] * Math.sin(a) + hv0[2] * Math.cos(a)];
      // a splayed foot (a stance's `splay<S>`, the rig turning it about its ball) puts its hock round the vertical too
      const sp = pose[`splay${S}`]; if (Number.isFinite(sp) && sp) { const b = (sp * (rest[L.hip][0] < 0 ? 1 : -1) * Math.PI) / 180; hv = [hv[0] * Math.cos(b) - hv[1] * Math.sin(b), hv[0] * Math.sin(b) + hv[1] * Math.cos(b), hv[2]]; }
      const hip = free[L.hip]; const hock = (p) => [p[0] + hv[0], p[1] + hv[1], p[2] + hv[2]];
      const d = len(sub(hock(target), hip));
      if (d > reach) { const dir = sub(hock(target), hip); target = sub([hip[0] + (dir[0] * reach) / d, hip[1] + (dir[1] * reach) / d, hip[2] + (dir[2] * reach) / d], hv); }
      if (w > 1e-6) feet[S] = target;
    }
    const out = { ...pose, support: 'none', feet, sink, ...heels };
    if (!J.roll || noRoll) return out;
    // the ROLL: the posed body turned about the navel, then set down so its lowest part (each joint with the flesh round
    // it) rests on the floor
    return { ...out, body: { ...turnAt(t), up: upOf(t) } };
  };
  // the air: where `ground` crosses ½ going down and coming back up (the first take-off, the last touch-down)
  const g = Array.from({ length: M + 1 }, (_, i) => Math.max(curves.$groundL(i / M), curves.$groundR(i / M)));   // a foot down
  const off = g.findIndex((v, i) => i > 0 && v < 0.5 && g[i - 1] >= 0.5); let on = -1; for (let i = M; i > 0; i--) if (g[i] >= 0.5 && g[i - 1] < 0.5) { on = i; break; }
  const r4 = (x) => +x.toFixed(4);
  // a roll's ground: from where the turn starts to where it ends, rolling without slipping — each step of turn times the
  // pivot's height over the floor — so `speed` is what the engine carries it on at
  const rollMeta = J.roll ? (() => {
    const ch = J.roll === 'forward' ? '$pitchBody' : '$rollBody'; let start = -1, endT = -1, travel = 0, prev = null;   // a left side roll turns −360°
    for (let i = 0; i <= M; i++) {
      const t = i / M, a = Math.abs(curves[ch](t));
      if (start < 0 && a > 1) start = t; if (endT < 0 && a >= 359) endT = t;
      const up = fn(t).body.up; const h = rest.navel[2] + up - FLOOR_OF(R);
      if (prev) travel += (Math.abs(a - prev.a) * Math.PI / 180) * (h + prev.h) / 2; prev = { a, h };
    }
    const dur = (endT - start) * T;
    return { axis: J.roll, side: J.side, start: r4(start * T), end: r4(endT * T), travel: r4(travel), speed: r4(travel / dur) };
  })() : null;
  const air = off > 0 && on > off ? (() => {
    const t0 = (off / M) * T, t1 = (on / M) * T, ta = t1 - t0;
    if (!J.kick) return { takeoff: r4(t0), land: r4(t1), apex: r4((t0 + t1) / 2), height: r4((G * ta * ta) / 8), ...(speed ? { speed: r4(speed) } : {}) };
    // two flights: the first a standing jump's, cut at the kick; the second from there to the touch-down
    const tk = J.kick * T, v1 = (G * J.firstAir) / 2, u = tk - t0; const yk = v1 * u - (G * u * u) / 2, vk = v1 - G * u;
    const tau = t1 - tk, v2 = ((G * tau * tau) / 2 - yk) / tau; const apex2 = tk + v2 / G;
    return { takeoff: r4(t0), land: r4(t1), kick: r4(tk), height: r4((v1 * v1) / (2 * G)), kickHeight: r4(yk), kickSpeed: r4(v2 - vk), apex: r4(apex2), apexHeight: r4(yk + (v2 * v2) / (2 * G)) };
  })() : null;
  return { fn, seconds: T, air: J.roll ? null : air, ...(rollMeta ? { roll: rollMeta } : {}) };
}
