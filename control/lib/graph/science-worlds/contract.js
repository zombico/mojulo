/**
 * Science worlds — the recipe's contract, shared by every scale.
 *
 *   params: {
 *     model:     { frame?, bodies, laws, observe?, duration, dt?, stepper? },   examined: dimension-checked, gated, measurable
 *     dress:     { … },                                                          sells the picture: the eyes gate's, never read by a solver
 *     liberties: [{ what, why }],                                               declared exaggerations of size, time, colour, crowding
 *   }
 *
 * A number is canonical SI. A string ('500 g', '12 km/h', '30 deg') or a pair ([12, 'km/h']) is read through the
 * unit table and must carry the dimension its slot wants: a mass given in m/s is an error, not a coercion. The agent
 * reads the teacher's words and writes this spec; nothing here reads language.
 *
 * Pure: no rendering, no DB. Same params → the same normalized spec.
 */

import { UNITS, DIM, qty, dimensionOf } from '../machina/quantities.js';

export const SCALES = ['classical', 'microscopic', 'quantum'];

export const MAX_BODIES = 64;
export const MAX_LAWS = 32;
export const MAX_LIBERTIES = 16;

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * One quantity in canonical SI. `want` names a DIM entry ('mass', 'length', …). A bare number is taken as already
 * canonical; a string '<number> <unit>' or a pair [number, unit] is converted and its dimension checked.
 */
export function quantity(value, want, where) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(where, `not a finite number`);
    return value;
  }
  let n, unit;
  if (Array.isArray(value) && value.length === 2 && typeof value[1] === 'string') [n, unit] = value;
  else if (typeof value === 'string') {
    const m = value.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*(.*)$/i);
    if (!m) fail(where, `'${value}' is not a number with a unit`);
    n = +m[1]; unit = m[2].trim();
  } else fail(where, `wants a ${want} (a number in SI, or '<number> <unit>')`);
  if (!(unit in UNITS)) fail(where, `unknown unit '${unit}'`);
  if (!DIM[want]) fail(where, `unknown dimension '${want}'`);
  const q = qty(n, unit);
  // equal signatures have equal names, so comparing names is the dimension guard
  const got = dimensionOf(q);
  if (got !== dimensionOf({ v: 0, d: DIM[want] })) fail(where, `wants a ${want}, got '${unit}' (a ${got})`);
  return q.v;
}

/** A 3-vector of one dimension: [x, y, z], each component a quantity. */
export function vector(value, want, where) {
  if (!Array.isArray(value) || value.length !== 3) fail(where, `wants [x, y, z] (${want})`);
  return value.map((c, i) => quantity(c, want, `${where}[${i}]`));
}

/** A positive quantity (mass, radius, stiffness…). `zero` allows 0. */
export function positive(value, want, where, { zero = false } = {}) {
  const v = quantity(value, want, where);
  if (zero ? v < 0 : v <= 0) fail(where, `must be ${zero ? '≥ 0' : '> 0'}`);
  return v;
}

const idOk = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(s);

/**
 * The model's bodies: `{ id, mass?, radius?, at, v?, charge?, fixed?, on_plane? }`. A fixed body never moves (it may
 * still pull: a fixed sun) and needs no mass unless a law reads it. Ids are unique, short, and what laws and dress
 * name the body by.
 */
export function normalizeBodies(list) {
  if (!Array.isArray(list) || !list.length) fail('model.bodies', 'wants at least one body');
  if (list.length > MAX_BODIES) fail('model.bodies', `at most ${MAX_BODIES}`);
  const seen = new Set();
  return list.map((b, i) => {
    const where = `model.bodies[${i}]`;
    if (!isObj(b)) fail(where, 'wants { id, mass, at, … }');
    if (!idOk(b.id)) fail(`${where}.id`, 'wants a short id (letters, digits, - and _)');
    if (seen.has(b.id)) fail(`${where}.id`, `'${b.id}' is used twice`);
    seen.add(b.id);
    const fixed = b.fixed === true;
    const out = { id: b.id, fixed };
    if (b.mass !== undefined || !fixed) out.mass = positive(b.mass, 'mass', `${where}.mass`);
    out.radius = b.radius === undefined ? 0 : positive(b.radius, 'length', `${where}.radius`, { zero: true });
    out.at = vector(b.at ?? [0, 0, 0], 'length', `${where}.at`);
    out.v = fixed ? [0, 0, 0] : vector(b.v ?? [0, 0, 0], 'velocity', `${where}.v`);
    if (b.charge !== undefined) out.charge = quantity(b.charge, 'charge', `${where}.charge`);
    if (b.on_plane !== undefined) {
      if (!idOk(b.on_plane)) fail(`${where}.on_plane`, 'names a plane law by its id');
      out.on_plane = b.on_plane;
    }
    return out;
  });
}

/** Declared exaggerations: `[{ what, why }]`, kept short; the page shows every one. */
export function normalizeLiberties(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) fail('liberties', 'wants [{ what, why }]');
  if (list.length > MAX_LIBERTIES) fail('liberties', `at most ${MAX_LIBERTIES}`);
  return list.map((l, i) => {
    if (typeof l === 'string' && l.trim()) return { what: l.trim().slice(0, 160) };
    if (!isObj(l) || typeof l.what !== 'string' || !l.what.trim()) fail(`liberties[${i}]`, 'wants { what, why }');
    return { what: l.what.trim().slice(0, 160), ...(typeof l.why === 'string' && l.why.trim() ? { why: l.why.trim().slice(0, 240) } : {}) };
  });
}

/**
 * The params split: `model` goes to the scale's solver, `dress` to the page and nowhere else, `liberties` to the
 * honesty panel. Anything else at the top level is an error, so a model field put beside `model` is caught rather
 * than silently ignored.
 */
export function splitParams(params) {
  if (!isObj(params)) fail('params', 'wants { model, dress?, liberties? }');
  const extra = Object.keys(params).filter((k) => !['model', 'dress', 'liberties'].includes(k));
  if (extra.length) fail('params', `unknown field${extra.length > 1 ? 's' : ''} ${extra.map((k) => `'${k}'`).join(', ')} (the model goes under 'model')`);
  if (!isObj(params.model)) fail('params.model', 'wants { bodies, laws, duration, … }');
  if (params.dress !== undefined && !isObj(params.dress)) fail('params.dress', 'wants an object');
  return { model: params.model, dress: params.dress, liberties: normalizeLiberties(params.liberties) };
}
