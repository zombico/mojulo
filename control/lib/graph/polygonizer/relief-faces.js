/**
 * relief-faces — the `relief` form primitive: a 2D OUTLINE (an SVG path or
 * font-carved text) raised off a base plane along its NORMAL into real,
 * vexar-shaded geometry. The additive twin of a router cut — we never carve
 * down, we always lay matter on.
 *
 * Where `lathe` revolves a profile around an AXIS and `extrude` sweeps a profile
 * ALONG an axis, `relief` raises a field ORTHOGONAL to a base: emboss a wordmark
 * onto a plate (a plaque/nameplate), or onto a lathe-turned disc (a struck coin /
 * medallion). It reuses the carve-solid kernel (parseSvgPath / layoutText /
 * extrudeProfile) for the outline → bevelled solid, then re-shades through the
 * workbench's own vexar light — geometry only, none of carved-solid's
 * material / inner-glow / fx illustration stack.
 *
 * The kernel's caps are evenodd contour rings (letter counters are holes); a 3D
 * face list can't fill evenodd, so caps are tessellated via triangulateRings.
 * Side / bevel quads port directly.
 *
 * Emits the engine-agnostic baked face list (`{ corners, fill, doubleSided }`)
 * the World renderers consume, vexar-shaded (camera-independent), exactly like
 * latheToFaces / extrudeToFaces. Pure: no three.js, no DOM (a font path is read
 * from disk lazily, mirroring carved-solid).
 *
 * spec: { shape:{ path } | { text, font? }, style?:{ depth, bevel, bevelSteps,
 *         weight, blocky, slant, tracking, curveSteps }, size, anchor:{x,y,z},
 *         normal?:{x,y,z}=+z, up?:{x,y,z}=+y, tint? }
 *
 * Sibling: extrude-faces.js · Design: control/lib/graph/workbench.plan.md.
 */

import { readFileSync } from 'node:fs';

import { norm3, sub3, dot3, centroid, newellNormal, orientOutward, shadeHex, DEFAULT_LIGHT } from './vexar.js';
import { parseSvgPath, normalizeContours, extrudeProfile } from './carve-solid.js';
import { triangulateRings } from './triangulate.js';
import { loadFont, layoutText } from '../../motion/glyph-carver.js';

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3 = (p, fb) => (p && Number.isFinite(p.x) ? [p.x, p.y, p.z] : fb);

const DEFAULT_FONTS = [
  '/System/Library/Fonts/Supplemental/Arial Black.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
const FONT_CACHE = new Map();
function resolveFont(p) {
  for (const path of p ? [p, ...DEFAULT_FONTS] : DEFAULT_FONTS) {
    if (FONT_CACHE.has(path)) return FONT_CACHE.get(path);
    try { const f = loadFont(readFileSync(path)); FONT_CACHE.set(path, f); return f; } catch { /* next */ }
  }
  throw new Error(`relief: no usable font found. Pass shape.font with a .ttf path.`);
}

function bbox(contours) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of contours) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY };
}
const recenter = (cs) => { const b = bbox(cs); const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2; return cs.map((r) => r.map(([x, y]) => [x - cx, y - cy])); };

// A path fits a unit box (max dim = 1); text scales so cap-height = 1 (depth /
// bevel stay proportional to letter height). `size` then maps that to literal units.
function resolveContours(shape, style) {
  if (shape && shape.path) return normalizeContours(parseSvgPath(shape.path, { curveSteps: style.curveSteps || 18 }), { flipY: true });
  if (shape && shape.text) {
    const { glyphs } = layoutText(resolveFont(shape.font), shape.text, style);
    const cs = glyphs.flatMap((g) => g.contours);
    const cap = bbox(cs).maxY || 1;
    return recenter(cs.map((r) => r.map(([x, y]) => [x / cap, y / cap])));
  }
  throw new Error('relief.shape must be { path:"<svg d>" } or { text:"…", font? }');
}

/**
 * reliefToFaces(spec, opts) → [{ corners, fill, doubleSided }]
 * The outline is raised by `size * depth` along `normal`; the back cap seats on
 * the `anchor` plane, the bevelled front cap is the visible raised top.
 */
