/**
 * solveClassical — a classical science world's model, run and examined.
 *
 *   params → split (model / dress / liberties) → normalize (units, ids, law rows; an unknown law is a GAP)
 *          → resolve (the kernel's system) → choose the stepper and dt from the fastest motion → run
 *          → measure → gates (laws as data: { id, want, ok, value, detail }; they advise, none refuse)
 *
 * The model is bounded by its LAWS, not by size: an orbit is classical, a falling ball is classical, an electron
 * in a magnet is classical while its de Broglie wavelength is far below the size of its path. Two regime gates say
 * when the model has left Newton's ground (near light speed; wavelengths as large as the motion).
 *
 * The dress never reaches here. It is returned untouched for the page; the solver reads only the model.
 *
 * Pure and deterministic: the same params give the same result, byte for byte.
 */

import { splitParams, normalizeBodies, quantity, vector, MAX_LAWS } from '../contract.js';
import { gapFor } from '../scales.js';
import { G as G_PRESET } from '../../machina/quantities.js';
import { CLASSICAL_LAWS, CLASSICAL_LAW, G_NEWTON, planeNormal } from './laws.js';
import { classical } from './kernel.js';
import { closedFormGates } from './analytic.js';
import { along, peak, returnRange, period, at, vel } from './measure.js';

export const MAX_STEPS = 400000;
export const MAX_SAMPLES = 3600;
const STEPS_PER_PERIOD = 400;          // the dt the solver aims for: the fastest motion's timescale over this
const RESOLVES = 50;                   // the gate: dt must split the fastest timescale at least this finely
const SAMPLES_PER_PERIOD = 32;         // playback: the fastest motion is recorded at least this finely
const C_LIGHT = 299792458;
const H_PLANCK = 6.62607015e-34;
const UP = [0, 0, 1];                  // the native frame is z-up, 1 unit = 1 m

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const sigv = (a, n = 6) => a.map((c) => sig(c, n));

export const BASE_ASSUMPTION = 'Newtonian mechanics: speeds far below light and paths far larger than a body\'s quantum wavelength (the regime gates check both).';

function normalizeFrame(frame) {
  if (frame === undefined) return { g: G_PRESET.earth, up: UP };
  if (!isObj(frame)) fail('model.frame', 'wants { g }');
  const extra = Object.keys(frame).filter((k) => k !== 'g');
  if (extra.length) fail('model.frame', `unknown field '${extra[0]}' (the frame is z-up; give g)`);
  let g = G_PRESET.earth;
  if (frame.g !== undefined) {
    if (typeof frame.g === 'string' && G_PRESET[frame.g.toLowerCase()] !== undefined) g = G_PRESET[frame.g.toLowerCase()];
    else g = quantity(frame.g, 'accel', 'model.frame.g');
  }
  if (!(g >= 0)) fail('model.frame.g', 'must be ≥ 0');
  return { g, up: UP };
}

const STRUCTURAL = { each: ['on'], pairs: ['among'], link: ['between'], plane: ['on'] };

