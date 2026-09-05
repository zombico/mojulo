/**
 * loft-faces — the `loft` form primitive: a PROFILE THAT CHANGES along its path.
 *
 * `extrude` sweeps one profile straight; its `endProfile` lerps to a second ring. `sweep` carries
 * one round profile along a curve. A loft is the N-station generalisation of both: any number of
 * `stations` (each a closed 2D profile at a parameter t ∈ [0,1] along the path, optionally rolled),
 * interpolated ring-to-ring — a boat hull (keel station → midship → transom), a tapering handle, a
 * bottle that squares off, an airfoil that twists. Frames come from `sweep`'s parallel transport
 * on a curved path; a straight axis (a 2-point path, or `{ axisFrom, axisTo }`) uses `extrude`'s
 * Z-cross basis, so a two-station straight loft is BYTE-IDENTICAL to the matching `endProfile`
 * extrude (the regression anchor, pinned by test).
 *
 * Every station shares one point count (the rule `endProfile` already enforces; the validator
 * names the offending station). `interp:'linear'` (default) lerps station to station; `'smooth'`
 * runs a Catmull-Rom spline through each point's station positions (rings are then subdivided
 * `segments` times per station gap on a straight path; on a curved path the path points ARE the
 * rings — put a path point where a station must land exactly).
 *
 * Emits the engine-agnostic baked face list (`{ corners, fill, doubleSided, outNormal }`) like
 * every monomer, vexar-shaded, capped, `tagFacesWithMaterial`'d. Pure, deterministic, no dice.
 *
 * Design: lite-template/integration/0904/field-solids.plan.md F1. Siblings: extrude-faces.js,
 * sweep-faces.js.
 */

