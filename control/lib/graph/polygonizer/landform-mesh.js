/**
 * landform-mesh — a heightfield meshed so its faces have detail (landforms.plan.md L2).
 *
 * A uniform grid gives a vertical cliff one or two stretched quads: no room for a ledge, a bed or a crack. Here every
 * grid triangle is clipped at shared horizontal `levels` (an even step, plus every bedding plane the caller passes):
 * a triangle crossing k levels becomes k + 1 slabs, so a cliff gets polygons in proportion to its height and flat
 * ground stays whole. A clip point on a shared edge is computed from that edge's two ends alone (from its lower end),
 * so the two triangles on either side of an edge cut it at the same points: no cracks, before or after `displace` —
 * which is a function of position alone, so a shared vertex moves once, the same way for both.
 *
 * Triangles keep the grid's winding (counter-clockwise seen from above) through the clip, so a face's normal is the
 * ground's outward side even on a vertical wall. Each corner is coloured by `paint(p, midZ, n)` (p the undisplaced
 * corner, midZ the slab's mid-height — a bed's colour stays inside its bed — and n the displaced triangle's normal)
 * and carried as `cornerFills`, so colour blends across a face while light stays flat per triangle.
 *
 * Pure. Deterministic for a given state, levels and callbacks.
 */
import { gridX, gridY } from './landform.js';

/** Sorted unique levels: every `step` across [lo, hi], plus `extra` (bed boundaries) inside it. */
export function sliceLevels(lo, hi, step, extra = []) {
  const set = new Set();
  for (let k = Math.floor(lo / step); k * step <= hi; k++) set.add(k * step);
  for (const e of extra) if (e > lo && e < hi) set.add(e);
  return [...set].sort((a, b) => a - b);
}

const below = (a, b) => a[2] < b[2] || (a[2] === b[2] && (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])));
/** The point at height zc on edge ab, computed from the edge's lower end — the same bits from either triangle. */
function cutEdge(a, b, zc) { const [lo, hi] = below(a, b) ? [a, b] : [b, a]; const t = (zc - lo[2]) / (hi[2] - lo[2]); return [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, zc]; }
function clipAt(poly, zc, keepAbove) {
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length]; const ina = keepAbove ? a[2] >= zc : a[2] <= zc, inb = keepAbove ? b[2] >= zc : b[2] <= zc;
    if (ina) out.push(a); if (ina !== inb) out.push(cutEdge(a, b, zc));
  }
  return out;
}

/**
 * The state's surface as sliced triangles. → [{ corners: [a, b, c], fill, cornerFills: [a, b, c, c], outNormal, doubleSided }]
 * `stride` samples every stride-th grid node (the last row and column always); `group` is stamped when given.
 */
export function slicedTerrainFaces(s, { stride = 1, levels, displace = null, paint, group = null }) {
  const out = []; const L = levels; const { nx, ny } = s;
  const firstAbove = (z) => { let a = 0, c = L.length; while (a < c) { const m = (a + c) >> 1; if (L[m] <= z) a = m + 1; else c = m; } return a; };
  const node = (i, j) => [gridX(s, i), gridY(s, j), s.z[j * nx + i]];
  const emit = (tri) => {
    let lo = tri[0][2], hi = lo; for (const p of tri) { if (p[2] < lo) lo = p[2]; if (p[2] > hi) hi = p[2]; }
    const pieces = [];
    if (hi > lo) {
      let rest = tri, floor = lo;
      for (let k = firstAbove(lo); k < L.length && L[k] < hi && rest.length >= 3; k++) {
        if (L[k] <= floor) continue;
        const part = clipAt(rest, L[k], false); if (part.length >= 3) pieces.push(part);
        rest = clipAt(rest, L[k], true); floor = L[k];
      }
      if (rest.length >= 3) pieces.push(rest);
    } else pieces.push(tri);
    for (const poly of pieces) {
      let mz = 0; for (const p of poly) mz += p[2]; mz /= poly.length;
      const moved = displace ? poly.map(displace) : poly;
      for (let t = 1; t + 1 < poly.length; t++) {
        const c = [moved[0], moved[t], moved[t + 1]];
        const ux = c[1][0] - c[0][0], uy = c[1][1] - c[0][1], uz = c[1][2] - c[0][2], vx = c[2][0] - c[0][0], vy = c[2][1] - c[0][1], vz = c[2][2] - c[0][2];
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const l = Math.hypot(n[0], n[1], n[2]); if (!(l > 1e-14)) continue;
        n[0] /= l; n[1] /= l; n[2] /= l;
        const f0 = paint(poly[0], mz, n), f1 = paint(poly[t], mz, n), f2 = paint(poly[t + 1], mz, n);
        const face = { corners: c, fill: f0, cornerFills: [f0, f1, f2, f2], outNormal: n, doubleSided: true };
        if (group) face.group = group;
        out.push(face);
      }
    }
  };
  for (let j = 0; j < ny - 1; j += stride) {
    const j2 = Math.min(j + stride, ny - 1);
    for (let i = 0; i < nx - 1; i += stride) {
      const i2 = Math.min(i + stride, nx - 1);
      const a = node(i, j), b = node(i2, j), c = node(i2, j2), d = node(i, j2);
      if (Math.abs(a[2] - c[2]) <= Math.abs(b[2] - d[2])) { emit([a, b, c]); emit([a, c, d]); } else { emit([a, b, d]); emit([b, c, d]); }   // the flatter diagonal
    }
  }
  return out;
}
