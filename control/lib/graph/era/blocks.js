/**
 * BLOCKS — the building blocks a civilization makes things from, in three layers:
 *
 *   PRIMITIVES  shapes, in code: a box, a drum, a tube, a cone, a dish, a truss, a panel, a wheel, a track, an arm, a
 *               fin, a lamp, a ring. Each takes params on rails and pushes faces (values on surface groups; the paint
 *               colours them). New code only ever lands here.
 *   BLOCKS      data the agent writes: a named composition of primitives (or of other blocks) with params on rails, a
 *               `read`, the FUNCTIONS it shows, where it MOUNTS and its SOCKETS. A block is validated, built at a ring
 *               (the eye spot gates every part), measured by its laws and drawn on a sheet.
 *   ASSEMBLIES  what the tunnel makes of blocks (gameworld/tunnel.js).
 *
 * Conceptual and visual only: a function is what the eye must find for a thing to read as doing it (a source and a
 * carrier for power, a body and running gear to move), never how it would work.
 *
 * A block's numbers are expressions over its params (`'h * 0.5'`, `'round(2 + 4 * many)'`), so a block is a rule, not a
 * shape: every block has a `many` dial (0…1, little to many) its parts can appear at (`many: 0.5`) or count by.
 *
 *   readBlock(block, library?)            → the block, checked (throws naming what is wrong)
 *   buildBlock(block, { params, seed, ring, library, many, bevel }) → { faces, parts, params, box, ring, counted }
 *                                         (`bevel`, opt-in: a share of each drawn part's least size its capped prisms
 *                                         are bevelled by; absent, nothing changes)
 *   blockLaws(block, built)               → [{ law, want, ok, value }]
 *   blockPaint(kitId, finish)             → a structure paint with the technology groups resolved by a finish
 *
 * Pure; seeded dice only.
 */
import { geometry as G, eyeSpot, STRUCTURE_RINGS, STRUCTURE_RING_IDS } from './out-structures.js';
import { structurePaint } from './out-structures-paint.js';
import { madeRamp } from './style/swatches.js';
import { EYE_SPOT_PX, metresPerPixel } from '../playscape/objects/laws.js';

const { face, basis, add3, sub, cross, unit, dot, dice, subSeed, r3 } = G;

// ── the vocabulary ──────────────────────────────────────────────────────────────────────────────────────────────────
/** What a thing reads as doing: each function is a list of reads, each read a set of roles any one of which shows it. */
export const FUNCTIONS = Object.freeze({
  power: { reads: [['source'], ['carrier']], read: 'a source (a wing, a rotor, a stack) and what carries it away (a cable, a conduit)' },
  store: { reads: [['store']], read: 'a tank or a bank: something held' },
  move: { reads: [['body'], ['running']], read: 'a bed or a body and its running gear: wheels, a track, skids' },
  lift: { reads: [['boom'], ['hook']], read: 'a mast or a boom, and a hook or a platform on it' },
  make: { reads: [['intake'], ['body'], ['outlet']], read: 'something goes in, a body works it, something comes out' },
  sense: { reads: [['sensor']], read: 'a dish, a lens, a mast that listens' },
  signal: { reads: [['beacon', 'readout', 'status']], read: 'a beacon, a readout or a status light: something told' },
  keep: { reads: [['shell'], ['seal', 'door']], read: 'a shell and the way through it' },
  grow: { reads: [['bed'], ['water', 'lamp']], read: 'a bed and what feeds it: water or light' },
  light: { reads: [['lamp']], read: 'a lamp' },
  // what the technology crafter (gameworld/tech-crafter.js) adds: what fights, what takes the blow, what lets you through
  strike: { reads: [['weapon'], ['grip', 'mount']], read: 'what strikes (a blade, a head, a limb, a barrel, a throwing arm) and what holds or aims it (a grip, a stock, a carriage, a mount)' },
  guard: { reads: [['armour']], read: 'plate or a shield: something that takes the blow' },
  pass: { reads: [['span'], ['pier']], read: 'a way across or through (a deck, a lintel, a ring) and what holds it up' },
});
export const FUNCTION_IDS = Object.freeze(Object.keys(FUNCTIONS));
/** Roles a part may take: every role a function reads, and the ones that only carry or dress. */
export const ROLES = Object.freeze([...new Set([...Object.values(FUNCTIONS).flatMap((f) => f.reads.flat()), 'frame', 'mount', 'joint', 'trim', 'status'])]);
/** Tiers by scale: the ring a tier is judged at, and its share of the ring's face budget. */
export const TIERS = Object.freeze({
  part: { ring: 'near', budget: 0.5, read: 'a piece other blocks are made of' },
  tool: { ring: 'near', budget: 0.5, read: 'hand scale, to 1.5 m' },
  machine: { ring: 'mid', budget: 1, read: 'body scale, 1.5–6 m' },
  installation: { ring: 'mid', budget: 2, read: 'building scale: on or beside a building' },
  automation: { ring: 'mid', budget: 1.5, read: 'a machine and its cycle: the track or rail it runs, its joints posed' },
  // the crafter's: a hand weapon is judged where it is seen, at arm's length (`reach`, m), not at a ring's distance
  held: { ring: 'near', reach: 1, budget: 0.5, read: 'in the hand: a weapon or a tool held, judged at arm\'s length' },
  vessel: { ring: 'mid', budget: 2, read: 'building scale, and it goes: a ship, an airship, a land train' },
  landmark: { ring: 'mid', budget: 2.5, read: 'a tech-structure seen across the level: a tower, a gate, a span, a stack' },
});
export const TIER_IDS = Object.freeze(Object.keys(TIERS));
export const MOUNTS = Object.freeze(['ground', 'wall', 'roof', 'socket', 'hand', 'water']);
/** The technology's surface groups (a finish points each at one of the kit's ramps); `str:accent` is the status light. */
export const TECH_GROUPS = Object.freeze({
  'tech:body': 'the body of a thing', 'tech:frame': 'frames, masts, booms, chassis', 'tech:skin': 'cladding and panels',
  'tech:glass': 'collectors, screens, lenses: the darkest thing on a machine', 'tech:cable': 'cables, hoses, conduits',
  'tech:trim': 'bands and edges', 'tech:light': 'lamps that light (not the status light)',
});
const GROUPS = new Set([...Object.keys(TECH_GROUPS), 'str:accent', 'str:plaster', 'str:stone', 'str:timber', 'str:shell', 'str:lens', 'str:motif', 'str:paint', 'str:opening', 'str:tile']);
/** FINISHES: what a civilization's technology is made of, as each technology group's ramp (the first the kit has). */
export const FINISHES = Object.freeze({
  alloy: { read: 'pressed metal and glass', 'tech:body': ['stone'], 'tech:frame': ['stone'], 'tech:skin': ['soil', 'rope'], 'tech:glass': ['lens', 'glow', 'stone'], 'tech:cable': ['rope'], 'tech:trim': ['paint'], 'tech:light': ['lens', 'glow', 'paint'] },
  composite: { read: 'moulded shells over a dark frame', 'tech:body': ['soil', 'rope'], 'tech:frame': ['stone'], 'tech:skin': ['rope', 'soil'], 'tech:glass': ['lens', 'glow', 'stone'], 'tech:cable': ['timber'], 'tech:trim': ['paint'], 'tech:light': ['lens', 'glow'] },
  'iron-and-timber': { read: 'riveted iron on timber', 'tech:body': ['timber'], 'tech:frame': ['stone'], 'tech:skin': ['timber'], 'tech:glass': ['stone'], 'tech:cable': ['rope'], 'tech:trim': ['paint'], 'tech:light': ['paint'] },
  'stone-and-brass': { read: 'dressed stone and bright fittings', 'tech:body': ['stone'], 'tech:frame': ['timber'], 'tech:skin': ['stone'], 'tech:glass': ['lens', 'glow', 'paint'], 'tech:cable': ['rope'], 'tech:trim': ['paint'], 'tech:light': ['glow', 'paint'] },
});
export const FINISH_IDS = Object.freeze(Object.keys(FINISHES));
// what each finish's surfaces are MADE of, on the material pole (era/style/pole.js): the ramp gives a colour, the finish
// says the stuff — an alloy body is metal though it takes the stone ramp's greys; glass, trim and lights stay flat
export const FINISH_MATERIALS = Object.freeze({
  alloy: { 'tech:body': 'metal', 'tech:frame': 'metal', 'tech:skin': 'metal', 'tech:cable': 'grain' },
  composite: { 'tech:body': 'plaster', 'tech:frame': 'metal', 'tech:skin': 'plaster', 'tech:cable': 'grain' },
  'iron-and-timber': { 'tech:body': 'grain', 'tech:frame': 'metal', 'tech:skin': 'grain', 'tech:cable': 'grain' },
  'stone-and-brass': { 'tech:body': 'stone', 'tech:frame': 'grain', 'tech:skin': 'stone', 'tech:cable': 'grain' },
});

