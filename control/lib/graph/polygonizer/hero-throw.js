/**
 * hero-throw — THROWING A BALL: the manual manipulator's arm and hand on a ball (hero-ball-grip.js), the throw a chain of
 * phases whose hand places are set by the body as it turns, the body's own channels keyed by the technique, the arm
 * solved to each place (hero-grip holdArm: the wrist in its range, the elbow as the throw wants it), and the whole TIMED
 * so the ball leaves the hand at the technique's real speed. Right-handed; the target is +y.
 *
 *   THE LIBRARY (THROWS): each technique the ball it throws, its grip, its stance, the hands on the ball (one, or two on
 *   its sides), its RELEASE (speed m/s, elevation degrees, spin: an axis in the thrower's frame and revolutions a second;
 *   real figures, cited where they come from), and its KEYS: a phase each (set, wind-up, cock, release, follow-through
 *   …), its share of the throw's time, the body's channels (`face`: the hips' turn off the stance toward the target,
 *   degrees; `turn`, `bow`, `lean`: the spine's axial, forward and side shares; `sink`: m), and each hand's place (a
 *   landmark of the posed body and metres off it, + right, + toward the target, + up), its fingers' way (`along`) and its
 *   palm's (`palm`). A two-handed throw names the ball's place and both palms face it.
 *   THE TIMING: the keys' shares, then the drive (the key before the release to the release) re-timed so the ball's speed
 *   at the release, read off the played clip, is the technique's (servo-bound: hero-servo's speeds are a report).
 *   heroThrow(name, R) → { name, clip (one-shot), seconds, release ({ t (share of the clip), at (the ball's centre),
 *     velocity (the clip's own, m/s), speed, elevation, spec (the library's release: what a game launches) }), ball
 *     ({ id, r, grip, side, centreRest }), mounts (the ball as a prop riding the hand: props), keys, checks }
 *   throwNodes(T, R, u) → the rig's posed nodes at share u (a stick figure's joints), and the ball's centre while held.
 * Pure and deterministic.
 */
import { rigNodesAt, boneFrames, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { heroStance, reachArm, comOf, hull, margin } from './hero-stance.js';
import { holdArm, landmark, liteOf, alignFrame, wristFor, anatomicalForearm, WRIST_RANGE } from './hero-grip.js';
import { handFrame, servoReport } from './hero-servo.js';
import { keyedClip } from './hero-jump.js';
import { ballGrip, ballOf } from './hero-ball-grip.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
/** the rotation of `deg` degrees about the unit k (rows) */
const rotAbout = (k, deg) => { const a = deg / DEG, c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = k; return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]; };
const r1 = (x) => Math.round(x * 10) / 10 + 0, r3 = (x) => Math.round(x * 1000) / 1000 + 0, r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const DEG = 180 / Math.PI;
/** the drive: metres either side of the release the ball is keyed on its launch line (its seconds the release's speed
 * gives) */
export const DRIVE = 0.12;
/** a hand's place is held within this share of the arm's length from its shoulder (a straight arm, not locked) */
export const REACH = 0.96;
/** the most the played ball may wander off its launch line through the drive (m) */
export const WOBBLE = 0.03;
/** a key's arm held near the key before's (holdArm's seed: a degree's weight), so the joints' curves between keys run as the hand does */
const NEAR = 0.03, DRIVE_NEAR = 0.3;

/** the stances a throw stands in (hero-stance words; `left`: a right-hander's left foot leads) */
const STANCES = Object.freeze({
  side: { family: 'bladed', spread: 0.55, line: 70, toes: { L: 55, R: 10 }, sink: 0.05, lean: 4, weight: 0.4, heel: 0, chest: 0.3, left: true },
  square: { family: 'square', spread: 0.34, line: 18, toes: { L: 8, R: 4 }, sink: 0.04, lean: 6, weight: 0.5, heel: 0, chest: 0.6, left: true },
  stride: { family: 'square', spread: 0.48, line: 30, toes: { L: 10, R: 6 }, sink: 0.12, lean: 12, weight: 0.6, heel: 0, chest: 0.8, left: true },
});
const HANDS = { R: { at: 'navel', fwd: 0.05, up: -0.2, side: 0.22 }, L: { at: 'navel', fwd: 0.05, up: -0.2, side: -0.22 } };

/** a hand's place: [landmark, [right, toward, up] m] */
const at = (lm, d) => ({ lm, d });
// fingers' way and palm's, in the thrower's frame (+x right, +y the target, +z up)
const UP = [0, 0, 1], FWD = [0, 1, 0], BACK = [0, -1, 0], DOWN = [0, 0, -1], RIGHT = [1, 0, 0], LEFT = [-1, 0, 0];
const mix = (...v) => unit(v.reduce((a, b) => add(a, b), [0, 0, 0]));

/**
 * THE THROWS. Release figures (speed, elevation, spin) are the sport's own, typical of a skilled adult (not an elite's):
 * a pitcher's four-seam fastball 33–40 m/s with 2200–2400 rpm of backspin (Statcast); a quarterback's pass 20–25 m/s,
 * its spiral about 600 rpm about the ball's long axis, launched 20–30° up; a basketball shot 7–8 m/s at 50–55° with
 * about 2 rev/s of backspin, a chest pass 8–10 m/s near level; a soccer throw-in 12–16 m/s at 30–35°; a handball
 * shot 20–28 m/s; a softball underhand (windmill) pitch 25–30 m/s; a bowling ball 7–8 m/s off the hand at the
 * foul line, with 250–350 rpm of side roll; a toss to serve 3–4 m/s up.
 */
