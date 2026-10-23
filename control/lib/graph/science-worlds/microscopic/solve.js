/**
 * solveMicroscopic — a microscopic science world's model, run and examined.
 *
 *   model = {
 *     box:         { size: [x, y, z], walls?: 'reflect' | 'periodic' },   the volume, centred on the origin
 *     temperature?: (default body temperature, 310.15 K), viscosity?: (default water at 37 °C, 0.69 mPa·s),
 *     represents?: 1,             each sphere stands for this many molecules (a real cell holds far too many to draw)
 *     species:     [{ id, radius, D?, count? | concentration?, where?, mass? }],
 *     laws:        [{ law, … }],  from the microscopic table; an unknown law is a GAP naming its scale
 *     observe?, duration, dt?, seed?,
 *   }
 *
 * The scale is bounded by its laws: overdamped motion (inertia gone within the step), molecules as spheres in a
 * fluid, reactions counted in a well-mixed volume. Its regime gates say when a model leaves that ground: inertia that
 * lasts (the classical scale), a radius smaller than an atom (the quantum scale), a flow fast enough to make wakes.
 *
 * Statistical gates use tolerances of four to five standard errors of their estimate, so a sound run passes for any
 * seed; the seed only fixes which sound run it is. Pure and deterministic: same params, same result.
 */

import { splitParams, quantity, vector, positive, MAX_LAWS } from '../contract.js';
import { gapFor } from '../scales.js';
import { MICROSCOPIC_LAWS, MICROSCOPIC_LAW, AVOGADRO, BOLTZMANN, WATER_37C, BODY_TEMPERATURE } from './laws.js';
import { microscopic } from './kernel.js';

export const MAX_MOLECULES = 2000;
export const MAX_SHOWN = 300;
export const MAX_WORK = 8e6;          // molecule-steps per run: a world re-solves on every read, so this is its render budget
export const DEFAULT_SAMPLES = 240, MAX_SAMPLES = 600;
const PROTEIN_DENSITY = 1200;         // kg/m³, for an inertia estimate when a species gives no mass

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const idOk = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(s);
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const AXES = { x: 0, y: 1, z: 2 };
const gate = (id, want, ok, value, detail) => ({ id, want, ok: !!ok, value, detail });

export const BASE_ASSUMPTION = 'Molecules are smooth spheres in a uniform fluid, moving by random thermal steps; their insides (bonds, electrons) are the quantum scale\'s.';

function normalizeBox(box) {
  if (!isObj(box)) fail('model.box', 'wants { size: [x, y, z], walls? }');
  const extra = Object.keys(box).filter((k) => !['size', 'walls'].includes(k));
  if (extra.length) fail('model.box', `unknown field '${extra[0]}'`);
  const size = vector(box.size, 'length', 'model.box.size');
  if (size.some((c) => !(c > 0))) fail('model.box.size', 'every side must be > 0');
  if (box.walls !== undefined && !['reflect', 'periodic'].includes(box.walls)) fail('model.box.walls', "is 'reflect' or 'periodic'");
  return { size, lo: size.map((c) => -c / 2), hi: size.map((c) => c / 2), periodic: box.walls === 'periodic' };
}

function normalizeSpecies(list, env) {
  if (!Array.isArray(list) || !list.length) fail('model.species', 'wants at least one species');
  const seen = new Set();
  return list.map((sp, i) => {
    const where = `model.species[${i}]`;
    if (!isObj(sp)) fail(where, 'wants { id, radius, count | concentration }');
    const extra = Object.keys(sp).filter((k) => !['id', 'radius', 'D', 'count', 'concentration', 'where', 'mass'].includes(k));
    if (extra.length) fail(where, `unknown field '${extra[0]}'`);
    if (!idOk(sp.id)) fail(`${where}.id`, 'wants a short id (letters, digits, - and _)');
    if (seen.has(sp.id)) fail(`${where}.id`, `'${sp.id}' is used twice`);
    seen.add(sp.id);
    const r = positive(sp.radius, 'length', `${where}.radius`);
    const D = sp.D !== undefined ? positive(sp.D, 'diffusivity', `${where}.D`) : (BOLTZMANN * env.T) / (6 * Math.PI * env.eta * r);
    let count;
    if (sp.count !== undefined && sp.concentration !== undefined) fail(where, 'give a count or a concentration, not both');
    if (sp.concentration !== undefined) {
      const c = quantity(sp.concentration, 'concentration', `${where}.concentration`);
      count = Math.round((c * AVOGADRO * env.V) / env.w);
    } else {
      count = sp.count === undefined ? 0 : sp.count;
      if (!Number.isInteger(count) || count < 0) fail(`${where}.count`, 'is a whole number ≥ 0');
    }
    const mass = sp.mass !== undefined ? positive(sp.mass, 'mass', `${where}.mass`) : null;
    return { id: sp.id, radius: r, D, count, where: sp.where ?? 'everywhere', mass, givenD: sp.D !== undefined };
  });
}

