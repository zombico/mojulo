/**
 * alignment — a road's centreline in METRES (1 u = 1 m, z-up), the way a highway designer states
 * it: a HORIZONTAL alignment of tangents, clothoid spirals and circular arcs; a VERTICAL profile of
 * grades joined by parabolic vertical curves sized by K; and SUPERELEVATION that follows curvature
 * (so it runs in and out along each spiral, where curvature itself changes linearly).
 *
 * The horizontal alignment is integrated ONCE into a dense 1 m table (heading, curvature, x, y);
 * `at(s)` interpolates it. Deterministic by construction: no dice, fixed-step integration, so the
 * same spec gives byte-identical stations on every read (the kernel's compatibility promise).
 *
 * Spec:
 *   { start: [x, y], heading (rad, 0 = +x), elements: [
 *       { type: 'tangent', length },
 *       { type: 'spiral', length, k0, k1 },          // curvature k0 → k1 (1/m, + = left)
 *       { type: 'arc', length, radius, dir: 'left'|'right' } ],
 *     profile: { z0, pvis: [{ s, z, K? }],            // PVIs after the start; K sizes each curve
 *                features?: [ramp] },                 // ramps laid over the grades (ramps.js), their own segments
 *     emax, designSpeed (km/h), rmin?,                // rmin: a design class's own (classes.js), over the table
 *     closed?, crestK?, sagK? }                       // closed: a lap (PI form, course.js); K: the class's defaults
 *
 * CLOSED: the alignment is a lap. Its stations wrap (`at(s)` takes s modulo the length), its profile comes back to z0
 * with a vertical curve across the seam, and the integrated end is snapped onto the start: the residual (what the
 * spiral approximations leave, centimetres) is spread linearly along the lap and reported as `closure`.
 */

const STEP = 1;            // table spacing (m)
const SUB = 8;             // integration sub-steps per table step (midpoint rule on heading)
const SUB_LAP = 64;        // a lap's: its end must meet its start, so corners' boundary errors must not add up

/** TAC minimum radius at e = 0.06 (BC TAC 2019 supplement, ch. 300) — the design floor per speed. */
export const R_MIN_AT_EMAX = { 80: 250, 90: 340, 100: 440, 110: 600, 120: 750 };

/** Superelevation for radius R under the AASHTO method-5 parabola: e = emax·(2r − r²), r = Rmin/R. */
export function superelevationFor(R, { emax = 0.06, designSpeed = 120, rmin: own = null } = {}) {
  if (!Number.isFinite(R) || R <= 0) return 0;
  const rmin = own ?? (R_MIN_AT_EMAX[designSpeed] || R_MIN_AT_EMAX[120]);
  const r = Math.min(1, rmin / R);
  return emax * (2 * r - r * r);
}

/** A curve as the three elements a designer draws: spiral in, arc, spiral out. */
export function curve({ radius, deflection, dir = 'left', spiral = null }) {
  const k = (dir === 'right' ? -1 : 1) / radius;
  const Ls = spiral ?? Math.max(60, Math.round(radius / 6));
  const arcAngle = Math.abs(deflection) - Ls / radius;           // each spiral turns Ls / 2R
  if (arcAngle <= 0) throw new Error(`curve: deflection ${deflection} too small for spirals of ${Ls} m at R ${radius}`);
  return [
    { type: 'spiral', length: Ls, k0: 0, k1: k },
    { type: 'arc', length: arcAngle * radius, radius, dir },
    { type: 'spiral', length: Ls, k0: k, k1: 0 },
  ];
}

function elementCurvature(el, u) {
  if (el.type === 'arc') return (el.dir === 'right' ? -1 : 1) / el.radius;
  if (el.type === 'spiral') return el.k0 + (el.k1 - el.k0) * (u / el.length);
  return 0;
}

