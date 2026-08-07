/**
 * lathe — 2D-closed surface of revolution over an axis.
 *
 * The fourth polygonizer primitive, sibling to line-between (1D open),
 * wave-field (2D open), and wave-manji (1D closed). Lathes are 2D
 * *closed* — a stream of closed cross-section polylines swept along an
 * axis between two endpoints, with the radius at each cross-section
 * determined by a profile waveform and optional angular harmonics.
 *
 * The act of sampling produces the surface: profile × axis = surface
 * of revolution. The substrate sweeps a 1D profile around the axis
 * direction once per cross-section level, summing N-fold harmonics
 * into the radius for chiseling/fluting effects.
 *
 * Design: lite-template/integration/0605/lathe-primitive.plan.md.
 */

import { buildEndpointResolver } from './line-between.js';

/**
 * Validate a list of lathe specs against a walker's emitted nodes.
 * Mirrors validateConnections / validateWaveFields / validateWaveManji.
 * Endpoint paths in axisFrom/axisTo are resolved here at mint time so
 * bad refs surface as 400s, not 500s at render time.
 */
export function validateLathes(lathes, emittedNodes) {
  const errors = [];
  if (!Array.isArray(lathes)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  lathes.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`lathes[${i}]: must be an object with axisFrom/axisTo and profile`);
      return;
    }
    for (const end of ['axisFrom', 'axisTo']) {
      const v = spec[end];
      if (v === undefined || v === null) {
        errors.push(`lathes[${i}].${end}: required (endpoint path or {x,y,z})`);
        continue;
      }
      if (typeof v === 'string') {
        try {
          resolveEndpoint(v);
        } catch (err) {
          errors.push(`lathes[${i}].${end}: ${err.message}`);
        }
      } else if (!isFiniteVec(v)) {
        errors.push(`lathes[${i}].${end}: must be an endpoint path string or {x,y,z}`);
      }
    }
    if (!Array.isArray(spec.profile) || spec.profile.length === 0) {
      errors.push(`lathes[${i}].profile: required (non-empty array of { t, radius } entries)`);
    } else {
      let prevT = -Infinity;
      spec.profile.forEach((pt, j) => {
        if (!pt || typeof pt !== 'object') {
          errors.push(`lathes[${i}].profile[${j}]: must be an object with { t, radius }`);
          return;
        }
        if (!Number.isFinite(pt.t)) {
          errors.push(`lathes[${i}].profile[${j}].t: must be a finite number`);
        } else if (pt.t < prevT) {
          errors.push(`lathes[${i}].profile[${j}].t: must be monotonically non-decreasing (got ${pt.t} after ${prevT})`);
        }
        if (!Number.isFinite(pt.radius)) {
          errors.push(`lathes[${i}].profile[${j}].radius: must be a finite number`);
        }
        if (Number.isFinite(pt.t)) prevT = pt.t;
      });
    }
    // Optional cross-section frame interpolation. When normalFrom/normalTo
    // are given, the slice basis slerps from one to the other along the
    // axis (a bent sweep). They must be supplied as a pair.
    const hasFrom = spec.normalFrom !== undefined;
    const hasTo = spec.normalTo !== undefined;
    if (hasFrom !== hasTo) {
      errors.push(`lathes[${i}]: normalFrom and normalTo must be provided together`);
    }
    if (hasFrom && !isFiniteVec(spec.normalFrom)) {
      errors.push(`lathes[${i}].normalFrom: must be {x,y,z} when provided`);
    }
    if (hasTo && !isFiniteVec(spec.normalTo)) {
      errors.push(`lathes[${i}].normalTo: must be {x,y,z} when provided`);
    }
    if (spec.harmonics !== undefined) {
      if (!Array.isArray(spec.harmonics)) {
        errors.push(`lathes[${i}].harmonics: must be an array of { n, amplitude, phase? }`);
      } else {
        spec.harmonics.forEach((h, j) => {
          if (!h || typeof h !== 'object') {
            errors.push(`lathes[${i}].harmonics[${j}]: must be an object`);
            return;
          }
          if (!Number.isInteger(h.n) || h.n < 1) {
            errors.push(`lathes[${i}].harmonics[${j}].n: must be a positive integer`);
          }
          if (!Number.isFinite(h.amplitude)) {
            errors.push(`lathes[${i}].harmonics[${j}].amplitude: must be a finite number`);
          }
          if (h.phase !== undefined && !Number.isFinite(h.phase)) {
            errors.push(`lathes[${i}].harmonics[${j}].phase: must be a finite number when provided`);
          }
        });
      }
    }
  });
  return errors;
}

