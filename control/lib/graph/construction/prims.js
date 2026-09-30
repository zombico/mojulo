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

/**
 * A convex frustum from `from` (radius r0) to `to` (radius r1), n sides: a countersunk head, a cone point, a washer's
 * chamfer. r0 or r1 may be 0 (a cone). → sides as quads (or triangles at an apex), caps as fans.
 */
export function frustumPolys(from, to, r0, r1, n = 12) {
  const d = unit(sub(to, from));
  const [u, v] = across(d);
  const at = (c, r, i) => { const a = (2 * Math.PI * (i + 0.5)) / n; return add(c, add(scl(u, r * Math.cos(a)), scl(v, r * Math.sin(a)))); };
  const A = Array.from({ length: n }, (_, i) => at(from, r0, i)), B = Array.from({ length: n }, (_, i) => at(to, r1, i));
  const polys = [];
  const slope = (r0 - r1) / (Math.hypot(sub(to, from)[0], sub(to, from)[1], sub(to, from)[2]) || 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mid = (2 * Math.PI * (i + 1)) / n;
    const out = add(scl(u, Math.cos(mid)), scl(v, Math.sin(mid)));
    const nrm = unit(add(out, scl(d, slope)));
    // wind so the quad's own normal points out (u × v = d, counter-clockwise seen from `to`)
    if (r0 > 0 && r1 > 0) polys.push({ corners: [A[i], A[j], B[j], B[i]], n: nrm });
    else if (r1 > 0) polys.push({ corners: [from, B[j], B[i]], n: nrm });
    else polys.push({ corners: [A[i], A[j], to], n: nrm });
  }
  if (r1 > 0) for (let i = 1; i + 1 < n; i++) polys.push({ corners: [B[0], B[i], B[i + 1]], n: d });
  if (r0 > 0) for (let i = 1; i + 1 < n; i++) polys.push({ corners: [A[0], A[i + 1], A[i]], n: scl(d, -1) });
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

/**
 * A tube of radius r along a path (a polyline in any frame): rings carried round the path square to it, quads between
 * them; `closed` joins the last ring to the first (piping round a cushion), else the ends are left open (a spring's
 * wire ends in its clips). → polys { corners, n } in the path's frame.
 */
export function tubePolys(path, r, { sides = 8, closed = false } = {}) {
  const P = path.slice();
  if (closed && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1], P[0][2] - P[P.length - 1][2]) < 1e-9) P.pop();
  const n = P.length; const rings = []; let ref = null;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let i = 0; i < n; i++) {
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)], b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)];
    const tg = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    if (!ref) ref = Math.abs(tg[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = unit(cross(tg, ref)); const v = cross(tg, u); ref = v;           // carry the frame along the path
    rings.push(Array.from({ length: sides }, (_, k) => { const t = (2 * Math.PI * k) / sides; return add(P[i], add(scl(u, r * Math.cos(t)), scl(v, r * Math.sin(t)))); }));
  }
  const polys = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const A = rings[i], B = rings[(i + 1) % n], m = scl(add(P[i], P[(i + 1) % n]), 0.5);
    for (let k = 0; k < sides; k++) {
      const q = [A[k], A[(k + 1) % sides], B[(k + 1) % sides], B[k]];
      const c = scl(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
      polys.push({ corners: q, n: unit([c[0] - m[0], c[1] - m[1], c[2] - m[2]]) });
    }
  }
  return polys;
}
