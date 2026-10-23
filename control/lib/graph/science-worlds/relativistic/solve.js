/**
 * solveRelativistic — a relativistic science world's model, run and examined. One SYSTEM per world, always with the
 * spacetime of one mass:
 *
 *   { system: 'light',  laws: [schwarzschild, observer, disk?] }
 *   { system: 'orbit',  laws: [schwarzschild, body …], duration }
 *   { system: 'clocks', laws: [schwarzschild, clock …], duration }
 *
 * plus `observe?`. A length may be SI (`'300 km'`) or in Schwarzschild radii (`'20 Rs'`); a speed below c
 * (`'0.2 c'`). What is checked is the mathematics: the geodesic laws against their closed forms (the shadow's edge,
 * the bending of light, the perihelion advance, the fall to the horizon, the innermost stable orbit), the drawn
 * light scheme against the fine one, what each body was predicted to do against what it did. Pure; deterministic.
 */

import { splitParams, quantity } from '../contract.js';
import { gapFor } from '../scales.js';
import { RELATIVISTIC_LAWS, RELATIVISTIC_LAW, SYSTEMS, C, rsOf } from './laws.js';
import {
  B_CRIT, ISCO, PHOTON_SPHERE, LIGHT_SCHEME, shadowEdge, exactDeflection, tracedDeflection, traceRay, shadowAngle,
  bodyStart, runBody, predictOrbit, exactAdvance, weakAdvance, iscoFromLaw, clockRate, runFall, closedFallTime,
} from './geodesic.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const gate = (id, want, ok, value, detail) => ({ id, want, ok: !!ok, value, detail });
export const SAMPLES = 240;
export const MAX_BODIES = 8;
export const STANCE = 'Faithful to the model, claiming nothing beyond it: the geodesics are exact for one non-rotating mass, and what is drawn of them is a picture.';

const RS_UNIT = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*Rs\s*$/i;

/** A length in metres or Schwarzschild radii, as Rs. */
function lengthRs(v, rs, where) {
  if (typeof v === 'string' && RS_UNIT.test(v)) return +v.match(RS_UNIT)[1];
  return quantity(v, 'length', where) / rs;
}

function lawsFor(model, system) {
  if (!Array.isArray(model.laws)) fail('model.laws', "wants [{ law: '<id>', … }]");
  const known = RELATIVISTIC_LAWS.filter((r) => r.system === system || r.system === '*').map((r) => r.id);
  const rows = [], gaps = [];
  model.laws.forEach((raw, i) => {
    const where = `model.laws[${i}]`;
    if (!isObj(raw) || typeof raw.law !== 'string') fail(where, "wants { law: '<id>', … }");
    const row = RELATIVISTIC_LAW[raw.law];
    if (!row) { gaps.push(gapFor(raw.law, 'relativistic', known)); return; }
    if (row.system !== '*' && row.system !== system) fail(where, `'${row.id}' belongs to the ${row.system} system; this world is a ${system} (one system per world)`);
    const allowed = new Set(['law', ...Object.keys(row.params)]);
    const extra = Object.keys(raw).filter((k) => !allowed.has(k));
    if (extra.length) fail(where, `'${row.id}' has no '${extra[0]}' (it takes ${[...allowed].filter((k) => k !== 'law').join(', ')})`);
    for (const [name, spec] of Object.entries(row.params)) if (spec.required && raw[name] === undefined) fail(`${where}.${name}`, `'${row.id}' needs ${name}`);
    rows.push({ row, raw, where });
  });
  return { rows, gaps };
}

