// vegetation/tree-mesh — turn a grown plant into triangles: tubes along the axes (parallel transport), leaves as
// quads (Beer–Lambert tone from the growth engine's own shadow grid), needles as bottle-brush cards, palm fronds and
// grass blades as ELASTICA strips (mechanics.js: the shape a blade takes under its own weight is one number, B).
// Level of detail rides the pipe model: an axis whose diameter is under `minDiameter` is not drawn, and its foliage
// is carried by a cluster blob at its parent (`clusterFrom`).
import { elastica } from './mechanics.js';
import { mulberry32, vec, rot } from './grow.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';
const { add, sub, mul, dot, cross, len, unit } = vec;
const UP = [0, 0, 1];
const DEG = Math.PI / 180;
function perp(d) { const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const u = unit(cross(a, d)); return u; }

export const TONES = {
  shoot: [104, 138, 64], herbStem: [96, 136, 70], bark: [112, 96, 80], oldBark: [96, 90, 84],
  leaf: [74, 118, 50], leafLit: [128, 168, 76], needle: [44, 82, 52], needleLit: [78, 120, 72], frond: [86, 128, 60], grass: [96, 142, 64], grassTip: [170, 176, 104],
};

/** The axes of a plant as chains of points with radii, and what each axis carries. */
export function axisChains(plant) {
  const { nodes, axes } = plant; const by = new Map();
  for (const n of nodes) { if (n.died || n.parent < 0) continue; if (!by.has(n.axis)) by.set(n.axis, []); by.get(n.axis).push(n); }
  const chains = [];
  for (const [a, ns] of by) {
    const first = ns[0]; const base = nodes[first.parent];
    const pts = [base.pos, ...ns.map((n) => n.pos)]; const rs = [first.r, ...ns.map((n) => n.r)];
    const last = ns[ns.length - 1]; const continues = (plant.children.get(last.id) || []).some((c) => !nodes[c].died);
    chains.push({ axis: a, order: axes[a].order, nodes: ns, pts, rs, dMax: 2 * Math.max(...rs), born: ns.map((n) => n.born), baseNode: base.id, continues });
  }
  return chains;
}