export const THROWS = Object.freeze({
  overhand: {
    says: 'the overhand throw: side on, the arm back and cocked behind the head, the hips then the trunk turning through, the ball out in front of the head, the arm across the body after',
    ball: 'baseball', grip: 'fingertip', stance: 'side', hands: 1, sports: ['baseball', 'softball (fielding)', 'cricket (fielding)', 'dodgeball'],
    release: { speed: 34, elevation: 2, spin: { axis: 'back', rps: 37 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0 }, R: { at: at('chest', [0.04, 0.22, -0.04]), along: mix(UP, FWD), palm: LEFT }, L: { at: at('chest', [-0.02, 0.24, -0.04]), along: mix(UP, FWD), palm: RIGHT } },
      { name: 'windup', at: 0.42, body: { face: -12, turn: -0.4, bow: -0.05, lean: -0.08 }, R: { at: at('shoulderR', [0.22, -0.32, -0.02]), along: mix(BACK, UP, mul(RIGHT, 0.3)), palm: DOWN }, L: { at: at('shoulderL', [-0.04, 0.5, 0.02]), along: FWD, palm: DOWN } },
      { name: 'cock', at: 0.74, body: { face: 25, turn: -0.1, bow: 0.05, lean: -0.22 }, R: { at: at('shoulderR', [0.2, -0.12, 0.26]), along: mix(UP, mul(BACK, 0.5)), palm: mix(FWD, mul(RIGHT, 0.4)) }, L: { at: at('shoulderL', [0.04, 0.42, -0.08]), along: FWD, palm: mix(DOWN, RIGHT) } },
      { name: 'release', at: 0.86, release: true, body: { face: 58, turn: 0.7, bow: 0.4, lean: -0.12 }, R: { at: at('shoulderR', [-0.02, 0.4, 0.16]), along: mix(UP, FWD), palm: mix(FWD, mul(DOWN, 0.6)) }, L: { at: at('chest', [-0.16, 0.14, -0.08]), along: UP, palm: RIGHT } },
      { name: 'follow', at: 1, body: { face: 62, turn: 0.9, bow: 0.55, lean: 0 }, R: { at: at('hipL', [0.08, 0.38, 0.02]), along: mix(DOWN, LEFT), palm: mix(LEFT, BACK) }, L: { at: at('hipL', [-0.12, 0.05, 0.12]), along: DOWN, palm: RIGHT } },
    ],
  },
  quarterback: {
    says: 'the forward pass: the ball by the ear in both hands, the off hand leaving it as the arm draws back, the elbow at the shoulder\'s height, the ball out over the head, the hand turning out (the spiral) and down',
    ball: 'football', grip: 'spread', stance: 'side', hands: 1, sports: ['American football', 'rugby league (the long pass is a spin pass: lateral)'],
    release: { speed: 22, elevation: 25, spin: { axis: 'along', rps: 10 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0 }, R: { at: at('shoulderR', [-0.02, 0.18, 0.08]), along: mix(UP, FWD), palm: LEFT }, L: { at: at('shoulderR', [-0.2, 0.2, 0.04]), along: mix(UP, FWD), palm: RIGHT } },
      { name: 'cock', at: 0.62, body: { face: 15, turn: -0.15, bow: 0, lean: -0.18 }, R: { at: at('shoulderR', [0.16, -0.18, 0.2]), along: mix(UP, mul(BACK, 0.4)), palm: mix(FWD, mul(RIGHT, 0.3)) }, L: { at: at('shoulderL', [0.0, 0.42, -0.02]), along: FWD, palm: DOWN } },
      { name: 'release', at: 0.82, release: true, body: { face: 50, turn: 0.55, bow: 0.25, lean: -0.1 }, R: { at: at('shoulderR', [0.0, 0.42, 0.3]), along: mix(UP, mul(FWD, 0.8)), palm: mix(FWD, mul(RIGHT, 0.6), mul(DOWN, 0.3)) }, L: { at: at('chest', [-0.16, 0.14, -0.08]), along: UP, palm: RIGHT } },
      { name: 'follow', at: 1, body: { face: 55, turn: 0.75, bow: 0.4 }, R: { at: at('hipL', [0.1, 0.42, 0.1]), along: mix(DOWN, FWD), palm: mix(RIGHT, DOWN) }, L: { at: at('hipL', [-0.12, 0.05, 0.12]), along: DOWN, palm: RIGHT } },
    ],
  },
  sidearm: {
    says: 'the sidearm throw: the arm out level from the shoulder, the hips and the trunk whipping it round, the ball out at the shoulder\'s height',
    ball: 'cricket', grip: 'power', stance: 'side', hands: 1, sports: ['cricket (a flat return)', 'baseball (a submarine release)', 'skipping a stone'],
    release: { speed: 28, elevation: 4, spin: { axis: 'side', rps: 20 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0 }, R: { at: at('chest', [0.06, 0.22, -0.06]), along: mix(UP, FWD), palm: LEFT }, L: { at: at('chest', [-0.02, 0.24, -0.06]), along: mix(UP, FWD), palm: RIGHT } },
      { name: 'windup', at: 0.55, body: { face: -10, turn: -0.4, bow: 0.15, lean: 0.15 }, R: { at: at('shoulderR', [0.45, -0.38, -0.08]), along: mix(RIGHT, BACK), palm: mix(DOWN, FWD) }, L: { at: at('shoulderL', [-0.1, 0.45, 0]), along: FWD, palm: DOWN } },
      { name: 'release', at: 0.84, release: true, body: { face: 55, turn: 0.6, bow: 0.25, lean: 0.25 }, R: { at: at('shoulderR', [0.4, 0.42, -0.12]), along: mix(RIGHT, FWD), palm: FWD }, L: { at: at('chest', [-0.16, 0.12, -0.1]), along: UP, palm: RIGHT } },
      { name: 'follow', at: 1, body: { face: 50, turn: 0.75, bow: 0.25, lean: 0 }, R: { at: at('shoulderL', [-0.05, 0.42, -0.2]), along: mix(LEFT, FWD), palm: LEFT }, L: { at: at('hipL', [-0.12, 0.05, 0.12]), along: DOWN, palm: RIGHT } },
    ],
  },
  underhand: {
    says: 'the underhand pitch: the arm swung back and round past the hip, the stride forward, the ball let go by the front of the thigh with the palm up and forward',
    ball: 'softball', grip: 'power', stance: 'stride', hands: 1, sports: ['softball (the windmill, its last half)', 'a toss to a teammate', 'rounders'],
    release: { speed: 26, elevation: 3, spin: { axis: 'top', rps: 20 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0.15 }, R: { at: at('chest', [0.06, 0.2, -0.1]), along: mix(UP, FWD), palm: LEFT }, L: { at: at('chest', [-0.02, 0.22, -0.1]), along: mix(UP, FWD), palm: RIGHT } },
      { name: 'windup', at: 0.55, body: { face: -15, turn: -0.3, bow: 0.25, sink: 0.04 }, R: { at: at('hipR', [0.18, -0.4, 0.15]), along: mix(DOWN, BACK), palm: mix(RIGHT, mul(BACK, 0.3)) }, L: { at: at('shoulderL', [-0.05, 0.4, -0.1]), along: FWD, palm: DOWN } },
      { name: 'release', at: 0.85, release: true, body: { face: 25, turn: 0.4, bow: 0.3, sink: 0.06 }, R: { at: at('hipR', [0.06, 0.25, 0.05]), along: mix(DOWN, mul(FWD, 0.6)), palm: mix(FWD, mul(UP, 0.4)) }, L: { at: at('chest', [-0.14, 0.12, -0.1]), along: UP, palm: RIGHT } },
      { name: 'follow', at: 1, body: { face: 35, turn: 0.55, bow: 0.25, sink: 0.04 }, R: { at: at('shoulderR', [-0.05, 0.45, -0.05]), along: mix(FWD, UP), palm: mix(UP, LEFT) }, L: { at: at('hipL', [-0.12, 0.05, 0.12]), along: DOWN, palm: RIGHT } },
    ],
  },
  bowl: {
    says: 'the bowling delivery: the ball pushed away and swung back like a pendulum, the slide and the knees bent deep, the ball let go low past the sliding foot, the arm through to the shoulder\'s height',
    ball: 'bowling', grip: 'bowling', stance: 'stride', hands: 1, sports: ['ten-pin bowling', 'lawn bowls (a smaller ball, the same pendulum)'],
    release: { speed: 7.5, elevation: 0, spin: { axis: 'side', rps: 5 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0.1 }, R: { at: at('chest', [0.12, 0.22, -0.12]), along: mix(UP, FWD), palm: mix(LEFT, UP) }, L: { at: at('chest', [-0.05, 0.24, -0.12]), along: mix(UP, FWD), palm: RIGHT } },
      { name: 'backswing', at: 0.55, body: { face: -8, turn: -0.15, bow: 0.35, sink: 0.08 }, R: { at: at('hipR', [0.12, -0.5, 0.2]), along: mix(DOWN, BACK), palm: mix(FWD, DOWN) }, L: { at: at('shoulderL', [-0.3, 0.2, -0.2]), along: LEFT, palm: DOWN } },
      { name: 'release', at: 0.86, release: true, body: { face: 10, turn: 0.1, bow: 0.55, sink: 0.2 }, R: { at: at('kneeR', [0.0, 0.32, -0.25]), along: mix(DOWN, mul(FWD, 0.3)), palm: mix(FWD, mul(LEFT, 0.3)) }, L: { at: at('shoulderL', [-0.35, 0.1, -0.15]), along: LEFT, palm: DOWN } },
      { name: 'follow', at: 1, body: { face: 12, turn: 0.15, bow: 0.4, sink: 0.16 }, R: { at: at('shoulderR', [0.0, 0.42, -0.02]), along: mix(FWD, UP), palm: LEFT }, L: { at: at('shoulderL', [-0.35, 0.1, -0.15]), along: LEFT, palm: DOWN } },
    ],
  },
  chestPass: {
    says: 'the chest pass: the ball held at the chest in both hands, thumbs behind it, the arms driven straight out, the hands turning out and down (thumbs down) as it goes',
    ball: 'basketball', grip: 'spread', stance: 'square', hands: 2, sports: ['basketball', 'netball', 'handball (a two-hand pass)'],
    release: { speed: 9, elevation: 3, spin: { axis: 'back', rps: 2 } },
    ballAt: [at('chest', [0, 0.26, -0.05]), at('chest', [0, 0.24, -0.03]), at('chest', [0, 0.46, -0.02]), at('chest', [0, 0.56, -0.06])],
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0.05 }, palms: mix(mul(FWD, 0.5), mul(LEFT, 1.2)) },
      { name: 'load', at: 0.45, body: { face: 0, turn: 0, bow: 0.12, sink: 0.04 }, palms: mix(mul(FWD, 0.5), mul(LEFT, 1.2)) },
      { name: 'release', at: 0.8, release: true, body: { face: 0, turn: 0, bow: 0.2, sink: 0.02 }, palms: mix(mul(FWD, 0.6), mul(LEFT, 1.4)), along: mix(FWD, UP) },
      { name: 'follow', at: 1, body: { face: 0, turn: 0, bow: 0.18 }, palms: mix(FWD, mul(LEFT, 0.6), mul(DOWN, 0.6)), along: FWD },
    ],
  },
  setShot: {
    says: 'the set shot: the ball over the shooting hand at the brow, the elbow under it, the guide hand at its side, the knees and the arm extending together, the wrist flicking it off the fingertips',
    ball: 'basketball', grip: 'spread', stance: 'square', hands: 1, guide: true, sports: ['basketball (a free throw, a jump shot\'s arm)', 'netball (a shot)'],
    release: { speed: 7.3, elevation: 52, spin: { axis: 'back', rps: 2 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0.05, sink: 0.08 }, R: { at: at('chest', [0.08, 0.28, 0.1]), along: mix(UP, mul(BACK, 0.4)), palm: mix(UP, FWD, mul(LEFT, 0.2)) }, L: { at: at('chest', [-0.08, 0.3, 0.16]), along: UP, palm: RIGHT } },
      { name: 'load', at: 0.45, body: { face: 0, turn: 0, bow: 0.1, sink: 0.14 }, R: { at: at('headTop', [0.1, 0.2, -0.1]), along: mix(UP, mul(BACK, 0.8)), palm: mix(UP, mul(FWD, 0.6)) }, L: { at: at('headTop', [-0.05, 0.24, -0.08]), along: UP, palm: RIGHT } },
      { name: 'release', at: 0.82, release: true, body: { face: 0, turn: 0, bow: 0, sink: 0 }, R: { at: at('headTop', [0.1, 0.4, 0.04]), along: mix(UP, FWD), palm: mix(FWD, mul(UP, 0.5)) }, L: { at: at('headTop', [-0.06, 0.26, -0.06]), along: UP, palm: RIGHT } },
      { name: 'follow', at: 1, body: { face: 0, turn: 0, bow: 0, sink: 0 }, R: { at: at('headTop', [0.1, 0.48, 0.1]), along: mix(FWD, DOWN), palm: DOWN }, L: { at: at('headTop', [-0.08, 0.24, -0.08]), along: UP, palm: RIGHT } },
    ],
  },
  throwIn: {
    says: 'the throw-in: the ball in both hands behind the head, the back arched, the trunk whipping forward, the ball let go over the brow, both feet on the ground',
    ball: 'soccer', grip: 'spread', stance: 'stride', hands: 2, sports: ['soccer (the throw-in)', 'a two-hand overhead pass (basketball, handball)'],
    release: { speed: 14, elevation: 32, spin: { axis: 'back', rps: 2 } },
    ballAt: [at('chest', [0, 0.28, -0.05]), at('headTop', [0, -0.06, 0.16]), at('headTop', [0, 0.32, -0.02]), at('chest', [0, 0.5, -0.12])],
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0, bow: 0.05 }, palms: mix(mul(FWD, 0.5), mul(LEFT, 1.2)) },
      { name: 'load', at: 0.5, body: { face: 0, turn: 0, bow: -0.3, sink: 0.06 }, palms: mix(mul(UP, 0.6), mul(FWD, 0.4), mul(LEFT, 1.2)) },
      { name: 'release', at: 0.84, release: true, body: { face: 0, turn: 0, bow: 0.25, sink: 0.04 }, palms: mix(FWD, mul(LEFT, 1.2)) },
      { name: 'follow', at: 1, body: { face: 0, turn: 0, bow: 0.55, sink: 0.04 }, palms: mix(FWD, mul(LEFT, 1), mul(DOWN, 0.4)) },
    ],
  },
  toss: {
    says: 'the toss to serve: the ball on the open palm, the arm lifting it straight up before the body, the hand opening at the top of its rise',
    ball: 'tennis', grip: 'fingertip', stance: 'side', hands: 1, side: 'L', sports: ['tennis (the serve\'s toss)', 'volleyball (a jump serve\'s toss)', 'table tennis (the 16 cm toss)'],
    release: { speed: 3.6, elevation: 85, spin: { axis: 'back', rps: 0 } },
    keys: [
      { name: 'set', at: 0, body: { face: 0, turn: 0 }, L: { at: at('chest', [0.0, 0.3, -0.1]), along: FWD, palm: UP }, R: { at: at('chest', [0.12, 0.28, -0.1]), along: FWD, palm: LEFT } },
      { name: 'dip', at: 0.35, body: { face: -5, turn: -0.1, sink: 0.03 }, L: { at: at('hipL', [0.05, 0.3, 0.1]), along: FWD, palm: UP }, R: { at: at('shoulderR', [0.25, -0.25, -0.05]), along: mix(BACK, UP), palm: DOWN } },
      { name: 'release', at: 0.8, release: true, body: { face: 0, turn: 0, sink: 0 }, L: { at: at('shoulderL', [0.06, 0.3, 0.0]), along: mix(UP, FWD), palm: mix(UP, mul(BACK, 0.2)) }, R: { at: at('shoulderR', [0.22, -0.2, 0.18]), along: UP, palm: FWD } },
      { name: 'follow', at: 1, body: { face: 0, turn: 0 }, L: { at: at('shoulderL', [0.06, 0.26, 0.3]), along: UP, palm: mix(UP, FWD) }, R: { at: at('shoulderR', [0.22, -0.2, 0.2]), along: UP, palm: FWD } },
    ],
  },
});
export const THROW_NAMES = Object.freeze(Object.keys(THROWS));
/** a spin's axis in the thrower's frame by its word (the ball's angular velocity points along it, right-handed): back
 * spin about the lateral (the ball's top turning back toward the thrower), top spin the other way, side about the up,
 * `along` about the line of flight (a spiral) */