const RATE_DIM = (n) => (n === 1 ? 'frequency' : 'rate2');

function normalizeLaw(raw, i, ctx, lawIds) {
  const where = `model.laws[${i}]`;
  if (!isObj(raw) || typeof raw.law !== 'string') fail(where, "wants { law: '<id>', … }");
  const row = MICROSCOPIC_LAW[raw.law];
  if (!row) return { gap: raw.law };
  const entry = { law: row.id };
  if (raw.id !== undefined) {
    if (!idOk(raw.id)) fail(`${where}.id`, 'wants a short id');
    if (lawIds.has(raw.id)) fail(`${where}.id`, `'${raw.id}' is used twice`);
    lawIds.add(raw.id); entry.id = raw.id;
  }
  const allowed = new Set(['law', 'id', ...(row.id === 'brownian' || row.id === 'drift' ? ['on'] : []), ...Object.keys(row.params)]);
  const extra = Object.keys(raw).filter((k) => !allowed.has(k));
  if (extra.length) fail(where, `'${row.id}' has no '${extra[0]}' (it takes ${[...allowed].filter((k) => k !== 'law').join(', ')})`);
  const known = (id, w) => { if (ctx.index[id] === undefined) fail(w, `no species '${id}'`); return id; };
  if (raw.on !== undefined) {
    if (!Array.isArray(raw.on) || !raw.on.length) fail(`${where}.on`, 'wants a list of species ids');
    entry.on = raw.on.map((id, k) => known(id, `${where}.on[${k}]`));
  }
  if (row.id === 'drift') {
    if ((raw.velocity === undefined) === (raw.force === undefined)) fail(where, 'drift: give a velocity (a flow) or a force, one of them');
    if (raw.velocity !== undefined) entry.velocity = vector(raw.velocity, 'velocity', `${where}.velocity`);
    else entry.force = vector(raw.force, 'force', `${where}.force`);
  } else if (row.id === 'membrane') {
    const axis = raw.axis ?? 'x';
    if (AXES[axis] === undefined) fail(`${where}.axis`, "is 'x', 'y' or 'z'");
    entry.axis = axis;
    const a = AXES[axis];
    entry.at = raw.at === undefined ? 0 : quantity(raw.at, 'length', `${where}.at`);
    if (!(entry.at > ctx.box.lo[a] && entry.at < ctx.box.hi[a])) fail(`${where}.at`, 'must lie inside the box');
    entry.permeability = {};
    if (raw.permeability !== undefined) {
      if (!isObj(raw.permeability)) fail(`${where}.permeability`, 'wants { <species>: <speed> }');
      for (const [id, P] of Object.entries(raw.permeability)) entry.permeability[known(id, `${where}.permeability`)] = positive(P, 'velocity', `${where}.permeability.${id}`, { zero: true });
    }
  } else if (row.id === 'reaction') {
    for (const side of ['from', 'to']) {
      const list = raw[side];
      if (!Array.isArray(list) || !list.length) fail(`${where}.${side}`, 'wants a list of species ids');
      list.forEach((id, k) => known(id, `${where}.${side}[${k}]`));
      entry[side] = list.slice();
    }
    if (entry.from.length > 2) fail(`${where}.from`, 'one or two reactants (a third collision is rare enough to be two steps)');
    if (entry.to.length > 3) fail(`${where}.to`, 'at most three products');
    if (raw.rate === undefined) fail(`${where}.rate`, `'reaction' needs a rate (${entry.from.length === 1 ? 'per second' : 'per molar per second'})`);
    entry.rate = positive(raw.rate, RATE_DIM(entry.from.length), `${where}.rate`);
    if (raw.reverse !== undefined) {
      if (entry.to.length > 2) fail(`${where}.reverse`, 'a reaction with three products has no reverse here');
      entry.reverse = positive(raw.reverse, RATE_DIM(entry.to.length), `${where}.reverse`);
    }
  }
  return { row, entry };
}

