/**
 * skin-net — one closed SKIN over a signed-distance field, fine where it has detail and coarse where it has none: the
 * realistic head's one skin (hero-relational-head.js), and any field the same way.
 *
 *   netSkin(field, box, { cell, project })   a surface net sampled ALONG THE SURFACE only: a coarse lattice (every
 *        `STRIDE` cells) finds where the surface crosses, and from those cells a flood through the cells' crossed faces
 *        samples the rest (a piece of surface no coarse edge crosses, smaller than a stride, is missed: soundMesh would
 *        drop it anyway). One vertex per sign-change cell (its edge crossings' mean) PROJECTED onto the surface
 *        (`project` Newton steps along the cell's gradient), one quad per sign-change edge, split along its shorter
 *        diagonal → { V: [[x, y, z]], F: [[a, b, c]] }, wound outward.
 *        (field-mesh.js surfaceNetFaces samples the whole grid: at a millimetre a head is tens of millions of samples.)
 *   soundMesh(V, F)        the faces on an edge more than two faces share let go (a net pinches where the surface is
 *        thinner than a cell), each piece wound one way and outward, a piece under `min` faces dropped.
 *   simplifyMesh(V, F, { target, locked, weight, turn, accept })   QUADRIC edge collapses (Garland–Heckbert) down to
 *        `target` faces: each collapse the cheapest by the planes about its ends (`weight(p)` × theirs: a feature keeps
 *        its faces), never across a locked point (a rim, a cut), never turning a face past `turn` (its normal's cosine
 *        with the old), never pinching the surface (the link condition), never where `accept(a, b, p)` says no → { V, F,
 *        of } (`of[i]`: the kept point an input point became).
 *   boundaryLoops(F), closeHoles(V, F, field), untangle(V, F, …)   a mesh's open rims; its small holes fanned shut (a
 *        clean rim's only); the faces a moved rim folded, relaxed back.
 *   fieldNormals(V, field, eps)   the field's gradient at each point, unit.
 *
 * Pure and deterministic: fixed loops, ties broken by index; no dice, no clock.
 */

const STRIDE = 4;

/** p as the field takes it */
const P3 = (x, y, z) => ({ x, y, z });
function grad(field, x, y, z, e) {
  const gx = field(P3(x + e, y, z)) - field(P3(x - e, y, z)), gy = field(P3(x, y + e, z)) - field(P3(x, y - e, z)), gz = field(P3(x, y, z + e)) - field(P3(x, y, z - e));
  return [gx / (2 * e), gy / (2 * e), gz / (2 * e)];
}

