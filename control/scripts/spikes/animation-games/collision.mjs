/**
 * animation-games — COLLISION: walking or running into a wall or another body, in the four flavors. The approach is the
 * hero library's walk or sprint cycle; the response is chosen from its reactions (hero-react.js `hitHigh`, `stagger`),
 * its knocked-out collapse (hero-rise.js `knockedOut`, down: the body falls back about its feet as a rod under gravity)
 * and pinball's tucked spin (motion.mjs). A flavor decides what the impact DOES: the speed each body leaves with, how
 * much of the change it shows (the powerscale), which rung of the response ladder that reaches, the freeze, the squash.
 *
 *   realistic    momentum: a wall gives back a tenth (bodies are soft), two equal bodies share it (restitution 0.2); the
 *                change each body takes picks its rung: under 1 m/s a flinch, under 3.5 a stagger, past it down
 *   action       momentum off springier bodies (a wall gives back 0.4) shown ×3 (the wall hits back hard, the one charged into is launched; the charger,
 *                driving through, takes its own change unscaled); a walk into anything is a block (it stops, nothing
 *                plays); a freeze on the impact that grows with it
 *   platformer   a walk is a block; a run is a BONK (off a wall: thrown back at a fixed 3 m/s with a 0.5 m hop, whatever
 *                the speed) or a BOOP (off a body: both thrown apart at 3 m/s with a 0.3 m hop); squashed flat on contact
 *   pinball      every surface is a bumper (restitution 1.3): a body leaves faster than it came; past 2 m/s it balls up
 *                and spins as it rolls away; two bodies are a Newton's cradle (the runner all but stops, the other goes)
 *
 * THE LADDER (the same reactions for every flavor, the rung chosen by the change the flavor shows):
 *   block (nothing plays: the body stops and settles into the stand) · bump (`hitHigh` scaled by the change) · stagger
 *   (`stagger`) · down (`knockedOut` collapse) · launch (thrown off the feet, the collapse in the air) · bonk / boop (a
 *   fixed hop back, `hitHigh`) · spin (the tuck, rolling)
 *
 * THE PROMISE: nothing of the body's trunk passes the wall, and two bodies' trunks never pass through each other; the
 * contact is the frame the trunk's front reaches the surface.
 *
 *   COLLIDE_FLAVORS, outcome(flavor, vIn, target) → { a, b? } (each { state, dv, vOut, shown, hop?, lift? })
 *   collide(R, { flavor, gait: 'walk'|'run', target: 'wall'|'unit', fps }) → { frames: [{ k, a, b, held, part }], … }
 *   collisionSignature(R, c) → the machine gate's measures
 *
 * Pure and deterministic. A spike: nothing registers.
 */
import { heroLocomotion } from '../../../lib/graph/polygonizer/hero-motion.js';
import { GAITS } from '../../../lib/graph/polygonizer/hero-gaits.js';
import { keyedClip } from '../../../lib/graph/polygonizer/hero-jump.js';
import { REACTS } from '../../../lib/graph/polygonizer/hero-react.js';
import { heroRise } from '../../../lib/graph/polygonizer/hero-rise.js';
import { rigNodesAt } from '../../../lib/graph/polygonizer/station-loft-rig.js';
import { tuckOf, pitched, mixNodes, ss, SPIN_FRAMES } from './motion.mjs';

const G = 9.81, FADE = 4, FLESH = 0.1;   // FLESH: metres of chest in front of the trunk's joints
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TRUNK = ['headTop', 'headBase', 'neckHub', 'navel', 'pelvisHub', 'shoulderL', 'shoulderR', 'hipL', 'hipR'];
const frontOf = (n) => Math.max(...TRUNK.map((k) => n[k][1])) + FLESH;

/**
 * `e` restitution off a wall and off a body; `gain` the change shown (×); `charge` the incoming body takes its own change
 * unscaled off a body (it drives through); `blockBelow` an approach slower than this is a block; `ladder` [bump → stagger,
 * stagger → the top rung] on the shown change (m/s); `top` the top rung; `lift` degrees a launch leaves the floor at;
 * `fixed` platformer's bonk and boop; `spinAbove` (pinball) m/s at which a body balls up; `hitstop` frames as flavor.mjs;
 * `time` the reactions' pace; `squash` the contact's flattening along the travel; `mu` the soles' friction on a slide.
 */
