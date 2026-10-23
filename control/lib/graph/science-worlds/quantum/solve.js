/**
 * solveQuantum — a quantum science world's model, run and examined. One SYSTEM per world:
 *
 *   { system: 'line',  line: { length, points?, particle? }, laws: [well | harmonic | barrier | step …],
 *     state: { packet: { at, width, energy?, direction? } } | { superpose: [{ n, weight?, phase? }] }, duration }
 *   { system: 'plane', plane: { size, points?, particle? }, laws: [{ law: 'slits', … }]?,
 *     state: { packet: { at, width, energy } }, duration, detections? }
 *   { system: 'atom',  laws: [{ law: 'hydrogen' }], state: { orbitals: [{ n, l, m }] }, samples? }
 *   { system: 'spin',  laws: [stern-gerlach …], state: { along: 'x' | { theta, phi } }, atoms? }
 *   { system: 'decay', laws: [{ law: 'decay', half_life }], state: { nuclei }, duration }
 *
 * plus `observe?`, `seed?`. The stance: faithful to the model, claiming nothing about reality. What is checked is
 * the mathematics (the norm and the energy held, levels and transmission against their formulas, a cloud against
 * |ψ|², outcomes against their odds); what is drawn of it is a picture, and the page says so. Pure; seeded.
 */

import { splitParams, quantity, positive } from '../contract.js';
import { gapFor } from '../scales.js';
import { QUANTUM_LAWS, QUANTUM_LAW, SYSTEMS, ELECTRON_MASS, RYDBERG_EV } from './laws.js';
import { grid, hamiltonian, eigen, stepper, measure, barrierT, stepT, HBAR_EVFS, HB2M_E } from './line.js';
import { radialTable, radialNodes, sampleCloud, orbitalName, MAX_N } from './atom.js';
import { direction, runSpin, spinExpectation, runDecay } from './counting.js';
import { runPlane, farField, thinScreen, fringeSpacing, halfWidth, detections as drawDetections, wallLeak, slitCentres } from './plane.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const gate = (id, want, ok, value, detail) => ({ id, want, ok: !!ok, value, detail });
const NM = 1e-9, FS = 1e-15, EVJ = 1.602176634e-19;
const PARTICLES = { electron: ELECTRON_MASS, proton: 1.67262192369e-27, neutron: 1.67492749804e-27 };
export const SAMPLES = 240;
export const MAX_STEPS = 40000;

export const STANCE = 'Faithful to the model, claiming nothing about reality: the mathematics of each row is exact, and what is drawn of it is a picture.';

function lawsFor(model, system) {
  if (!Array.isArray(model.laws)) fail('model.laws', "wants [{ law: '<id>', … }]");
  const laws = [], gaps = [];
  const known = QUANTUM_LAWS.filter((r) => r.system === system).map((r) => r.id);
  model.laws.forEach((raw, i) => {
    const where = `model.laws[${i}]`;
    if (!isObj(raw) || typeof raw.law !== 'string') fail(where, "wants { law: '<id>', … }");
    const row = QUANTUM_LAW[raw.law];
    if (!row) { gaps.push(gapFor(raw.law, 'quantum', known)); return; }
    if (row.system !== system) fail(where, `'${row.id}' belongs to the ${row.system} system; this world is a ${system} (one system per world)`);
    const allowed = new Set(['law', ...Object.keys(row.params)]);
    const extra = Object.keys(raw).filter((k) => !allowed.has(k));
    if (extra.length) fail(where, `'${row.id}' has no '${extra[0]}' (it takes ${[...allowed].filter((k) => k !== 'law').join(', ') || 'nothing'})`);
    const entry = { law: row.id };
    for (const [name, spec] of Object.entries(row.params)) {
      const v = raw[name];
      if (v === undefined) { if (spec.required) fail(`${where}.${name}`, `'${row.id}' needs ${name}`); continue; }
      if (spec.dim === 'axis') {
        const n = typeof v === 'string' ? direction(v) : direction({ theta: quantity(v, 'scalar', `${where}.${name}`), phi: 0 });
        if (!n) fail(`${where}.${name}`, "is 'x', 'y', 'z' (or '-z' …), or an angle from z toward x");
        entry[name] = typeof v === 'string' ? v : n;
      } else if (spec.dim === 'count') {
        if (!Number.isInteger(v) || v < 1 || v > 6) fail(`${where}.${name}`, 'is a whole number of slits, 1 to 6');
        entry[name] = v;
      } else if (spec.dim === 'keep') {
        if (!['up', 'down', 'both'].includes(v)) fail(`${where}.${name}`, "is 'up', 'down' or 'both'");
        entry[name] = v;
      } else entry[name] = quantity(v, spec.dim, `${where}.${name}`);
    }
    laws.push({ row, entry });
  });
  return { laws, gaps };
}