/** A surface net of `field` (negative inside) in `box` ({ min, max } of { x, y, z }) at `cell`, along the surface only. */
export function netSkin(field, box, { cell, project = 1 } = {}) {
  const h = cell, ex = box.max.x - box.min.x, ey = box.max.y - box.min.y, ez = box.max.z - box.min.z;
  // (the grid a whole number of strides along each side)
  const ns = [ex, ey, ez].map((e) => Math.max(1, Math.ceil(e / (h * STRIDE))));
  const [nx, ny, nz] = ns.map((b) => b * STRIDE), py = ny + 1, pz = nz + 1;
  const gx = (i) => box.min.x + i * h, gy = (j) => box.min.y + j * h, gz = (k) => box.min.z + k * h;
  const D = new Float32Array((nx + 1) * py * pz).fill(NaN), idx = (i, j, k) => (i * py + j) * pz + k;
  const sample = (i, j, k) => { const q = idx(i, j, k); let d = D[q]; if (d !== d) { d = field(P3(gx(i), gy(j), gz(k))); D[q] = d; } return d; };
  const cellKey = (i, j, k) => (i * ny + j) * nz + k, isIn = (d) => d <= 0;
  const mixed = (i, j, k) => { let n = 0; for (let c = 0; c < 8; c++) if (isIn(sample(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)))) n++; return n > 0 && n < 8; };
  // 1. THE SEEDS: the coarse lattice's edges the surface crosses, each narrowed to the cell it crosses in
  const seen = new Uint8Array(nx * ny * nz), stack = [];
  const seed = (i, j, k) => { if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return; const c = cellKey(i, j, k); if (!seen[c]) { seen[c] = 1; stack.push(c); } };
  for (let i = 0; i <= nx; i += STRIDE) for (let j = 0; j <= ny; j += STRIDE) for (let k = 0; k <= nz; k += STRIDE) {
    const s0 = isIn(sample(i, j, k));
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const ie = i + di * STRIDE, je = j + dj * STRIDE, ke = k + dk * STRIDE;
      if (ie > nx || je > ny || ke > nz || isIn(sample(ie, je, ke)) === s0) continue;
      let t = 0; while (t < STRIDE - 1 && isIn(sample(i + di * (t + 1), j + dj * (t + 1), k + dk * (t + 1))) === s0) t++;
      // (the cells about the fine edge that crosses)
      const a = i + di * t, b = j + dj * t, c = k + dk * t;
      for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) seed(a - (di ? 0 : u), b - (dj ? 0 : di ? u : v), c - (dk ? 0 : v));
    }
  }
  // 2. THE FLOOD: a cell the surface crosses hands on through each of its faces the surface crosses too
  const cells = [];
  while (stack.length) {
    const c = stack.pop(), k = c % nz, j = Math.floor(c / nz) % ny, i = Math.floor(c / (nz * ny));
    if (!mixed(i, j, k)) continue;
    cells.push(c);
    const s = [0, 1, 2, 3, 4, 5, 6, 7].map((q) => isIn(D[idx(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1))]));
    const face = (q) => !(s[q[0]] === s[q[1]] && s[q[1]] === s[q[2]] && s[q[2]] === s[q[3]]);
    if (face([0, 2, 4, 6])) seed(i - 1, j, k); if (face([1, 3, 5, 7])) seed(i + 1, j, k);
    if (face([0, 1, 4, 5])) seed(i, j - 1, k); if (face([2, 3, 6, 7])) seed(i, j + 1, k);
    if (face([0, 1, 2, 3])) seed(i, j, k - 1); if (face([4, 5, 6, 7])) seed(i, j, k + 1);
  }
  cells.sort((a, b) => a - b);
  // 3. ONE POINT A CELL: its crossings' mean, stepped onto the surface along the cell's own gradient (its corners'),
  // never further than half a cell from where the crossings put it (a step near a crease can leap to the other sheet)
  const vOf = new Map(), V = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const c of cells) {
    const k = c % nz, j = Math.floor(c / nz) % ny, i = Math.floor(c / (nz * ny));
    const d = [0, 1, 2, 3, 4, 5, 6, 7].map((q) => D[idx(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1))]);
    let su = 0, sv = 0, sw = 0, n = 0;
    for (const [u, w] of EDGES) {
      const du = d[u], dw = d[w]; if (isIn(du) === isIn(dw)) continue;
      const t = du / (du - dw);
      su += (u & 1) + ((w & 1) - (u & 1)) * t; sv += ((u >> 1) & 1) + (((w >> 1) & 1) - ((u >> 1) & 1)) * t; sw += ((u >> 2) & 1) + (((w >> 2) & 1) - ((u >> 2) & 1)) * t; n++;
    }
    const u = su / n, v = sv / n, w = sw / n, m = [gx(i + u), gy(j + v), gz(k + w)];
    // (the trilinear gradient at (u, v, w))
    const L = (a, b, t) => a + (b - a) * t;
    const g = [
      L(L(d[1] - d[0], d[3] - d[2], v), L(d[5] - d[4], d[7] - d[6], v), w) / h,
      L(L(d[2] - d[0], d[3] - d[1], u), L(d[6] - d[4], d[7] - d[5], u), w) / h,
      L(L(d[4] - d[0], d[5] - d[1], u), L(d[6] - d[2], d[7] - d[3], u), v) / h,
    ], g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
    let p = m;
    if (g2 > 1e-12) for (let it = 0; it < project; it++) {
      const f = field(P3(p[0], p[1], p[2])), q = [p[0] - (f * g[0]) / g2, p[1] - (f * g[1]) / g2, p[2] - (f * g[2]) / g2];
      if (Math.hypot(q[0] - m[0], q[1] - m[1], q[2] - m[2]) > 0.5 * h) break;
      p = q;
    }
    vOf.set(c, V.length); V.push(p);
  }
  // 4. THE QUADS: one per sign-change edge, the four cells about it; wound from inside to outside
  const F = [], vAt = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? undefined : vOf.get(cellKey(i, j, k)));
  const quad = (a, b, c, d, flip) => {
    if (a === undefined || b === undefined || c === undefined || d === undefined) return;
    const q = flip ? [a, d, c, b] : [a, b, c, d];
    // (split along the shorter diagonal)
    const dd = (u, w) => { const P = V[u], Q = V[w]; return (P[0] - Q[0]) ** 2 + (P[1] - Q[1]) ** 2 + (P[2] - Q[2]) ** 2; };
    if (dd(q[0], q[2]) <= dd(q[1], q[3])) { F.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); } else { F.push([q[0], q[1], q[3]], [q[1], q[2], q[3]]); }
  };
  for (const c of cells) {
    const k = c % nz, j = Math.floor(c / nz) % ny, i = Math.floor(c / (nz * ny));
    // the cell's own three lower edges from its (i, j, k) corner
    const d0 = D[idx(i, j, k)];
    { const d1 = D[idx(i + 1, j, k)]; if (isIn(d0) !== isIn(d1)) quad(vAt(i, j - 1, k - 1), vAt(i, j, k - 1), vAt(i, j, k), vAt(i, j - 1, k), d0 > 0); }
    { const d1 = D[idx(i, j + 1, k)]; if (isIn(d0) !== isIn(d1)) quad(vAt(i - 1, j, k - 1), vAt(i - 1, j, k), vAt(i, j, k), vAt(i, j, k - 1), d0 > 0); }
    { const d1 = D[idx(i, j, k + 1)]; if (isIn(d0) !== isIn(d1)) quad(vAt(i - 1, j - 1, k), vAt(i, j - 1, k), vAt(i, j, k), vAt(i - 1, j, k), d0 > 0); }
  }
  return { V, F: F.filter((t) => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) };
}