export const COLLIDE_FLAVORS = Object.freeze({
  realistic: { e: { wall: 0.1, unit: 0.2 }, gain: 1, charge: false, blockBelow: 0, ladder: [1, 3.5], top: 'down', hitstop: null, time: 1, squash: 0, mu: 0.8 },
  action: { e: { wall: 0.4, unit: 0.2 }, gain: 3, charge: true, blockBelow: 1.5, ladder: [2, 6], top: 'launch', lift: 15, hitstop: { base: 4, perMs: 0.4, max: 14 }, time: 0.8, squash: 0.06, mu: 0.8 },
  platformer: { fixed: { wall: { rebound: 3, hop: 0.5 }, unit: { rebound: 3, hop: 0.3 }, g: 20 }, blockBelow: 1.5, hitstop: { base: 2, perMs: 0, max: 2 }, time: 0.6, squash: 0.25, mu: 0.8 },
  pinball: { e: { wall: 1.3, unit: 1.3 }, gain: 1, charge: false, blockBelow: 0, spinAbove: 2, hitstop: null, time: 0.5, squash: 0.12, mu: 0.8, roll: 2 },
});

/** what an impact does to each body: `dv` the change it takes (m/s, real), `shown` the change the flavor shows, `vOut`
 * its speed after (signed along the incoming's travel), its rung */
export function outcome(flavor, vIn, target) {
  const F = COLLIDE_FLAVORS[flavor]; if (!F) throw new Error(`animation-games: no collision flavor '${flavor}'`);
  if (vIn < F.blockBelow) return { a: { state: 'block', dv: r4(vIn), shown: 0, vOut: 0 }, ...(target === 'unit' ? { b: { state: 'block', dv: 0, shown: 0, vOut: 0 } } : {}) };
  if (F.fixed) {
    const f = F.fixed[target], a = { state: target === 'wall' ? 'bonk' : 'boop', dv: r4(vIn + f.rebound), shown: r4(vIn + f.rebound), vOut: -f.rebound, hop: f.hop };
    return target === 'wall' ? { a } : { a, b: { state: 'boop', dv: f.rebound, shown: f.rebound, vOut: f.rebound, hop: f.hop } };
  }
  const rung = (shown) => (F.spinAbove ? (shown >= F.spinAbove ? 'spin' : 'bump') : shown < F.ladder[0] ? 'bump' : shown < F.ladder[1] ? 'stagger' : F.top);
  const e = F.e[target];
  if (target === 'wall') {
    const vOut = -e * vIn * F.gain, dv = (1 + e) * vIn, shown = F.spinAbove ? Math.abs(vOut) : dv * F.gain;
    return { a: { state: rung(shown), dv: r4(dv), shown: r4(shown), vOut: r4(vOut), lift: F.lift ?? 0 } };
  }
  // two equal bodies, the other at rest: v1 = v(1 − e)/2, v2 = v(1 + e)/2
  const v1 = (vIn * (1 - e)) / 2, v2 = (vIn * (1 + e)) / 2, gA = F.charge ? 1 : F.gain;
  const sa = F.spinAbove ? Math.abs(v1) : (vIn - v1) * gA, sb = F.spinAbove ? v2 : v2 * F.gain;
  return { a: { state: rung(sa), dv: r4(vIn - v1), shown: r4(sa), vOut: r4(v1 * (F.charge ? 1 : F.gain)), lift: 0 },
    b: { state: rung(sb), dv: r4(v2), shown: r4(sb), vOut: r4(v2 * F.gain), lift: F.lift ?? 0 } };
}

