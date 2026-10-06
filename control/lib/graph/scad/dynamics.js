/**
 * dynamics — weight, inertia, friction and the forces through a solved mechanism, handed to the rigidity sensor.
 *
 * mechanism.js solves where every part is through the cycle. This module gives the parts mass (each part's closed mesh,
 * integrated exactly, × the strength table's density × a print's fill share) and reads the cycle as a machine:
 *
 *   - EFFORT by energy. With every body's kinematic coefficients (centroid velocity and angular velocity per unit of
 *     drive), the kinetic energy is ½·J(s)·ṡ² and the potential Σ m·g·z. At a constant drive speed ω the drive must
 *     supply ½·J′(s)·ω² + dV/ds on top of the loads; at start-up J(s)·α more. Each body's share passes through its
 *     path efficiency: divided by η when power flows to it, multiplied by η when it flows back.
 *   - FORCES through each coupling from the power downstream of it (a gear's tangential force, a rod's axial force, a
 *     screw's thrust), then each joint's reaction as the Newton balance of its body. Only for a coupling graph that is
 *     a TREE: a looped train (planets sharing a sun) splits its power by stiffness, which a rigid model cannot say.
 *   - FRICTION from those reactions: a pin turns against μ·R·r, a slide against μ·N (first order: friction from the
 *     frictionless reactions).
 *   - STRENGTH: each rod as a pinned strut at its peak compression, each gear by Lewis at its peak torque, through the
 *     rigidity sensor's own checks and confidence.
 *
 * Rigid bodies throughout: no deflection, no natural frequencies, no impacts at clearances. Pure but for the soup
 * the rendered part meshes the caller passes in.
 */

import { resolveMaterial } from '../strength/materials.js';
import { strengthReading } from '../strength/index.js';
import { transformsAt, pathEfficiency, screwEfficiency, DEFAULT_PERIOD } from './mechanism.js';

const TAU = Math.PI * 2;
const G = 9.81;
const DEG = Math.PI / 180;
export const DEFAULT_FRICTION = { pin: 0.15, slide: 0.2 };
export const FLUCTUATION_TARGET = 0.05;
// A bushing's PV limit (MPa·m/s), dry, rule of thumb: the point where a plain bearing of that material starts to wear
// fast or soften. Very low certainty for prints (layer lines, infill), stated so in every reading.
export const PV_LIMIT = { pla: 0.03, petg: 0.05, abs: 0.05, asa: 0.05, 'pa-cf': 0.15, pa12: 0.1, resin: 0.03, 'tough-resin': 0.04, acrylic: 0.03, pc: 0.05, brass: 1.0, oak: 0.1, pine: 0.05, plywood: 0.05 };
// Typical stepper holding torque (N·m) by frame and body length; usable torque at speed is taken as half of it.
export const MOTOR_TORQUE = { 'nema11-32': 0.06, 'nema14-34': 0.2, 'nema17-34': 0.28, 'nema17-40': 0.45, 'nema17-48': 0.55, 'nema17-60': 0.65, 'nema23-56': 1.26, 'nema23-76': 1.89 };
export const MOTOR_USABLE = 0.5;

// ─── vectors ──────────────────────────────────────────────────────────────────────

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const mv3 = (R, v) => [dot(R[0], v), dot(R[1], v), dot(R[2], v)];
const tr3 = (R) => [0, 1, 2].map((i) => [0, 1, 2].map((k) => R[k][i]));
const mm3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const apply = (T, v) => add(mv3(T.R, v), T.p);
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const sig = (v) => (v === 0 ? 0 : Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 1 ? Math.round(v * 100) / 100 : Number(v.toPrecision(3)));

// ─── mass properties of a closed triangle mesh ────────────────────────────────────

/**
 * Volume, centroid and inertia tensor (about the centroid, per unit density) of a closed mesh, by summing the signed
 * tetrahedra each triangle makes with the origin. `tris` is [[a, b, c], …] in any length unit; `k` scales it (mm → m).
 * Returns { volume, centroid, I } in the scaled unit (m³, m, m⁵ — multiply I by density for kg·m²).
 */
export function massProperties(tris, k = 1) {
  let V = 0; const S1 = [0, 0, 0]; const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const t of tris) {
    const a = mul(t[0], k), b = mul(t[1], k), c = mul(t[2], k);
    const det = dot(a, cross(b, c));
    V += det / 6;
    const s = add(add(a, b), c);
    for (let i = 0; i < 3; i++) S1[i] += det * s[i] / 24;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += det / 120 * (a[i] * a[j] + b[i] * b[j] + c[i] * c[j] + s[i] * s[j]);
  }
  const sgn = V < 0 ? -1 : 1;
  V *= sgn;
  if (V < 1e-18) return { volume: 0, centroid: [0, 0, 0], I: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  const cen = S1.map((v) => (v * sgn) / V);
  const Cc = C.map((row, i) => row.map((v, j) => v * sgn - V * cen[i] * cen[j]));
  const trace = Cc[0][0] + Cc[1][1] + Cc[2][2];
  const I = Cc.map((row, i) => row.map((v, j) => (i === j ? trace : 0) - v));
  return { volume: V, centroid: cen, I };
}

// ─── validation of the new fields ─────────────────────────────────────────────────

