/**
 * taiji — the chirality primitive. The structural DUAL of the vajra.
 *
 * Where the vajra is a mirror-symmetric BOND among three points (two
 * lightbulbs, screws facing, sampled as concentric golden rings), the
 * taiji is a rotation-symmetric, HANDED COUPLING of two opposites. Its
 * defining invariant is CHIRALITY: a signed `twist` of the dividing
 * surface along an axis. twist=0 is the achiral degenerate (a straight-
 * extruded glyph); twist>0 is right-handed about yin→yang; twist<0 is
 * left-handed. A mirror bond has nothing to twist — a chiral coupling is
 * nothing without it.
 *
 * Authored like the vajra's three points:
 *   yin    — pole A (endpoint path or {x,y,z}).
 *   yang   — pole B.
 *   center — hub / crossing (optional; defaults to midpoint(yin,yang);
 *            when off the yin–yang line it bends the axis into a quadratic
 *            Bézier, exactly as the vajra's center bends its spine).
 *
 * The 3D form is a spine walked yin→yang where every cross-section is the
 * taijitu glyph ROTATED by phi(t) = 2*pi*twist*t. Stacking those rotating
 * dividers is a helicoid; the two glyph "eyes" sweep into the two pole-
 * STRANDS (a double helix). The envelope is rotationally symmetric, so
 * chirality is invisible there and visible only in the partition, the
 * strands, and the lobe() selector. v1 emits POINT slots at -yin/-center/
 * -yang; strand-as-bindable-curve is a deliberate follow-up (mirrors how
 * the vajra deferred its field export).
 *
 * Design: lite-template/integration/0609/taiji-primitive.plan.md.
 * Dual reference: vajra.js.
 */

import { buildEndpointResolver } from './line-between.js';

const PROFILES = new Set(['spindle', 'capsule']);
// Matter fill modes for the wave→world print pass (see wave-to-world-paint).
// 'none' = the wireframe ring/strand read (default); 'silhouette' = the swept
// envelope as a filled ribbon; 'fibers' = silhouette + loaded longitudinal
// fibers that inherit the twist as pennation lean.
const MATTER_FILLS = new Set(['none', 'silhouette', 'fibers', 'brush']);

/**
 * Validate a list of taiji specs against a walker's emitted nodes.
 * Mirrors validateVajras: yin/yang are required (center optional); each
 * accepts an endpoint path or inline {x,y,z}; paths resolve here at mint
 * time so bad refs surface as 400s, not 500s at render.
 */
export function validateTaijis(taijis, emittedNodes) {
  const errors = [];
  if (!Array.isArray(taijis)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const checkPoint = (spec, key, i, required) => {
    const v = spec[key];
    if (v === undefined || v === null) {
      if (required) errors.push(`taijis[${i}].${key}: required (endpoint path or {x,y,z})`);
      return;
    }
    if (typeof v === 'string') {
      try {
        resolveEndpoint(v);
      } catch (err) {
        errors.push(`taijis[${i}].${key}: ${err.message}`);
      }
    } else if (!isFiniteVec(v)) {
      errors.push(`taijis[${i}].${key}: must be an endpoint path string or {x,y,z}`);
    }
  };
  taijis.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`taijis[${i}]: must be an object with yin/yang poles`);
      return;
    }
    checkPoint(spec, 'yin', i, true);
    checkPoint(spec, 'yang', i, true);
    checkPoint(spec, 'center', i, false);
    if (spec.twist !== undefined && !Number.isFinite(spec.twist)) {
      errors.push(`taijis[${i}].twist: must be a finite number (sign = chirality; 0 = achiral)`);
    }
    if (spec.radius !== undefined && (!Number.isFinite(spec.radius) || spec.radius <= 0)) {
      errors.push(`taijis[${i}].radius: must be a positive finite number when provided`);
    }
    if (spec.profile !== undefined && !PROFILES.has(spec.profile)) {
      errors.push(`taijis[${i}].profile: must be 'spindle' or 'capsule' when provided`);
    }
    if (spec.matter !== undefined && spec.matter !== null) {
      const m = spec.matter;
      if (typeof m !== 'object' || Array.isArray(m)) {
        errors.push(`taijis[${i}].matter: must be an object when provided`);
      } else if (m.fill !== undefined && !MATTER_FILLS.has(m.fill)) {
        errors.push(`taijis[${i}].matter.fill: must be one of ${Array.from(MATTER_FILLS).join(', ')}`);
      }
    }
    // Inline poles must differ — a zero-length axis has no spin direction.
    if (isFiniteVec(spec.yin) && isFiniteVec(spec.yang) && sameVec(spec.yin, spec.yang)) {
      errors.push(`taijis[${i}]: yin and yang must differ (zero-length axis)`);
    }
  });
  return errors;
}