/** The params a quantum world's mint takes, normalized; every unknown law named as a gap. */
export function normalizeQuantum(params) {
  const { model, dress, liberties } = splitParams(params);
  if (!SYSTEMS.includes(model.system)) fail('model.system', `is one of ${SYSTEMS.join(', ')} (one system per world)`);
  const system = model.system;
  const allowed = { line: ['line', 'duration', 'dt'], plane: ['plane', 'duration', 'detections'], atom: ['samples'], spin: ['atoms'], decay: ['duration'] }[system];
  const extra = Object.keys(model).filter((k) => !['system', 'laws', 'state', 'observe', 'seed', ...allowed].includes(k));
  if (extra.length) fail('model', `unknown field '${extra[0]}' for a ${system} world`);
  const { laws, gaps } = lawsFor(model, system);
  const seed = model.seed === undefined ? 1 : model.seed;
  if (!Number.isInteger(seed) || seed < 0) fail('model.seed', 'is a whole number ≥ 0');
  if (!isObj(model.state)) fail('model.state', `wants the ${system} world's starting state (see the card)`);
  const out = { system, laws, seed, observe: Array.isArray(model.observe) ? model.observe : [] };
  if (system === 'line') {
    const ln = model.line;
    if (!isObj(ln)) fail('model.line', 'wants { length, points?, particle? }');
    out.length = positive(ln.length, 'length', 'model.line.length') / NM;
    out.points = ln.points === undefined ? 1024 : ln.points;
    if (!Number.isInteger(out.points) || out.points < 128 || out.points > 4096) fail('model.line.points', 'is a whole number from 128 to 4096');
    const p = ln.particle ?? 'electron';
    out.mass = typeof p === 'string' ? PARTICLES[p] : isObj(p) ? positive(p.mass, 'mass', 'model.line.particle.mass') : undefined;
    if (!out.mass) fail('model.line.particle', `is ${Object.keys(PARTICLES).join(', ')} or { mass }`);
    out.particle = typeof p === 'string' ? p : 'particle';
    out.duration = positive(model.duration, 'time', 'model.duration') / FS;
    out.dt = model.dt === undefined ? undefined : positive(model.dt, 'time', 'model.dt') / FS;
    // line rows into internal units (nm, eV)
    for (const { entry } of laws) for (const k of ['width', 'center', 'at']) if (entry[k] !== undefined) entry[k] /= NM;
    for (const { entry } of laws) for (const k of ['height', 'energy']) if (entry[k] !== undefined) entry[k] /= EVJ;
    const st = model.state;
    if (st.packet !== undefined) {
      const pk = st.packet;
      if (!isObj(pk)) fail('model.state.packet', 'wants { at, width, energy?, direction? }');
      const at = quantity(pk.at ?? 0, 'length', 'model.state.packet.at') / NM, width = positive(pk.width, 'length', 'model.state.packet.width') / NM;
      const energy = pk.energy === undefined ? 0 : positive(pk.energy, 'work', 'model.state.packet.energy', { zero: true }) / EVJ;
      if (pk.direction !== undefined && !['right', 'left'].includes(pk.direction)) fail('model.state.packet.direction', "is 'right' or 'left'");
      out.state = { packet: { at, width, energy, dir: pk.direction === 'left' ? -1 : 1 } };
    } else if (Array.isArray(st.superpose) && st.superpose.length) {
      out.state = { superpose: st.superpose.map((c, i) => {
        if (!isObj(c) || !Number.isInteger(c.n) || c.n < 1 || c.n > 20) fail(`model.state.superpose[${i}].n`, 'is a level, 1 to 20 (1 is the lowest)');
        const w = c.weight === undefined ? 1 : c.weight;
        if (!(typeof w === 'number' && w >= 0)) fail(`model.state.superpose[${i}].weight`, 'is a number ≥ 0');
        return { n: c.n, weight: w, phase: c.phase === undefined ? 0 : quantity(c.phase, 'scalar', `model.state.superpose[${i}].phase`) };
      }) };
    } else fail('model.state', "a line starts as { packet: { at, width, energy? } } or { superpose: [{ n, weight? }] }");
  } else if (system === 'plane') {
    const pl = model.plane;
    if (!isObj(pl)) fail('model.plane', 'wants { size, points?, particle? }');
    out.L = positive(pl.size, 'length', 'model.plane.size') / NM;
    out.points = pl.points === undefined ? 128 : pl.points;
    if (![64, 128, 256].includes(out.points)) fail('model.plane.points', 'is 64, 128 or 256 (cells a side)');
    const p = pl.particle ?? 'electron';
    out.mass = typeof p === 'string' ? PARTICLES[p] : isObj(p) ? positive(p.mass, 'mass', 'model.plane.particle.mass') : undefined;
    if (!out.mass) fail('model.plane.particle', `is ${Object.keys(PARTICLES).join(', ')} or { mass }`);
    out.particle = typeof p === 'string' ? p : 'particle';
    out.duration = positive(model.duration, 'time', 'model.duration') / FS;
    out.detections = model.detections === undefined ? 400 : model.detections;
    if (!Number.isInteger(out.detections) || out.detections < 10 || out.detections > 2000) fail('model.detections', 'is a whole number from 10 to 2000');
    const dx = out.L / out.points, rimW = Math.max(4, Math.round(out.points / 16)) * dx, inner = out.L / 2 - rimW;
    if (laws.length > 1) fail('model.laws', 'a plane holds one wall: one slits row');
    if (laws.length) {
      const e = laws[0].entry;
      for (const k of ['width', 'separation', 'thickness', 'at']) if (e[k] !== undefined) e[k] /= NM;
      if (e.height !== undefined) e.height /= EVJ;
      const w = { count: e.count ?? 2, width: e.width, separation: e.separation ?? 0, thickness: e.thickness ?? 2 * dx, at: e.at ?? 0, height: e.height ?? 10 };
      if (w.width < 2 * dx) fail('model.laws[0].width', `a slit is at least two of the grid's cells wide (${sig(2 * dx * NM, 3)} m here): a finer grid (points) or a wider slit`);
      if (w.count > 1 && !(w.separation >= w.width + 2 * dx)) fail('model.laws[0].separation', `slits ${w.count > 1 ? 'stand' : ''} at least their width and two cells apart, centre to centre (${sig((w.width + 2 * dx) * NM, 3)} m here)`);
      if (w.thickness < 2 * dx) fail('model.laws[0].thickness', `is at least two of the grid's cells (${sig(2 * dx * NM, 3)} m here)`);
      if (Math.abs(w.at) + w.thickness / 2 + 2 * dx > inner) fail('model.laws[0].at', 'puts the wall in the plane\'s absorbing rim');
      const edge = Math.max(...slitCentres(w).map(Math.abs)) + w.width / 2;
      if (edge > inner) fail('model.laws[0]', 'the slits reach the plane\'s absorbing rim: a larger plane or closer slits');
      laws[0].entry = { law: 'slits', ...w };
      out.wall = w;
    } else out.wall = null;
    const pk = model.state.packet;
    if (!isObj(pk)) fail('model.state.packet', 'a plane starts as { packet: { at, width, energy } }, moving +x toward the wall');
    const at = quantity(pk.at ?? 0, 'length', 'model.state.packet.at') / NM;
    const wd = Array.isArray(pk.width) && pk.width.length === 2 && typeof pk.width[0] !== 'number' ? pk.width : [pk.width, pk.width];
    const sx = positive(wd[0], 'length', 'model.state.packet.width') / NM, sy = positive(wd[1], 'length', 'model.state.packet.width') / NM;
    const energy = positive(pk.energy, 'work', 'model.state.packet.energy') / EVJ;
    if (Math.abs(at) + 2 * sx > inner) fail('model.state.packet.at', 'starts the packet in the plane\'s absorbing rim');
    if (out.wall && at + 3 * sx > out.wall.at - out.wall.thickness / 2) fail('model.state.packet.at', 'starts the packet on or past the wall (it moves +x toward it; three widths clear)');
    out.state = { packet: { at, sx, sy, energy } };
  } else if (system === 'atom') {
    const orb = model.state.orbitals;
    if (!Array.isArray(orb) || !orb.length || orb.length > 6) fail('model.state.orbitals', 'wants one to six [{ n, l, m }]');
    out.orbitals = orb.map((o, i) => {
      const w = `model.state.orbitals[${i}]`;
      if (!isObj(o) || !Number.isInteger(o.n) || o.n < 1 || o.n > MAX_N) fail(`${w}.n`, `is a whole number 1 to ${MAX_N}`);
      const l = o.l ?? 0, m = o.m ?? 0;
      if (!Number.isInteger(l) || l < 0 || l >= o.n) fail(`${w}.l`, `is a whole number from 0 to n − 1 (${o.n - 1})`);
      if (!Number.isInteger(m) || Math.abs(m) > l) fail(`${w}.m`, `is a whole number from −l to l (${-l} to ${l})`);
      return { n: o.n, l, m };
    });
    out.samples = model.samples === undefined ? 1500 : model.samples;
    if (!Number.isInteger(out.samples) || out.samples < 200 || out.samples > 4000) fail('model.samples', 'is a whole number from 200 to 4000 (points per orbital)');
    if (!laws.length) fail('model.laws', "an atom world runs [{ law: 'hydrogen' }]");
  } else if (system === 'spin') {
    const s = direction(model.state.along ?? 'z');
    if (!s) fail('model.state.along', "is 'x', '-y', 'z' …, or { theta, phi }");
    out.start = s; out.along = model.state.along ?? 'z';
    out.atoms = model.atoms === undefined ? 300 : model.atoms;
    if (!Number.isInteger(out.atoms) || out.atoms < 10 || out.atoms > 2000) fail('model.atoms', 'is a whole number from 10 to 2000');
    if (!laws.length) fail('model.laws', 'a spin world needs at least one stern-gerlach magnet');
    out.magnets = laws.map(({ entry }) => ({ axis: typeof entry.axis === 'string' ? direction(entry.axis) : (entry.axis ?? [0, 0, 1]), name: typeof entry.axis === 'string' ? entry.axis : 'tilted', keep: entry.keep ?? 'both' }));
  } else {
    const N = model.state.nuclei;
    if (!Number.isInteger(N) || N < 10 || N > 3000) fail('model.state.nuclei', 'is a whole number from 10 to 3000');
    if (laws.length !== 1) fail('model.laws', "a decay world runs one [{ law: 'decay', half_life }]");
    out.nuclei = N; out.halfLife = laws[0].entry.half_life;
    out.duration = positive(model.duration, 'time', 'model.duration');
  }
  return { model: out, gaps, dress: dress ?? null, liberties };
}