const OBSERVABLES = { counts: false, events: false, concentration: true, diffusion: true, sides: true };

function normalizeObserve(list, index) {
  if (list === undefined) return [{ quantity: 'counts' }];
  if (!Array.isArray(list)) fail('model.observe', "wants ['counts', { quantity: 'concentration', of: '<species>' }, …]");
  return list.map((o, i) => {
    const q = typeof o === 'string' ? { quantity: o } : o;
    if (!isObj(q) || OBSERVABLES[q.quantity] === undefined) fail(`model.observe[${i}]`, `observes one of ${Object.keys(OBSERVABLES).join(', ')}`);
    if (OBSERVABLES[q.quantity]) {
      if (index[q.of] === undefined) fail(`model.observe[${i}].of`, `'${q.quantity}' names a species: { quantity: '${q.quantity}', of: '<id>' }`);
      return { quantity: q.quantity, of: q.of };
    }
    return { quantity: q.quantity };
  });
}

/** The params a microscopic world's mint takes, normalized; every unknown law named as a gap. */
export function normalizeMicroscopic(params) {
  const { model, dress, liberties } = splitParams(params);
  const extra = Object.keys(model).filter((k) => !['box', 'temperature', 'viscosity', 'represents', 'species', 'laws', 'observe', 'duration', 'dt', 'seed'].includes(k));
  if (extra.length) fail('model', `unknown field '${extra[0]}'`);
  const box = normalizeBox(model.box);
  const T = model.temperature === undefined ? BODY_TEMPERATURE : positive(model.temperature, 'temperature', 'model.temperature');
  const eta = model.viscosity === undefined ? WATER_37C : positive(model.viscosity, 'viscosity', 'model.viscosity');
  const w = model.represents === undefined ? 1 : model.represents;
  if (!(typeof w === 'number' && Number.isFinite(w) && w >= 1)) fail('model.represents', 'is a number ≥ 1 (how many molecules each sphere stands for)');
  const V = box.size[0] * box.size[1] * box.size[2];
  const species = normalizeSpecies(model.species, { T, eta, V, w });
  const total = species.reduce((n, sp) => n + sp.count, 0);
  if (total > MAX_MOLECULES) fail('model.species', `${total} molecules is more than ${MAX_MOLECULES}: raise \`represents\` so each sphere stands for more, or shrink the box`);
  const index = Object.fromEntries(species.map((sp, i) => [sp.id, i]));
  const ctx = { box, species, index };
  if (!Array.isArray(model.laws)) fail('model.laws', "wants [{ law: '<id>', … }]");
  if (model.laws.length > MAX_LAWS) fail('model.laws', `at most ${MAX_LAWS}`);
  const lawIds = new Set(), laws = [], gaps = [];
  const known = MICROSCOPIC_LAWS.map((r) => r.id);
  model.laws.forEach((raw, i) => {
    const r = normalizeLaw(raw, i, ctx, lawIds);
    if (r.gap) gaps.push(gapFor(r.gap, 'microscopic', known)); else laws.push(r);
  });
  const duration = positive(model.duration, 'time', 'model.duration');
  const dt = model.dt === undefined ? undefined : positive(model.dt, 'time', 'model.dt');
  const seed = model.seed === undefined ? 1 : model.seed;
  if (!Number.isInteger(seed) || seed < 0) fail('model.seed', 'is a whole number ≥ 0');
  const observe = normalizeObserve(model.observe, index);
  return { model: { box, T, eta, w, V, species, laws, duration, dt, seed, observe }, gaps, dress: dress ?? null, liberties };
}

