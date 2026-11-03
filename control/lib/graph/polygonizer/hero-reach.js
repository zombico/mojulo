/**
 * hero-reach — SPACE BOXER, the manual manipulator's arm: a TARGET in space is reached by bringing a chosen surface of
 * the hand to it, travelling along an approach, the arm's joints held to their servos (hero-servo.js). The hand is
 * placed first and the arm solved to serve it (hero-grip.js `holdArm`'s way, whose costs and weights this reuses).
 *
 *   • THE HAND'S SURFACES (handFeatures): where a hand strikes, each a point and an outward normal in the rig's REST
 *     frame, read off the rig's own hand with its hand word: `knuckles` (the fist's first two proximal phalanges, the
 *     face a straight punch lands on), `backfist` (the back of the first two knuckles), `palmHeel` (the heel of the open
 *     palm), `knife` (the open hand's little-finger edge), `fingertips` (the open hand's middle fingertip).
 *   • A TARGET: { at (the rig's frame, metres), approach ('line': from the shoulder to the target, or a direction),
 *     surface, face? }. The hand's frame is the surface's normal turned onto the approach, rolled so the surface's
 *     reference axis lies as near `face` as it can (each surface its default: a horizontal fist palm down, a palm heel
 *     fingers up …); the wrist's goal follows from the surface's point (targetFrame).
 *   • THE SOLVE (reachTarget): the shoulder's pitch, yaw and roll and the elbow (the roll as the rig plays it, on top of
 *     the elbows-down roll: hero-elbow.js) and the hand's roll about its approach (the face is a preference: a degree off
 *     it weighs 0.01, so a fist turns as the forearm finds easiest) and its aim (the approach turned up to 45° off the one
 *     asked, a degree weighing 0.02: a straight punch travels along its forearm, wherever the elbow puts it) by
 *     Levenberg–Marquardt on residuals: the wrist on its goal (a millimetre
 *     weighs 1), the elbow near its elbows-down place (a metre weighs √½), the wrist's anatomy past its ease (a degree
 *     weighs √0.005) and past its range (√½), off the wrist its surface wants (the force line: a degree weighs 0.05,
 *     so a fist lines up behind its knuckles before the elbow stays down), the shoulder past its cone's ease and range and its rotation past its ease
 *     and range (the same two weights), the elbow past its ease, the arm into the trunk (a centimetre weighs 1) and, on
 *     a path, the joints' change from the last sample (a degree weighs 0.01: continuity). The wrist channel then turns
 *     the hand the rest of the way (wristFor). The seeds: the path's last sample, else the nearest distinct arms in a
 *     table built once per rig (the wrist's place off the shoulder in the thorax's frame, for a grid of the arm's angles).
 * Pure and deterministic: no dice, no clock.
 */
import { rigNodesAt, boneFrames, solveTwoBone } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { liteOf, lm, alignFrame, wristFor, anatomicalForearm, humeralTurn, armClear, WRIST_RANGE, WRIST_EASE } from './hero-grip.js';
import { SERVOS, coneAt, shoulderAngles, thoraxFrame } from './hero-servo.js';
import { heroStance, comOf, hull, margin } from './hero-stance.js';
import { keyedClip } from './hero-jump.js';
import { HAND_POSES } from './station-loft-rig.js';
import { servoRead, SERVO_SPEEDS } from './hero-servo.js';
import { mulberry32 } from '../city/plan/dice.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const T = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const DEG = 180 / Math.PI;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * DEG;
const r1 = (x) => Math.round(x * 10) / 10 + 0, r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
/** the rotation angle (degrees) between two frames */
const turnBetween = (a, b) => { const r = mm(T(a), b); return Math.acos(Math.max(-1, Math.min(1, (r[0][0] + r[1][1] + r[2][2] - 1) / 2))) * DEG; };

/** the search box: the arm's (holdArm's) pitch, yaw, elbow, roll; the hand's roll about its approach (off its face); its
 * aim, the approach turned off the one asked about two axes square to it (degrees) */
const LO = [-40, -100, 0, -160, -90, -45, -45], HI = [175, 100, 150, 160, 90, 45, 45];
/** the costs' weights (holdArm's, see the header) */
const W = Object.freeze({ wrist: 1000, elbowDown: Math.SQRT1_2, ease: Math.sqrt(5e-3), range: Math.SQRT1_2, clear: 100, step: 0.01, line: 0.05, face: 0.01, aim: 0.02 });

/**
 * THE LADDER: when the arm alone cannot reach (or cannot within its servos), the body joins in, a rung at a time, each a
 * set of the body's own channels the solve may move, each at its cost, so it moves as little as it must:
 *   1 girdle   the shoulders' turn (`shoulders`, degrees within the rig's ±30)            a degree weighs 0.03
 *   2 trunk    the spine's turn, side bend and bow (`spine` axial, lateral, sagittal:     a tenth of a range weighs 0.3
 *              shares of their ranges)
 *   3 hips     the hips' turn on the planted feet (`facing`, degrees), the weight carried  a degree 0.03; a centimetre
 *              over the floor (`shift` x, y) and the knees bent (`sink`), the centre of    0.1 (sink 0.05)
 *              mass held 3 cm inside the feet (a centimetre outside weighs 1)
 *   4 step     the striking side's foot stepped toward the target along the floor          a centimetre weighs 0.03
 * A leg that cannot reach its planted foot weighs as the hand's miss does (a millimetre, 1). Each rung's variables are
 * the deltas from the stance's own values.
 */
