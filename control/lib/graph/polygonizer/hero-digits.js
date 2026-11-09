/**
 * hero-digits — OCTOPUS BOXER, the manual manipulator's hand: the palm a box, each digit its own small reacher locked to
 * its own joints, a grasp or a shape made of ROLES given to the digits, not of angle tables. Everything here is in the
 * hand's REST frame (the palm held still: station-loft-rig.js `digitPose`, the rig's own turns without the body, ~20 µs
 * a digit), so a hand is solved once and carried by whatever the arm does.
 *
 *   • THE BOX (handBox): the hand's frame (A along, wrist → middle knuckle; V across, toward the thumb; N out of the
 *     palm's front: hero-servo.js handFrame) at the rest wrist, the palm's length and breadth, its front's depth, and its
 *     places: the palm's centre, its heel, the knuckle line, each finger's knuckle.
 *   • A DIGIT (digitGeometry): its joints, each phalanx a capsule (radii from hero-hand.js HAND_FORM, scaled to the
 *     rig's own bones), its pad (the distal phalanx's palm side, where a pinch meets) and its tip, each with its normal.
 *   • REACH (reachDigit): a digit's pad or tip to a point, facing a direction if asked, by Levenberg–Marquardt over its
 *     own controls (a finger's spread, knuckle and middle joint, the last at ⅔ unless freed; the thumb's two root turns,
 *     knuckle and last joint), the hand's servos (hero-servo.js HAND_SERVOS) a cost: a degree past a hard stop weighs as
 *     a millimetre off the point, past ease a twentieth of that; a joint's own preference (`prefer`) a fiftieth.
 *   • CLOSING (closeOn): a digit closed onto a PRIMITIVE (a cylinder, a sphere, a line, a plane) the way a hand closes:
 *     the knuckle turns until its phalanx (or anything past it) touches, then the middle joint, then the last, each to
 *     a touch or its servo's stop. So a haft is held round its own size.
 *   • ROLES and GRASPS (grasp): `power` wraps the fingers round a cylinder or a sphere laid in the palm and closes the
 *     thumb over them; `pinch` meets the thumb's and the index's pads on an object's opposite sides; `tripod` adds the
 *     middle. The thumb opposes, the index triggers or points, the middle, the ring and the little wrap and support, the
 *     palm braces.
 *   • SHAPES (HAND_SHAPES, handShape): a hand shape is a composition of per-digit goals — a point to reach, a primitive to
 *     close on, or a joint SET (absolute angles, as handRead reads them) — solved in order (a goal may name another
 *     digit's posed joint). The martial words are the words, plain aliases resolve to them. The hand words (HAND_POSES)
 *     are POLES: each written as a composition the solver must land near (a test holds it).
 * The output is the rig's own `fingers<S>` value (the wider hand's objects), so a shape plays and exports as any hand
 * word does. Pure and deterministic.
 */
import { digitPose, DIP_OF_PIP, HAND_POSES, validateRig, handValue, wideValue } from './station-loft-rig.js';
import { strHash } from '../city/plan/dice.js';
import { HAND_SHAPE_WORDS } from './hand-shape-words.js';
import { digitRead, handFrame, HAND_SERVOS } from './hero-servo.js';
import { HAND_FORM } from './hero-hand.js';
import { lm } from './hero-grip.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const DEG = 180 / Math.PI;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * DEG;
const r1 = (x) => Math.round(x * 10) / 10 + 0, r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const past = (v, [lo, hi]) => Math.max(0, lo - v, v - hi);

export const FINGERS = Object.freeze(['index', 'middle', 'ring', 'little']);
export const DIGITS = Object.freeze(['thumb', ...FINGERS]);

// ─── the box and the digits' geometry ───────────────────────────────────────────────────────────────────────────────
const boxCache = new WeakMap();
/**
 * The hand's box for side S: { S, wrist, A, V, N, palmLen, breadth, front (the palm front's depth off its axis, m),
 * at(u, v, w) (a point: metres along, across, out of the front), places: { centre, heel, knuckles, <finger>Knuckle },
 * scale (the rig's bones over HAND_FORM's), form (HAND_FORM's body) }. `female` picks HAND_FORM's female radii.
 */
export function handBox(R, S, { female = false } = {}) {
  const memo = boxCache.get(R) || {}, key = `${S}${female ? 'f' : 'm'}`; if (memo[key]) return memo[key];
  const F = handFrame(R, S), J = R.joints, at0 = (j) => J[`${j}${S}`], wrist = at0('wrist');
  const form = HAND_FORM[female ? 'female' : 'male'];
  const palmLen = dot(sub(at0('middleMcp'), wrist), F.A), breadth = Math.abs(dot(sub(at0('indexMcp'), at0('littleMcp')), F.V));
  const scale = dist(at0('middleMcp'), at0('middlePip')) / form.fingers.middle.len[0];
  const front = Math.max(...form.palm.rings.map((r) => r[3])) * scale;
  const at = (u, v, w) => add(wrist, add(add(mul(F.A, u), mul(F.V, v)), mul(F.N, w)));
  const places = { centre: at(0.55 * palmLen, 0, front), heel: at(0.15 * palmLen, -0.1 * breadth, front), knuckles: at(palmLen, 0, 0) };
  for (const d of FINGERS) places[`${d}Knuckle`] = [...at0(`${d}Mcp`)];
  const box = { S, wrist: [...wrist], A: F.A, V: F.V, N: F.N, palmLen, breadth, front, at, places, scale, form };
  memo[key] = box; boxCache.set(R, memo);
  return box;
}