// ── the line ──
function solveLine(m) {
  const hb2m = HB2M_E * (ELECTRON_MASS / m.mass);
  const g = grid(m.length, m.points);
  const V = new Float64Array(g.n);
  const WALL = 1e6;   // eV: an infinite wall on the grid
  const rows = m.laws.map((l) => l.entry);
  for (let j = 0; j < g.n; j++) {
    const x = g.x[j];
    let v = 0;
    for (const r of rows) {
      if (r.law === 'well' && Math.abs(x - (r.center ?? 0)) >= r.width / 2) v += WALL;
      if (r.law === 'harmonic') v += (r.energy * r.energy * (x - (r.center ?? 0)) ** 2) / (4 * hb2m);
      if (r.law === 'barrier' && Math.abs(x - (r.center ?? 0)) < r.width / 2) v += r.height;
      if (r.law === 'step' && x > (r.at ?? 0)) v += r.height;
    }
    V[j] = v;
  }
  const H = hamiltonian(g, V, hb2m);
  const re = new Float64Array(g.n), im = new Float64Array(g.n);
  let kmax, Ehi, levels = null;
  const needLevels = Math.max(5, ...(m.state.superpose ? m.state.superpose.map((c) => c.n) : [0]));
  if (m.state.packet) {
    const { at, width, energy, dir } = m.state.packet;
    const k0 = dir * Math.sqrt(energy / hb2m), sk = 1 / (2 * width);
    for (let j = 0; j < g.n; j++) {
      const a = Math.exp(-((g.x[j] - at) ** 2) / (4 * width * width));
      re[j] = a * Math.cos(k0 * g.x[j]); im[j] = a * Math.sin(k0 * g.x[j]);
    }
    kmax = Math.abs(k0) + 4 * sk; Ehi = hb2m * kmax * kmax;
  } else {
    levels = eigen(H, g, needLevels);
    for (const c of m.state.superpose) {
      const v = levels[c.n - 1].v;
      for (let j = 0; j < g.n; j++) { re[j] += c.weight * Math.cos(c.phase) * v[j]; im[j] += c.weight * Math.sin(c.phase) * v[j]; }
    }
    const top = Math.max(...m.state.superpose.filter((c) => c.weight > 0).map((c) => levels[c.n - 1].E));
    Ehi = top - Math.min(...V); kmax = Math.sqrt(Math.max(Ehi, 1e-9) / hb2m);
  }
  let n0 = 0; for (let j = 0; j < g.n; j++) n0 += re[j] * re[j] + im[j] * im[j];
  n0 = Math.sqrt(n0 * g.dx);
  if (!(n0 > 0)) fail('model.state', 'the starting state is zero (no weight on any level)');
  for (let j = 0; j < g.n; j++) { re[j] /= n0; im[j] /= n0; }

  // the step: a tenth of the fastest phase the state turns at (CN is unitary for any step; this keeps it accurate)
  const interval = m.duration / SAMPLES;
  const target = m.dt ?? Math.min(interval, (0.1 * HBAR_EVFS) / Math.max(Ehi, 1e-6));
  let substeps = Math.max(1, Math.ceil(interval / target - 1e-9));
  const warnings = [];
  if (substeps * SAMPLES > MAX_STEPS) { substeps = Math.max(1, Math.floor(MAX_STEPS / SAMPLES)); warnings.push(`the step budget (${MAX_STEPS} steps) coarsened dt; a shorter run keeps the phases accurate`); }
  const dt = interval / substeps;
  const step = stepper(H, dt);
  const single = rows.length === 1 && (rows[0].law === 'barrier' || rows[0].law === 'step') ? rows[0] : null;
  const cut = single ? (single.law === 'barrier' ? (single.center ?? 0) + single.width / 2 : single.at ?? 0) : null;
  const SHOW = 200, stride = g.n / SHOW;
  const pick = Array.from({ length: SHOW }, (_, i) => Math.min(g.n - 1, Math.floor((i + 0.5) * stride)));
  const series = { t: [], norm: [], x: [], sigma: [], E: [], right: [], density: [], real: [], edge: [] };
  const edgeW = Math.max(1, Math.floor(0.05 * g.n));
  const record = (k) => {
    const s = measure(g, H, re, im, cut);
    series.t.push(k * interval); series.norm.push(s.norm); series.x.push(s.x); series.sigma.push(s.sigma); series.E.push(s.E); series.right.push(s.right);
    series.density.push(pick.map((j) => re[j] * re[j] + im[j] * im[j]));
    series.real.push(pick.map((j) => re[j]));
    let e = 0; for (let j = 0; j < edgeW; j++) e += re[j] * re[j] + im[j] * im[j] + re[g.n - 1 - j] ** 2 + im[g.n - 1 - j] ** 2;
    series.edge.push(e * g.dx);
  };
  record(0);
  for (let k = 1; k <= SAMPLES; k++) { for (let s = 0; s < substeps; s++) step(re, im); record(k); }

  // ── gates ──
  const gates = [];
  const normDrift = Math.max(...series.norm.map((v) => Math.abs(v - 1)));
  gates.push(gate('norm-held', 'the total probability stays one (Crank–Nicolson is unitary)', normDrift <= 1e-8, { drift: sig(normDrift, 3) }, 'probability neither appears nor leaks'));
  const Erange = Math.max(Math.abs(series.E[0]), Ehi, 1e-9);
  const eDrift = Math.max(...series.E.map((v) => Math.abs(v - series.E[0]))) / Erange;
  gates.push(gate('energy-held', 'the energy stays as it began (nothing outside acts)', eDrift <= 1e-7, { drift: sig(eDrift, 3) }, 'the Hamiltonian does not change, so neither does ⟨E⟩'));
  const lambdaMin = (2 * Math.PI) / Math.max(kmax, 1e-9);
  gates.push(gate('grid-resolves', 'the grid has at least ten points per shortest wavelength in the state', g.dx <= lambdaMin / 10, { dx: sig(g.dx * NM, 3), wavelength: sig(lambdaMin * NM, 3) }, `${sig(lambdaMin / g.dx, 3)} points per wavelength`));
  const edge = Math.max(...series.edge);
  gates.push(gate('edges-quiet', 'the state stays clear of the line\'s ends (they are hard walls, not the open line)', edge <= 1e-3, { probability: sig(edge, 3) },
    edge <= 1e-3 ? 'the line is long enough' : 'the state reached the line\'s end: a longer line would let it go on'));
  const levelsCheck = (kind) => {
    levels = levels ?? eigen(H, g, needLevels);
    const r = rows[0];
    const formula = kind === 'well' ? (n) => (n * n * Math.PI * Math.PI * hb2m) / (r.width * r.width) : (n) => (n - 0.5) * r.energy;
    // each level against its own tolerance (a well's walls sit on the grid, so its levels carry the grid's error)
    let worst = 0, worstN = 1, tol = 1;
    for (let n = 1; n <= 5; n++) {
      const err = Math.abs(levels[n - 1].E - formula(n)) / formula(n);
      const t = kind === 'well' ? (3 * g.dx) / r.width + ((n * Math.PI * g.dx) / r.width) ** 2 / 6 : 2e-3;
      if (n === 1 || err / t > worst / tol) { worst = err; worstN = n; tol = t; }
    }
    gates.push(gate('closed-form:levels', kind === 'well' ? 'the levels are n²π²ħ²/2ma², within the grid\'s resolution' : 'the levels are (n + ½)ħω, within 0.2%', worst <= tol,
      { expected: { [`E${worstN}`]: sig(formula(worstN), 5) }, measured: { [`E${worstN}`]: sig(levels[worstN - 1].E, 5) }, error: sig(worst, 3) }, 'the first five levels of the grid\'s Hamiltonian'));
  };
  if (rows.length === 1 && rows[0].law === 'well') levelsCheck('well');
  if (rows.length === 1 && rows[0].law === 'harmonic') levelsCheck('harmonic');
  if (rows.length === 1 && rows[0].law === 'harmonic' && m.state.packet) {
    const r = rows[0], w = r.energy / HBAR_EVFS, c = r.center ?? 0, { at, energy, dir } = m.state.packet;
    const v0 = dir * 2 * hb2m * Math.sqrt(energy / hb2m) / HBAR_EVFS;   // group velocity ħk/m, nm/fs
    let worst = 0;
    series.t.forEach((t, k) => { worst = Math.max(worst, Math.abs(series.x[k] - (c + (at - c) * Math.cos(w * t) + (v0 / w) * Math.sin(w * t)))); });
    const tol = 0.01 * Math.max(Math.abs(at - c), m.state.packet.width) + 2 * g.dx;
    gates.push(gate('closed-form:ehrenfest', 'the packet\'s centre swings like a classical mass, x₀·cos ωt (Ehrenfest)', worst <= tol, { expected: { swing: sig(Math.abs(at - c) * NM, 4) }, measured: { 'worst miss': sig(worst * NM, 3) }, error: sig(worst / Math.max(Math.abs(at - c), 1e-12), 3) }, 'the mean position against the classical path, every frame'));
  }
  if (!rows.length && m.state.packet && edge <= 1e-3) {
    const s0 = m.state.packet.width, T = m.duration;
    const expect = s0 * Math.sqrt(1 + ((2 * hb2m * T) / (HBAR_EVFS * 2 * s0 * s0)) ** 2);
    const meas = series.sigma[SAMPLES], err = Math.abs(meas - expect) / expect;
    gates.push(gate('closed-form:spreading', 'a free packet spreads as σ₀·√(1 + (ħt / 2mσ₀²)²)', err <= 2e-3, { expected: { width: sig(expect * NM, 4) }, measured: { width: sig(meas * NM, 4) }, error: sig(err, 3) }, 'its width at the end of the run'));
  }
  if (single && m.state.packet) {
    const { at, width, energy, dir } = m.state.packet;
    const k0 = dir * Math.sqrt(energy / hb2m), sk = 1 / (2 * width);
    // only when the packet started on the far side and has finished parting: little left near the barrier
    const lo = single.law === 'barrier' ? (single.center ?? 0) - single.width / 2 : cut, near = 3 * width;
    let around = 0;
    for (let j = 0; j < g.n; j++) if (g.x[j] > lo - near && g.x[j] < cut + near) around += re[j] * re[j] + im[j] * im[j];
    around *= g.dx;
    const facing = dir > 0 ? at < lo - near : at > cut + near;
    if (facing) {
      // the textbook transmission averaged over the packet's spread of momenta, for the barrier the grid holds (a whole
      // number of points wide: tunnelling falls off exponentially with width, so the grid's width is the one to use)
      let inside = 0; for (let j = 0; j < g.n; j++) if (Math.abs(g.x[j] - (single.center ?? 0)) < single.width / 2) inside++;
      const a = single.law === 'barrier' ? inside * g.dx : 0;
      let num = 0, den = 0;
      for (let i = -400; i <= 400; i++) {
        const k = k0 + (i / 100) * sk, wgt = Math.exp(-((k - k0) ** 2) / (2 * sk * sk));
        const E = hb2m * k * k;
        const T = k * dir <= 0 ? 0 : single.law === 'barrier' ? barrierT(E, single.height, a, hb2m) : stepT(E, single.height);
        num += wgt * T; den += wgt;
      }
      const expect = num / den, meas = dir > 0 ? series.right[SAMPLES] : 1 - series.right[SAMPLES];
      const err = Math.abs(meas - expect), parted = around <= 0.02;
      gates.push(gate('closed-form:transmission', `the share that ${single.law === 'barrier' ? 'tunnels through' : 'passes'} is the textbook transmission averaged over the packet's momenta, within 0.015`, parted && err <= 0.015,
        { expected: { transmitted: sig(expect, 4) }, measured: { transmitted: sig(meas, 4) }, error: sig(err, 3) },
        parted ? 'measured once the packet has parted' : `the packet had not finished parting (${sig(around * 100, 2)}% still near it): a longer run`));
    }
  }
  if (rows.length === 1 && rows[0].law === 'well' && m.state.superpose) {
    const on = m.state.superpose.filter((c) => c.weight > 0);
    if (on.length === 2 && (on[0].n + on[1].n) % 2 === 1) {
      levels = levels ?? eigen(H, g, needLevels);
      const Tb = (2 * Math.PI * HBAR_EVFS) / Math.abs(levels[on[1].n - 1].E - levels[on[0].n - 1].E);
      const xs = series.x, mid = (Math.max(...xs) + Math.min(...xs)) / 2, ups = [];
      for (let k = 1; k <= SAMPLES; k++) if (xs[k - 1] < mid && xs[k] >= mid) ups.push(series.t[k - 1] + (series.t[k] - series.t[k - 1]) * ((mid - xs[k - 1]) / (xs[k] - xs[k - 1])));
      if (ups.length >= 2) {
        const Tm = (ups[ups.length - 1] - ups[0]) / (ups.length - 1), err = Math.abs(Tm - Tb) / Tb;
        gates.push(gate('closed-form:beat', 'two levels beat at h / (E₂ − E₁): the density sloshes at the energy difference', err <= 5e-3, { expected: { period: sig(Tb, 5) }, measured: { period: sig(Tm, 5) }, error: sig(err, 3) }, 'the mean position\'s period, in femtoseconds'));
      }
    }
  }
  const features = rows.flatMap((r) => [r.width].filter((x) => x > 0));
  if (features.length) {
    const ratio = lambdaMin / Math.min(...features);
    gates.push(gate('quantum-regime', 'the waves are not tiny next to the potential\'s features (else a classical picture would do)', ratio >= 1e-3, { ratio: sig(ratio, 3) },
      ratio >= 1e-3 ? 'wave effects matter here' : 'the waves are far smaller than the features: the classical scale tells this'));
  }
  return { g, V, hb2m, dt, substeps, series, levels: levels ? levels.slice(0, 5).map((l) => sig(l.E, 6)) : null, pick, gates, warnings, cut, Ehi };
}

