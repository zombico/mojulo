/**
 * extrude-faces — the `extrude` form primitive: a 2D profile swept ALONG a straight axis into a
 * prism, with an optional WALL THICKNESS + OPEN FACE that turns the prism into a recessed shell.
 *
 * The box/extrusion sibling of `lathe` (revolution). One primitive covers a huge swath of everyday
 * objects:
 *   - solid             → box, slab, bracket, phone body, sign, hex blank   (profile + depth)
 *   - + wallThickness   → tray, case, enclosure, drawer, lid, planter, bin  (a recess WITHOUT a
 *                         general boolean — the same move `volume` makes for rotational vessels)
 *
 * Proven in the 0616 spikes (workbench-box, workbench-case). Emits the engine-agnostic baked face
 * list (`{ corners, fill, doubleSided }`) the World renderers consume, vexar-shaded (camera-
 * independent), exactly like latheToFaces / taijiToFaces.
 *
 * Pure: no three.js, no DOM. The caller resolves axisFrom/axisTo to {x,y,z} first (same contract as
 * sampleLathe — endpoint paths are not resolved here).
 *
 * Design: control/lib/graph/workbench.plan.md §3, §6. Sibling: lathe-faces.js.
 */

import { norm3, dot3, sub3, centroid, newellNormal, shadeHex, DEFAULT_LIGHT } from './vexar.js';

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const MAX_FACES_PER_EXTRUDE = 16384;
const DEFAULT_CORNER_SAMPLES = 6;

/** Representative albedo. A spec's `style.fill`/`fill`/`tint` carries it; else a neutral. */
export function pickTint(spec) {
  return (spec && (spec.tint || spec.fill || (spec.style && spec.style.fill))) || '#9aa3b0';
}

// A perpendicular basis for the extrusion plane. Axis ≈ ±z → the world xy basis (so a vertical box
// extrudes w→x, h→y, the predictable common case); otherwise a stable horizontal-seeded frame.
function perpBasis(d) {
  if (Math.abs(d[2]) > 0.999) return [[1, 0, 0], [0, 1, 0]];
  const u = norm3(cross3([0, 0, 1], d));
  return [u, norm3(cross3(d, u))];
}

// Closed profile path in the extrusion plane → [{ u, v, nu, nv }] (CCW, outward 2D normal per pt).
// Two profile kinds: { rect:{ w, h, r? } } (rounded rectangle) | { points:[[u,v],…] } (polygon).
function buildProfile(profile, cornerSamples = DEFAULT_CORNER_SAMPLES) {
  if (profile && profile.rect) {
    const { w, h, r = 0 } = profile.rect;
    return roundedRectPath(w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)), cornerSamples);
  }
  if (profile && Array.isArray(profile.points)) {
    const pts = profile.points.map((p) => ({ u: p[0], v: p[1] }));
    return withPolygonNormals(pts);
  }
  throw new Error('extrude.profile must be { rect:{ w, h, r? } } or { points:[[u,v],…] }');
}

function roundedRectPath(w, h, r, nc) {
  const hw = w / 2 - r, hh = h / 2 - r;
  if (r <= 1e-6) {
    return withPolygonNormals([{ u: hw + r, v: -hh - r }, { u: hw + r, v: hh + r }, { u: -hw - r, v: hh + r }, { u: -hw - r, v: -hh - r }].map((p) => ({ u: p.u, v: p.v })));
  }
  const centers = [[hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, 1.5 * Math.PI]];
  const out = [];
  for (const [cu, cv, a0] of centers) {
    for (let k = 0; k < nc; k += 1) {
      const a = a0 + (k / nc) * (Math.PI / 2);
      out.push({ u: cu + r * Math.cos(a), v: cv + r * Math.sin(a), nu: Math.cos(a), nv: Math.sin(a) });
    }
  }
  return out;
}

// Per-vertex outward normal = average of the two adjacent edge normals. Assumes CCW winding
// (outward = edge direction rotated −90°: (dy,−dx)). Degenerate edges are skipped.
function withPolygonNormals(pts) {
  const M = pts.length;
  const edgeN = pts.map((p, i) => {
    const q = pts[(i + 1) % M];
    const dx = q.u - p.u, dy = q.v - p.v, l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  });
  return pts.map((p, i) => {
    const a = edgeN[(i - 1 + M) % M], b = edgeN[i];
    const nu = a[0] + b[0], nv = a[1] + b[1], l = Math.hypot(nu, nv) || 1;
    return { u: p.u, v: p.v, nu: nu / l, nv: nv / l };
  });
}

