/**
 * smooth-corners — per-corner normals for a low-poly bake, so its shading reads as a rounded form instead of facets:
 * each corner's normal is the average of the (outward) normals of every face in its GROUP that shares that corner.
 * A group is one ring-stack (a limb, the trunk, a skirt), so a limb rounds across its own quads but never blends
 * into the body it overlaps. The silhouette is unchanged (only `cornerFills` shading, the same per-vertex colour the
 * animal kind's `smooth` gives its watertight skin); a face's own `fill` stays beside it as the flat fallback.
 */
import { SM } from '../../util/math-scope.js';

const keyOf = (g, [x, y, z]) => `${g}|${Math.round(x * 1e4)}|${Math.round(y * 1e4)}|${Math.round(z * 1e4)}`;

/**
 * @param {Array<{corners:number[][], normal:number[], group:string|number}>} faces
 * @returns {number[][][]} for each face, its corners' unit normals
 */
export function smoothCorners(faces) {
  const acc = new Map();
  for (const f of faces) for (const c of f.corners) {
    const k = keyOf(f.group, c), a = acc.get(k);
    if (a) { a[0] += f.normal[0]; a[1] += f.normal[1]; a[2] += f.normal[2]; } else acc.set(k, [...f.normal]);
  }
  return faces.map((f) => f.corners.map((c) => {
    const [x, y, z] = acc.get(keyOf(f.group, c)), l = SM.hypot(x, y, z);
    return l > 1e-9 ? [x / l, y / l, z / l] : f.normal;
  }));
}