export const RUNGS = Object.freeze(['arm', 'girdle', 'trunk', 'hips', 'step']);
const BODY_VARS = Object.freeze([
  Object.freeze({ k: 'girdle', rung: 1, lo: -30, hi: 30, w: 0.03 }),
  Object.freeze({ k: 'turn', rung: 2, lo: -0.6, hi: 0.6, w: 3 }), Object.freeze({ k: 'lean', rung: 2, lo: -0.6, hi: 0.6, w: 3 }), Object.freeze({ k: 'bow', rung: 2, lo: -0.6, hi: 0.6, w: 3 }),
  Object.freeze({ k: 'facing', rung: 3, lo: -40, hi: 40, w: 0.03 }), Object.freeze({ k: 'shiftX', rung: 3, lo: -0.15, hi: 0.15, w: 10 }), Object.freeze({ k: 'shiftY', rung: 3, lo: -0.15, hi: 0.15, w: 10 }), Object.freeze({ k: 'sink', rung: 3, lo: 0, hi: 0.12, w: 5 }),
  Object.freeze({ k: 'step', rung: 4, lo: 0, hi: 0.45, w: 3 }),
]);
const W_LEG = 1000, W_BALANCE = 100, BALANCE_IN = 0.03;
const clampShare = (v) => Math.max(-1, Math.min(1, v));
/** the body with the ladder's deltas `d` ({ girdle, turn, lean, bow, facing, shiftX, shiftY, sink, step }) applied; the
 * step moves the striking side's planted foot along `dir` (a unit on the floor) */
function laddered(body, d, S, dir) {
  const out = { ...body };
  if (d.girdle) out.shoulders = (body.shoulders ?? 0) + d.girdle;
  if (d.turn || d.lean || d.bow) { const sp = body.spine || {}; out.spine = { sagittal: clampShare((sp.sagittal || 0) + (d.bow || 0)), lateral: clampShare((sp.lateral || 0) + (d.lean || 0)), axial: clampShare((sp.axial || 0) + (d.turn || 0)) }; }
  if (d.facing) out.facing = (body.facing ?? 0) + d.facing;
  if (d.shiftX || d.shiftY) out.shift = { x: (body.shift?.x ?? 0) + (d.shiftX || 0), y: (body.shift?.y ?? 0) + (d.shiftY || 0) };
  if (d.sink) out.sink = (body.sink ?? 0) + d.sink;
  if (d.step && body.feet?.[S]) out.feet = { ...body.feet, [S]: [body.feet[S][0] + dir[0] * d.step, body.feet[S][1] + dir[1] * d.step, body.feet[S][2]] };
  return out;
}

/**
 * The surfaces a hand strikes with: per surface `{ hand (the hand word it is made with), ref (the rest hand's axis rolled
 * toward the target's `face`), face (its default: a direction in the rig's frame) }`.
 */
export const SURFACES = Object.freeze({
  knuckles: Object.freeze({ hand: 'fist', ref: 'palm', face: [0, 0, -1], wrist: { flex: 0, deviation: 0 }, says: 'a straight punch: the fist palm down, the wrist straight' }),
  backfist: Object.freeze({ hand: 'fist', ref: 'along', face: [0, 0, 1], wrist: { flex: 0, deviation: 0 }, says: 'the back of the fist leading, the hand upright' }),
  palmHeel: Object.freeze({ hand: 'open', ref: 'along', face: [0, 0, 1], wrist: { flex: 60, deviation: 0 }, says: 'a palm strike: the fingers up, the wrist bent back' }),
  knife: Object.freeze({ hand: 'open', ref: 'palm', face: [0, 0, -1], wrist: { flex: 0, deviation: 0 }, says: 'a knife hand: the edge leading, palm down' }),
  fingertips: Object.freeze({ hand: 'open', ref: 'across', face: [0, 0, 1], wrist: { flex: 0, deviation: 0 }, says: 'a spear hand: the thumb up, the wrist straight' }),
});

/**
 * THE APPROACHES a strike can come from, each the travel at contact turned off the line from the shoulder to the target
 * (degrees): `straight` along it; `hook` turned toward the body's middle about the thorax's up (the fist crossing in from
 * the side); `uppercut` turned up about the shoulder's lateral (the fist rising into it). A near target is reached with
 * the forearm far off the shoulder's line (the punch line: phase 0), so the solver tries each and keeps the cheapest.
 */
export const APPROACHES = Object.freeze({ straight: 0, hook: 75, uppercut: 70 });
export const SURFACE_NAMES = Object.freeze(Object.keys(SURFACES));

const featureCache = new WeakMap();
/**
 * The hand's surfaces in the rig's REST frame for side S: { wrist, axes: { along (wrist → middle knuckle), across
 * (toward the thumb), palm (out of the palm's front) }, surfaces: { <name>: { p, n, hand } } }. Read once per rig from
 * the rig's own hand closed into a fist and opened flat.
 */
export function handFeatures(R, S) {
  const memo = featureCache.get(R) || {}; if (memo[S]) return memo[S];
  const J = R.joints, at = (j) => J[`${j}${S}`];
  const fist = rigNodesAt(R, { support: 'none', [`fingers${S}`]: 'fist' }).nodes, open = rigNodesAt(R, { support: 'none', [`fingers${S}`]: 'open' }).nodes;
  const p = (n, j) => n[`${j}${S}`];
  const wrist = at('wrist'), along = unit(sub(at('middleMcp'), wrist));
  let across = sub(at('indexMcp'), at('littleMcp')); across = unit(sub(across, mul(along, dot(across, along))));
  let palm = unit(cross(along, across)); if (dot(sub(p(fist, 'middleTip'), at('middleMcp')), palm) < 0) palm = mul(palm, -1);
  const palmLen = dist(wrist, at('middleMcp'));
  // a phalanx's radius at its knuckle, the skin over the bone line (hero-hand.js HAND_FORM's: about a centimetre)
  const rF = 0.01, rPalm = 0.016;
  const mid2 = (n, a, b) => mul(add(add(p(n, `index${a}`), p(n, `index${b}`)), add(p(n, `middle${a}`), p(n, `middle${b}`))), 0.25);
  const surfaces = {
    // the folded proximal phalanges' backs face along the hand: the fist's front
    knuckles: { p: add(mid2(fist, 'Mcp', 'Pip'), mul(along, rF)), n: along, hand: 'fist' },
    backfist: { p: add(mul(add(p(fist, 'indexMcp'), p(fist, 'middleMcp')), 0.5), mul(palm, -rF)), n: mul(palm, -1), hand: 'fist' },
    palmHeel: { p: add(add(wrist, mul(along, 0.2 * palmLen)), mul(palm, rPalm)), n: palm, hand: 'open' },
    knife: { p: add(mul(add(wrist, p(open, 'littleMcp')), 0.5), mul(across, -rPalm)), n: mul(across, -1), hand: 'open' },
    fingertips: { p: add(p(open, 'middleTip'), mul(along, rF * 0.8)), n: along, hand: 'open' },
  };
  const out = { wrist: [...wrist], axes: { along, across, palm }, surfaces };
  memo[S] = out; featureCache.set(R, memo);
  return out;
}