// Inward-offset a ROUNDED-RECT profile by t (shell wall). Only rects shell in v1.
function offsetRect(profile, t, nc) {
  const { w, h, r = 0 } = profile.rect;
  return roundedRectPath(w - 2 * t, h - 2 * t, Math.max(r - t, 0.4 * Math.min(w - 2 * t, h - 2 * t, 1)), nc);
}

/**
 * extrudeToFaces(spec, opts) → [{ corners, fill, doubleSided }]
 *
 * spec: { profile, axisFrom, axisTo, wallThickness?, floorThickness?, openFace?, tint?, innerTint?,
 *         cornerSamples? }. Solid when wallThickness is absent; recessed shell (rect only) when set.
 */
export function extrudeToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const caps = opts.caps !== false;
  const nc = Number.isInteger(spec.cornerSamples) ? spec.cornerSamples : DEFAULT_CORNER_SAMPLES;
  const tint = opts.tint || pickTint(spec);
  const innerTint = opts.innerTint || spec.innerTint || tint;

  const aF = spec.axisFrom, aT = spec.axisTo;
  const dir = norm3([aT.x - aF.x, aT.y - aF.y, aT.z - aF.z]);
  const axisLen = Math.hypot(aT.x - aF.x, aT.y - aF.y, aT.z - aF.z) || 1;
  const [uH, vH] = perpBasis(dir);
  // profile point {u,v} at param s∈[0,1] along the axis → world [x,y,z]
  const pt = (P, s) => {
    const bx = aF.x + s * (aT.x - aF.x), by = aF.y + s * (aT.y - aF.y), bz = aF.z + s * (aT.z - aF.z);
    return [bx + uH[0] * P.u + vH[0] * P.v, by + uH[1] * P.u + vH[1] * P.v, bz + uH[2] * P.u + vH[2] * P.v];
  };
  const out3 = (P) => norm3([uH[0] * P.nu + vH[0] * P.nv, uH[1] * P.nu + vH[1] * P.nv, uH[2] * P.nu + vH[2] * P.nv]);
  const prof = buildProfile(spec.profile, nc);
  const M = prof.length;
  const faces = [];

  // centroid (uv) → fan-fill a profile ring at param s with a uniform-normal cap
  const fanCap = (path, s, normal, fillTint, flip) => {
    let cu = 0, cv = 0; for (const p of path) { cu += p.u; cv += p.v; }
    const c = pt({ u: cu / path.length, v: cv / path.length }, s);
    const fill = shadeHex(fillTint, normal, light);
    const o = [];
    for (let i = 0; i < path.length; i += 1) {
      const a = pt(path[i], s), b = pt(path[(i + 1) % path.length], s);
      o.push({ corners: flip ? [c, b, a, c] : [c, a, b, c], fill, doubleSided: true });
    }
    return o;
  };

  const wall = spec.wallThickness;
  if (!Number.isFinite(wall) || wall <= 0) {
    // ── SOLID prism: side walls + two end caps ──
    for (let i = 0; i < M; i += 1) {
      const j = (i + 1) % M;
      const no = norm3(add3(out3(prof[i]), out3(prof[j])));
      faces.push({ corners: [pt(prof[i], 0), pt(prof[j], 0), pt(prof[j], 1), pt(prof[i], 1)], fill: shadeHex(tint, no, light), doubleSided: true });
      if (faces.length >= MAX_FACES_PER_EXTRUDE) return faces;
    }
    if (caps) {
      faces.push(...fanCap(prof, 0, [-dir[0], -dir[1], -dir[2]], tint, true));
      faces.push(...fanCap(prof, 1, dir, tint, false));
    }
    return faces.slice(0, MAX_FACES_PER_EXTRUDE);
  }

  // ── SHELL (rect only): outer walls + inner cavity walls + rim + inner floor + closed back ──
  const inner = offsetRect(spec.profile, wall, nc);
  const open = spec.openFace === 'from' ? 'from' : 'to';     // which end is open (default the axisTo end)
  const floorFrac = Math.max(0, Math.min(0.92, (Number.isFinite(spec.floorThickness) ? spec.floorThickness : wall) / axisLen));
  // map so the OPEN end is at s=1 and the closed back at s=0
  const sOpen = open === 'to' ? 1 : 0, sBack = open === 'to' ? 0 : 1, sFloor = open === 'to' ? floorFrac : 1 - floorFrac;

  for (let i = 0; i < M; i += 1) {
    const j = (i + 1) % M;
    const no = norm3(add3(out3(prof[i]), out3(prof[j])));
    const ino = [-no[0], -no[1], -no[2]];
    // outer wall (full length)
    faces.push({ corners: [pt(prof[i], 0), pt(prof[j], 0), pt(prof[j], 1), pt(prof[i], 1)], fill: shadeHex(tint, no, light), doubleSided: true });
    // inner cavity wall (floor → open), faces inward
    faces.push({ corners: [pt(inner[i], sFloor), pt(inner[i], sOpen), pt(inner[j], sOpen), pt(inner[j], sFloor)], fill: shadeHex(innerTint, ino, light), doubleSided: true });
    // rim at the open end, between outer & inner
    const rimN = open === 'to' ? dir : [-dir[0], -dir[1], -dir[2]];
    faces.push({ corners: [pt(prof[i], sOpen), pt(prof[j], sOpen), pt(inner[j], sOpen), pt(inner[i], sOpen)], fill: shadeHex(tint, rimN, light), doubleSided: true });
  }
  // inner floor (faces toward the cavity = toward the open end) + closed back cap
  faces.push(...fanCap(inner, sFloor, open === 'to' ? dir : [-dir[0], -dir[1], -dir[2]], innerTint, open !== 'to'));
  faces.push(...fanCap(prof, sBack, open === 'to' ? [-dir[0], -dir[1], -dir[2]] : dir, tint, open === 'to'));
  return faces.slice(0, MAX_FACES_PER_EXTRUDE);
}