/** Vertical profile → z(s), grade(s). Grades between PVIs, a parabola of length K·A (A in %). */
function buildProfile(profile = {}, length, { closed = false, crestK = 95, sagK = 63 } = {}) {
  const z0 = profile.z0 ?? 0;
  const pts = [{ s: 0, z: z0 }, ...(profile.pvis || []).filter((p) => p.s > 0 && p.s < length), { s: length, z: closed ? z0 : null }];
  const g = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i + 1].z == null) pts[i + 1].z = pts[i].z + (g[i - 1] ?? 0) * (pts[i + 1].s - pts[i].s);
    g.push((pts[i + 1].z - pts[i].z) / (pts[i + 1].s - pts[i].s));
  }
  const curves = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const A = (g[i] - g[i - 1]) * 100;
    const K = pts[i].K ?? (A < 0 ? crestK : sagK);                  // crest / sag (AASHTO 120 km/h, or the class's)
    const L = Math.abs(A) * K;
    if (L > 0) curves.push({ s0: pts[i].s - L / 2, s1: pts[i].s + L / 2, g1: g[i - 1], g2: g[i], pvi: pts[i], L, K, A });
  }
  // a lap's seam: the last grade meets the first at the start, a curve centred on s = 0 (s0 < 0: read at s − length)
  if (closed && g.length) {
    const g1 = g[g.length - 1], g2 = g[0], A = (g2 - g1) * 100, seam = profile.seamK ?? (A < 0 ? crestK : sagK), L = Math.abs(A) * seam;
    if (L > 0) curves.push({ s0: -L / 2, s1: L / 2, g1, g2, pvi: pts[0], L, K: seam, A, seam: true });
  }
  const features = profile.features || [];
  const lift = (s) => { let dz = 0; for (const f of features) if (s >= f.s0 && s <= f.s1) dz += f.dz(s); return dz; };
  const tilt = (s) => { let dg = 0; for (const f of features) if (s >= f.s0 && s <= f.s1) dg += f.dg(s); return dg; };
  // the curve over s (a seam curve is read either side of the start)
  const curveAt = (s) => {
    for (const c of curves) {
      if (s > c.s0 && s < c.s1) return [c, s];
      if (c.seam && s - length > c.s0 && s - length < c.s1) return [c, s - length];
    }
    return null;
  };
  const tangentZ = (s) => {
    let i = 0;
    while (i < pts.length - 2 && s > pts[i + 1].s) i++;
    return pts[i].z + g[i] * (s - pts[i].s);
  };
  const tangentG = (s) => {
    let i = 0;
    while (i < pts.length - 2 && s > pts[i + 1].s) i++;
    return g[i];
  };
  if (!closed && !features.length) return {
    curves,
    z(s) {
      for (const c of curves) if (s > c.s0 && s < c.s1) {
        const x = s - c.s0, zs = c.pvi.z - c.g1 * c.L / 2;
        return zs + c.g1 * x + (c.g2 - c.g1) * x * x / (2 * c.L);
      }
      return tangentZ(s);
    },
    grade(s) {
      for (const c of curves) if (s > c.s0 && s < c.s1) return c.g1 + (c.g2 - c.g1) * (s - c.s0) / c.L;
      return tangentG(s);
    },
  };
  // a lap's or a ramped road's: the base (seam curves read across the start) and the ramps over it
  return {
    curves, features,
    base(s) {
      const hit = curveAt(s);
      if (hit) { const [c, u] = hit, x = u - c.s0, zs = c.pvi.z - c.g1 * c.L / 2; return zs + c.g1 * x + (c.g2 - c.g1) * x * x / (2 * c.L); }
      return tangentZ(s);
    },
    z(s) { return this.base(s) + lift(s); },
    grade(s) {
      const hit = curveAt(s);
      return (hit ? hit[0].g1 + (hit[0].g2 - hit[0].g1) * (hit[1] - hit[0].s0) / hit[0].L : tangentG(s)) + tilt(s);
    },
  };
}

/**
 * buildAlignment(spec) → { length, at(s), stations(step), elements, profile }
 * `at(s)` → { s, x, y, heading, k, z, grade, e } with e the signed superelevation magnitude
 * (≥ 0; which way it tilts is the cross-section's business — it knows the travel direction).
 */