// where a species starts: everywhere, a side of the first membrane, the middle, or a region [lo, hi]
function region(sp, model) {
  const { box, laws } = model;
  const m = laws.find((l) => l.row.id === 'membrane')?.entry;
  const a = m ? AXES[m.axis] : 0, cut = m ? m.at : 0;
  const lo = box.lo.slice(), hi = box.hi.slice();
  const w = sp.where;
  if (w === 'everywhere') return { lo, hi };
  if (w === 'left') { hi[a] = cut; return { lo, hi }; }
  if (w === 'right') { lo[a] = cut; return { lo, hi }; }
  if (w === 'center') return { lo: box.size.map((c) => -c * 0.05), hi: box.size.map((c) => c * 0.05) };
  if (isObj(w) && Array.isArray(w.from) && Array.isArray(w.to)) {
    const f = vector(w.from, 'length', `species ${sp.id} where.from`), t = vector(w.to, 'length', `species ${sp.id} where.to`);
    return { lo: f.map((c, k) => Math.max(box.lo[k], Math.min(c, t[k]))), hi: t.map((c, k) => Math.min(box.hi[k], Math.max(c, f[k]))) };
  }
  fail(`species ${sp.id}.where`, "is 'everywhere', 'left', 'right', 'center' or { from: [x, y, z], to: [x, y, z] }");
}

// the left null space of the net stoichiometry: every combination of counts the reactions cannot change
function conservedMoieties(S, reactions) {
  if (!reactions.length) return [];
  const rows = reactions.map((R) => { const v = new Array(S).fill(0); for (const s of R.from) v[s]--; for (const s of R.to) v[s]++; return v; });
  const M = rows.map((r) => r.slice()), piv = [];
  let r = 0;
  for (let c = 0; c < S && r < M.length; c++) {
    let p = r; while (p < M.length && Math.abs(M[p][c]) < 1e-12) p++;
    if (p === M.length) continue;
    [M[r], M[p]] = [M[p], M[r]];
    const d = M[r][c]; for (let k = 0; k < S; k++) M[r][k] /= d;
    for (let q = 0; q < M.length; q++) if (q !== r && Math.abs(M[q][c]) > 1e-12) { const f = M[q][c]; for (let k = 0; k < S; k++) M[q][k] -= f * M[r][k]; }
    piv.push(c); r++;
  }
  const free = [...Array(S).keys()].filter((c) => !piv.includes(c));
  return free.map((f) => {
    const y = new Array(S).fill(0); y[f] = 1;
    piv.forEach((c, k) => { y[c] = -M[k][f]; });
    return y;
  });
}

