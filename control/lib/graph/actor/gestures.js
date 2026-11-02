/**
 * gestures — the actor's body GESTURES, said as the body does them rather than as poses: where the hand goes on the
 * body's own landmarks (the chest, the belly, the chin, a shoulder), which way its fingers point and its palm faces, the
 * hand's shape, and what the head and the trunk do. Each is solved on the rig it plays on (hero-grip.js `holdArm`: the
 * wrist placed, the elbow kept low, the wrist turned least), so one word fits every cast's proportions.
 *
 *   GESTURES[word] = { reads, arms?: { R?: HAND, L?: HAND } | 'mirror', both?, beats?: [{ at, … }], head?, spine? }
 *     HAND: { at (hero-grip.js landmark), side (m, + outward for that hand), fwd (m), up (m), fingers, palm (directions
 *     in the body's frame for the right hand: +x its right, +y front, +z up; the left hand mirrored), hand (a hand word,
 *     station-loft-rig.js HAND_POSES), pole? (the way the elbow bends first, holdArm's: out, for a hand near the trunk) }
 *     `beats` the gesture's inner rhythm after its stroke (a nod's dips, a clap's beats): each `at` seconds after the
 *     stroke, with the share of the stroke it returns to (`k`, 0 the rest … 1 the stroke)
 *     `head` / `spine` the channels it moves besides the arms ({ pitch, yaw, roll } degrees; { lean, curl } amounts)
 *
 *   strokeOf(R, word, side, base) → the gesture's stroke as channel values on that rig: { shR: { pitch, yaw, roll },
 *     elbowR, wristR: { flex, deviation, twist }, fingersR: { thumb … }, … } (`side` the hand it is done with; a two-handed
 *     gesture both), with each arm's `err` (m) and `stray` (degrees past the wrist's ease): cached per rig, word and side
 *
 * The words are the body's emotes' (figure-emotes.js EMOTES: the names a delivery register and a style already speak)
 * and the speaker's commonest: `beat` (the baton on a stressed word) and `offer` (the open palm). Pure and deterministic.
 */
import { holdArm, landmark, liteOf } from '../polygonizer/hero-grip.js';
import { rigNodesAt, HAND_POSES } from '../polygonizer/station-loft-rig.js';

const H = (at, side, fwd, up, fingers, palm, hand, pole) => Object.freeze({ at, side, fwd, up, fingers: Object.freeze(fingers), palm: Object.freeze(palm), hand, ...(pole ? { pole: Object.freeze(pole) } : {}) });

export const GESTURES = Object.freeze({
  beat: { reads: 'the baton: the hand drops onto the stressed word, the forearm leading', arms: { R: H('belly', 0.14, 0.26, 0.06, [0.25, 1, -0.15], [-0.35, 0, -1], 'relaxed') } },
  offer: { reads: 'the open palm offered up and out: here it is', arms: { R: H('belly', 0.2, 0.3, 0.04, [0.35, 1, 0.1], [0, 0, 1], 'open') } },
  point: { reads: 'the index out at the thing meant, the arm long', arms: { R: H('chest', 0.22, 0.44, 0.0, [0.2, 1, 0.05], [-0.4, 0, -1], 'point') } },
  shrug: { reads: 'both palms up and out, the elbows at the sides, the head tipped: who knows', arms: 'mirror', both: H('belly', 0.26, 0.26, -0.04, [0.5, 1, 0], [0, 0, 1], 'open', [1, -0.2, -1]), head: { roll: 6, pitch: 3 } },
  cheer: { reads: 'the fist up over the head', arms: { R: H('shoulderR', 0.06, 0.06, 0.52, [0, 0.15, 1], [0, 1, 0], 'fist') } },
  clap: { reads: 'the palms meeting before the chest, twice', arms: 'mirror', both: H('chest', 0.04, 0.3, -0.1, [-0.2, 0.75, 0.6], [-1, 0, 0], 'open'), beats: [{ at: 0.22, k: 0.55 }, { at: 0.42, k: 1 }] },
  think: { reads: 'the hand to the chin, the elbow out and down, the head down a touch', arms: { R: H('chin', 0.03, 0.07, -0.05, [0, 0.25, 1], [0, -1, 0], 'relaxed', [1, 0.3, -0.6]) }, head: { pitch: -6, roll: -3 } },
  nod: { reads: 'yes: the head dips twice', head: { pitch: -12 }, beats: [{ at: 0.2, k: 0.15 }, { at: 0.38, k: 0.9 }] },
  headshake: { reads: 'no: the head turns side to side, damping', head: { yaw: 14 }, beats: [{ at: 0.2, k: -1 }, { at: 0.4, k: 0.6 }, { at: 0.58, k: -0.3 }] },
  bow: { reads: 'the trunk folds forward at the hips, the head with it, and rises', spine: { lean: 0.32 }, head: { pitch: -14 } },
});
export const GESTURE_NAMES = Object.freeze(Object.keys(GESTURES));
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

const ARM = (side) => [`sh${side}`, `elbow${side}`, `wrist${side}`, `fingers${side}`];
const withoutArms = (pose) => Object.fromEntries(Object.entries(pose).filter(([k]) => !/^(sh|elbow|wrist|fingers)[LR]$/.test(k)));

const cache = new WeakMap();
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
      // (a one-handed gesture done with the other hand: the right hand's words, mirrored)
      const A = G.arms === 'mirror' ? G.both : G.arms.R, lm = landmark(n, A.at === 'shoulderR' && S === 'L' ? 'shoulderL' : A.at);
      const out1 = S === 'R' ? 1 : -1, hand = add(lm, [out1 * A.side, A.fwd, A.up]);
      const rest = restHand(R, S), fingers = unit(mirror(A.fingers, S)), palm = unit(mirror(A.palm, S));
      const wrist = sub(hand, mul(fingers, rest.length * 0.45));
      // (`pole`: the way the elbow bends first, for a hand near the trunk: out, so the arm clears the chest)
      const a = holdArm(R, body, S, wrist, turnOnto(rest.fingers, rest.palm, fingers, palm), A.pole ? { pole: mirror(A.pole, S) } : {});
      Object.assign(out.channels, { [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow, [`wrist${S}`]: a.wrist, [`fingers${S}`]: { ...HAND_POSES[A.hand] } });
      out.arms[S] = { err: a.err, stray: a.stray };
    }
  }
  if (G.head) out.channels.head = { ...G.head, ...(G.head.roll && side === 'L' ? { roll: -G.head.roll } : {}) };
  if (G.spine) out.channels.spine = { ...G.spine };
  memo.set(key, out);
  return out;
}