/** The params a relativistic world's mint takes, normalized; every unknown law named as a gap. */
export function normalizeRelativistic(params) {
  const { model, dress, liberties } = splitParams(params);
  if (!SYSTEMS.includes(model.system)) fail('model.system', `is one of ${SYSTEMS.join(', ')} (one system per world)`);
  const system = model.system;
  const allowed = { light: [], orbit: ['duration'], clocks: ['duration'] }[system];
  const extra = Object.keys(model).filter((k) => !['system', 'laws', 'observe', ...allowed].includes(k));
  if (extra.length) fail('model', `unknown field '${extra[0]}' for a ${system} world`);
  const { rows, gaps } = lawsFor(model, system);
  const spacetime = rows.filter((r) => r.row.id === 'schwarzschild');
  if (spacetime.length !== 1) fail('model.laws', "a relativistic world has exactly one [{ law: 'schwarzschild', mass }]");
  const mass = quantity(spacetime[0].raw.mass, 'mass', `${spacetime[0].where}.mass`);
  if (!(mass > 0)) fail(`${spacetime[0].where}.mass`, 'is a mass above zero');
  const rs = rsOf(mass);
  const out = { system, mass, rs, tUnit: rs / C, observe: Array.isArray(model.observe) ? model.observe : [], laws: rows.map((r) => ({ law: r.row.id, ...r.raw, law_: undefined })).map(({ law_, ...e }) => e), rowIds: rows.map((r) => r.row.id) };
  const of = (id) => rows.filter((r) => r.row.id === id);
  if (system === 'light') {
    const obs = of('observer');
    if (obs.length !== 1) fail('model.laws', "a light world has one observer: [{ law: 'observer', distance, inclination? }]");
    const o = obs[0];
    out.distance = lengthRs(o.raw.distance, rs, `${o.where}.distance`);
    if (!(out.distance >= 3)) fail(`${o.where}.distance`, 'is at least 3 Rs (an observer held still nearer than that is not in the table)');
    if (out.distance > 1000) fail(`${o.where}.distance`, 'is at most 1000 Rs (farther, the shadow is too small to draw: compose it nearer)');
    out.inclination = o.raw.inclination === undefined ? 1.2 : quantity(o.raw.inclination, 'scalar', `${o.where}.inclination`);
    if (!(out.inclination >= 0 && out.inclination <= Math.PI)) fail(`${o.where}.inclination`, 'is an angle from 0° (face-on) to 180°');
    const disks = of('disk');
    if (disks.length > 1) fail('model.laws', 'a light world has at most one disk');
    if (disks.length) {
      const d = disks[0];
      out.disk = {
        inner: d.raw.inner === undefined ? ISCO : lengthRs(d.raw.inner, rs, `${d.where}.inner`),
        outer: lengthRs(d.raw.outer, rs, `${d.where}.outer`),
      };
      if (out.disk.inner < ISCO - 1e-9) fail(`${d.where}.inner`, 'is at or outside the innermost stable orbit, 3 Rs (inside it no gas circles: it falls)');
      if (!(out.disk.outer > out.disk.inner)) fail(`${d.where}.outer`, 'is beyond the inner edge');
      if (out.disk.outer > 0.9 * out.distance) fail(`${d.where}.outer`, 'stays inside the observer\'s distance');
    }
  } else {
    out.duration = quantity(model.duration, 'time', 'model.duration');
    if (!(out.duration > 0)) fail('model.duration', 'is a time above zero');
    out.T = out.duration / out.tUnit;
    if (system === 'orbit') {
      const bodies = of('body');
      if (!bodies.length || bodies.length > MAX_BODIES) fail('model.laws', `an orbit world has one to ${MAX_BODIES} [{ law: 'body', id, at, v }]`);
      const ids = new Set();
      out.bodies = bodies.map(({ raw, where }) => {
        if (typeof raw.id !== 'string' || !/^[A-Za-z][\w-]{0,31}$/.test(raw.id)) fail(`${where}.id`, 'is a short name');
        if (ids.has(raw.id)) fail(`${where}.id`, `'${raw.id}' is taken`);
        ids.add(raw.id);
        if (!Array.isArray(raw.at) || raw.at.length !== 3) fail(`${where}.at`, 'wants [x, y, z]');
        if (!Array.isArray(raw.v) || raw.v.length !== 3) fail(`${where}.v`, 'wants [x, y, z]');
        const at = raw.at.map((c, k) => lengthRs(c, rs, `${where}.at[${k}]`));
        const w = raw.v.map((c, k) => quantity(c, 'velocity', `${where}.v[${k}]`) / C);
        const r = Math.hypot(...at);
        if (!(r > 1.05)) fail(`${where}.at`, 'is outside the horizon (beyond 1.05 Rs)');
        if (!(Math.hypot(...w) < 1)) fail(`${where}.v`, 'is below the speed of light');
        return { id: raw.id, at, w };
      });
    } else {
      const clocks = of('clock');
      if (!clocks.length || clocks.length > MAX_BODIES) fail('model.laws', `a clocks world has one to ${MAX_BODIES} [{ law: 'clock', at, falls? }]`);
      out.clocks = clocks.map(({ raw, where }, i) => {
        const at = lengthRs(raw.at, rs, `${where}.at`);
        if (!(at > 1.01)) fail(`${where}.at`, 'is outside the horizon: inside it nothing can be held still');
        if (raw.falls !== undefined && typeof raw.falls !== 'boolean') fail(`${where}.falls`, 'is true or false');
        return { id: `clock-${i + 1}`, at, falls: !!raw.falls };
      });
    }
  }
  return { model: out, gaps, dress: dress ?? null, liberties };
}