/** Refusals for the dynamics fields of a mechanism block; [] when absent or well formed. */
export function validateDynamics(mech, partNames) {
  const errs = [];
  if (!mech || typeof mech !== 'object') return errs;
  const parts = new Set(partNames || []);
  const mat = (v, at) => { try { resolveMaterial(v); } catch (e) { errs.push(`${at}: ${e.message.replace(/^strength: /, '')}`); } };
  if (mech.material != null) mat(mech.material, 'mechanism.material');
  if (mech.bodies != null) {
    if (typeof mech.bodies !== 'object' || Array.isArray(mech.bodies)) errs.push('`mechanism.bodies` must be { <part>: { material?, mass?, fill? } }');
    else for (const [n, b] of Object.entries(mech.bodies)) {
      const at = `mechanism.bodies.${n}`;
      if (!parts.has(n)) { errs.push(`${at}: names no part`); continue; }
      if (!b || typeof b !== 'object') { errs.push(`${at} must be an object`); continue; }
      if (b.material != null) mat(b.material, `${at}.material`);
      if (b.mass != null && !(Number.isFinite(b.mass) && b.mass >= 0)) errs.push(`${at}.mass must be kg, ≥ 0`);
      if (b.fill != null && !(Number.isFinite(b.fill) && b.fill > 0 && b.fill <= 1)) errs.push(`${at}.fill must be in (0, 1], the solid share of the print`);
    }
  }
  if (mech.gravity != null && mech.gravity !== false && mech.gravity !== true) errs.push('`mechanism.gravity` must be true or false');
  if (mech.friction != null) {
    if (typeof mech.friction !== 'object') errs.push('`mechanism.friction` must be { pin?: μ, slide?: μ }');
    else for (const k of ['pin', 'slide']) if (mech.friction[k] != null && !(Number.isFinite(mech.friction[k]) && mech.friction[k] >= 0 && mech.friction[k] < 2)) errs.push(`mechanism.friction.${k} must be a coefficient 0–2`);
  }
  for (const [n, j] of Object.entries(mech.joints || {})) for (const k of ['pin_r', 'pin_len']) if (j?.[k] != null && !(Number.isFinite(j[k]) && j[k] > 0)) errs.push(`mechanism.joints.${n}.${k} must be a positive length`);
  (mech.couplings || []).forEach((c, i) => { if (c?.pin_r != null && !(Number.isFinite(c.pin_r) && c.pin_r > 0)) errs.push(`mechanism.couplings[${i}].pin_r must be a positive length`); });
  const d = mech.drive || {};
  if (d.spinup != null && !(Number.isFinite(d.spinup) && d.spinup > 0)) errs.push('mechanism.drive.spinup must be seconds, > 0');
  if (d.motor != null && !MOTOR_TORQUE[d.motor]) errs.push(`mechanism.drive.motor must be one of ${Object.keys(MOTOR_TORQUE).join(', ')}`);
  if (mech.duty != null && !(mech.duty && Number.isFinite(mech.duty.hours) && mech.duty.hours > 0)) errs.push('`mechanism.duty` must be { hours }');
  (mech.loads || []).forEach((l, i) => { if (l?.sustained != null && typeof l.sustained !== 'boolean') errs.push(`mechanism.loads[${i}].sustained must be a boolean`); });
  return errs;
}

/** Whether a mechanism asks for dynamics at all — absent every new field, the motion report is unchanged. */
export const wantsDynamics = (mech) => !!mech && (mech.material != null || mech.bodies != null || mech.friction != null || mech.drive?.spinup != null || mech.drive?.motor != null || mech.duty != null);

// ─── the bodies ───────────────────────────────────────────────────────────────────

function bodiesOf(mech, partTris, k) {
  const out = {};
  for (const [name, tris] of Object.entries(partTris)) {
    const spec = mech.bodies?.[name] || {};
    const matId = spec.material ?? mech.material ?? null;
    const material = matId != null ? resolveMaterial(matId) : null;
    // integrated in the model's units, so the centroid lives where the transforms do; volume and inertia to SI
    const mu_ = massProperties(tris, 1);
    const mp = { volume: mu_.volume * k ** 3, centroid: mu_.centroid, I: mu_.I.map((row) => row.map((v) => v * k ** 5)) };
    const fill = spec.fill ?? 1;
    let mass, from;
    if (Number.isFinite(spec.mass)) { mass = spec.mass; from = 'stated'; }
    else if (material) { mass = mp.volume * material.density * 1000 * fill; from = `${material.label} × ${fill === 1 ? 'solid' : `${Math.round(fill * 100)} % fill`}`; }
    else { mass = 0; from = 'no material — massless'; }
    // the inertia scales with the mass (a stated mass is taken as spread like the solid)
    const rho = mp.volume > 0 ? mass / mp.volume : 0;
    out[name] = { name, mass, from, material, volume: mp.volume, c0: mp.centroid, I0: mp.I.map((row) => row.map((v) => v * rho)) };
  }
  return out;
}

// ─── kinematic coefficients ───────────────────────────────────────────────────────

// d(f)/ds over the samples, one-sided where a swing turns back
function diff(arr, s, i) {
  const n = s.length;
  for (const [x, y] of [[i - 1, i + 1], [i, i + 1], [i - 1, i]]) {
    const a = Math.max(0, x), b = Math.min(n - 1, y);
    const ds = s[b] - s[a];
    if (Math.abs(ds) > 1e-12) return typeof arr[0] === 'number' ? (arr[b] - arr[a]) / ds : sub(arr[b], arr[a]).map((v) => v / ds);
  }
  return typeof arr[0] === 'number' ? 0 : [0, 0, 0];
}
// angular velocity per unit of drive from the rotation before and after
function omegaOf(Ra, Rb, ds) {
  const Q = mm3(Rb, tr3(Ra));
  const tr = Q[0][0] + Q[1][1] + Q[2][2];
  const ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (ang < 1e-12) return [0, 0, 0];
  const v = [Q[2][1] - Q[1][2], Q[0][2] - Q[2][0], Q[1][0] - Q[0][1]];
  return mul(unit(v), ang / ds);
}

