/**
 * THE FLEET'S FORMS — a capital ship read as one SHAPE, not a run of modules: the big silhouettes a screen fleet is
 * known by, each a family of the fleet's language (fleet/language.js) with its own way of being big:
 *
 *   WEDGE      an isosceles triangle in plan, its long sides mirrored to a point at the bow, its short side the stern;
 *              a shallow ridge down its spine, a rim band round its edge, a stepped superstructure aft rising to a
 *              command bridge on a neck, the drive's bells across the stern. Authority by mass and a point.
 *   CONCEPT    a pure solid (a cube, a sphere, an octahedron): no front, no back, nothing to read but the shape and the
 *              machinery all over it (the kibble at full); a few slabs of machinery proud of its faces, a sphere's
 *              trench and dish. Menace by abstraction.
 *   GLOBFORM   blobs in harmony along a main axis, blended where they meet (a smooth union), optionally ANCHORED by an
 *              angular shape (a slab under them, a hammer across the bow) that gives the soft masses a line; pods out
 *              on the flanks. A republic's courtesy: rounded, civil, still a ship.
 *
 * The detail is the shader's (scene/channels/hull-kibble.js): the polygons are the form and its few large parts, the
 * plating and the kit are drawn as parallax layers at each block's KIBBLE level (a superstructure, a concept solid at
 * full; a blob's soft skin light; an anchor dense). So a kilometre of hull costs hundreds of faces, not millions.
 *
 * Every form is destructible as the modular ships are: its volume cut into a grid of blocks (each box tightened to the
 * solid in it, so a collider is where the hull is), every face of the surface clipped to that grid and given to the
 * block it lies in, so what breaks takes its own plating with it; the blocks nearest the reactor its casing (the
 * anchors), the stern's its drive, the superstructure's its decks and tower.
 *
 *   buildForm(cls, C, { seed, look }) → the builder's piece { kind, label, length, pieces, faces, hardpoints, lights,
 *                                      core, anchor } (fleet/build.js buildCapital calls it for a class with a `form`)
 *   FORMS                             the families: each the parts of its shape from its class's row
 *   clipToGrid(poly, grid)            → [{ poly, cell }] a convex polygon cut by a grid's planes (pure; tested)
 *
 * Pure and seeded: the same class and seed, the same ship.
 */
import { mulberry32, strHash } from '../city/plan/dice.js';
import { surfaceNetFaces } from '../polygonizer/field-mesh.js';
import { FLEET_LOOKS, LIGHTS } from './language.js';

const r2 = (v) => Math.round(v * 100) / 100;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
const mid = (P) => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length, s[2] + p[2] / P.length], [0, 0, 0]);
/** A polygon's normal by Newell's sum (its winding's). */
function newell(P) {
  const n = [0, 0, 0];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return unit(n);
}
function tint(hex, k) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''); }