// ── light ──
function solveLight(m) {
  const gates = [];
  const fineEdge = shadowEdge({ k: 0.002 });
  gates.push(gate('closed-form:shadow', 'light with an impact parameter below 3√3/2 Rs is captured: the shadow\'s edge', Math.abs(fineEdge - B_CRIT) / B_CRIT <= 1e-4,
    { expected: { edge: sig(B_CRIT, 6) }, measured: { edge: sig(fineEdge, 6) }, error: sig(Math.abs(fineEdge - B_CRIT) / B_CRIT, 3) }, 'in Rs, by bisection on rays from far away'));
  const bTest = 10, exact = exactDeflection(bTest), traced = tracedDeflection(bTest);
  gates.push(gate('closed-form:deflection', 'light passing at 10 Rs bends by the angle the exact orbit integral gives', Math.abs(traced - exact) / exact <= 1e-4,
    { expected: { angle: sig(exact, 6) }, measured: { angle: sig(traced, 6) }, error: sig(Math.abs(traced - exact) / exact, 3) }, `radians (the weak-field 2Rs/b says ${sig(2 / bTest, 4)})`));
  const drawnEdge = shadowEdge({ k: LIGHT_SCHEME.k });
  const drawnBend = tracedDeflection(bTest, { k: LIGHT_SCHEME.k });
  const errDrawn = Math.max(Math.abs(drawnEdge - B_CRIT) / B_CRIT, Math.abs(drawnBend - exact) / exact);
  gates.push(gate('scheme-resolves', 'the step the picture is traced with resolves the shadow and the bending to half a percent', errDrawn <= 5e-3,
    { edge: sig(drawnEdge, 5), angle: sig(drawnBend, 5), error: sig(errDrawn, 3) }, 'the drawn scheme against the closed forms'));
  // what the eye sees: a coarse grid of the observer's rays, traced as the shader traces them
  const D = m.distance, eye = [D * Math.sin(m.inclination), 0, D * Math.cos(m.inclination)];
  const alpha = shadowAngle(D);
  let gMin = Infinity, gMax = 0, captured = 0, n = 0;
  if (m.disk) {
    const f = [-eye[0] / D, 0, -eye[2] / D], up = [0, 0, 1], r = (() => { const c = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]; const l = Math.hypot(...c) || 1; return c.map((q) => q / l); })();
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const span = Math.atan((1.2 * m.disk.outer) / D);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
      const a = span * ((i + 0.5) / 12 - 1), b = span * ((j + 0.5) / 12 - 1);
      const d = [0, 1, 2].map((k) => f[k] + Math.tan(a) * r[k] + Math.tan(b) * u[k]);
      const l = Math.hypot(...d);
      const t = traceRay(eye, d.map((q) => q / l), { inner: m.disk.inner, outer: m.disk.outer });
      n++;
      if (t.fate === 'captured') captured++;
      for (const h of t.hits.slice(0, 1)) { gMin = Math.min(gMin, h.g); gMax = Math.max(gMax, h.g); }
    }
  }
  const observed = {
    'schwarzschild radius': { value: sig(m.rs, 5), unit: 'm' },
    'shadow, as the observer sees it': { value: sig((alpha * 180) / Math.PI, 5), unit: '°', 'edge impact parameter': `${sig(B_CRIT, 5)} Rs` },
    'photon sphere': { value: sig(PHOTON_SPHERE * m.rs, 5), unit: 'm' },
    'innermost stable orbit': { value: sig(ISCO * m.rs, 5), unit: 'm' },
    ...(m.disk ? { 'disk light shift g': { min: sig(gMin, 4), max: sig(gMax, 4), 'sampled rays': n } } : {}),
  };
  return { gates, observed, eye, alpha, gRange: m.disk ? [gMin, gMax] : null, warnings: [] };
}