function normalizeLaw(raw, i, ctx, lawIds) {
  const where = `model.laws[${i}]`;
  if (!isObj(raw) || typeof raw.law !== 'string') fail(where, "wants { law: '<id>', … }");
  const row = CLASSICAL_LAW[raw.law];
  if (!row) return { gap: raw.law };
  const entry = { law: row.id };
  if (raw.id !== undefined) {
    if (typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(raw.id)) fail(`${where}.id`, 'wants a short id');
    if (lawIds.has(raw.id)) fail(`${where}.id`, `'${raw.id}' is used twice`);
    lawIds.add(raw.id);
    entry.id = raw.id;
  }
  const allowed = new Set(['law', 'id', ...STRUCTURAL[row.shape], ...Object.keys(row.params)]);
  const extra = Object.keys(raw).filter((k) => !allowed.has(k));
  if (extra.length) fail(where, `'${row.id}' has no '${extra[0]}' (it takes ${[...allowed].filter((k) => k !== 'law').join(', ')})`);
  for (const key of ['on', 'among']) {
    if (raw[key] === undefined) continue;
    if (!Array.isArray(raw[key]) || !raw[key].length) fail(`${where}.${key}`, 'wants a list of body ids');
    for (const id of raw[key]) if (ctx.index[id] === undefined) fail(`${where}.${key}`, `no body '${id}'`);
    entry[key] = raw[key].slice();
  }
  if (row.shape === 'link') {
    const b = raw.between;
    if (!Array.isArray(b) || b.length !== 2) fail(`${where}.between`, "wants [body, body] or [body, [x, y, z]] (a fixed point)");
    if (ctx.index[b[0]] === undefined) fail(`${where}.between[0]`, `no body '${b[0]}'`);
    if (typeof b[1] === 'string') {
      if (ctx.index[b[1]] === undefined) fail(`${where}.between[1]`, `no body '${b[1]}'`);
      if (b[1] === b[0]) fail(`${where}.between`, 'links a body to itself');
      if (ctx.bodies[ctx.index[b[0]]].fixed && ctx.bodies[ctx.index[b[1]]].fixed) fail(`${where}.between`, 'links two fixed bodies');
      entry.between = [b[0], b[1]];
    } else {
      if (ctx.bodies[ctx.index[b[0]]].fixed) fail(`${where}.between[0]`, 'a fixed body tied to a fixed point does nothing');
      entry.between = [b[0], vector(b[1], 'length', `${where}.between[1]`)];
    }
  }
  for (const [name, spec] of Object.entries(row.params)) {
    const v = raw[name];
    if (v === undefined) { if (spec.required) fail(`${where}.${name}`, `'${row.id}' needs ${name} (a ${spec.dim})`); continue; }
    if (spec.number) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(`${where}.${name}`, 'wants a positive number (SI)');
      entry[name] = v;
    } else entry[name] = spec.vector ? vector(v, spec.dim, `${where}.${name}`) : quantity(v, spec.dim, `${where}.${name}`);
  }
  const bad = row.validate?.(entry, ctx);
  if (bad) fail(where, `${row.id}: ${bad}`);
  return { row, entry };
}

/** The params a classical world's mint takes, normalized, with every unknown law named as a gap. */
export function normalizeClassical(params) {
  const { model, dress, liberties } = splitParams(params);
  const extra = Object.keys(model).filter((k) => !['frame', 'bodies', 'laws', 'observe', 'duration', 'dt', 'stepper'].includes(k));
  if (extra.length) fail('model', `unknown field '${extra[0]}'`);
  const frame = normalizeFrame(model.frame);
  const bodies = normalizeBodies(model.bodies);
  const index = Object.fromEntries(bodies.map((b, i) => [b.id, i]));
  const ctx = { bodies, index, frame };
  if (!Array.isArray(model.laws)) fail('model.laws', "wants [{ law: '<id>', … }]");
  if (model.laws.length > MAX_LAWS) fail('model.laws', `at most ${MAX_LAWS}`);
  const lawIds = new Set(), laws = [], gaps = [];
  const known = CLASSICAL_LAWS.map((r) => r.id);
  model.laws.forEach((raw, i) => {
    const r = normalizeLaw(raw, i, ctx, lawIds);
    if (r.gap) gaps.push(gapFor(r.gap, 'classical', known)); else laws.push(r);
  });
  // gravity the frame actually has: the first uniform-gravity law's g (0 when none)
  const grav = laws.find((l) => l.row.id === 'gravity-uniform');
  frame.gravity = grav ? grav.entry.g ?? frame.g : 0;
  frame.gvec = frame.up.map((c) => -frame.gravity * c);
  if (laws.some((l) => l.row.id === 'buoyancy') && !frame.gravity) fail('model.laws', 'buoyancy needs gravity: add { law: \'gravity-uniform\' }');
  // a body set on a plane sits on its surface, not moving into it
  for (const b of bodies) {
    if (!b.on_plane) continue;
    const p = laws.find((l) => l.row.id === 'plane' && l.entry.id === b.on_plane);
    if (!p) fail(`model.bodies.${b.id}.on_plane`, `no plane law with id '${b.on_plane}'`);
    const n = planeNormal(p.entry, ctx), pt = p.entry.point ?? [0, 0, 0];
    const s = dot(sub(b.at, pt), n) - b.radius;
    b.at = b.at.map((c, k) => c - s * n[k]);
    const vn = dot(b.v, n);
    if (vn < 0) b.v = b.v.map((c, k) => c - vn * n[k]);
  }
  const duration = quantity(model.duration, 'time', 'model.duration');
  if (!(duration > 0)) fail('model.duration', 'must be > 0');
  const dt = model.dt === undefined ? undefined : quantity(model.dt, 'time', 'model.dt');
  if (dt !== undefined && !(dt > 0)) fail('model.dt', 'must be > 0');
  if (model.stepper !== undefined && !['verlet', 'rk4'].includes(model.stepper)) fail('model.stepper', "is 'verlet' or 'rk4'");
  const observe = normalizeObserve(model.observe, index);
  return { model: { frame, bodies, laws, duration, dt, stepper: model.stepper, observe }, ctx, gaps, dress: dress ?? null, liberties };
}