/** a digit's radii (m) at its root, its two joints and its pad, scaled to the rig's bones */
function radiiOf(box, d) { const g = d === 'thumb' ? box.form.thumb : box.form.fingers[d]; return g.r.map((r) => r * box.scale); }

/**
 * A digit posed (in the hand's rest frame): { value, chain (root, two joints, tip), capsules ([[a, b, r]]: each phalanx),
 * pad: { at, n } (the distal phalanx's palm side, where a pinch meets), tip: { at, n } (its end), axes }.
 */
export function digitGeometry(R, box, d, value) {
  const P = digitPose(R, box.S, d, value), c = P.chain.map((j) => P.joints[j]), r = radiiOf(box, d);
  const capsules = [[c[0], c[1], (r[0] + r[1]) / 2], [c[1], c[2], (r[1] + r[2]) / 2], [c[2], c[3], (r[2] + r[3]) / 2]];
  const s = unit(sub(c[3], c[2])), close = unit(cross(P.axes[2], sub(c[3], c[2])));   // the way the tip moves closing: the pad's side
  const padAt = add(add(c[2], mul(sub(c[3], c[2]), 0.72)), mul(close, r[3]));
  return { value, chain: c, joints: P.joints, capsules, pad: { at: padAt, n: close }, tip: { at: add(c[3], mul(s, r[3] * 0.6)), n: s }, axes: P.axes };
}

// ─── primitives ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A primitive's signed distance at a point (m, − inside): { cylinder: { c, a, r } (a point on its axis, the axis, the
 * radius; infinite along it), sphere: { c, r }, line: { c, a, r } (a thin cylinder: an edge, a rail), plane: { c, n },
 * box: { c, axes, half } (the palm itself: palmBox), segment: { a, b, r } (a finite rod) }.
 */
export function primDistance(prim, p) {
  if (prim.kind === 'sphere') return dist(p, prim.c) - prim.r;
  if (prim.kind === 'box') {
    // a box: its centre, its three axes (units) and half-sizes along them
    const q = prim.axes.map((ax, i) => Math.abs(dot(sub(p, prim.c), ax)) - prim.half[i]);
    return len(q.map((v) => Math.max(v, 0))) + Math.min(Math.max(q[0], q[1], q[2]), 0);
  }
  if (prim.kind === 'plane') return dot(sub(p, prim.c), unit(prim.n));
  if (prim.kind === 'segment') { const ab = sub(prim.b, prim.a), t = Math.max(0, Math.min(1, dot(sub(p, prim.a), ab) / (dot(ab, ab) || 1))); return dist(p, add(prim.a, mul(ab, t))) - (prim.r ?? 0); }
  const a = unit(prim.a), v = sub(p, prim.c);
  return len(sub(v, mul(a, dot(v, a)))) - (prim.r ?? 0);
}
/** a capsule's clearance from a primitive (m, − pressed in): the nearest of nine points along its axis, less its radius;
 * `from` skips its root's share (a proximal phalanx is joined to the palm at its knuckle: only its free length can touch) */
const capsuleGap = (prim, [a, b, r], from = 0) => { let m = Infinity; for (let i = 0; i <= 8; i++) { const t = from + ((1 - from) * i) / 8; m = Math.min(m, primDistance(prim, add(a, mul(sub(b, a), t)))); } return m - r; };
/** the nearest two segments come (m): p1 → q1 against p2 → q2 */
export function segSegDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s2, t;
  if (a <= 1e-12 && e <= 1e-12) return dist(p1, p2);
  if (a <= 1e-12) { s2 = 0; t = Math.max(0, Math.min(1, f / e)); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s2 = Math.max(0, Math.min(1, -c / a)); }
    else { const b = dot(d1, d2), den = a * e - b * b; s2 = den > 1e-12 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0; t = (b * s2 + f) / e; if (t < 0) { t = 0; s2 = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s2 = Math.max(0, Math.min(1, (b - c) / a)); } }
  }
  return dist(add(p1, mul(d1, s2)), add(p2, mul(d2, t)));
}
/** two capsules' clearance (m, − pressed in) */
export const capsuleClear = ([a, b, r], [c, d, q]) => segSegDist(a, b, c, d) - r - q;

/** the PALM as a primitive: its box, from the wrist to just short of digit `d`'s own knuckle (the knuckles lie on an arc:
 * a finger's own root is not the palm it closes onto), across its breadth, from its back to its front */