export function reliefToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const style = spec.style || {};
  const depth = Number.isFinite(style.depth) ? style.depth : 0.18;
  const bevel = Number.isFinite(style.bevel) ? style.bevel : 0.04;
  const size = Number.isFinite(spec.size) ? spec.size : 1;
  const tint = opts.tint || spec.tint || '#c79a4b';

  const contours = resolveContours(spec.shape, { ...style, depth });
  const { faces } = extrudeProfile(contours, { depth, bevel, bevelSteps: style.bevelSteps ?? 6 });

  // Orthonormal frame: nHat ← raise direction, vHat ← up projected into the
  // plane (glyph vertical). uHat is negated so the front cap (the readable face)
  // reads correctly when viewed from +nHat — without it the raise flips handedness
  // and the lettering comes out mirrored.
  const nHat = norm3(v3(spec.normal, [0, 0, 1]));
  let up = v3(spec.up, [0, 1, 0]);
  const upDot = dot3(up, nHat);
  let vHat = norm3([up[0] - upDot * nHat[0], up[1] - upDot * nHat[1], up[2] - upDot * nHat[2]]);
  if (!Number.isFinite(vHat[0]) || (vHat[0] === 0 && vHat[1] === 0 && vHat[2] === 0)) vHat = norm3(cross3(nHat, [1, 0, 0]));
  const u0 = norm3(cross3(vHat, nHat));
  const uHat = [-u0[0], -u0[1], -u0[2]];
  const anchor = v3(spec.anchor, [0, 0, 0]);
  const neg = (n) => [-n[0], -n[1], -n[2]];
  // local [x,y,z] (z: 0 front … depth back) → world. (depth − z): back cap seats on anchor; front raised.
  const place = ([x, y, z]) => [
    anchor[0] + size * (x * uHat[0] + y * vHat[0] + (depth - z) * nHat[0]),
    anchor[1] + size * (x * uHat[1] + y * vHat[1] + (depth - z) * nHat[1]),
    anchor[2] + size * (x * uHat[2] + y * vHat[2] + (depth - z) * nHat[2]),
  ];

  const out = [];
  // Slab centroid (for orienting wall normals outward).
  const slabC = place([0, 0, depth / 2]);
  // Emit a face wound so its geometric (Newell) normal matches `want` — keeps the
  // whole solid consistently outward-wound, so single-sided renderers / back-face
  // culls behave (the place() frame mirror + z-flip would otherwise vary winding).
  const emit = (corners, want) => {
    const c = dot3(newellNormal(corners), want) < 0 ? corners.slice().reverse() : corners;
    out.push({ corners: c, fill: shadeHex(tint, want, light), doubleSided: true });
  };
  for (const f of faces) {
    if (f.kind === 'quad') {
      const corners = f.pts.map(place);
      emit(corners, orientOutward(newellNormal(corners), centroid(corners), slabC));
    } else { // cap: tessellate evenodd rings → triangles
      const capZ = f.contours[0][0][2];
      const rings2d = f.contours.map((ring) => ring.map(([x, y]) => [x, y]));
      const want = f.side === 'front' ? nHat : neg(nHat);
      for (const tri of triangulateRings(rings2d)) emit(tri.map(([x, y]) => place([x, y, capZ])), want);
    }
  }
  return out;
}

/** Validate relief specs (mirrors validateExtrudes). Returns an array of error strings. */
export function validateReliefs(reliefs, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(reliefs)) return errors;
  reliefs.forEach((spec, i) => {
    const at = `reliefs[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    const sh = spec.shape;
    const okShape = sh && (typeof sh.path === 'string' || typeof sh.text === 'string');
    if (!okShape) errors.push(`${at}.shape must be { path:"<svg d>" } or { text:"…", font? }`);
    if (!spec.anchor || !Number.isFinite(spec.anchor.x) || !Number.isFinite(spec.anchor.y) || !Number.isFinite(spec.anchor.z)) errors.push(`${at}.anchor: required ({x,y,z}) — where the outline plane sits`);
    if (spec.size !== undefined && (!Number.isFinite(spec.size) || spec.size <= 0)) errors.push(`${at}.size must be a positive number`);
    if (spec.style && spec.style.depth !== undefined && (!Number.isFinite(spec.style.depth) || spec.style.depth <= 0)) errors.push(`${at}.style.depth must be a positive number`);
  });
  return errors;
}
