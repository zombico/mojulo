// hero-bow — DRAWING A BOW: the bow and the arrow placed first by the shot, the body solved to serve them (hero-grip's and
// hero-carry's way). Right-handed: the left hand holds the bow, the right draws the string.
//
//   • THE STANCE: side on to the target (the left shoulder toward it), the feet a shoulder's width apart, the trunk
//     upright, the head turned to the mark (hero-stance words).
//   • THE ANCHOR: at full draw the nock sits at the corner of the mouth on the drawing side, carried by the head (the
//     Mediterranean anchor: the index under the arrow along the jaw, the middle and the ring below it), so the arrow lies
//     under the dominant eye. The arrow runs from the anchor to the mark.
//   • THE BOW ARM: the bow's arrow shelf on that line where the bow arm reaches DRAW of itself (the bow arm straight, not
//     locked): the archer's draw length is the arm's, not a table's. The bow stands upright on the shot, its back to the
//     mark; the bow hand closes round its grip (hero-digits) with its knuckles at the angle the wrist bears best (a roll
//     about the grip searched, kept for every key, so the bow rides the hand rigid).
//   • THE DRAWING HAND: the string through the hooked fingers (the first three hooked at their last joints, the little
//     curled, the thumb relaxed toward the palm), the hand's axis along the arrow.
//   • THE SHOT: the READY (the arrow nocked at brace, the bow low before the body), the SET (the bow raised onto the
//     line, the string a third drawn), the ANCHOR (full draw, held), the LOOSE (the string hand thrown back along the jaw
//     a few centimetres, the fingers open; the bow hand's fingers ease, the bow staying on the line), the FOLLOW-THROUGH.
//     Two one-shot clips play it: `bowDraw` (the ready, the set, the anchor, held) and `bowLoose` (the loose, the follow
//     through, back to the ready: the next arrow nocked).
// The bow is drawn as gear riding the bow hand's bone; its string is its brace's (a rigid prop cannot bend): the readout's
// `string` names the nock's place per key, so an engine can bend it. Pure and deterministic: no dice, no clock.
import { rigNodesAt, boneFrames, solveTwoBone, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { heroStance } from './hero-stance.js';
import { holdArm, wristFor, anatomicalForearm, WRIST_RANGE, liteOf } from './hero-grip.js';
import { gearBuild } from './hero-gear.js';
import { keyedClip } from './hero-jump.js';
import { carryKit } from './hero-carry.js';
import { handBox, closeOn, handShape, DIGITS } from './hero-digits.js';
import { expandEquipment } from '../equipment/expand.js';
import { BOW_SECONDS } from './hero-held-words.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const T = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const fromColumns = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const deg = (r) => (r * 180) / Math.PI;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const r1 = (x) => Math.round(x * 10) / 10 + 0, r3 = (x) => Math.round(x * 1000) / 1000 + 0, r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
// (the carry's kit read at call time: this module may load while hero-carry's import chain is still evaluating)
const handsAtRest = (...a) => carryKit.handsAtRest(...a), stationWant = (...a) => carryKit.stationWant(...a), worldOf = (...a) => carryKit.worldOf(...a);
const scaleOf = (...a) => carryKit.scaleOf(...a), turnAbout = (...a) => carryKit.turnAbout(...a), spins = (...a) => carryKit.spins(...a), armScore = (...a) => carryKit.armScore(...a);

/** the archer's stance: side on, the left foot toward the mark, the feet a shoulder's width, upright, the head to the mark */
const ARCHER = Object.freeze({ family: 'bladed', spread: 0.4, line: 85, toes: { L: 85, R: 0 }, sink: 0.02, lean: 0, weight: 0.5, heel: 0, chest: 0, serves: ['bow'],
  hands: { R: { at: 'navel', fwd: 0.05, up: -0.2, side: 0.22 }, L: { at: 'navel', fwd: 0.05, up: -0.2, side: -0.22 } } });
/** the bow arm's reach at the anchor (a straight arm, not locked), the ready's (lower, a little bent) */
export const DRAW = 0.965;
const READY_REACH = 0.62;
/** the mark: a target at the eyes' height, metres before the pelvis */
const MARK_FAR = 18;
/** the ready's bow: tipped down off the line (degrees), the set's string drawn this share of the way */
const READY_DIP = 40, SET_DRAW = 0.35;
/** the loose: the string hand thrown back along the jaw and out from it (metres at the canonical height) */
const LOOSE_BACK = 0.07, LOOSE_OUT = 0.03;
/** the hook: the three drawing fingers hooked at their last joints, the little curled away, the thumb at ease */
const HOOK = Object.freeze({ goals: {
  index: { set: { mcp: 12, pip: 70, dip: 45 } }, middle: { set: { mcp: 12, pip: 72, dip: 45 } }, ring: { set: { mcp: 14, pip: 72, dip: 45 } },
  little: { set: { mcp: 45, pip: 85, dip: 55 } }, thumb: { set: { across: 10, toPalm: 25, mcp: 20, ip: 15 } } } });
const ARM_KEYS = ['shL', 'shR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'fingersL', 'fingersR'];
const without = (pose, keys) => Object.fromEntries(Object.entries(pose).filter(([k]) => !keys.includes(k)));

export const BOW_SHOTS = Object.freeze({
  bowDraw: { seconds: BOW_SECONDS.bowDraw, says: 'the arrow nocked, the bow raised onto the line, the string drawn to the anchor and held' },
  bowLoose: { seconds: BOW_SECONDS.bowLoose, says: 'the string let go, the hand thrown back along the jaw, the follow-through, the next arrow to the ready' },
});
export const BOW_SHOT_NAMES = Object.freeze(Object.keys(BOW_SHOTS));

/** the corner of the mouth on the drawing side, carried by the head (its rest place measured as the eye's in hero-carry) */
function anchorOf(R, frames) {
  const J = R.joints, fr = frames[R.boneIndex.head], hH = J.headTop[2] - J.headBase[2], s = hH / 0.13;
  const rest = add(J.headBase, [0.026 * s, 0.092 * s, 0.13 * hH]);
  return add(fr.head, mv(fr.m, sub(rest, fr.restHead)));
}
/** the bow's frame on a shot line d (its back toward the mark: its +x along d), upright as the line allows, `dip`
 * degrees tipped down about the body's side axis */
function bowFrame(d) {
  const up = [0, 0, 1]; let z = sub(up, mul(d, dot(up, d))); z = len(z) < 1e-6 ? [0, 1, 0] : unit(z);
  return fromColumns(d, cross(z, d), z);
}
/** the bow's item model: its grip, its shelf (the arrow's rest, just over the grip), its nocks */
function bowModel(R, build) {
  const b = gearBuild({ item: 'bow', ...(build || {}) }), e = expandEquipment(b), g = e.sockets.grip, k = 0.01 * scaleOf(R);
  const shelf = [g.origin[0], 0, g.origin[2] + g.length / 2 + 0.6];
  return { build: b, e, k, grip: g, shelf, nocks: [e.sockets.nockTop.origin, e.sockets.nockBottom.origin], brace: -e.sockets.nockTop.origin[0], r: 1.6 };
}
/** the bow frame F placing its shelf at point P on a line d */
const placed = (Bm, W, P) => ({ W, k: Bm.k, O: sub(P, mv(W, mul(Bm.shelf, Bm.k))) });

/** one hand to a station on the bow (its roll searched when `roll`, else that roll kept), the arm solved to it */
function handTo(R, body, F, st, side, roll) {
  const tryAt = (d) => { const s1 = { ...st, a: turnAbout(st.a, st.c, d) }, w = stationWant(R, F, s1, side), a = holdArm(R, body, side, w.wrist, w.m, { skilled: true, range: carryKit.RANGE_WEIGHT, clear: carryKit.CLEAR_WEIGHT }); return { w, a, d, score: armScore(a) }; };
  if (roll !== undefined) return tryAt(roll);
  let best = null; for (const d of spins([-180, 150])) { const x = tryAt(d); if (!best || x.score < best.score) best = x; }
  for (const d of [-20, -10, 10, 20]) { const x = tryAt(best.d + d); if (x.score < best.score) best = x; }
  return best;
}

/**
 * THE DRAWING ARM, by the archer's rule: seen from above the elbow stands on the line from the bow shoulder through the
 * drawing shoulder (the force line), a little above the arrow, the wrist straight (the hand an extension of the
 * forearm), the hooked fingers on the string at P (the index above the arrow: the thumb's side of the hand up). The
 * elbow and the wrist are found by two-bone reach with the elbow drawn toward the force line, the hand's frame then the
 * forearm's, and the rig's arm solved to that wrist and frame (hero-grip holdArm). → { a (holdArm's), w ({ m, P, wrist }),
 * hook (m, the hook's place off P) }.
 */
function drawArm(R, body, n, P, lift = 0, roll = null) {
  const J = R.joints, l1 = dist(J.shoulderR, J.elbowR), l2 = dist(J.elbowR, J.wristR), hr = handsAtRest(R).R;
  // the hook: the drawing fingers' middle joints, a little beyond the knuckles along the hand (at rest, from the wrist)
  const hookRest = add(J.middleMcpR ?? J.knucklesR, mul(hr.a0, 0.022 * scaleOf(R)));
  const hookLen = dist(hookRest, J.wristR);
  const shR = n.shoulderR, line = unit([n.shoulderR[0] - n.shoulderL[0], n.shoulderR[1] - n.shoulderL[1], 0]);
  const pole = unit(add(line, [0, 0, 0.35 + lift]));
  let E = add(shR, mul(pole, l1)), Wr = P;
  for (let i = 0; i < 8; i++) {
    const a1 = unit(sub(P, E)); Wr = sub(P, mul(a1, hookLen));
    const sol = solveTwoBone(shR, Wr, l1, l2, pole); if (sol.ok) E = sol.mid; else { Wr = add(shR, mul(unit(sub(Wr, shR)), 0.995 * (l1 + l2))); const s2 = solveTwoBone(shR, Wr, l1, l2, pole); if (s2.ok) E = s2.mid; }
  }
  // the hand along the forearm, the thumb's side up (square to it), the rest hand's own vectors turned onto them
  // (the forearm's turn: the thumb's side up, or rolled toward the forearm's own mid-prone as the wrist bears it best;
  // the hook lies on the hand's axis, so the roll keeps it on the string)
  const a1 = unit(sub(Wr, E)); let up = sub([0, 0, 1], mul(a1, a1[2])); up = len(up) < 1e-6 ? [0, 1, 0] : unit(up);
  const tryRoll = (r) => {
    const m = alignFrameOf(hr.a0, hr.f0, a1, turnAbout(up, a1, r)), wrist = sub(P, mv(m, sub(hookRest, J.wristR)));
    const a = holdArm(R, body, 'R', wrist, m, { skilled: true, range: carryKit.RANGE_WEIGHT, clear: carryKit.CLEAR_WEIGHT, pole: sub(E, shR) });
    return { a, w: { m, P, wrist }, r, score: armScore(a) };
  };
  return (roll !== null ? [roll - 50, roll - 25, roll, roll + 25, roll + 50] : DRAW_ROLLS).map(tryRoll).reduce((b, x) => (x.score < b.score ? x : b));
}
/** the drawing forearm's turns tried off the thumb's side up (degrees) */
const DRAW_ROLLS = Object.freeze([-75, -50, -25, 0, 25, 50, 75]);
/** a frame turning rest vectors (a0 exactly, b0 as near as square allows) onto posed (a1, b1) */
const alignFrameOf = (a0, b0, a1, b1) => { const basis = (a, b) => { const x = unit(a), z = unit(cross(x, b)); return fromColumns(x, cross(z, x), z); }; return mm(basis(a1, b1), T(basis(a0, b0))); };

/**
 * A shot of the bow on a rig: `name` bowDraw | bowLoose; `bow` the bow's build words (an equipment bow: { style?, parts?,
 * dials? }); → { name, clip, keys, hold (the clip's last pose), mounts (the bow as gear riding the bow hand), stance,
 * tradition, hands, grip, drawLength (m, the nock's travel from brace to anchor), string ({ ready, set, anchor, brace }:
 * the nock's place, world, per key), checks }.
 */
export function heroBow(name, R, { bow, seconds } = {}) {
  const shot = BOW_SHOTS[name]; if (!shot) throw new Error(`hero-bow: no shot '${name}' (have ${BOW_SHOT_NAMES.join(', ')})`);
  const T0 = seconds ?? shot.seconds;
  const stance = heroStance(ARCHER, R, { left: true }), body = without(stance.hold, ARM_KEYS), lite = liteOf(R);
  const n0 = rigNodesAt(lite, elbowsDown(R, body)).nodes, f0 = boneFrames(R, R.joints, rigNodesAt(R, elbowsDown(R, body)).nodes);
  const Bm = bowModel(R, bow), s = scaleOf(R);
  const A = anchorOf(R, f0), eyeH = n0.headBase[2] + 0.45 * (n0.headTop[2] - n0.headBase[2]), mark = [0, n0.pelvisHub[1] + MARK_FAR, eyeH];
  const d = unit(sub(mark, A));
  // the bow arm's reach: the shoulder through the elbow and the wrist to the fist's centre, straight
  const J = R.joints, hr = handsAtRest(R).L, armL = dist(J.shoulderL, J.elbowL) + dist(J.elbowL, J.wristL) + dist(J.wristL, hr.h);
  const gripSt = { at: Bm.grip.origin, c: [0, 0, 1], a: [0.6, 0.8, 0] };
  const fistAt = (F) => worldOf(F, Bm.grip.origin);
  // the shelf along the line from the anchor until the fist on the grip stands DRAW of the arm from its shoulder
  const along = (W, from, dir, reach) => { let lo = 0.2, hi = 1.4; for (let i = 0; i < 40; i++) { const t = (lo + hi) / 2; if (dist(fistAt(placed(Bm, W, add(from, mul(dir, t)))), n0.shoulderL) < reach * armL) lo = t; else hi = t; } return (lo + hi) / 2; };
  const W = bowFrame(d), t = along(W, A, d, DRAW), Fa = placed(Bm, W, add(A, mul(d, t)));
  // the nock at brace on the shelf's line (the string's rest: the bow's own brace behind its grip)
  const nockAt = (F) => worldOf(F, [-Bm.brace, 0, Bm.shelf[2]]);
  // THE ANCHOR: the bow hand round the grip (its roll searched); the drawing arm by the archer's rule
  const bowHand = handTo(R, body, Fa, gripSt, 'L');
  const side = unit(cross(d, [0, 0, 1]));
  const draw = drawArm(R, body, n0, A, 0);
  // THE SET: the bow on the line, the string a third of the way back from brace
  const Pset = add(nockAt(Fa), mul(sub(A, nockAt(Fa)), SET_DRAW));
  const set = drawArm(R, body, n0, Pset, 0, draw.r);
  // THE READY: the bow tipped down before the body, the arm eased, the arrow nocked at brace, the drawing hand on it
  const dR = unit(add(mul(d, Math.cos((READY_DIP * Math.PI) / 180)), mul([0, 0, -1], Math.sin((READY_DIP * Math.PI) / 180))));
  const WR = fromColumns(...[0, 1, 2].map((j) => turnAbout([W[0][j], W[1][j], W[2][j]], side, -READY_DIP)));
  const Pr0 = add(n0.shoulderL, mul(dR, 0.2)), tr = along(WR, Pr0, dR, READY_REACH), Fr = placed(Bm, WR, add(Pr0, mul(dR, tr)));
  const bowReady = handTo(R, body, Fr, gripSt, 'L', bowHand.d), readyDraw = drawArm(R, body, n0, nockAt(Fr), -1.3, draw.r);
  // THE LOOSE: the string hand thrown back along the jaw and out from the face, the fingers open
  const Ploose = add(add(A, mul(d, -LOOSE_BACK * s)), mul(side, LOOSE_OUT * s));
  const loose = drawArm(R, body, n0, Ploose, 0, draw.r);
  // the fists: the bow hand round its grip (hero-digits), the drawing hand hooked; the loose's open
  const box = handBox(R, 'L', { female: !!J.bustRootR });
  const gripL = (w, F) => {
    if (!R.hands?.L) return { ...HAND_POSES.grip };
    const toHand = (p) => add(J.wristL, mv(T(w.m), sub(p, w.wrist))), a = unit(mv(T(w.m), mv(F.W, [0, 0, 1])));
    const prim = { kind: 'cylinder', c: toHand(worldOf(F, Bm.grip.origin)), a, r: Bm.r * F.k };
    const out = Object.fromEntries(['index', 'middle', 'ring', 'little'].map((dg) => [dg, closeOn(R, box, dg, prim).value]));
    out.thumb = closeOn(R, box, 'thumb', prim, { start: { cmc: [-20, 25], mcp: 0, ip: 0 } }).value;
    return Object.fromEntries(DIGITS.map((dg) => [dg, out[dg]]));
  };
  const hook = R.hands?.R ? handShape(R, 'R', HOOK, { female: !!J.bustRootR }).fingers : { ...HAND_POSES.grip };
  const armsOf = (L, Rh, fL, fR) => elbowsDown(R, { ...body, shL: L.a.sh, elbowL: L.a.elbow, wristL: L.a.wrist, fingersL: fL, shR: Rh.a.sh, elbowR: Rh.a.elbow, wristR: Rh.a.wrist, fingersR: fR });
  const gL = gripL(bowHand.w, Fa), gLr = gripL(bowReady.w, Fr);
  const P = {
    ready: armsOf(bowReady, readyDraw, gLr, hook),
    set: armsOf(bowHand, set, gL, hook),
    anchor: armsOf(bowHand, draw, gL, hook),
    loose: armsOf(bowHand, loose, gL, { ...HAND_POSES.open }),
  };
  // the keys: a draw enters the stance (its own steps) into the ready, then the set and the anchor; a loose lets go,
  // follows through and comes back to the ready
  const last = stance.keys.at(-1), at = (tt, pose) => ({ ...last, t: tt, pose });
  const keys = name === 'bowDraw'
    ? [...stance.keys.map((k, i, all) => ({ ...k, t: k.t * 0.3, ...(i === all.length - 1 ? { pose: P.ready } : {}) })), at(0.62, P.set), at(1, P.anchor)]
    : [at(0, P.anchor), at(0.05, P.loose), at(0.4, P.loose), at(1, P.ready)];
  const clip = keyedClip({ seconds: T0, keys }, R), hold = clip.fn(1);
  // the bow rides the bow hand: its frame in the hand bone's rest frame, as gear is mounted (o at its origin)
  const ride = (pose, F) => { const fr = boneFrames(R, R.joints, rigNodesAt(R, pose).nodes)[R.boneIndex.handL]; return { M: mm(T(fr.m), F.W), t: add(fr.restHead, mv(T(fr.m), sub(F.O, fr.head))) }; };
  const rd = ride(P.anchor, Fa);
  const mount = { slot: 'left', item: 'bow', hold: 'bow', build: Bm.build, sockets: Bm.e.sockets, trace: Bm.e.trace, bone: 'handL', boneIndex: R.boneIndex.handL, M: rd.M, o: [0, 0, 0], t: rd.t, k: Bm.k, length: r4(Bm.e.trace.length * Bm.k) };
  const string = { ready: nockAt(Fr).map(r3), set: Pset.map(r3), anchor: A.map(r3), brace: nockAt(Fa).map(r3) };
  const checks = bowChecks(R, P, { Fa, Fr, Bm, A, mark, d, want: { L: bowHand.w, R: draw.w }, holds: { L: bowHand.a, R: draw.a, set: set.a, ready: readyDraw.a, bowReady: bowReady.a, loose: loose.a } });
  return { name, clip, keys, hold, mounts: [mount], stance: 'archerLeft', tradition: 'the Mediterranean draw to a side anchor', hands: 2, grip: 'bow',
    drawLength: r3(dist(nockAt(Fa), A)), string, checks };
}

/**
 * The machine gate on the shot, at the anchor: per hand the fist off its station (m) and its frame off the one wanted
 * (degrees), the wrist as the anatomy reads it and whether it stays in range; the arrow (degrees its line from the anchor
 * through the shelf misses the mark); the anchor (m, the drawing hand's station off the mouth's corner); the string's
 * clearance (m, the bow arm's forearm off the string's path from the anchor to brace: the string must not slap it); the
 * draw (m, at least a fifth of the bow's length and no more than half); laws.
 */
function bowChecks(R, P, { Fa, Bm, A, mark, d, want, holds }) {
  const n = rigNodesAt(R, P.anchor).nodes, frames = boneFrames(R, R.joints, n), hands = {};
  for (const side of ['L', 'R']) {
    const f = frames[R.boneIndex[`hand${side}`]], hr = handsAtRest(R)[side], w = want[side];
    const pt = side === 'R' ? add(R.joints.middleMcpR ?? R.joints.knucklesR, mul(hr.a0, 0.022 * scaleOf(R))) : hr.h;
    const at = add(f.head, mv(f.m, sub(pt, hr.wrist))), an = wristFor(R, side, anatomicalForearm(R, n, side), f.m);
    const out = Math.hypot(...Object.entries(WRIST_RANGE).map(([k, [lo, hi]]) => Math.max(0, lo - an[k], an[k] - hi)));
    hands[side] = { at: r4(dist(at, w.P)), wrist: { flex: r1(an.flex), deviation: r1(an.deviation), twist: r1(an.twist) }, inRange: out < 0.5 };
  }
  const shelf = worldOf(Fa, Bm.shelf), arrow = r1(angle(sub(shelf, A), sub(mark, A)));
  // the string's path at the loose: the anchor to brace, the bow arm's forearm (elbow → wrist) off it
  const brace = worldOf(Fa, [-Bm.brace, 0, Bm.shelf[2]]);
  const segSeg = (p1, q1, p2, q2) => { let b = Infinity; for (let i = 0; i <= 20; i++) { const p = add(p1, mul(sub(q1, p1), i / 20)), ab = sub(q2, p2), tt = Math.max(0, Math.min(1, dot(sub(p, p2), ab) / dot(ab, ab))); b = Math.min(b, dist(p, add(p2, mul(ab, tt)))); } return b; };
  const string = r4(segSeg(A, brace, n.elbowL, add(n.wristL, mul(sub(n.elbowL, n.wristL), 0.15))) - 0.035 * scaleOf(R));
  const drawn = dist(A, brace), bowLen = Bm.e.trace.length * Bm.k;
  // (the loose is the hand let go: its place is where the release throws it, not a station; it is read, not held to)
  const solved = Object.entries(holds).every(([k, a]) => k === 'loose' || a.err < 0.006);
  const laws = { hands: Object.values(hands).every((h) => h.at < 0.006) && solved, wrist: Object.values(hands).every((h) => h.inRange), arrow: arrow < 1.5, string: string > 0, draw: drawn > 0.2 * bowLen && drawn < 0.5 * bowLen };
  return { hands, arrow, string, draw: r3(drawn), keysSolved: Object.fromEntries(Object.entries(holds).map(([k, a]) => [k, r4(a.err)])), laws };
}