const OBSERVABLES = {
  energy: { body: false }, momentum: { body: false }, 'angular-momentum': { body: false },
  speed: { body: true }, height: { body: true }, apex: { body: true }, range: { body: true }, period: { body: true },
  position: { body: true }, velocity: { body: true },
};

function normalizeObserve(list, index) {
  if (list === undefined) return [{ quantity: 'energy' }];
  if (!Array.isArray(list)) fail('model.observe', "wants ['energy', { quantity: 'period', of: '<body>' }, …]");
  return list.map((o, i) => {
    const q = typeof o === 'string' ? { quantity: o } : o;
    if (!isObj(q) || !OBSERVABLES[q.quantity]) fail(`model.observe[${i}]`, `observes one of ${Object.keys(OBSERVABLES).join(', ')}`);
    if (OBSERVABLES[q.quantity].body) {
      if (index[q.of] === undefined) fail(`model.observe[${i}].of`, `'${q.quantity}' names a body: { quantity: '${q.quantity}', of: '<id>' }`);
      if (q.axis !== undefined && (!Array.isArray(q.axis) || q.axis.length !== 3 || !(len(q.axis) > 0))) fail(`model.observe[${i}].axis`, 'wants [x, y, z]');
      return { quantity: q.quantity, of: q.of, ...(q.axis ? { axis: q.axis.map((c) => c / len(q.axis)) } : {}) };
    }
    return { quantity: q.quantity };
  });
}

/** The kernel's system from a normalized model. */
function resolveSystem(model, ctx) {
  const desc = {
    bodies: model.bodies.map((b) => ({ m: b.mass ?? 0, r: b.radius, q: b.charge ?? 0, fixed: b.fixed, x: b.at, v: b.v })),
    forces: [], planes: [], rods: [], collisions: [],
  };
  for (const { row, entry } of model.laws) {
    const r = row.resolve(entry, ctx);
    if (r.force) desc.forces.push(r.force);
    if (r.plane) desc.planes.push(r.plane);
    if (r.rod) desc.rods.push(r.rod);
    if (r.collision) desc.collisions.push(r.collision);
  }
  return desc;
}

function flagsOf(model, ctx) {
  const all = model.laws.map(({ row, entry }) => row.flags(entry, ctx));
  return {
    velocityDependent: all.some((f) => f.velocityDependent),
    dissipative: all.some((f) => f.dissipative),
    external: all.some((f) => f.external),
    central: all.every((f) => f.central),
    contact: all.some((f) => f.contact),
  };
}

