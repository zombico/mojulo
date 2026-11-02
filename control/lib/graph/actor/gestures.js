/**
 * gestures — the actor's body GESTURES, said as the body does them rather than as poses: where the hand goes on the
 * body's own landmarks (the chest, the belly, the chin, a shoulder), which way its fingers point and its palm faces, the
 * hand's shape, and what the head and the trunk do. Each is solved on the rig it plays on (hero-grip.js `holdArm`: the
 * wrist placed, the elbow kept low, the wrist turned least), so one word fits every cast's proportions.
 *
 *   GESTURES[word] = { reads, arms?: { R?: HAND, L?: HAND } | 'mirror', both?, beats?: [{ at, … }], head?, spine? }
 *     HAND: { at (hero-grip.js landmark), side (m, + outward for that hand), fwd (m), up (m), fingers, palm (directions
 *     in the body's frame for the right hand: +x its right, +y front, +z up; the left hand mirrored), hand (a hand word,
 *     station-loft-rig.js HAND_POSES), elbow? (the upper arm's direction from the shoulder, for a hand near the trunk:
 *     the elbow placed there, as an animator places a pole, and held to it, so the arm keeps off the chest; holdArm's
 *     `elbowAt`) }
 *     `beats` the gesture's inner rhythm after its stroke (a nod's dips, a clap's beats): each `at` seconds after the
 *     stroke, with the share of the stroke it returns to (`k`, 0 the rest … 1 the stroke)
 *     `head` / `spine` the channels it moves besides the arms ({ pitch, yaw, roll } degrees; { lean, curl } amounts)
 *
 *   standOf(R, base) → the actor's stand: `base`'s trunk and legs, the arms hanging at the sides solved on the rig
 *   strokeOf(R, word, side, base) → the gesture's stroke as channel values on that rig: { shR: { pitch, yaw, roll },
 *     elbowR, wristR: { flex, deviation, twist }, fingersR: { thumb … }, … } (`side` the hand it is done with; a two-handed
 *     gesture both), with each arm's `err` (m), `stray` (degrees past the wrist's ease) and `goal` (the wrist's place, the
 *     rig's frame): cached per rig, word and side
 *
 * The words are the body's emotes' (figure-emotes.js EMOTES: the names a delivery register and a style already speak)
 * and the speaker's commonest: `beat` (the baton on a stressed word) and `offer` (the open palm). Pure and deterministic.
 */
import { holdArm, landmark, liteOf } from '../polygonizer/hero-grip.js';
import { rigNodesAt, HAND_POSES } from '../polygonizer/station-loft-rig.js';
import { elbowsDown } from '../polygonizer/hero-elbow.js';

const H = (at, side, fwd, up, fingers, palm, hand, elbow) => Object.freeze({ at, side, fwd, up, fingers: Object.freeze(fingers), palm: Object.freeze(palm), hand, ...(elbow ? { elbow: Object.freeze(elbow) } : {}) });