// ─── the library's pieces, once per rig ────────────────────────────────────
const LIB = new WeakMap();
function libOf(R) {
  if (LIB.has(R)) return LIB.get(R);
  const cyc = (g) => { const Gt = GAITS[g]; const L = heroLocomotion({ [Gt.motion]: Gt.base }, R, { tilt: Gt.tilt }); return { fn: L.fn, travel: L.travel, v: L.travel / Gt.seconds }; };
  const nodes = (pose) => rigNodesAt(R, pose).nodes;
  const ko = heroRise('knockedOut', R, { down: true });
  const lib = { walk: cyc('walk'), run: cyc('sprint'), stand: nodes(keyedClip(REACTS.hitHigh, R).fn(0)), stagger: keyedClip(REACTS.stagger, R), ko, tuck: tuckOf(R), nodes };
  LIB.set(R, lib); return lib;
}
/** `hitHigh` with its peak scaled by g (its keys' distance from the stand, which is the zero pose) */
function bumpClip(R, g) {
  const sc = (o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, sc(v)])) : Number.isFinite(o) ? o * g : o);
  return keyedClip({ ...REACTS.hitHigh, keys: REACTS.hitHigh.keys.map((k) => ({ ...k, pose: sc(k.pose), sink: (k.sink ?? 0) * g })) }, R);
}
const midToes = (n) => [(n.toeBaseL[0] + n.toeBaseR[0]) / 2, (n.toeBaseL[1] + n.toeBaseR[1]) / 2];
const shift = (n, d) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [p[0] + d[0], p[1] + d[1], p[2] + (d[2] ?? 0)]]));

/**
 * A body's response, frame by frame in its own frame (y its travel), from the pose it was in at contact: the nodes, and
 * the root's offset from the contact (y along, z up). `o` its outcome; `F` the flavor; `after` frames to fill.
 */
function respond(R, o, F, from, after, fps) {
  const L = libOf(R), out = [];
  const T = F.time ?? 1;
  const at0 = midToes(from);
  // the pose track: which clip, over how long, aligned so its feet start where the body's are
  const align = (n0) => { const m = midToes(n0); return [at0[0] - m[0], at0[1] - m[1], 0]; };
  let poseAt, root;
  const slide = (v, a) => (t) => { const stop = Math.abs(v) / a; const u = Math.min(t, stop); return v * u - Math.sign(v) * (a * u * u) / 2; };
  const g = G * (F.mu ?? 0.8);
  if (o.state === 'block') { poseAt = (t) => mixNodes(from, shift(L.stand, align(L.stand)), ss(t / 0.3)); root = () => [0, 0]; }
  else if (o.state === 'bump' && !F.spinAbove) { const C = bumpClip(R, clamp(o.shown / 1.2, 0.15, 1.5)), d = align(L.nodes(C.fn(0))); poseAt = (t) => shift(L.nodes(C.fn(clamp(t / (C.seconds * T), 0, 1))), d); const s = slide(o.vOut, g); root = (t) => [s(t), 0]; }
  else if (o.state === 'stagger') { const C = L.stagger, d = align(L.nodes(C.fn(0))); poseAt = (t) => shift(L.nodes(C.fn(clamp(t / (C.seconds * T), 0, 1))), d); const s = slide(o.vOut, g); root = (t) => [s(t), 0]; }
  else if (o.state === 'down' || o.state === 'launch') {
    const K = L.ko, d = align(L.nodes(K.fn(0))), dur = K.seconds * T * (o.state === 'launch' ? 0.75 : 1);
    poseAt = (t) => shift(L.nodes(K.fn(clamp(t / dur, 0, 1))), d);
    if (o.state === 'launch') {   // thrown: a flight at `lift` degrees, then the slide
      const a = ((o.lift ?? 15) * Math.PI) / 180, vy = o.vOut * Math.cos(a), vz = Math.abs(o.vOut) * Math.sin(a), tf = (2 * vz) / G, s = slide(vy, g);
      root = (t) => (t < tf ? [vy * t, vz * t - (G * t * t) / 2] : [vy * tf + s(t - tf), 0]);
    } else { const s = slide(o.vOut, g); root = (t) => [s(t), 0]; }
  } else if (o.state === 'bonk' || o.state === 'boop') {
    const C = bumpClip(R, 1), d = align(L.nodes(C.fn(0))), gg = F.fixed.g, vz = Math.sqrt(2 * gg * o.hop), tf = (2 * vz) / gg, s = slide(o.vOut, g);
    poseAt = (t) => shift(L.nodes(C.fn(clamp(t / (C.seconds * T), 0, 1))), d);
    root = (t) => (t < tf ? [o.vOut * t, vz * t - (gg * t * t) / 2] : [o.vOut * tf + s(t - tf), 0]);
  } else if (o.state === 'spin') {   // balled up, rolling away and slowing, whole turns, then open into the stand
    const roll = F.roll ?? 2, tRoll = Math.min(0.9, Math.max(0.3, (Math.abs(o.vOut) - 1) / roll)), s = slide(o.vOut, roll);
    const dist = Math.abs(s(tRoll)), turns = Math.max(1, Math.min(Math.round(dist / (Math.PI * L.tuck.diameter)), Math.floor((tRoll * fps) / SPIN_FRAMES)));
    const stand = shift(L.stand, align(L.stand)), sign = Math.sign(o.vOut);
    poseAt = (t) => { const u = t / tRoll; if (u >= 1) return mixNodes(shift(L.tuck.nodes, align(L.tuck.nodes)), stand, ss((t - tRoll) / 0.15)); const w = ss(u / 0.15); const m = mixNodes(from, shift(L.tuck.nodes, align(L.tuck.nodes)), w); return pitched(m, sign * 360 * turns * ss(u), m.navel); };
    root = (t) => [s(Math.min(t, tRoll + 0.15)), t < tRoll ? 0.15 * Math.sin((Math.PI * t) / tRoll) : 0];
    o.turns = turns;
  } else { const C = bumpClip(R, clamp((o.shown ?? 0) / 1.2, 0.15, 1.5)), d = align(L.nodes(C.fn(0))); poseAt = (t) => shift(L.nodes(C.fn(clamp(t / (C.seconds * T), 0, 1))), d); const s = slide(o.vOut, F.spinAbove ? (F.roll ?? 2) : g); root = (t) => [s(t), 0]; }
  for (let k = 0; k < after; k++) {
    const t = k / fps; let n = poseAt(t);
    if (k < FADE) n = mixNodes(from, n, (k + 1) / (FADE + 1));
    const [y, z] = root(t);
    out.push({ nodes: n, root: [0, y, Math.max(0, z)] });
  }
  return out;
}