const ek = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normal = (V, t) => cross(sub(V[t[1]], V[t[0]]), sub(V[t[2]], V[t[0]]));

/** The faces on an edge more than two share let go, each piece wound one way (outward by `out`, a point → the outward
 * direction there, when given), a piece under `min` faces dropped. → F */
export function soundMesh(V, F, { out = null, min = 24 } = {}) {
  let T = F.map((t) => [...t]);
  for (let pass = 0; pass < 32; pass++) {
    const uses = new Map(); for (const t of T) for (let a = 0; a < 3; a++) { const k = ek(t[a], t[(a + 1) % 3]); uses.set(k, (uses.get(k) || 0) + 1); }
    const bad = (t) => [0, 1, 2].some((a) => uses.get(ek(t[a], t[(a + 1) % 3])) > 2);
    if (!T.some(bad)) break;
    T = T.filter((t) => !bad(t));
  }
  const byEdge = new Map(); T.forEach((t, fi) => { for (let a = 0; a < 3; a++) { const k = ek(t[a], t[(a + 1) % 3]); (byEdge.get(k) || byEdge.set(k, []).get(k)).push(fi); } });
  const seen = new Int32Array(T.length).fill(-1), keep = [];
  const runs = (t, u, w) => { for (let a = 0; a < 3; a++) if (t[a] === u && t[(a + 1) % 3] === w) return true; return false; };
  for (let s0 = 0; s0 < T.length; s0++) {
    if (seen[s0] >= 0) continue;
    const piece = [s0]; seen[s0] = s0;
    for (let q = 0; q < piece.length; q++) {
      const t = T[piece[q]];
      for (let a = 0; a < 3; a++) {
        const u = t[a], w = t[(a + 1) % 3];
        for (const nb of byEdge.get(ek(u, w))) {
          if (nb === piece[q] || seen[nb] >= 0) continue;
          if (runs(T[nb], u, w)) T[nb] = [T[nb][0], T[nb][2], T[nb][1]];   // a neighbour runs the shared edge the other way when they agree
          seen[nb] = s0; piece.push(nb);
        }
      }
    }
    if (piece.length < min) continue;
    let s = 0;
    if (out) for (const fi of piece) { const t = T[fi], c = [0, 1, 2].map((k) => (V[t[0]][k] + V[t[1]][k] + V[t[2]][k]) / 3); s += dot(normal(V, t), out(c)); }
    for (const fi of piece) keep.push(s < 0 ? [T[fi][0], T[fi][2], T[fi][1]] : T[fi]);
  }
  return keep;
}