const DEFAULTS = { radius: 1, twist: 0.5, profile: 'spindle' };

/**
 * Normalize a spec whose yin/yang/center are already resolved to 3D points
 * into the internal shape sampleTaiji consumes.
 */
export function resolveTaijiSpec(spec) {
  const yin = spec.yin;
  const yang = spec.yang;
  const center = isFiniteVec(spec.center) ? spec.center : midpoint(yin, yang);
  return {
    yin,
    yang,
    center,
    radius: Number.isFinite(spec.radius) && spec.radius > 0 ? spec.radius : DEFAULTS.radius,
    twist: Number.isFinite(spec.twist) ? spec.twist : DEFAULTS.twist,
    profile: PROFILES.has(spec.profile) ? spec.profile : DEFAULTS.profile,
    crossSections: clampInt(spec.crossSections, 2, 256, 24),
    samples: clampInt(spec.samples, 8, 1024, 48),
    showEnvelope: spec.showEnvelope === true,
    style: spec.style,
  };
}

/**
 * The axial radius envelope R(t).
 *   spindle — radius*sin(pi*t): teardrop tips at both poles (default).
 *   capsule — constant radius (flat-capped at the poles for v1).
 */
function radiusAt(resolved, t) {
  if (resolved.profile === 'capsule') return resolved.radius;
  return resolved.radius * Math.sin(Math.PI * t);
}

/**
 * Build the taiji's signed volume field + a lobe selector, mirroring
 * makeVajraField. `field(p)` is the signed distance to the solid envelope
 * (negative inside). `field.lobe(p)` returns +1 (yang) / -1 (yin) — the
 * only place chirality is legible in the field, via the per-t un-rotation.
 *
 * v1 uses the STRAIGHT yin→yang axis for the field (a bent center still
 * bends the visual rings/strands); a bent-axis field is a follow-up,
 * mirroring how the vajra's field is piecewise-straight while its spine is
 * Bézier.
 */
export function makeTaijiField(resolved) {
  const { yin, yang, radius, twist, profile } = resolved;
  const axis = sub3(yang, yin);
  const L = Math.max(length3(axis), 1e-9);
  const dir = scale3(axis, 1 / L);
  const [uHat, vHat] = perpendicularBasis(dir);

  const field = function field(p) {
    const tRaw = dot3(sub3(p, yin), dir) / L;
    if (tRaw <= 0) return length3(sub3(p, yin)) - radiusAt(resolved, 0);
    if (tRaw >= 1) return length3(sub3(p, yang)) - radiusAt(resolved, 1);
    const axisPoint = add3(yin, scale3(dir, tRaw * L));
    const perp = length3(sub3(p, axisPoint));
    if (profile === 'capsule') return perp - radius;
    return perp - radiusAt(resolved, tRaw);
  };

  field.lobe = function lobe(p) {
    const t = clamp(dot3(sub3(p, yin), dir) / L, 0, 1);
    const axisPoint = add3(yin, scale3(dir, t * L));
    const w = sub3(p, axisPoint);
    const wu = dot3(w, uHat);
    const wv = dot3(w, vHat);
    const phi = 2 * Math.PI * twist * t;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    // Express w in the rotated (u',v') frame, then run the 2D selector.
    const u0 = wu * cos + wv * sin;
    const v0 = -wu * sin + wv * cos;
    return taijituLobe(u0, v0, radiusAt(resolved, t) || radius);
  };

  return field;
}