export function palmBox(box, d = 'middle') {
  const k = box.places[`${d}Knuckle`] ?? box.places.knuckles, u0 = 0.05 * box.palmLen, u1 = dot(sub(k, box.wrist), box.A) - 0.012 * box.scale;
  return { kind: 'box', c: box.at((u0 + u1) / 2, 0, 0), axes: [box.A, box.V, box.N], half: [(u1 - u0) / 2, box.breadth * 0.55, box.front] };
}
/** where a primitive's surface lies nearest a point, and its outward normal there */
export function primSurface(prim, p) {
  if (prim.kind === 'plane') { const n = unit(prim.n); return { at: sub(p, mul(n, dot(sub(p, prim.c), n))), n }; }
  if (prim.kind === 'sphere') { const n = unit(sub(p, prim.c)); return { at: add(prim.c, mul(n, prim.r)), n }; }
  if (prim.kind === 'segment') { const ab = sub(prim.b, prim.a), t = Math.max(0, Math.min(1, dot(sub(p, prim.a), ab) / (dot(ab, ab) || 1))), q = add(prim.a, mul(ab, t)), n = unit(sub(p, q)); return { at: add(q, mul(n, prim.r ?? 0)), n }; }
  const a = unit(prim.a), v = sub(p, prim.c), radial = unit(sub(v, mul(a, dot(v, a))));
  return { at: add(add(prim.c, mul(a, dot(v, a))), mul(radial, prim.r ?? 0)), n: radial };
}

// ─── reaching a point ───────────────────────────────────────────────────────────────────────────────────────────────
/** a digit's controls as the rig's value, and back */
const valueOf = (d, x, coupled) => (d === 'thumb' ? { cmc: [x[0], x[1]], mcp: x[2], ip: x[3] } : { spread: x[0], mcp: x[1], pip: x[2], ...(coupled ? {} : { dip: x[3] }) });
const BOUNDS = Object.freeze({ thumb: [[-40, -60, -40, -40], [100, 70, 80, 110]], finger: [[-30, -60, -30, -30], [40, 120, 130, 110]] });
/** the weights (see the header) */
const WD = Object.freeze({ point: 1000, hard: 1, ease: 0.05, prefer: 0.02, face: 0.05, step: 0.005, avoid: 1000 });

/** the servo residuals of a digit's reading (+ its preferences: absolute angles as handRead reads them) */
function servoResid(rd, prefer = {}) {
  const out = [];
  for (const [k, v] of Object.entries(rd)) { out.push(WD.hard * past(v.value, v.range), WD.ease * past(v.value, v.ease)); if (prefer[k] !== undefined) out.push(WD.prefer * (v.value - prefer[k])); }
  return out;
}

/**
 * A digit's pad or tip to a point (the hand's rest frame): `goal` { at, contact: 'pad' | 'tip', facing? (the way the
 * pad or the tip should face; `faceWeight` a degree's weight, 0.05), prefer? ({ <joint>: absolute degrees }), avoid? (capsules
 * its phalanges must not press into past a millimetre: a millimetre in weighs as a millimetre off the point) }, `coupled` (a finger's last joint at ⅔ of its
 * middle: true), `seed` (a value to start from). → { value, err (m), facing (degrees off, if asked), read (its servos),
 * past (joints past a hard stop), cost, geometry }.
 */
export function reachDigit(R, box, d, goal, { coupled = true, seed = null } = {}) {
  const thumb = d === 'thumb', n = thumb || !coupled ? 4 : 3;
  const [lo0, hi0] = BOUNDS[thumb ? 'thumb' : 'finger'], lo = lo0.slice(0, n), hi = hi0.slice(0, n);
  const contact = goal.contact ?? 'pad';
  const resid = (x) => {
    const G = digitGeometry(R, box, d, valueOf(d, x, coupled)), c = G[contact];
    const out = [...mul(sub(c.at, goal.at), WD.point)];
    if (goal.facing) out.push((goal.faceWeight ?? WD.face) * angle(c.n, goal.facing));
    // the other digits' phalanges (and anything else in `avoid`) not pressed into past a millimetre of skin
    if (goal.avoid) for (const o of goal.avoid) for (const k of G.capsules) out.push(WD.avoid * Math.max(0, -0.001 - capsuleClear(k, o)));
    out.push(...servoResid(digitRead(R, box.S, d, G.joints), goal.prefer));
    if (seed) for (let i = 0; i < n; i++) out.push(WD.step * (x[i] - (seed[i] ?? 0)));
    return out;
  };
  const seeds = seed ? [seed.slice(0, n)] : thumb ? [[20, 0, 10, 10], [40, 20, 20, 20], [10, -10, 0, 30]] : [[0, 20, 30, 20].slice(0, n), [0, 50, 60, 40].slice(0, n), [0, 0, 0, 0].slice(0, n)];
  let best = null;
  for (const s0 of seeds) { const r = lm(resid, s0, lo, hi, 40); if (!best || r.c < best.c) best = r; }
  const x = best.x.map(r1), value = valueOf(d, x, coupled), G = digitGeometry(R, box, d, value);
  const rd = digitRead(R, box.S, d, G.joints);
  return { value, x, err: r4(dist(G[contact].at, goal.at)), ...(goal.facing ? { facing: r1(angle(G[contact].n, goal.facing)) } : {}), read: rd, past: Object.entries(rd).filter(([, v]) => !v.inRange).map(([k, v]) => `${k} ${v.value}`), cost: r4(best.c), geometry: G };
}