export const GESTURES = Object.freeze({
  beat: { reads: 'the baton: the hand drops onto the stressed word, the forearm leading', arms: { R: H('belly', 0.14, 0.26, 0.06, [0.25, 1, -0.15], [-0.35, 0, -1], 'relaxed') } },
  offer: { reads: 'the open palm offered up and out, the elbow at the side: here it is', arms: { R: H('belly', 0.24, 0.3, 0.04, [0.3, 1, 0.1], [-0.45, 0, 0.9], 'open', [0.35, 0.3, -0.89]) } },
  point: { reads: 'the index out at the thing meant, the arm long', arms: { R: H('chest', 0.22, 0.44, 0.0, [0.2, 1, 0.05], [-0.4, 0, -1], 'point') } },
  shrug: { reads: 'the elbows at the sides, the forearms out, the palms turned up, the head tipped: who knows', arms: 'mirror', both: H('belly', 0.3, 0.26, 0, [0.3, 1, 0], [-0.6, 0, 0.8], 'open', [0.35, 0, -0.94]), head: { roll: 6, pitch: 3 } },
  cheer: { reads: 'the fist up over the head', arms: { R: H('shoulderR', 0.06, 0.06, 0.52, [0, 0.15, 1], [0, 1, 0], 'fist') } },
  clap: { reads: 'the palms meeting before the chest, twice, the elbows out', arms: 'mirror', both: H('chest', 0.04, 0.32, -0.06, [-0.2, 0.75, 0.6], [-1, 0, 0], 'open', [0.5, 0.55, -0.67]), beats: [{ at: 0.22, k: 0.55 }, { at: 0.42, k: 1 }] },
  think: { reads: 'the hand to the chin, the elbow out and down, the head down a touch', arms: { R: H('chin', 0.05, 0.1, -0.07, [-0.2, 0.35, 1], [-0.5, -1, 0], 'relaxed', [0.45, 0.75, -0.5]) }, head: { pitch: -6, roll: -3 } },
  nod: { reads: 'yes: the head dips twice', head: { pitch: -12 }, beats: [{ at: 0.2, k: 0.15 }, { at: 0.38, k: 0.9 }] },
  headshake: { reads: 'no: the head turns side to side, damping', head: { yaw: 14 }, beats: [{ at: 0.2, k: -1 }, { at: 0.4, k: 0.6 }, { at: 0.58, k: -0.3 }] },
  bow: { reads: 'the trunk folds forward at the hips, the head with it, and rises', spine: { lean: 0.32 }, head: { pitch: -14 } },
});
export const GESTURE_NAMES = Object.freeze(Object.keys(GESTURES));
/** THE STAND's arms: hanging at the sides, the elbows soft (`elbow` degrees), the shoulders brought a little forward
 * (`pitch`), the wrists at rest, the hands relaxed; each arm swung in from the bind's A to the most inward place whose
 * wrist still clears its hip by `clear` metres outward (a thigh's half-width), or out to the first that does, as the presets were found
 * (hero-gesture.js GESTURE_PRESETS) but on the rig it plays on */
export const STAND_ARMS = Object.freeze({ elbow: 14, pitch: 6, clear: 0.085, step: 0.5, most: 40 });
/** the gestures that move an arm (the rest move the head or the trunk alone) */
export const armsOf = (word) => { const G = GESTURES[word]; return !G?.arms ? [] : G.arms === 'mirror' ? ['R', 'L'] : Object.keys(G.arms); };

// ─── the hand's frame ─────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const cols = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const T = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
/** the turn taking the rest pair (fingers, palm) onto the wanted pair: the fingers exactly, the palm as near as square */
const frameOf = (a, b) => { const x = unit(a), z = unit(cross(x, b)); return cols(x, cross(z, x), z); };
const turnOnto = (f0, p0, f1, p1) => mm(frameOf(f1, p1), T(frameOf(f0, p0)));
const mirror = (v, side) => (side === 'L' ? [-v[0], v[1], v[2]] : [...v]);

/** a rig's hand at rest: where its fingers point (the wrist to the middle fingertip) and its palm faces (toward the
 * body), and its length */
function restHand(R, side) {
  const w = R.joints[`wrist${side}`], tip = R.joints[`middleTip${side}`] ?? add(w, [0, 0, -0.18]);
  const fingers = unit(sub(tip, w)), dev = R.hands?.[side]?.axes?.deviation ?? [side === 'R' ? 1 : -1, 0, 0];
  const inward = [side === 'R' ? -1 : 1, 0, 0], palm = unit(mul(dev, dot(dev, inward) > 0 ? 1 : -1));
  return { fingers, palm: unit(sub(palm, mul(fingers, dot(palm, fingers)))), length: len(sub(tip, w)) };
}

/** how firmly a placed elbow is held (holdArm's `elbowWeight`, a metre off it): firmer than the wrist's ease, so the arm
 * keeps off the trunk, softer than the hand's place, so the hand still lands */
export const ELBOW_HOLD = 40;
const withoutArms = (pose) => Object.fromEntries(Object.entries(pose).filter(([k]) => !/^(sh|elbow|wrist|fingers)[LR]$/.test(k)));

const cache = new WeakMap();
/** a hand placed on the body (a HAND's words) by the arm of `S`, on the posed body `n` of the stand `body` → the
 * holdArm answer */