import { norm3, dot3, newellNormal, shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';
import { perpBasis, withPolygonNormals } from './extrude-faces.js';
import { transportFrames } from './sweep-faces.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const MAX_FACES_PER_LOFT = 16384;
const DEFAULT_SIDES = 16;
const DEFAULT_SEGMENTS = 6;
const MAX_SEGMENTS = 64;

/** Representative albedo. A spec's `style.fill`/`fill`/`tint` carries it; else a neutral. */
export function pickTint(spec) {
  return (spec && (spec.tint || spec.fill || (spec.style && spec.style.fill))) || '#9aa3b0';
}

const toArr = (p) => (Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z]);
const isPt = (p) => (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))
  || (p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

/** The path as [x,y,z] arrays — `{ axisFrom, axisTo }` is the 2-point straight axis. */
export function loftPath(spec) {
  if (Array.isArray(spec.path)) return spec.path.map(toArr);
  if (spec.axisFrom && spec.axisTo) return [toArr(spec.axisFrom), toArr(spec.axisTo)];
  return [];
}

/** A station's profile as raw [[u,v],…] (CCW), with its roll applied. */
export function stationPoints(st) {
  const pr = st.profile;
  let pts;
  if (Array.isArray(pr)) pts = pr.map((p) => [p[0], p[1]]);
  else if (pr && Array.isArray(pr.points)) pts = pr.points.map((p) => [p[0], p[1]]);
  else {
    const sides = Number.isInteger(pr.sides) ? Math.max(3, pr.sides) : DEFAULT_SIDES;
    pts = [];
    for (let j = 0; j < sides; j += 1) { const th = (j / sides) * 2 * Math.PI; pts.push([pr.radius * Math.cos(th), pr.radius * Math.sin(th)]); }
  }
  if (Number.isFinite(st.roll) && st.roll !== 0) {
    const a = (st.roll * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    pts = pts.map(([u, v]) => [c * u - s * v, s * u + c * v]);
  }
  return pts;
}

// Catmull-Rom (Hermite with chord tangents over the stations' non-uniform t) for one coordinate.
function hermite(t, t0, t1, p0, p1, m0, m1) {
  const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
}

/** Interpolate the station rings at parameter s → raw [[u,v],…]. */
function ringAt(stations, pts, s, interp) {
  const n = stations.length;
  if (s <= stations[0].t) return pts[0];
  if (s >= stations[n - 1].t) return pts[n - 1];
  let k = 0;
  while (k + 1 < n - 1 && s > stations[k + 1].t) k += 1;
  const t0 = stations[k].t, t1 = stations[k + 1].t;
  const a = pts[k], b = pts[k + 1];
  if (interp !== 'smooth' || n < 3) {
    const w = (s - t0) / (t1 - t0);
    return a.map((p, i) => [p[0] + w * (b[i][0] - p[0]), p[1] + w * (b[i][1] - p[1])]);
  }
  const prev = pts[Math.max(0, k - 1)], next = pts[Math.min(n - 1, k + 2)];
  const tp = stations[Math.max(0, k - 1)].t, tn = stations[Math.min(n - 1, k + 2)].t;
  return a.map((p, i) => {
    const m0u = (b[i][0] - prev[i][0]) / (t1 - tp), m0v = (b[i][1] - prev[i][1]) / (t1 - tp);
    const m1u = (next[i][0] - p[0]) / (tn - t0), m1v = (next[i][1] - p[1]) / (tn - t0);
    return [hermite(s, t0, t1, p[0], b[i][0], m0u, m1u), hermite(s, t0, t1, p[1], b[i][1], m0v, m1v)];
  });
}

function ringArea(path) {
  let a = 0;
  for (let i = 0; i < path.length; i += 1) { const p = path[i], q = path[(i + 1) % path.length]; a += p.u * q.v - q.u * p.v; }
  return a / 2;
}

/**
 * loftToFaces(spec, opts) → [{ corners, fill, doubleSided, outNormal }]
 *
 * spec: { path:[[x,y,z],…] | axisFrom+axisTo, stations:[{ t, profile, roll? }], interp?, segments?,
 *         caps?, tint?, material? }
 */
export function loftToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  const tint = opts.tint || spec.tint || spec.fill || (spec.style && spec.style.fill) || (mat && mat.base) || pickTint(spec);
  const shade = (hex, n) => shadeHexMat(hex, n, mat, { light });
  const caps = (spec.caps !== false) && (opts.caps !== false);
  const interp = spec.interp === 'smooth' ? 'smooth' : 'linear';

  const P = loftPath(spec);
  if (P.length < 2) return [];
  const stations = [...spec.stations].sort((a, b) => a.t - b.t);
  const stPts = stations.map(stationPoints);

  // ring parameters + centres + frames
  let S, C, U, V, T;
  if (P.length === 2) {
    // straight axis — extrude's basis + extrude's centre arithmetic (the byte-identity anchor)
    const aF = P[0], aT = P[1];
    const dir = norm3([aT[0] - aF[0], aT[1] - aF[1], aT[2] - aF[2]]);
    const [uH, vH] = perpBasis(dir);
    S = stations.map((st) => st.t);
    if (interp === 'smooth') {
      const segs = Number.isInteger(spec.segments) ? Math.max(1, Math.min(MAX_SEGMENTS, spec.segments)) : DEFAULT_SEGMENTS;
      const fine = [];
      for (let k = 0; k + 1 < S.length; k += 1) for (let q = 0; q < segs; q += 1) fine.push(S[k] + (q / segs) * (S[k + 1] - S[k]));
      fine.push(S[S.length - 1]);
      S = fine;
    }
    C = S.map((s) => [aF[0] + s * (aT[0] - aF[0]), aF[1] + s * (aT[1] - aF[1]), aF[2] + s * (aT[2] - aF[2])]);
    U = S.map(() => uH); V = S.map(() => vH); T = S.map(() => dir);
  } else {
    // curved path — the path points are the rings; s = arc-length fraction
    const cum = [0];
    for (let i = 1; i < P.length; i += 1) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    const L = cum[cum.length - 1] || 1;
    S = cum.map((c) => c / L);
    C = P;
    ({ T, U, V } = transportFrames(P));
  }
  const rings = S.map((s) => withPolygonNormals(ringAt(stations, stPts, s, interp).map(([u, v]) => ({ u, v }))));
  const K = rings.length;
  const M = rings[0].length;

  const pt = (Q, k) => [C[k][0] + U[k][0] * Q.u + V[k][0] * Q.v, C[k][1] + U[k][1] * Q.u + V[k][1] * Q.v, C[k][2] + U[k][2] * Q.u + V[k][2] * Q.v];
  const out3 = (Q, k) => norm3([U[k][0] * Q.nu + V[k][0] * Q.nv, U[k][1] * Q.nu + V[k][1] * Q.nv, U[k][2] * Q.nu + V[k][2] * Q.nv]);
  const fanCap = (ring, k, normal, flip) => {
    let cu = 0, cv = 0; for (const q of ring) { cu += q.u; cv += q.v; }
    const c = pt({ u: cu / ring.length, v: cv / ring.length }, k);
    const fill = shade(tint, normal);
    const o = [];
    for (let i = 0; i < ring.length; i += 1) {
      const a = pt(ring[i], k), b = pt(ring[(i + 1) % ring.length], k);
      o.push({ corners: flip ? [c, b, a, c] : [c, a, b, c], fill, doubleSided: true, outNormal: normal });
    }
    return o;
  };

  const faces = [];
  for (let k = 0; k + 1 < K; k += 1) {
    const R0 = rings[k], R1 = rings[k + 1];
    // Winding-robust export normal (extrude-faces P2): a CW profile yields inward analytic normals;
    // flip the exported outNormal to genuine outward while the shaded fill keeps the raw normal.
    const outSign = ringArea(R1) >= 0 ? 1 : -1;
    for (let i = 0; i < M; i += 1) {
      const j = (i + 1) % M;
      const corners = [pt(R0[i], k), pt(R0[j], k), pt(R1[j], k + 1), pt(R1[i], k + 1)];
      let raw = newellNormal(corners);
      if (Math.hypot(raw[0], raw[1], raw[2]) < 1e-9) continue;   // pinched wall: zero area
      const hint = add3(add3(out3(R0[i], k), out3(R0[j], k)), add3(out3(R1[i], k + 1), out3(R1[j], k + 1)));
      if (dot3(raw, hint) < 0) raw = [-raw[0], -raw[1], -raw[2]];
      const no = norm3(raw);
      const outNormal = outSign > 0 ? no : [-no[0], -no[1], -no[2]];
      faces.push({ corners, fill: shade(tint, no), doubleSided: true, outNormal });
      if (faces.length >= MAX_FACES_PER_LOFT) return tagFacesWithMaterial(faces, mat);
    }
  }
  if (caps) {
    if (Math.abs(ringArea(rings[0])) > 1e-9) faces.push(...fanCap(rings[0], 0, [-T[0][0], -T[0][1], -T[0][2]], true));
    if (Math.abs(ringArea(rings[K - 1])) > 1e-9) faces.push(...fanCap(rings[K - 1], K - 1, T[K - 1], false));
  }
  return tagFacesWithMaterial(faces.slice(0, MAX_FACES_PER_LOFT), mat);
}

/** Validate loft specs (mirrors validateExtrudes / validateSweeps). Returns an array of error strings. */
export function validateLofts(lofts, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(lofts)) return errors;
  lofts.forEach((spec, i) => {
    const at = `lofts[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    // path
    if (Array.isArray(spec.path)) {
      if (spec.path.length < 2 || !spec.path.every(isPt)) errors.push(`${at}.path: must be ≥2 points ([x,y,z] or {x,y,z})`);
      else {
        const P = spec.path.map(toArr);
        for (let k = 1; k < P.length; k += 1) {
          if (Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1], P[k][2] - P[k - 1][2]) < 1e-9) { errors.push(`${at}.path: points ${k - 1} and ${k} coincide`); break; }
        }
      }
    } else if (spec.axisFrom !== undefined || spec.axisTo !== undefined) {
      if (!isPt(spec.axisFrom) || !isPt(spec.axisTo)) errors.push(`${at}: axisFrom and axisTo must both be points ({x,y,z} or [x,y,z])`);
      else {
        const a = toArr(spec.axisFrom), b = toArr(spec.axisTo);
        if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-9) errors.push(`${at}: axisFrom and axisTo must differ (zero-length loft)`);
      }
    } else errors.push(`${at}: needs a \`path\` (≥2 points) or a straight axis (\`axisFrom\` + \`axisTo\`)`);
    // stations
    const st = spec.stations;
    if (!Array.isArray(st) || st.length < 2) { errors.push(`${at}.stations: must be an array of ≥2 { t, profile, roll? } (one station is an extrude — use \`extrudes\`)`); return; }
    let count = null;
    st.forEach((s, k) => {
      const here = `${at}.stations[${k}]`;
      if (!s || typeof s !== 'object') { errors.push(`${here}: must be an object { t, profile }`); return; }
      if (!Number.isFinite(s.t) || s.t < 0 || s.t > 1) errors.push(`${here}.t: must be a number in [0, 1]`);
      if (s.roll !== undefined && !Number.isFinite(s.roll)) errors.push(`${here}.roll: must be a finite number of degrees when provided`);
      const pr = s.profile;
      const pts = Array.isArray(pr) ? pr : (pr && Array.isArray(pr.points) ? pr.points : null);
      let n = null;
      if (pts) {
        if (pts.length < 3 || !pts.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) errors.push(`${here}.profile: must be ≥3 [u,v] points`);
        else n = pts.length;
      } else if (pr && typeof pr === 'object' && pr.radius !== undefined) {
        if (!(Number.isFinite(pr.radius) && pr.radius > 0)) errors.push(`${here}.profile.radius: must be a positive number`);
        if (pr.sides !== undefined && !(Number.isInteger(pr.sides) && pr.sides >= 3)) errors.push(`${here}.profile.sides: must be an integer ≥3 when provided`);
        else n = Number.isInteger(pr.sides) ? pr.sides : DEFAULT_SIDES;
      } else errors.push(`${here}.profile: must be [[u,v],…] (≥3 points) or { radius, sides? }`);
      if (n !== null) {
        if (count === null) count = n;
        else if (n !== count) errors.push(`${here}.profile has ${n} points but stations[0] has ${count} — every station must share one point count (a round station's \`sides\` counts)`);
      }
    });
    const ts = st.map((s) => s && s.t).filter(Number.isFinite).sort((a, b) => a - b);
    for (let k = 1; k < ts.length; k += 1) if (ts[k] - ts[k - 1] < 1e-9) { errors.push(`${at}.stations: two stations share t=${ts[k]} — station t values must be distinct`); break; }
    if (spec.interp !== undefined && !['linear', 'smooth'].includes(spec.interp)) errors.push(`${at}.interp: must be 'linear' | 'smooth' when provided`);
    if (spec.segments !== undefined && !(Number.isInteger(spec.segments) && spec.segments >= 1 && spec.segments <= MAX_SEGMENTS)) errors.push(`${at}.segments: must be an integer in [1, ${MAX_SEGMENTS}] when provided`);
    if (spec.caps !== undefined && typeof spec.caps !== 'boolean') errors.push(`${at}.caps: must be a boolean when provided`);
  });
  return errors;
}

export { MAX_FACES_PER_LOFT, DEFAULT_SIDES, DEFAULT_SEGMENTS };