// ─── closing onto a primitive ───────────────────────────────────────────────────────────────────────────────────────
/** a digit's joints in closing order and how each sits in its value */
const CLOSE_ORDER = Object.freeze({ thumb: ['across', 'mcp', 'ip'], finger: ['mcp', 'pip', 'dip'] });
const setJoint = (d, v, k, a) => (d === 'thumb' ? (k === 'across' ? { ...v, cmc: [a, v.cmc?.[1] ?? 0] } : { ...v, [k]: a }) : { ...v, [k]: a });
const jointOf = (d, v, k) => (d === 'thumb' ? (k === 'across' ? v.cmc?.[0] ?? 0 : v[k] ?? 0) : v[k] ?? 0);
/** the servo's stop of joint k as a value of the channel (the hard range's top, less the rest's reading) */
function stopOf(R, box, d, v, k) {
  const read = (val) => { const G = digitGeometry(R, box, d, val); return digitRead(R, box.S, d, G.joints); };
  const key = d === 'thumb' && k === 'across' ? 'radial' : k;
  const rd = read(v)[key]; if (!rd) return 120;
  return jointOf(d, v, k) + (rd.range[1] - 2 - rd.value);   // (two degrees short of the stop: a hand closes to it, not past)
}

/**
 * A digit CLOSED ONTO a primitive from `start` (a value; default straight), joint by joint in the hand's closing order,
 * each until anything past it touches (within `skin` metres) or it reaches its servo's stop, found by bisection to a
 * fifth of a degree. → { value, gaps (each phalanx's clearance, m: − pressed in), touching (the phalanges within
 * `skin`), geometry }.
 */
export function closeOn(R, box, d, prim, { start = null, skin = 0.001, order = null } = {}) {
  const thumb = d === 'thumb', joints = order ?? CLOSE_ORDER[thumb ? 'thumb' : 'finger'];
  let v = start ? { ...start } : straightOf(R, box, d);
  // (the last joint closes on its own, not coupled: name it from the start)
  if (!thumb && v.dip === undefined) v.dip = (v.pip ?? 0) * DIP_OF_PIP;
  const gapsOf = (val) => digitGeometry(R, box, d, val).capsules.map((c, i) => capsuleGap(prim, c, i ? 0 : 0.4));
  joints.forEach((k, i) => {
    const from = jointOf(d, v, k), stop = stopOf(R, box, d, v, k), beyond = (val) => Math.min(...gapsOf(val).slice(i)) - skin;
    if (beyond(v) <= 0 || stop <= from) return;
    // march to the first touch, then bisect
    let a = from, b = null;
    for (let t = from + 4; t <= stop + 1e-9; t += 4) { if (beyond(setJoint(d, v, k, t)) <= 0) { b = t; break; } a = t; }
    if (b === null) { v = setJoint(d, v, k, beyond(setJoint(d, v, k, stop)) <= 0 ? a : stop); if (beyond(setJoint(d, v, k, stop)) > 0) return; b = stop; }
    while (b - a > 0.2) { const m = (a + b) / 2; if (beyond(setJoint(d, v, k, m)) <= 0) b = m; else a = m; }
    v = setJoint(d, v, k, r1(a));
  });
  const gaps = gapsOf(v).map(r4);
  return { value: v, gaps, touching: gaps.map((g, i) => (g <= skin * 1.5 ? i : -1)).filter((i) => i >= 0), geometry: digitGeometry(R, box, d, v) };
}

/** the digit straight (every joint 0 as handRead reads it: the rest's own curl undone), as a value */
export function straightOf(R, box, d) {
  const G = digitGeometry(R, box, d, 0), rd = digitRead(R, box.S, d, G.joints);
  return d === 'thumb' ? { cmc: [0, 0], mcp: -rd.mcp.value, ip: -rd.ip.value } : { mcp: -rd.mcp.value, pip: -rd.pip.value, dip: -rd.dip.value };
}
/** a joint SET (absolute angles, as handRead reads them) as the rig's value: each joint by its difference from the rest */
export function setOf(R, box, d, abs) {
  const G = digitGeometry(R, box, d, 0), rd = digitRead(R, box.S, d, G.joints);
  if (d === 'thumb') return { cmc: [abs.across ?? 0, abs.toPalm ?? 0], mcp: abs.mcp !== undefined ? abs.mcp - rd.mcp.value : 0, ip: abs.ip !== undefined ? abs.ip - rd.ip.value : 0 };
  const v = {}; for (const k of ['mcp', 'pip', 'dip', 'spread']) if (abs[k] !== undefined) v[k] = abs[k] - rd[k].value;
  return v;
}