// the fastest motion the model can make: each law's own timescale, and for contacts the time to cross a radius
function fastest(model, ctx, desc) {
  const ts = [];
  for (const { row, entry } of model.laws) { const t = row.timescale(entry, ctx); if (t > 0 && Number.isFinite(t)) ts.push({ t, from: row.id }); }
  const touching = new Set([...desc.planes.flatMap((p) => p.idx), ...desc.collisions.flatMap((c) => c.idx)]);
  const radii = [...touching].map((i) => model.bodies[i].radius).filter((r) => r > 0);
  if (radii.length) {
    const lo = model.bodies.reduce((m, b) => Math.min(m, dot(b.at, ctx.frame.up)), Infinity);
    const drop = Math.max(...model.bodies.map((b) => dot(b.at, ctx.frame.up) - lo), 0)
      + Math.max(0, ...desc.planes.flatMap((p) => p.idx.map((i) => dot(sub(model.bodies[i].at, p.p), p.n))));
    const vc = Math.max(...model.bodies.map((b) => len(b.v)), 0) + Math.sqrt(2 * ctx.frame.gravity * drop);
    if (vc > 0) ts.push({ t: (20 * Math.min(...radii)) / vc, from: 'contact' });
  }
  return ts.sort((a, b) => a.t - b.t)[0] || null;
}

function gate(id, want, ok, value, detail) { return { id, want, ok: !!ok, value, detail }; }