/**
 * A collision: the incoming body (`a`) walks or runs at its gait's own speed toward a wall or a standing body (`b`, the
 * same rig, facing it); on contact both freeze for the flavor's hitstop, then respond. Frames carry each body's world
 * nodes (z-up metres; the wall is the plane y = `wall`).
 */
export function collide(R, { flavor, gait = 'run', target = 'wall', fps = 60, approach = null } = {}) {
  const F = COLLIDE_FLAVORS[flavor]; if (!F) throw new Error(`animation-games: no collision flavor '${flavor}'`);
  const L = libOf(R), C = L[gait];
  const vIn = C.v, dist = approach ?? (gait === 'walk' ? 1.2 : 6);
  // the target: the wall's plane, or the other body's front (it stands facing back: turned 180° about the vertical)
  const standFront = frontOf(L.stand);
  const wallY = dist + frontOf(L.nodes(C.fn(0)));
  const unitAt = wallY + standFront;   // the other's root, so its front is at wallY
  const turn = (n, at) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [-p[0], at - p[1], p[2]]]));
  const place = (n, root, sc) => {
    let m = n;
    if (sc) { const c = midToes(n); m = Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [c[0] + (p[0] - c[0]) * sc[0], c[1] + (p[1] - c[1]) * sc[1], p[2] * sc[2]]])); }
    return Object.fromEntries(Object.entries(m).map(([k, p]) => [k, [r4(p[0] + root[0]), r4(p[1] + root[1]), r4(p[2] + root[2])]]));
  };
  const frames = []; let y = 0, phase = 0, contactNodes;
  // ── the approach: the cycle at its own rate (the feet planted), until the trunk's front meets the surface ──
  for (;;) {
    const n = L.nodes(C.fn(phase));
    if (frontOf(n) + y >= wallY) { contactNodes = n; break; }
    frames.push({ part: 'approach', a: place(n, [0, y, 0]), b: target === 'unit' ? turn(L.stand, unitAt) : null, rootA: [0, r4(y), 0] });
    y += vIn / fps; phase = (phase + (vIn / C.travel) / fps) % 1;
    if (frames.length > fps * 20) throw new Error('animation-games: never met the surface');
  }
  // the body stops at the surface: its root set back so its front is exactly on it
  y = wallY - frontOf(contactNodes);
  const o = outcome(flavor, vIn, target);
  const stop = F.hitstop && o.a.state !== 'block' ? Math.min(F.hitstop.max, Math.round(F.hitstop.base + F.hitstop.perMs * Math.max(o.a.shown, o.b?.shown ?? 0))) : 0;
  const kContact = frames.length;
  const flat = (k) => { if (!F.squash) return null; const s = F.squash * Math.exp(-(((k - kContact) / fps / 0.06) ** 2)); if (s < 1e-4) return null; const sy = 1 - s, sxz = 1 / Math.sqrt(sy); return [r4(sxz), r4(sy), r4(sxz)]; };
  const bStand = L.stand;
  for (let k = 0; k <= stop; k++) frames.push({ part: k ? 'hitstop' : 'contact', held: k > 0, scale: flat(kContact), a: place(contactNodes, [0, y, 0], flat(kContact)), b: target === 'unit' ? turn(place(bStand, [0, 0, 0], flat(kContact)), unitAt) : null, rootA: [0, r4(y), 0] });
  // ── the response ──
  const after = Math.round(fps * 2.2);
  const ra = respond(R, o.a, F, contactNodes, after, fps);
  // the other faces back: pushed along the incoming's travel is backward in its own frame
  const ob = o.b ? { ...o.b, vOut: -o.b.vOut } : null;
  const rb = ob ? respond(R, ob, F, bStand, after, fps) : null;
  if (ob?.turns) o.b.turns = ob.turns;
  for (let k = 0; k < after; k++) {
    const sc = flat(kContact + stop + 1 + k);
    frames.push({ part: 'response', scale: sc, a: place(ra[k].nodes, [0, y + ra[k].root[1], ra[k].root[2]], sc), b: rb ? turn(place(rb[k].nodes, [0, rb[k].root[1], rb[k].root[2]], sc), unitAt) : null, rootA: [0, r4(y + ra[k].root[1]), r4(ra[k].root[2])], rootB: rb ? [0, r4(unitAt - rb[k].root[1]), r4(rb[k].root[2])] : null });
  }
  return { flavor, gait, target, fps, vIn: r4(vIn), wall: r4(wallY), unitAt: r4(unitAt), contact: kContact, hitstop: stop, outcome: o, frames: frames.map((f, k) => ({ k, ...f })) };
}

