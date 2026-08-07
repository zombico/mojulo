/**
 * sweep-faces — the `sweep` form primitive: a circular profile swept ALONG an arbitrary 3D path.
 *
 * The bending sibling of `lathe` (revolution) and `extrude` (straight prism). `lathe` sweeps a
 * profile AROUND an axis; `sweep` sweeps it ALONG a curve — the entire bent-rod / tube / wire /
 * coil world: mug & basket handles, chair/table frames, hooks, cables, springs, faucets, railings.
 *
 * The one subtlety is the cross-section frame: a naive Frenet frame twists/flips on a helix, so
 * this uses PARALLEL-TRANSPORT (rotation-minimizing) frames — seed a normal ⟂ the first tangent,
 * then rotate it by each tangent-to-tangent turn (Rodrigues) and re-orthogonalize. Proven in the
 * 0616 workbench-sweep spike (a mug handle + a coil spring, no twist).
 *
 * Emits the engine-agnostic baked face list (`{ corners, fill, doubleSided }`) the World renderers
 * consume, vexar-shaded (camera-independent), exactly like latheToFaces / extrudeToFaces.
 *
 * Pure: no three.js, no DOM. The caller supplies resolved path points (no endpoint resolution here).
 *
 * Design: control/lib/graph/workbench.plan.md §11. Sibling: lathe-faces.js, extrude-faces.js.
 */

import { norm3, dot3, sub3, centroid, newellNormal, shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mid3 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
// Rodrigues: rotate v around unit axis k by angle a.
const rodrigues = (v, k, a) => add3(add3(scl3(v, Math.cos(a)), scl3(cross3(k, v), Math.sin(a))), scl3(k, dot3(k, v) * (1 - Math.cos(a))));

const DEFAULT_SIDES = 16;
const MAX_FACES_PER_SWEEP = 16384;

/** Representative albedo. A spec's `style.fill`/`fill`/`tint` carries it; else a neutral. */
export function pickTint(spec) {
  return (spec && (spec.tint || spec.fill || (spec.style && spec.style.fill))) || '#9aa3b0';
}

/**
 * sweepToFaces(spec, opts) → [{ corners, fill, doubleSided }]
 *
 * spec: { path:[[x,y,z],…] (≥2 pts), radius>0, sides?, tint?, caps? }.
 */
export function sweepToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  // optional material response curve (polygonizer/materials.js) — absent → byte-identical
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  // a material with no explicit tint contributes its own albedo — 'chrome' LOOKS chrome
  const tint = opts.tint || spec.tint || (spec.style && spec.style.fill) || (mat && mat.base) || pickTint(spec);
  const shade = (hex, n) => shadeHexMat(hex, n, mat, { light });
  const caps = (spec.caps !== false) && (opts.caps !== false);
  const sides = Number.isInteger(spec.sides) ? Math.max(3, spec.sides) : DEFAULT_SIDES;
  const r = Number.isFinite(spec.radius) ? spec.radius : 0.5;
  const P = Array.isArray(spec.path) ? spec.path : [];
  const m = P.length;
  if (m < 2) return [];

  // tangents (central difference; clamp at the ends)
  const T = P.map((_, i) => norm3(sub3(P[Math.min(m - 1, i + 1)], P[Math.max(0, i - 1)])));
  // parallel-transport frame: seed u ⟂ T0, rotate by each tangent turn, re-orthogonalize.
  const ref = Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const U = [norm3(cross3(T[0], ref))];
  for (let i = 1; i < m; i += 1) {
    const ax = cross3(T[i - 1], T[i]);
    const sMag = Math.hypot(ax[0], ax[1], ax[2]);
    const c = Math.max(-1, Math.min(1, dot3(T[i - 1], T[i])));
    let u = sMag < 1e-7 ? U[i - 1] : rodrigues(U[i - 1], scl3(ax, 1 / sMag), Math.atan2(sMag, c));
    u = norm3(sub3(u, scl3(T[i], dot3(u, T[i]))));
    U.push(u);
  }
  const V = U.map((u, i) => cross3(T[i], u));

  const rings = P.map((p, i) => {
    const ring = [];
    for (let j = 0; j <= sides; j += 1) {
      const th = (j / sides) * 2 * Math.PI;
      ring.push(add3(p, add3(scl3(U[i], r * Math.cos(th)), scl3(V[i], r * Math.sin(th)))));
    }
    return ring;
  });

  const faces = [];
  for (let i = 0; i < m - 1; i += 1) {
    const a = rings[i], b = rings[i + 1], axisMid = mid3(P[i], P[i + 1]);
    for (let j = 0; j < sides; j += 1) {
      const corners = [a[j], a[j + 1], b[j + 1], b[j]];
      let no = newellNormal(corners);
      if (!Number.isFinite(no[0]) || !Number.isFinite(no[1]) || !Number.isFinite(no[2])) continue;
      if (dot3(no, sub3(centroid(corners), axisMid)) < 0) no = scl3(no, -1);
      faces.push({ corners, fill: shade(tint, no), doubleSided: true });
      if (faces.length >= MAX_FACES_PER_SWEEP) return tagFacesWithMaterial(faces, mat);
    }
  }
  if (caps) {
    const fan = (ring, c, no) => { const o = []; for (let j = 0; j < sides; j += 1) o.push({ corners: [c, ring[j], ring[j + 1], c], fill: shade(tint, no), doubleSided: true }); return o; };
    faces.push(...fan(rings[0], P[0], scl3(T[0], -1)));
    faces.push(...fan(rings[m - 1], P[m - 1], T[m - 1]));
  }
  return tagFacesWithMaterial(faces.slice(0, MAX_FACES_PER_SWEEP), mat);
}

/** Validate sweep specs (mirrors validateLathes/validateExtrudes). Returns an array of error strings. */
export function validateSweeps(sweeps, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(sweeps)) return errors;
  const finitePt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  sweeps.forEach((spec, i) => {
    const at = `sweeps[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    if (!Array.isArray(spec.path) || spec.path.length < 2 || !spec.path.every(finitePt)) {
      errors.push(`${at}.path must be an array of >= 2 finite [x,y,z] points`);
    } else {
      // need at least one non-degenerate segment so a tangent exists
      let moved = false;
      for (let k = 1; k < spec.path.length; k += 1) {
        const d = Math.hypot(spec.path[k][0] - spec.path[k - 1][0], spec.path[k][1] - spec.path[k - 1][1], spec.path[k][2] - spec.path[k - 1][2]);
        if (d > 1e-9) { moved = true; break; }
      }
      if (!moved) errors.push(`${at}.path has zero length (all points coincide)`);
    }
    if (!Number.isFinite(spec.radius) || spec.radius <= 0) errors.push(`${at}.radius must be a positive number`);
    if (spec.sides !== undefined && (!Number.isInteger(spec.sides) || spec.sides < 3)) errors.push(`${at}.sides must be an integer >= 3 if provided`);
  });
  return errors;
}

export { DEFAULT_SIDES, MAX_FACES_PER_SWEEP };