// ── CONVEX PARTS: each its polygons wound out from its own middle, its inside test, its bounds ──
function part(polys, inside, o = {}) {
  const all = polys.flat(), c = mid(all);
  const out = polys.map((P) => (dot(newell(P), sub(mid(P), c)) < 0 ? P.slice().reverse() : P));
  return { polys: out, inside, min: [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]))), ...o };
}
function boxPart(min, max, o = {}) {
  const [a, b] = [min, max], c = (x, y, z) => [x ? b[0] : a[0], y ? b[1] : a[1], z ? b[2] : a[2]];
  const polys = [[c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)],
    [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)]];
  return part(polys, (p) => p[0] > a[0] && p[0] < b[0] && p[1] > a[1] && p[1] < b[1] && p[2] > a[2] && p[2] < b[2], o);
}
/** A prism over a convex plan (points [x, y], wound either way) from z0 to z1. */
function planPrism(plan, z0, z1, o = {}) {
  const lo = plan.map(([x, y]) => [x, y, z0]), hi = plan.map(([x, y]) => [x, y, z1]);
  const sides = plan.map((_, i) => { const j = (i + 1) % plan.length; return [lo[i], lo[j], hi[j], hi[i]]; });
  const area = plan.reduce((s, p, i) => { const q = plan[(i + 1) % plan.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), w = area >= 0 ? 1 : -1;
  const inPlan = (x, y) => plan.every((p, i) => { const q = plan[(i + 1) % plan.length]; return w * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) > 0; });
  return part([lo, hi, ...sides], (p) => p[2] > z0 && p[2] < z1 && inPlan(p[0], p[1]), o);
}
/** A cylinder along x from x0 to x1 about (y, z), n sides. */
function drum(x0, x1, y, z, r, n, o = {}) {
  const ring = (x) => Array.from({ length: n }, (_, i) => [x, y + r * Math.cos((2 * Math.PI * i) / n), z + r * Math.sin((2 * Math.PI * i) / n)]);
  const A = ring(x0), B = ring(x1), sides = A.map((_, i) => { const j = (i + 1) % n; return [A[i], A[j], B[j], B[i]]; });
  return part([A, B, ...sides], (p) => p[0] > x0 && p[0] < x1 && Math.hypot(p[1] - y, p[2] - z) < r * Math.cos(Math.PI / n), o);
}
/** An ellipsoid of radii r about c, nu rings round and nv from pole to pole. */
function ellipsoid(c, r, nu, nv, o = {}) {
  const at = (i, j) => { const u = (2 * Math.PI * i) / nu, v = Math.PI * (j / nv - 0.5); return [c[0] + r[0] * Math.cos(v) * Math.cos(u), c[1] + r[1] * Math.cos(v) * Math.sin(u), c[2] + r[2] * Math.sin(v)]; };
  const polys = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    polys.push(j === 0 ? [q[0], q[2], q[3]] : j === nv - 1 ? [q[0], q[1], q[2]] : q);
  }
  return part(polys, (p) => ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2 < 1, o);
}
function octahedron(c, r, o = {}) {
  const v = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map((d) => [c[0] + d[0], c[1] + d[1], c[2] + d[2]]);
  const polys = [];
  for (const a of [0, 1]) for (const b of [2, 3]) for (const z of [4, 5]) polys.push([v[a], v[b], v[z]]);
  return part(polys, (p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) < r, o);
}