/** Solve a microscopic world: the normalized model, its run, the readouts, the gates and the gaps. */
export function solveMicroscopic(params) {
  const { model, gaps, dress, liberties } = normalizeMicroscopic(params);
  const { box, species, laws, w, V } = model;
  const S = species.length, kT = BOLTZMANN * model.T;
  const warnings = [];
  const lawsOf = (id) => laws.filter((l) => l.row.id === id).map((l) => l.entry);
  const brownian = lawsOf('brownian'), drifts = lawsOf('drift'), membranes = lawsOf('membrane'), rxLaws = lawsOf('reaction');
  const diffuses = species.map((sp) => brownian.some((b) => !b.on || b.on.includes(sp.id)));
  const D = species.map((sp, i) => (diffuses[i] ? sp.D : 0));
  const v = species.map((sp) => {
    const acc = [0, 0, 0];
    for (const d of drifts) {
      if (d.on && !d.on.includes(sp.id)) continue;
      const u = d.velocity ?? d.force.map((f) => (f * sp.D) / kT);   // Einstein: a force sets a speed
      for (let c = 0; c < 3; c++) acc[c] += u[c];
    }
    return acc;
  });

  // the step: fine enough for the smallest feature the molecules must respect (a membrane, else the walls)
  const Lmin = Math.min(...box.size);
  const feature = membranes.length ? Lmin / 20 : Lmin / 5;
  const samples = DEFAULT_SAMPLES;
  const interval = model.duration / samples;
  const Dmax = Math.max(...D), vmax = Math.max(...v.map((u) => Math.hypot(...u)));
  let target = model.dt ?? Math.min(Dmax > 0 ? (feature * feature) / (2 * Dmax) : Infinity, vmax > 0 ? feature / vmax : Infinity, interval);
  let substeps = Math.max(1, Math.ceil(interval / target - 1e-9));
  const molecules = species.reduce((n, sp) => n + sp.count, 0);
  if (samples * substeps * Math.max(1, molecules) > MAX_WORK) {
    substeps = Math.max(1, Math.floor(MAX_WORK / (samples * Math.max(1, molecules))));
    warnings.push(`the work budget (${MAX_WORK} molecule-steps) coarsened dt: fewer molecules (raise \`represents\`), a shorter run or a bigger box would keep it fine`);
  }
  const dt = interval / substeps;

  // the molecules at t = 0, and the ones the page draws
  const rand = microscopic.mulberry32(model.seed * 2654435761 + 7);
  const particles = [];
  species.forEach((sp, s) => {
    const { lo, hi } = region(sp, model);
    for (let n = 0; n < sp.count; n++) particles.push({ s, x: [0, 1, 2].map((c) => lo[c] + rand() * (hi[c] - lo[c])) });
  });
  const display = [];
  if (particles.length <= MAX_SHOWN) particles.forEach((p, i) => display.push(i));
  else {
    // the same share of every species, at least one of each
    const share = MAX_SHOWN / particles.length, taken = new Array(S).fill(0), want = species.map((sp) => Math.max(1, Math.round(sp.count * share)));
    particles.forEach((p, i) => { if (taken[p.s] < want[p.s]) { display.push(i); taken[p.s]++; } });
  }

  // reactions as propensities on the counts (each sphere stands for `w` molecules)
  const NAV = AVOGADRO * V;
  const idx = (id) => model.species.findIndex((sp) => sp.id === id);
  const reactions = [];
  for (const r of rxLaws) {
    const from = r.from.map(idx), to = r.to.map(idx);
    const c = (k, n, same) => (n === 1 ? k : (same ? 2 : 1) * (k * w) / NAV);
    reactions.push({ from, to, c: c(r.rate, from.length, from.length === 2 && from[0] === from[1]), k: r.rate, law: r });
    if (r.reverse !== undefined) reactions.push({ from: to, to: from, c: c(r.reverse, to.length, to.length === 2 && to[0] === to[1]), k: r.reverse, law: r, back: true });
  }
  const sys = {
    box,
    species: species.map((sp, i) => ({ id: sp.id, D: D[i], r: sp.radius, v: v[i] })),
    particles,
    membranes: membranes.map((m) => ({ axis: AXES[m.axis], at: m.at, pass: species.map((sp, i) => (D[i] > 0 && m.permeability[sp.id] ? Math.min(1, m.permeability[sp.id] * Math.sqrt((Math.PI * dt) / D[i])) : 0)) })),
    reactions: reactions.map(({ from, to, c }) => ({ from, to, c })),
    display, near: true,
  };
  const run = microscopic.run(sys, { dt, substeps, samples, interval, seed: model.seed });
  if (run.capped) warnings.push('the reaction budget (200,000 events) was reached: the run stops reacting there; fewer molecules or slower rates keep it whole');

  // ── gates ──
  const gates = [];
  const tN = run.t.length, last = tN - 1;
  const conc = (n) => (n * w) / NAV;   // mol/m³
  const step = Dmax > 0 ? Math.sqrt(2 * Dmax * dt) : 0;
  if (Dmax > 0 || vmax > 0) {
    const move = Math.max(step, vmax * dt);
    gates.push(gate('dt-resolves', `no step moves a molecule more than ${membranes.length ? 'a twentieth' : 'a fifth'} of the box's smallest side`, move <= feature * 1.0001,
      { step: sig(move, 3), limit: sig(feature, 3) }, `steps of ${sig(move, 3)} m against ${sig(feature, 3)} m`));
  }
  const passMax = Math.max(0, ...sys.membranes.flatMap((m) => m.pass));
  if (membranes.length && passMax > 0) {
    gates.push(gate('membrane-step', 'a crossing is let through with probability under one half per hit (the permeability is resolved)', passMax <= 0.5,
      { probability: sig(passMax, 3) }, passMax <= 0.5 ? 'the step resolves the membrane\'s permeability' : 'so permeable the step cannot tell it from an open gap: a smaller dt would'));
  }
  // free diffusion: the displacement's variance grows as 6·D·t while the molecules are far from walls
  if (!membranes.length) {
    const rows = [];
    species.forEach((sp, s) => {
      if (!(D[s] > 0) || run.counts[0][s] < 30) return;
      const win = run.t.map((t, k) => k).filter((k) => k > 0 && (box.periodic || 6 * D[s] * run.t[k] <= (0.1 * Lmin) ** 2));
      if (win.length < 3) return;
      const kept = (k) => run.counts[0][s];   // kept molecules start as the whole species; reactions only remove them
      let num = 0, den = 0;
      for (const k of win) { num += run.msd[k][s] * run.t[k]; den += run.t[k] * run.t[k]; }
      const measured = num / den / 6, n = Math.max(1, kept(win[win.length - 1]));
      const err = Math.abs(measured - D[s]) / D[s], tol = 5 * Math.sqrt(2 / (3 * n));
      rows.push({ species: sp.id, expected: sig(D[s], 4), measured: sig(measured, 4), error: sig(err, 3), ok: err <= tol, tol });
    });
    if (rows.length) {
      const worst = rows.reduce((a, b) => (b.error / b.tol > a.error / a.tol ? b : a));
      gates.push(gate('closed-form:diffusion', 'the spread grows as 6·D·t (Einstein), within five standard errors of the sample', rows.every((r) => r.ok),
        { species: worst.species, expected: { D: worst.expected }, measured: { D: worst.measured }, error: worst.error }, `D measured from the spread of ${rows.length === 1 ? 'one species' : `${rows.length} species`}`));
    }
  }
  // drift: the mean displacement is v·t, within the random walk's own scatter
  const driftRows = [];
  species.forEach((sp, s) => {
    const sp2 = Math.hypot(...v[s]);
    if (!(sp2 > 0) || run.counts[0][s] < 30) return;
    const win = run.t.map((t, k) => k).filter((k) => k > 0 && (box.periodic || sp2 * run.t[k] + Math.sqrt(6 * D[s] * run.t[k]) <= 0.2 * Lmin));
    if (!win.length) return;
    const k = win[win.length - 1], t = run.t[k], m = run.mean[k][s];
    const off = Math.hypot(m[0] - v[s][0] * t, m[1] - v[s][1] * t, m[2] - v[s][2] * t);
    const tol = 5 * Math.sqrt((6 * D[s] * t) / run.counts[0][s]) + 1e-15;
    driftRows.push({ species: sp.id, expected: sig(sp2 * t, 4), measured: sig(Math.hypot(...m), 4), ok: off <= tol, error: sig(off / (sp2 * t), 3) });
  });
  if (driftRows.length) {
    const r = driftRows[0];
    gates.push(gate('closed-form:drift', 'the mean displacement is v·t, within five standard errors of the walk\'s scatter', driftRows.every((d) => d.ok),
      { species: r.species, expected: { distance: r.expected }, measured: { distance: r.measured }, error: r.error }, 'the drift carries the cloud while it spreads'));
  }
  // conserved combinations: what no reaction can change stays exactly as it began
  const moieties = conservedMoieties(S, reactions);
  if (reactions.length && moieties.length) {
    let worst = 0;
    for (const y of moieties) { const y0 = y.reduce((a, c, s) => a + c * run.counts[0][s], 0); for (const n of run.counts) worst = Math.max(worst, Math.abs(y.reduce((a, c, s) => a + c * n[s], 0) - y0)); }
    gates.push(gate('moieties-conserved', 'every combination the reactions cannot change stays exactly as it began (atoms are not made or lost)', worst < 1e-9,
      { combinations: moieties.length, drift: worst }, `${moieties.length} conserved combination${moieties.length > 1 ? 's' : ''} held`));
  }
  // equilibrium: when every reaction runs both ways, the run settles where mass action says (K = k_forward / k_back)
  if (rxLaws.length && rxLaws.every((r) => r.reverse !== undefined)) {
    const from = Math.floor(0.6 * last);
    const avg = species.map((sp, s) => { let a = 0; for (let k = from; k <= last; k++) a += run.counts[k][s]; return a / (last - from + 1); });
    let worst = null, settled = true;
    for (const r of rxLaws) {
      const A = r.from.map(idx), B = r.to.map(idx);
      if ([...A, ...B].some((s) => !(avg[s] > 0.5))) { settled = false; continue; }
      const prod = (list) => list.reduce((p, s) => p * conc(avg[s]), 1);
      const K = r.rate / r.reverse, Q = prod(B) / prod(A);
      const relax = 1 / (r.reverse * (B.length === 2 ? conc(avg[B[0]]) + conc(avg[B[1]]) : 1) + r.rate * (A.length === 2 ? conc(avg[A[0]]) + conc(avg[A[1]]) : 1));
      if (model.duration < 6 * relax) { settled = false; continue; }
      const nEff = Math.max(1, ((last - from) * interval) / (2 * relax));
      const tol = 4 * Math.sqrt([...A, ...B].reduce((a, s) => a + 1 / avg[s], 0) / nEff);
      const err = Math.abs(Math.log(Q / K));
      if (!worst || err / tol > worst.err / worst.tol) worst = { r, K, Q, err, tol };
    }
    if (worst && settled) {
      gates.push(gate('closed-form:equilibrium', 'the settled mixture sits where mass action says: [products] / [reactants] = k_forward / k_back', worst.err <= worst.tol,
        { expected: { K: sig(worst.K, 4) }, measured: { K: sig(worst.Q, 4) }, error: sig(Math.exp(worst.err) - 1, 3) }, 'averaged over the run\'s last two fifths'));
    }
  }
  // membranes: an impermeable species never crosses; a permeable one evens out across it in proportion to the volumes
  membranes.forEach((m, mi) => {
    const a = AXES[m.axis], area = box.size[(a + 1) % 3] * box.size[(a + 2) % 3];
    const V1 = area * (m.at - box.lo[a]), V2 = area * (box.hi[a] - m.at);
    species.forEach((sp, s) => {
      const P = m.permeability[sp.id] ?? 0;
      const reacts = reactions.some((R) => R.from.includes(s) || R.to.includes(s));
      if (reacts || Math.hypot(...v[s]) > 0 || run.counts[0][s] < 10 || !(D[s] > 0)) return;
      const left = run.sides[mi].map((l) => l[s]);
      if (!(P > 0)) {
        const moved = Math.max(...left.map((l) => Math.abs(l - left[0])));
        gates.push(gate(`membrane-holds:${sp.id}`, `the membrane stops ${sp.id} entirely`, moved === 0, { crossed: moved }, moved === 0 ? 'none crossed' : `${moved} crossed`));
        return;
      }
      const lambda = P * area * (1 / V1 + 1 / V2);
      if (model.duration < 6 / lambda) return;
      const from = Math.floor(0.7 * last), n = run.counts[0][s];
      let f = 0; for (let k = from; k <= last; k++) f += left[k] / n; f /= last - from + 1;
      const fx = V1 / (V1 + V2), tol = 5 * Math.sqrt((fx * (1 - fx)) / n);
      gates.push(gate(`closed-form:membrane:${sp.id}`, `${sp.id} evens out across the membrane in proportion to the volumes`, Math.abs(f - fx) <= tol,
        { expected: { left: sig(fx, 3) }, measured: { left: sig(f, 3) }, error: sig(Math.abs(f - fx), 3) }, 'the share on the near side, averaged over the run\'s last three tenths'));
    });
  });
  // reactions in a well-mixed volume: mixing must outpace reacting for counts to stand for the whole box
  if (reactions.length) {
    const reacting = [...new Set(reactions.flatMap((R) => [...R.from, ...R.to]))];
    const Dlow = Math.min(...reacting.map((s) => D[s]).filter((d) => d > 0), Infinity);
    const Lmax = Math.max(...box.size);
    const mix = Number.isFinite(Dlow) ? (Lmax * Lmax) / (6 * Dlow) : Infinity;
    let fastest = 0;
    for (const R of reactions) {
      const perMolecule = R.from.length === 1 ? R.k : R.k * conc(Math.max(1, run.counts[0][R.from[1]]));
      fastest = Math.max(fastest, perMolecule);
    }
    const react = fastest > 0 ? 1 / fastest : Infinity;
    gates.push(gate('well-mixed', 'molecules cross the box faster than they react, so counting them stands for the whole volume', mix <= react,
      { mixing: sig(mix, 3), reacting: sig(react, 3) }, mix <= react ? 'mixing outpaces reacting' : 'reactions outpace mixing: where the molecules are would matter, and the counts do not know it'));
  }
  // the regime: inertia gone within what the demo shows, molecules no smaller than atoms, flow without wakes
  const tauWorst = Math.max(...species.map((sp) => {
    const m = sp.mass ?? (4 / 3) * Math.PI * sp.radius ** 3 * PROTEIN_DENSITY;
    return m / (6 * Math.PI * model.eta * sp.radius);
  }));
  gates.push(gate('overdamped-regime', 'inertia dies away in under a hundredth of the time between frames', tauWorst <= 0.01 * interval,
    { inertia: sig(tauWorst, 3), frame: sig(interval, 3) }, tauWorst <= 0.01 * interval ? 'at this scale a push sets a speed, not an acceleration' : 'inertia lasts at this size: the classical scale owns it'));
  const rmin = Math.min(...species.map((sp) => sp.radius));
  gates.push(gate('molecular-regime', 'every species is at least an atom across (0.1 nm)', rmin >= 1e-10, { radius: sig(rmin, 3) },
    rmin >= 1e-10 ? 'big enough to be a molecule' : 'smaller than an atom: the quantum scale owns it'));
  if (vmax > 0) {
    const Re = Math.max(...species.map((sp, s) => (1000 * Math.hypot(...v[s]) * 2 * sp.radius) / model.eta));
    gates.push(gate('low-reynolds', 'flow past each molecule is slow enough to leave no wake (Reynolds number under 0.1)', Re <= 0.1, { reynolds: sig(Re, 3) },
      Re <= 0.1 ? 'viscosity rules' : 'fast enough to make wakes: drag is no longer simple'));
  }

  // ── what goes back ──
  const tracks = {
    t: run.t.map((t) => sig(t, 9)),
    particles: run.tracks.map((tr) => ({ id: tr.particle, segs: tr.segs.map((g) => ({ species: species[g.s].id, k0: g.k0, k1: g.k1, x: g.path.map((p) => p.map((c) => sig(c, 7))) })) })),
  };
  const series = {
    counts: Object.fromEntries(species.map((sp, s) => [sp.id, run.counts.map((n) => n[s] * w)])),
    sides: run.sides.map((m) => Object.fromEntries(species.map((sp, s) => [sp.id, m.map((l) => l[s] * w)]))),
    msd: Object.fromEntries(species.map((sp, s) => [sp.id, run.msd.map((q) => sig(q[s]))])),
  };
  const observed = {};
  for (const o of model.observe) {
    const s = o.of ? idx(o.of) : -1, key = o.of ? `${o.quantity}:${o.of}` : o.quantity;
    if (o.quantity === 'counts') observed[key] = Object.fromEntries(species.map((sp, k) => [sp.id, { start: run.counts[0][k] * w, end: run.counts[last][k] * w }]));
    else if (o.quantity === 'events') observed[key] = { value: run.events * w };
    else if (o.quantity === 'concentration') observed[key] = { start: sig(conc(run.counts[0][s]) , 4), end: sig(conc(run.counts[last][s]), 4), unit: 'mM' };
    else if (o.quantity === 'diffusion') observed[key] = { value: sig(D[s], 4), unit: 'm²/s', note: species[s].givenD ? 'given' : 'Stokes–Einstein from the radius, temperature and viscosity' };
    else if (o.quantity === 'sides') observed[key] = membranes.length ? { start: run.sides[0][0][s] * w, end: run.sides[0][last][s] * w, of: run.counts[last][s] * w, side: 'left of the first membrane' } : { value: null, note: 'there is no membrane' };
  }
  const assumptions = [BASE_ASSUMPTION, ...new Set(laws.map(({ row }) => row.assumption))];
  if (w > 1) assumptions.push(`Each sphere stands for ${sig(w, 3)} molecules: the counts are real, but their random ups and downs are √${sig(w, 3)} ≈ ${sig(Math.sqrt(w), 2)}× larger than a real cell's.`);
  const shownLiberties = particles.length > display.length ? [{ what: `${display.length} of the ${particles.length} spheres are drawn`, why: 'so the page stays quick; the counts are all of them' }] : [];
  return {
    scale: 'microscopic',
    model: { ...model, laws: laws.map(({ entry }) => entry) },
    dress, liberties, assumptions, gaps, warnings, shownLiberties,
    dt: sig(dt), substeps, samples, steps: samples * substeps,
    D: species.map((sp, s) => sig(D[s], 4)), drift: v.map((u) => u.map((c) => sig(c, 4))),
    tracks, series, observed,
    events: run.events, firstEvent: run.first ? { t: sig(run.first.t, 6), particle: run.first.particle } : null,
    gates, held: gates.every((g) => g.ok),
    stats: { duration: sig(model.duration), species: S, molecules: molecules * w, spheres: molecules, events: run.events * w, represents: w, seed: model.seed },
  };
}

/** The stats digest a microscopic mint reports and research review recomputes: one function, so they cannot drift. */
export function microscopicStats(r) {
  return { ...r.stats, dt: r.dt, steps: r.steps, samples: r.samples, held: r.held };
}