/**
 * Sample a lathe. The spec's `axisFrom` and `axisTo` must already be
 * resolved to 3D points (the caller pre-resolves endpoint paths,
 * mirroring how sampleLineBetween / printWaveManji receive resolved
 * endpoints).
 *
 * Returns { polylines: Point3D[][] } — one closed polyline per
 * cross-section level along the axis. The renderer projects + paints
 * each polyline like any other sample stream.
 */
export function sampleLathe(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('sampleLathe: spec object required');
  }
  if (!isFiniteVec(spec.axisFrom)) {
    throw new Error('sampleLathe: spec.axisFrom must be {x,y,z} (resolve endpoint paths first)');
  }
  if (!isFiniteVec(spec.axisTo)) {
    throw new Error('sampleLathe: spec.axisTo must be {x,y,z} (resolve endpoint paths first)');
  }
  if (!Array.isArray(spec.profile) || spec.profile.length === 0) {
    throw new Error('sampleLathe: spec.profile must be a non-empty array of { t, radius }');
  }
  const axisFrom = spec.axisFrom;
  const axisTo = spec.axisTo;
  const dirX = axisTo.x - axisFrom.x;
  const dirY = axisTo.y - axisFrom.y;
  const dirZ = axisTo.z - axisFrom.z;
  const axisLen = Math.hypot(dirX, dirY, dirZ);
  if (axisLen < 1e-9) {
    throw new Error('sampleLathe: axisFrom and axisTo must differ (zero-length axis)');
  }
  const axisDir = { x: dirX / axisLen, y: dirY / axisLen, z: dirZ / axisLen };
  const [uHat, vHat] = perpendicularBasis(axisDir);

  // Optional frame interpolation: when both endpoint normals are supplied,
  // each cross-section's basis is built from a slice-normal that slerps
  // from normalFrom (t=0) to normalTo (t=1). When absent — or when both
  // equal axisDir — the rigid axis basis above is reused, so plain lathes
  // are byte-identical to before this option existed.
  const bendNormalFrom = isFiniteVec(spec.normalFrom) ? normalize3(spec.normalFrom) : null;
  const bendNormalTo = isFiniteVec(spec.normalTo) ? normalize3(spec.normalTo) : null;
  const bendFrames = bendNormalFrom !== null && bendNormalTo !== null;

  // Profile preparation: sort defensively (validator already checks
  // monotonicity, but a single-pt profile or unsorted input shouldn't
  // crash). Cache as ascending-t pairs.
  const profile = [...spec.profile]
    .filter((p) => Number.isFinite(p?.t) && Number.isFinite(p?.radius))
    .sort((a, b) => a.t - b.t);
  if (profile.length === 0) {
    throw new Error('sampleLathe: profile contains no usable { t, radius } entries');
  }
  const interpolateProfile = (t) => {
    if (t <= profile[0].t) return profile[0].radius;
    if (t >= profile[profile.length - 1].t) return profile[profile.length - 1].radius;
    // Binary search would be neat but the profile is tiny.
    for (let k = 0; k + 1 < profile.length; k += 1) {
      const a = profile[k];
      const b = profile[k + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        if (span < 1e-12) return a.radius;
        const u = (t - a.t) / span;
        return a.radius + u * (b.radius - a.radius);
      }
    }
    return profile[profile.length - 1].radius;
  };

  const harmonics = Array.isArray(spec.harmonics) ? spec.harmonics : [];
  const crossSections = clampInt(spec.crossSections, 2, 256, 24);
  const samples = clampInt(spec.samples, 8, 1024, 36);

  const polylines = [];
  for (let i = 0; i <= crossSections; i += 1) {
    const t = i / crossSections;
    const center = {
      x: axisFrom.x + t * dirX,
      y: axisFrom.y + t * dirY,
      z: axisFrom.z + t * dirZ,
    };
    const baseRadius = interpolateProfile(t);
    let uAt = uHat;
    let vAt = vHat;
    if (bendFrames) {
      const sliceNormal = slerp3(bendNormalFrom, bendNormalTo, t);
      [uAt, vAt] = perpendicularBasis(sliceNormal);
    }
    const poly = new Array(samples + 1);
    for (let j = 0; j <= samples; j += 1) {
      const theta = (j / samples) * 2 * Math.PI;
      let radius = baseRadius;
      for (const h of harmonics) {
        if (!h) continue;
        const order = Number.isFinite(h.n) ? h.n : 0;
        const amp = Number.isFinite(h.amplitude) ? h.amplitude : 0;
        const ph = Number.isFinite(h.phase) ? h.phase : 0;
        if (order === 0 || amp === 0) continue;
        radius += amp * Math.cos(order * theta + ph);
      }
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      poly[j] = {
        x: center.x + radius * (cosT * uAt.x + sinT * vAt.x),
        y: center.y + radius * (cosT * uAt.y + sinT * vAt.y),
        z: center.z + radius * (cosT * uAt.z + sinT * vAt.z),
      };
    }
    polylines.push(poly);
  }
  return { polylines };
}