/** the thumb opened out to close from: its root turned back across the palm, its second axis at `toPalm`, its joints
 * straight (an object laid in the palm runs past the thumb's straight line: it closes onto it from outside) */
const thumbOpen = (toPalm = 0) => ({ cmc: [-20, toPalm], mcp: 0, ip: 0 });

// ─── grasps ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A primitive laid in the palm for a POWER grasp: a cylinder `r` metres across its axis lying across the palm (tilted
 * `tilt` degrees, its little-finger end toward the wrist, as a haft lies in a fist) on the palm's front at `at` of the
 * palm's length; a sphere of radius `r` likewise.
 */
export function inPalm(box, kind, r, { at = 0.78, tilt = 15 } = {}) {
  const t = tilt / DEG, axis = unit(add(mul(box.V, Math.cos(t)), mul(box.A, Math.sin(t))));
  const c = box.at(at * box.palmLen, 0, box.front + r);
  return kind === 'sphere' ? { kind: 'sphere', c, r } : { kind: 'cylinder', c, a: axis, r };
}

/**
 * A GRASP: { fingers (the rig's `fingers<S>` value), digits ({ <digit>: closeOn's or reachDigit's result }), kind }.
 *   power   `prim` laid in the palm (inPalm): each finger closed round it from straight, then the thumb closed over it
 *           from across the palm (its root turned toward the palm to meet it)
 *   pinch   the thumb's and the index's pads meeting on the object's opposite sides (its surface nearest each), the
 *           middle, the ring and the little curled out of the way
 *   tripod  the pinch with the middle's pad beside the index's
 */
export function grasp(R, box, kind, prim, { skin = 0.001 } = {}) {
  const digits = {};
  if (kind === 'power') {
    for (const d of FINGERS) digits[d] = closeOn(R, box, d, prim, { skin });
    digits.thumb = closeOn(R, box, 'thumb', prim, { skin, start: thumbOpen(25) });
  } else if (kind === 'pinch' || kind === 'tripod') {
    // the two (three) pads meeting on the object's opposite sides along a PINCH AXIS, the thumb on its radial end; the
    // axis tried between across the palm and out of its front, tilted along the hand, the cheapest kept
    const c = prim.c, side = (dir) => primSurface(prim, add(c, dir));
    let best = null;
    for (const k of [-0.35, 0, 0.35, 0.7, 1.2]) for (const t of [-0.4, 0, 0.4]) {
      const ax = unit(add(add(box.V, mul(box.N, k)), mul(box.A, t))), ti = side(mul(ax, -1)), tt = side(ax);
      const pair = { index: reachDigit(R, box, 'index', { at: ti.at, contact: 'pad', facing: mul(ti.n, -1), faceWeight: 0.2 }), thumb: reachDigit(R, box, 'thumb', { at: tt.at, contact: 'pad', facing: mul(tt.n, -1), faceWeight: 0.2 }) };
      if (kind === 'tripod') { const tm = side(unit(add(mul(ax, -1), mul(box.A, 0.5)))); pair.middle = reachDigit(R, box, 'middle', { at: tm.at, contact: 'pad', facing: mul(tm.n, -1), faceWeight: 0.2 }); }
      const cost = Object.values(pair).reduce((a2, r) => a2 + r.cost, 0);
      if (!best || cost < best.cost) best = { cost, pair, axis: ax };
    }
    Object.assign(digits, best.pair);
    for (const d of FINGERS) if (!digits[d]) digits[d] = { value: { curl: 60 } };
  } else throw new Error(`hero-digits: no grasp '${kind}' (have power, pinch, tripod)`);
  return { kind, fingers: Object.fromEntries(DIGITS.map((d) => [d, digits[d].value])), digits };
}