// ── the plane ──
function solvePlane(m) {
  const hb2m = HB2M_E * (ELECTRON_MASS / m.mass), pk = m.state.packet;
  const run = runPlane({ L: m.L, n: m.points, hb2m, wall: m.wall, packet: pk, duration: m.duration });
  const ff = farField(run, { from: m.wall ? run.back + 0.25 : -Infinity });
  const shots = drawDetections(ff.theta, ff.p, m.detections, m.seed * 7919 + 17);
  const lam = (2 * Math.PI) / run.k0;
  const gates = [], s = run.series, last = s.t.length - 1;
  const acc = Math.max(...s.norm.map((v, k) => Math.abs(v + s.taken[k] - 1)));
  gates.push(gate('norm-accounted', 'what is on the plane and what its rim has taken add to one (the step is unitary; the rim\'s take is counted as it is taken)', acc <= 1e-9, { drift: sig(acc, 3) }, 'probability neither appears nor leaks unaccounted'));
  const ppw = (2 * Math.PI) / (run.kmax * run.g.dx);
  gates.push(gate('grid-resolves', 'the grid has at least three cells per shortest wavelength in the state (two thirds of the shortest it can hold, where a spectral step is exact)', ppw >= 3, { dx: sig(run.g.dx * NM, 3), wavelength: sig(lam * NM, 3) }, `${sig(ppw, 3)} cells per shortest wavelength`));
  const k = s.t.findIndex((t) => Math.abs(t - run.snapStep * run.dt) < 1e-9);
  const passed = s.past[k], lost = s.takenPast[k];
  if (m.wall) {
    const quiet = lost / Math.max(passed + lost, 1e-300);
    gates.push(gate('edges-quiet', 'the far field is read while the passed wave is still whole (the rim has taken under 3% of it)', quiet <= 0.03, { taken: sig(quiet, 3) },
      quiet <= 0.03 ? 'the plane is large enough' : 'the passed wave reached the rim first: a larger plane, or a shorter run'));
    const settle = run.snapExit / Math.max(passed, 1e-300);
    gates.push(gate('far-field-settled', 'the wave has finished coming through when the far field is read (under 3% of it still at the slits\' mouths)', settle <= 0.03, { 'at the mouths': sig(settle, 3) },
      settle <= 0.03 ? 'the passed wave is all on its way' : 'part of it was still coming through: a longer run, or a shorter packet'));
    const leak = wallLeak({ dx: run.g.dx, dt: run.dt, steps: run.steps, hb2m, wall: m.wall, packet: pk });
    gates.push(gate('wall-opaque', 'the wall itself lets through under 1e-4 of what strikes it (a packet at the same energy, on the same grid and step, struck head on)', leak <= 1e-4, { through: sig(leak, 3) },
      leak <= 1e-4 ? 'what passes, passes through the slits' : 'the wall leaks: a thicker or higher wall'));
    const thin = thinScreen(run, m.wall, pk, ff.theta);
    if (m.wall.count > 1) {
      const lobe = 0.7 * lam / m.wall.width;
      const sm = fringeSpacing(ff.theta, ff.p, lobe, m.wall.count), st = fringeSpacing(ff.theta, thin, lobe, m.wall.count);
      const err = sm && st ? Math.abs(sm - st) / st : Infinity;
      gates.push(gate('closed-form:fringes', 'bright fringes stand sin θ = λ/d apart: the measured spacing against the thin-screen pattern of the grid\'s own slits, within 3%', err <= 0.03,
        { expected: { spacing: sig(st ?? NaN, 4), 'λ/d': sig(lam / m.wall.separation, 4) }, measured: { spacing: sig(sm ?? NaN, 4) }, error: sig(err, 3) },
        sm ? 'in sin θ, over the fringes inside the central band' : 'fewer than three bright fringes inside the central band'));
    } else {
      const hm = halfWidth(ff.theta, ff.p), ht = halfWidth(ff.theta, thin), ratio = hm / ht;
      gates.push(gate('envelope', 'one slit\'s central band is about λ/w wide: its half width lies from the thin screen\'s to 35% more (the slit is a short channel, which only widens it)', ratio >= 0.95 && ratio <= 1.35,
        { expected: { 'half width': sig(ht, 4), '0.443 λ/w': sig((0.443 * lam) / m.wall.width, 4) }, measured: { 'half width': sig(hm, 4) }, error: sig(ratio - 1, 3) },
        'in sin θ; a slit narrow next to the wavelength, or a thick wall, widens it further'));
    }
  }
  // the detections follow the far field: twenty bins of equal probability each hold a twentieth of them
  const B = 20, edges = [];
  for (let b = 1; b < B; b++) { const tgt = (shots.total * b) / B; let i = 0; while (shots.cdf[i] < tgt) i++; edges.push(ff.theta[i]); }
  const counts = new Array(B).fill(0);
  for (const a of shots.angles) { let b = 0; while (b < B - 1 && a > edges[b]) b++; counts[b]++; }
  const e = shots.angles.length / B, chi = counts.reduce((a, c) => a + (c - e) ** 2 / e, 0), dof = B - 1;
  gates.push(gate('detections-honest', 'the detections follow the far field (a χ² over twenty bins of equal probability, within five spreads)', chi <= dof + 5 * Math.sqrt(2 * dof), { chi2: sig(chi, 4), dof }, 'each dot drawn one at a time from where the wave goes'));
  return { ...run, far: ff, shots: shots.angles, lambda: lam, passed, gates, warnings: run.warnings, last };
}

