/**
 * strength/checks.js — the element checks. Each takes the agent's idealization ("a cantilever fixed here,
 * loaded there"), measures the real sections off the mesh where the element has a geometric body, runs the
 * textbook formula, and returns failure modes as utilizations (demand ÷ capacity), a weak spot, the
 * assumptions it made and the modes it does not cover. Confidence is graded in reading.js, not here.
 *
 * Units throughout: N, mm, MPa (= N/mm²), N·mm. Inputs are converted at the edge through machina's
 * dimension-guarded quantities, so a force given in kgf or lbf arrives as newtons.
 *
 *   cantilever  bending + shear + tip deflection, swept from root to load       (Gere, Mechanics of Materials)
 *   lever       a cantilever each side of the fulcrum; effort from machina      (+ machina/machines.js lever)
 *   shaft       torsional shear + angle of twist, swept along the shaft         (τ = T·r/J, θ = ∫T/GJ)
 *   strut       compression + Euler / Johnson buckling about the weakest axis   (Euler 1757, Johnson parabola)
 *   bolt        tension, shear, combined; thread stripping; heat-set pull-out   (ISO 898-1 stress area)
 *   gear        Lewis tooth bending with a velocity factor                      (Lewis 1892, Barth; Shigley 14-2)
 */

import { qty, toUnit, weight } from '../machina/quantities.js';
import { lever as machinaLever } from '../machina/machines.js';
import { measureSection, liftPoint, toPlane, unit } from './section.js';
import { directionFactor, isBrittle, isPrinted, shearModulus, BOLT_GRADES, resolveMaterial } from './materials.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const DEG = 180 / Math.PI;

const vec3 = (v, what) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw new Error(`strength: ${what} must be [x, y, z]`);
  return v.map(Number);
};

// ── loads at the edge: a force as [fx, fy, fz] N, { value, unit, dir }, or a hanging mass (kg, straight down) ──
export function resolveForce(load, what = 'load') {
  if (load == null) throw new Error(`strength: ${what} needs a force, a mass or a value`);
  if (Number.isFinite(+load.mass)) {
    const w = toUnit(weight(qty(+load.mass, 'kg')), 'N');
    return mul(unit(load.dir ? vec3(load.dir, `${what}.dir`) : [0, 0, -1]), w);
  }
  if (Array.isArray(load.force)) return vec3(load.force, `${what}.force`);
  if (load.force && typeof load.force === 'object') {
    const n = toUnit(qty(load.force.value, load.force.unit || 'N'), 'N');
    return mul(unit(load.force.dir ? vec3(load.force.dir, `${what}.force.dir`) : [0, 0, -1]), n);
  }
  if (Number.isFinite(+load.force)) return mul(unit(load.dir ? vec3(load.dir, `${what}.dir`) : [0, 0, -1]), +load.force);
  throw new Error(`strength: ${what} needs force: [fx, fy, fz] (N), force: { value, unit, dir }, or mass (kg)`);
}
const resolveTorqueNmm = (t, what = 'torque') => {
  if (Number.isFinite(+t)) return +t * 1000;   // a bare number is N·m
  if (t && typeof t === 'object') return toUnit(qty(t.value, t.unit || 'Nm'), 'N·mm');
  throw new Error(`strength: ${what} must be N·m, or { value, unit: 'Nm' | 'N·mm' | … }`);
};

// The demand factor a load kind carries. Impact doubles a suddenly applied load (the dynamic load factor of 2);
// repeated loads are not amplified here, but fatigue is flagged and lowers confidence in reading.js.
export const LOAD_KINDS = { static: 1, repeated: 1, impact: 2 };

// ── stress raisers (simplified Peterson). Bands for a shoulder in bending by fillet radius ÷ smaller depth, at
// a step of D/d ≥ 1.5; milder steps keep a share of the excess. Named in the reading as estimates. ──
export function shoulderKt(rOverD, DOverd) {
  const band = rOverD >= 0.2 ? 1.4 : rOverD >= 0.1 ? 1.65 : rOverD >= 0.05 ? 2.0 : rOverD >= 0.02 ? 2.4 : 2.7;
  const share = DOverd >= 1.5 ? 1 : DOverd >= 1.2 ? 0.8 : 0.6;
  return 1 + (band - 1) * share;
}
export const HOLE_KT = { bending: 2.0, axial: 2.5 };

function allowable(material, stressDir, build) {
  const f = directionFactor(material, stressDir, build);
  return { strength: material.strength * f.strength, E: material.E * f.E, factor: f };
}