export const SPIN_AXES = Object.freeze({ back: [-1, 0, 0], top: [1, 0, 0], side: [0, 0, 1], along: [0, 1, 0] });

const STANCE_CACHE = new WeakMap();
function stanceOf(R, name) {
  const memo = STANCE_CACHE.get(R) || {}; if (memo[name]) return memo[name];
  const W = STANCES[name]; const s = heroStance({ ...W, serves: ['throw'], hands: HANDS }, R, { left: !!W.left });
  memo[name] = s; STANCE_CACHE.set(R, memo); return s;
}
const ARM_KEYS = ['shL', 'shR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'fingersL', 'fingersR'];
const without = (pose, keys) => Object.fromEntries(Object.entries(pose).filter(([k]) => !keys.includes(k)));
const clampShare = (v) => Math.max(-1, Math.min(1, v));
/** a key's body over the stance's: the hips' turn added, the spine's shares set over its own, the knees sunk */
function bodyOf(base, b = {}) {
  const sp = base.spine || { sagittal: 0, lateral: 0, axial: 0 };
  return { ...base, facing: (base.facing ?? 0) + (b.face ?? 0), spine: { sagittal: clampShare((sp.sagittal || 0) + (b.bow ?? 0)), lateral: clampShare((sp.lateral || 0) + (b.lean ?? 0)), axial: clampShare((sp.axial || 0) + (b.turn ?? 0)) }, ...(b.sink ? { sink: (base.sink ?? 0) + b.sink } : {}) };
}
/** a body between two keys' (their channels in a straight line, share t of the way) */
function blendBody(a, b, t) {
  const L = (x, y) => (x ?? 0) + ((y ?? 0) - (x ?? 0)) * t, sa = a.spine || {}, sb = b.spine || {};
  return { ...b, facing: L(a.facing, b.facing), spine: { sagittal: L(sa.sagittal, sb.sagittal), lateral: L(sa.lateral, sb.lateral), axial: L(sa.axial, sb.axial) }, sink: L(a.sink, b.sink) };
}
/** a hand's place on the posed body */
const placeOf = (n, p) => add(p.lm === 'chest' || p.lm === 'headTop' ? (p.lm === 'headTop' ? n.headTop : landmark(n, 'chest')) : n[p.lm], p.d);

/** the hand's rotation (rest → posed) with its fingers along `along` and its palm facing `palm` (as square as allows) */
function handTurn(R, S, along, palm) {
  const H = handFrame(R, S);
  return alignFrame(H.A, H.N, unit(along), unit(palm));
}

/**
 * A throw solved on a rig (see the head). `name` a THROWS name or the technique's own words; `ball` and `grip` override
 * the technique's.
 */
export function heroThrow(name, R, { ball, grip } = {}) {
  const K = typeof name === 'object' ? name : THROWS[name];
  if (!K) throw new Error(`hero-throw: no throw '${name}' (have ${THROW_NAMES.join(', ')})`);
  const S = K.side ?? 'R', O = S === 'R' ? 'L' : 'R', two = K.hands === 2;
  const B = ballOf(ball ?? K.ball), gripName = grip ?? K.grip;
  const G = ballGrip(R, S, B.id === 'own' ? B : B.id, gripName), G2 = two ? ballGrip(R, O, B.id === 'own' ? B : B.id, gripName) : null;
  const st = stanceOf(R, K.stance), base = without(st.hold, ARM_KEYS), lite = liteOf(R), J = R.joints;
  // (a place past the arm's reach is drawn in toward the shoulder until the wrist's goal lies within REACH of the arm: a
  // technique's words are a shape, the body's own lengths its scale; two hands on one ball move it together)
  const armLen = (sd) => dist(J[`shoulder${sd}`], J[`elbow${sd}`]) + dist(J[`elbow${sd}`], J[`wrist${sd}`]);
  const refOf = (sd, h) => h.g?.centre ?? add(J[`wrist${sd}`], mul(handFrame(R, sd).A, 0.08 * (J.headTop[2] / 1.674)));
  const goalOf = (sd, h) => sub(h.P, mv(h.m, sub(refOf(sd, h), J[`wrist${sd}`])));
  function inReach(n, hands) {
    const out = { ...hands };
    const excess = (sd, h) => dist(n[`shoulder${sd}`], goalOf(sd, h)) - REACH * armLen(sd);
    const shared = two ? Object.keys(out) : null;
    for (let it = 0; it < 12; it++) {
      const over = Object.entries(out).map(([sd, h]) => [sd, excess(sd, h)]).filter(([, e]) => e > 1e-4);
      if (!over.length) break;
      for (const [sd, e] of over) {
        const pull = mul(unit(sub(n[`shoulder${sd}`], goalOf(sd, out[sd]))), e + 0.002);
        for (const s2 of shared ?? [sd]) out[s2] = { ...out[s2], P: add(out[s2].P, pull) };
      }
    }
    return out;
  }
  // THE PLAN: each key's body and each hand's place and turn (a two-handed key's from the ball's place, both palms on it)
  const alongOf = (p) => { const a = sub(UP, mul(unit(p), dot(UP, unit(p)))); return len(a) < 1e-6 ? FWD : unit(a); };
  const plans = K.keys.map((k, i) => {
    const body = bodyOf(base, k.body), n = rigNodesAt(lite, elbowsDown(R, body)).nodes, hands = {};
    if (two) {
      // (the fingers up the ball's sides unless the key says where they point: a pass's run forward at its release)
      const P = placeOf(n, K.ballAt[i]), pR = k.palms, pL = [-pR[0], pR[1], pR[2]], aR = k.along ? unit(sub(k.along, mul(unit(pR), dot(k.along, unit(pR))))) : alongOf(pR), aL = [-aR[0], aR[1], aR[2]];
      hands.R = { P, along: aR, palm: pR, m: handTurn(R, 'R', aR, pR), g: S === 'R' ? G : G2 };
      hands.L = { P, along: aL, palm: pL, m: handTurn(R, 'L', aL, pL), g: S === 'L' ? G : G2 };
    } else {
      hands[S] = { P: placeOf(n, k[S].at), along: k[S].along, palm: k[S].palm, m: handTurn(R, S, k[S].along, k[S].palm), g: G };
      if (k[O]) hands[O] = { P: placeOf(n, k[O].at), along: k[O].along, palm: k[O].palm, m: handTurn(R, O, k[O].along, k[O].palm), g: null };
    }
    return { name: k.name, share: k.at, release: !!k.release, body, hands: inReach(n, hands) };
  });
  // THE DRIVE: the ball through its release along the launch line at the release's speed, a key DRIVE seconds either side
  // of it (the hand's turn held), so the clip lets it go as the technique does
  const iR = plans.findIndex((k) => k.release), PR = plans[iR], want = K.release.speed, el = K.release.elevation / DEG;
  const dir = [0, Math.cos(el), Math.sin(el)], shiftBy = (k, d, name) => ({ ...k, name, release: false, hands: Object.fromEntries(Object.entries(k.hands).map(([sd, h]) => [sd, { ...h, P: sd === S || two ? add(h.P, d) : h.P }])) });
  // (two keys either side, so the joints' curves through the drive hold to its line)
  const pre2 = shiftBy(PR, mul(dir, -2 * DRIVE), `${PR.name}-in2`), pre = shiftBy(PR, mul(dir, -DRIVE), `${PR.name}-in`), post = shiftBy(PR, mul(dir, DRIVE), `${PR.name}-out`), post2 = shiftBy(PR, mul(dir, 2 * DRIVE), `${PR.name}-out2`), dT = DRIVE / want;
  // (the body leads the arm: into the drive it is most of the way from the key before to the release's)
  pre2.body = blendBody(plans[iR - 1].body, PR.body, 0.5); pre.body = blendBody(plans[iR - 1].body, PR.body, 0.75);
  for (const k of [pre2, pre, post, post2]) k.hands = inReach(rigNodesAt(lite, elbowsDown(R, k.body)).nodes, k.hands);
  // (between the slow keys a key half way, solved as they are: the joints' curves between two solved keys can turn a wrist
  // past its range though neither key does)
  const midOf = (a, b) => ({ name: `${a.name}~${b.name}`, mid: true, release: false, body: blendBody(a.body, b.body, 0.5), hands: Object.fromEntries(Object.keys(b.hands).filter((sd) => a.hands[sd]).map((sd) => {
    const A = a.hands[sd], Bh = b.hands[sd], along = unit(add(A.along, Bh.along)), palm = unit(add(A.palm, Bh.palm));
    return [sd, { ...Bh, P: mul(add(A.P, Bh.P), 0.5), along, palm, m: handTurn(R, sd, len(along) > 1e-6 ? along : Bh.along, len(palm) > 1e-6 ? palm : Bh.palm) }];
  })) });
  const withMids = (ks) => ks.flatMap((k, j) => { if (!j) return [k]; const m = midOf(ks[j - 1], k); m.hands = inReach(rigNodesAt(lite, elbowsDown(R, m.body)).nodes, m.hands); return [m, k]; });
  const before = withMids([...plans.slice(0, iR), pre2]), after = withMids([post2, ...plans.slice(iR + 1)]);
  const seq = [...before, pre, PR, post, ...after];
  // THE TIMING: the preparation over the technique's seconds by its keys' shares; into the drive and out of it at the
  // speed the ball comes up to and slows from (the hand's path over half the release's speed)
  const ballAt = (k) => k.hands[S].P;
  let times = []; const prep = K.prep ?? 0.7, s0 = plans[iR - 1].share || 1;
  for (let j = 0; j < iR; j++) times.push((plans[j].share / s0) * prep);
  const tPre = times.at(-1) + Math.max(0.05, dist(ballAt(plans[iR - 1]), ballAt(pre2)) / (0.5 * want));
  const outT = [tPre + 4 * dT];
  for (let j = iR + 1; j < plans.length; j++) { const prev = j === iR + 1 ? post2 : plans[j - 1]; outT.push(outT.at(-1) + Math.min(0.6, Math.max(0.12, dist(ballAt(prev), ballAt(plans[j])) / (0.35 * want)))); }
  // (each mid key half way in time between its neighbours)
  const spread = (ts) => ts.flatMap((t, j) => (j ? [(ts[j - 1] + t) / 2, t] : [t]));
  times = [...spread([...times, tPre]), tPre + dT, tPre + 2 * dT, tPre + 3 * dT, ...spread(outT)];
  // THE ARMS: each hand to its place, turned as planned (holdArm: the wrist in its range)
  // (each key's hand may roll about its ball, as little as the wrist needs; the roll tried first is the key before's, so
  // the forearm turns on through the throw and never flips between keys; the drive's keys take the release's roll)
  const ROLLS = [0, 25, -25, 50, -50, 75, -75, 105, -105];
  const solveKey = (k, first = {}, prev = null, near = NEAR) => {
    const arms = {}, err = {}, rolls = {}; let ok = true;
    for (const [side, h] of Object.entries(k.hands)) {
      const wr = J[`wrist${side}`], ref = h.g?.centre ?? add(wr, mul(handFrame(R, side).A, 0.08 * (J.headTop[2] / 1.674)));
      // (a FREE hand, holding nothing, goes to its place by the arm alone, its wrist at rest: its turn is the forearm's)
      if (!h.g) {
        const goal = sub(h.P, mul(handFrame(R, side).A, 0.08 * (J.headTop[2] / 1.674))), f = reachArm(R, k.body, side, goal, null, {});
        const n = rigNodesAt(lite, elbowsDown(R, { ...k.body, [`sh${side}`]: f.sh, [`elbow${side}`]: f.elbow })).nodes;
        Object.assign(arms, { [`sh${side}`]: f.sh, [`elbow${side}`]: f.elbow, [`fingers${side}`]: { ...HAND_POSES.relaxed } });
        err[side] = dist(n[`wrist${side}`], goal); continue;
      }
      // (a hand whose turn the wrist cannot bear rolls about the ball's centre, along its fingers' way: a technique's palm
      // is a direction, the forearm's turn the body's)
      const seed = prev?.pose?.[`sh${side}`] ? { sh: prev.pose[`sh${side}`], elbow: prev.pose[`elbow${side}`] } : null;
      const solve1 = (d) => { const m = d ? mm(rotAbout(unit(h.along ?? [0, 0, 1]), d), h.m) : h.m; return { ...holdArm(R, k.body, side, sub(h.P, mv(m, sub(ref, wr))), m, { skilled: false, ...(seed ? { seed, near } : {}) }), d }; };
      const inRange = (a) => !!a.anatomy && Object.entries(WRIST_RANGE).every(([q, [lo, hi]]) => a.anatomy[q] >= lo - 1 && a.anatomy[q] <= hi + 1);
      const good = (a) => inRange(a) && a.err < 0.005;
      const order = first[side] !== undefined ? [first[side], ...ROLLS.filter((d) => d !== first[side])] : ROLLS;
      let a = null;
      for (const d of order) { const b = solve1(d); if (!a || (good(b) && !good(a)) || (!good(a) && b.err + 0.001 * b.stray < a.err + 0.001 * a.stray)) a = b; if (good(a)) break; }
      Object.assign(arms, { [`sh${side}`]: a.sh, [`elbow${side}`]: a.elbow, [`wrist${side}`]: a.wrist, [`fingers${side}`]: h.g.fingers });
      err[side] = a.err; rolls[side] = a.d; ok = ok && inRange(a);
    }
    // (raw: the clip adds the elbows-down roll as it plays, keyedClip)
    return { name: k.name, release: k.release, pose: { ...k.body, ...arms }, err, wristOk: ok, rolls, holds: Object.fromEntries(Object.entries(k.hands).map(([sd, h]) => [sd, !!h.g])) };
  };
  // (solved in order, each key seeded by the one before: its arm and its hand's roll)
  // (the drive is one motion: the release solved from the key before it, then its four keys outward from the release, each
  // held hard to the one inward of it, so the arm takes the drive's twenty-odd centimetres as one way of reaching)
  const at0 = seq.indexOf(pre2), solved = new Array(seq.length);
  for (let j = 0; j < at0; j++) solved[j] = solveKey(seq[j], solved[j - 1]?.rolls ?? {}, solved[j - 1] ?? null);
  const iP = seq.indexOf(PR);
  solved[iP] = solveKey(PR, solved[at0 - 1]?.rolls ?? {}, solved[at0 - 1] ?? null);
  for (const j of [iP - 1, iP - 2]) solved[j] = solveKey(seq[j], solved[j + 1].rolls, solved[j + 1], DRIVE_NEAR);
  for (const j of [iP + 1, iP + 2]) solved[j] = solveKey(seq[j], solved[j - 1].rolls, solved[j - 1], DRIVE_NEAR);
  for (let j = iP + 3; j < seq.length; j++) solved[j] = solveKey(seq[j], solved[j - 1].rolls, solved[j - 1]);
  // (an angle that wraps past ±180° between keys is carried on round, never back the long way: the joints' curves
  // interpolate the numbers, so −178° to 165° must read −178° to −195°)
  const unwrap = (path) => { let prev = null; for (const k of solved) { const o = path.reduce((a, q) => a?.[q], k.pose); if (!Number.isFinite(o)) { prev = null; continue; } let v = o; if (prev !== null) { while (v - prev > 180) v -= 360; while (v - prev < -180) v += 360; } if (v !== o) { const [c, q] = path; k.pose = { ...k.pose, [c]: { ...k.pose[c], [q]: v } }; } prev = v; } };
  for (const sd of ['L', 'R']) for (const path of [[`wrist${sd}`, 'flex'], [`wrist${sd}`, 'deviation'], [`wrist${sd}`, 'twist'], [`sh${sd}`, 'roll'], [`sh${sd}`, 'yaw']]) unwrap(path);
  // (the fingers let go: from the release on, the throwing hand opens as the ball leaves it)
  const iRel = seq.indexOf(PR);
  for (let j = iRel + 3; j < solved.length; j++) solved[j].pose = { ...solved[j].pose, [`fingers${S}`]: { ...HAND_POSES.open } };
  // (the clip's own speed through the drive read back, the drive's two intervals scaled until it is the technique's: the
  // joints' curves are not the ball's line, so the keys' spacing alone only nears it)
  let seconds, clip, rel; const stand = st.keys.at(-1);
  for (let it = 0; it < 5; it++) {
    seconds = times.at(-1);
    // (each key stands as the stance's last key stands: its planted feet, its heels; its sink the key's own)
    clip = keyedClip({ seconds, keys: solved.map((k, j) => ({ ...stand, t: times[j] / seconds, pose: k.pose, sink: k.pose.sink ?? stand.sink })) }, R);
    rel = releaseOf(R, clip, seconds, times[iRel] / seconds, S, G, times[iRel + 1] - times[iRel]);
    const k = rel.speed / want; if (!(k > 0) || Math.abs(k - 1) < 0.02) break;
    // (the drive's four intervals scaled together, the keys after it carried on)
    const d = (times[iRel + 2] - times[iRel - 2]) * (k - 1);
    times = times.map((t, j) => (j <= iRel - 2 ? t : j <= iRel + 2 ? t + (d * (j - (iRel - 2))) / 4 : t + d));
  }
  const spec = { ...K.release, spin: { ...K.release.spin, axisVec: SPIN_AXES[K.release.spin.axis] } };
  const out = {
    name: typeof name === 'string' ? name : 'own', says: K.says, side: S, hands: K.hands, clip, seconds: r3(seconds),
    keys: solved.map((k, j) => ({ name: k.name, ...(seq[j].mid ? { mid: true } : {}), t: r4(times[j] / seconds), release: k.release, wrist: k.wristOk, place: seq[j].hands[S].P.map(r4), err: Object.fromEntries(Object.entries(k.err).map(([sd, e]) => [sd, r4(e)])) })),
    release: { t: r4(times[iRel] / seconds), at: rel.at.map(r4), velocity: rel.velocity.map(r3), speed: r1(rel.speed), elevation: r1(rel.elevation), wobble: r4(rel.wobble), drive: r4(times[iRel + 2] - times[iRel - 2]), spec },
    ball: { id: B.id, r: B.radius, mass: B.mass, grip: G.grip, side: S, centreRest: G.centre, held: G.laws.held },
  };
  out.checks = throwChecks(R, out, solved, K, G, G2);
  return out;
}

/** the ball's centre in the world while the hand holds it, at share u of the clip */
export function heldBall(R, clip, u, S, centreRest) {
  const n = rigNodesAt(R, clip.fn(u)).nodes, f = boneFrames(R, R.joints, n)[R.boneIndex[`hand${S}`]];
  return add(f.head, mv(f.m, sub(centreRest, f.restHead)));
}
/** the release read off the played clip: the ball's place, its velocity (a central difference over `w` seconds either side: the drive's keys), and how far the played ball wanders off the line between them (`wobble`, m) */
function releaseOf(R, clip, T, u, S, G, w = 0.0015) {
  const du = w / T, a = heldBall(R, clip, Math.max(0, u - du), S, G.centre), b = heldBall(R, clip, Math.min(1, u + du), S, G.centre);
  const at = heldBall(R, clip, u, S, G.centre), v = mul(sub(b, a), 1 / ((Math.min(1, u + du) - Math.max(0, u - du)) * T));
  const speed = len(v), d = unit(sub(b, a));
  let wobble = 0;
  for (let i = 1; i < 12; i++) { const p = heldBall(R, clip, Math.max(0, u - du) + ((Math.min(1, u + du) - Math.max(0, u - du)) * i) / 12, S, G.centre), q = sub(p, a); wobble = Math.max(wobble, len(sub(q, mul(d, dot(q, d))))); }
  return { at, velocity: v, speed, wobble, elevation: speed > 0 ? Math.asin(Math.max(-1, Math.min(1, v[2] / speed))) * DEG : 0 };
}

/** the posed nodes at share u (a stick figure's joints), and the ball's centre in the hand until the release */
export function throwNodes(T, R, u) {
  const n = rigNodesAt(R, T.clip.fn(u)).nodes;
  return { nodes: n, ball: u <= T.release.t ? heldBall(R, T.clip, u, T.ball.side, T.ball.centreRest) : null };
}

/**
 * The machine gate: every key's hands on their places (holdArm's miss under 6 mm), the grip holding the ball, the wrists
 * in range through the clip, the ball's speed at the release within a tenth of the technique's, its line within 25° of
 * the technique's elevation (the keys are a technique's shape; the launch a game uses is the spec's), the ball on its
 * line through the drive (within WOBBLE of it), the body over its
 * feet at the set and after the follow-through, and the servos' peak speeds (a report, hero-servo's).
 */
function throwChecks(R, T, solved, K, G, G2) {
  // (a hand holding the ball is held to its place; a free hand, holding nothing, is placed by the arm alone and read)
  const miss = Math.max(...solved.flatMap((k) => Object.entries(k.err).filter(([sd]) => k.holds?.[sd]).map(([, e]) => e)));
  const freeMiss = Math.max(0, ...solved.flatMap((k) => Object.entries(k.err).filter(([sd]) => !k.holds?.[sd]).map(([, e]) => e)));
  let wrist = true; const wristOut = [];
  for (let i = 0; i <= 24; i++) {
    const pose = T.clip.fn(i / 24), n = rigNodesAt(R, pose).nodes, fr = boneFrames(R, R.joints, n);
    for (const S of ['L', 'R']) { const w = wristFor(R, S, anatomicalForearm(R, n, S), fr[R.boneIndex[`hand${S}`]].m); for (const [k, [lo, hi]] of Object.entries(WRIST_RANGE)) if (w[k] < lo - 1 || w[k] > hi + 1) { wrist = false; wristOut.push(`${S}.${k} ${r1(w[k])} at ${r3(i / 24)}`); } }
  }
  const bal = (u) => { const n = rigNodesAt(R, T.clip.fn(u)).nodes, pts = []; for (const S of ['L', 'R']) { const L = R.legs[S]; pts.push(n[L.toeBase], n[L.toeTip], n[L.hock]); } return r4(margin(hull(pts.map((p) => [p[0], p[1]])), comOf(n))); };
  const balance = { set: bal(0), end: bal(1) };
  const speedOff = Math.abs(T.release.speed - K.release.speed) / K.release.speed;
  const lineOff = Math.abs(T.release.elevation - K.release.elevation);
  const servos = servoReport(R, T.clip, { seconds: T.seconds, samples: 48 });
  const peak = Object.fromEntries(Object.entries(servos.sides?.[T.side] ?? {}).filter(([, v]) => v && v.peakSpeed).map(([k, v]) => [k, Math.round(v.peakSpeed)]));
  // (the wrist at every solved key; between them the joints' curves are read and reported, not held: a key half way
  // keeps the slow phases near their keys)
  const keyWrist = solved.every((k) => k.wristOk);
  // (a drive shorter than a frame at 60 fps is never seen between its keys, which the ball passes exactly: its wobble is
  // read, the law held only where the drive is on screen; an overhead release's forearm stands near upright, where the
  // rig's wrist channel turns fast between near poses)
  const seen = T.release.drive > 1 / 60;
  const laws = { drive: !seen || T.release.wobble < WOBBLE, hands: miss < 0.006, grip: G.laws.held && G.laws.clear && (!G2 || (G2.laws.held && G2.laws.clear)), wrist: keyWrist, speed: speedOff < 0.1, line: lineOff < 25, balance: balance.set > 0 && balance.end > 0 };
  return { miss: r4(miss), freeMiss: r4(freeMiss), wristBetween: wrist, ...(wristOut.length ? { wristOut: wristOut.slice(0, 6) } : {}), speedOff: r3(speedOff), lineOff: r1(lineOff), balance, servoPeaks: peak, laws };
}

/** the ball as a prop riding the throwing hand at rest (its triangles, for a pack: hero-motion's props) */
export function ballProp(R, T, { segments = 10, colour = [0.85, 0.82, 0.74] } = {}) {
  const c = T.ball.centreRest, r = T.ball.r, tris = [], P = (i, j) => { const th = (i / segments) * Math.PI, ph = (j / (2 * segments)) * 2 * Math.PI; return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * Math.cos(th)]; };
  for (let i = 0; i < segments; i++) for (let j = 0; j < 2 * segments; j++) { const a = P(i, j), b = P(i + 1, j), d = P(i, j + 1), e = P(i + 1, j + 1); if (i > 0) tris.push({ p: [a, b, d], col: colour }); if (i < segments - 1) tris.push({ p: [d, b, e], col: colour }); }
  return { bone: R.boneIndex[`hand${T.ball.side}`], item: T.ball.id, tris };
}