/** Solve a classical world: the normalized model, its run as tracks and series, the readouts, the gates and the gaps. */
export function solveClassical(params) {
  const { model, ctx, gaps, dress, liberties } = normalizeClassical(params);
  const desc = resolveSystem(model, ctx);
  const flags = flagsOf(model, ctx);
  const warnings = [];

  let stepper = model.stepper ?? (flags.velocityDependent ? 'rk4' : 'verlet');
  if (stepper === 'verlet' && flags.velocityDependent) {
    warnings.push('verlet reads position alone and these laws read velocity: stepped with rk4');
    stepper = 'rk4';
  }

  const fast = fastest(model, ctx, desc);
  const samples = Math.max(60, Math.min(MAX_SAMPLES, Math.max(Math.round(model.duration * 60), fast ? Math.ceil((SAMPLES_PER_PERIOD * model.duration) / fast.t) : 0)));
  const interval = model.duration / samples;
  const target = model.dt ?? (fast ? fast.t / STEPS_PER_PERIOD : interval);
  let substeps = Math.max(1, Math.ceil(interval / target - 1e-9));
  if (samples * substeps > MAX_STEPS) {
    substeps = Math.max(1, Math.floor(MAX_STEPS / samples));
    warnings.push(`the step budget (${MAX_STEPS} steps) coarsened dt; shorten the duration or accept the gates' advice`);
  }
  const dt = interval / substeps;
  const run = classical.run(desc, { interval, substeps, samples, stepper });

  const gates = [];
  if (fast) {
    gates.push(gate('dt-resolves', `dt ≤ T/${RESOLVES} for the fastest motion (${fast.from})`, dt <= fast.t / RESOLVES,
      { dt: sig(dt), timescale: sig(fast.t) }, `dt splits it ${sig(fast.t / dt, 3)} times`));
  }
  const E = run.ke.map((k, i) => k + run.pe[i]);
  const exchanged = Math.max(...run.ke) + Math.max(...run.pe.map((p) => Math.abs(p - run.pe[0])));
  const scale = exchanged > 0 ? exchanged : Math.max(Math.abs(E[0]), 1e-300);
  const tolE = flags.contact ? 2e-3 : 1e-4;
  if (!flags.dissipative) {
    const drift = Math.max(...E.map((e) => Math.abs(e - E[0]))) / scale;
    gates.push(gate('energy-conserved', `total energy holds within ${tolE * 100}% of the energy in play`, drift <= tolE, { drift: sig(drift, 3) },
      drift <= tolE ? 'kinetic and potential trade, the total holds' : 'the total drifts: a smaller dt would hold it'));
  } else {
    const gain = Math.max(0, ...E.map((e) => e - E[0])) / scale;
    gates.push(gate('energy-never-gained', `a losing system never gains energy (within ${tolE * 100}%)`, gain <= tolE, { gain: sig(gain, 3), lost: sig((E[0] - E[E.length - 1]) / scale, 3) },
      gain <= tolE ? 'energy only leaves (drag, friction, inelastic contacts)' : 'energy appears from nowhere: a smaller dt would stop it'));
  }
  if (!flags.external) {
    const pScale = Math.max(...run.v.map((v) => model.bodies.reduce((s, b, i) => s + (b.fixed ? 0 : b.mass * Math.hypot(v[3 * i], v[3 * i + 1], v[3 * i + 2])), 0)), 1e-300);
    const dp = Math.max(...run.p.map((p) => len(sub(p, run.p[0])))) / pScale;
    gates.push(gate('momentum-conserved', 'total momentum holds (no outside force acts)', dp <= 1e-8, { drift: sig(dp, 3) }, 'only internal forces act, so momentum cannot change'));
    if (flags.central) {
      const lScale = Math.max(...run.x.map((x, k) => model.bodies.reduce((s, b, i) => s + (b.fixed ? 0 : b.mass * len(x.slice(3 * i, 3 * i + 3)) * len(run.v[k].slice(3 * i, 3 * i + 3))), 0)), 1e-300);
      const dL = Math.max(...run.L.map((L) => len(sub(L, run.L[0])))) / lScale;
      gates.push(gate('angular-momentum-conserved', 'total angular momentum holds (central forces only)', dL <= 1e-6, { drift: sig(dL, 3) }, 'every force acts along the line between bodies'));
    }
  }
  if (desc.rods.some((r) => !r.rope)) {
    gates.push(gate('constraints-held', 'rods keep their length within one part in a million', run.maxRodError <= 1e-6, { error: sig(run.maxRodError, 3) }, 'rigid links stay rigid'));
  }
  const colliders = desc.collisions.flatMap((c) => c.idx).map((i) => model.bodies[i].radius).filter((r) => r > 0);
  if (colliders.length) {
    const step = run.maxSpeed * dt, rmin = Math.min(...colliders);
    gates.push(gate('no-tunnelling', 'no body moves more than half the smallest radius in one step', step <= rmin / 2, { step: sig(step), radius: sig(rmin) }, 'contacts cannot be stepped over'));
  }
  gates.push(gate('newtonian-regime', 'every speed stays below a tenth of light', run.maxSpeed <= 0.1 * C_LIGHT, { fraction: sig(run.maxSpeed / C_LIGHT, 3) },
    run.maxSpeed <= 0.1 * C_LIGHT ? 'relativity changes nothing visible here' : 'near light speed Newton is wrong: this needs relativity, outside the classical scale'));
  let worst = 0;
  model.bodies.forEach((b, i) => {
    if (b.fixed || !(b.mass > 0)) return;
    let vmax = 0;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    run.x.forEach((x, k) => {
      for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], x[3 * i + c]); hi[c] = Math.max(hi[c], x[3 * i + c]); }
      vmax = Math.max(vmax, Math.hypot(run.v[k][3 * i], run.v[k][3 * i + 1], run.v[k][3 * i + 2]));
    });
    const path = Math.max(len(sub(hi, lo)), b.radius);
    if (vmax > 0 && path > 0) worst = Math.max(worst, H_PLANCK / (b.mass * vmax) / path);
  });
  gates.push(gate('classical-regime', 'each body\'s de Broglie wavelength is under a thousandth of its path', worst <= 1e-3, { ratio: sig(worst, 3) },
    worst <= 1e-3 ? 'waves are far too small to matter: the motion is classical' : 'the wavelength is comparable to the path: this belongs to the quantum scale'));

  const m = {
    bodies: model.bodies, laws: model.laws, frame: ctx.frame, duration: model.duration, ctx, G: G_NEWTON, resolved: desc,
    restingOn: (i, p) => !!classical.system(desc).contact[p]?.[i],
  };
  gates.push(...closedFormGates(m, run));

  const ids = model.bodies.map((b) => b.id);
  const tracks = {
    t: run.t.map((t) => sig(t, 9)),
    bodies: Object.fromEntries(ids.map((id, i) => [id, {
      x: run.x.map((x) => sigv(x.slice(3 * i, 3 * i + 3), 9)),
      v: run.v.map((v) => sigv(v.slice(3 * i, 3 * i + 3), 9)),
    }])),
  };
  const series = { ke: run.ke.map((v) => sig(v)), pe: run.pe.map((v) => sig(v)), e: E.map((v) => sig(v)), p: run.p.map((p) => sigv(p)), L: run.L.map((L) => sigv(L)) };

  const assumptions = [BASE_ASSUMPTION, ...new Set(model.laws.map(({ row }) => row.assumption))];
  return {
    scale: 'classical',
    model: { ...model, laws: model.laws.map(({ entry }) => entry) },
    dress, liberties, assumptions, gaps, warnings,
    stepper, dt: sig(dt), substeps, samples, steps: samples * substeps,
    tracks, series,
    observed: observe(model, run, ctx, E),
    gates, held: gates.every((g) => g.ok),
    stats: {
      duration: sig(model.duration), bodies: model.bodies.length, laws: model.laws.length,
      timescale: fast ? sig(fast.t) : null, maxSpeed: sig(run.maxSpeed),
      energy: { start: sig(E[0]), end: sig(E[E.length - 1]) },
    },
  };
}