// ── the atom ──
function solveAtom(m) {
  const gates = [], clouds = [];
  m.orbitals.forEach((o, i) => {
    const name = orbitalName(o.n, o.l, o.m);
    const T = radialTable(o.n, o.l);
    const c = sampleCloud(o.n, o.l, o.m, m.samples, m.seed * 7919 + i);
    clouds.push({ ...o, name, points: c.points, signs: c.signs, energy: -RYDBERG_EV / (o.n * o.n), meanR: 0.5 * (3 * o.n * o.n - o.l * (o.l + 1)) });
    const nodes = radialNodes(o.n, o.l);
    gates.push(gate(`radial-nodes:${name}`, `${name} has n − l − 1 = ${o.n - o.l - 1} radial nodes`, nodes === o.n - o.l - 1, { nodes }, 'counted from the radial function\'s sign changes'));
    gates.push(gate(`normalized:${name}`, `${name} integrates to one`, Math.abs(T.total - 1) <= 1e-6, { integral: sig(T.total, 8) }, 'the radial distribution\'s integral'));
    const mean = c.radii.reduce((a, r) => a + r, 0) / c.radii.length;
    const sd = Math.sqrt(c.radii.reduce((a, r) => a + (r - mean) ** 2, 0) / c.radii.length);
    const expect = 0.5 * (3 * o.n * o.n - o.l * (o.l + 1)), tol = 5 * sd / Math.sqrt(c.radii.length);
    gates.push(gate(`closed-form:mean-radius:${name}`, `the cloud's mean radius is (a₀/2)(3n² − l(l+1)), within five standard errors`, Math.abs(mean - expect) <= tol,
      { expected: { radius: sig(expect, 4) }, measured: { radius: sig(mean, 4) }, error: sig(Math.abs(mean - expect) / expect, 3) }, 'in Bohr radii, from the drawn points'));
    // the cloud is |ψ|²: twenty bins of equal probability in r each hold a twentieth of the points
    const B = 20, edges = [];
    for (let b = 1; b < B; b++) { const target = (T.total * b) / B; let k = 0; while (T.cdf[k] < target) k++; edges.push(T.r[k]); }
    const counts = new Array(B).fill(0);
    for (const r of c.radii) { let b = 0; while (b < B - 1 && r > edges[b]) b++; counts[b]++; }
    const e = c.radii.length / B, chi = counts.reduce((a, n) => a + (n - e) ** 2 / e, 0), dof = B - 1;
    gates.push(gate(`cloud-honest:${name}`, 'the drawn points follow |ψ|² (a χ² over twenty equal-probability shells, within five spreads)', chi <= dof + 5 * Math.sqrt(2 * dof), { chi2: sig(chi, 4), dof },
      'the cloud\'s density is the probability density'));
  });
  return { clouds, gates, warnings: [] };
}