// ── orbit ──
function solveOrbit(m) {
  const gates = [], observed = {}, runs = [];
  for (const b of m.bodies) {
    const s0 = bodyStart(b.at, b.w);
    const predicted = predictOrbit(s0);
    const run = runBody(s0, { tEnd: m.T, samples: SAMPLES });
    runs.push({ id: b.id, start: s0, predicted, run });
    // E and L along the run, from the state (the law conserves both)
    let eWorst = 0, lWorst = 0;
    const E0 = s0.E, L0 = s0.L;
    const end = run.end, r = Math.hypot(...end.x);
    const rdot = (end.x[0] * end.u[0] + end.x[1] * end.u[1] + end.x[2] * end.u[2]) / r;
    const Lc = Math.hypot(end.x[1] * end.u[2] - end.x[2] * end.u[1], end.x[2] * end.u[0] - end.x[0] * end.u[2], end.x[0] * end.u[1] - end.x[1] * end.u[0]);
    const Ee = Math.sqrt(rdot * rdot + (1 - 1 / r) * (1 + (Lc * Lc) / (r * r)));
    eWorst = Math.abs(Ee - E0) / E0; lWorst = Math.abs(Lc - L0) / Math.max(L0, 1e-12);
    if (run.fate !== 'plunged') {
      gates.push(gate(`energy-held:${b.id}`, `${b.id}'s energy and angular momentum stay as they began (both are conserved on a geodesic)`, eWorst <= 1e-8 && lWorst <= 1e-8,
        { energy: sig(eWorst, 3), momentum: sig(lWorst, 3) }, 'the relative drift at the end of the run'));
    }
    const runKind = { plunged: 'plunge', escaped: 'escape', escaping: 'escape', bound: predicted.kind === 'circular' ? 'circular' : 'bound', unfinished: 'unfinished' }[run.fate];
    gates.push(gate(`closed-form:fate:${b.id}`, `${b.id} does what its effective potential says: ${predicted.kind}`, runKind === predicted.kind || (predicted.kind === 'plunge' && runKind === 'bound' && run.fate === 'bound' && run.r[run.r.length - 1] < run.r[0]),
      { expected: { fate: predicted.kind }, measured: { fate: runKind } }, 'turning points from the conserved energy and angular momentum'));
    const o = { fate: runKind, 'proper time': { value: sig(run.tau[run.tau.length - 1] * m.tUnit, 5), unit: 's' } };
    if (predicted.kind === 'bound') {
      const exact = exactAdvance(predicted.u1, predicted.u2), weak = weakAdvance(predicted.rPeri, predicted.rApo);
      o.periapsis = { value: sig(predicted.rPeri * m.rs, 5), unit: 'm' };
      o.apoapsis = { value: sig(predicted.rApo * m.rs, 5), unit: 'm' };
      o['advance per orbit'] = { exact: sig((exact * 180) / Math.PI, 5), 'weak field': sig((weak * 180) / Math.PI, 5), unit: '°' };
      const adv = run.peri.slice(1).map((q, i) => q.phi - run.peri[i].phi - 2 * Math.PI);
      if (adv.length) {
        const mean = adv.reduce((a, x) => a + x, 0) / adv.length, err = Math.abs(mean - exact) / Math.max(exact, 1e-12);
        o['advance per orbit'].measured = sig((mean * 180) / Math.PI, 5);
        const lap = (run.peri[run.peri.length - 1].t - run.peri[0].t) / adv.length * m.tUnit;   // seconds of far time per lap
        o['advance per century'] = { value: sig(((exact * 180 * 3600) / Math.PI) * ((100 * 365.25 * 86400) / lap), 5), unit: '″' };
        gates.push(gate(`closed-form:advance:${b.id}`, `${b.id}'s orbit turns each lap by the exact perihelion advance`, err <= 1e-3 || Math.abs(mean - exact) <= 1e-6,
          { expected: { advance: sig(exact, 6) }, measured: { advance: sig(mean, 6) }, error: sig(err, 3) }, `radians per orbit, over ${adv.length} laps`));
      } else o['advance per orbit'].note = 'the run is shorter than two laps: lengthen the duration to measure it';
    }
    if (predicted.kind === 'bound' && predicted.rPeri > 1e4) o.regime = 'weak field: Newton alone gives this ellipse; relativity adds only its slow turn';
    observed[b.id] = o;
  }
  const isco = iscoFromLaw();
  gates.push(gate('closed-form:isco', 'no circular orbit is stable inside 3 Rs (6GM/c²)', Math.abs(isco - ISCO) <= 1e-6, { expected: { radius: ISCO }, measured: { radius: sig(isco, 7) } }, 'read off the matter law\'s effective potential'));
  return { gates, observed, runs, warnings: [] };
}