/**
 * A target's hand: { m (the hand's rotation, rest → posed), goal (the wrist's place), approach, surface, at }. `n` the
 * posed body (its shoulder for a `line` approach).
 */
export function targetFrame(R, S, target, n) {
  const name = target.surface ?? 'knuckles', K = SURFACES[name];
  if (!K) throw new Error(`hero-reach: no surface '${name}' (have ${SURFACE_NAMES.join(', ')})`);
  const F = handFeatures(R, S), s = F.surfaces[name];
  const approach = Array.isArray(target.approach) ? unit(target.approach) : unit(sub(target.at, n[`shoulder${S}`]));
  let face = target.face ? unit(target.face) : K.face;
  if (Math.abs(dot(face, approach)) > 0.98) face = unit(cross(approach, [1, 0, 0]));   // (a face along the approach rolls nothing: any roll)
  const m = alignFrame(s.n, F.axes[K.ref], approach, face);
  const goal = sub(target.at, mv(m, sub(s.p, F.wrist)));
  return { m, goal, approach, surface: name, hand: K.hand, at: [...target.at], p: s.p, wrist: F.wrist };
}
/** the rotation matrix of `deg` degrees about unit k */
const rotM = (k, deg) => { const a = deg / DEG, c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = k; return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]; };
/** two axes square to an approach (the first level, unless the approach is upright) */
const squareTo = (a) => { let u = cross(a, [0, 0, 1]); if (len(u) < 1e-6) u = cross(a, [1, 0, 0]); u = unit(u); return [u, cross(a, u)]; };
/** a target's hand rolled `psi` degrees about its approach and its approach aimed (`a`, `b` degrees about the two axes
 * square to it): { m, goal, approach } (the surface facing along the aimed approach) */
export const rolled = (fr, psi = 0, a = 0, b = 0) => {
  if (!psi && !a && !b) return { m: fr.m, goal: fr.goal, approach: fr.approach };
  const [u1, u2] = squareTo(fr.approach), Q = mm(rotM(u2, b), mm(rotM(u1, a), rotM(fr.approach, psi))), m = mm(Q, fr.m);
  return { m, goal: sub(fr.at, mv(m, sub(fr.p, fr.wrist))), approach: mv(Q, fr.approach) };
};

const tableCache = new WeakMap();
/** the seed table for side S: a grid of the arm's angles and where each puts the wrist off the shoulder, in the thorax's
 * frame (right, forward, up), the body hanging */
function seedTable(R, S) {
  const memo = tableCache.get(R) || {}; if (memo[S]) return memo[S];
  const lite = liteOf(R), rows = [];
  for (let p = -30; p <= 170; p += 20) for (let y = -90; y <= 90; y += 30) for (let e = 0; e <= 150; e += 30) for (let r = -150; r <= 150; r += 50) {
    const n = rigNodesAt(lite, elbowsDown(R, { support: 'none', [`sh${S}`]: { pitch: p, yaw: y, roll: r }, [`elbow${S}`]: e })).nodes;
    const Tf = thoraxFrame(n), d = sub(n[`wrist${S}`], n[`shoulder${S}`]);
    rows.push({ x: [p, y, e, r], rel: [dot(d, Tf.right), dot(d, Tf.fwd), dot(d, Tf.up)] });
  }
  memo[S] = rows; tableCache.set(R, memo);
  return rows;
}

/** how far v lies past [lo, hi] (0 inside) */
const past = (v, [lo, hi]) => Math.max(0, lo - v, v - hi);

/**
 * One arm to a target: { pose (the arm's channels and its hand word, to merge over `body`), x ([pitch, yaw, elbow, roll,
 * the hand's roll about the approach, its aim off the approach about two axes], a path's next seed), err (m, the wrist
 * off its goal), frame (the target's hand as reached: its `approach` as aimed, `asked` the one asked, `aim` the degrees
 * between, `roll` off the face), wrist (the anatomy, degrees), shoulder
 * ({ plane, elevation, twist }), clear (m, the arm off the trunk), cost }. `seed` an arm's x to start from (a path's last
 * sample: its continuity holds the arm to it), `n0` the body already posed, `lock` a reached `frame` whose hand (its
 * rotation and approach) is kept while the arm takes it to `target.at` (a path's samples), `rungs` how far up the
 * LADDER the body may join in (0 the arm alone … 4 a step). The result's `pose` then carries the body's channels it
 * moved, `rung` the highest rung used, `ladder` the deltas, `step` where a stepped foot stands; `hard` names what passes
 * a hard stop.
 */