// ─── the analysis ─────────────────────────────────────────────────────────────────

/**
 * The dynamics of a solved cycle. `partTris` is { <part>: [[a, b, c], …] } in the model's units (the rendered records,
 * authored pose), `scale` maps them to mm for the strength checks; `report` is mechanismReport's output. Returns the `dynamics` block of the motion report.
 */
export function analyseDynamics(solved, report, { partTris, scale = 1, build = null } = {}) {
  const { model, samples } = solved;
  const mech = model.mech;
  const names = Object.keys(partTris);
  const k = model.m;                              // model units → m
  const bodies = bodiesOf(mech, partTris, k);
  const n = samples.length;
  const sSI = samples.map((x) => (model.rev ? x.s : x.s * k));   // the drive in rad or m
  const unitE = model.rev ? 'N·m' : 'N';
  const period = mech.drive.period ?? DEFAULT_PERIOD;
  const travel = Math.abs(model.toQ(model.to) - model.toQ(model.from)) * (model.mode === 'swing' ? 2 : 1) * (model.rev ? 1 : k);
  const omega = mech.drive.speed != null ? (model.rev ? mech.drive.speed * TAU / 60 : mech.drive.speed * k) : travel / period;   // SI drive rate
  const gravityOn = mech.gravity !== false;
  const gVec = [0, 0, -G];

  // every body's world centroid, rotation and inertia at every sample
  const frames = samples.map((x) => transformsAt(model, x.q, names));
  const cw = {}, Rw = {};
  for (const b of names) { cw[b] = frames.map((f) => apply(f[b], bodies[b].c0)); Rw[b] = frames.map((f) => f[b].R); }
  const vc = {}, wv = {}, ac = {};
  for (const b of names) {
    const cm = cw[b].map((p) => mul(p, k));
    vc[b] = cm.map((_, i) => diff(cm, sSI, i));          // m per drive unit
    ac[b] = vc[b].map((_, i) => diff(vc[b], sSI, i));    // m per drive unit² (constant speed: × ω² for m/s²)
    wv[b] = samples.map((_, i) => {
      for (const [x, y] of [[i - 1, i + 1], [i, i + 1], [i - 1, i]]) {
        const a = Math.max(0, x), c = Math.min(n - 1, y); const ds = sSI[c] - sSI[a];
        if (Math.abs(ds) > 1e-12) return omegaOf(Rw[b][a], Rw[b][c], ds);
      }
      return [0, 0, 0];
    });
  }
  // J(s) per body, potential per body
  const Jb = {}, Vb = {};
  for (const b of names) {
    const B = bodies[b];
    Jb[b] = samples.map((_, i) => { const R = Rw[b][i]; const Iw = mm3(mm3(R, B.I0), tr3(R)); const w = wv[b][i]; return B.mass * dot(vc[b][i], vc[b][i]) + dot(w, mv3(Iw, w)); });
    Vb[b] = samples.map((_, i) => (gravityOn ? -B.mass * dot(gVec, mul(cw[b][i], k)) : 0));
  }
  const J = samples.map((_, i) => names.reduce((t, b) => t + Jb[b][i], 0));
  // each body's demand on the drive at constant speed: ½J′ω² + dV/ds, through its path efficiency
  const eta = pathEfficiency(model);
  const etaOf = (b) => eta[b] ?? 1;
  // which way the drive is moving at each sample (a swing comes back): efforts are torques (or forces) with a sign,
  // and the power they carry is effort × direction
  const dir = samples.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); const ds = sSI[b] - sSI[a]; return ds < -1e-12 ? -1 : 1; });
  const route = (q, b, i) => (q * dir[i] > 0 ? q / etaOf(b) : q * etaOf(b));
  const inertiaQ = samples.map((_, i) => names.reduce((t, b) => t + route(0.5 * diff(Jb[b], sSI, i) * omega * omega, b, i), 0));
  const gravityQ = samples.map((_, i) => names.reduce((t, b) => t + route(diff(Vb[b], sSI, i), b, i), 0));
  // the loads, as the kinematic report reads them (opposing the motion), per SI drive unit
  const qDeriv = (name, i) => (name === model.driveName ? 1 : diff(samples.map((x) => x.q[name] ?? 0), samples.map((x) => x.s), i));
  const loadQ = samples.map((_, i) => (mech.loads || []).reduce((t, l) => {
    const j = model.joints[l.part]; const r = qDeriv(l.part, i);
    const dq = j.type === 'revolute' ? r : r * k;                     // rad or m per drive unit
    const per = model.rev ? 1 : k;
    return t + dir[i] * Math.abs((j.type === 'revolute' ? l.torque : l.force) * dq / per) / etaOf(l.part);   // loads oppose the motion
  }, 0));

  // ── forces through the couplings and the joints (a tree only) ──
  const forces = couplingForces(model, { names, bodies, vc, ac, wv, cw, Jb, Vb, sSI, omega, gVec, gravityOn, frames, samples, qDeriv, k, eta });
  const frictionQ = (forces.friction || samples.map(() => 0)).map((f, i) => f * dir[i]);
  const total = samples.map((_, i) => inertiaQ[i] + gravityQ[i] + loadQ[i] + frictionQ[i]);

  // ── what the drive needs ──
  const at = (i) => (model.rev ? r1(samples[i].s / DEG) : r3(samples[i].s));
  const argmax = (a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
  const argmin = (a) => a.reduce((b, v, i) => (v < a[b] ? i : b), 0);
  const absT = total.map(Math.abs); const power = total.map((t, i) => t * dir[i]);
  const kP = argmax(absT), kN = argmin(power);
  const peakOf = (a) => sig(Math.max(...a.map(Math.abs)));
  const mean = total.reduce((a, b) => a + b, 0) / n;
  const effort = {
    unit: unitE, at_unit: model.rev ? '°' : model.units,
    peak: sig(absT[kP]), at_drive: at(kP), signed_at_peak: sig(total[kP]), mean: sig(mean),
    components_peak: { loads: peakOf(loadQ), inertia: peakOf(inertiaQ), gravity: peakOf(gravityQ), friction: peakOf(frictionQ) },
    peak_power_w: sig(Math.max(...power) * omega),
  };
  const rating = model.rev ? mech.drive.torque : mech.drive.force;
  // start-up: from rest to the drive speed in `spinup` seconds, the worst point of the cycle to start from
  let startup = null;
  if (Number.isFinite(mech.drive.spinup)) {
    const alpha = omega / mech.drive.spinup;
    const st = samples.map((_, i) => J[i] * alpha * dir[i] + gravityQ[i] + loadQ[i] + frictionQ[i]);
    const ks = argmax(st.map(Math.abs));
    startup = { peak: sig(Math.abs(st[ks])), at_drive: at(ks), alpha: sig(alpha), inertia_term: sig(J[ks] * alpha), unit: unitE };
  }
  const need = Math.max(absT[kP], startup ? startup.peak : 0);
  if (Number.isFinite(rating)) effort.margin = { ok: need <= rating + 1e-9, required: sig(need), rating, utilization: r3(rating > 0 ? need / rating : Infinity), includes: startup ? 'running and start-up' : 'running' };

  // speed fluctuation under a steady (mean) drive torque, and the flywheel that holds the target
  let fluctuation = null;
  if (model.mode === 'loop' && n > 3) {
    let E = 0, lo = 0, hi = 0;
    for (let i = 1; i < n; i++) { E += 0.5 * ((total[i] - mean) + (total[i - 1] - mean)) * (sSI[i] - sSI[i - 1]); lo = Math.min(lo, E); hi = Math.max(hi, E); }
    const dE = hi - lo; const Jm = J.reduce((a, b) => a + b, 0) / n;
    if (dE > 1e-12) {
      const cs = Jm > 0 ? dE / (Jm * omega * omega) : Infinity;
      const add = dE / (FLUCTUATION_TARGET * omega * omega) - Jm;
      fluctuation = { energy_j: sig(dE), coefficient: Number.isFinite(cs) ? r3(cs) : null, j_mean: sig(Jm), target: FLUCTUATION_TARGET, flywheel: add > 0 ? sig(add) : 0, unit: model.rev ? 'kg·m²' : 'kg' };
    }
  }
  // the frame's shaking force: Σ m·a of every body at the drive speed
  const shake = samples.map((_, i) => norm(names.reduce((t, b) => add(t, mul(ac[b][i], bodies[b].mass * omega * omega)), [0, 0, 0])));
  const ksh = argmax(shake);

  // ── flags a designer reads first ──
  const flags = [];
  const rpm = model.rev ? omega * 60 / TAU : null;
  if (mech.duty?.hours && model.mode === 'loop' && rpm) {
    const cycles = rpm * 60 * mech.duty.hours;
    flags.push({ kind: 'cycles', cycles: Math.round(cycles), note: `${Math.round(cycles).toLocaleString('en-US')} load cycles over ${mech.duty.hours} h at ${r1(rpm)} rpm — a fatigue question; the strength checks below are read as repeated loads, but life is not predicted` });
  }
  if (power[kN] < -1e-9 * Math.max(1, absT[kP])) {
    const neg = samples.map((_, i) => i).filter((i) => power[i] < 0);
    flags.push({ kind: 'back-driving', share: r3(neg.length / n), from: at(neg[0]), to: at(neg[neg.length - 1]), note: `for ${Math.round(100 * neg.length / n)} % of the cycle (first at ${at(neg[0])}${model.rev ? '°' : ` ${model.units}`}) the mechanism drives the motor, up to ${sig(Math.abs(total[kN]))} ${unitE}: a motor that cannot brake, or a gearbox that back-drives, lets it run ahead` });
  }
  for (const s of report.screws || []) {
    const held = (mech.loads || []).find((l) => l.part === s.b && l.sustained);
    const mat = bodies[s.b]?.material || bodies[s.a]?.material;
    if (s.self_locking && held && mat?.creep) flags.push({ kind: 'creep', part: s.b, note: `the screw self-locks, so '${s.b}' holds its ${held.force} N for as long as it is loaded — ${mat.label} creeps under a sustained load, so expect the nut thread to sag over days; a metal insert or a non-creeping material holds` });
  }
  for (const b of names) {
    const j = model.joints[b];
    if (!j || j.type !== 'revolute' || j.on || !bodies[b].mass) continue;
    const off = sub(bodies[b].c0, j.center); const e = norm(sub(off, mul(j.axis, dot(off, j.axis))));
    const wPeak = Math.max(...samples.map((_, i) => Math.abs(qDeriv(b, i)))) * omega;
    const F = bodies[b].mass * e * k * wPeak * wPeak;
    if (e > 0.05 && F > 0.01) flags.push({ kind: 'unbalance', part: b, mass_g: r1(bodies[b].mass * 1000), offset_mm: r1(e * (k / 0.001)), force_n: sig(F), note: `'${b}' turns with its centre of mass ${r1(e * (k / 0.001))} mm off its axis: ${sig(F)} N rotating out of balance at speed` });
  }
  if (mech.drive.motor) {
    const usable = MOTOR_TORQUE[mech.drive.motor] * MOTOR_USABLE;
    const ok = need <= usable;
    flags.push({ kind: 'motor', motor: mech.drive.motor, holding_nm: MOTOR_TORQUE[mech.drive.motor], usable_nm: usable, needs_nm: sig(need), ok, note: `${mech.drive.motor}: typical holding ${MOTOR_TORQUE[mech.drive.motor]} N·m, about ${sig(usable)} usable at speed; the drive needs ${sig(need)} N·m${startup ? ' (start-up included)' : ''} — ${ok ? 'within it' : 'MORE than it: expect missed steps'} (typical figures, check the motor's pull-out curve)` });
  }
  for (const pv of forces.pv || []) if (!pv.ok) flags.push({ kind: 'wear', part: pv.part, note: `'${pv.part}' runs at PV ${pv.pv} MPa·m/s on its ${pv.material} pin, above the ${pv.limit} rule of thumb — expect fast wear or softening; a bronze or polymer bushing, a bigger pin, or a ball bearing` });

  // ── strength of the parts the forces load ──
  const strength = Object.values(bodies).some((b) => b.material) ? strengthFeed(model, forces, bodies, partTris, { scale, build, rpm }) : null;

  return {
    bodies: Object.fromEntries(names.map((b) => [b, { mass_g: r1(bodies[b].mass * 1000), from: bodies[b].from, volume_cm3: r3(bodies[b].volume * 1e6), centroid: bodies[b].c0.map(r1) }])),
    total_mass_g: r1(names.reduce((t, b) => t + bodies[b].mass, 0) * 1000),
    gravity: gravityOn ? 'on (−z, 9.81 m/s²)' : 'off',
    drive_speed: model.rev ? { value: sig(omega * 60 / TAU), unit: 'rpm' } : { value: sig(omega / k), unit: `${model.units}/s` },
    effort,
    ...(startup ? { startup } : {}),
    ...(fluctuation ? { fluctuation } : {}),
    shaking: { peak_n: sig(shake[ksh]), at_drive: at(ksh) },
    forces: forces.report,
    ...(strength ? { strength } : {}),
    flags,
    assumptions: `Rigid bodies. Masses from each part's mesh × density × fill (${mech.material ? `material ${mech.material}` : 'per-body materials'}). The drive runs at a steady ${model.rev ? `${sig(omega * 60 / TAU)} rpm` : `${sig(omega / k)} ${model.units}/s`}; start-up at a constant acceleration. Friction is first order (from the frictionless joint forces), with μ pin ${model.mech.friction?.pin ?? DEFAULT_FRICTION.pin} and slide ${model.mech.friction?.slide ?? DEFAULT_FRICTION.slide} where pins are sized. A rod's mass is lumped to its two pins for its force. No deflection, natural frequencies, clearance impacts or heat.`,
  };
}