export function buildAlignment(spec = {}) {
  const elements = spec.elements || [{ type: 'tangent', length: 1000 }];
  const length = elements.reduce((a, e) => a + e.length, 0);
  const n = Math.ceil(length / STEP) + 1;
  const X = new Float64Array(n), Y = new Float64Array(n), H = new Float64Array(n), Kc = new Float64Array(n);
  let x = spec.start?.[0] ?? 0, y = spec.start?.[1] ?? 0, h = spec.heading ?? 0;
  let ei = 0, eStart = 0;
  const kAt = (s) => {
    while (ei < elements.length - 1 && s >= eStart + elements[ei].length) { eStart += elements[ei].length; ei++; }
    return elementCurvature(elements[ei], Math.min(elements[ei].length, s - eStart));
  };
  X[0] = x; Y[0] = y; H[0] = h; Kc[0] = kAt(0);
  const sub = spec.sub ?? (spec.closed === true ? SUB_LAP : SUB), ds = STEP / sub;
  for (let i = 1; i < n; i++) {
    const s0 = (i - 1) * STEP;
    for (let j = 0; j < sub; j++) {
      const sm = s0 + (j + 0.5) * ds;
      const hm = h + kAt(sm) * ds / 2;
      x += Math.cos(hm) * ds; y += Math.sin(hm) * ds;
      h += kAt(sm) * ds;
    }
    X[i] = x; Y[i] = y; H[i] = h; Kc[i] = kAt(Math.min(length, i * STEP));
  }
  const closed = spec.closed === true;
  let closure = null;
  if (closed) {
    // the end onto the start: the residual spread along the lap (the end's table row sits at or past the length)
    const f = length / STEP, i = Math.min(n - 2, Math.floor(f)), t = f - i;
    const ex = X[i] + (X[i + 1] - X[i]) * t, ey = Y[i] + (Y[i + 1] - Y[i]) * t, eh = H[i] + (H[i + 1] - H[i]) * t;
    const dx = ex - X[0], dy = ey - Y[0], turns = Math.round((eh - H[0]) / (2 * Math.PI)) || 0;
    closure = { dx, dy, residual: Math.hypot(dx, dy), heading: eh - H[0] - turns * 2 * Math.PI, turns };
    for (let j = 0; j < n; j++) { const u = Math.min(1, (j * STEP) / length); X[j] -= dx * u; Y[j] -= dy * u; }
  }
  const profile = buildProfile(spec.profile, length, { closed, ...(spec.crestK ? { crestK: spec.crestK } : {}), ...(spec.sagK ? { sagK: spec.sagK } : {}) });
  const emax = spec.emax ?? 0.06, designSpeed = spec.designSpeed ?? 120, rmin = spec.rmin ?? null;
  // e at the LOCAL radius, so it runs in and out along each spiral as curvature does
  const eOf = (k) => (Math.abs(k) > 1e-9 ? superelevationFor(1 / Math.abs(k), { emax, designSpeed, ...(rmin ? { rmin } : {}) }) : 0);
  const at = (s) => {
    const sc = closed ? ((s % length) + length) % length : Math.max(0, Math.min(length, s));
    const f = sc / STEP, i = Math.min(n - 2, Math.floor(f)), t = f - i;
    const k = Kc[i] + (Kc[i + 1] - Kc[i]) * t;
    return {
      s: sc,
      x: X[i] + (X[i + 1] - X[i]) * t,
      y: Y[i] + (Y[i + 1] - Y[i]) * t,
      heading: H[i] + (H[i + 1] - H[i]) * t,
      k,
      z: profile.z(sc),
      grade: profile.grade(sc),
      e: eOf(k),
    };
  };
  // sample stations: every `fine` m where curvature or grade changes, `coarse` m on plain tangents,
  // always at element and vertical-curve boundaries (so a spiral's start is a real vertex).
  const stations = ({ fine = 5, coarse = 20 } = {}) => {
    const marks = new Set([0, length]);
    let acc = 0;
    for (const el of elements) { marks.add(acc); acc += el.length; marks.add(acc); }
    for (const c of profile.curves) { marks.add(Math.max(0, c.s0)); marks.add(Math.min(length, c.s1)); if (c.seam) { marks.add(length + c.s0); } }
    // a ramp's own breaks (toe, lip, the drop's foot, its landing), finely between them
    for (const f of profile.features || []) for (const b of f.breaks) if (b >= 0 && b <= length) marks.add(b);
    const ramped = (s) => (profile.features || []).some((f) => s >= f.s0 && s <= f.s1);
    for (const f of profile.features || []) for (let u = f.s0; u <= f.s1; u += f.fine ?? 0.5) marks.add(u);
    const busy = (s) => Math.abs(at(s).k) > 1e-9 || ramped(s) || profile.curves.some((c) => s >= c.s0 && s <= c.s1 || (c.seam && s - length >= c.s0));
    let s = 0;
    while (s < length) {
      const step = busy(s) || busy(Math.min(length, s + coarse)) ? fine : coarse;
      s = Math.min(length, s + step);
      marks.add(s);
    }
    // a lap's last station is the start again: dropped (a reader closes the ring)
    const keep = closed ? (v) => v < length : () => true;
    return [...marks].map((v) => Math.round(v * 1000) / 1000).filter((v, i, a) => a.indexOf(v) === i && keep(v)).sort((a, b) => a - b).map(at);
  };
  return { length, at, stations, elements, profile, closed, ...(closure ? { closure } : {}) };
}
