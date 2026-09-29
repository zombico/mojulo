// construction/prims — convex solids as local polygons, for the parts no boolean touches: bolts, plates, bars,
// stirrups, bricks. { corners, n } in a member's local frame (metres), the shape frame.js dresses into World faces.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Two unit vectors square to `d` (any pair; deterministic). */
export function across(d) {
  const t = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(cross(d, t)); return [u, cross(d, u)];
}

/**
 * A convex prism from `from` to `to` whose cross-section is `ring` — offsets square to the axis, in order round it.
 * → sides as quads, caps as fans of triangles.
 */
export function prismPolys(from, to, ring) {
  const d = unit(sub(to, from));
  // orient the ring counter-clockwise seen from `to`, so the side normals point out
  const n0 = cross(ring[0], ring[1]); const ccw = n0[0] * d[0] + n0[1] * d[1] + n0[2] * d[2] > 0;
  const R = ccw ? ring : ring.slice().reverse();
  const A = R.map((c) => add(from, c)), B = R.map((c) => add(to, c));
  const polys = [];
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length;
    const mid = scl(add(R[i], R[j]), 0.5);
    polys.push({ corners: [A[i], A[j], B[j], B[i]], n: unit(mid) });
  }
  for (let i = 1; i + 1 < R.length; i++) {
    polys.push({ corners: [B[0], B[i], B[i + 1]], n: d });
    polys.push({ corners: [A[0], A[i + 1], A[i]], n: scl(d, -1) });
  }
  return polys;
}

/** A regular n-gon of radius r square to d. */
export function ngon(d, r, n = 8) {
  const [u, v] = across(unit(d));
  return Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * (i + 0.5)) / n; return add(scl(u, r * Math.cos(a)), scl(v, r * Math.sin(a))); });
}

/** An axis-aligned box (local) as six quads with outward normals. */
export function boxPolys(center, size) {
  const [cx, cy, cz] = center, [hx, hy, hz] = size.map((v) => v / 2);
  const P = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    { n: [1, 0, 0], corners: [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)] },
    { n: [-1, 0, 0], corners: [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)] },
    { n: [0, 1, 0], corners: [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)] },
    { n: [0, -1, 0], corners: [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)] },
    { n: [0, 0, 1], corners: [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)] },
    { n: [0, 0, -1], corners: [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)] },
  ];
}