// Bending + axial stress over a section: σ = σ0 + a·u + b·v (u, v from the centroid). On the root-side face
// (outward normal +n) the stresses must carry N = ∫σ dA and the moment M = (P − c) × F; with u × n = −v and
// v × n = u that gives Mu = ∫σ·v dA and Mv = −∫σ·u dA, a 2 × 2 solve in the section's second moments.
function sectionStress(p, N, Mu, Mv, side2 = null) {
  const det = p.Iuv * p.Iuv - p.Iuu * p.Ivv;
  // [Iuv Iuu; Ivv Iuv] [a b]ᵀ = [Mu, −Mv]ᵀ
  const a = (p.Iuv * Mu - p.Iuu * -Mv) / det;
  const b = (p.Iuv * -Mv - p.Ivv * Mu) / det;
  const s0 = N / p.area;
  // the peak on each face of the section along the bending direction (+ and −), so a stress raiser that sits on
  // one face (a one-sided step) multiplies only that face's fibres
  const sides = { plus: { peak: 0, at: null, bend: 0 }, minus: { peak: 0, at: null, bend: 0 } };
  for (const [x, y] of p.verts) {
    const xb = x - p.centroid[0], yb = y - p.centroid[1];
    const sb = a * xb + b * yb;
    const s = s0 + sb;
    const side = side2 && xb * side2[0] + yb * side2[1] < 0 ? sides.minus : sides.plus;
    // ties go to the tension side, where cracks start
    if (Math.abs(s) > Math.abs(side.peak) * 1.001 || (s > 0 && side.peak < 0 && Math.abs(s) >= Math.abs(side.peak) * 0.999)) { side.peak = s; side.at = [x, y]; side.bend = sb; }
  }
  const top = !sides.minus.at || Math.abs(sides.plus.peak) >= Math.abs(sides.minus.peak) ? sides.plus : sides.minus;
  const bendEnergy = a * a * p.Ivv + 2 * a * b * p.Iuv + b * b * p.Iuu;   // ∫σ_b² dA
  return { peak: top.peak, at: top.at, s0, peakBend: top.bend, bendEnergy, sides };
}

/**
 * beamSweep — the core of cantilever and lever. Cuts the mesh at `stations` planes from `root` (origin, unit
 * normal pointing along the member toward the load) to the load point, and at each takes the exact statics of
 * the free body beyond the cut: N = F·n, M = (P − c) × F. Returns the stations, the weak spot, and the tip
 * deflection along F by Castigliano (δ = (1/F) ∫ [∫σ²/E dA + N²/EA + T²/GJ] dx), which stays exact for a
 * section that varies along the span.
 */
function beamSweep(soup, { origin, normal, P, F, material, build, stations = 48 }) {
  // a printed inside corner is never sharper than the nozzle leaves it (≈ 0.2 mm for a 0.4 mm nozzle)
  const minFillet = isPrinted(material) ? 0.2 : 0;
  const n = unit(normal);
  const L = dot(sub(P, origin), n);
  if (!(L > 0)) throw new Error('strength: the load point must lie ahead of the root along its normal (normal points from the root toward the load)');
  const Fm = len(F);
  const allow = allowable(material, n, build);
  const G = shearModulus(material) * allow.factor.E;
  const Fperp = sub(F, mul(n, dot(F, n)));
  const bendDir = len(Fperp) > 1e-9 * Math.max(Fm, 1) ? unit(Fperp) : null;
  const station = (o) => {
    const { slice, props, centroid3 } = measureSection(soup, o, n);
    const x = dot(sub(o, origin), n);
    if (props.empty) return { x, o, empty: true };
    const M = cross(sub(P, centroid3), F);
    const Mp = toPlane(slice, M);
    const N = dot(F, n);
    const side2 = bendDir ? toPlane(slice, bendDir).slice(0, 2) : null;
    const S = sectionStress(props, N, Mp[0], Mp[1], side2);
    const T = Mp[2];
    const tauV = 1.5 * len(Fperp) / props.area;            // rectangle's peak; a stated estimate for other shapes
    const tauT = Math.abs(T) * props.rmax / props.J0;      // exact for round sections only
    return {
      x, o, slice, props, centroid3, N, M: len(M), T, sigma: S.peak, sigmaBend: S.peakBend, at: S.at, sides: S.sides, kt: 1, ktSide: { plus: 1, minus: 1 }, raisers: [],
      depth: depthAlong(slice, props, bendDir),
      tauV, tauT, energy: S.bendEnergy / allow.E + (N * N) / (allow.E * props.area) + (T * T) / (G * props.J0),
    };
  };
  const out = [];
  const dx = L / stations;
  // the first cut sits just off the root plane, so the root's own section (the highest moment) is read
  for (let i = 0; i < stations; i++) out.push(station(add(origin, mul(n, i === 0 ? dx * 0.1 : (i + 0.5) * dx))));
  const live = out.filter((s) => !s.empty);
  const depth = live.length ? Math.max(...live.map((s) => s.depth)) : 0;
  // holes: a stress raiser only where the section's topology changes within one depth — a cavity starting or
  // ending, or a cross-hole splitting the section into ligaments. A tube, or a hollow print, that runs straight
  // through has an inner loop at every station and no raiser from it.
  const topo = (s) => (s.empty ? 'gap' : `${s.props.outer}/${s.props.holes}`);
  const reach = Math.max(depth, dx) * 1.01;
  const holeAt = (s) => (s.props.holes > 0 || s.props.outer > 1) && out.some((t) => t !== s && Math.abs(t.x - s.x) <= reach && topo(t) !== topo(s));
  const holeKt = (s) => (Math.abs(s.sigmaBend) >= Math.abs(s.N / s.props.area) ? HOLE_KT.bending : HOLE_KT.axial);
  for (const s of live) if (holeAt(s)) {
    const k = holeKt(s);
    s.kt = Math.max(s.kt, k); s.ktSide = { plus: Math.max(s.ktSide.plus, k), minus: Math.max(s.ktSide.minus, k) }; s.raisers.push({ kind: 'hole', kt: k });
  }
  // shoulders: a fine area profile from one depth behind the root to the load finds every step in section, the
  // small end of each step gets its own station, and the fillet radius is read off how gradually the area rises
  const extra = [];
  for (const t of shoulders(soup, origin, n, L, depth)) {
    if (t.x < 0 || t.x >= L) continue;
    const s = station(add(origin, mul(n, t.x)));
    if (s.empty) continue;
    const r = Math.max(t.r, minFillet);
    const k = shoulderKt(r / s.depth, Math.sqrt(t.ratio));
    // which face the step is on: the bigger section reaching past the small one along the bending direction
    const faces = stepFaces(soup, s, add(origin, mul(n, t.xBig)), n, bendDir);
    s.kt = k; s.ktSide = { plus: faces.plus ? k : 1, minus: faces.minus ? k : 1 };
    s.raisers.push({ kind: 'shoulder', kt: r2(k), fillet_mm: r2(r), ...(t.sharp ? { sharp: true } : {}), ...(faces.plus !== faces.minus ? { face: faces.plus ? 'plus' : 'minus' } : {}) });
    if (holeAt(s)) { const kh = holeKt(s); s.kt = Math.max(s.kt, kh); s.ktSide = { plus: Math.max(s.ktSide.plus, kh), minus: Math.max(s.ktSide.minus, kh) }; s.raisers.push({ kind: 'hole', kt: kh }); }
    s.extra = true; extra.push(s);
  }
  let deflection = 0;
  for (const s of out) if (!s.empty) deflection += s.energy * dx;
  deflection /= Fm || 1;
  const gaps = out.filter((s) => s.empty).length;
  return { stations: [...out, ...extra], L, dx, allow, deflection, gaps, n, depth, bendDir };
}