// ─── forces through a tree of couplings ───────────────────────────────────────────

function couplingForces(model, ctx) {
  const { names, bodies, vc, ac, wv, cw, Jb, Vb, sSI, omega, gVec, gravityOn, frames, samples, qDeriv, k } = ctx;
  const n = samples.length;
  const mech = model.mech;
  const mu = { ...DEFAULT_FRICTION, ...(mech.friction || {}) };
  const jointed = Object.keys(model.joints).filter((j) => model.joints[j].type !== 'fixed');
  if (Object.values(model.joints).some((j) => j.on)) return { report: { computed: false, reason: 'a part rides another (`on`): the power splits between parallel paths, which a rigid model cannot divide — the drive effort above still holds' } };
  // the tree from the drive: each coupling hands power from a parent to a child
  const edges = model.couplings.filter((c) => model.joints[c.a] && model.joints[c.b] && model.joints[c.a].type !== 'fixed' && model.joints[c.b].type !== 'fixed');
  const parentOf = { [model.driveName]: null }; const via = {}; const order = [model.driveName];
  for (let qi = 0; qi < order.length; qi++) {
    const p = order[qi];
    for (const c of edges) {
      const other = c.a === p ? c.b : c.b === p ? c.a : null;
      if (other == null || c === via[p]) continue;
      if (other in parentOf) return { report: { computed: false, reason: `the couplings form a loop through '${other}', so the force through each path depends on stiffness — the drive effort above still holds` } };
      parentOf[other] = p; via[other] = c; order.push(other);
    }
  }
  const children = (p) => order.filter((x) => parentOf[x] === p);
  const below = (x) => { const out = [x]; for (let i = 0; i < out.length; i++) out.push(...children(out[i])); return out; };
  // a rod's mass is lumped to its two pins (the two-mass model): its share at the child's pin rides the child
  const rods = model.couplings.filter((c) => c.type === 'link' && c.rod && bodies[c.rod]);
  const rodShare = {};
  for (const c of rods) {
    const B = bodies[c.rod]; const L = norm(sub(c.pb, c.pa)) || 1;
    const a = Math.max(0, Math.min(L, dot(sub(B.c0, c.pa), unit(sub(c.pb, c.pa)))));
    rodShare[c.rod] = { toB: a / L };
  }
  const bodyQ = (b, i) => 0.5 * diff(Jb[b], sSI, i) * omega * omega + diff(Vb[b], sSI, i);   // per SI drive unit
  const loadsOn = (b, i) => (mech.loads || []).filter((l) => l.part === b).reduce((t, l) => {
    const j = model.joints[l.part]; const r = qDeriv(l.part, i); const dq = j.type === 'revolute' ? r : r * k;
    return t + Math.abs((j.type === 'revolute' ? l.torque : l.force) * dq / (model.rev ? 1 : k));
  }, 0);
  // power (per SI unit of drive) the subtree under `x` draws: its bodies, its loads, and its share of rods
  const demand = (x, i) => {
    let W = 0;
    for (const b of below(x)) { W += bodyQ(b, i) + loadsOn(b, i); }
    const sub_ = below(x);
    for (const c of rods) {
      const hasA = sub_.includes(c.a), hasB = sub_.includes(c.b);
      if (hasA && hasB) W += bodyQ(c.rod, i);
      else if (hasB) W += bodyQ(c.rod, i) * rodShare[c.rod].toB;
      else if (hasA) W += bodyQ(c.rod, i) * (1 - rodShare[c.rod].toB);
    }
    return W;
  };
  const report = { computed: true, couplings: [], joints: {} };
  const onBody = Object.fromEntries(names.map((b) => [b, samples.map(() => [0, 0, 0])]));   // coupling forces on each body, N
  const torqueOn = {};   // peak torque each revolute body carries through its couplings
  const rodForce = {};
  const T = (b, i) => frames[i][b];
  const rate = (b, i) => qDeriv(b, i) * (model.joints[b]?.type === 'prismatic' ? k : 1) / (model.rev ? 1 : k);   // rad or m per SI drive unit
  for (const child of order.slice(1)) {
    const c = via[child]; const parent = parentOf[child];
    const series = [], forcesAt = []; let peak = 0, peakAt = 0;
    for (let i = 0; i < n; i++) {
      const W = demand(child, i);
      const jc = model.joints[child];
      let F = null, mag = 0;
      if (c.type === 'link') {
        const childIsB = c.b === child;
        const pin = childIsB ? c.pb : c.pa, other = childIsB ? c.pa : c.pb;
        const P = apply(T(child, i), pin), O = apply(T(parent, i), other);
        const u = unit(sub(P, O));   // from the parent's pin to the child's
        const vP = sub(apply(frames[Math.min(n - 1, i + 1)][child], pin), apply(frames[Math.max(0, i - 1)][child], pin));
        const ds = sSI[Math.min(n - 1, i + 1)] - sSI[Math.max(0, i - 1)];
        const speed = Math.abs(ds) > 1e-12 ? norm(vP) * k / Math.abs(ds) : 0;
        const proj = Math.abs(ds) > 1e-12 ? dot(u, vP) * k / ds : 0;   // m of pin travel along the rod per drive unit
        // at a dead point the pin moves square to the rod and the force is not set by the power: skip it
        if (speed > 1e-12 && Math.abs(proj) > 0.02 * speed) {
          const f = W / proj;   // + pushes the child's pin away from the parent's: the rod in compression
          F = mul(u, f); mag = f;
          onBody[child][i] = add(onBody[child][i], F); onBody[parent][i] = sub(onBody[parent][i], F);
        }
      } else if (['gear', 'belt', 'ratio', 'ring'].includes(c.type) && jc.type === 'revolute' && model.joints[parent].type === 'revolute') {
        const w = rate(child, i); const tau = Math.abs(w) > 1e-9 ? W / w : 0;   // N·m on the child
        mag = tau;
        torqueOn[child] = Math.max(torqueOn[child] || 0, Math.abs(tau));
        const tp = Math.abs(rate(parent, i)) > 1e-9 ? W / rate(parent, i) : 0;
        torqueOn[parent] = Math.max(torqueOn[parent] || 0, Math.abs(tp));
        if (c.type === 'gear') {
          const A = model.joints[parent], B = jc; const ca = apply(T(parent, i), A.center), cb = apply(T(child, i), B.center);
          const line = sub(ca, cb); const C = norm(line) * k; const zc = c.a === child ? c.teeth[0] : c.teeth[1], zp = c.a === child ? c.teeth[1] : c.teeth[0];
          const rc = C * zc / (zc + zp); const toP = unit(line);
          const tdir = unit(cross(B.axis, toP));
          const Ft = rc > 0 ? tau / rc : 0;
          F = add(mul(tdir, Ft), mul(toP, -Math.abs(Ft) * Math.tan(20 * DEG)));   // the mesh pushes the gears apart
          onBody[child][i] = add(onBody[child][i], F); onBody[parent][i] = sub(onBody[parent][i], F);
          mag = Ft;
        }
      } else if (c.type === 'rack' || c.type === 'screw') {
        const v = rate(child, i); const f = Math.abs(v) > 1e-12 ? W / v : 0;   // N along the child's axis
        F = mul(jc.axis, f); mag = f;
        onBody[child][i] = add(onBody[child][i], F);
        if (c.type === 'rack') onBody[parent][i] = sub(onBody[parent][i], F);
        const tp = Math.abs(rate(parent, i)) > 1e-9 ? W / rate(parent, i) : 0;
        torqueOn[parent] = Math.max(torqueOn[parent] || 0, Math.abs(tp));
      }
      series.push(c.type === 'link' && F == null ? null : mag);
      forcesAt.push(F);
    }
    // a link at a dead point (its pin moving square to it) takes the force between its neighbours
    if (c.type === 'link') {
      for (let i = 0; i < n; i++) {
        if (series[i] != null) continue;
        let a = i - 1; while (a >= 0 && series[a] == null) a--;
        let b = i + 1; while (b < n && series[b] == null) b++;
        const va = a >= 0 ? series[a] : null, vb = b < n ? series[b] : null;
        const v = va != null && vb != null ? va + (vb - va) * (i - a) / (b - a) : (va ?? vb ?? 0);
        series[i] = v;
        const fa = a >= 0 ? forcesAt[a] : null, fb = b < n ? forcesAt[b] : null;
        const dirU = unit(fa && fb ? add(fa, fb) : (fa || fb || [1, 0, 0]));
        const F = mul(dirU, Math.abs(v)) ; const sgnF = (fa || fb) && dot(dirU, fa || fb) * (va ?? vb ?? 1) < 0 ? -1 : 1;
        const Fi = mul(F, sgnF);
        onBody[child][i] = add(onBody[child][i], Fi); onBody[parent][i] = sub(onBody[parent][i], Fi);
      }
      rodForce[c.rod || `${c.a}-${c.b}`] = series;
    }
    for (let i = 0; i < n; i++) if (Math.abs(series[i]) > Math.abs(peak)) { peak = series[i]; peakAt = i; }
    const what = c.type === 'link' ? 'rod force' : c.type === 'gear' ? 'tooth force (tangential)' : c.type === 'rack' || c.type === 'screw' ? 'axial force' : 'torque';
    const entry = { type: c.type, from: parent, to: child, quantity: what, peak: sig(c.type === 'link' ? peak : Math.abs(peak)), unit: what === 'torque' ? 'N·m' : 'N', at_drive: model.rev ? r1(samples[peakAt].s / DEG) : r3(samples[peakAt].s) };
    if (c.type === 'link') { const cmp = Math.max(0, ...series), ten = Math.min(0, ...series); entry.compression_peak = sig(cmp); entry.tension_peak = sig(-ten); entry.rod = c.rod || null; }
    report.couplings.push(entry);
  }
  // each joint's reaction: m·a − m·g − Σ coupling forces on the body (the load torques act about the axis, no force)
  const friction = samples.map(() => 0); const pvList = [];
  for (const b of jointed) {
    const j = { ...model.joints[b], pin_r: mech.joints[b]?.pin_r, pin_len: mech.joints[b]?.pin_len }; const B = bodies[b];
    const R = samples.map((_, i) => {
      const inertia = mul(ac[b][i], B.mass * omega * omega);
      const weight = gravityOn ? mul(gVec, B.mass) : [0, 0, 0];
      let r = sub(sub(inertia, weight), onBody[b][i]);
      // a rod's lumped pin mass at this body's pin moves with the pin, and the joint carries it too
      for (const c of rods) {
        if (c.a !== b && c.b !== b) continue;
        const share = c.b === b ? rodShare[c.rod].toB : 1 - rodShare[c.rod].toB;
        r = add(r, mul(gravityOn ? mul(gVec, -1) : [0, 0, 0], bodies[c.rod].mass * share));
      }
      return r;
    });
    let radial, axial;
    if (j.type === 'revolute') {
      radial = R.map((r) => norm(sub(r, mul(j.axis, dot(r, j.axis))))); axial = R.map((r) => Math.abs(dot(r, j.axis)));
    } else {
      radial = R.map((r) => norm(sub(r, mul(j.axis, dot(r, j.axis))))); axial = R.map(() => 0);
    }
    let ki = 0; for (let i = 1; i < n; i++) if (radial[i] > radial[ki]) ki = i;
    const entry = { type: j.type, [j.type === 'revolute' ? 'radial_peak_n' : 'normal_peak_n']: sig(radial[ki]), at_drive: model.rev ? r1(samples[ki].s / DEG) : r3(samples[ki].s) };
    if (j.type === 'revolute') entry.thrust_peak_n = sig(Math.max(...axial));
    // friction: a sized pin against μ·R·r; a slide against μ·N
    if (j.type === 'revolute' && Number.isFinite(j.pin_r)) {
      const rm = j.pin_r * k;
      for (let i = 0; i < n; i++) friction[i] += mu.pin * radial[i] * rm * Math.abs(rate(b, i)) / ((ctx.eta?.[b]) || 1);
      entry.friction_torque_peak_nm = sig(mu.pin * radial[ki] * rm);
      if (Number.isFinite(j.pin_len) && B.material) {
        const limit = PV_LIMIT[B.material.id];
        const wPeak = Math.max(...samples.map((_, i) => Math.abs(rate(b, i)))) * omega;
        const pv = Math.max(...samples.map((_, i) => radial[i] / (2 * j.pin_r * j.pin_len) * Math.abs(rate(b, i)) * omega * rm));
        entry.pv = { value: r3(pv), unit: 'MPa·m/s', ...(limit ? { limit, ok: pv <= limit } : { limit: null }), sliding_m_s: r3(wPeak * rm) };
        if (limit) pvList.push({ part: b, pv: r3(pv), limit, ok: pv <= limit, material: B.material.label });
      }
    } else if (j.type === 'prismatic' && mech.friction) {
      for (let i = 0; i < n; i++) friction[i] += mu.slide * radial[i] * Math.abs(rate(b, i));
      entry.friction_peak_n = sig(mu.slide * radial[ki]);
    }
    report.joints[b] = entry;
  }
  // the rods' own pins: the rod force through μ·r at each end, at the relative turn
  for (const c of rods) {
    if (!Number.isFinite(c.pin_r)) continue;
    const rm = c.pin_r * k; const f = rodForce[c.rod] || [];
    const ang = samples.map((_, i) => frames[i][c.rod].R);
    for (let i = 0; i < n; i++) {
      const wr = (() => { const a = Math.max(0, i - 1), b2 = Math.min(n - 1, i + 1); const ds = sSI[b2] - sSI[a]; return Math.abs(ds) > 1e-12 ? norm(omegaOf(ang[a], ang[b2], ds)) : 0; })();
      const wa = model.joints[c.a]?.type === 'revolute' ? Math.abs(rate(c.a, i)) : 0, wb = model.joints[c.b]?.type === 'revolute' ? Math.abs(rate(c.b, i)) : 0;
      friction[i] += mu.pin * Math.abs(f[i] || 0) * rm * (Math.abs(wr - wa) + Math.abs(wr - wb));
    }
  }
  report.torque_peak = Object.fromEntries(Object.entries(torqueOn).map(([b, t]) => [b, sig(t)]));
  return { report, friction, pv: pvList, torqueOn, rodForce };
}