/** a binary heap of [cost, a, b, stamp] (cheapest first; ties by a, then b) */
class Heap {
  constructor() { this.h = []; }
  less(x, y) { return x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2]))); }
  push(x) { const h = this.h; h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!this.less(h[i], h[p])) break; [h[i], h[p]] = [h[p], h[i]]; i = p; } }
  pop() {
    const h = this.h, top = h[0], last = h.pop();
    if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && this.less(h[l], h[m])) m = l; if (r < h.length && this.less(h[r], h[m])) m = r; if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m; } }
    return top;
  }
  get size() { return this.h.length; }
}

/** QUADRIC edge collapses down to `target` faces (see the head of the file). */
export function simplifyMesh(V0, F0, { target, locked = null, weight = null, turn = 0.3, accept = null } = {}) {
  const n = V0.length, V = V0.map((p) => [...p]), F = F0.map((t) => [...t]), alive = new Uint8Array(F.length).fill(1);
  const lock = locked ? Uint8Array.from(locked) : new Uint8Array(n), into = new Int32Array(n).fill(-1), vf = Array.from({ length: n }, () => []), stamp = new Int32Array(n), gone = new Uint8Array(n);
  F.forEach((t, fi) => { for (const v of t) vf[v].push(fi); });
  // the quadrics: each face's plane, area-weighted, times the weight at its centre
  const Q = new Float64Array(n * 10);
  F.forEach((t) => {
    const nn = normal(V, t), l = Math.hypot(...nn); if (!(l > 0)) return;
    const a = nn[0] / l, b = nn[1] / l, c = nn[2] / l, d = -(a * V[t[0]][0] + b * V[t[0]][1] + c * V[t[0]][2]);
    const cen = [0, 1, 2].map((k) => (V[t[0]][k] + V[t[1]][k] + V[t[2]][k]) / 3), w = (l / 2) * (weight ? weight(cen) : 1);
    const q = [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
    for (const v of t) for (let k = 0; k < 10; k++) Q[v * 10 + k] += w * q[k];
  });
  // (a boundary's edges kept by planes square to them, so an open rim or a cut is not drawn in)
  const uses = new Map(); F.forEach((t) => { for (let a = 0; a < 3; a++) { const k = ek(t[a], t[(a + 1) % 3]); uses.set(k, (uses.get(k) || 0) + 1); } });
  F.forEach((t) => {
    for (let a = 0; a < 3; a++) {
      const u = t[a], w = t[(a + 1) % 3]; if (uses.get(ek(u, w)) !== 1) continue;
      const e = sub(V[w], V[u]), nn = normal(V, t), p = cross(e, nn), l = Math.hypot(...p); if (!(l > 0)) continue;
      const a2 = p[0] / l, b2 = p[1] / l, c2 = p[2] / l, d2 = -(a2 * V[u][0] + b2 * V[u][1] + c2 * V[u][2]), wt = 100 * dot(e, e);
      const q = [a2 * a2, a2 * b2, a2 * c2, a2 * d2, b2 * b2, b2 * c2, b2 * d2, c2 * c2, c2 * d2, d2 * d2];
      for (const v of [u, w]) for (let k = 0; k < 10; k++) Q[v * 10 + k] += wt * q[k];
    }
  });
  const qerr = (q, p) => q[0] * p[0] * p[0] + 2 * q[1] * p[0] * p[1] + 2 * q[2] * p[0] * p[2] + 2 * q[3] * p[0] + q[4] * p[1] * p[1] + 2 * q[5] * p[1] * p[2] + 2 * q[6] * p[1] + q[7] * p[2] * p[2] + 2 * q[8] * p[2] + q[9];
  const sumQ = (a, b) => { const q = new Float64Array(10); for (let k = 0; k < 10; k++) q[k] = Q[a * 10 + k] + Q[b * 10 + k]; return q; };
  // the point an edge collapses to: the quadric's minimum when it is well posed and near the edge, else the better of its
  // ends and its middle; a locked end stays where it is
  const place = (a, b) => {
    if (lock[a] && lock[b]) return null;
    const q = sumQ(a, b), A = V[a], B = V[b];
    if (lock[a]) return [A, qerr(q, A)];
    if (lock[b]) return [B, qerr(q, B)];
    // (the quadric's minimum by Cramer's rule, kept when it lies within the edge's length of its middle)
    const m00 = q[0], m01 = q[1], m02 = q[2], m11 = q[4], m12 = q[5], m22 = q[7], r0 = -q[3], r1 = -q[6], r2 = -q[8];
    const c00 = m11 * m22 - m12 * m12, c01 = m01 * m22 - m12 * m02, c02 = m01 * m12 - m11 * m02, det = m00 * c00 - m01 * c01 + m02 * c02;
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    let best = null, be = Infinity;
    if (Math.abs(det) > 1e-18) {
      const x = (r0 * c00 - m01 * (r1 * m22 - m12 * r2) + m02 * (r1 * m12 - m11 * r2)) / det;
      const y = (m00 * (r1 * m22 - m12 * r2) - r0 * c01 + m02 * (m01 * r2 - r1 * m02)) / det;
      const z = (m00 * (m11 * r2 - r1 * m12) - m01 * (m01 * r2 - r1 * m02) + r0 * c02) / det;
      const len = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (Math.hypot(x - M[0], y - M[1], z - M[2]) <= len) { best = [x, y, z]; be = qerr(q, best); }
    }
    for (const p of [A, B, M]) { const e = qerr(q, p); if (!best || e < be - 1e-30) { best = p; be = e; } }
    return [best, be];
  };
  const heap = new Heap(), pushEdge = (a, b) => { if (a > b) [a, b] = [b, a]; const pl = place(a, b); if (pl) heap.push([pl[1], a, b, stamp[a] * 65536 + stamp[b]]); };
  const seenE = new Set(); F.forEach((t) => { for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3], key = ek(a, b); if (seenE.has(key)) continue; seenE.add(key); pushEdge(a, b); } });
  const ring = (v) => { const s = new Set(); for (const fi of vf[v]) if (alive[fi]) for (const w of F[fi]) if (w !== v) s.add(w); return s; };
  let faces = F.length;
  while (faces > target && heap.size) {
    const [, a, b, st] = heap.pop();
    if (gone[a] || gone[b] || st !== stamp[a] * 65536 + stamp[b]) continue;
    const pl = place(a, b); if (!pl) continue;
    const p = pl[0];
    if (accept && !accept(a, b, p)) continue;
    // the link condition: the ends' rings share exactly the edge's opposite corners
    const ra = ring(a), rb = ring(b); if (!ra.has(b)) continue;
    let common = 0; for (const w of ra) if (rb.has(w)) common++;
    const shared = vf[a].filter((fi) => alive[fi] && F[fi].includes(b)).length;
    if (common !== shared) continue;
    // no face turned past `turn`, none made degenerate
    let ok = true;
    for (const v of [a, b]) for (const fi of vf[v]) {
      if (!alive[fi] || F[fi].includes(a) && F[fi].includes(b)) continue;
      const t = F[fi], n0 = normal(V, t), t1 = t.map((u) => (u === a || u === b ? -1 : u)), P = t1.map((u, k) => (u === -1 ? p : V[t[k]]));
      const n1 = cross(sub(P[1], P[0]), sub(P[2], P[0])), l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
      // (nor left nearly flat beside what it was: a collapse onto a point in line with two others)
      if (!(l1 > 1e-14) || l1 < 0.02 * l0 || dot(n0, n1) < turn * l0 * l1) { ok = false; break; }
    }
    if (!ok) continue;
    // collapse b into a
    V[a] = p; gone[b] = 1;
    for (let k = 0; k < 10; k++) Q[a * 10 + k] += Q[b * 10 + k];
    for (const fi of vf[b]) {
      if (!alive[fi]) continue;
      if (F[fi].includes(a)) { alive[fi] = 0; faces--; continue; }
      F[fi] = F[fi].map((u) => (u === b ? a : u)); vf[a].push(fi);
    }
    lock[a] = lock[a] || lock[b]; into[b] = a;
    vf[a] = vf[a].filter((fi) => alive[fi]);
    // (only the edges about the kept point change their cost: the rest are checked again when they come up)
    stamp[a]++;
    for (const w of ring(a)) pushEdge(a, w);
  }
  // compact
  const of = new Int32Array(n).fill(-1), keepV = [];
  const root = (v) => { while (into[v] >= 0) v = into[v]; return v; };
  const outF = [];
  F.forEach((t, fi) => { if (!alive[fi]) return; outF.push(t.map((v) => { if (of[v] < 0) { of[v] = keepV.length; keepV.push(V[v]); } return of[v]; })); });
  // (a collapsed point is where its survivor went)
  for (let v = 0; v < n; v++) if (of[v] < 0 && into[v] >= 0) of[v] = of[root(v)];
  return { V: keepV, F: outF, of };
}