/**
 * Sample a taiji. yin/yang/center must already be resolved to 3D points
 * (the caller pre-resolves endpoint paths, like sampleVajra). Returns:
 *
 *   {
 *     rings:    [{ t, center, normal, polyline }],   // rotating-S partition stack (the helicoid)
 *     strands:  { yin: Point3D[], yang: Point3D[] }, // the two pole-strands (the double helix)
 *     envelope: [{ t, center, normal, polyline }] | null,  // outer circles when showEnvelope
 *     poleSlots:{ yin, center, yang },               // authored points, re-emitted as slots
 *     field,                                          // signed distance + .lobe()
 *   }
 */
export function sampleTaiji(spec) {
  const resolved = resolveTaijiSpec(spec);
  for (const key of ['yin', 'yang', 'center']) {
    if (!isFiniteVec(resolved[key])) {
      throw new Error(`sampleTaiji: spec.${key} must be {x,y,z} (resolve endpoint paths first)`);
    }
  }
  const { yin, yang, center, twist, crossSections, samples } = resolved;

  // One constant perpendicular basis from the chord direction keeps the
  // twist coherent (a per-point basis would flip and corrupt handedness).
  // The axis position follows a quadratic Bézier through `center`, which
  // degenerates to a straight line when center == midpoint(yin, yang).
  const chord = sub3(yang, yin);
  const dir = normalize3(chord);
  const [uHat, vHat] = perpendicularBasis(dir);

  const divider2D = taijituDivider(samples);
  const rings = [];
  const envelope = resolved.showEnvelope ? [] : null;
  const strandYin = [];
  const strandYang = [];

  for (let i = 0; i <= crossSections; i += 1) {
    const t = i / crossSections;
    const c = bezier3(yin, center, yang, t);
    const tangent = bezierTangent(yin, center, yang, t);
    const R = radiusAt(resolved, t);
    const phi = 2 * Math.PI * twist * t;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    // Rotated in-plane basis (u', v').
    const uP = add3(scale3(uHat, cos), scale3(vHat, sin));
    const vP = add3(scale3(uHat, -sin), scale3(vHat, cos));

    // Partition divider (the S), scaled to R and lifted to 3D.
    const poly = divider2D.map(([du, dv]) =>
      add3(c, add3(scale3(uP, du * R), scale3(vP, dv * R))));
    rings.push({ t, center: c, normal: tangent, polyline: poly });

    // The two eyes (small-arc centers at v' = ±R/2) sweep the pole-strands.
    strandYang.push(add3(c, scale3(vP, R / 2)));
    strandYin.push(add3(c, scale3(vP, -R / 2)));

    if (envelope) {
      const circle = new Array(samples + 1);
      for (let j = 0; j <= samples; j += 1) {
        const theta = (j / samples) * 2 * Math.PI;
        circle[j] = add3(c, add3(scale3(uHat, R * Math.cos(theta)), scale3(vHat, R * Math.sin(theta))));
      }
      envelope.push({ t, center: c, normal: tangent, polyline: circle });
    }
  }

  return {
    rings,
    strands: { yin: strandYin, yang: strandYang },
    envelope,
    poleSlots: { yin, center, yang },
    field: makeTaijiField(resolved),
  };
}

/**
 * The rBrush "load" matter, in the taiji's own 3D frame: longitudinal fibers
 * from yin (t=0) to yang (t=1) that bulge to the envelope R(t) and rotate by
 * phi(t) = 2*pi*twist*t, so each fiber inherits the strand's helical lean
 * (pennation) for free. Pure 3D geometry (no projection) — the print pass
 * projects them. Deterministic via an index-seeded PRNG. Returns an array of
 * Point3D polylines. See lite-template/integration/0609/wave-to-world-paint.plan.md.
 */