/** A tube along a chain: k sides per ring, parallel-transported frames, a cone cap at the tip. */
export function tubeTris(chain, { sidesFor, colorFor }) {
  const { pts, rs } = chain; const m = pts.length; if (m < 2) return [];
  const T = pts.map((_, i) => unit(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N = perp(T[0]); const frames = [];
  for (let i = 0; i < m; i++) { N = unit(sub(N, mul(T[i], dot(N, T[i])))); if (len(N) < 1e-6) N = perp(T[i]); frames.push([N, cross(T[i], N)]); }
  const k = sidesFor(Math.max(...rs), chain);
  const ring = (i) => { const [n, b] = frames[i]; const out = []; for (let j = 0; j < k; j++) { const a = (2 * Math.PI * j) / k; out.push(add(pts[i], add(mul(n, rs[i] * dmath.cos(a)), mul(b, rs[i] * dmath.sin(a))))); } return out; };
  const tris = []; let prev = ring(0);
  for (let i = 1; i < m; i++) {
    const cur = i === m - 1 && !chain.continues ? null : ring(i); const c = colorFor(chain, i);
    if (cur) { for (let j = 0; j < k; j++) { const j2 = (j + 1) % k; tris.push({ p: [prev[j], prev[j2], cur[j2]], c, kind: 'wood' }, { p: [prev[j], cur[j2], cur[j]], c, kind: 'wood' }); } prev = cur; }
    else for (let j = 0; j < k; j++) tris.push({ p: [prev[j], prev[(j + 1) % k], pts[i]], c, kind: 'wood' });   // the tip cone
  }
  return tris;
}

/**
 * A thick axis as bark quads: the same parallel-transported rings as `tubeTris`, each side a quad carrying uv in tiles
 * (u round the circumference, v up the length, both in metres over `tile`), its outward normal, and `color` for a
 * consumer without the texture, under the tile's `key`. → [{ q: [4 corners], uv, n, c, key, kind: 'bark' }]. No tip cone.
 */
export function barkQuads(chain, { sidesFor, tile, color, key = 'bark' }) {
  const { pts, rs } = chain; const m = pts.length; if (m < 2) return [];
  const T = pts.map((_, i) => unit(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N = perp(T[0]); const frames = [];
  for (let i = 0; i < m; i++) { N = unit(sub(N, mul(T[i], dot(N, T[i])))); if (len(N) < 1e-6) N = perp(T[i]); frames.push([N, cross(T[i], N)]); }
  const k = sidesFor(Math.max(...rs), chain);
  const ring = (i) => { const [n, b] = frames[i]; const out = []; for (let j = 0; j <= k; j++) { const a = (2 * Math.PI * j) / k; out.push(add(pts[i], add(mul(n, rs[i] * dmath.cos(a)), mul(b, rs[i] * dmath.sin(a))))); } return out; };
  const quads = []; let prev = ring(0), v0 = 0;
  for (let i = 1; i < m; i++) {
    const cur = ring(i); const v1 = v0 + len(sub(pts[i], pts[i - 1])) / tile; const circ = (Math.PI * (rs[i] + rs[i - 1])) / tile;
    const mid = mul(add(pts[i], pts[i - 1]), 0.5);
    for (let j = 0; j < k; j++) {
      const q = [prev[j], prev[j + 1], cur[j + 1], cur[j]]; const c = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
      let n = unit(cross(sub(q[1], q[0]), sub(q[3], q[0]))); if (dot(n, sub(c, mid)) < 0) n = mul(n, -1);
      const u0 = (circ * j) / k, u1 = (circ * (j + 1)) / k;
      quads.push({ q, uv: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], n, c: color, key, kind: 'bark' });
    }
    prev = cur; v0 = v1;
  }
  return quads;
}
/** Bark tone: green where the shoot is young or unlignified, brown then grey as the wood ages. */
export function woodTone(plant) {
  const P = plant.params; const Y = P.years;
  return (chain, i) => {
    const n = chain.nodes[Math.min(chain.nodes.length - 1, i - 1)]; const age = Y - n.born;
    const woody = P.lignin * P.cambium * Math.min(1, age / 3) + (plant.arch.monocot ? P.lignin * 0.6 : 0);
    const base = mix(P.lignin < 0.6 ? TONES.herbStem : TONES.shoot, TONES.bark, Math.min(1, woody));
    return mix(base, TONES.oldBark, Math.min(1, Math.max(0, (n.r - 0.03) / 0.2)));
  };
}
export const defaultSides = (r) => (r > 0.08 ? 10 : r > 0.03 ? 8 : r > 0.012 ? 6 : r > 0.004 ? 4 : 3);

/** Leaves on every live leafy node: quads (broadleaf), crossed cards (needles), or elastica fronds (palms). */
export function leafTris(plant, { seed = 7, scale = 1, only = null } = {}) {
  const { nodes, arch } = plant; const rng = mulberry32(seed); const tris = [];
  for (const n of nodes) {
    if (n.died || !n.leaves || (only && !only(n))) continue;
    const e = plant.exposure(n.pos); const tone = 0.32 + 0.68 * Math.min(1, e);
    if (arch.frond) { for (const x of frondTris(n, arch, rng, tone)) tris.push(x); continue; }
    if (arch.needles) {
      const par = nodes[n.parent]; const a = par.pos, b = n.pos; const w = arch.leafSize * 1.3 * scale;
      const s1 = unit(cross(sub(b, a), UP)); const s2 = unit(cross(sub(b, a), s1)); const c = mix(TONES.needle, TONES.needleLit, tone - 0.3);
      for (const s of [s1, s2]) { const p = [add(a, mul(s, -w)), add(a, mul(s, w)), add(b, mul(s, w)), add(b, mul(s, -w))]; tris.push({ p: [p[0], p[1], p[2]], c, kind: 'leaf' }, { p: [p[0], p[2], p[3]], c, kind: 'leaf' }); }
      continue;
    }
    for (let j = 0; j < n.leaves; j++) {
      const size = arch.leafSize * (0.8 + 0.4 * rng()) * scale; const phi = (n.id * 137.5 + j * 180 + rng() * 40) * DEG;
      const [u] = [perp(n.dir)]; const w = cross(n.dir, u);
      let ld = unit(add(mul(n.dir, dmath.cos(55 * DEG)), mul(add(mul(u, dmath.cos(phi)), mul(w, dmath.sin(phi))), dmath.sin(55 * DEG))));
      ld = unit(add(ld, [0, 0, -0.25]));                               // leaves hang a little on their petiole
      const side = unit(cross(ld, UP)); const sd = len(side) < 1e-6 ? u : side;
      const b0 = add(n.pos, mul(ld, size * 0.25)); const tip = add(b0, mul(ld, size)); const mid = add(b0, mul(ld, size * 0.4));
      const tilt = (rng() - 0.5) * 0.5; const sw = unit(add(sd, [0, 0, tilt])); const hw = size * 0.28;
      const L = add(mid, mul(sw, hw)), R = add(mid, mul(sw, -hw));
      const c = mix(TONES.leaf, TONES.leafLit, Math.max(0, Math.min(1, tone + (rng() - 0.5) * 0.15)));
      tris.push({ p: [b0, L, tip], c, kind: 'leaf' }, { p: [b0, tip, R], c, kind: 'leaf' });
    }
  }
  return tris;
}
/** A palm frond: an elastica under its own weight (B ≈ 3–8), a V-keeled strip of pinnae. */
function frondTris(n, arch, rng, tone) {
  const L = arch.leafSize * (0.85 + 0.3 * rng()); const B = 2.5 + 5 * rng(); const th0 = (35 + 30 * rng()) * DEG;
  const e = elastica({ B, theta0: th0, n: 24 }); const az = (n.id * 137.5) * DEG;
  const hor = [dmath.cos(az), dmath.sin(az), 0]; const side = [-dmath.sin(az), dmath.cos(az), 0];
  const pts = e.pts.filter((_, i) => i % 2 === 0).map(([x, y]) => add(n.pos, add(mul(hor, x * L), [0, 0, y * L])));
  const tris = []; const c = mix(TONES.frond, TONES.leafLit, tone - 0.2);
  for (let i = 0; i < pts.length - 1; i++) {
    const s0 = i / (pts.length - 1), s1 = (i + 1) / (pts.length - 1); const w0 = 0.22 * L * dmath.pow(dmath.sin(Math.PI * Math.min(0.95, s0 + 0.05)), 0.6), w1 = 0.22 * L * dmath.pow(dmath.sin(Math.PI * Math.min(0.95, s1 + 0.05)), 0.6);
    for (const sg of [1, -1]) {
      const k0 = add(pts[i], add(mul(side, sg * w0), [0, 0, -0.25 * w0])), k1 = add(pts[i + 1], add(mul(side, sg * w1), [0, 0, -0.25 * w1]));
      tris.push({ p: [pts[i], k0, k1], c, kind: 'leaf' }, { p: [pts[i], k1, pts[i + 1]], c, kind: 'leaf' });
    }
  }
  return tris;
}

/** A grass tuft: tillers from one crown, each blade an elastica with its own bending number. No wood at all. */
export function tuftTris({ blades = 60, height = 0.5, width = 0.008, B = [4, 30], seed = 1, spread = 0.04 } = {}) {
  const rng = mulberry32(seed); const tris = [];
  for (let b = 0; b < blades; b++) {
    const Bi = B[0] * dmath.pow(B[1] / B[0], rng()); const th0 = (58 + 30 * rng()) * DEG; const L = height * (0.6 + 0.7 * rng());
    const e = elastica({ B: Bi, theta0: th0, n: 16 }); const az = rng() * 2 * Math.PI; const hor = [dmath.cos(az), dmath.sin(az), 0]; const side = [-hor[1], hor[0], 0];
    const root = [spread * (rng() - 0.5), spread * (rng() - 0.5), 0];
    const pts = e.pts.filter((_, i) => i % 2 === 0).map(([x, y]) => add(root, add(mul(hor, x * L), [0, 0, y * L])));
    for (let i = 0; i < pts.length - 1; i++) {
      const s0 = i / (pts.length - 1), s1 = (i + 1) / (pts.length - 1); const w0 = width * (1 - s0 * 0.9), w1 = width * (1 - s1 * 0.9);
      const c = mix(TONES.grass, TONES.grassTip, s0 * 0.8);
      const a0 = add(pts[i], mul(side, w0)), a1 = add(pts[i], mul(side, -w0)), b0 = add(pts[i + 1], mul(side, w1)), b1 = add(pts[i + 1], mul(side, -w1));
      tris.push({ p: [a0, a1, b1], c, kind: 'leaf' }, { p: [a0, b1, b0], c, kind: 'leaf' });
    }
  }
  return tris;
}

/** A low-poly blob (icosahedron, optionally subdivided once) for a foliage cluster or a far crown. */
export function blobTris(center, radii, color, { detail = 0, squash = 1, colorAt = null } = {}) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(unit);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map(); const midp = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!cache.has(k)) { V.push(unit(mul(add(V[a], V[b]), 0.5))); cache.set(k, V.length - 1); } return cache.get(k); };
    const F2 = []; for (const [a, b, c] of F) { const ab = midp(a, b), bc = midp(b, c), ca = midp(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } F = F2;
  }
  const r = Array.isArray(radii) ? radii : [radii, radii, radii * squash];
  const P = V.map((v) => add(center, [v[0] * r[0], v[1] * r[1], v[2] * r[2]]));
  return F.map(([a, b, c]) => { const p = [P[a], P[b], P[c]]; const m = mul(add(add(p[0], p[1]), p[2]), 1 / 3); return { p, c: colorAt ? colorAt(m, sub(m, center)) : color, kind: 'leaf' }; });
}

/** The whole plant at full detail. Returns { tris, counts }. */
export function plantTris(plant, { sidesFor = defaultSides, minDiameter = 0, leaves = true, seed = 7, leafScale = 1 } = {}) {
  const chains = axisChains(plant); const colorFor = woodTone(plant); const tris = []; let wood = 0, leaf = 0;
  for (const ch of chains) { if (ch.dMax < minDiameter) continue; const t = tubeTris(ch, { sidesFor, colorFor }); wood += t.length; for (const x of t) tris.push(x); }
  if (leaves) { const t = leafTris(plant, { seed, scale: leafScale }); leaf += t.length; for (const x of t) tris.push(x); }
  return { tris, counts: { wood, leaf, total: wood + leaf } };
}
