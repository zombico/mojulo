/**
 * strength/section.js — cut the real mesh with a plane and measure the cross-section it leaves.
 *
 * The strength sensor never trusts a declared size. It slices the same mm triangle soup the STL writes
 * (print-measure.js printSoup) and integrates the section exactly from the cut loops (Green's theorem):
 * area, centroid, second moments, principal axes, and the vertices the extreme fibres are read from.
 *
 * Works for every solid kind, since it only needs triangles. Pure: same soup and plane → same numbers.
 *
 * Orientation: each cut segment runs with material on its LEFT when viewed down −normal (looking back at the
 * plane from the +normal side), so outer loops come out counter-clockwise and holes clockwise. Signed sums
 * then subtract the holes with no bookkeeping.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

export const unit = norm;

/** An orthonormal in-plane basis (u, v) for a plane normal n, chosen deterministically. */
export function planeBasis(n) {
  const nn = norm(n);
  const ref = Math.abs(nn[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(ref, nn));
  const v = cross(nn, u);
  return { n: nn, u, v };
}

/**
 * sliceSoup(positions, origin, normal) → { loops, basis, origin } — the closed loops (in the plane's 2D (u, v)
 * coordinates, origin at `origin`) where the plane cuts the soup. Vertices that sit exactly on the plane are
 * nudged by a tiny offset so every cut is a clean edge crossing.
 */
export function sliceSoup(positions, origin, normal) {
  const basis = planeBasis(normal);
  const { n, u, v } = basis;
  const eps = 1e-7;
  const d0 = dot(n, origin);
  const segs = [];
  for (let i = 0; i + 9 <= positions.length; i += 9) {
    const P = [[positions[i], positions[i + 1], positions[i + 2]], [positions[i + 3], positions[i + 4], positions[i + 5]], [positions[i + 6], positions[i + 7], positions[i + 8]]];
    const s = P.map((p) => { const d = dot(n, p) - d0; return Math.abs(d) < eps ? eps : d; });
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if ((s[a] > 0) !== (s[b] > 0)) {
        const t = s[a] / (s[a] - s[b]);
        const q = [P[a][0] + t * (P[b][0] - P[a][0]), P[a][1] + t * (P[b][1] - P[a][1]), P[a][2] + t * (P[b][2] - P[a][2])];
        pts.push(q);
      }
    }
    if (pts.length !== 2) continue;
    // Direction: the face normal N crossed with the plane normal gives the segment direction with material on
    // the left (seen from +n): material lies opposite N, and n × N rotated… — fixed by the sign test below.
    const N = cross(sub(P[1], P[0]), sub(P[2], P[0]));
    let [a, b] = pts;
    const dir = sub(b, a);
    // Left of `dir` (seen from +n) is n × dir. Material is on the side opposite the outward face normal.
    if (dot(cross(n, dir), N) > 0) [a, b] = [b, a];
    const ra = sub(a, origin), rb = sub(b, origin);
    segs.push([[dot(ra, u), dot(ra, v)], [dot(rb, u), dot(rb, v)]]);
  }
  return { loops: chainLoops(segs), basis, origin: [...origin] };
}

// Join segments end to start through a quantized endpoint index. Open chains (from a mesh that is not closed)
// are kept but marked open; they carry no area.
function chainLoops(segs) {
  const q = 1e5;
  const key = (p) => `${Math.round(p[0] * q)},${Math.round(p[1] * q)}`;
  const byStart = new Map();
  segs.forEach((s, i) => { const k = key(s[0]); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(i); });
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const pts = [segs[i][0]];
    const startKey = key(segs[i][0]);
    let cur = segs[i][1];
    let closed = false;
    for (let guard = 0; guard < segs.length; guard++) {
      const k = key(cur);
      if (k === startKey) { closed = true; break; }
      pts.push(cur);
      const next = (byStart.get(k) || []).find((j) => !used[j]);
      if (next == null) break;
      used[next] = 1;
      cur = segs[next][1];
    }
    if (pts.length >= 3) loops.push({ pts, closed });
  }
  return loops;
}

/**
 * sectionProps(loops) → exact properties of the cut region, in the plane's (u, v) frame:
 *   area, centroid [cu, cv], Iuu / Ivv / Iuv about the centroid (Iuu = ∫v², Ivv = ∫u²), principal I1 ≥ I2
 *   with the angle of I1's axis, J0 = Iuu + Ivv (the polar moment, exact torsion only for round sections),
 *   loops counted (outer / holes / open), and the region's vertices for extreme-fibre reads.
 */
export function sectionProps(loops) {
  let A = 0, Su = 0, Sv = 0, Iuu0 = 0, Ivv0 = 0, Iuv0 = 0;
  let outer = 0, holes = 0, open = 0;
  const loopAreas = [];
  for (const L of loops) {
    if (!L.closed) { open++; continue; }
    let a = 0, su = 0, sv = 0, iuu = 0, ivv = 0, iuv = 0;
    const p = L.pts;
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
      const c = x0 * y1 - x1 * y0;
      a += c;
      su += (x0 + x1) * c;
      sv += (y0 + y1) * c;
      ivv += (x0 * x0 + x0 * x1 + x1 * x1) * c;
      iuu += (y0 * y0 + y0 * y1 + y1 * y1) * c;
      iuv += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c;
    }
    a /= 2; su /= 6; sv /= 6; ivv /= 12; iuu /= 12; iuv /= 24;
    if (a > 0) outer++; else holes++;
    loopAreas.push(a);
    A += a; Su += su; Sv += sv; Iuu0 += iuu; Ivv0 += ivv; Iuv0 += iuv;
  }
  if (!(A > 1e-9)) return { area: 0, empty: true, outer, holes, open, loops: loops.length };
  const cu = Su / A, cv = Sv / A;
  const Iuu = Iuu0 - A * cv * cv, Ivv = Ivv0 - A * cu * cu, Iuv = Iuv0 - A * cu * cv;
  const mean = (Iuu + Ivv) / 2, rad = Math.hypot((Iuu - Ivv) / 2, Iuv);
  const I1 = mean + rad, I2 = mean - rad;
  const theta = 0.5 * Math.atan2(-2 * Iuv, Iuu - Ivv);   // I1's axis angle from +u
  const verts = [];
  for (const L of loops) if (L.closed) for (const p of L.pts) verts.push(p);
  let cmax = 0;
  for (const [x, y] of verts) cmax = Math.max(cmax, Math.hypot(x - cu, y - cv));
  return { area: A, centroid: [cu, cv], Iuu, Ivv, Iuv, I1, I2, theta, J0: Iuu + Ivv, rmax: cmax, outer, holes, open, loops: loops.length, verts };
}

/** Lift a 2D (u, v) point in a slice back to 3D. */
export function liftPoint(slice, p) {
  const { u, v } = slice.basis; const o = slice.origin;
  return [o[0] + u[0] * p[0] + v[0] * p[1], o[1] + u[1] * p[0] + v[1] * p[1], o[2] + u[2] * p[0] + v[2] * p[1]];
}

/** Express a 3D vector in the slice's (u, v, n) frame. */
export function toPlane(slice, w) {
  const { u, v, n } = slice.basis;
  return [dot(w, u), dot(w, v), dot(w, n)];
}

/** Convenience: slice and measure in one call, with the 3D centroid. */
export function measureSection(positions, origin, normal) {
  const slice = sliceSoup(positions, origin, normal);
  const props = sectionProps(slice.loops);
  const centroid3 = props.empty ? null : liftPoint(slice, props.centroid);
  return { slice, props, centroid3 };
}