export function taijiFibers(spec, opts = {}) {
  const {
    count = 10, shells = 1, alignment = 0.85, wobble = 0.2,
    crossSections = 20, seed = 7, fillFrac = 0.92,
  } = opts;
  const yin = spec.yin;
  const yang = spec.yang;
  const center = isFiniteVec(spec.center) ? spec.center : midpoint(yin, yang);
  const dir = normalize3(sub3(yang, yin));
  const [uHat, vHat] = perpendicularBasis(dir);
  const rand = mulberry32((Number(seed) || 7) >>> 0);
  const twist = Number.isFinite(spec.twist) ? spec.twist : 0.5;
  const radius = Number.isFinite(spec.radius) && spec.radius > 0 ? spec.radius : 1;
  const profile = spec.profile === 'capsule' ? 'capsule' : 'spindle';
  const n = Math.max(1, Math.floor(count));
  const sh = Math.max(1, Math.floor(shells));
  const fibers = [];
  for (let s = 0; s < sh; s += 1) {
    const rFrac = (sh === 1 ? 1 : 0.4 + 0.55 * (s / (sh - 1))) * fillFrac;
    for (let k = 0; k < n; k += 1) {
      const theta0 = (2 * Math.PI * k) / n + (rand() - 0.5) * 0.1;
      const phase = rand() * Math.PI * 2;
      const poly = [];
      for (let i = 0; i <= crossSections; i += 1) {
        const t = i / crossSections;
        const c = bezier3(yin, center, yang, t);
        const phi = 2 * Math.PI * twist * t;
        const wob = Math.sin(t * Math.PI * 2 + phase) * 0.5 + Math.sin(t * Math.PI * 6 + phase) * 0.2;
        const theta = theta0 + phi
          + (1 - alignment) * 1.3 * Math.sin(t * Math.PI + phase)
          + wob * wobble * (1 - alignment) * 3;
        const R = (profile === 'capsule' ? radius : radius * Math.sin(Math.PI * t)) * rFrac;
        poly.push(add3(c, add3(scale3(uHat, R * Math.cos(theta)), scale3(vHat, R * Math.sin(theta)))));
      }
      fibers.push(poly);
    }
  }
  return fibers;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── The 2D taijitu divider + lobe selector ────────────────────────────

/**
 * The canonical taijitu dividing curve as a unit-radius (R=1) polyline in
 * local (u, v) coordinates, from the +v pole through the S to the −v pole:
 * the disc diameter replaced by two half-circles of radius 1/2 centered at
 * ±1/2 along v. Upper half-circle bulges −u, lower bulges +u. Callers scale
 * by R(t). Returns [[u, v], ...].
 */
export function taijituDivider(samples) {
  const half = Math.max(2, Math.floor(samples / 2));
  const pts = [];
  // Upper-left semicircle: center (0, 1/2), angle pi/2 → 3pi/2.
  for (let i = 0; i <= half; i += 1) {
    const a = Math.PI / 2 + (i / half) * Math.PI;
    pts.push([Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
  }
  // Lower-right semicircle: center (0, -1/2), angle pi/2 → -pi/2 (skip dup start).
  for (let i = 1; i <= half; i += 1) {
    const a = Math.PI / 2 - (i / half) * Math.PI;
    pts.push([Math.cos(a) * 0.5, -0.5 + Math.sin(a) * 0.5]);
  }
  return pts;
}

/**
 * Which lobe a local in-plane point (already un-rotated) falls in:
 * +1 yang, -1 yin. The two small discs (radius R/2 at v = ±R/2) are the
 * eye-bulbs; outside them the split is by u sign. The yin/yang boundary
 * this induces is exactly the taijitu S.
 */
export function taijituLobe(u, v, R) {
  const r = R / 2;
  if (u * u + (v - r) * (v - r) <= r * r) return +1; // upper disc → yang
  if (u * u + (v + r) * (v + r) <= r * r) return -1; // lower disc → yin
  return u >= 0 ? +1 : -1;
}

// ─── spine (quadratic Bézier through the center guideline) ──────────────

function bezier3(p0, p1, p2, t) {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const c = t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x,
    y: a * p0.y + b * p1.y + c * p2.y,
    z: a * p0.z + b * p1.z + c * p2.z,
  };
}

function bezierTangent(p0, p1, p2, t) {
  // d/dt of the quadratic Bézier: 2(1-t)(p1-p0) + 2t(p2-p1).
  const mt = 1 - t;
  const d = {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
    z: 2 * mt * (p1.z - p0.z) + 2 * t * (p2.z - p1.z),
  };
  return normalize3(d);
}

// ─── vector helpers ────────────────────────────────────────────────────

function perpendicularBasis(normal) {
  const n = normal;
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

function sub3(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale3(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function length3(v) { return Math.hypot(v.x, v.y, v.z); }
function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }
function sameVec(a, b) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.z - b.z) < 1e-9;
}
function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
