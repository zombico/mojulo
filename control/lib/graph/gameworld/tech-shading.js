/**
 * TECH SHADING — smoothing groups for crafted technology: the pixels doing what polygons would otherwise have to.
 *
 * A low-poly round reads as round when it is shaded smooth: inside a piece, an edge whose two faces turn less than
 * the style's crease shares one normal at each corner, so the light runs across it without a band; a chamfer, and
 * every edge between two pieces, stays hard. What still shows of the polygons is the OUTLINE, which the readout then
 * measures (tech-readout.js), instead of every facet's width.
 *
 *   smoothCorners(faces, { crease?, by? }) → the faces, each with `cornerNormals` (one unit normal per corner)
 *   bakeCorners(faces, { base, light? })   → the faces, each with `cornerFills`: the light baked per corner, for the
 *                                            unlit vertex-colour path (figures/face-mesh.js reads both)
 *   isSmooth(faces)                        → whether a face list carries smoothing
 *
 * Pure; no dice. Normals are rounded, so the same faces give the same bytes.
 */
import { shadeHex } from '../polygonizer/vexar.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const key = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1]; };
/** Newell's normal (unnormalised: its length is twice the area), turned to the face's authored outward normal. */
function areaNormal(f) {
  const c = f.corners;
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const o = f.outNormal;
  return o && n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/** Smoothing groups by crease angle, within each piece (`by`, a face field: its monomer). */
export function smoothCorners(faces, { crease = 40, by = 'monomer' } = {}) {
  const cos = Math.cos((crease * Math.PI) / 180), N = faces.map(areaNormal), U = N.map(unit), at = new Map();
  faces.forEach((f, i) => f.corners.forEach((p) => {
    const k = `${f[by] ?? ''}|${key(p)}`;
    (at.get(k) ?? at.set(k, []).get(k)).push(i);
  }));
  return faces.map((f, i) => ({
    ...f,
    cornerNormals: f.corners.map((p) => {
      let s = [0, 0, 0];
      for (const j of at.get(`${f[by] ?? ''}|${key(p)}`)) if (U[j][0] * U[i][0] + U[j][1] * U[i][1] + U[j][2] * U[i][2] >= cos) s = [s[0] + N[j][0], s[1] + N[j][1], s[2] + N[j][2]];
      return unit(s).map(r4);
    }),
  }));
}

export const isSmooth = (faces) => faces.some((f) => Array.isArray(f.cornerNormals));

/** The light baked at each corner, from the face's base colour (`base(f)` → '#rrggbb'). */
export function bakeCorners(faces, { base, light } = {}) {
  return faces.map((f) => (Array.isArray(f.cornerNormals) ? { ...f, cornerFills: f.cornerNormals.map((n) => shadeHex(base(f), n, light)) } : f));
}