// ── spin ──
function solveSpin(m) {
  const runs = runSpin({ start: m.start, magnets: m.magnets, atoms: m.atoms, seed: m.seed });
  const exp = spinExpectation({ start: m.start, magnets: m.magnets, runs });
  const gates = exp.map((e, k) => (e.reached < 10 ? null : gate(`closed-form:odds:${k + 1}`, `at magnet ${k + 1} (${m.magnets[k].name}), 'up' comes out with odds cos²(θ/2), within five spreads`, Math.abs(e.up - e.expected) <= 5 * Math.max(e.sd, 0.5),
    { expected: { up: sig(e.expected, 4) }, measured: { up: e.up }, error: sig(Math.abs(e.up - e.expected) / Math.max(e.reached, 1), 3) }, `${e.reached} atoms reached it`))).filter(Boolean);
  return { runs, stages: exp, gates, warnings: [] };
}

// ── decay ──
function solveDecay(m) {
  const times = runDecay({ nuclei: m.nuclei, halfLife: m.halfLife, seed: m.seed });
  const t = Array.from({ length: SAMPLES + 1 }, (_, k) => (k * m.duration) / SAMPLES);
  const left = t.map((tt) => times.filter((x) => x > tt).length);
  const gates = [];
  const decayed = times.filter((x) => x <= m.duration).length;
  if (decayed >= 10) {
    const exposure = times.reduce((a, x) => a + Math.min(x, m.duration), 0);
    const T = (Math.LN2 * exposure) / decayed, tol = 5 * m.halfLife / Math.sqrt(decayed);
    gates.push(gate('closed-form:half-life', 'the half-life measured from the decays matches the one given, within five standard errors', Math.abs(T - m.halfLife) <= tol,
      { expected: { half_life: sig(m.halfLife, 4) }, measured: { half_life: sig(T, 4) }, error: sig(Math.abs(T - m.halfLife) / m.halfLife, 3) }, `from ${decayed} decays`));
  }
  let worst = 0;
  t.forEach((tt, k) => { const p = 2 ** (-tt / m.halfLife), sd = Math.sqrt(m.nuclei * p * (1 - p)) || 1; worst = Math.max(worst, Math.abs(left[k] - m.nuclei * p) / sd); });
  gates.push(gate('counts-follow', 'the nuclei left follow N₀·2^(−t/T) within five spreads at every moment', worst <= 5, { worst: sig(worst, 3) }, 'each moment against the binomial spread'));
  return { times, t, left, gates, warnings: [] };
}