// ── expressions: numbers over a block's params ─────────────────────────────────────────────────────────────────────
const FN = { round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt };
/** An expression's value over `P` (numbers, param names, + − × ÷, parentheses, round/floor/ceil/min/max/abs/sqrt). */
export function expr(src, P = {}) {
  if (typeof src === 'number') return src;
  if (typeof src !== 'string') throw new Error(`blocks: a number is a number or an expression (got ${JSON.stringify(src)})`);
  const t = src.match(/\d*\.?\d+(?:e-?\d+)?|[a-z_][a-z0-9_]*|[-+*/(),]/gi) ?? [];
  if (t.join('') !== src.replace(/\s+/g, '')) throw new Error(`blocks: '${src}' is not an expression (numbers, params, + - * / ( ), ${Object.keys(FN).join(', ')})`);
  let i = 0;
  const peek = () => t[i], take = () => t[i++];
  const atom = () => {
    const k = take();
    if (k === '-') return -atom();
    if (k === '(') { const v = sum(); if (take() !== ')') throw new Error(`blocks: '${src}' is missing a ')'`); return v; }
    if (/^[\d.]/.test(k)) return Number(k);
    if (FN[k]) { if (take() !== '(') throw new Error(`blocks: '${k}' takes ( )`); const a = [sum()]; while (peek() === ',') { take(); a.push(sum()); } if (take() !== ')') throw new Error(`blocks: '${src}' is missing a ')'`); return FN[k](...a); }
    if (k !== undefined && P[k] !== undefined && typeof P[k] === 'number') return P[k];
    throw new Error(`blocks: '${k}' in '${src}' is not a param (${Object.keys(P).join(', ')})`);
  };
  const prod = () => { let v = atom(); while (peek() === '*' || peek() === '/') v = take() === '*' ? v * atom() : v / atom(); return v; };
  const sum = () => { let v = prod(); while (peek() === '+' || peek() === '-') v = take() === '+' ? v + prod() : v - prod(); return v; };
  const v = sum();
  if (i !== t.length) throw new Error(`blocks: '${src}' has more after its end`);
  return v;
}
const vec = (v, P, d = [0, 0, 0]) => (v === undefined ? d : v.map((x) => expr(x, P)));