// ─── the `detail` dial ────────────────────────────────────────────────
//
// A model-level resolution multiplier for lathe part-graphs (polygomers).
// `detail: 2` on a manji-tree manifest raises articulation where it matters
// without re-authoring 20+ individual lathes — and WITHOUT a uniform face
// explosion. The taming is budget reuse, not instancing:
//   • each lathe's boost is weighted by its size share (axis length × max
//     profile radius ≈ surface-area share), so hero masses get the full dial
//     while detail beads (eyes, teeth) keep their authored lean counts;
//   • the ADDED resolution is damped until the estimated face total fits
//     LATHE_DETAIL_FACE_BUDGET — authored counts are never reduced.
// Same posture as the plant primitive's auto-lightening `detail` enum: the
// default path is always renderable. Pure and deterministic; `detail` absent
// or ≤ 1 returns the input array untouched (byte-identical renders).
// Endpoints must already be literal {x,y,z} (resolve slot paths first).

export const LATHE_DETAIL_FACE_BUDGET = 150_000;
export const LATHE_DETAIL_MAX = 4;

export function applyLatheDetail(lathes, detail) {
  const k = Number(detail);
  if (!Array.isArray(lathes) || lathes.length === 0) return lathes;
  if (!Number.isFinite(k) || k <= 1) return lathes;
  const dial = Math.min(k, LATHE_DETAIL_MAX);
  const sizes = lathes.map((s) => {
    const a = s?.axisFrom;
    const b = s?.axisTo;
    if (!isFiniteVec(a) || !isFiniteVec(b)) return 0;
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    let maxR = 0;
    if (Array.isArray(s.profile)) {
      for (const p of s.profile) if (Number.isFinite(p?.radius)) maxR = Math.max(maxR, p.radius);
    }
    return len * maxR;
  });
  const maxSize = Math.max(...sizes);
  if (!(maxSize > 0)) return lathes;
  // sqrt of the area share: mid-sized masses still benefit meaningfully,
  // beads stay near 1×.
  const muls = sizes.map((sz) => 1 + (dial - 1) * Math.sqrt(sz / maxSize));
  const baseCs = (s) => clampInt(s.crossSections, 2, 256, 24);
  const baseSm = (s) => clampInt(s.samples, 8, 1024, 36);
  const mulAt = (i, f) => 1 + (muls[i] - 1) * f;
  const estimate = (f) => lathes.reduce(
    (sum, s, i) => sum + Math.round(baseCs(s) * mulAt(i, f)) * Math.round(baseSm(s) * mulAt(i, f)),
    0,
  );
  let damp = 1;
  for (let iter = 0; iter < 8 && estimate(damp) > LATHE_DETAIL_FACE_BUDGET; iter += 1) {
    damp *= Math.sqrt(LATHE_DETAIL_FACE_BUDGET / estimate(damp));
  }
  return lathes.map((s, i) => {
    const m = mulAt(i, damp);
    if (m <= 1) return s;
    return {
      ...s,
      crossSections: Math.min(256, Math.round(baseCs(s) * m)),
      samples: Math.min(1024, Math.round(baseSm(s) * m)),
    };
  });
}

// ─── helpers ──────────────────────────────────────────────────────────

/**
 * Spherical-linear interpolation between two unit vectors. Falls back to
 * normalized lerp for nearly-parallel inputs. Exported so the vajra
 * primitive's sweep-extraction fallback shares one slerp convention.
 */
export function slerp3(a, b, t) {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(d);
  if (Math.abs(omega) < 1e-6) {
    return normalize3({
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
    });
  }
  const so = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / so;
  const w2 = Math.sin(t * omega) / so;
  return normalize3({
    x: w1 * a.x + w2 * b.x,
    y: w1 * a.y + w2 * b.y,
    z: w1 * a.z + w2 * b.z,
  });
}

function perpendicularBasis(normal) {
  // Same convention wave-manji's printer uses — Gram-Schmidt against a
  // reference vector with the handedness fallback for axis-aligned cases.
  const n = normal;
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