/** Solve a quantum world: the normalized model, its run, the readouts, the gates, the gaps and the sources. */
export function solveQuantum(params) {
  const { model, gaps, dress, liberties } = normalizeQuantum(params);
  const run = model.system === 'line' ? solveLine(model) : model.system === 'plane' ? solvePlane(model) : model.system === 'atom' ? solveAtom(model) : model.system === 'spin' ? solveSpin(model) : solveDecay(model);
  const rows = model.laws.map((l) => l.row);
  const assumptions = [STANCE, ...new Set(rows.map((r) => r.assumption))];
  if (model.system === 'line') assumptions.push('The line\'s ends are hard walls; the particle has no spin.');
  if (model.system === 'plane') assumptions.push('The plane\'s edge is an absorbing rim (what reaches it is taken, and counted); the particle has no spin; the far field is where the passed wave goes far away, read along each direction.');
  const sources = [...new Set(rows.flatMap((r) => r.sources))];
  const reviewed = rows.map((r) => r.reviewed).sort()[0] ?? null;
  const observed = {};
  if (model.system === 'line') {
    const s = run.series, last = s.t.length - 1;
    observed.energy = { value: sig(s.E[0], 5), unit: 'eV' };
    observed.position = { start: sig(s.x[0] * 1e-9, 4), end: sig(s.x[last] * 1e-9, 4), unit: 'm' };
    observed.spread = { start: sig(s.sigma[0] * 1e-9, 4), end: sig(s.sigma[last] * 1e-9, 4), unit: 'm' };
    if (run.cut !== null) observed.transmitted = { value: sig(s.right[last], 4) };
    if (run.levels) observed.levels = { values: run.levels, unit: 'eV' };
  } else if (model.system === 'plane') {
    observed.wavelength = { value: sig(run.lambda * 1e-9, 4), unit: 'm' };
    if (model.wall) observed.passed = { value: sig(run.passed, 4) };
    const fr = run.gates.find((g) => g.id === 'closed-form:fringes');
    if (fr) observed.fringes = { spacing: fr.value.measured.spacing, 'λ/d': fr.value.expected['λ/d'] };
    observed.detections = { count: run.shots.length };
  } else if (model.system === 'atom') {
    for (const c of run.clouds) observed[c.name] = { energy: sig(c.energy, 6), unit: 'eV', 'mean radius': `${sig(c.meanR, 4)} a₀`, 'radial nodes': c.n - c.l - 1, 'angular nodes': c.l };
  } else if (model.system === 'spin') {
    run.stages.forEach((e, k) => { observed[`magnet ${k + 1}`] = { axis: model.magnets[k].name, reached: e.reached, up: e.up, down: e.reached - e.up }; });
  } else {
    observed.left = { start: model.nuclei, end: run.left[run.left.length - 1] };
  }
  return {
    scale: 'quantum', system: model.system,
    model: { ...model, laws: model.laws.map(({ entry }) => entry) },
    dress, liberties, assumptions, sources, reviewed, gaps, warnings: run.warnings,
    run, observed,
    gates: run.gates, held: run.gates.every((g) => g.ok),
    stats: { system: model.system, laws: rows.length, seed: model.seed, ...(model.system === 'line' ? { steps: SAMPLES * run.substeps, dt: sig(run.dt * 1e-15, 4), points: model.points } : {}), ...(model.system === 'plane' ? { steps: run.steps, dt: sig(run.dt * 1e-15, 4), points: model.points } : {}) },
  };
}

export function quantumStats(r) { return { ...r.stats, held: r.held }; }