function placeHand(R, body, n, S, A) {
  // (a one-handed gesture done with the other hand: the right hand's words, mirrored)
  const lm = landmark(n, /^(shoulder|hip)R$/.test(A.at) && S === 'L' ? A.at.replace(/R$/, 'L') : A.at);
  const out1 = S === 'R' ? 1 : -1, hand = add(lm, [out1 * A.side, A.fwd, A.up]);
  const rest = restHand(R, S), fingers = unit(mirror(A.fingers, S)), palm = unit(mirror(A.palm, S));
  const wrist = sub(hand, mul(fingers, rest.length * 0.45));
  // (`elbow`: for a hand near the trunk the elbow is placed, the upper arm's length along its direction from the
  // shoulder, and held there (ELBOW_HOLD a metre), so the arm goes round the chest rather than through it)
  const upper = len(sub(R.joints[`elbow${S}`], R.joints[`shoulder${S}`]));
  const elbowAt = A.elbow ? add(n[`shoulder${S}`], mul(unit(mirror(A.elbow, S)), upper)) : null;
  return { ...holdArm(R, body, S, wrist, turnOnto(rest.fingers, rest.palm, fingers, palm), elbowAt ? { elbowAt, elbowWeight: ELBOW_HOLD } : {}), goal: wrist };
}

/** The actor's stand on this rig: `base`'s trunk and legs (a GESTURE_PRESETS stand), its arms hanging at the sides
 * (STAND_ARMS, found on the rig). Cached per rig and base */
export function standOf(R, base = {}) {
  const memo = cache.get(R) ?? new Map(); cache.set(R, memo);
  const key = `stand|${JSON.stringify(base)}`;
  if (memo.has(key)) return memo.get(key);
  const A = STAND_ARMS, out = { ...withoutArms(base) };
  for (const S of ['R', 'L']) {
    // (the swing in: the yaw that draws this arm toward the body, + on the right, − on the left (the rig's))
    const inward = S === 'R' ? 1 : -1, at = (yaw) => ({ ...out, [`sh${S}`]: { pitch: A.pitch, yaw, roll: 0 }, [`elbow${S}`]: A.elbow });
    const clears = (yaw) => { const n = rigNodesAt(liteOf(R), at(yaw)).nodes; return inward * (n[`wrist${S}`][0] - n[`hip${S}`][0]) >= A.clear; };
    // (in as far as it clears; where even the bind's A does not clear (the weight leg's hip pushed out), out until it does)
    let yaw = 0;
    if (clears(0)) for (let y = A.step; y <= A.most && clears(inward * y); y += A.step) yaw = inward * y;
    else for (let y = A.step; y <= A.most; y += A.step) { yaw = -inward * y; if (clears(yaw)) break; }
    Object.assign(out, { [`sh${S}`]: { pitch: A.pitch, yaw, roll: 0 }, [`elbow${S}`]: A.elbow, [`wrist${S}`]: { flex: 0, deviation: 0, twist: 0 }, [`fingers${S}`]: 'relaxed' });
  }
  memo.set(key, out);
  return out;
}

/** The gesture's stroke on this rig (see the header): solved once per rig, word, side and stand */
export function strokeOf(R, word, side = 'R', base = {}) {
  const G = GESTURES[word];
  if (!G) throw new Error(`gestures: '${word}' is not a gesture (${GESTURE_NAMES.join(', ')})`);
  const memo = cache.get(R) ?? new Map(); cache.set(R, memo);
  const key = `${word}|${side}|${JSON.stringify(base)}`;
  if (memo.has(key)) return memo.get(key);
  const out = { channels: {}, arms: {} };
  if (G.arms) {
    const body = withoutArms(base), n = rigNodesAt(liteOf(R), body).nodes;
    const sides = G.arms === 'mirror' ? ['R', 'L'] : [side];
    for (const S of sides) {
      const A = G.arms === 'mirror' ? G.both : G.arms.R, a = placeHand(R, body, n, S, A);
      // (holdArm solves on the elbows-down roll (hero-elbow.js) and answers the arm's own: the stroke carries the sum, so
      // the take turns the arm the solve placed)
      const sh = elbowsDown(R, { [`sh${S}`]: a.sh })[`sh${S}`];
      Object.assign(out.channels, { [`sh${S}`]: sh, [`elbow${S}`]: a.elbow, [`wrist${S}`]: a.wrist, [`fingers${S}`]: { ...HAND_POSES[A.hand] } });
      out.arms[S] = { err: a.err, stray: a.stray, goal: a.goal };
    }
  }
  if (G.head) out.channels.head = { ...G.head, ...(G.head.roll && side === 'L' ? { roll: -G.head.roll } : {}) };
  if (G.spine) out.channels.spine = { ...G.spine };
  memo.set(key, out);
  return out;
}