// ── THE GRID: a convex polygon cut by a grid's planes, each piece in its cell ──
function clipPlane(P, k, at, keepAbove) {
  const out = [], inS = (p) => (keepAbove ? p[k] >= at - 1e-9 : p[k] <= at + 1e-9);
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ia = inS(a), ib = inS(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (at - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out.length >= 3 ? out : null;
}
/** A convex polygon cut by the grid { min, size, n }: each piece and its cell [i, j, l] (a piece on a plane between two
 *  cells goes to the lower). */
export function clipToGrid(poly, G) {
  let pieces = [{ poly, cell: [] }];
  for (let k = 0; k < 3; k++) {
    const next = [];
    for (const { poly: P, cell } of pieces) {
      const lo = Math.min(...P.map((p) => p[k])), hi = Math.max(...P.map((p) => p[k]));
      const c0 = Math.max(0, Math.floor((lo - G.min[k]) / G.size[k] + 1e-9)), c1 = Math.min(G.n[k] - 1, Math.floor((hi - G.min[k]) / G.size[k] - 1e-9));
      for (let c = c0; c <= Math.max(c0, c1); c++) {
        let Q = P;
        if (c > c0) Q = Q && clipPlane(Q, k, G.min[k] + c * G.size[k], true);
        if (c < c1) Q = Q && clipPlane(Q, k, G.min[k] + (c + 1) * G.size[k], false);
        if (Q) next.push({ poly: Q, cell: [...cell, c] });
      }
    }
    pieces = next;
  }
  return pieces.filter((q) => { const a = q.poly; let s = 0; for (let i = 1; i < a.length - 1; i++) { const u = sub(a[i], a[0]), v = sub(a[i + 1], a[0]); s += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); } return s > 1e-4; });
}

// ── THE FAMILIES ──
// (each: its parts, a role for a point in it, its reactor's place, its lit faces and lights, where its guns go)
function wedgeForm(C, L0, rnd) {
  const L = C.length, W = C.beam, Ht = C.deck, Hb = C.keel, e = C.rim, xs = -L / 2, xb = L / 2;
  // the hull: the plan a point at the bow, the stern its short side; a rim band round the edge, the deck rising from
  // it to the ridge down the spine, the keel the same below
  const hull = part([
    [[xs, W / 2, e], [xs, 0, Ht], [xb, 0, 0]], [[xs, -W / 2, e], [xs, 0, Ht], [xb, 0, 0]],
    [[xs, W / 2, -e], [xs, 0, -Hb], [xb, 0, 0]], [[xs, -W / 2, -e], [xs, 0, -Hb], [xb, 0, 0]],
    [[xs, W / 2, -e], [xs, W / 2, e], [xb, 0, 0]], [[xs, -W / 2, -e], [xs, -W / 2, e], [xb, 0, 0]],
    [[xs, W / 2, -e], [xs, W / 2, e], [xs, 0, Ht], [xs, -W / 2, e], [xs, -W / 2, -e], [xs, 0, -Hb]],
  ], (p) => {
    const a = (xb - p[0]) / L, hw = (W / 2) * a;
    if (a <= 0 || a >= 1 || Math.abs(p[1]) >= hw) return false;
    const t = 1 - Math.abs(p[1]) / hw;
    return p[2] < a * (e + (Ht - e) * t) && p[2] > -a * (e + (Hb - e) * t);
  }, { role: 'hull', color: L0.base, faceColor: (n) => (Math.abs(n[2]) < 0.2 ? L0.trim : n[2] < 0 ? tint(L0.base, 0.86) : L0.base) });
  const parts = [hull];
  // the superstructure: tiers stepping up aft, each narrower; on the top one a neck and the bridge across it
  const at = (s) => xs + s * L;
  for (const [i, T] of (C.tiers || []).entries()) parts.push(boxPart([at(T.from), (-W / 2) * T.w, 0], [at(T.to), (W / 2) * T.w, Ht + T.h], { role: 'deck', color: tint(L0.base, 0.96 - 0.03 * i), tier: i }));
  let bridgeTop = Ht;
  if (C.tower) {
    const B = C.tower, top = Ht + Math.max(0, ...(C.tiers || []).map((t) => t.h)), cx = at(B.at);
    parts.push(boxPart([cx - B.len * 0.35, -B.neck / 2, top - 2], [cx + B.len * 0.35, B.neck / 2, top + B.h * 0.6], { role: 'tower', color: L0.trim }));
    parts.push(boxPart([cx - B.len / 2, -B.w / 2, top + B.h * 0.6], [cx + B.len / 2, B.w / 2, top + B.h], { role: 'tower', color: L0.base, bridge: true }));
    bridgeTop = top + B.h;
  }
  // the drive: bells across the stern, each a drum aft of it, its throat lit
  const lit = [], lights = [];
  const [nb, nu] = C.bells || [3, 1], bw = Math.min(W * 0.5 / nb, (Ht + Hb) * 0.5 / nu) * 0.42;
  for (let i = 0; i < nb; i++) for (let j = 0; j < nu; j++) {
    const y = (-W * 0.25) + (W * 0.5 * (i + 0.5)) / nb, z = -Hb * 0.25 + ((Ht * 0.6 + Hb * 0.25) * (j + 0.5)) / nu;
    parts.push(drum(xs - bw * 0.9, xs + 2, y, z, bw, 16, { role: 'drive', color: L0.dark }));
    lit.push({ corners: Array.from({ length: 16 }, (_, q) => [xs - bw * 0.9 - 0.2, y + bw * 0.72 * Math.cos((-2 * Math.PI * q) / 16), z + bw * 0.72 * Math.sin((-2 * Math.PI * q) / 16)]), n: [-1, 0, 0], color: LIGHTS.drive });
  }
  // windows: rows in the rim band, gapped by the dice; the bridge's lit strip
  const rimAt = (s, sy, h) => { const x = xs + s * L, hw = (W / 2) * ((xb - x) / L); return [x, sy * hw, h]; };
  const along = Math.hypot(L, W / 2), spacing = C.windowEvery ?? 16;
  for (const sy of [1, -1]) for (const h of [-e * 0.35, e * 0.35]) for (let s = 0.03; s < 0.85; s += spacing / along) {
    if (rnd() < 0.35) continue;
    const a0 = (xb - (xs + s * L)) / L, a = rimAt(s, sy, h * a0), b = rimAt(s + 3 / along, sy, h * a0);
    // (on the band, a hand's breadth proud of it, facing out from the side it is on)
    const nrm = unit([W / 2, sy * L, 0]), o = nrm.map((v) => v * 0.25), hh = Math.min(1.2, e * 0.12 * a0 + 0.3), z = h * a0;
    lit.push({ corners: [[a[0] + o[0], a[1] + o[1], z - hh], [b[0] + o[0], b[1] + o[1], z - hh], [b[0] + o[0], b[1] + o[1], z + hh], [a[0] + o[0], a[1] + o[1], z + hh]], n: nrm, color: LIGHTS.window });
  }
  if (C.tower) {
    const B = C.tower, cx = at(B.at), top = bridgeTop - B.h * 0.25;
    lit.push({ corners: [[cx + B.len / 2 + 0.2, -B.w * 0.42, top - 1.2], [cx + B.len / 2 + 0.2, B.w * 0.42, top - 1.2], [cx + B.len / 2 + 0.2, B.w * 0.42, top + 1.2], [cx + B.len / 2 + 0.2, -B.w * 0.42, top + 1.2]], n: [1, 0, 0], color: LIGHTS.window });
  }
  lights.push({ at: [xs + 1, W / 2 + 0.5, 0], color: LIGHTS.port }, { at: [xs + 1, -W / 2 - 0.5, 0], color: LIGHTS.starboard }, { at: [xb + 0.5, 0, 0], color: LIGHTS.strobe }, { at: [at(C.tower ? C.tower.at : 0.1), 0, bridgeTop + 2], color: LIGHTS.strobe });
  // its guns: along the rim's top edge both sides, and on the tiers
  const guns = (C.guns || []).map((G) => (G.on === 'tier' ? { from: [at(G.at), (G.y ?? 0) * W / 2, Ht + 400], dir: [0, 0, -1] } : (() => { const s = G.at, sy = G.on === 'port' ? 1 : -1, p = rimAt(s, sy, 0); return { from: [p[0], p[1] * (G.y ?? 0.8), Ht + 400], dir: [0, 0, -1] }; })()));
  // (the reactor low in the hull, its casing the keel's: reached from below, a run under the ship)
  const ca = C.coreAt ?? 0.22;
  return { parts, lit, lights, guns, core: [xs + L * ca, 0, -0.5 * Hb * (1 - ca)], driveX: xs + L * 0.06, length: L };
}

function conceptForm(C, L0, rnd) {
  const S = C.size, h = S / 2, parts = [], lit = [], lights = [];
  if (C.shape === 'cube') {
    parts.push(boxPart([-h, -h, -h], [h, h, h], { role: 'hull', color: L0.base }));
    // slabs of machinery proud of each face: one big, some medium (the kibble is the many small)
    for (let f = 0; f < 6; f++) {
      const k = f >> 1, s = f & 1 ? 1 : -1, u = (k + 1) % 3, v = (k + 2) % 3;
      for (let i = 0; i < (C.slabs ?? 4); i++) {
        const w = S * (i === 0 ? 0.3 : 0.08 + 0.12 * rnd()), d = S * (i === 0 ? 0.3 : 0.08 + 0.14 * rnd()), cu = (rnd() - 0.5) * (S - w) * 0.9, cv = (rnd() - 0.5) * (S - d) * 0.9, t = S * (0.012 + 0.02 * rnd());
        const mn = [0, 0, 0], mx = [0, 0, 0]; mn[u] = cu - w / 2; mx[u] = cu + w / 2; mn[v] = cv - d / 2; mx[v] = cv + d / 2;
        mn[k] = s > 0 ? h - 1 : -h - t; mx[k] = s > 0 ? h + t : -h + 1;
        parts.push(boxPart(mn, mx, { role: 'deck', color: tint(L0.base, 0.82 + 0.2 * rnd()) }));
      }
    }
    for (const c of [[1, 1, 1], [-1, -1, 1], [1, -1, -1], [-1, 1, -1]]) lights.push({ at: c.map((v) => v * (h + 0.5)), color: LIGHTS.strobe });
  } else if (C.shape === 'sphere') {
    const n = Math.max(24, Math.round((Math.PI * S) / (C.cell * 0.55)));
    // (its trench round the equator darker; its dish a dark bowl to one side with a lit ring)
    const trench = C.trench ? S * 0.025 : 0, dish = C.dish ? unit([0.55, 0.6, 0.58]) : null;
    const E = ellipsoid([0, 0, 0], [h, h, h], n, Math.round(n / 2), { role: 'hull', color: L0.base,
      faceColor: (nn) => (trench && Math.abs(nn[2]) < trench / h * 1.6 ? L0.dark : dish && dot(nn, dish) > 0.93 ? (dot(nn, dish) > 0.985 ? L0.dark : tint(L0.base, 0.7)) : L0.base) });
    parts.push(E);
    if (dish) lights.push({ at: dish.map((v) => v * (h + 0.5)), color: LIGHTS.drive });
    if (trench) for (let i = 0; i < 24; i++) { const u = (2 * Math.PI * i) / 24; lights.push({ at: [Math.cos(u) * (h + 0.3), Math.sin(u) * (h + 0.3), 0], color: LIGHTS.window }); }
  } else {
    parts.push(octahedron([0, 0, 0], h, { role: 'hull', color: L0.base, faceColor: (nn) => (nn[2] > 0 ? L0.base : tint(L0.base, 0.84)) }));
    // (its belt: a ring of lit points round the waist)
    for (let i = 0; i < 16; i++) { const u = (2 * Math.PI * i) / 16, r = h / (Math.abs(Math.cos(u)) + Math.abs(Math.sin(u))); lights.push({ at: [Math.cos(u) * (r + 0.4), Math.sin(u) * (r + 0.4), 0], color: LIGHTS.window }); }
  }
  // its guns: on every side
  // (each a little off the face's middle, so it does not sit on the middle slab)
  const guns = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].slice(0, C.guns ?? 6)
    .map((d) => ({ from: d.map((v, k) => v * S + (k === (d[2] ? 0 : 2) ? S * 0.2 : 0)), dir: d.map((v) => -v) }));
  // (its reactor under one face, the weak point a pilot finds: a sphere's under its dish, a solid's under its keel side)
  const cw = C.shape === 'sphere' && C.dish ? unit([0.55, 0.6, 0.58]) : [0, 0, -1];
  return { parts, lit, lights, guns, core: cw.map((v) => v * h * 0.8), driveX: -Infinity, length: S };
}