// The section's extent along the bending direction (the depth beam theory means), or its widest extent when
// the load runs straight down the axis.
function depthAlong(slice, props, dir) {
  if (!dir) return 2 * props.rmax;
  const [du, dv] = toPlane(slice, dir);
  let lo = Infinity, hi = -Infinity;
  for (const [x, y] of props.verts) { const t = x * du + y * dv; if (t < lo) lo = t; if (t > hi) hi = t; }
  return hi - lo;
}

// The faces (+/− along the bending direction) on which a bigger neighbouring section stands proud of the small
// one. A step across the width, or a load with no bending direction, counts on both faces.
function stepFaces(soup, s, oBig, n, bendDir) {
  if (!bendDir) return { plus: true, minus: true };
  const span = (slice, props) => { let lo = Infinity, hi = -Infinity; for (const p of props.verts) { const t = dot(liftPoint(slice, p), bendDir); if (t < lo) lo = t; if (t > hi) hi = t; } return [lo, hi]; };
  const big = measureSection(soup, oBig, n);
  if (big.props.empty) return { plus: true, minus: true };
  const [loS, hiS] = span(s.slice, s.props), [loB, hiB] = span(big.slice, big.props);
  const tol = 0.02 * (hiS - loS);
  const plus = hiB > hiS + tol, minus = loB < loS - tol;
  return plus || minus ? { plus, minus } : { plus: true, minus: true };
}

/**
 * Steps in section along a member: sample the area finely, and wherever one side is a plateau and the other
 * rises past 1.25 × within one depth, record the small end, the area ratio, and the fillet radius as the
 * distance over which the area climbs 90 % of the way. A rise inside one sample is a sharp corner.
 */
export function shoulders(soup, origin, n, L, depth) {
  if (!(depth > 0)) return [];
  const h = Math.max(L / 240, depth / 40, 0.05);
  const x0 = -Math.min(depth, L), xs = [], A = [];
  for (let x = x0; x <= L + 1e-9; x += h) { xs.push(x); const { props } = measureSection(soup, add(origin, mul(n, x)), n); A.push(props.empty ? 0 : props.area); }
  const out = [];
  const win = Math.max(1, Math.round(depth / h));
  for (let i = 1; i < xs.length - 1; i++) {
    if (!(A[i] > 0)) continue;
    for (const dir of [-1, 1]) {
      const near = A[i + dir], away = A[i - dir];
      if (!(near > 1.02 * A[i]) || !(away > 0) || Math.abs(away - A[i]) > 0.02 * A[i]) continue;   // a plateau away, rising toward the step
      let big = A[i], j = i;
      for (let k = 1; k <= win && i + dir * k >= 0 && i + dir * k < xs.length; k++) if (A[i + dir * k] > big) { big = A[i + dir * k]; j = i + dir * k; }
      if (!(big > 1.25 * A[i])) continue;
      // walk back to where the rise begins (the fillet's tangent point): the first sample within 0.3 % of the
      // plateau one depth further away
      const ref = A[i - dir * win] > 0 ? A[i - dir * win] : A[i];
      let s0 = i; while (s0 - dir > 0 && s0 - dir < xs.length - 1 && A[s0 - dir] > ref * 1.003) s0 -= dir;
      const target = A[s0] + 0.9 * (big - A[s0]);
      let e = i; while (Math.abs(e - s0) < Math.abs(j - s0) && A[e] < target) e += dir;
      const r = Math.abs(e - s0 - dir) * h;
      if (out.some((o) => o.i0 === s0)) continue;
      out.push({ i0: s0, x: xs[s0], xBig: xs[j], ratio: big / A[s0], r: r <= h ? 0 : r, sharp: r <= h, side: dir });
    }
  }
  return out;
}

// The applied peak at a station: stress raisers count for brittle materials and repeated loads; a ductile part
// under a static load yields locally and redistributes, so Kt is reported but not applied (standard practice).
const appliesKt = (material, kind) => isBrittle(material) || kind === 'repeated';