/** Validate extrude specs (mirrors validateLathes). Returns an array of error strings. */
export function validateExtrudes(extrudes, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(extrudes)) return errors;
  const finiteVec = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  extrudes.forEach((spec, i) => {
    const at = `extrudes[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    // profile
    const prof = spec.profile;
    const isRect = prof && prof.rect && Number.isFinite(prof.rect.w) && Number.isFinite(prof.rect.h) && prof.rect.w > 0 && prof.rect.h > 0;
    const isPoly = prof && Array.isArray(prof.points) && prof.points.length >= 3
      && prof.points.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!isRect && !isPoly) errors.push(`${at}.profile must be { rect:{ w>0, h>0, r? } } or { points:[≥3 [u,v]] }`);
    if (prof && prof.rect && prof.rect.r !== undefined && !Number.isFinite(prof.rect.r)) errors.push(`${at}.profile.rect.r must be a finite number if provided`);
    // axis
    for (const end of ['axisFrom', 'axisTo']) {
      if (!finiteVec(spec[end])) errors.push(`${at}.${end}: required ({x,y,z})`);
    }
    if (finiteVec(spec.axisFrom) && finiteVec(spec.axisTo)
      && Math.hypot(spec.axisTo.x - spec.axisFrom.x, spec.axisTo.y - spec.axisFrom.y, spec.axisTo.z - spec.axisFrom.z) < 1e-9) {
      errors.push(`${at}: axisFrom and axisTo must differ (zero-length extrusion)`);
    }
    // shell constraints
    if (spec.wallThickness !== undefined) {
      if (!Number.isFinite(spec.wallThickness) || spec.wallThickness <= 0) errors.push(`${at}.wallThickness must be a positive number`);
      else if (isRect && spec.wallThickness >= Math.min(prof.rect.w, prof.rect.h) / 2) errors.push(`${at}.wallThickness must be < half the smaller profile dimension`);
      if (!isRect) errors.push(`${at}.wallThickness (shell) is supported only for a rect profile in v1`);
    }
    if (spec.floorThickness !== undefined && (!Number.isFinite(spec.floorThickness) || spec.floorThickness < 0)) errors.push(`${at}.floorThickness must be a non-negative number if provided`);
    if (spec.openFace !== undefined && !['to', 'from', 'none'].includes(spec.openFace)) errors.push(`${at}.openFace must be 'to' | 'from' | 'none' if provided`);
  });
  return errors;
}

export { MAX_FACES_PER_EXTRUDE, DEFAULT_CORNER_SAMPLES };
