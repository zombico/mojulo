/**
 * ARCHES — the round vocabulary a room kit opts into (`kit.arch`), so a level is never only boxes on a grid (the voxel
 * read): doorways get a round head, the ceiling becomes a barrel vault on transverse ribs (gothic.js naveVault, round
 * section), and a dressing's niches can take an arched head. A round arch is struck from one centre: a semicircle when
 * its rise is half its span, a segmental arch when lower.
 *
 *   roundArch(a, b, zs, rise, seg)        → the curve over [a, b] springing at zs, as { u, z, n } points (n into the opening)
 *   archInfill(out, F, pts, top, surf)    → the wall between the curve and a flat line above it (the spandrels)
 *   archUnder(out, F, pts, zs, surf, off) → the face under the curve down to its springing line (a niche's back)
 *   archRing(out, F, a, b, zs, rise, …)   → an archivolt: a moulded ring round the head, standing proud
 *   archSoffit(out, pt, pts, depth, …)    → the curved underside through a wall's thickness
 *
 * Every face is a textured quad lit and dirtied by the stage like the shell; low segment counts (the era's budget).
 */
import { add, mul, P, onWall, quad } from './geom.js';

const Z = [0, 0, 1];
const norm2 = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/** A round (segmental) arch over [a, b] springing at zs, rising `rise` (at most half the span: a semicircle). */
export function roundArch(a, b, zs, rise, seg = 8) {
  const h = (b - a) / 2, mid = (a + b) / 2, k = Math.min(Math.max(rise, h * 0.05), h);
  const R = (h * h + k * k) / (2 * k), cz = zs + k - R, half = Math.asin(Math.min(1, h / R)), pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = Math.PI / 2 + half - (2 * half * i) / seg, u = i === 0 ? a : i === seg ? b : mid + R * Math.cos(t), z = i === 0 || i === seg ? zs : cz + R * Math.sin(t);
    pts.push({ u, z, n: norm2(mid - u, cz - z) });
  }
  return pts;
}

const W = (F, u, z, off = 0) => onWall(F, u, off, z);
const wallN = (F, nu, nz, nOff = 0) => P(add(add(mul(F.U, nu), mul(Z, nz)), mul(F.N, nOff)));

/** The wall between the arch and the flat line `top` above it, `off` out from the wall plane. */
export function archInfill(out, F, pts, top, surf, off = 0) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (top - Math.min(p.z, q.z) < 1e-4) continue;
    // the sliver over the curve, then level courses up to `top`: no face taller than the surface's light cell
    const zx = Math.max(p.z, q.z), c = surf.cell || 1, k = Math.ceil((top - zx) / c - 1e-9);
    if (Math.abs(p.z - q.z) > 1e-4) quad(out, [W(F, p.u, p.z, off), W(F, q.u, q.z, off), W(F, q.u, zx, off), W(F, p.u, zx, off)], F.N, surf, F.U, Z);
    for (let j = 0; j < k; j++) { const za = zx + ((top - zx) * j) / k, zb = zx + ((top - zx) * (j + 1)) / k; quad(out, [W(F, p.u, za, off), W(F, q.u, za, off), W(F, q.u, zb, off), W(F, p.u, zb, off)], F.N, surf, F.U, Z); }
  }
}

/** The face under the arch down to its springing line `zs`, `off` out from the wall plane (into it when negative). */
export function archUnder(out, F, pts, zs, surf, off = 0, n = F.N) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (Math.max(p.z, q.z) - zs < 1e-4) continue;
    quad(out, [W(F, p.u, zs, off), W(F, q.u, zs, off), W(F, q.u, q.z, off), W(F, p.u, p.z, off)], n, surf, F.U, Z);
  }
}

/** An archivolt over [a, b]: a ring `w` wide round the head, standing `proud` out of the wall, its inner edge and outer edge. */
export function archRing(out, F, a, b, zs, rise, seg, w, proud, surf) {
  const inner = roundArch(a, b, zs, rise, seg), outer = roundArch(a - w, b + w, zs, rise + w, seg);
  for (let i = 0; i < seg; i++) {
    const p = inner[i], q = inner[i + 1], po = outer[i], qo = outer[i + 1];
    quad(out, [W(F, p.u, p.z, proud), W(F, q.u, q.z, proud), W(F, qo.u, qo.z, proud), W(F, po.u, po.z, proud)], F.N, surf, F.U, Z);
    const ni = norm2((p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2);
    quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), W(F, q.u, q.z, proud), W(F, p.u, p.z, proud)], wallN(F, ni[0], ni[1]), surf, F.U, Z);
    quad(out, [W(F, qo.u, qo.z), W(F, po.u, po.z), W(F, po.u, po.z, proud), W(F, qo.u, qo.z, proud)], wallN(F, -ni[0], -ni[1]), surf, F.U, Z);
  }
  return { inner, outer };
}

/** The curved underside of an arch through a wall: `pt(u, d, z)` maps a point on the arch at depth d ∈ [0, depth]. */
export function archSoffit(out, pt, pts, depth, surf, n3, A) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1], n = n3(norm2((p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2));
    quad(out, [pt(p.u, 0, p.z), pt(q.u, 0, q.z), pt(q.u, depth, q.z), pt(p.u, depth, p.z)], n, surf, A, null,
      [[p.u / surf.scale, 0], [q.u / surf.scale, 0], [q.u / surf.scale, depth / surf.scale], [p.u / surf.scale, depth / surf.scale]]);
  }
}