export function reachTarget(R, body, S, target, { seed = null, n0 = null, lock = null, rungs = 0, seeds: nSeeds = 6, iters = null } = {}) {
  // (the ladder's legs may be asked for the unreachable: the solve reads a clamped leg as a cost, never a throw)
  const lite = { ...liteOf(R), reach: 'clamp' };
  const vars = BODY_VARS.filter((v) => v.rung <= rungs);
  const dir = (() => { const f = body.feet?.[S]; if (!f) return [0, 1, 0]; const v = [target.at[0] - f[0], target.at[1] - f[1], 0]; const l = Math.hypot(v[0], v[1]); return l > 1e-6 ? [v[0] / l, v[1] / l, 0] : [0, 1, 0]; })();
  const deltas = (x) => Object.fromEntries(vars.map((v, i) => [v.k, x[7 + i]]));
  const bodyOf = (x) => (vars.length ? laddered(body, deltas(x), S, dir) : body);
  const nb = n0 ?? rigNodesAt(lite, elbowsDown(R, body)).nodes;
  // a LOCKED hand (a path's: the frame its contact was reached with) keeps its frame and its approach; only the arm moves
  const fr = lock ? { ...lock, at: [...target.at], goal: sub(target.at, mv(lock.m, sub(lock.p, lock.wrist))) } : targetFrame(R, S, target, nb);
  const lo = [...(lock ? [...LO.slice(0, 4), 0, 0, 0] : LO), ...vars.map((v) => v.lo)], hi = [...(lock ? [...HI.slice(0, 4), 0, 0, 0] : HI), ...vars.map((v) => v.hi)];
  const fa = { bones: [R.bones[R.boneIndex[`foreArm${S}`]]] };
  const l1 = dist(R.joints[`shoulder${S}`], R.joints[`elbow${S}`]), l2 = dist(R.joints[`elbow${S}`], R.joints[`wrist${S}`]);
  const down = [S === 'R' ? 0.25 : -0.25, 0, -1];
  const posedOf = (x) => rigNodesAt(lite, elbowsDown(R, { ...bodyOf(x), [`sh${S}`]: { pitch: x[0], yaw: x[1], roll: x[3] }, [`elbow${S}`]: x[2] }));
  const nodesOf = (x) => posedOf(x).nodes;
  const elbowDown = (n, goal) => { const sh = n[`shoulder${S}`], d = dist(sh, goal), k = Math.min(1, (0.999 * (l1 + l2)) / d); const sol = solveTwoBone(sh, add(sh, mul(sub(goal, sh), k)), l1, l2, down); return sol.ok ? sol.mid : n[`elbow${S}`]; };
  const anatomy = (n, m) => wristFor(R, S, anatomicalForearm(R, n, S), m);
  // the residuals, each under its term's name (`terms` in the result: each term's share of the cost)
  const named = (x) => {
    const H = rolled(fr, x[4], x[5], x[6]), P = posedOf(x), n = P.nodes, w = anatomy(n, H.m), sh = shoulderAngles(n, S, x[2]);
    const t = { contact: mul(sub(n[`wrist${S}`], H.goal), W.wrist), elbowDown: mul(sub(n[`elbow${S}`], elbowDown(n, H.goal)), W.elbowDown), face: [W.face * x[4]], aim: [W.aim * x[5], W.aim * x[6]], wrist: [], line: [], shoulder: [], elbow: [], clear: [], step: [], ladder: [], legs: [], balance: [] };
    if (vars.length) {
      vars.forEach((v, i) => t.ladder.push(v.w * x[7 + i]));
      for (const L of Object.values(P.report?.legs || {})) t.legs.push(W_LEG * (L.metaError || 0));
      if (vars.some((v) => v.rung >= 3)) {
        const feet = Object.values(R.legs).flatMap((L) => [L.toeBase, L.toeTip, L.hock].map((j) => n[j]).filter(Boolean).map((p) => [p[0], p[1]]));
        t.balance.push(W_BALANCE * Math.max(0, BALANCE_IN - margin(hull(feet), comOf(n))));
      }
    }
    for (const k of ['flex', 'deviation', 'twist']) t.wrist.push(W.ease * past(w[k], WRIST_EASE[k]), W.range * past(w[k], WRIST_RANGE[k]));
    // the force line: the wrist as the surface wants it (a fist straight behind its knuckles), so the forearm lines up
    for (const k of ['flex', 'deviation']) t.line.push(W.line * (w[k] - SURFACES[fr.surface].wrist[k]));
    const cone = sh.plane === null ? { hard: 180, ease: 180 } : coneAt(sh.plane);
    t.shoulder.push(W.ease * Math.max(0, sh.elevation - cone.ease), W.range * Math.max(0, sh.elevation - cone.hard));
    const tw = sh.twist ?? (x[2] >= SERVOS.shoulder.readTwistAbove ? humeralTurn(n, S) : 0);
    t.shoulder.push(W.ease * past(tw, SERVOS.shoulder.twist.ease), W.range * past(tw, SERVOS.shoulder.twist.range));
    t.elbow.push(W.ease * past(x[2], SERVOS.elbow.ease));
    t.clear.push(W.clear * Math.max(0, -armClear(R, n, S)));
    if (seed) for (let i = 0; i < 7 + vars.length; i++) t.step.push(W.step * (x[i] - (seed[i] ?? 0)));
    return t;
  };
  const resid = (x) => Object.values(named(x)).flat();
  let seeds;
  if (seed) seeds = [[...seed.slice(0, 4), seed[4] ?? 0, seed[5] ?? 0, seed[6] ?? 0, ...vars.map((v, i) => seed[7 + i] ?? 0)]];
  else {
    // the nearest distinct arms in the table to the goal, off the posed shoulder in the posed thorax's frame
    const Tf = thoraxFrame(nb), d = sub(fr.goal, nb[`shoulder${S}`]), want = [dot(d, Tf.right), dot(d, Tf.fwd), dot(d, Tf.up)];
    const rows = seedTable(R, S).map((r) => ({ x: r.x, d: dist(r.rel, want) })).sort((a, b) => a.d - b.d);
    seeds = [];
    for (const g of rows) { if (seeds.length >= nSeeds) break; if (seeds.every((q) => Math.abs(q[2] - g.x[2]) > 25 || Math.abs(q[3] - g.x[3]) > 40 || Math.abs(q[1] - g.x[1]) > 25)) seeds.push([...g.x, 0, 0, 0, ...vars.map(() => 0)]); }
  }
  let best = null;
  for (const sd of seeds) { const r = lm(resid, lock ? [...sd.slice(0, 4), 0, 0, 0, ...sd.slice(7)] : sd, lo, hi, iters ?? (seed ? 30 : 50)); if (!best || r.c < best.c) best = r; }
  const x = best.x.map((v, i) => (i >= 7 && Math.abs(lo[i]) < 1 && Math.abs(hi[i]) < 1 ? r4(v) : r1(v))), n = nodesOf(x), H = rolled(fr, x[4], x[5], x[6]), hand = { ...fr, m: H.m, goal: H.goal, approach: H.approach, asked: fr.approach, roll: x[4], aim: r1(angle(H.approach, fr.approach)) };
  const ch = wristFor(R, S, boneFrames(fa, R.joints, n)[0].m, H.m), w = anatomy(n, H.m), sh = shoulderAngles(n, S, x[2]);
  // what passes a hard stop at the solve (the wrist's anatomy, the shoulder's cone and rotation)
  const cone = sh.plane === null ? { hard: 180 } : coneAt(sh.plane), tw = sh.twist;
  const hard = [...['flex', 'deviation', 'twist'].filter((k) => past(w[k], WRIST_RANGE[k]) > 0.5).map((k) => `wrist.${k}`), ...(sh.elevation > cone.hard + 0.5 ? ['shoulder.swing'] : []), ...(tw !== null && past(tw, SERVOS.shoulder.twist.range) > 0.5 ? ['shoulder.twist'] : [])];
  const d = vars.length ? deltas(x) : {}, used = vars.filter((v, i) => Math.abs(x[7 + i]) > (Math.abs(v.hi) < 1 ? 0.005 : 0.5));
  const bodyDone = vars.length ? laddered(body, d, S, dir) : body;
  return {
    pose: { ...(vars.length ? Object.fromEntries(Object.entries(bodyDone).filter(([k, v]) => body[k] !== v)) : {}), [`sh${S}`]: { pitch: x[0], yaw: x[1], roll: x[3] }, [`elbow${S}`]: x[2], [`wrist${S}`]: { flex: r1(ch.flex), deviation: r1(ch.deviation), twist: r1(ch.twist) }, [`fingers${S}`]: fr.hand },
    rungs, rung: used.length ? Math.max(...used.map((v) => v.rung)) : 0, ladder: Object.fromEntries(used.map((v) => [v.k, d[v.k]])), hard,
    ...(d.step > 0.005 && body.feet?.[S] ? { step: { side: S, to: bodyDone.feet[S].map(r4) } } : {}),
    x, err: r4(dist(n[`wrist${S}`], H.goal)), frame: hand,
    wrist: { flex: r1(w.flex), deviation: r1(w.deviation), twist: r1(w.twist) },
    shoulder: { plane: sh.plane, elevation: sh.elevation, twist: sh.twist }, clear: r4(armClear(R, n, S)), cost: r4(best.c),
    terms: Object.fromEntries(Object.entries(named(x)).map(([k, v]) => [k, r4(v.reduce((a, q) => a + q * q, 0))])),
  };
}