function sweepModes(sw, { material, kind, demand, label }) {
  const useKt = appliesKt(material, kind);
  let worst = null;
  for (const s of sw.stations) {
    if (s.empty) continue;
    for (const face of ['plus', 'minus']) {
      const f = s.sides[face]; if (!f.at) continue;
      const kt = useKt ? s.ktSide[face] : 1;
      const peak = Math.abs(f.peak) * demand * kt;
      const u = peak / sw.allow.strength;
      // ties go to the tension face, where cracks start
      if (!worst || u > worst.u * 1.0001 || (u >= worst.u * 0.9999 && f.peak > 0 && !worst.tension)) worst = { s, u, peak, at: f.at, face, tension: f.peak > 0 };
    }
  }
  const shear = Math.max(...sw.stations.filter((s) => !s.empty).map((s) => (s.tauV + s.tauT) * demand));
  const shearAllow = 0.577 * sw.allow.strength;
  const modes = [
    { mode: 'bending', stress_mpa: r2(worst.peak), allow_mpa: r2(sw.allow.strength), utilization: r3(worst.u), sf: r2(1 / worst.u), at_mm_from_root: r2(worst.s.x) },
    { mode: 'shear', stress_mpa: r2(shear), allow_mpa: r2(shearAllow), utilization: r3(shear / shearAllow), sf: r2(shearAllow / shear) },
  ];
  const s = worst.s;
  // a stress raiser within one depth of the weak spot belongs to it, applied or not
  const near = sw.stations.filter((t) => !t.empty && t.raisers?.length && Math.abs(t.x - s.x) <= Math.max(sw.depth, sw.dx));
  const raisers = [...new Map(near.flatMap((t) => t.raisers).filter((r) => !r.face || r.face === worst.face).map((r) => [`${r.kind}`, r])).values()];
  const kt = Math.max(1, ...raisers.map((r) => r.kt));
  const weak = {
    at: liftPoint(s.slice, worst.at).map(r2), section_center: s.centroid3.map(r2), normal: sw.n.map(r3),
    section_mm2: r2(s.props.area), mode: 'bending', side: worst.tension ? 'tension' : 'compression', utilization: r3(worst.u), label,
    ...(raisers.length ? { raisers, kt: r2(kt), kt_applied: useKt } : {}),
  };
  return { modes, weak, worst };
}

function idealizationFacts(sw) {
  const live = sw.stations.filter((s) => !s.empty && !s.extra);
  const depth = Math.max(...live.map((s) => s.depth));
  const areas = live.map((s) => s.props.area);
  const vary = Math.max(...areas) / Math.min(...areas);
  // the ligaments either side of a hole act together; only pieces that run apart count
  const pieces = Math.max(...live.map((s) => (s.raisers?.some((r) => r.kind === 'hole') ? 1 : s.props.outer)));
  return { slenderness: r2(sw.L / depth), varies: r2(vary), gaps: sw.gaps, pieces, open: live.some((s) => s.props.open > 0) };
}

// ── cantilever ──
export function cantilever(soup, spec, ctx) {
  const origin = vec3(spec.root?.at, 'root.at'), normal = vec3(spec.root?.normal, 'root.normal');
  const P = vec3(spec.load?.at, 'load.at');
  const F = resolveForce(spec.load, 'load');
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const sw = beamSweep(soup, { origin, normal, P, F, material: ctx.material, build: ctx.build });
  if (sw.stations.every((s) => s.empty)) throw new Error('strength: no section found between the root and the load — the root plane or the normal misses the part');
  const { modes, weak } = sweepModes(sw, { material: ctx.material, kind: spec.kind, demand, label: spec.label || 'cantilever' });
  const delta = sw.deflection * demand;
  const limit = spec.limit?.deflection_mm ?? sw.L / 250;
  modes.push({ mode: 'deflection', deflection_mm: r3(delta), limit_mm: r3(limit), utilization: r3(delta / limit), rigidity: true, basis: spec.limit?.deflection_mm ? 'your limit' : 'span ÷ 250' });
  return {
    element: 'cantilever', span_mm: r2(sw.L), load_n: r2(len(F)), modes, weak_spot: weak,
    facts: { ...idealizationFacts(sw), direction: sw.allow.factor, stressAxis: sw.n },
    assumptions: [
      'fixed rigidly at the root plane (a real wall or clamp gives a little, so the tip moves more)',
      'one point load; shear stress taken as 1.5 × average (exact for a rectangle)',
      ...(weak.side === 'compression' ? ['the weak spot is on the compression side; strength in compression is taken equal to tension (conservative for most plastics, not for wood)'] : []),
      ...(sw.bendDir ? [] : ['the load runs straight along the member, so this is not a cantilever: check a pull as a tie (it reads the stretch as a strain) and a push as a strut (it adds buckling)']),
    ],
    not_covered: ['the fixing itself (screws, wall plugs) — check it as a bolt', 'local buckling of thin flanges', 'fatigue life'],
  };
}

