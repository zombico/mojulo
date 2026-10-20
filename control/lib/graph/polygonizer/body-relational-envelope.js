/** body-relational-envelope.js — the realistic body's ENVELOPE: what its dress is fitted to. The form field's skin shows
 * the anatomy (the abdomen's segments, the cleft between the breasts, the quadriceps' heads), and a garment copied from
 * its rings, or an armour shell baked over them, wore every groove: a tee painted on, a breastplate crumpled in shards.
 * Cloth and plate span the hollows, so the dress is made on an envelope of the skin, the same parts on the same grid
 * (every station, slot and face id the skin's, so a pin or a window lands where it would on the skin), each point
 * carried out to where cloth would lie:
 *   round a ring   onto the ring's convex hull, in the plane square to the part's axis there (the groove down the abdomen,
 *                  the cleft, a fold under the bust spanned);
 *   along the part each slot's distance from the axis raised to the mean of its neighbours' up and down the part, where
 *                  it is less, `along` times (the grooves across the abdomen, a dip between two bellies, filled)
 *   hung (`hang`, the pelvis) a slot of a ring drawn in to less than 0.7 of the ring above it takes that ring's place
 *                  round the axis, cloth hanging straight down: the pelvis's rings hidden inside the thighs under the
 *                  crotch's level are drawn in to a cone on a physique; a plate baked on them collapsed into spikes at the
 *                  hips, and a trouser seat pushed off their downward faces folded under itself
 * Only ever outward, and (but where hung) at most `reach` (15 mm) off the skin: cloth spans a hollow, not the gap between
 * the thighs at the crotch (bridged, the seat of the trousers folded where its legs began). Pure and deterministic. */
import { add, sub, scl, dot, cross, len, unit, r6 } from './body-relational-vec.js';

const centreOf = (P, st) => scl(P.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / P.slots.length);

/** a closed part's envelope (a new part; the input untouched) */
export function envelopePart(P, { along = 2, reach = 0.015, hang = false, taut = false } = {}) {
  const S = P.stations, n = S.length, C = S.map((st) => centreOf(P, st));
  // each ring's frame: its axis from the rings either side, two directions square to it
  const frames = C.map((c, i) => {
    const a = unit(sub(C[Math.min(n - 1, i + 1)], C[Math.max(0, i - 1)]));
    let u = cross(a, [0, 1, 0]); if (len(u) < 1e-6) u = cross(a, [1, 0, 0]); u = unit(u);
    return { c, a, u, v: cross(a, u) };
  });
  // the in-plane offsets (x, y) and the axial share of each point, by ring
  const rings = S.map((st, i) => { const f = frames[i]; return P.slots.map((sl) => { const d = sub(st.points[sl], f.c); return { x: dot(d, f.u), y: dot(d, f.v), z: dot(d, f.a) }; }); });
  // round a ring: each point out along its own direction from the axis to the hull's edge
  for (const R of rings) {
    const H = hull(R.map((p, j) => [p.x, p.y, j]));
    for (const p of R) {
      const r = Math.hypot(p.x, p.y); if (r < 1e-9) continue;
      const k = rayToHull(H, p.x / r, p.y / r); if (k > r) { p.x *= k / r; p.y *= k / r; }
    }
  }
  // taut (`taut`, cloth): a slot's distances along the part raised to their upper convex hull over the part's length, the
  // cloth pulled straight from one height of the body to the next it touches (from the bust's apex down the abdomen,
  // with no ledge where the neighbours' mean, a step at a time, had left one)
  if (taut) {
    const h = [0]; for (let i = 1; i < n; i++) h.push(h[i - 1] + len(sub(frames[i].c, frames[i - 1].c)));
    for (let j = 0; j < P.slots.length; j++) {
      const pts = rings.map((R, i) => [h[i], Math.hypot(R[j].x, R[j].y)]), up = [];
      for (const p of pts) { while (up.length >= 2 && (up[up.length - 1][0] - up[up.length - 2][0]) * (p[1] - up[up.length - 2][1]) - (up[up.length - 1][1] - up[up.length - 2][1]) * (p[0] - up[up.length - 2][0]) >= 0) up.pop(); up.push(p); }
      for (let i = 0; i < n; i++) {
        let k = 0; while (k < up.length - 2 && up[k + 1][0] < h[i]) k++;
        const a = up[k], b = up[Math.min(k + 1, up.length - 1)], t = b[0] > a[0] ? (h[i] - a[0]) / (b[0] - a[0]) : 0, m = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, t));
        const p = rings[i][j], r = Math.hypot(p.x, p.y); if (m > r && r > 1e-9) { p.x *= m / r; p.y *= m / r; }
      }
    }
  }
  // along the part: a slot's distance raised to its neighbours' mean up and down the part, where it is less
  for (let it = 0; it < along; it++) {
    const rad = rings.map((R) => R.map((p) => Math.hypot(p.x, p.y)));
    for (let i = 1; i < n - 1; i++) rings[i].forEach((p, j) => {
      const m = (rad[i - 1][j] + rad[i + 1][j]) / 2, r = rad[i][j];
      if (m > r && r > 1e-9) { p.x *= m / r; p.y *= m / r; }
    });
  }
  // hung: from the top ring down, a slot drawn in under the one above carried out to it
  const hung = rings.map((R) => R.map(() => false));
  if (hang) for (let i = n - 2; i >= 0; i--) rings[i].forEach((p, j) => {
    const r = Math.hypot(p.x, p.y), q = rings[i + 1][j], above = Math.hypot(q.x, q.y);
    if (r < 0.7 * above) { p.x = q.x; p.y = q.y; hung[i][j] = true; }
  });
  const stations = S.map((st, i) => {
    const f = frames[i];
    return { ...st, points: Object.fromEntries(P.slots.map((sl, j) => {
      const p = rings[i][j], q = add(f.c, add(add(scl(f.u, p.x), scl(f.v, p.y)), scl(f.a, p.z))), o = st.points[sl], d = sub(q, o), l = len(d);
      return [sl, (l > reach && !hung[i][j] ? add(o, scl(d, reach / l)) : q).map(r6)];
    })) };
  });
  return { ...P, stations };
}

/** the envelopes of a recipe's parts by name (`names`: those to wrap, the rest as they are) */
export function envelopeParts(parts, names, opts) {
  return Object.fromEntries(Object.entries(parts).map(([k, p]) => [k, names.includes(k) && p.layer === 1 && p.stations?.length > 2 ? envelopePart(p, { ...opts, hang: k === 'pelvis' }) : p]));
}

// the convex hull of 2-D points (Andrew's monotone chain), counter-clockwise, ties by the points' order
function hull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  if (P.length < 3) return P;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && crossZ(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && crossZ(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
// how far a ray from the origin along (dx, dy) runs to the hull's edge (the origin inside it); 0 when it misses
function rayToHull(H, dx, dy) {
  let best = 0;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-15) continue;
    const t = (a[0] * ey - a[1] * ex) / den, s = (a[0] * dy - a[1] * dx) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}