/** The field's unit gradient at each point. */
export function fieldNormals(V, field, eps = 1e-4) {
  return V.map((p) => { const g = grad(field, p[0], p[1], p[2], eps), l = Math.hypot(...g) || 1; return [g[0] / l, g[1] / l, g[2] / l]; });
}

/** The mesh's open rims as loops of points, each run against its faces (a rim edge a face runs u → w, the loop runs
 * w → u). A rim that touches itself (a point on it twice, where a pinch was let go) is split there into simple loops.
 * Longest first, ties by their least point. */
export function boundaryLoops(F) {
  const uses = new Map(); for (const t of F) for (let a = 0; a < 3; a++) { const k = ek(t[a], t[(a + 1) % 3]); uses.set(k, (uses.get(k) || 0) + 1); }
  const out = new Map();
  for (const t of F) for (let a = 0; a < 3; a++) { const u = t[a], w = t[(a + 1) % 3]; if (uses.get(ek(u, w)) === 1) (out.get(w) || out.set(w, []).get(w)).push(u); }
  for (const l of out.values()) l.sort((x, y) => x - y);
  const loops = [];
  for (const s0 of [...out.keys()].sort((x, y) => x - y)) {
    while (out.get(s0)?.length) {
      // a closed walk from s0 along unused rim edges, cut into simple loops wherever it comes back to a point on it
      const walk = [s0], at = new Map([[s0, 0]]);
      let v = s0;
      for (;;) {
        const nx = out.get(v); if (!nx?.length) break;
        const w = nx.shift();
        if (at.has(w)) { const i = at.get(w), loop = walk.splice(i + 1); loop.unshift(w); for (const x of loop.slice(1)) at.delete(x); if (loop.length > 2) loops.push(loop); if (w === s0 && walk.length === 1) break; v = w; continue; }
        at.set(w, walk.length); walk.push(w); v = w;
      }
    }
  }
  return loops.sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b));
}