// ── lever: the fulcrum carries both arms' moment. The effort comes from machina's lever, so the sensor and the
// machine calculator can never disagree on the force someone has to supply. ──
export function lever(soup, spec, ctx) {
  const fulcrum = vec3(spec.fulcrum?.at, 'fulcrum.at');
  const Pl = vec3(spec.load?.at, 'load.at'), Pe = vec3(spec.effort?.at, 'effort.at');
  const Fl = resolveForce(spec.load, 'load');
  const loadArm = len(sub(Pl, fulcrum)), effortArm = len(sub(Pe, fulcrum));
  const machine = machinaLever({ effortArm, loadArm, eta: spec.eta ?? 1 });
  const effortN = len(Fl) / machine.ama;   // actual MA (ideal × efficiency)
  const Fe = mul(unit(spec.effort?.dir ? vec3(spec.effort.dir, 'effort.dir') : Fl), effortN);
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const arms = [
    { name: 'load arm', P: Pl, F: Fl },
    { name: 'effort arm', P: Pe, F: Fe },
  ];
  let best = null; const armOut = [];
  for (const arm of arms) {
    const n = unit(sub(arm.P, fulcrum));
    const sw = beamSweep(soup, { origin: fulcrum, normal: n, P: arm.P, F: arm.F, material: ctx.material, build: ctx.build });
    if (sw.stations.every((s) => s.empty)) throw new Error(`strength: the ${arm.name} has no section between the fulcrum and its end`);
    const m = sweepModes(sw, { material: ctx.material, kind: spec.kind, demand, label: `lever ${arm.name}` });
    armOut.push({ arm: arm.name, ...m, sw });
    if (!best || m.worst.u > best.worst.u) best = { ...m, sw, arm: arm.name };
  }
  const modes = best.modes.map((x) => ({ ...x, arm: best.arm }));
  const delta = armOut[0].sw.deflection * demand;
  const limit = spec.limit?.deflection_mm ?? armOut[0].sw.L / 100;
  modes.push({ mode: 'deflection', arm: 'load arm', deflection_mm: r3(delta), limit_mm: r3(limit), utilization: r3(delta / limit), rigidity: true, basis: spec.limit?.deflection_mm ? 'your limit' : 'arm ÷ 100 (a hand tool may flex more than a shelf)' });
  return {
    element: 'lever', load_n: r2(len(Fl)), effort_n: r2(effortN), mechanical_advantage: r3(machine.ama), modes, weak_spot: best.weak,
    facts: { ...idealizationFacts(best.sw), direction: best.sw.allow.factor, stressAxis: best.sw.n },
    assumptions: ['the fulcrum is a point contact that does not crush', 'each arm is checked as a cantilever from the fulcrum'],
    not_covered: ['bearing (crushing) stress at the fulcrum and at the load contact', 'fatigue life'],
  };
}

// ── shaft: torsion swept along the shaft, with the notch Kt read off the section's shape ──
export function shaft(soup, spec, ctx) {
  const origin = vec3(spec.axis?.at, 'axis.at'), n = unit(vec3(spec.axis?.dir, 'axis.dir'));
  const Lmm = +spec.length;
  if (!(Lmm > 0)) throw new Error('strength: shaft.length (mm) is required');
  const T = resolveTorqueNmm(spec.torque);
  const demand = LOAD_KINDS[spec.kind || 'static'];
  // Torsion puts the peak shear on the surface; its principal stresses lie at 45° to the axis, so a printed shaft
  // built along its axis feels the layer weakness at half the across share. Taken as the 45° direction.
  const diag = unit(add(n, perp(n)));
  const allow = allowable(ctx.material, diag, ctx.build);
  const G = shearModulus(ctx.material) * allow.factor.E;
  const k = 32; const dx = Lmm / k;
  let worst = null, twist = 0, gaps = 0;
  for (let i = 0; i < k; i++) {
    const o = add(origin, mul(n, (i + 0.5) * dx));
    const { slice, props } = measureSection(soup, o, n);
    if (props.empty) { gaps++; continue; }
    const round = props.holes <= 1 && props.area / (Math.PI * props.rmax * props.rmax) > (props.holes ? 0 : 0.97);
    const notch = !round && concaveOuter(slice.loops);
    const kt = round ? 1 : notch ? 3.0 : 1.5;
    const tau = Math.abs(T) * props.rmax / props.J0;
    twist += Math.abs(T) * dx / (G * props.J0);
    const useKt = appliesKt(ctx.material, spec.kind);
    const peak = tau * demand * (useKt ? kt : 1);
    const u = peak / (0.577 * allow.strength);
    if (!worst || u > worst.u) worst = { u, peak, slice, props, o, kt, round, notch, useKt, x: (i + 0.5) * dx };
  }
  if (!worst) throw new Error('strength: no shaft section found along the axis');
  const d = 2 * worst.props.rmax;
  const twistLimit = (spec.limit?.twist_deg ?? (Lmm / (20 * d))) / DEG;   // 1° over 20 diameters (Shigley)
  const at = liftPoint(worst.slice, worst.props.verts.reduce((b, p) => (Math.hypot(p[0] - worst.props.centroid[0], p[1] - worst.props.centroid[1]) > Math.hypot(b[0] - worst.props.centroid[0], b[1] - worst.props.centroid[1]) ? p : b)));
  const modes = [
    { mode: 'torsion', stress_mpa: r2(worst.peak), allow_mpa: r2(0.577 * allow.strength), utilization: r3(worst.u), sf: r2(1 / worst.u), at_mm_along: r2(worst.x) },
    { mode: 'twist', twist_deg: r3(twist * demand * DEG), limit_deg: r3(twistLimit * DEG), utilization: r3((twist * demand) / twistLimit), rigidity: true, basis: spec.limit?.twist_deg ? 'your limit' : '1° over 20 diameters' },
  ];
  return {
    element: 'shaft', torque_nm: r2(T / 1000), length_mm: r2(Lmm), modes,
    weak_spot: { at: at.map(r2), section_center: liftPoint(worst.slice, worst.props.centroid).map(r2), normal: n.map(r3), section_mm2: r2(worst.props.area), mode: 'torsion', utilization: r3(worst.u), label: spec.label || 'shaft', ...(worst.kt > 1 ? { raisers: [{ kind: worst.notch ? 'keyway or notch' : 'flat', kt: worst.kt }], kt: worst.kt, kt_applied: worst.useKt } : {}) },
    facts: { slenderness: r2(Lmm / d), varies: 1, gaps, pieces: 1, open: false, nonRound: !worst.round, direction: allow.factor, stressAxis: diag },
    assumptions: ['pure torsion between the two ends', worst.round ? 'round section: τ = T·r/J is exact' : 'non-round section: τ = T·r/J with the polar moment is an estimate'],
    not_covered: ['bending from belt or gear side loads (add them as a cantilever)', 'the hub, key and set screw', 'fatigue life'],
  };
}
const perp = (n) => unit(Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0]));
function concaveOuter(loops) {
  for (const L of loops) {
    if (!L.closed) continue;
    const p = L.pts; let area = 0;
    for (let i = 0; i < p.length; i++) area += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
    if (area <= 0) continue;   // holes
    // A notch shows as a run of concave turns spanning a real depth, not mesh noise: measure the deepest point
    // inside the convex hull's boundary relative to the size.
    let concave = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (z < -1e-6) concave++;
    }
    if (concave >= 2) return true;
  }
  return false;
}

