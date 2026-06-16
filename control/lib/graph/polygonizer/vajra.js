/**
 * vajra — the 3-point relational volume primitive.
 *
 * A vajra binds THREE points — `o-o-o`: a small center hub (the screw
 * junction) and two larger outer spheres. The form is two sideways
 * lightbulbs with their screw ends facing each other: each prong is a
 * fat outer sphere (the BULB) smooth-unioned with a thin constant-radius
 * neck (the SCREW) running inward to the center. The two necks meet at
 * the hub. The bond is the iso-surface of that relational volume field.
 *
 *   bulb radius   = the OUTER bead radius (the wide mass lives there).
 *   neck radius   = the CENTER bead radius (the thin screw / pinch).
 *   blend         = polynomial smooth-min width — rounds the concave
 *                   bulb↔neck shoulder. blend → 0 is a sharp shoulder;
 *                   higher blend rounds it (more balloon-like).
 *
 * The primitive's canonical output lives in WAVE-SPACE: a stack of
 * "golden rings" — iso-surface cross-sections sampled along a quadratic
 * Bézier spine through the center. It paints nothing in world-space by
 * itself; downstream passes drape a skin on the volume or wind another
 * wave around it (reading the exported field).
 *
 * Design: lite-template/integration/0608/vajra-primitive.plan.md.
 * Supersedes the conical figure-central-axis-rings spike.
 */

import { buildEndpointResolver } from './line-between.js';
import { sampleLathe, slerp3 } from './lathe.js';

const BEAD_KEYS = ['proximal', 'center', 'distal'];

/**
 * Validate a list of vajra specs against a walker's emitted nodes.
 * Mirrors validateLathes: the three bond points (proximal/center/distal)
 * accept endpoint paths or inline {x,y,z}; paths resolve here at mint
 * time so bad refs surface as 400s, not 500s at render.
 */
export function validateVajras(vajras, emittedNodes) {
  const errors = [];
  if (!Array.isArray(vajras)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  vajras.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`vajras[${i}]: must be an object with proximal/center/distal points`);
      return;
    }
    for (const key of BEAD_KEYS) {
      const v = spec[key];
      if (v === undefined || v === null) {
        errors.push(`vajras[${i}].${key}: required (endpoint path or {x,y,z})`);
        continue;
      }
      if (typeof v === 'string') {
        try {
          resolveEndpoint(v);
        } catch (err) {
          errors.push(`vajras[${i}].${key}: ${err.message}`);
        }
      } else if (!isFiniteVec(v)) {
        errors.push(`vajras[${i}].${key}: must be an endpoint path string or {x,y,z}`);
      }
    }
    const beads = spec.beads;
    if (beads !== undefined) {
      if (typeof beads !== 'object' || beads === null) {
        errors.push(`vajras[${i}].beads: must be an object of { proximal, center, distal } radii`);
      } else {
        for (const key of BEAD_KEYS) {
          const b = beads[key];
          if (b === undefined) continue;
          if (typeof b !== 'object' || b === null || !Number.isFinite(b.radius) || b.radius <= 0) {
            errors.push(`vajras[${i}].beads.${key}.radius: must be a positive finite number when provided`);
          }
        }
      }
    }
    if (spec.blend !== undefined && (!Number.isFinite(spec.blend) || spec.blend < 0)) {
      errors.push(`vajras[${i}].blend: must be a non-negative finite number (0 = tangent cone)`);
    }
    if (spec.isoOffset !== undefined && !Number.isFinite(spec.isoOffset)) {
      errors.push(`vajras[${i}].isoOffset: must be a finite number when provided`);
    }
    if (spec.extraction !== undefined && spec.extraction !== 'field' && spec.extraction !== 'sweep') {
      errors.push(`vajras[${i}].extraction: must be 'field' or 'sweep' when provided`);
    }
    // Points must be mutually distinct once resolved — coincident points
    // collapse a prong's axis. Only checkable here for inline points.
    const inline = {};
    for (const key of BEAD_KEYS) {
      if (isFiniteVec(spec[key])) inline[key] = spec[key];
    }
    if (inline.proximal && inline.center && sameVec(inline.proximal, inline.center)) {
      errors.push(`vajras[${i}]: proximal and center must differ (zero-length prong)`);
    }
    if (inline.center && inline.distal && sameVec(inline.center, inline.distal)) {
      errors.push(`vajras[${i}]: center and distal must differ (zero-length prong)`);
    }
  });
  return errors;
}