/** Each open rim of `F` but those `keep(loop)` names closed by a fan about a new point at its middle, set onto the
 * surface by `field` (a net's pinch let go leaves a hole a few cells across). → { V, F } (V extended, F with the fans). */
export function closeHoles(V0, F0, field, { keep = () => false, project = 3 } = {}) {
  const V = V0.map((p) => p), F = F0.map((t) => t), uses = new Map();
  for (const t of F0) for (let a = 0; a < 3; a++) { const k = ek(t[a], t[(a + 1) % 3]); uses.set(k, (uses.get(k) || 0) + 1); }
  for (const loop of boundaryLoops(F0)) {
    if (keep(loop)) continue;
    // (only a clean loop: each of its edges a rim edge, no point twice; a rim that touches itself is traced wrong, and
    // its fan would lay a third face on an edge)
    if (new Set(loop).size !== loop.length || loop.some((v, i) => uses.get(ek(v, loop[(i + 1) % loop.length])) !== 1)) continue;
    let c = [0, 1, 2].map((k) => loop.reduce((s, v) => s + V[v][k], 0) / loop.length);
    for (let it = 0; it < project; it++) {
      const f = field(P3(c[0], c[1], c[2])), g = grad(field, c[0], c[1], c[2], 1e-5), g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (!(g2 > 1e-12)) break;
      c = [c[0] - (f * g[0]) / g2, c[1] - (f * g[1]) / g2, c[2] - (f * g[2]) / g2];
    }
    const m = V.length; V.push(c);
    // (the loop runs each rim edge against the face on it, as the fan's face beside that one must)
    for (let i = 0; i < loop.length; i++) F.push([loop[i], loop[(i + 1) % loop.length], m]);
  }
  return { V, F };
}