/**
 * The CONTACT a posed hand makes, on the whole rig (its fingers closed by their word; the pose as a clip holds it, the
 * elbows-down roll added as the clip player adds it): { point (the surface's posed place), normal, err (m, the point
 * off the target), approachErr (degrees, the normal off the approach), frameErr (degrees, the hand's posed frame off
 * the one wanted) }. `played`: the pose is a clip's (the roll already added).
 */
export function contactOf(R, pose, S, fr, { played = false } = {}) {
  const n = rigNodesAt(R, played ? pose : elbowsDown(R, pose)).nodes, f = boneFrames(R, R.joints, n)[R.boneIndex[`hand${S}`]];
  const s = handFeatures(R, S).surfaces[fr.surface];
  const point = add(f.head, mv(f.m, sub(s.p, f.restHead))), normal = mv(f.m, s.n);
  return { point: point.map(r4), normal: normal.map(r4), err: r4(dist(point, fr.at)), approachErr: r1(angle(normal, fr.approach)), frameErr: r1(turnBetween(f.m, fr.m)) };
}

/** the approach of `family` to a target at `at` from the shoulder `sh` in the thorax's frame Tf, for side S */
export function approachOf(family, at, sh, Tf, S) {
  const line = unit(sub(at, sh)), deg = APPROACHES[family];
  if (deg === undefined) throw new Error(`hero-reach: no approach '${family}' (have ${Object.keys(APPROACHES).join(', ')})`);
  if (!deg) return line;
  const turn = (v, k, d) => { const a = d / DEG, c = Math.cos(a), s = Math.sin(a); return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))); };
  // the hook toward the middle: about up, the right hand's turning to its left (+ about up), the left's to its right
  if (family === 'hook') return unit(turn(line, Tf.up, S === 'R' ? deg : -deg));
  // the uppercut up: about the axis square to the line and up (the line's own lateral), toward up
  const k = cross(line, Tf.up); if (len(k) < 1e-6) return line;
  return unit(turn(line, unit(k), deg));
}

/**
 * A STRIKE at a target: each approach in `families` tried with the arm alone (the target's surface and face kept) and the
 * cheapest kept; then, while its hand misses by more than `reached` or a joint passes a hard stop, the LADDER climbed a
 * rung at a time up to `rungs` (that approach kept). reachTarget's result with its `family`, and every try's cost
 * (`tried`).
 */
export function strikeTarget(R, body, S, target, { families = Object.keys(APPROACHES), seed = null, n0 = null, rungs = RUNGS.length - 1, reached = 0.002 } = {}) {
  const nb = n0 ?? rigNodesAt(liteOf(R), elbowsDown(R, body)).nodes, Tf = thoraxFrame(nb), sh = nb[`shoulder${S}`];
  // (each approach searched in full: a cheaper screen, three seeds or fifteen iterations, chose a worse approach on the
  // hard targets, across the body, and saved little)
  let best = null; const tried = {};
  for (const fam of families) {
    const a = reachTarget(R, body, S, { ...target, approach: approachOf(fam, target.at, sh, Tf, S) }, { seed, n0: nb });
    tried[fam] = a.cost;
    if (!best || a.cost < best.cost) best = { ...a, family: fam };
  }
  // THE LADDER: the body joins in only while the hand misses or a joint passes a stop, a rung at a time, from the arm
  // alone's best (its approach kept), the first rung that lands kept
  const lands = (a) => a.err <= reached && !a.hard.length;
  for (let r = 1; r <= rungs && !lands(best); r++) {
    const a = reachTarget(R, body, S, { ...target, approach: best.frame.asked }, { seed: best.x, n0: nb, rungs: r });
    tried[`${best.family}+${RUNGS[r]}`] = a.cost;
    if (lands(a) || a.cost < best.cost) best = { ...a, family: best.family };
  }
  return { ...best, tried };
}