const DEFAULT_RADII = { proximal: 1, center: 0.5, distal: 1 };

/**
 * Normalize a spec whose proximal/center/distal are already resolved to
 * 3D points into the internal shape sampleVajra consumes.
 */
export function resolveVajraSpec(spec) {
  const beads = spec.beads || {};
  const radius = (key) => {
    const b = beads[key];
    return b && Number.isFinite(b.radius) ? b.radius : DEFAULT_RADII[key];
  };
  return {
    proximal: spec.proximal,
    center: spec.center,
    distal: spec.distal,
    radii: {
      proximal: radius('proximal'),
      center: radius('center'),
      distal: radius('distal'),
    },
    blend: Number.isFinite(spec.blend) ? spec.blend : 0,
    isoOffset: Number.isFinite(spec.isoOffset) ? spec.isoOffset : 0,
    extraction: spec.extraction === 'sweep' ? 'sweep' : 'field',
    crossSections: clampInt(spec.crossSections, 2, 256, 24),
    samples: clampInt(spec.samples, 8, 1024, 36),
    style: spec.style,
  };
}

/**
 * Build the vajra's signed volume field. Returns a closure f(p) that is
 * negative inside the bond, ~0 on the surface, positive outside. The
 * exposed field (item 3 of the consumption interface) is this closure;
 * downstream waves/drapes evaluate it directly.
 */
export function makeVajraField(resolved) {
  const { proximal, center, distal, radii, blend, isoOffset } = resolved;
  const k = Math.max(0, blend);
  const rNeck = radii.center;
  return function field(p) {
    // Each prong is a lightbulb: a fat outer sphere (bulb) smooth-unioned
    // with a thin constant-radius neck (screw) reaching to the center.
    // The two necks share the center, so the screw ends meet there.
    const proxBulb = length3(sub3(p, proximal)) - radii.proximal;
    const distBulb = length3(sub3(p, distal)) - radii.distal;
    const proxNeck = sdRoundCone(p, center, proximal, rNeck, rNeck);
    const distNeck = sdRoundCone(p, center, distal, rNeck, rNeck);
    let d = smin(proxBulb, proxNeck, k);
    d = smin(d, distBulb, k);
    d = smin(d, distNeck, k);
    return d - isoOffset;
  };
}

/**
 * Sample a vajra. The spec's proximal/center/distal must already be
 * resolved to 3D points (the caller pre-resolves endpoint paths, like
 * sampleLathe). Returns:
 *
 *   {
 *     rings: [{ t, center: {x,y,z}, normal: {x,y,z}, polyline: Point3D[] }],
 *     beadSlots: { proximal, center, distal } world points,
 *     field: (p) => signed distance,
 *   }
 *
 * `rings` is the golden-ring stack — the wave-space face. Each polyline
 * is a closed cross-section of the iso-surface, perpendicular to the
 * spine tangent.
 */
export function sampleVajra(spec) {
  const resolved = resolveVajraSpec(spec);
  for (const key of BEAD_KEYS) {
    if (!isFiniteVec(resolved[key])) {
      throw new Error(`sampleVajra: spec.${key} must be {x,y,z} (resolve endpoint paths first)`);
    }
  }
  const field = makeVajraField(resolved);
  const beadSlots = {
    proximal: resolved.proximal,
    center: resolved.center,
    distal: resolved.distal,
  };

  const rings = resolved.extraction === 'sweep'
    ? sweepRings(resolved)
    : marchRings(resolved, field);

  return { rings, beadSlots, field };
}

// ─── Field-march extraction (the primary path) ─────────────────────────