// ── the primitives ──────────────────────────────────────────────────────────────────────────────────────────────────
// each builds in its own frame (base at the origin, up z) and says its least span (the eye spot's measure)
const ring2 = (n, r, a0 = 0) => Array.from({ length: n }, (_, k) => { const a = a0 + (2 * Math.PI * k) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
/** A prism: a convex 2-D outline swept from a to b (its plane square to the sweep), capped at both ends. With
 *  `ex.bevel` (metres, opt-in) a capped prism is drawn bevelled instead (bevelPrism). */
function prism(out, a, b, outline, ex, caps = true) {
  if (caps && ex.bevel) { bevelPrism(out, a, b, outline, ex); return; }
  const ax = sub(b, a), n = unit(ax), [t1, t2] = basis(n), at = (o, [u, v]) => add3(add3(o, t1, u), t2, v);
  const A = outline.map((p) => at(a, p)), B = outline.map((p) => at(b, p));
  for (let k = 0; k < outline.length; k++) {
    const k1 = (k + 1) % outline.length, q = [A[k], A[k1], B[k1], B[k]], c = q.reduce((s, p) => add3(s, p, 0.25), [0, 0, 0]);
    face(out, q, sub(c, add3(a, n, dot(sub(c, a), n))), ex.part, ex.value, ex.extra);
  }
  if (caps) { face(out, A, n.map((v) => -v), ex.part, ex.value, ex.extra); face(out, B, n, ex.part, Math.min(1, ex.value + 0.04), ex.extra); }
}
// a convex outline counter-clockwise, its edges' inward normals, and the outline moved inward by d along them
const ccw = (o) => (o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) < 0 ? o.slice().reverse() : o);
const inwardOf = (o) => o.map((p, i) => { const q = o[(i + 1) % o.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
function inset(o, d) {
  const N = inwardOf(o);
  return o.map((p, i) => { const a = N[(i + o.length - 1) % o.length], b = N[i], k = d / (1 + a[0] * b[0] + a[1] * b[1]); return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k]; });
}
/**
 * A bevelled prism: the outline's corners rounded (a polygon of six sides or fewer: a box, a panel, a fin; a rounder
 * outline is round already) and both ends eased into their caps over `segs` steps, so a light smoothed across creases
 * has a shoulder to grade. Drawn inside the plain prism's bounds: nothing grows. The bevel is `ex.bevel` metres, held
 * under half the sweep and under the outline's inradius; `ex.segs` (1–3) the steps of each round.
 */
function bevelPrism(out, a, b, outline0, ex) {
  const outline = ccw(outline0), L = Math.hypot(...sub(b, a)), segs = ex.segs ?? 2;
  const c2 = outline.reduce((s, p) => [s[0] + p[0] / outline.length, s[1] + p[1] / outline.length], [0, 0]);
  const inr = Math.min(...inwardOf(outline).map((n, i) => (c2[0] - outline[i][0]) * n[0] + (c2[1] - outline[i][1]) * n[1]));
  const rho = outline.length <= 6 ? Math.min(ex.bevel, 0.8 * inr) : 0;
  const e = Math.min(rho > 0 ? 0.7 * rho : ex.bevel, 0.45 * L, 0.45 * inr);
  if (e < 0.004) { prism(out, a, b, outline0, { ...ex, bevel: 0 }); return; }
  const Q = rho > 0 ? inset(outline, rho) : outline, N = inwardOf(outline), n = Q.length;
  // the outline drawn s inward: round corners of radius rho − s about Q's corners, or Q moved in by s
  const ringOf = (s) => (rho > 0
    ? Q.flatMap((q, i) => {
      const o1 = N[(i + n - 1) % n].map((v) => -v), o2 = N[i].map((v) => -v), a1 = Math.atan2(o1[1], o1[0]);
      let da = Math.atan2(o2[1], o2[0]) - a1; while (da < 0) da += 2 * Math.PI; while (da > Math.PI) da -= 2 * Math.PI;
      return Array.from({ length: segs + 1 }, (_, j) => { const t = a1 + (da * j) / segs; return [q[0] + (rho - s) * Math.cos(t), q[1] + (rho - s) * Math.sin(t)]; });
    })
    : inset(outline, s));
  const stations = [];
  for (let j = 0; j <= segs; j++) { const th = (Math.PI / 2) * (j / segs); stations.push([e * (1 - Math.cos(th)), e * (1 - Math.sin(th))]); }
  for (let j = segs; j >= 0; j--) { const th = (Math.PI / 2) * (j / segs); stations.push([L - e * (1 - Math.cos(th)), e * (1 - Math.sin(th))]); }
  const ax = sub(b, a), nx = unit(ax), [t1, t2] = basis(nx), at = (t, [u, v]) => add3(add3(add3(a, nx, t), t1, u), t2, v);
  const rings = stations.map(([t, s]) => ringOf(s).map((p) => at(t, p)));
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r], B = rings[r + 1], m = A.length;
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m, q = [A[k], A[k1], B[k1], B[k]], c = q.reduce((s, p) => add3(s, p, 0.25), [0, 0, 0]);
      face(out, q, sub(c, add3(a, nx, dot(sub(c, a), nx))), ex.part, ex.value, ex.extra);
    }
  }
  face(out, rings[0], nx.map((v) => -v), ex.part, ex.value, ex.extra);
  face(out, rings[rings.length - 1], nx, ex.part, Math.min(1, ex.value + 0.04), ex.extra);
}
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const R = (lo, hi, i) => (i ? [lo, hi, 'i'] : [lo, hi]);
export const PRIMITIVES = Object.freeze({
  box: { read: 'a block: w × d × h, standing on its base; `seams` lays a panel grid on its sides in the tile', rails: { size: R(0.04, 60), seams: R(0.3, 6) },
    least: (p) => Math.min(...p.size),
    build(out, p, ex) {
      const [w, d, h] = p.size;
      // an outline swept up z lies in (y, −x): basis([0, 0, 1])
      prism(out, [0, 0, 0], [0, 0, h], [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [y, -x]), ex);
      if (p.seams) seamGrid(out, w, d, h, p.seams, ex);
    } },
  drum: { read: 'a cylinder of radius r, h long along its axis', rails: { r: R(0.02, 30), h: R(0.02, 60), sides: R(5, 32, true) },
    least: (p) => Math.min(2 * p.r, p.h),
    build(out, p, ex) { prism(out, [0, 0, 0], AXES[p.axis ?? 'z'].map((v) => v * p.h), ring2(p.sides ?? 12, p.r, Math.PI / (p.sides ?? 12)), ex); } },
  tube: { read: 'a round member from one point to another', rails: { r: R(0.01, 6), sides: R(4, 16, true) },
    least: (p) => 2 * p.r,
    build(out, p, ex) { prism(out, p.from, p.to, ring2(p.sides ?? 6, p.r), ex); } },
  cone: { read: 'a cone or a frustum: r at the foot, r2 at the top, h high', rails: { r: R(0.02, 30), r2: R(0, 30), h: R(0.02, 60), sides: R(4, 32, true) },
    least: (p) => Math.min(2 * p.r, p.h),
    build(out, p, ex) {
      const n = p.sides ?? 10, A = ring2(n, p.r), r2 = p.r2 ?? 0, B = ring2(n, Math.max(r2, 1e-3));
      for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, q = r2 > 0 ? [[...A[k], 0], [...A[k1], 0], [...B[k1], p.h], [...B[k], p.h]] : [[...A[k], 0], [...A[k1], 0], [0, 0, p.h]]; face(out, q, [A[k][0] + A[k1][0], A[k][1] + A[k1][1], p.r * 0.3], ex.part, ex.value, ex.extra); }
      if (r2 > 0) face(out, B.map(([x, y]) => [x, y, p.h]), [0, 0, 1], ex.part, Math.min(1, ex.value + 0.04), ex.extra);
    } },
  dish: { read: 'a bowl of radius r and depth, its open face turned along `aim`', rails: { r: R(0.1, 20), depth: R(0.02, 8), sides: R(6, 24, true) },
    least: (p) => 2 * p.r,
    build(out, p, ex) {
      const n = unit(p.aim ?? [0, 0, 1]), [t1, t2] = basis(n), apex = add3([0, 0, 0], n, -p.depth), sides = p.sides ?? 12;
      const rim = ring2(sides, p.r).map(([u, v]) => add3(add3([0, 0, 0], t1, u), t2, v)), mid = ring2(sides, p.r * 0.55).map(([u, v]) => add3(add3(add3([0, 0, 0], n, -p.depth * 0.7), t1, u), t2, v));
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        for (const [q, lo] of [[[rim[k], rim[k1], mid[k1], mid[k]], 0], [[mid[k], mid[k1], apex], 0.04]]) {
          face(out, q, n, ex.part, Math.max(0.03, ex.value - 0.1 - lo), ex.extra);   // the inside, shaded
          face(out, q.map((x) => add3(x, n, -0.02)), n.map((v) => -v), ex.part, ex.value, ex.extra);   // the back
        }
      }
    } },
  truss: { read: 'a lattice of four chords and a diagonal each bay: w across, members `member` thick; under the eye spot it reads as its envelope', rails: { w: R(0.1, 6), member: R(0.02, 0.6), bays: R(1, 40, true) },
    least: (p) => p.w,
    build(out, p, ex, eye) {
      const ax = sub(p.to, p.from), L = Math.hypot(...ax), n = unit(ax), [t1, t2] = basis(n), h = p.w / 2;
      if (p.member < eye) { prism(out, p.from, p.to, [[-h, -h], [h, -h], [h, h], [-h, h]], { ...ex, value: Math.max(0.03, ex.value - 0.08) }); return; }
      const m = p.member / 2, sq = [[-m, -m], [m, -m], [m, m], [-m, m]], C = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => add3(add3([0, 0, 0], t1, u), t2, v));
      for (const c of C) prism(out, add3(p.from, c), add3(p.to, c), sq, ex);
      const bays = p.bays ?? Math.max(1, Math.round(L / p.w));
      for (let b = 0; b < bays; b++) for (let s = 0; s < 4; s++) {
        const c0 = C[s], c1 = C[(s + 1) % 4], z0 = (b / bays) * L, z1 = ((b + 1) / bays) * L, lo = b % 2 ? c0 : c1, hi = b % 2 ? c1 : c0;
        prism(out, add3(add3(p.from, n, z0), lo), add3(add3(p.from, n, z1), hi), sq, ex, false);
      }
    } },
  panel: { read: 'a thin sheet w × h, its face turned along `aim`; `seams` lays its cell grid in the tile', rails: { size: R(0.1, 30), t: R(0.01, 0.5), seams: R(0.1, 4) },
    least: (p) => Math.min(...p.size),
    build(out, p, ex) {
      const n = unit(p.aim ?? [0, -1, 0]), up = Math.abs(n[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1], t1 = unit(cross(up, n)), t2 = cross(n, t1), [w, h] = p.size, t = p.t ?? 0.06;
      prism(out, add3([0, 0, 0], n, -t / 2), add3([0, 0, 0], n, t / 2), [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [dot(add3(add3([0, 0, 0], t1, u), t2, v), basis(n)[0]), dot(add3(add3([0, 0, 0], t1, u), t2, v), basis(n)[1])]), ex);
      if (p.seams) {
        const mark = { ...ex, value: Math.max(0.03, ex.value - 0.3), extra: { ...ex.extra, tile: true }, part: 'bond' }, f = add3([0, 0, 0], n, t / 2 + 0.006), s = 0.025;
        for (let u = -w / 2 + p.seams; u < w / 2 - 1e-6; u += p.seams) face(out, [[u - s, -h / 2], [u + s, -h / 2], [u + s, h / 2], [u - s, h / 2]].map(([a, b]) => add3(add3(f, t1, a), t2, b)), n, mark.part, mark.value, mark.extra);
        for (let v = -h / 2 + p.seams; v < h / 2 - 1e-6; v += p.seams) face(out, [[-w / 2, v - s], [w / 2, v - s], [w / 2, v + s], [-w / 2, v + s]].map(([a, b]) => add3(add3(f, t1, a), t2, b)), n, mark.part, mark.value, mark.extra);
      }
    } },
  wheel: { read: 'a wheel of radius r, w wide, turning about its axis (x or y), standing on the ground', rails: { r: R(0.05, 6), w: R(0.03, 3), sides: R(6, 24, true) },
    least: (p) => 2 * p.r,   // a wheel reads by its round, seen side on
    build(out, p, ex) { const ax = AXES[p.axis ?? 'y'], c = [0, 0, p.r]; prism(out, add3(c, ax, -p.w / 2), add3(c, ax, p.w / 2), ring2(p.sides ?? 12, p.r, Math.PI / (p.sides ?? 12)), ex); } },
  track: { read: 'a running track: a loop len long, its ends round (radius r), w wide, along x', rails: { len: R(0.4, 30), r: R(0.1, 3), w: R(0.1, 3), sides: R(3, 8, true) },
    least: (p) => 2 * p.r,   // a track reads by its height, seen side on
    build(out, p, ex) {
      const s = p.sides ?? 4, half = Math.max(0, p.len / 2 - p.r), pts = [];
      for (let k = 0; k <= s; k++) { const a = -Math.PI / 2 + (Math.PI * k) / s; pts.push([half + p.r * Math.cos(a), p.r + p.r * Math.sin(a)]); }
      for (let k = 0; k <= s; k++) { const a = Math.PI / 2 + (Math.PI * k) / s; pts.push([-half + p.r * Math.cos(a), p.r + p.r * Math.sin(a)]); }
      const A = pts.map(([x, z]) => [x, -p.w / 2, z]), B = pts.map(([x, z]) => [x, p.w / 2, z]);
      for (let k = 0; k < pts.length; k++) { const k1 = (k + 1) % pts.length, c = [(pts[k][0] + pts[k1][0]) / 2, 0, (pts[k][1] + pts[k1][1]) / 2]; face(out, [A[k], A[k1], B[k1], B[k]], sub(c, [Math.max(-half, Math.min(half, c[0])), 0, p.r]), ex.part, ex.value, ex.extra); }
      face(out, A, [0, -1, 0], ex.part, Math.min(1, ex.value + 0.05), ex.extra); face(out, B, [0, 1, 0], ex.part, Math.min(1, ex.value + 0.05), ex.extra);
    } },
  arm: { read: 'an arm of segments (lengths `segs`), each bent `bend` degrees from the one under it, jointed; `turn` swings it about z', rails: { r: R(0.03, 1.5) },
    least: (p) => 2 * p.r,
    build(out, p, ex) {
      let at = [0, 0, 0], pitch = 0;
      const turn = ((p.turn ?? 0) * Math.PI) / 180;
      p.segs.forEach((l, i) => {
        pitch += ((p.bend?.[i] ?? 0) * Math.PI) / 180;
        const dir = [Math.sin(pitch) * Math.cos(turn), Math.sin(pitch) * Math.sin(turn), Math.cos(pitch)], to = add3(at, dir, l);
        prism(out, at, to, [[-p.r, -p.r], [p.r, -p.r], [p.r, p.r], [-p.r, p.r]], ex);
        const j = p.r * 1.15;
        prism(out, add3(at, [-Math.sin(turn), Math.cos(turn), 0], -j), add3(at, [-Math.sin(turn), Math.cos(turn), 0], j), ring2(8, j), { ...ex, value: Math.max(0.03, ex.value - 0.1) });
        at = to;
      });
    } },
  fin: { read: 'a blade l long and h high, t thick: a vane, a keel, a cowl', rails: { l: R(0.05, 20), h: R(0.05, 20), t: R(0.01, 1) },
    least: (p) => Math.min(p.l, p.h),
    build(out, p, ex) { const t = p.t ?? 0.05; prism(out, [0, -t / 2, 0], [0, t / 2, 0], [[0, 0], [p.l, 0], [0, p.h]].map(([x, z]) => [x, -z]), ex); } },
  lamp: { read: 'a small light of radius r', rails: { r: R(0.03, 2) },
    least: (p) => 2 * p.r,
    build(out, p, ex) {
      const r = p.r, V = [[r, 0, r], [-r, 0, r], [0, r, r], [0, -r, r]], top = [0, 0, 2 * r], bot = [0, 0, 0], O = [V[0], V[2], V[1], V[3]];
      for (let k = 0; k < 4; k++) { const a = O[k], b = O[(k + 1) % 4]; face(out, [a, b, top], add3(add3(a, b), [0, 0, r]), ex.part, ex.value, ex.extra); face(out, [b, a, bot], add3(add3(a, b), [0, 0, -r]), ex.part, ex.value, ex.extra); }
    } },
  ring: { read: 'a hoop of radius r, its section `tube` thick, round its axis', rails: { r: R(0.1, 60), tube: R(0.02, 3), sides: R(6, 32, true) },
    least: (p) => 2 * p.tube,
    build(out, p, ex) {
      const ax = unit(AXES[p.axis ?? 'z']), [t1, t2] = basis(ax), n = p.sides ?? 16, P = (k) => { const a = (2 * Math.PI * k) / n; return add3(add3([0, 0, 0], t1, p.r * Math.cos(a)), t2, p.r * Math.sin(a)); };
      for (let k = 0; k < n; k++) prism(out, P(k), P(k + 1), ring2(4, p.tube, Math.PI / 4), ex, false);
    } },
});
export const PRIMITIVE_IDS = Object.freeze(Object.keys(PRIMITIVES));
function seamGrid(out, w, d, h, s, ex) {
  const mark = { ...ex.extra, tile: true }, v = Math.max(0.03, ex.value - 0.3), t = 0.025, o = 0.006;
  const sides = [[[-w / 2, -d / 2], [w / 2, -d / 2], [0, -1, 0]], [[w / 2, -d / 2], [w / 2, d / 2], [1, 0, 0]], [[w / 2, d / 2], [-w / 2, d / 2], [0, 1, 0]], [[-w / 2, d / 2], [-w / 2, -d / 2], [-1, 0, 0]]];
  for (const [a, b, n] of sides) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], at = (s0, z) => [a[0] + u[0] * s0 + n[0] * o, a[1] + u[1] * s0 + n[1] * o, z];
    for (let z = s; z < h - 1e-6; z += s) face(out, [at(0, z - t), at(L, z - t), at(L, z + t), at(0, z + t)], n, 'bond', v, mark);
    for (let x = s; x < L - 1e-6; x += s) face(out, [at(x - t, 0), at(x + t, 0), at(x + t, h), at(x - t, h)], n, 'bond', v, mark);
  }
}

