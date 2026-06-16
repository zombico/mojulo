/**
 * vexar — directional Lambert surface-lighting primitive.
 *
 * ★ DEFAULT lighting for curved-surface / sticker rendering in this codebase.
 *   New tessellated-surface work shades through vexar's shadeHex unless a spike
 *   is specifically demonstrating an alternative (imperfect-cel / field-cel for
 *   the stylized cel look). Chosen for the smooth, matte "lit object" read that
 *   the per-normal-on-dense-parametric-surface approach gives on compound forms.
 *
 * The minimal, correct diffuse lighting used across the curved-sticker vehicles
 * (fuselage / train cab / sedan / torus / duck): scale a flat fill by the cosine
 * of the angle between a surface's OUTWARD NORMAL and the light, with an ambient
 * floor so faces turned away from the light don't go black.
 *
 * Why it's a primitive worth naming:
 *   - Purely LOCAL — one dot product per face/cell, no neighbours, no scene.
 *     Topology-blind: it lights a convex hull, a swept superellipse, and a torus
 *     by the same rule. (Verified on the torus stress spike — lighting held; only
 *     compositing needed care.)
 *   - Resolution-independent — works per-cell at any tessellation density.
 *   - Geometry→light bridge included: Newell face normal + outward orientation,
 *     so a caller with world-space face corners gets a lit fill in one call.
 *
 * What vexar deliberately is NOT:
 *   - Not field-cel: no tonal banding, contour darkening, gravity/contact shadow,
 *     or gradients. field-cel.js is the stylized pipeline; vexar is the bare
 *     cosine term it (and everything else) is built on.
 *   - Not a visibility solver: it answers "how lit is this face?", never "is this
 *     face visible / shadowed?". Pair it with back-face culling + a depth policy.
 *     No self-shadowing (a torus hole won't get a cast shadow).
 */

export const VEXAR_VERSION = 'vexar-v0.1.0';

// ---- vector math (exported: lighting needs them, callers reuse them) -------
export function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function centroid(pts) {
  const n = pts.length || 1;
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n, pts.reduce((a, p) => a + p[2], 0) / n];
}

// ---- normals: the geometry→light bridge ------------------------------------
/** Newell's-method normal of a planar-ish polygon (3+ world points). Robust to
 *  non-planar quads. Sign follows vertex winding — orient with orientOutward. */
export function newellNormal(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm3(n);
}
/** Flip `normal` so it points AWAY from `inside` (a spine/axis point the surface
 *  wraps around) — turns a winding-dependent normal into a true outward normal. */
export function orientOutward(normal, faceCentroid, inside) {
  return dot3(normal, sub3(faceCentroid, inside)) >= 0 ? normal : [-normal[0], -normal[1], -normal[2]];
}

// ---- color -----------------------------------------------------------------
export function hexToRgb(h) { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
export function rgbToHex(r) { const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return `#${c(r[0])}${c(r[1])}${c(r[2])}`; }
export function scaleHex(hex, f) { return rgbToHex(hexToRgb(hex).map((v) => v * f)); }

// ---- the light + the shade -------------------------------------------------
/** A light. `direction` is the way the light travels (normalized); `ambient` is
 *  the floor brightness for fully-turned-away faces; `diffuse` is the range
 *  added as a face turns to meet the light. Brightness ∈ [ambient, ambient+diffuse]. */
export function makeLight({ direction = [0.4, 0.5, -0.76], ambient = 0.46, diffuse = 0.6 } = {}) {
  const d = norm3(direction);
  return { dir: d, toLight: [-d[0], -d[1], -d[2]], ambient, diffuse };
}
export const DEFAULT_LIGHT = makeLight();

// ---- LOD: sustainable-by-default tessellation, tweakable upward ------------
// vexar surfaces read smooth from SHADING, not polygon count — so the default
// mesh is deliberately coarse (sustainable file size). A surface scales its base
// cell counts by vexarLod(quality): pass a named level, or a raw factor for hero
// close-ups. The LOD study (city bus) showed 80×56 ≈ indistinguishable from
// 150×120 at a third the bytes — see vehicle-smooth-box-net.plan.md.
export const VEXAR_QUALITY = { draft: 0.6, default: 1.0, hero: 1.8, ultra: 2.6 };
export function vexarLod(quality = 'default') {
  if (typeof quality === 'number' && Number.isFinite(quality)) return Math.max(0.25, quality);
  return VEXAR_QUALITY[quality] ?? VEXAR_QUALITY.default;
}
/** Scale a base cell count by quality, floored so 'draft' stays legible. */
export function lodCount(base, quality = 'default', floor = 8) {
  return Math.max(floor, Math.round(base * vexarLod(quality)));
}

/** Lambert brightness for an outward normal under a light. */
export function litFactor(normal, light = DEFAULT_LIGHT) {
  return light.ambient + light.diffuse * Math.max(0, dot3(normal, light.toLight));
}
/** Scale a flat fill by the Lambert factor — the per-cell shade. */
export function shadeHex(hex, normal, light = DEFAULT_LIGHT) {
  return scaleHex(hex, litFactor(normal, light));
}
/**
 * One-call surface shade: from a face's world `corners` + base `hex`, compute the
 * outward normal (Newell, oriented away from `inside` if given) and return the lit
 * fill plus the normal (for the caller's back-face cull).
 * @returns {{ fill:string, normal:number[] }}
 */
export function shadeFace(corners, hex, { light = DEFAULT_LIGHT, inside = null } = {}) {
  let normal = newellNormal(corners);
  if (inside) normal = orientOutward(normal, centroid(corners), inside);
  return { fill: shadeHex(hex, normal, light), normal };
}