// ─── shapes ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE HAND SHAPES, each a composition of per-digit GOALS, solved in the order listed (a later goal may aim at an earlier
 * digit's posed joint: `on: [digit, jointIndex, jointIndex, share, side?]`, a point that share of the way along that
 * phalanx on its palm side, or its `back`; a reach keeps clear of the digits already solved):
 *   { set: { <joint>: absolute degrees } }                 the joints held so (as handRead reads them; the thumb's
 *                                                          root as its channel's `across` and `toPalm` turns)
 *   { reach: { at: [u, v, w] | place | on, contact, facing?, prefer? } }   a point in the box (metres along, across, out
 *                                                          of the front; or a place's name), reached by reachDigit
 *   { close: 'palm' | 'fist' | { cylinder | sphere: r } }  closed onto the palm (palmBox), the thumb over the folded
 *                                                          index and middle, or a primitive laid in the palm (inPalm)
 */
const BEAK = (dv) => ({ reach: { at: (b) => b.at(1.45 * b.palmLen, dv * b.breadth, 0.04), contact: 'tip', prefer: { spread: 0 }, avoid: [] } });   // (a beak's tips touch)
export const HAND_SHAPES = Object.freeze({
  craneBeak: { says: 'every fingertip and the thumb’s meeting at one point before the hand (the crane’s beak)', alias: ['beak'],
    goals: { index: BEAK(0.18), middle: BEAK(0.02), ring: BEAK(-0.18), little: BEAK(-0.4), thumb: { reach: { at: (b) => b.at(1.35 * b.palmLen, 0.25 * b.breadth, 0.055), contact: 'tip', avoid: [] } } } },
  tigerClaw: { says: 'the knuckles open, the middle and last joints hooked, the fingers spread (the tiger’s claw)', alias: ['claw'],
    goals: { index: { set: { mcp: 0, pip: 85, dip: 65, spread: 6 } }, middle: { set: { mcp: 0, pip: 85, dip: 65, spread: 2 } }, ring: { set: { mcp: 0, pip: 85, dip: 65, spread: 6 } }, little: { set: { mcp: 0, pip: 85, dip: 65, spread: 12 } }, thumb: { set: { across: 25, toPalm: 0, mcp: 20, ip: 50 } } } },
  swordFingers: { says: 'the index and the middle straight and together, the ring and the little folded, the thumb pressing them (sword fingers)', alias: ['sword'],
    goals: { index: { set: { mcp: 0, pip: 0, dip: 0, spread: -6 } }, middle: { set: { mcp: 0, pip: 0, dip: 0, spread: 2 } }, ring: { close: 'palm' }, little: { close: 'palm' }, thumb: { reach: { on: ['ring', 1, 2, 0.5, 'any'], contact: 'pad' } } } },
  leopardFist: { says: 'the knuckles straight, the middle and last joints folded hard (the leopard’s fist): the flat of the second knuckles strikes', alias: ['leopard'],
    goals: { index: { set: { mcp: 5, pip: 100, dip: 75 } }, middle: { set: { mcp: 5, pip: 100, dip: 75 } }, ring: { set: { mcp: 5, pip: 100, dip: 75 } }, little: { set: { mcp: 5, pip: 100, dip: 75 } }, thumb: { reach: { on: ['index', 1, 2, 0.5, 'any'], contact: 'pad' } } } },
  phoenixEye: { says: 'a fist with the index’s middle knuckle standing proud, the thumb locking it from behind (the phoenix eye)', alias: ['phoenix'],
    goals: { middle: { close: 'palm' }, ring: { close: 'palm' }, little: { close: 'palm' }, index: { set: { mcp: 45, pip: 100, dip: 30 } }, thumb: { reach: { on: ['index', 1, 2, 0.7, 'any'], contact: 'pad' } } } },
  verticalPalm: { says: 'the hand open and flat, the fingers together, the thumb along the index (the vertical palm)', alias: ['palm', 'flat'],
    goals: { index: { set: { mcp: 0, pip: 0, dip: 0, spread: -4 } }, middle: { set: { mcp: 0, pip: 0, dip: 0, spread: 0 } }, ring: { set: { mcp: 0, pip: 0, dip: 0, spread: -4 } }, little: { set: { mcp: 0, pip: 0, dip: 0, spread: -4 } }, thumb: { set: { across: -5, toPalm: -5, mcp: 0, ip: 0 } } } },
  pinch: { says: 'the thumb’s and the index’s tips meeting, the others relaxed', alias: [],
    goals: { index: { reach: { at: (b) => b.at(1.45 * b.palmLen, 0.6 * b.breadth, 0.05), contact: 'tip' } }, thumb: { reach: { on: ['index', 3, 3, 0], contact: 'tip' } } } },
  ok: { says: 'the thumb’s and the index’s pads meeting in a ring, the other three open and fanned (OK)', alias: ['okay'],
    goals: { thumb: { reach: { at: (b) => b.at(1.25 * b.palmLen, 0.55 * b.breadth, 0.05), contact: 'tip' } }, index: { reach: { on: ['thumb', 3, 3, 0], contact: 'pad' } }, middle: { set: { mcp: 10, pip: 10, dip: 5, spread: 4 } }, ring: { set: { mcp: 10, pip: 10, dip: 5, spread: 8 } }, little: { set: { mcp: 10, pip: 10, dip: 5, spread: 14 } } } },
  // ── the hand words as compositions (POLES: the solver must land near the word) ──
  // (the boxer's thumb across the folded middle phalanges is past this thumb's servos: its knuckle and last joint close
  // toward the wrist, not across the fingers; the fist tucks it along the index's side)
  fist: { says: 'the fingers closed onto the palm, the thumb’s pad along the index’s first phalanx, clear of them all', alias: [], pole: 'fist',
    goals: { index: { close: 'palm' }, middle: { close: 'palm' }, ring: { close: 'palm' }, little: { close: 'palm' }, thumb: { reach: { on: ['index', 0, 1, 0.5, 'radial'], contact: 'pad' } } } },
  grip: { says: 'the fingers closed round a haft laid in the palm, the thumb over them', alias: ['haft'], pole: 'grip',
    goals: { index: { close: { cylinder: 0.016 } }, middle: { close: { cylinder: 0.016 } }, ring: { close: { cylinder: 0.016 } }, little: { close: { cylinder: 0.016 } }, thumb: { close: { cylinder: 0.016 } } } },
  point: { says: 'a fist with the index straight, the thumb on the folded middle finger', alias: [], pole: 'point',
    goals: { index: { set: { mcp: 0, pip: 0, dip: 0 } }, middle: { close: 'palm' }, ring: { close: 'palm' }, little: { close: 'palm' }, thumb: { reach: { on: ['middle', 1, 2, 0.5, 'any'], contact: 'pad' } } } },
});
export const HAND_SHAPE_NAMES = Object.freeze(Object.keys(HAND_SHAPES));
const ALIASES = Object.freeze(Object.fromEntries(Object.entries(HAND_SHAPES).flatMap(([k, s]) => s.alias.map((a) => [a, k]))));
/** every word a hand shape answers to AT THE DOOR (hand-shape-words.js: the door's checks read it there, without this
 * module's imports): its name and its plain aliases, but the hand words, whose shapes are their poles */
export { HAND_SHAPE_WORDS };

/**
 * A hand shape solved on a rig: { name, fingers (the rig's `fingers<S>` value), digits ({ <digit>: { value, err?, past,
 * … } }), past (every joint past a hard stop) }. A word, an alias or a shape's own words ({ goals }).
 */
export function handShape(R, S, word, { female = false } = {}) {
  const name = typeof word === 'string' ? (HAND_SHAPES[word] ? word : ALIASES[word]) : 'own';
  const spec = typeof word === 'string' ? HAND_SHAPES[name] : word;
  if (!spec) throw new Error(`hero-digits: no hand shape '${word}' (have ${[...HAND_SHAPE_NAMES, ...Object.keys(ALIASES)].join(', ')})`);
  const box = handBox(R, S, { female }), solved = {};
  const pointOf = (spec2) => {
    if (spec2.on) {
      // a point on another digit's phalanx i → j, `share` along it, on its palm side (`pad`), its `back`, or the hand's
      // `radial` (toward the thumb), `ulnar` or `front` side of it
      const [dg, i, j, share, side = 'pad'] = spec2.on, G = digitGeometry(R, box, dg, solved[dg].value), a = G.chain[i], b = G.chain[Math.max(j, i + 1 > 3 ? 3 : j)];
      const p = add(a, mul(sub(b, a), share)), seg = i < 3 ? sub(G.chain[i + 1], G.chain[i]) : sub(G.chain[3], G.chain[2]);
      const close = unit(cross(G.axes[Math.min(i, 2)], seg)), r = radiiOf(box, dg)[Math.min(3, j)];
      const n = { pad: close, back: mul(close, -1), radial: box.V, ulnar: mul(box.V, -1), front: box.N }[side];
      if (!n) throw new Error(`hero-digits: no side '${side}' (have pad, back, radial, ulnar, front)`);
      return add(p, mul(n, r));
    }
    if (typeof spec2.at === 'function') return spec2.at(box);
    if (typeof spec2.at === 'string') return box.places[spec2.at];
    return box.at(...spec2.at);
  };
  for (const [d, g] of Object.entries(spec.goals)) {
    if (g.set) { const value = setOf(R, box, d, g.set); solved[d] = { value, ...readOf(R, box, d, value) }; continue; }
    if (g.reach) {
      // (the digits already solved are in the way: the reach keeps clear of them)
      const avoid = Object.entries(solved).flatMap(([o, x]) => digitGeometry(R, box, o, x.value).capsules);
      // `side: 'any'` on another digit: every side at three points along the phalanx tried, the cheapest kept
      const tries = g.reach.on?.[4] === 'any' ? ['pad', 'back', 'radial', 'ulnar', 'front'].flatMap((sd) => [0.3, 0.5, 0.7].map((sh) => ({ ...g.reach, on: [...g.reach.on.slice(0, 3), sh, sd] }))) : [g.reach];
      let r = null;
      for (const t of tries) { const q = reachDigit(R, box, d, { avoid, ...t, at: pointOf(t) }); if (!r || q.cost < r.cost) r = { ...q, on: t.on }; }
      solved[d] = { value: r.value, err: r.err, read: r.read, past: r.past, ...(r.on ? { on: r.on } : {}) }; continue;
    }
    if (g.close) {
      let prim;
      if (g.close === 'palm') prim = palmBox(box, d);
      else if (g.close === 'fist' || g.close.over) {
        // the thumb closed over two folded fingers: onto their middle phalanges, a line across them (the index's and the
        // middle's, or `over` names them)
        const [f1, f2] = g.close.over ?? ['index', 'middle'];
        const G1 = digitGeometry(R, box, f1, solved[f1]?.value ?? 70), G2 = digitGeometry(R, box, f2, solved[f2]?.value ?? 70);
        const a = add(G1.chain[1], mul(sub(G1.chain[2], G1.chain[1]), 0.5)), b = add(G2.chain[1], mul(sub(G2.chain[2], G2.chain[1]), 0.5));
        // (a segment from one to the other, a phalanx's width past each: an infinite line would run through the thumb's side)
        const ab = unit(sub(b, a)), r = radiiOf(box, f1)[1];
        prim = { kind: 'segment', a: sub(a, mul(ab, r)), b: add(b, mul(ab, r)), r };
      } else if (g.close.cylinder) prim = inPalm(box, 'cylinder', g.close.cylinder);
      else if (g.close.sphere) prim = inPalm(box, 'sphere', g.close.sphere);
      // (the thumb closes from across the palm in its own plane, its second axis as the goal says: 0 unless `toPalm`)
      const c = closeOn(R, box, d, prim, d === 'thumb' ? { start: thumbOpen(g.toPalm ?? (g.close.cylinder || g.close.sphere ? 25 : 0)) } : {});
      solved[d] = { value: c.value, gaps: c.gaps, ...readOf(R, box, d, c.value) };
    }
  }
  for (const d of DIGITS) if (!solved[d]) solved[d] = { value: 0, ...readOf(R, box, d, 0) };
  return { name, fingers: Object.fromEntries(DIGITS.map((d) => [d, solved[d].value])), digits: solved, past: DIGITS.flatMap((d) => (solved[d].past || []).map((p) => `${d}.${p}`)) };
}
/** a value's reading and what passes a stop */
function readOf(R, box, d, value) {
  const G = digitGeometry(R, box, d, value), rd = digitRead(R, box.S, d, G.joints);
  return { read: rd, past: Object.entries(rd).filter(([, v]) => !v.inRange).map(([k, v]) => `${k} ${v.value}`) };
}

/**
 * A shape against its POLE (a hand word): each digit's tip, the shape's against the word's (m), and the worst.
 */
export function poleError(R, S, shape, word = HAND_SHAPES[shape.name]?.pole, { female = false } = {}) {
  const box = handBox(R, S, { female }), w = HAND_POSES[word];
  const tips = Object.fromEntries(DIGITS.map((d) => [d, r4(dist(digitGeometry(R, box, d, shape.fingers[d]).tip.at, digitGeometry(R, box, d, w[d] ?? 0).tip.at))]));
  return { word, tips, worst: Math.max(...Object.values(tips)) };
}

export { HAND_SERVOS };

// ─── at the door ────────────────────────────────────────────────────────────────────────────────────────────────────
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** a hand value that asks for the wider hand: a shape's word, or a digit given joint by joint */
const asksWide = (v) => (typeof v === 'string' && HAND_SHAPE_WORDS.includes(v)) || (isObj(v) && Object.values(v).some((x) => isObj(x)));
const shapeCache = new Map();
/** a hand shape solved on a rig, by the hand's rest joints and the word (a hero's plan regenerates on every read) */
function shapeOn(R, S, word) {
  const H = R.hands[S], key = `${S}|${word}|${strHash(JSON.stringify(H.joints.map((j) => R.joints[j])))}`;
  if (!shapeCache.has(key)) { if (shapeCache.size > 256) shapeCache.delete(shapeCache.keys().next().value); shapeCache.set(key, handShape(R, S, word).fingers); }
  return shapeCache.get(key);
}
/** any hand value (a word, a shape, a number, an object of digits) in the explicit form, every digit named */
export function explicitHand(R, S, v) {
  const per = typeof v === 'string' && HAND_SHAPE_WORDS.includes(v) ? shapeOn(R, S, v) : handValue(R, `fingers${S}`, v);
  return Object.fromEntries(Object.keys(R.hands[S].digits).map((d) => [d, wideValue(R, S, d, per[d] ?? 0)]));
}
/**
 * THE HAND SHAPES AT THE DOOR: a hero's plan with every clip where a key's `fingersL` / `fingersR` names a hand shape
 * (hero-digits.js HAND_SHAPES, by its word or an alias) or a digit joint by joint written so its keys blend — each key's
 * fingers on that side in the explicit form (station-loft-rig.js wideValue), a shape solved on the plan's own rig. The
 * plan itself, untouched, when no clip asks (every hero minted before).
 */
export function withHandShapes(plan) {
  if (!plan?.rig?.hands || !plan.clips) return plan;
  let R = null; const clips = {}; let changed = false;
  for (const [name, clip] of Object.entries(plan.clips)) {
    const list = Array.isArray(clip) ? clip : clip?.keys;
    const sides = Array.isArray(list) ? ['L', 'R'].filter((S) => list.some((k) => isObj(k) && asksWide(k[`fingers${S}`]))) : [];
    if (!sides.length) { clips[name] = clip; continue; }
    R ??= validateRig(plan.rig); changed = true;
    const keys = list.map((k) => { if (!isObj(k)) return k; const o = { ...k }; for (const S of sides) if (o[`fingers${S}`] !== undefined && R.hands?.[S]) o[`fingers${S}`] = explicitHand(R, S, o[`fingers${S}`]); return o; });
    clips[name] = Array.isArray(clip) ? keys : { ...clip, keys };
  }
  return changed ? { ...plan, clips } : plan;
}