// ─── strength of what the forces load ─────────────────────────────────────────────

// one part's own triangles as the mm soup the sensor slices (a rod's sections must not cut the frame beside it)
function partSoup(tris, scale) {
  const out = new Float32Array(tris.length * 9); let o = 0;
  for (const t of tris) for (const p of t) { out[o++] = p[0] * scale; out[o++] = p[1] * scale; out[o++] = p[2] * scale; }
  return out;
}

function strengthFeed(model, forces, bodies, partTris, { scale, build, rpm }) {
  if (!forces.report.computed) return { computed: false, reason: forces.report.reason };
  const kind = model.mode === 'loop' ? 'repeated' : 'static';
  const checks = [];
  for (const c of model.couplings) {
    if (c.type === 'link' && c.rod && bodies[c.rod]?.material) {
      const f = forces.rodForce[c.rod] || [];
      const comp = Math.max(0, ...f.filter(Number.isFinite));
      if (comp > 1e-6) checks.push({ part: c.rod, material: bodies[c.rod].material.id, check: { element: 'strut', label: `rod '${c.rod}'`, from: c.pa, to: c.pb, force: comp, ends: 'pinned', kind, certainty: 'estimated' } });
    }
    if (c.type === 'gear') {
      const A = model.joints[c.a], B = model.joints[c.b];
      const C = norm(sub(A.center, B.center)); const mod = 2 * C / (c.teeth[0] + c.teeth[1]);
      for (const [part, z] of [[c.a, c.teeth[0]], [c.b, c.teeth[1]]]) {
        const tau = forces.torqueOn[part]; const mat = bodies[part]?.material;
        if (!mat || !(tau > 0)) continue;
        const tris = partTris[part]; let lo = Infinity, hi = -Infinity;
        for (const t of tris) for (const p of t) { const h = dot(p, model.joints[part].axis); lo = Math.min(lo, h); hi = Math.max(hi, h); }
        const wr = model.joints[part] ? Math.abs(model.joints[part].type === 'revolute' ? 1 : 0) : 0;
        checks.push({ part, material: mat.id, check: { element: 'gear', label: `gear '${part}' (z${z})`, module: Math.round(mod * 1000) / 1000, teeth: z, face: Math.round((hi - lo) * 100) / 100, torque: tau, ...(rpm && wr ? { rpm: Math.round(rpm * Math.abs(z === c.teeth[0] ? 1 : c.teeth[0] / c.teeth[1])) } : {}), axis: model.joints[part].axis, at: model.joints[part].center, kind, certainty: 'estimated' } });
      }
    }
  }
  if (!checks.length) return { computed: true, readings: [], line: 'Nothing to check: give the rods and gears a material (mechanism.material or bodies.<part>.material).' };
  const readings = checks.map(({ part, material, check }) => {
    const r = strengthReading(partSoup(partTris[part], scale), { material, ...(build ? { build } : {}), checks: [check], show: false }, { scale });
    return { part, ...r.readings[0] };
  });
  const ok = readings.filter((r) => !r.error);
  const worst = ok.length ? ok.reduce((a, b) => (b.margin.utilization > a.margin.utilization ? b : a)) : null;
  return {
    computed: true,
    readings: readings.map((r) => ({ part: r.part, element: r.element, label: r.label, ...(r.error ? { error: r.error } : { sf: r.margin.sf, required_sf: r.confidence.required_sf, verdict: r.verdict, confidence: r.confidence.grade, line: r.line }) })),
    ...(worst ? { worst: { part: worst.part, label: worst.label, sf: worst.margin.sf, verdict: worst.verdict, confidence: worst.confidence.grade } } : {}),
    line: worst ? `Weakest under the cycle's peak loads: ${worst.line}` : 'No strength check could run — see each reading\'s error.',
    sensor: 'Loads from the rigid-body cycle at their peaks; strength by the rigidity sensor (a reading, not a guarantee).',
  };
}

export { screwEfficiency };