// ── strut: compression + buckling about the weakest axis anywhere along the member ──
const END_K = { 'pinned': 1, 'fixed-free': 2, 'fixed-pinned': 0.7, 'fixed-fixed': 0.5 };
export function strut(soup, spec, ctx) {
  const A0 = vec3(spec.from, 'from'), B0 = vec3(spec.to, 'to');
  const Lmm = len(sub(B0, A0)); const n = unit(sub(B0, A0));
  if (Number.isFinite(+spec.force) && +spec.force < 0) throw new Error('strength: a strut carries a push; a negative force pulls — check a pull with element \'tie\' (a bar in tension cannot buckle)');
  const Fn = Number.isFinite(+spec.force) ? +spec.force : len(resolveForce(spec, 'strut'));
  const K = END_K[spec.ends || 'pinned'];
  if (K == null) throw new Error(`strength: strut.ends must be one of ${Object.keys(END_K).join(', ')}`);
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const allow = allowable(ctx.material, n, ctx.build);
  const k = 32; let minI = Infinity, minA = Infinity, weak = null, gaps = 0;
  for (let i = 0; i < k; i++) {
    const o = add(A0, mul(n, (i + 0.5) * (Lmm / k)));
    const { slice, props } = measureSection(soup, o, n);
    if (props.empty) { gaps++; continue; }
    if (props.I2 < minI) { minI = props.I2; weak = { slice, props, x: (i + 0.5) * (Lmm / k) }; }
    minA = Math.min(minA, props.area);
  }
  if (!weak) throw new Error('strength: no strut section found between from and to');
  const r = Math.sqrt(minI / minA);
  const slender = (K * Lmm) / r;
  const transition = Math.sqrt((2 * Math.PI * Math.PI * allow.E) / allow.strength);
  const Pcr = slender >= transition
    ? (Math.PI * Math.PI * allow.E * minI) / ((K * Lmm) ** 2)
    : minA * allow.strength * (1 - (allow.strength * slender * slender) / (4 * Math.PI * Math.PI * allow.E));
  const sigma = (Fn * demand) / minA;
  const modes = [
    { mode: 'compression', stress_mpa: r2(sigma), allow_mpa: r2(allow.strength), utilization: r3(sigma / allow.strength), sf: r2(allow.strength / sigma) },
    { mode: 'buckling', load_n: r2(Fn * demand), critical_n: r2(Pcr), utilization: r3((Fn * demand) / Pcr), sf: r2(Pcr / (Fn * demand)), formula: slender >= transition ? 'Euler' : 'Johnson', slenderness: r2(slender) },
  ];
  return {
    element: 'strut', length_mm: r2(Lmm), load_n: r2(Fn), modes,
    weak_spot: { at: liftPoint(weak.slice, weak.props.centroid).map(r2), section_center: liftPoint(weak.slice, weak.props.centroid).map(r2), normal: n.map(r3), section_mm2: r2(weak.props.area), mode: modes[1].utilization > modes[0].utilization ? 'buckling' : 'compression', utilization: r3(Math.max(modes[0].utilization, modes[1].utilization)), label: spec.label || 'strut' },
    facts: { slenderness: r2(Lmm / (2 * weak.props.rmax)), varies: 1, gaps, pieces: weak.props.outer, open: false, direction: allow.factor, stressAxis: n },
    assumptions: [`ends ${spec.ends || 'pinned'} (K = ${K})`, 'the load runs straight down the axis; any offset adds bending and lowers the buckling load'],
    not_covered: ['local buckling of thin walls', 'the joints at each end'],
  };
}