/**
 * The measures: the approach speed; each body's rung, the change it takes and shows, its speed after, how far it ends
 * from where it met (m along the incoming's travel: negative is back toward where it came from), how high it was thrown, whether it ends lying (its head under
 * half a metre), its spin's turns; the freeze; how far any trunk joint passes the wall or the other's trunk (m; ≤ 0 none),
 * and how far a hand does.
 */
export function collisionSignature(R, c) {
  const fr = c.frames, last = fr.at(-1), at = fr[c.contact];
  const side = (key, rootKey) => {
    if (!last[key]) return null; const o = c.outcome[key];
    const startY = key === 'a' ? at.rootA[1] : c.unitAt, endY = last[rootKey]?.[1] ?? startY;
    return { state: o.state, dv: o.dv, shown: o.shown, vOut: o.vOut, moved: r4(endY - startY), thrown: r4(Math.max(0, ...fr.map((f) => f[rootKey]?.[2] ?? 0))), lying: last[key].headTop[2] < 0.5, turns: o.turns ?? 0 };
  };
  // the trunk against the wall (y ≤ wall) or the two trunks against each other (a's front ≤ b's front)
  let pen = -Infinity, hand = -Infinity;
  for (const f of fr) {
    const aFront = Math.max(...TRUNK.map((k) => f.a[k][1])) + FLESH, aHand = Math.max(f.a.wristL[1], f.a.wristR[1]);
    const surface = f.b ? Math.min(...TRUNK.map((k) => f.b[k][1])) - FLESH : c.wall;
    pen = Math.max(pen, aFront - surface); hand = Math.max(hand, aHand - surface);
  }
  return { vIn: c.vIn, contactAt: r4(c.contact / c.fps), hitstop: c.hitstop, held: fr.filter((f) => f.held).length,
    a: side('a', 'rootA'), b: side('b', 'rootB'), trunkPen: r4(pen), handPen: r4(hand) };
}