function globForm(C, L0, rnd) {
  const L = C.length, xs = -L / 2, at = (s) => xs + s * L, k = C.blend ?? 20;
  const globs = C.globs.map((g) => ({ c: [at(g.at), g.y ?? 0, g.z ?? 0], r: g.r }));
  // (the blobs' smooth union: each an ellipsoid's distance, joined by a polynomial smooth minimum `blend` m wide)
  const ell = (p, g) => { const q = [(p[0] - g.c[0]) / g.r[0], (p[1] - g.c[1]) / g.r[1], (p[2] - g.c[2]) / g.r[2]]; return (Math.hypot(...q) - 1) * Math.min(...g.r); };
  const smin = (a, b) => { const hh = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * hh - k * hh * (1 - hh); };
  const sdf = (p) => globs.reduce((d, g, i) => (i ? smin(d, ell(p, g)) : ell(p, g)), Infinity);
  const parts = [], lit = [], lights = [];
  // the anchor: an angular shape the blobs ride on (a slab along the keel, a prow past the bow; a hammer across it)
  if (C.anchor) {
    const A = C.anchor, plan = A.plan.map(([s, w]) => [at(s), w * C.beam / 2]);
    parts.push(planPrism(plan, A.z - A.h / 2, A.z + A.h / 2, { role: 'deck', color: L0.trim, anchor: true }));
  }
  // pods on the flanks: a drum each, its throat lit aft
  for (const P of C.pods || []) for (const sy of [1, -1]) {
    const x0 = at(P.at), x1 = at(P.at + P.len), y = sy * P.y;
    parts.push(drum(x0, x1, y, P.z ?? 0, P.r, 14, { role: 'drive', color: L0.trim }));
    parts.push(boxPart([x0 + (x1 - x0) * 0.3, Math.min(0, y), -P.r * 0.2], [x0 + (x1 - x0) * 0.6, Math.max(0, y), P.r * 0.2], { role: 'truss', color: L0.dark }));
    lit.push({ corners: Array.from({ length: 14 }, (_, q) => [x0 - 0.2, y + P.r * 0.7 * Math.cos((-2 * Math.PI * q) / 14), (P.z ?? 0) + P.r * 0.7 * Math.sin((-2 * Math.PI * q) / 14)]), n: [-1, 0, 0], color: LIGHTS.drive });
  }
  // windows: a row round each blob's waist, gapped by the dice
  for (const g of globs) {
    const n = Math.round((Math.PI * (g.r[0] + g.r[1])) / (C.windowEvery ?? 14));
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.4) continue;
      const u = (2 * Math.PI * i) / n, du = 2.5 / Math.max(g.r[0], g.r[1]), p = (uu, z) => [g.c[0] + (g.r[0] + 0.3) * Math.cos(uu), g.c[1] + (g.r[1] + 0.3) * Math.sin(uu), g.c[2] + z];
      const nn = unit([Math.cos(u) / g.r[0], Math.sin(u) / g.r[1], 0]);
      if (sdf(p(u, 0)) < -0.5) continue;   // (where another blob swallows it)
      lit.push({ corners: [p(u, -1), p(u + du, -1), p(u + du, 1), p(u, 1)], n: nn, color: LIGHTS.window });
    }
  }
  const front = globs.reduce((a, g) => (g.c[0] + g.r[0] > a.c[0] + a.r[0] ? g : a)), back = globs.reduce((a, g) => (g.c[0] - g.r[0] < a.c[0] - a.r[0] ? g : a));
  lights.push({ at: [front.c[0] + front.r[0] + 0.5, 0, front.c[2]], color: LIGHTS.strobe }, { at: [back.c[0], back.r[1] + 0.5, back.c[2]], color: LIGHTS.port }, { at: [back.c[0], -back.r[1] - 0.5, back.c[2]], color: LIGHTS.starboard });
  // the drive: the stern blob's tail lit
  lit.push({ corners: Array.from({ length: 16 }, (_, q) => [back.c[0] - back.r[0] - 0.4 + back.r[0] * 0.08, back.c[1] + back.r[1] * 0.35 * Math.cos((-2 * Math.PI * q) / 16), back.c[2] + back.r[2] * 0.35 * Math.sin((-2 * Math.PI * q) / 16)]), n: [-1, 0, 0], color: LIGHTS.drive });
  const guns = (C.guns || []).map((G) => ({ from: [at(G.at), G.y ?? 0, G.on === 'bottom' ? -1000 : 1000], dir: [0, 0, G.on === 'bottom' ? 1 : -1] }));
  const lo = [0, 1, 2].map((q) => Math.min(...globs.map((g) => g.c[q] - g.r[q])) - k), hi = [0, 1, 2].map((q) => Math.max(...globs.map((g) => g.c[q] + g.r[q])) + k);
  return { parts, blob: { sdf, min: lo, max: hi, role: 'hull', color: L0.base, cells: C.skin ?? 56 }, lit, lights, guns, core: (() => { const g = globs[C.coreGlob ?? 1] || globs[0]; return [g.c[0], g.c[1], g.c[2] - g.r[2] * 0.75]; })(), driveX: back.c[0] - back.r[0] * 0.5, length: L };
}