// ── tie: a member in tension. The beam sweep with the pull along the member: each station carries N = F and the
// bending an off-centre pull adds, holes and shoulders take the axial Kt, and Castigliano's deflection along F is
// the stretch, ∫F/EA dx (exact for a section that varies). ──
export function tie(soup, spec, ctx) {
  const A0 = vec3(spec.from, 'from'), B0 = vec3(spec.to, 'to');
  const Fn = Number.isFinite(+spec.force) ? +spec.force : len(resolveForce(spec, 'tie'));
  if (!(Fn > 0)) throw new Error(Fn < 0 ? 'strength: a tie carries a pull; a negative force pushes — check a push with element \'strut\' (it adds buckling)' : 'strength: tie needs force (N, the pull)');
  const n = unit(sub(B0, A0));
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const sw = beamSweep(soup, { origin: A0, normal: n, P: B0, F: mul(n, Fn), material: ctx.material, build: ctx.build });
  if (sw.stations.every((s) => s.empty)) throw new Error('strength: no section found between from and to — the line misses the part');
  const { modes: m, weak } = sweepModes(sw, { material: ctx.material, kind: spec.kind, demand, label: spec.label || 'tie' });
  const tension = { ...m[0], mode: 'tension' };
  weak.mode = 'tension';
  const stretch = sw.deflection * demand;
  const strain = tension.stress_mpa / sw.allow.E;
  const modes = [tension];
  if (Number.isFinite(spec.limit?.elongation_mm)) modes.push({ mode: 'elongation', deflection_mm: r3(stretch), limit_mm: r3(spec.limit.elongation_mm), utilization: r3(stretch / spec.limit.elongation_mm), rigidity: true, basis: 'your limit' });
  const ecc = sw.stations.some((s) => !s.empty && Math.abs(s.sigmaBend) > 0.05 * Math.abs(s.N / s.props.area));
  return {
    element: 'tie', length_mm: r2(sw.L), load_n: r2(Fn), modes, weak_spot: weak,
    elongation_mm: r3(stretch), strain_pct: r3(strain * 100),
    facts: { ...idealizationFacts(sw), direction: sw.allow.factor, stressAxis: sw.n },
    assumptions: [
      'the pull acts along the line from → to, through the ends of the member',
      ...(ecc ? ['the line runs off the sections\' centroids, so the off-centre pull adds bending (included)'] : []),
      `stretch ∫F/EA over the swept sections${Number.isFinite(spec.limit?.elongation_mm) ? '' : ' (no limit given: reported, not judged)'}`,
    ],
    not_covered: ['the grips or pins that apply the pull (bearing and tear-out at a pin hole)', 'necking past yield', 'fatigue life'],
  };
}

// ── bolt: ISO coarse thread, stress area As = π/4 (d − 0.9382 p)² ──
const ISO_COARSE = { M2: [2, 0.4], 'M2.5': [2.5, 0.45], M3: [3, 0.5], M4: [4, 0.7], M5: [5, 0.8], M6: [6, 1], M8: [8, 1.25], M10: [10, 1.5], M12: [12, 1.75], M16: [16, 2], M20: [20, 2.5], M24: [24, 3] };
// Typical brass heat-set inserts (outer diameter, length), mm.
const INSERTS = { M2: [3.2, 3], 'M2.5': [3.6, 4], M3: [4.5, 5.7], M4: [5.6, 8.1], M5: [6.4, 9.5], M6: [8, 12.7], M8: [10, 12.7] };
export function bolt(_soup, spec, ctx) {
  const size = String(spec.size || '').toUpperCase().replace(/^m/, 'M');
  const t = ISO_COARSE[size];
  if (!t) throw new Error(`strength: bolt.size must be one of ${Object.keys(ISO_COARSE).join(', ')}`);
  const [d, p] = t;
  const As = (Math.PI / 4) * (d - 0.9382 * p) ** 2;
  const dMinor = d - 1.226869 * p;
  const Aminor = (Math.PI / 4) * dMinor * dMinor;
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const tension = Math.abs(+spec.tension || 0) * demand, shear = Math.abs(+spec.shear || 0) * demand;
  let yieldB, boltLabel;
  if (spec.grade) {
    const g = BOLT_GRADES[spec.grade];
    if (!g) throw new Error(`strength: bolt.grade must be one of ${Object.keys(BOLT_GRADES).join(', ')}`);
    yieldB = g.yield; boltLabel = `property class ${spec.grade}`;
  } else { yieldB = ctx.material.strength * ctx.material.layer; boltLabel = `${ctx.material.label}, printed (worst-case layer direction)`; }
  const sigma = tension / As, tau = shear / Aminor;
  const vm = Math.sqrt(sigma * sigma + 3 * tau * tau);
  const modes = [];
  if (tension) modes.push({ mode: 'bolt tension', stress_mpa: r2(sigma), allow_mpa: r2(yieldB), utilization: r3(sigma / yieldB), sf: r2(yieldB / sigma) });
  if (shear) modes.push({ mode: 'bolt shear', stress_mpa: r2(tau), allow_mpa: r2(0.577 * yieldB), utilization: r3(tau / (0.577 * yieldB)), sf: r2((0.577 * yieldB) / tau) });
  if (tension && shear) modes.push({ mode: 'bolt combined (von Mises)', stress_mpa: r2(vm), allow_mpa: r2(yieldB), utilization: r3(vm / yieldB), sf: r2(yieldB / vm) });
  const assumptions = [`${size}×${p} coarse, stress area ${r2(As)} mm²`, 'shear taken on the threads (minor diameter): conservative if the shank carries it'];
  const into = spec.into ? resolveMaterial(spec.into) : null;
  if (tension && into) {
    if (spec.insert) {
      const ins = INSERTS[size];
      if (!ins) throw new Error(`strength: no heat-set insert size for ${size}`);
      const [D, Li] = ins;
      const tauHost = 0.577 * into.strength * into.layer;
      const cap = Math.PI * D * Li * tauHost;
      modes.push({ mode: 'insert pull-out', load_n: r2(tension), capacity_n: r2(cap), utilization: r3(tension / cap), sf: r2(cap / tension) });
      assumptions.push(`heat-set insert ${D} × ${Li} mm: pull-out as shear of the host around the insert, at the host's layer strength`);
    } else {
      const Le = +spec.engaged_mm || d * 1.5;
      const tauHost = 0.577 * into.strength * (into.layer ?? 1);
      const cap = 0.75 * Math.PI * d * Le * tauHost;
      modes.push({ mode: 'thread stripping', load_n: r2(tension), capacity_n: r2(cap), utilization: r3(tension / cap), sf: r2(cap / tension) });
      assumptions.push(`internal thread in ${into.label}, ${r2(Le)} mm engaged: strip area 0.75·π·d·L (rule of thumb)`);
    }
  }
  if (!modes.length) throw new Error('strength: bolt needs tension and/or shear (N)');
  const worst = modes.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  return {
    element: 'bolt', size, bolt: boltLabel, modes,
    weak_spot: spec.at ? { at: vec3(spec.at, 'bolt.at').map(r2), mode: worst.mode, utilization: worst.utilization, label: spec.label || `${size} bolt` } : null,
    facts: { slenderness: 10, varies: 1, gaps: 0, pieces: 1, open: false, tableDriven: true, printedThread: !spec.grade || (into && !spec.insert && into.family === 'fdm'), into: into?.id },
    assumptions,
    not_covered: ['preload and joint separation', 'pull-through of the head into a soft part', 'bearing on the hole walls'],
    material_override: into ? into : null,
  };
}