const ARM_KEYS = (S) => [`sh${S}`, `elbow${S}`, `wrist${S}`, `fingers${S}`];
/**
 * A STANCE to strike from, for side S's arm: { body (the stance held, both arms' channels taken off, the other arm put
 * back in its own words: a solve adds the elbows-down roll once, as the clip player does), arm (side S's arm as the
 * stance holds it, in its own words), key (the stance's last key: its feet, sink and heels, for a clip that keeps
 * them), nodes (the stance posed, the lite rig) }.
 */
export function stanceBody(R, stance, S) {
  const st = heroStance(stance, R), key = st.keys[st.keys.length - 1], O = S === 'R' ? 'L' : 'R';
  const body = Object.fromEntries(Object.entries(st.hold).filter(([k]) => ![...ARM_KEYS('L'), ...ARM_KEYS('R')].includes(k)));
  for (const k of ARM_KEYS(O)) if (key.pose[k] !== undefined) body[k] = key.pose[k];
  const arm = Object.fromEntries(ARM_KEYS(S).filter((k) => key.pose[k] !== undefined).map((k) => [k, key.pose[k]]));
  return { body, arm, key, nodes: rigNodesAt(liteOf(R), elbowsDown(R, { ...body, ...arm })).nodes };
}

/** the body's channels the ladder moves (a strike's pose carries those it moved) */
const BODY_KEYS = ['shoulders', 'spine', 'facing', 'shift', 'sink', 'feet'];
/** a rotation (a matrix) of `deg` about the unit k, applied to a vector */
const turnV = (v, k, deg) => mv(rotM(k, deg), v);

/**
 * A strike's DRIVE: where the striking surface travels in its last stretch, `n + 1` points from the start to the contact,
 * each with the hand's frame there ({ at, m, approach }). A straight drives `stroke` metres along its approach. A hook
 * and an uppercut drive along an ARC that meets the target tangent to the approach (the force line holds at contact),
 * curving about the body's axis the family turns about (a hook about the thorax's up through the shoulder, an uppercut
 * about its lateral), its radius the target's distance off that axis (held to 0.2 … 0.6 m), its length `stroke` × 1.6
 * (at most 100°); the hand turns with the path, so the fist leads along it.
 */
export function drivePath(frame, family, sh, Tf, { stroke = 0.15, n = 3 } = {}) {
  const a = frame.approach, at = frame.at;
  if (family === 'straight' || !APPROACHES[family]) return Array.from({ length: n + 1 }, (_, i) => ({ at: sub(at, mul(a, (stroke * (n - i)) / n)), m: frame.m, approach: a }));
  const axis = family === 'hook' ? Tf.up : Tf.right, rel = sub(at, sh), C = add(sh, mul(axis, dot(rel, axis)));
  let toC = sub(C, at); toC = sub(toC, mul(a, dot(toC, a)));
  if (len(toC) < 1e-6) return drivePath(frame, 'straight', sh, Tf, { stroke, n });
  const nIn = unit(toC), r = Math.max(0.2, Math.min(0.6, len(toC))), O = add(at, mul(nIn, r)), u = mul(nIn, -1);
  const k = unit(cross(a, u)), phi = Math.min(100, ((stroke * 1.6) / r) * DEG);
  return Array.from({ length: n + 1 }, (_, i) => {
    const th = (phi * (n - i)) / n, c = Math.cos(th / DEG), s2 = Math.sin(th / DEG);
    return { at: add(O, mul(sub(mul(u, c), mul(a, s2)), r)), m: mm(rotM(k, -th), frame.m), approach: turnV(a, k, -th) };
  });
}

/**
 * THE TARGET DRILL: `count` targets drawn by `seed` (mulberry32) around the striking shoulder from a ready stance, each
 * at a share of the arm's reach to its surface (`bands`; past 1 the body must join in), from `az` degrees across the
 * body (−) to outside it (+) and `el` below to above the shoulder's level, in the thorax's frame; each struck with its
 * cheapest approach and as little of the LADDER as lands it (strikeTarget), driven along its DRIVE (drivePath: a
 * straight line, or an arc for a hook or an uppercut; `samples` solves back from the contact along it, each seeded by
 * the next, the body moving through them on the rungs the contact needed, a stepped foot planted), then recovered to the
 * stance, and on to the next (`aimed`: the targets named, { az, el, share | at, surface?, families? } each, in place of the
 * seeded draws; `follow` metres the hand carries on past each target along its approach, a punch's follow-through, where
 * a drill holds on the target; `step` the least seconds a move between two keys takes, 0.04 a drill's). The body moves into
 * the contact's (its girdle, trunk, hips, weight, sink) as the hand leaves the guard; a STEP lifts the foot off the
 * floor between (and again on the way home). The time of each move is its largest joint turn over the servo's speed
 * (SERVO_SPEEDS: a strike at `pace` of the speed the hero's own attacks reach, a recovery at half that), an eased move
 * taking 1.5 × its mean. → { targets: [{ at, surface, family, rung, ladder, step, approach, aim, share, az, el, t (s,
 * contact), path }], clip, keys, seconds, checks: { targets: [{ contact (m), approach (°), past (the servos past a hard
 * stop at contact), path (m: the surface off its drive), balance (m: the centre of mass inside the feet at contact) }],
 * worst } }. The checks read the CLIP as played (keyedClip), not the solve.
 */