export const FORMS = Object.freeze({ wedge: wedgeForm, concept: conceptForm, globform: globForm });

/** A class with a `form` built as that form: its parts and skin, its blocks the grid's cells tightened to the solid,
 *  each face clipped to its block, the reactor's cells its anchors, its guns found on its surface. */
export function buildForm(cls, C, { seed = 1, look } = {}) {
  const L0 = FLEET_LOOKS[look ?? C.look] ?? FLEET_LOOKS.navy, rnd = mulberry32(strHash(`form|${cls}|${seed}`));
  const F = FORMS[C.form](C, L0, rnd);
  const inside = (p) => F.parts.some((q) => q.inside(p)) || (F.blob ? F.blob.sdf(p) < 0 : false);
  const lo = [0, 1, 2].map((k) => Math.min(...F.parts.map((q) => q.min[k]), F.blob ? F.blob.min[k] : Infinity));
  const hi = [0, 1, 2].map((k) => Math.max(...F.parts.map((q) => q.max[k]), F.blob ? F.blob.max[k] : -Infinity));
  const n = [0, 1, 2].map((k) => Math.max(1, Math.round((hi[k] - lo[k]) / C.cell))), G = { min: lo, size: [0, 1, 2].map((k) => (hi[k] - lo[k]) / n[k]), n };
  // the blocks: each cell the solid fills some of, its box the samples inside it (a collider where the hull is)
  const S = C.samples ?? 6, cells = new Map(), pieces = [];
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let l = 0; l < n[2]; l++) {
    const c0 = [lo[0] + i * G.size[0], lo[1] + j * G.size[1], lo[2] + l * G.size[2]], step = G.size.map((s) => s / S);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], sum = [0, 0, 0];
    let m = 0;
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) for (let d = 0; d < S; d++) {
      const p = [c0[0] + (a + 0.5) * step[0], c0[1] + (b + 0.5) * step[1], c0[2] + (d + 0.5) * step[2]];
      if (!inside(p)) continue;
      m++; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - step[k] / 2); mx[k] = Math.max(mx[k], p[k] + step[k] / 2); sum[k] += p[k]; }
    }
    if (!m) continue;
    const at = sum.map((v) => v / m), role = roleAt(F, at);
    const p = { id: `c${i}.${j}.${l}`, role, min: mn.map(r2), max: mx.map(r2), share: m / (S * S * S), at };
    cells.set(`${i},${j},${l}`, p); pieces.push(p);
  }
  // (adjacent cells' boxes meet: a box shrunk to its samples is grown back to its neighbour's face where they touch,
  // so the welds that hold a ship together hold)
  for (const p of pieces) {
    const [i, j, l] = p.id.slice(1).split('.').map(Number), cc = [i, j, l];
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const q = cc.slice(); q[k] += s;
      if (!cells.has(q.join(','))) continue;
      const face = lo[k] + (cc[k] + (s > 0 ? 1 : 0)) * G.size[k];
      if (s > 0) p.max[k] = r2(face); else p.min[k] = r2(face);
    }
  }
  const nearest = (c) => { let best = null, bd = Infinity; for (const p of pieces) { const d = Math.hypot(...[0, 1, 2].map((k) => Math.max(p.min[k] - c[k], 0, c[k] - p.max[k]))); if (d < bd) { bd = d; best = p; } } return best; };
  const cellOf = (c) => cells.get(c.join(',')) || null;
  // the reactor: the cells nearest its place, its casing, the anchors
  const core = pieces.slice().sort((a, b) => Math.hypot(...sub(a.at, F.core)) - Math.hypot(...sub(b.at, F.core)) || (a.id < b.id ? -1 : 1)).slice(0, C.coreCells ?? 2);
  for (const p of core) p.role = 'core';
  // the faces: every part's polygons clipped to the grid, hidden ones (inside another part) dropped; the skin's quads
  // (each block's plating its own tone a little off its neighbours', a part's the same across it: a plate replaced at
  // its own time; the seams and the kit within it are the kibble's)
  const faces = [], vary = L0.vary ?? 0.05, toneOf = new Map();
  const give = (poly, n, color, cell, litFace = false, part = 0) => {
    const c = mid(poly), p = (cell && cellOf(cell)) || nearest(c), key = `${p.id}|${part}`;
    if (!toneOf.has(key)) toneOf.set(key, 1 + vary * (2 * rnd() - 1));
    faces.push({ corners: poly.map((q) => q.map(r2)), n: n.map((v) => Math.round(v * 1e4) / 1e4), color: litFace ? color : tint(color, toneOf.get(key)), lit: litFace, piece: p.id });
  };
  // (a face is dropped only where all of it is buried in another part: a face half in, half out is drawn, and the other
  // part's own faces cover the buried half)
  const buried = (Q, nn, skip) => [mid(Q), ...Q].every((q) => { const o = [q[0] + nn[0] * 0.3, q[1] + nn[1] * 0.3, q[2] + nn[2] * 0.3]; return F.parts.some((x, xi) => xi !== skip && x.inside(o)) || (skip >= 0 && F.blob ? F.blob.sdf(o) < 0 : false); });
  for (const [pi, Pt] of F.parts.entries()) {
    for (const poly of Pt.polys) {
      const nn = newell(poly), color = Pt.faceColor ? Pt.faceColor(nn) : Pt.color;
      for (const { poly: Q, cell } of clipToGrid(poly, G)) if (!buried(Q, nn, pi)) give(Q, nn, color, cell, false, pi + 1);
    }
  }
  if (F.blob) {
    const B = F.blob, quads = surfaceNetFaces((p) => B.sdf([p.x, p.y, p.z]), { min: { x: B.min[0], y: B.min[1], z: B.min[2] }, max: { x: B.max[0], y: B.max[1], z: B.max[2] } }, { cells: B.cells });
    for (const q of quads) {
      const P = q.corners.map((v) => [v.x, v.y, v.z]), c = mid(P), nn = unit(q.n);
      if (buried(P, nn, -1)) continue;
      const cell = [0, 1, 2].map((k) => Math.max(0, Math.min(n[k] - 1, Math.floor((c[k] - lo[k]) / G.size[k]))));
      give(P, nn, B.color, cell, false, 0);
    }
  }
  for (const f of F.lit) give(f.corners, f.n, f.color, null, true);
  // its guns: each where a ray down onto the hull meets it, a turret there (its faces its block's), facing out
  const hard = [];
  for (const g of F.guns) {
    const d = unit(g.dir), stepL = Math.max(0.5, C.cell / 40);
    let p = g.from.slice(), hit = null;
    for (let t = 0; t < 4000 && !hit; t++) { p = [p[0] + d[0] * stepL, p[1] + d[1] * stepL, p[2] + d[2] * stepL]; if (inside(p)) hit = p; }
    if (!hit) continue;
    const up = d.map((v) => -v), at = hit.map((v, k) => v + up[k] * 0.2), host = nearest(hit.map((v, k) => v - up[k] * 1));
    const sz = C.turret ?? Math.max(4, C.cell * 0.12), axis = [0, 1, 2].reduce((a, k) => (Math.abs(up[k]) > Math.abs(up[a]) ? k : a), 0);
    const mn = at.map((v, k) => (k === axis ? (up[k] > 0 ? v - 0.5 : v - sz * 0.7) : v - sz)), mx = at.map((v, k) => (k === axis ? (up[k] > 0 ? v + sz * 0.7 : v + 0.5) : v + sz));
    for (const poly of boxPart(mn, mx).polys) faces.push({ corners: poly.map((q) => q.map(r2)), n: newell(poly), color: L0.trim, lit: false, piece: host.id });
    const c = at.map((v, k) => r2(v + up[k] * sz * 0.9));
    hard.push({ id: host.id, at: c, up });
  }
  const lights = F.lights.map((l) => ({ at: l.at.map(r2), color: l.color, piece: nearest(l.at).id }));
  // (a form's kibble by role: its own levels over the language's, the shader carrying the detail the polygons leave out)
  const out = pieces.map(({ at: _a, share: _s, ...p }) => (C.kibble && C.kibble[p.role] !== undefined ? { ...p, kibble: C.kibble[p.role] } : p));
  return { kind: cls, label: C.label, length: F.length, pieces: out, faces, hardpoints: hard, lights, core: core.map((p) => p.id), anchor: core.map((p) => p.id) };
}

/** A point's role in a form: the part it is in (a tier a deck, a tower, a pod a drive), the stern's cells the drive's,
 *  the rest hull. */
function roleAt(F, p) {
  for (const q of F.parts) if (q.role !== 'hull' && q.inside(p)) return q.role;
  return p[0] < F.driveX ? 'drive' : 'hull';
}
