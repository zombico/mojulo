/**
 * THE FLEET'S GEOMETRY — the convex parts a capital ship's or a station's form is made of (fleet/forms.js,
 * fleet/structures.js), each its polygons wound out from its own middle and its inside test, and the grid that cuts
 * them into blocks:
 *
 *   part(polys, inside, o)        a convex part from its polygons (wound out) and its inside test; o: role, color, …
 *   boxPart · planPrism · drum · ellipsoid · octahedron · tube · torusRing   the shapes
 *   clipToGrid(poly, grid)        → [{ poly, cell }] a convex polygon cut by a grid's planes
 *   newell · mid · unit · dot · sub · tint                                   the arithmetic
 *
 * Pure.
 */
export const r2 = (v) => Math.round(v * 100) / 100;
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
export const mid = (P) => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length, s[2] + p[2] / P.length], [0, 0, 0]);
/** A polygon's normal by Newell's sum (its winding's). */
export function newell(P) {
  const n = [0, 0, 0];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return unit(n);
}
export function tint(hex, k) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''); }

// ── CONVEX PARTS: each its polygons wound out from its own middle, its inside test, its bounds ──
export function part(polys, inside, o = {}) {
  const all = polys.flat(), c = mid(all);
  const out = polys.map((P) => (dot(newell(P), sub(mid(P), c)) < 0 ? P.slice().reverse() : P));
  return { polys: out, inside, min: [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]))), ...o };
}
export function boxPart(min, max, o = {}) {
  const [a, b] = [min, max], c = (x, y, z) => [x ? b[0] : a[0], y ? b[1] : a[1], z ? b[2] : a[2]];
  const polys = [[c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)],
    [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)]];
  return part(polys, (p) => p[0] > a[0] && p[0] < b[0] && p[1] > a[1] && p[1] < b[1] && p[2] > a[2] && p[2] < b[2], o);
}
/** A prism over a convex plan (points [x, y], wound either way) from z0 to z1. */
export function planPrism(plan, z0, z1, o = {}) {
  const lo = plan.map(([x, y]) => [x, y, z0]), hi = plan.map(([x, y]) => [x, y, z1]);
  const sides = plan.map((_, i) => { const j = (i + 1) % plan.length; return [lo[i], lo[j], hi[j], hi[i]]; });
  const area = plan.reduce((s, p, i) => { const q = plan[(i + 1) % plan.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), w = area >= 0 ? 1 : -1;
  const inPlan = (x, y) => plan.every((p, i) => { const q = plan[(i + 1) % plan.length]; return w * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) > 0; });
  return part([lo, hi, ...sides], (p) => p[2] > z0 && p[2] < z1 && inPlan(p[0], p[1]), o);
}
/** A cylinder along x from x0 to x1 about (y, z), n sides. */
export function drum(x0, x1, y, z, r, n, o = {}) {
  const ring = (x) => Array.from({ length: n }, (_, i) => [x, y + r * Math.cos((2 * Math.PI * i) / n), z + r * Math.sin((2 * Math.PI * i) / n)]);
  const A = ring(x0), B = ring(x1), sides = A.map((_, i) => { const j = (i + 1) % n; return [A[i], A[j], B[j], B[i]]; });
  return part([A, B, ...sides], (p) => p[0] > x0 && p[0] < x1 && Math.hypot(p[1] - y, p[2] - z) < r * Math.cos(Math.PI / n), o);
}
/** An ellipsoid of radii r about c, nu rings round and nv from pole to pole. */
export function ellipsoid(c, r, nu, nv, o = {}) {
  const at = (i, j) => { const u = (2 * Math.PI * i) / nu, v = Math.PI * (j / nv - 0.5); return [c[0] + r[0] * Math.cos(v) * Math.cos(u), c[1] + r[1] * Math.cos(v) * Math.sin(u), c[2] + r[2] * Math.sin(v)]; };
  const polys = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    polys.push(j === 0 ? [q[0], q[2], q[3]] : j === nv - 1 ? [q[0], q[1], q[2]] : q);
  }
  return part(polys, (p) => ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2 < 1, o);
}
export function octahedron(c, r, o = {}) {
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


/** A cylinder from a to b (any axis), radius r, n sides; `o.polyColor(i, n)` may colour each side. */
export function tube(a, b, r, n, o = {}) {
  const d = unit(sub(b, a)), L = Math.hypot(...sub(b, a)), ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = unit([ref[1] * d[2] - ref[2] * d[1], ref[2] * d[0] - ref[0] * d[2], ref[0] * d[1] - ref[1] * d[0]]), e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  const ring = (c) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [0, 1, 2].map((k) => c[k] + r * (Math.cos(t) * e1[k] + Math.sin(t) * e2[k])); });
  const A = ring(a), B = ring(b), sides = A.map((_, i) => { const j = (i + 1) % n; return [A[i], A[j], B[j], B[i]]; }), rc = r * Math.cos(Math.PI / n);
  return part([A, B, ...sides], (p) => { const v = sub(p, a), t = dot(v, d); if (t <= 0 || t >= L) return false; return Math.hypot(v[0] - d[0] * t, v[1] - d[1] * t, v[2] - d[2] * t) < rc; }, o);
}

/** A torus about c on the axis `ax` (0 | 1 | 2), its ring radius R, its tube radius r: N segments, each a convex part
 *  between two cross-sections of `ns` sides (each segment its own part: a ring cut as it would be built, in bays).
 *  `from`/`to` (radians) take an arc of it (a collar). */
export function torusRing(c, ax, R, r, N, ns, o = {}, { from = 0, to = 2 * Math.PI } = {}) {
  const u = (ax + 1) % 3, v = (ax + 2) % 3, out = [];
  const at = (th, k) => { const ph = (2 * Math.PI * k) / ns, rho = R + r * Math.cos(ph), p = [0, 0, 0]; p[u] = c[u] + rho * Math.cos(th); p[v] = c[v] + rho * Math.sin(th); p[ax] = c[ax] + r * Math.sin(ph); return p; };
  const rc = r * Math.cos(Math.PI / ns);
  for (let i = 0; i < N; i++) {
    const t0 = from + ((to - from) * i) / N, t1 = from + ((to - from) * (i + 1)) / N;
    const A = Array.from({ length: ns }, (_, k) => at(t0, k)), B = Array.from({ length: ns }, (_, k) => at(t1, k));
    const sides = A.map((_, k) => { const j = (k + 1) % ns; return [A[k], A[j], B[j], B[k]]; });
    const inside = (p) => {
      const x = p[u] - c[u], y = p[v] - c[v], th = Math.atan2(y, x), tt = ((th - t0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (tt >= t1 - t0) return false;
      const rho = Math.hypot(x, y), z = p[ax] - c[ax];
      return (rho - R) ** 2 + z * z < rc * rc * Math.cos((t1 - t0) / 2) ** 2;
    };
    // (its ends too: between two bays they are buried in the next and dropped; an arc's show)
    out.push(part([A, B, ...sides], inside, { ...o, seg: i }));
  }
  return out;
}