function marchRings(resolved, field) {
  const { radii, blend, samples } = resolved;
  const maxR = Math.max(radii.proximal, radii.center, radii.distal);
  // The iso-surface radius can't exceed the largest bead plus the blend
  // widening; double it for a safe march bound.
  const bound = 2 * maxR + blend + 1e-6;
  const spine = buildSpine(resolved);
  const rings = [];
  for (let i = 0; i < spine.length; i += 1) {
    const { center: c, tangent } = spine[i];
    const [uHat, vHat] = perpendicularBasis(tangent);
    const poly = new Array(samples + 1);
    for (let j = 0; j <= samples; j += 1) {
      const theta = (j / samples) * 2 * Math.PI;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const dir = {
        x: cosT * uHat.x + sinT * vHat.x,
        y: cosT * uHat.y + sinT * vHat.y,
        z: cosT * uHat.z + sinT * vHat.z,
      };
      const r = marchRadius(field, c, dir, bound);
      poly[j] = { x: c.x + r * dir.x, y: c.y + r * dir.y, z: c.z + r * dir.z };
    }
    rings.push({ t: i / (spine.length - 1), center: c, normal: tangent, polyline: poly });
  }
  return rings;
}

/**
 * The ring-extraction spine. Runs from the proximal bulb's outer pole,
 * through the proximal bead center, along a quadratic Bézier through the
 * hub, to the distal bead center, and out to the distal bulb's pole — so
 * the golden-ring stack wraps the full lightbulb forms (rounded outer
 * caps included), not just the centers-to-center mass. Tangents are
 * central differences, so orientation stays continuous across the joins.
 */
function buildSpine(resolved) {
  const { proximal: prox, center: ctr, distal: dist, radii, crossSections } = resolved;
  const outP = normalize3(sub3(prox, ctr));
  const outD = normalize3(sub3(dist, ctr));
  const poleP = { x: prox.x + radii.proximal * outP.x, y: prox.y + radii.proximal * outP.y, z: prox.z + radii.proximal * outP.z };
  const poleD = { x: dist.x + radii.distal * outD.x, y: dist.y + radii.distal * outD.y, z: dist.z + radii.distal * outD.z };
  const nCap = Math.max(3, Math.round(crossSections * 0.22));
  const nMid = Math.max(4, crossSections - 2 * nCap);
  const pts = [];
  for (let i = 0; i <= nCap; i += 1) pts.push(lerp3(poleP, prox, i / nCap));
  for (let i = 1; i <= nMid; i += 1) pts.push(bezier3(prox, ctr, dist, i / nMid));
  for (let i = 1; i <= nCap; i += 1) pts.push(lerp3(dist, poleD, i / nCap));
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    out.push({ center: pts[i], tangent: normalize3(sub3(b, a)) });
  }
  return out;
}

/**
 * Ray-march from `origin` along unit `dir` to the first f=0 crossing,
 * then bisect to refine. `origin` is expected to be inside (f<0); if it
 * isn't (a pinched spine point), the surface is at/behind the origin and
 * radius 0 is returned. Misses (no crossing within `bound`) clamp to the
 * bound rather than producing a runaway vertex.
 */
function marchRadius(field, origin, dir, bound, coarse = 96, refine = 24) {
  const at = (s) => field({ x: origin.x + s * dir.x, y: origin.y + s * dir.y, z: origin.z + s * dir.z });
  const startVal = at(0);
  if (startVal >= 0) return 0;
  const ds = bound / coarse;
  let prev = 0;
  for (let i = 1; i <= coarse; i += 1) {
    const s = i * ds;
    if (at(s) >= 0) {
      let lo = prev;
      let hi = s;
      for (let r = 0; r < refine; r += 1) {
        const mid = 0.5 * (lo + hi);
        if (at(mid) >= 0) hi = mid;
        else lo = mid;
      }
      return 0.5 * (lo + hi);
    }
    prev = s;
  }
  return bound;
}

// ─── Sweep extraction (the cheap bendable-lathe fallback) ──────────────
// Approximates the field iso-surface as two bendable round-cone lathes
// plus three sphere lathes. Used when extraction:'sweep' is requested.