// ── gear: Lewis bending. Y for 20° full-depth teeth (Shigley table 14-2), interpolated. ──
const LEWIS_Y = [[12, 0.245], [13, 0.261], [14, 0.277], [15, 0.29], [16, 0.296], [17, 0.303], [18, 0.309], [19, 0.314], [20, 0.322], [21, 0.328], [22, 0.331], [24, 0.337], [26, 0.346], [28, 0.353], [30, 0.359], [34, 0.371], [38, 0.384], [43, 0.397], [50, 0.409], [60, 0.422], [75, 0.435], [100, 0.447], [150, 0.46], [300, 0.472], [400, 0.48]];
export function lewisY(z) {
  if (z < 12) return null;
  if (z >= 400) return 0.485;
  for (let i = 0; i < LEWIS_Y.length - 1; i++) {
    const [z0, y0] = LEWIS_Y[i], [z1, y1] = LEWIS_Y[i + 1];
    if (z >= z0 && z <= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
  }
  return 0.485;
}
export function gear(_soup, spec, ctx) {
  const m = +spec.module, z = Math.round(+spec.teeth), F = +spec.face;
  if (!(m > 0 && z > 0 && F > 0)) throw new Error('strength: gear needs module, teeth and face (mm)');
  const Y = lewisY(z);
  if (Y == null) throw new Error('strength: the Lewis form factor is tabulated from 12 teeth up; fewer teeth undercut');
  const T = resolveTorqueNmm(spec.torque);
  const dP = m * z;
  const Wt = (2 * T) / dP;
  const V = spec.rpm ? (Math.PI * (dP / 1000) * +spec.rpm) / 60 : 0;   // pitch-line speed, m/s
  const printedOrMoulded = ctx.material.family !== 'metal';
  const Kv = printedOrMoulded ? (3.05 + V) / 3.05 : (6.1 + V) / 6.1;   // Barth: cast profile vs cut profile
  const demand = LOAD_KINDS[spec.kind || 'static'];
  const axis = spec.axis ? unit(vec3(spec.axis, 'gear.axis')) : [0, 0, 1];
  // a tooth's bending stress runs radially-tangentially, perpendicular to the gear axis; some tooth round the
  // gear always has that direction closest to the build axis
  const worstDir = ctx.build ? unit(sub(ctx.build, mul(axis, dot(ctx.build, axis)))) : null;
  const stressDir = worstDir && len(worstDir) > 1e-6 ? worstDir : perp(axis);
  const allow = allowable(ctx.material, stressDir, ctx.build);
  const sigma = (Kv * Wt * demand) / (F * m * Y);
  const modes = [{ mode: 'tooth bending (Lewis)', stress_mpa: r2(sigma), allow_mpa: r2(allow.strength), utilization: r3(sigma / allow.strength), sf: r2(allow.strength / sigma), Y: r3(Y), Kv: r3(Kv), tangential_n: r2(Wt) }];
  return {
    element: 'gear', module: m, teeth: z, face_mm: F, torque_nm: r2(T / 1000), modes,
    weak_spot: spec.at ? { at: vec3(spec.at, 'gear.at').map(r2), mode: 'tooth bending', utilization: modes[0].utilization, label: spec.label || `gear z${z}` } : null,
    facts: { slenderness: 10, varies: 1, gaps: 0, pieces: 1, open: false, tableDriven: true, direction: allow.factor, stressAxis: stressDir },
    assumptions: ['one tooth carries the whole load at its tip (Lewis): conservative for a good mesh', `velocity factor ${printedOrMoulded ? 'for a moulded or printed profile' : 'for a cut profile'} at ${r2(V)} m/s`],
    not_covered: ['surface pitting (contact stress, AGMA)', 'wear and heat in plastic gears running fast', 'the shaft and hub'],
  };
}

export const ELEMENTS = { cantilever, lever, shaft, strut, tie, bolt, gear };