export function targetDrill(R, { seed = 1, count = 6, side: S = 'R', stance = 'guard', surfaces = ['knuckles'], bands = [0.6, 0.95], az = [-45, 80], el = [-35, 45], stroke = 0.15, samples = 3, pace = 0.5, families, rungs, register = 'realistic', aimed = null, follow = 0, step = 0.04 } = {}) {
  const sb = stanceBody(R, stance, S), n0 = sb.nodes, Tf = thoraxFrame(n0), sh = n0[`shoulder${S}`], F = handFeatures(R, S);
  const lat = S === 'R' ? Tf.right : mul(Tf.right, -1);
  const l12 = dist(R.joints[`shoulder${S}`], R.joints[`elbow${S}`]) + dist(R.joints[`elbow${S}`], R.joints[`wrist${S}`]);
  const rnd = mulberry32(seed), rad = (d) => d / DEG;
  const hits = [];
  // (AIMED targets, `aimed: [{ az, el, share, surface?, families? }]`, in place of the seeded draws: a move's own target,
  // hero-box.js; the seeded drill draws as it always has)
  for (let i = 0; i < (aimed ? aimed.length : count); i++) {
    const A = aimed ? aimed[i] : null;
    // (an aimed target is a point, `at` in the rig's frame, or a direction off the shoulder; its az, el and share read off
    // it for the record. A seeded one draws its direction, its share and then its surface, in that order)
    let a, e, share, at, surface, reachS;
    if (A?.at) {
      surface = A.surface ?? 'knuckles'; reachS = l12 + dist(F.surfaces[surface].p, F.wrist); at = A.at;
      const d = sub(at, sh), r = len(d); share = r / reachS; e = Math.asin(dot(d, Tf.up) / r) * DEG; a = Math.atan2(dot(d, lat), dot(d, Tf.fwd)) * DEG;
    } else {
      a = A ? A.az : az[0] + (az[1] - az[0]) * rnd(); e = A ? A.el : el[0] + (el[1] - el[0]) * rnd(); share = A ? A.share : bands[0] + (bands[1] - bands[0]) * rnd();
      surface = A ? A.surface ?? 'knuckles' : surfaces[Math.floor(rnd() * surfaces.length) % surfaces.length];
      reachS = l12 + dist(F.surfaces[surface].p, F.wrist);
      const v = add(mul(add(mul(lat, Math.sin(rad(a))), mul(Tf.fwd, Math.cos(rad(a)))), Math.cos(rad(e))), mul(Tf.up, Math.sin(rad(e))));
      at = add(sh, mul(v, share * reachS));
    }
    const hit = strikeTarget(R, sb.body, S, { at, surface }, { families: A?.families ?? families, n0, ...(rungs !== undefined ? { rungs } : {}) });
    // THE DRIVE, back from the contact along its path: the body moves through it on the rungs the contact needed, and
    // the girdle and the trunk at least (the kinetic chain: the trunk and the weight still arriving as the hand does),
    // the stepped foot planted where it stepped; each sample seeded by the one after it
    const chOf = (r) => Object.fromEntries(BODY_KEYS.filter((k) => r.pose[k] !== undefined).map((k) => [k, r.pose[k]]));
    const bodyCh = chOf(hit), stepFeet = hit.step ? { feet: bodyCh.feet } : {};
    const nb = Object.keys(bodyCh).length ? rigNodesAt(liteOf(R), elbowsDown(R, { ...sb.body, ...bodyCh, ...sb.arm })).nodes : n0;
    const path = drivePath(hit.frame, hit.family, nb[`shoulder${S}`], thoraxFrame(nb), { stroke, n: samples });
    // (the drive may always turn the girdle and the trunk: a hook's or an uppercut's path starts where the arm alone,
    // its hand locked to the path, cannot be; the body coils into it and uncoils at the contact)
    const dr = Math.max(2, Math.min(hit.rungs ?? 0, 3)), nv = BODY_VARS.filter((v) => v.rung <= dr).length;
    const drive = [hit]; let x = [...hit.x, ...Array(Math.max(0, 7 + nv - hit.x.length)).fill(0)].slice(0, 7 + nv);
    for (let k = samples - 1; k >= 0; k--) {
      const q = path[k], r = reachTarget(R, { ...sb.body, ...stepFeet }, S, { at: q.at, surface }, { seed: x, n0: nb, lock: { ...hit.frame, m: q.m, approach: q.approach }, rungs: dr }); x = r.x; drive.unshift(r);
    }
    hits.push({ at, surface, share, az: a, el: e, hit, drive, bodyCh, path, chOf, stepFeet, nb });
  }
  // the keys, timed by the servos; the body's channels (the stance's, or a strike's) and its feet carried in the key
  const sp = SERVO_SPEEDS[register], dig = (w) => (typeof w === 'string' ? { ...HAND_POSES[w] } : w);
  const ARM = ARM_KEYS(S);
  const armOf = (r) => ({ ...Object.fromEntries(ARM.filter((k) => r.pose[k] !== undefined).map((k) => [k, r.pose[k]])), [`fingers${S}`]: dig(r.pose[`fingers${S}`]) });
  const guardArm = { ...sb.arm, [`fingers${S}`]: dig(sb.arm[`fingers${S}`] ?? 'fist') };
  const xOf = (arm) => [arm[`sh${S}`]?.pitch ?? 0, arm[`sh${S}`]?.yaw ?? 0, arm[`elbow${S}`] ?? 0, arm[`sh${S}`]?.roll ?? 0];
  const moveTime = (a, b, k) => { const xa = xOf(a), xb = xOf(b); const turn = Math.max(Math.abs(xa[0] - xb[0]), Math.abs(xa[1] - xb[1]), Math.abs(xa[3] - xb[3])) / sp.shoulderSwing, bend = Math.abs(xa[2] - xb[2]) / sp.elbow; return Math.max(step, (1.5 * Math.max(turn, bend)) / k); };
  const { t: _t, pose: base, ...feet0 } = sb.key, legs = R.legs, rest = R.joints;
  // a stepped foot as the key's own channels (hero-stance's: its toe base out and ahead of its rest place)
  const footKeys = (to) => (to ? { [`out${S}`]: r4((to[0] - rest[legs[S].toeBase][0]) * Math.sign(rest[legs[S].hip][0])), [`foot${S}`]: r4(to[1] - rest[legs[S].toeBase][1]) } : {});
  const keyOf = (arm, bodyCh = {}, extra = {}) => {
    const { sink, feet: ft, ...ch } = bodyCh;
    return { ...feet0, ...(sink !== undefined ? { sink } : {}), ...footKeys(ft?.[S] && ft[S] !== sb.body.feet?.[S] ? ft[S] : null), ...extra, pose: { ...base, ...ch, ...arm } };
  };
  const seq = [{ key: keyOf(guardArm), arm: guardArm, time: 0 }]; let time = 0; const marks = [];
  for (const h of hits) {
    const stepped = !!h.hit.step;
    for (let k = 0; k < h.drive.length; k++) {
      const arm = armOf(h.drive[k]), prev = seq[seq.length - 1], dt = moveTime(prev.arm, arm, k === 0 ? pace * 0.6 : pace);
      const ch = { ...h.chOf(h.drive[k]), ...h.stepFeet };
      // (a step: the foot off the floor half way between the guard and the drive's start)
      if (k === 0 && stepped) { const half = Math.max(dt, 0.12) / 2; seq.push({ key: keyOf(arm, ch, { [`ground${S}`]: 0 }), arm, time: time + half, mid: true }); time += Math.max(dt, 0.12); }
      else time += dt;
      seq.push({ key: keyOf(arm, ch, stepped ? { [`ground${S}`]: 1 } : {}), arm, time });
    }
    marks.push({ contact: time, chamber: seq[seq.length - h.drive.length].time });
    if (follow > 0) {
      // THE FOLLOW-THROUGH (`follow` metres past the target along its approach, a punch's): the hand carried on through the
      // contact at the drive's pace, so it meets the target at speed (held there, the curve through the keys braked it
      // to a stop on the target, as a drill's touch)
      const fr = h.hit.frame, past = add(fr.at, mul(fr.approach, follow));
      const r = reachTarget(R, { ...sb.body, ...h.stepFeet }, S, { at: past, surface: h.surface }, { seed: h.hit.x, n0: h.nb, lock: { ...fr, at: past }, rungs: Math.max(2, Math.min(h.hit.rungs ?? 0, 3)) });
      const arm = armOf(r), dt = moveTime(seq[seq.length - 1].arm, arm, pace);
      time += dt; seq.push({ key: keyOf(arm, { ...h.chOf(r), ...h.stepFeet }, stepped ? { [`ground${S}`]: 1 } : {}), arm, time });
    } else { time += 0.06; seq.push({ key: keyOf(armOf(h.drive[h.drive.length - 1]), h.bodyCh, stepped ? { [`ground${S}`]: 1 } : {}), arm: armOf(h.drive[h.drive.length - 1]), time }); }
    const back = Math.max(moveTime(seq[seq.length - 1].arm, guardArm, pace * 0.5), stepped ? 0.2 : 0);
    if (stepped) seq.push({ key: keyOf(guardArm, {}, { [`ground${S}`]: 0 }), arm: guardArm, time: time + back / 2, mid: true });
    time += back; seq.push({ key: keyOf(guardArm, {}, stepped ? { [`ground${S}`]: 1 } : {}), arm: guardArm, time });
  }
  const seconds = time;
  const keys = seq.map((q) => ({ ...q.key, t: q.time / seconds }));
  const clip = keyedClip({ seconds, keys }, R);
  // the checks, on the clip as played
  const checks = hits.map((h, i) => {
    const tc = marks[i].contact / seconds, tk = marks[i].chamber / seconds, fr = h.hit.frame, pc = clip.fn(tc);
    const c = contactOf(R, pc, S, fr, { played: true });
    const rd = servoRead(R, pc)[S];
    const past = [['shoulder.swing', rd.shoulder.swing], ['shoulder.twist', rd.shoulder.twist], ['elbow', rd.elbow], ...Object.entries(rd.wrist).map(([k, v]) => [`wrist.${k}`, v])].filter(([, v]) => v && !v.inRange).map(([k, v]) => `${k} ${v.value}`);
    // the surface off its drive: the nearest the played point comes to the drive's polyline, at eight moments
    const segD = (p, A, B) => { const ab = sub(B, A), t = Math.max(0, Math.min(1, dot(sub(p, A), ab) / (dot(ab, ab) || 1))); return dist(p, add(A, mul(ab, t))); };
    let off = 0;
    for (let j = 1; j < 8; j++) { const p = contactOf(R, clip.fn(tk + ((tc - tk) * j) / 8), S, fr, { played: true }).point; let m = Infinity; for (let s2 = 0; s2 < h.path.length - 1; s2++) m = Math.min(m, segD(p, h.path[s2].at, h.path[s2 + 1].at)); off = Math.max(off, m); }
    const n = rigNodesAt(R, pc).nodes, fpts = Object.values(legs).flatMap((L) => [L.toeBase, L.toeTip, L.hock].map((j) => n[j]).filter(Boolean).map((p) => [p[0], p[1]]));
    return { contact: c.err, approach: c.approachErr, past, path: r4(off), balance: r4(margin(hull(fpts), comOf(n))) };
  });
  const worst = { contact: Math.max(...checks.map((c) => c.contact)), approach: Math.max(...checks.map((c) => c.approach)), path: Math.max(...checks.map((c) => c.path)), past: checks.reduce((a, c) => a + c.past.length, 0), balance: Math.min(...checks.map((c) => c.balance)) };
  const targets = hits.map((h, i) => ({ at: h.at.map(r4), surface: h.surface, family: h.hit.family, rung: h.hit.rung, ladder: h.hit.ladder, step: h.hit.step ?? null, approach: h.hit.frame.approach.map(r4), aim: h.hit.frame.aim, share: r4(h.share), az: r1(h.az), el: r1(h.el), t: r4(marks[i].contact), chamber: r4(marks[i].chamber), path: h.path.map((q) => q.at.map(r4)), reached: h.hit.err <= 0.005 && !h.hit.hard.length, driveErr: r4(Math.max(...h.drive.map((r) => r.err))) }));
  return { seed, side: S, stance, targets, clip, keys, seconds: r4(seconds), checks: { targets: checks, worst } };
}