/** Faces turned inward (their normal against `out(centre)`) UNTANGLED: each one's free points (not `fixed`) moved to the
 * mean of their neighbours and set back onto `field`, `passes` times over or until none is turned. Only the faces about
 * `around` (points: a moved rim's; a whole head has many faces that rightly face its centre, the nostrils', the
 * sockets') are read. In place; → how many were still turned. (A rim set onto a ring a cell away can fold the face
 * beside it.) */
export function untangle(V, F, { out, fixed = () => false, field, passes = 8, around } = {}) {
  const vf = new Map(); F.forEach((t, fi) => { for (const v of t) (vf.get(v) || vf.set(v, []).get(v)).push(fi); });
  const facesAbout = (vs) => [...new Set([...vs].flatMap((v) => vf.get(v) || []))].sort((x, y) => x - y);
  const turned = (fs) => fs.filter((fi) => { const t = F[fi], c = [0, 1, 2].map((k) => (V[t[0]][k] + V[t[1]][k] + V[t[2]][k]) / 3); return dot(normal(V, t), out(c)) < 0; });
  let bad = turned(facesAbout(around));
  for (let pass = 0; pass < passes && bad.length; pass++) {
    const move = [...new Set(bad.flatMap((fi) => F[fi]))].filter((v) => !fixed(v)).sort((x, y) => x - y);
    for (const v of move) {
      const ns = [...new Set(vf.get(v).flatMap((fi) => F[fi]))].filter((w) => w !== v); let c = [0, 1, 2].map((k) => ns.reduce((sum, w) => sum + V[w][k], 0) / ns.length);
      for (let it = 0; it < 2; it++) { const f = field(P3(c[0], c[1], c[2])), g = grad(field, c[0], c[1], c[2], 1e-5), g2 = dot(g, g); if (!(g2 > 1e-12)) break; c = [c[0] - (f * g[0]) / g2, c[1] - (f * g[1]) / g2, c[2] - (f * g[2]) / g2]; }
      V[v] = c;
    }
    bad = turned(facesAbout(new Set([...move, ...bad.flatMap((fi) => F[fi])])));
  }
  return bad.length;
}