// ── clocks ──
function solveClocks(m) {
  const gates = [], observed = {}, clocks = [];
  const t = Array.from({ length: SAMPLES + 1 }, (_, i) => (i * m.T) / SAMPLES);
  for (const c of m.clocks) {
    if (!c.falls) {
      const rate = clockRate(c.at);
      clocks.push({ ...c, rate, tau: t.map((x) => rate * x), r: t.map(() => c.at) });
      observed[c.id] = { at: { value: sig(c.at * m.rs, 6), unit: 'm' }, rate: sig(rate, 12), 'slower than a far clock, per day': { value: sig((1 - rate) * 86400, 5), unit: 's' } };
      continue;
    }
    const f = runFall(c.at, { tEnd: m.T, samples: SAMPLES });
    clocks.push({ ...c, tau: f.tau, r: f.r, fall: f });
    if (f.reached) {
      const want = closedFallTime(c.at, f.stop.r), err = Math.abs(f.stop.tau - want) / want;
      gates.push(gate(`closed-form:fall:${c.id}`, `the falling clock's own time to the horizon is the cycloid's, (r₀^{3/2}/2)(η + sin η) Rs/c`, err <= 1e-6,
        { expected: { tau: sig(want * m.tUnit, 6) }, measured: { tau: sig(f.stop.tau * m.tUnit, 6) }, error: sig(err, 3) }, 'seconds of its own time, to just outside the horizon'));
    }
    observed[c.id] = { from: { value: sig(c.at * m.rs, 6), unit: 'm' }, 'own time at the end': { value: sig(f.tau[f.tau.length - 1] * m.tUnit, 6), unit: 's' }, ...(f.reached ? { 'own time to the horizon': { value: sig(closedFallTime(c.at, 1) * m.tUnit, 6), unit: 's' }, note: 'a far clock never sees it cross' } : {}) };
  }
  // two still clocks: how far apart their days drift (the GPS figure, for the Earth)
  const still = clocks.filter((c) => !c.falls);
  if (still.length >= 2) {
    const [a, b] = [still[0], still[still.length - 1]];
    observed['between the first and last still clocks, per day'] = { value: sig(Math.abs(a.rate - b.rate) * 86400, 5), unit: 's' };
  }
  return { gates, observed, clocks, t, warnings: [] };
}

/** Solve a relativistic world: the normalized model, its run, the readouts, the gates, the gaps and the sources. */
export function solveRelativistic(params) {
  const { model, gaps, dress, liberties } = normalizeRelativistic(params);
  const run = model.system === 'light' ? solveLight(model) : model.system === 'orbit' ? solveOrbit(model) : solveClocks(model);
  const rows = [...new Set(model.rowIds)].map((id) => RELATIVISTIC_LAW[id]);
  const assumptions = [STANCE, ...new Set(rows.map((r) => r.assumption))];
  const sources = [...new Set(rows.flatMap((r) => r.sources))];
  const reviewed = rows.map((r) => r.reviewed).sort()[0] ?? null;
  const { rowIds, ...shown } = model;
  return {
    scale: 'relativistic', system: model.system,
    model: shown, dress, liberties, assumptions, sources, reviewed, gaps, warnings: run.warnings,
    run, observed: run.observed,
    gates: run.gates, held: run.gates.every((g) => g.ok),
    stats: { system: model.system, laws: model.laws.length, rs: sig(model.rs, 6), ...(model.T ? { duration: sig(model.T, 6) } : {}) },
  };
}

export function relativisticStats(r) { return { ...r.stats, held: r.held }; }