function sweepRings(resolved) {
  const { proximal, center, distal, radii, crossSections, samples } = resolved;
  const half = Math.max(2, Math.floor(crossSections / 2));
  const out = [];

  const proxDir = normalize3(sub3(proximal, center));
  const distDir = normalize3(sub3(distal, center));

  const coneSpecs = [
    {
      axisFrom: center, axisTo: proximal,
      profile: [
        { t: 0, radius: radii.center },
        { t: 0.5, radius: Math.max(radii.proximal, radii.center) * 1.15 },
        { t: 1, radius: radii.proximal },
      ],
      normalFrom: slerp3(proxDir, distDir, 0.5),
      normalTo: proxDir,
    },
    {
      axisFrom: center, axisTo: distal,
      profile: [
        { t: 0, radius: radii.center },
        { t: 0.5, radius: Math.max(radii.distal, radii.center) * 1.15 },
        { t: 1, radius: radii.distal },
      ],
      normalFrom: slerp3(proxDir, distDir, 0.5),
      normalTo: distDir,
    },
  ];

  for (const cone of coneSpecs) {
    const { polylines } = sampleLathe({ ...cone, crossSections: half, samples });
    polylines.forEach((poly, i) => {
      const t = i / (polylines.length - 1);
      out.push({ t, center: lerp3(cone.axisFrom, cone.axisTo, t), normal: null, polyline: poly });
    });
  }

  // Sphere caps as short lathes through each bead.
  for (const key of BEAD_KEYS) {
    const pos = resolved[key];
    const R = radii[key];
    const axis = key === 'center' ? slerp3(proxDir, distDir, 0.5) : (key === 'proximal' ? proxDir : distDir);
    const from = { x: pos.x + R * axis.x, y: pos.y + R * axis.y, z: pos.z + R * axis.z };
    const to = { x: pos.x - R * axis.x, y: pos.y - R * axis.y, z: pos.z - R * axis.z };
    const profile = sphereProfile(R, 12);
    const { polylines } = sampleLathe({ axisFrom: from, axisTo: to, profile, crossSections: 12, samples });
    polylines.forEach((poly, i) => {
      out.push({ t: i / (polylines.length - 1), center: lerp3(from, to, i / (polylines.length - 1)), normal: null, polyline: poly });
    });
  }
  return out;
}

function sphereProfile(maxRadius, segments) {
  const profile = new Array(segments + 1);
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    profile[i] = { t, radius: maxRadius * Math.sin(Math.PI * t) };
  }
  return profile;
}

// ─── Signed-distance primitives ────────────────────────────────────────

/**
 * Exact signed distance to a round cone — the convex hull of two spheres
 * (centers a/b, radii r1/r2). Its lateral silhouette is the external
 * tangent line between the spheres; the caps are spherical. This is the
 * "tangent-line wrap" the vajra prong is built from. Adapted from Inigo
 * Quilez's analytic round-cone SDF.
 */
export function sdRoundCone(p, a, b, r1, r2) {
  const ba = sub3(b, a);
  const l2 = dot3(ba, ba);
  if (l2 < 1e-12) {
    // Degenerate prong (coincident centers): fall back to nearer sphere.
    return Math.min(length3(sub3(p, a)) - r1, length3(sub3(p, b)) - r2);
  }
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  if (a2 <= 1e-12) {
    // One sphere contains the other: the hull is the larger sphere.
    return Math.min(length3(sub3(p, a)) - r1, length3(sub3(p, b)) - r2);
  }
  const il2 = 1 / l2;
  const pa = sub3(p, a);
  const y = dot3(pa, ba);
  const z = y - l2;
  const xv = { x: pa.x * l2 - ba.x * y, y: pa.y * l2 - ba.y * y, z: pa.z * l2 - ba.z * y };
  const x2 = dot3(xv, xv);
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/**
 * Polynomial smooth-min (quadratic, C1). k is the blend width in world
 * units; k<=0 degrades to a hard min so blend:0 is the exact union of the
 * two prongs (the tangent-cone vajra).
 */
export function smin(a, b, k) {
  if (k <= 1e-9) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// ─── Spine (quadratic Bézier through the center guideline) ─────────────

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

// ─── vector helpers ────────────────────────────────────────────────────

function perpendicularBasis(normal) {
  const n = normal;
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

function sub3(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function length3(v) { return Math.hypot(v.x, v.y, v.z); }
function lerp3(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: a.z + t * (b.z - a.z) };
}
function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function sameVec(a, b) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.z - b.z) < 1e-9;
}
function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