// ── reading a block ─────────────────────────────────────────────────────────────────────────────────────────────────
const KEYS = ['id', 'read', 'tier', 'functions', 'mounts', 'params', 'parts', 'sockets', 'sig', 'ring', 'lead', 'cycle'];
const PART_KEYS = ['id', 'prim', 'block', 'role', 'group', 'value', 'many', 'repeat', 'at', 'yaw', 'params', 'socket'];
const isRail = (r) => Array.isArray(r) && ((typeof r[0] === 'number' && typeof r[1] === 'number' && r[0] <= r[1]) || (r.length && r.every((x) => typeof x === 'string')));

/** A block, checked against the vocabulary and its library: throws naming what is wrong; returns it. */
export function readBlock(B, library = {}) {
  const bad = (m) => { throw new Error(`blocks: ${B?.id ? `'${B.id}': ` : ''}${m}`); };
  if (!B || typeof B !== 'object' || Array.isArray(B)) bad('a block is { id, read, tier, functions, mounts, params?, parts, sockets?, sig? }');
  for (const k of Object.keys(B)) if (!KEYS.includes(k)) bad(`'${k}' is not a block setting (${KEYS.join(', ')})`);
  if (typeof B.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(B.id)) bad('id is lower-case words joined by hyphens');
  if (typeof B.read !== 'string' || !B.read) bad('read says what it is, in words');
  if (!TIERS[B.tier]) bad(`tier is ${TIER_IDS.join(', ')}`);
  for (const f of B.functions ?? []) if (!FUNCTIONS[f]) bad(`'${f}' is not a function (${FUNCTION_IDS.join(', ')})`);
  if (!Array.isArray(B.mounts) || !B.mounts.length || B.mounts.some((m) => !MOUNTS.includes(m))) bad(`mounts are some of ${MOUNTS.join(', ')}`);
  if (B.ring !== undefined && !STRUCTURE_RINGS[B.ring]) bad(`ring is ${STRUCTURE_RING_IDS.join(', ')}`);
  for (const [k, r] of Object.entries(B.params ?? {})) { if (k === 'many') bad('many is every block\'s own dial'); if (!isRail(r)) bad(`params.${k} is a rail: [lo, hi], [lo, hi, 'i'] or a list of words`); }
  // an automation is a machine and its cycle: the param its pose sweeps
  if (B.tier === 'automation' && !(B.cycle && typeof B.params?.[B.cycle]?.[0] === 'number')) bad('an automation names its cycle: a numeric param its pose sweeps');
  if (B.cycle !== undefined && typeof B.params?.[B.cycle]?.[0] !== 'number') bad(`cycle names '${B.cycle}', not a numeric param`);
  if (!Array.isArray(B.parts) || !B.parts.length) bad('parts is a list of primitives or blocks');
  const ids = new Set();
  for (const p of B.parts) {
    const pb = (m) => bad(`part '${p?.id ?? '?'}': ${m}`);
    for (const k of Object.keys(p)) if (!PART_KEYS.includes(k) && !(p.prim && PRIM_PARAM_KEYS.has(k))) pb(`'${k}' is not a part setting`);
    if (typeof p.id !== 'string' || !p.id) pb('needs an id');
    if (ids.has(p.id)) pb('ids are unique in a block');
    ids.add(p.id);
    if (!!p.prim === !!p.block) pb('is a prim (a primitive) or a block, one of them');
    if (p.prim && !PRIMITIVES[p.prim]) pb(`'${p.prim}' is not a primitive (${PRIMITIVE_IDS.join(', ')})`);
    if (p.block) { if (!library[p.block]) pb(`'${p.block}' is not in the library (${Object.keys(library).join(', ') || 'empty'})`); if (p.block === B.id) pb('a block cannot hold itself'); }
    if (p.role !== undefined && !ROLES.includes(p.role)) pb(`'${p.role}' is not a role (${ROLES.join(', ')})`);
    if (p.group !== undefined && !GROUPS.has(p.group)) pb(`'${p.group}' is not a group (${[...GROUPS].join(', ')})`);
    if (p.value !== undefined && (typeof p.value !== 'number' || p.value < 0 || p.value > 1)) pb('value is 0…1');
    if (p.many !== undefined && (typeof p.many !== 'number' || p.many < 0 || p.many > 1)) pb('many (the dial it appears at) is 0…1');
    if (p.socket !== undefined && !(B.sockets ?? {})[p.socket]) pb(`socket '${p.socket}' is not one of the block's sockets`);
  }
  for (const s of B.sig ?? []) if (!ids.has(s)) bad(`sig names '${s}', not a part`);
  if (B.lead !== undefined && !ids.has(B.lead)) bad(`lead names '${B.lead}', not a part`);
  return B;
}
const PRIM_PARAM_KEYS = new Set(['size', 'r', 'r2', 'h', 'sides', 'axis', 'from', 'to', 'depth', 'aim', 'w', 'member', 'bays', 't', 'seams', 'len', 'segs', 'bend', 'turn', 'l', 'tube']);
const VEC_KEYS = new Set(['size', 'from', 'to', 'aim', 'segs', 'bend']);