/** The stats digest a classical mint reports and research review recomputes: one function, so they cannot drift. */
export function classicalStats(r) {
  return { ...r.stats, stepper: r.stepper, dt: r.dt, steps: r.steps, samples: r.samples, held: r.held };
}

function observe(model, run, ctx, E) {
  const up = ctx.frame.up, last = run.t.length - 1, out = {};
  const index = Object.fromEntries(model.bodies.map((b, i) => [b.id, i]));
  for (const o of model.observe) {
    const i = index[o.of], key = o.of ? `${o.quantity}:${o.of}` : o.quantity;
    if (o.quantity === 'energy') out[key] = { kinetic: sig(run.ke[0]), potential: sig(run.pe[0]), start: sig(E[0]), end: sig(E[last]), unit: 'J' };
    else if (o.quantity === 'momentum') out[key] = { start: sigv(run.p[0]), end: sigv(run.p[last]), unit: 'kg·m/s' };
    else if (o.quantity === 'angular-momentum') out[key] = { start: sigv(run.L[0]), end: sigv(run.L[last]), unit: 'kg·m²/s' };
    else if (o.quantity === 'speed') {
      const s = run.t.map((t, k) => Math.hypot(...vel(run, k, i)));
      out[key] = { start: sig(s[0]), max: sig(Math.max(...s)), end: sig(s[last]), unit: 'm/s' };
    } else if (o.quantity === 'height') {
      const h = along(run, i, up);
      out[key] = { start: sig(h[0]), max: sig(peak(h)), min: sig(Math.min(...h)), end: sig(h[last]), unit: 'm' };
    } else if (o.quantity === 'apex') {
      const h = along(run, i, up);
      out[key] = { value: sig(peak(h) - h[0]), unit: 'm' };
    } else if (o.quantity === 'range') {
      const r = returnRange(run, i, up);
      out[key] = { value: r === null ? null : sig(r), unit: 'm', ...(r === null ? { note: 'it does not come back down to its launch height within the run' } : {}) };
    } else if (o.quantity === 'period') {
      const axis = o.axis ?? widest(run, i);
      const T = period(along(run, i, axis), run.t);
      out[key] = { value: T === null ? null : sig(T), unit: 's', axis: sigv(axis), ...(T === null ? { note: 'fewer than two full swings within the run' } : {}) };
    } else if (o.quantity === 'position') out[key] = { start: sigv(at(run, 0, i)), end: sigv(at(run, last, i)), unit: 'm' };
    else if (o.quantity === 'velocity') out[key] = { start: sigv(vel(run, 0, i)), end: sigv(vel(run, last, i)), unit: 'm/s' };
  }
  return out;
}

// the axis a body moves along most (of x, y, z), for a period nobody gave an axis for
function widest(run, i) {
  const span = [0, 1, 2].map((c) => {
    const s = run.x.map((x) => x[3 * i + c]);
    return Math.max(...s) - Math.min(...s);
  });
  const c = span.indexOf(Math.max(...span));
  return [0, 1, 2].map((k) => (k === c ? 1 : 0));
}