/** A block's params: the given ones (each inside its rail), the rest rolled from their rails by the seed; and `many`. */
export function blockParams(B, given = {}, seed = 1, many) {
  const D = dice(subSeed(seed, `block:${B.id}`)), out = {};
  for (const [k, r] of Object.entries(B.params ?? {})) {
    if (given[k] !== undefined) {
      const v = given[k];
      if (typeof r[0] === 'number' ? !(typeof v === 'number' && v >= r[0] - 1e-9 && v <= r[1] + 1e-9) : !r.includes(v)) throw new Error(`blocks: '${B.id}': ${k} = ${v} is outside its rail ${JSON.stringify(r)}`);
      out[k] = v;
    } else out[k] = D.roll(r);
  }
  for (const k of Object.keys(given)) if (k !== 'many' && !(k in (B.params ?? {}))) throw new Error(`blocks: '${B.id}' has no param '${k}' (${Object.keys(B.params ?? {}).join(', ') || 'none'}, many)`);
  out.many = Math.max(0, Math.min(1, many ?? given.many ?? 0.5));
  return out;
}

// ── building a block ────────────────────────────────────────────────────────────────────────────────────────────────
const yawed = (p, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
const place = (f, at, yaw) => ({ ...f, corners: f.corners.map((p) => add3(yawed(p, yaw), at).map(r3)), normal: yawed(f.normal, yaw).map(r3) });

/**
 * A block built at a ring: every part (each repeat a copy) in its place, a primitive under the eye spot drawn into the
 * tile (marks, never counted) and a signature part's loss recorded; child blocks built in their own frames and set in.
 * → { faces, parts: [{ id, role, prim|block, least, shown: 'geometry'|'tile'|'absent', n }], params, box, ring, counted }
 */
export function buildBlock(B, { params = {}, seed = 1, ring, library = {}, many, at = [0, 0, 0], yaw = 0, depth = 0, bevel = 0 } = {}) {
  readBlock(B, library);
  if (depth > 6) throw new Error(`blocks: '${B.id}' nests blocks more than six deep`);
  // a held block is judged at arm's length unless a ring is asked for
  const reach = ring === undefined && B.ring === undefined ? TIERS[B.tier].reach : undefined;
  const P = blockParams(B, params, seed, many), rg = ring ?? B.ring ?? TIERS[B.tier].ring, eye = reach ? r3(EYE_SPOT_PX * metresPerPixel(reach)) : eyeSpot(rg), faces = [], parts = [];
  for (const p of B.parts) {
    const shown = p.many === undefined || P.many >= p.many - 1e-9;
    const rep = p.repeat ? { n: Math.max(0, Math.round(expr(p.repeat.n, P))), step: vec(p.repeat.step, P), around: p.repeat.around !== undefined ? expr(p.repeat.around, P) : null } : { n: 1, step: [0, 0, 0], around: null };
    const base = add3(vec(p.at, P), p.socket ? vec(B.sockets[p.socket], P) : [0, 0, 0]), yaw0 = ((p.yaw === undefined ? 0 : expr(p.yaw, P)) * Math.PI) / 180;
    const rec = { id: p.id, role: p.role ?? null, ...(p.prim ? { prim: p.prim } : { block: p.block }), least: 0, shown: shown ? 'geometry' : 'absent', n: shown ? rep.n : 0 };
    parts.push(rec);
    if (!shown || !rep.n) { if (shown) rec.shown = 'absent'; continue; }
    for (let k = 0; k < rep.n; k++) {
      const kyaw = rep.around !== null ? (2 * Math.PI * k) / rep.n : 0, kat = rep.around !== null ? add3(base, yawed([rep.around, 0, 0], kyaw + yaw0)) : add3(base, rep.step, k);
      const local = [];
      if (p.prim) {
        const Pr = PRIMITIVES[p.prim], q = {};
        for (const [key, v] of Object.entries(p)) if (PRIM_PARAM_KEYS.has(key)) q[key] = key === 'axis' ? v : VEC_KEYS.has(key) ? vec(v, P) : expr(v, P);
        for (const [key, r] of Object.entries(Pr.rails)) {
          const vals = q[key] === undefined ? [] : Array.isArray(q[key]) ? q[key] : [q[key]];
          for (const v of vals) if (v < r[0] - 1e-9 || v > r[1] + 1e-9) throw new Error(`blocks: '${B.id}' part '${p.id}': ${key} ${r3(v)} is outside the ${p.prim}'s rail ${r[0]}–${r[1]}`);
        }
        rec.least = r3(Pr.least(q));
        const ex = { part: 'body', value: p.value ?? 0.6, extra: { group: p.group ?? 'tech:body', mass: `${B.id}/${p.id}${rep.n > 1 ? `#${k}` : ''}`, role: p.role ?? null, piece: p.id } };
        if (rec.least < eye - 1e-9) { rec.shown = 'tile'; ex.extra = { ...ex.extra, tile: true }; ex.part = 'bond'; }
        // (a bevel's steps by the part's size, as the supercar's detail: a small part a chamfer, a large one rounded;
        // a part under the eye spot too, the caller having asked: a machine seen closer than its ring)
        if (bevel > 0) { ex.bevel = bevel * rec.least; ex.segs = rec.least >= 0.2 ? 2 : 1; }
        Pr.build(local, q, ex, eye);
      } else {
        const child = buildBlock(library[p.block], { params: p.params ?? {}, seed: subSeed(seed, `${p.id}:${k}`), ring: rg, library, many: P.many, depth: depth + 1, bevel });
        rec.least = r3(Math.min(...child.parts.filter((c) => c.shown === 'geometry').map((c) => c.least), Infinity));
        rec.children = child.parts;
        if (!child.parts.some((c) => c.shown === 'geometry')) rec.shown = 'tile';
        for (const f of child.faces) local.push({ ...f, mass: `${B.id}/${p.id}${rep.n > 1 ? `#${k}` : ''}/${f.mass}`, role: f.role ?? p.role ?? null, piece: p.id });
      }
      for (const f of local) faces.push(place(f, kat, kyaw + yaw0));
    }
  }
  const out = faces.map((f) => place(f, at, (yaw * Math.PI) / 180));
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of out) for (const c of f.corners) { lo = lo.map((v, i) => Math.min(v, c[i])); hi = hi.map((v, i) => Math.max(v, c[i])); }
  if (!out.length) lo = hi = [0, 0, 0];
  return { id: B.id, faces: out, parts, params: P, box: { lo: lo.map(r3), hi: hi.map(r3), size: hi.map((v, i) => r3(v - lo[i])) }, ring: rg, ...(reach ? { reach } : {}), eye, counted: out.filter((f) => !f.tile).length };
}

// ── the laws ────────────────────────────────────────────────────────────────────────────────────────────────────────
// a role is present where its piece is drawn at all (geometry, or marks in the tile)
const rolesOf = (parts) => parts.flatMap((p) => (p.shown !== 'absent' ? [p.role, ...(p.children ? rolesOf(p.children) : [])] : [])).filter(Boolean);
/** The laws a built block holds (advisory: they measure and say; none refuses). */
export function blockLaws(B, built) {
  const out = [], law = (id, want, ok, value) => out.push({ law: id, want, ok, value });
  // one leads: the piece that takes most of the picture (its silhouette seen from the sheet's eye, every copy counted)
  // over every other by half again
  const F = [-0.47, 0.67, -0.5], area = {};
  for (const f of built.faces) if (!f.tile) {
    const k = -dot(f.normal, F);
    if (k <= 0) continue;
    const c = f.corners; let a = [0, 0, 0];
    for (let i = 1; i < c.length - 1; i++) a = add3(a, cross(sub(c[i], c[0]), sub(c[i + 1], c[0])), 0.5);
    area[f.piece] = (area[f.piece] ?? 0) + Math.hypot(...a) * k;
  }
  const ranked = Object.entries(area).sort((a, b) => b[1] - a[1]), lead = B.lead ? ranked.find(([id]) => id === B.lead) : ranked[0], next = ranked.find(([id]) => id !== lead?.[0]);
  law('one-leads', 'one piece leads: it takes ≥ 1.5 × the picture any other piece does', !!lead && (!next || lead[1] >= 1.5 * next[1] - 1e-9), lead ? `${lead[0]} ${r3(lead[1])} m²${next ? ` over ${next[0]} ${r3(next[1])} m²` : ''}` : 'nothing shown');
  // the function reads at its ring: its signature pieces are geometry there
  const lost = (B.sig ?? []).filter((id) => built.parts.find((p) => p.id === id)?.shown !== 'geometry');
  law('reads-at-ring', `the signature (${(B.sig ?? []).join(', ') || 'none named'}) is geometry at ${built.reach ? `arm's length, ${built.reach} m` : built.ring} (eye spot ${built.eye} m)`, !lost.length, lost.length ? `lost: ${lost.join(', ')}` : 'all shown');
  // what it is for shows: each function's reads find a shown piece in one of their roles
  const roles = new Set(rolesOf(built.parts)), missing = [];
  for (const f of B.functions ?? []) for (const any of FUNCTIONS[f].reads) if (!any.some((r) => roles.has(r))) missing.push(`${f}: ${any.join(' or ')}`);
  law('functions-read', 'every function it claims shows what the eye needs to read it (as geometry or in the tile)', !missing.length, missing.length ? `missing ${missing.join('; ')}` : (B.functions ?? []).join(', ') || 'no function claimed');
  // the accent is the status light, on what you use, and nothing else
  const status = new Set(built.faces.filter((f) => f.group === 'str:accent').map((f) => f.piece));
  law('one-status', 'at most one piece wears the accent: the status light', status.size <= 1, `${status.size}${status.size ? ` (${[...status].join(', ')})` : ''}`);
  // budget: the ring's faces, by the tier's share
  const cap = Math.round(STRUCTURE_RINGS[built.ring].budget * TIERS[B.tier].budget);
  law('budget', `≤ ${cap} faces at ${built.ring}`, built.counted <= cap, `${built.counted}`);
  // a ground block stands on the ground
  if (B.mounts.includes('ground')) law('stands', 'a block on the ground stands on it (its foot at 0)', Math.abs(built.box.lo[2]) <= 0.05, `foot at ${built.box.lo[2]} m`);
  return out;
}

// ── paint ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A kit's structure paint with the technology groups pointed at its ramps by a finish (the first ramp the kit has). */
export function blockPaint(kitId, finish = 'alloy') {
  const F = FINISHES[finish];
  if (!F) throw new Error(`blocks: '${finish}' is not a finish (${FINISH_IDS.join(', ')})`);
  const P = structurePaint(kitId), ramps = { ...P.ramps }, names = { ...P.names };
  for (const g of Object.keys(TECH_GROUPS)) for (const n of F[g]) { try { ramps[g] = madeRamp(kitId, n); names[g] = n; break; } catch { /* the next */ } }
  for (const g of Object.keys(TECH_GROUPS)) if (!ramps[g]) { ramps[g] = madeRamp(kitId, 'stone'); names[g] = 'stone'; }
  const materials = Object.fromEntries(Object.keys(TECH_GROUPS).map((g) => [g, FINISH_MATERIALS[finish][g] ?? null]));
  return { ...P, ramps, names, finish, materials };
}
