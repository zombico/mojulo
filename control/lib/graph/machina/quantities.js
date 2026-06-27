/**
 * machina/quantities.js — the canonical-SI quantity ontology with dimensional guard + unit adapters.
 *
 * The reason this exists (and the science viewers never needed it): Machina must multiply weight ×
 * count, compare work to capacity, and divide work by time. That only stays honest if every quantity
 * carries its dimension and combining them is checked. So a Quantity is a value *in canonical SI*
 * (kg, m, s and their derivations N, J, W) tagged with a dimension signature. Operators speak their
 * own units at the edges (lb, ft, min, kWh, "pallets"); the engine runs in canonical and only the
 * adapters convert. A dimension mismatch is an error, not a silent coercion — the dimensional sanity
 * the side-by-side viewers never enforced.
 *
 * Pure: no rendering, no three.js, no DB. Same inputs → byte-identical outputs.
 */

import { clampNum } from '../motion-vocabulary.js';

// ── dimension signatures: exponents of the SI base [M(ass), L(ength), T(ime)]. Derived quantities are
// products of these — force = M·L·T⁻², work = M·L²·T⁻², power = M·L²·T⁻³. Count is dimensionless. ──
const dim = (M = 0, L = 0, T = 0) => ({ M, L, T });
export const DIM = {
  scalar: dim(), mass: dim(1, 0, 0), length: dim(0, 1, 0), time: dim(0, 0, 1),
  velocity: dim(0, 1, -1), accel: dim(0, 1, -2),
  force: dim(1, 1, -2), work: dim(1, 2, -2), power: dim(1, 2, -3),
};
const dimEq = (a, b) => a.M === b.M && a.L === b.L && a.T === b.T;
const dimMul = (a, b) => dim(a.M + b.M, a.L + b.L, a.T + b.T);
const dimDiv = (a, b) => dim(a.M - b.M, a.L - b.L, a.T - b.T);
const dimName = (d) => Object.keys(DIM).find((k) => dimEq(DIM[k], d)) || `M${d.M}L${d.L}T${d.T}`;

// ── unit table: `unit → [dimension, factor-to-canonical]`. Multiply an operator value by the factor to
// reach canonical SI; divide to present. Add domain units (pallets, cases) as scalar aliases. ──
const U = (d, f) => [d, f];
export const UNITS = {
  // mass
  kg: U(DIM.mass, 1), g: U(DIM.mass, 1e-3), t: U(DIM.mass, 1000), lb: U(DIM.mass, 0.45359237),
  // length
  m: U(DIM.length, 1), mm: U(DIM.length, 1e-3), cm: U(DIM.length, 0.01), km: U(DIM.length, 1000),
  ft: U(DIM.length, 0.3048), in: U(DIM.length, 0.0254),
  // time
  s: U(DIM.time, 1), min: U(DIM.time, 60), h: U(DIM.time, 3600),
  // velocity
  'm/s': U(DIM.velocity, 1), 'km/h': U(DIM.velocity, 1 / 3.6), mph: U(DIM.velocity, 0.44704),
  // force
  N: U(DIM.force, 1), kN: U(DIM.force, 1000), kgf: U(DIM.force, 9.80665), lbf: U(DIM.force, 4.4482216152605),
  // work / energy
  J: U(DIM.work, 1), kJ: U(DIM.work, 1000), Wh: U(DIM.work, 3600), kWh: U(DIM.work, 3.6e6),
  // power
  W: U(DIM.power, 1), kW: U(DIM.power, 1000), hp: U(DIM.power, 745.699872),
  // count / dimensionless (the demand multiplicity — "units", "pallets", "cases" are all scalar)
  '': U(DIM.scalar, 1), unit: U(DIM.scalar, 1), units: U(DIM.scalar, 1),
  pallet: U(DIM.scalar, 1), pallets: U(DIM.scalar, 1), case: U(DIM.scalar, 1), cases: U(DIM.scalar, 1), item: U(DIM.scalar, 1), items: U(DIM.scalar, 1),
};

// ── standard gravity (m/s²) as named worlds, matching mechanics-view's MOON_G convention. ──
export const G = { earth: 9.8, moon: 1.62, mars: 3.71, jupiter: 24.79 };

// ── Quantity: { v: canonical value, d: dimension }. Construct from an operator value + unit. ──
const Q = (v, d) => ({ v, d });
export function qty(value, unit = '') {
  const u = UNITS[unit];
  if (!u) throw new Error(`machina/quantities: unknown unit "${unit}"`);
  const n = +value;
  if (!Number.isFinite(n)) throw new Error(`machina/quantities: non-finite value for "${unit}"`);
  return Q(n * u[1], u[0]);
}
export const count = (n) => qty(clampNum(n, 0, Infinity, 0), '');   // demand multiplicity, never negative

// ── present a quantity in a target unit. Guards dimension: asking for a length in newtons throws. ──
export function toUnit(q, unit) {
  const u = UNITS[unit];
  if (!u) throw new Error(`machina/quantities: unknown unit "${unit}"`);
  if (!dimEq(q.d, u[0])) throw new Error(`machina/quantities: dimension mismatch — quantity is ${dimName(q.d)}, asked for "${unit}" (${dimName(u[0])})`);
  return q.v / u[1];
}
export const fmt = (q, unit, dp = 2) => `${toUnit(q, unit).toFixed(dp)} ${unit}`.trim();

// ── arithmetic. add/sub require matching dimension (the guard); mul/div combine dimensions; scale by a
// pure number leaves dimension untouched. These are the only legal ways to combine quantities. ──
export function add(a, b) {
  if (!dimEq(a.d, b.d)) throw new Error(`machina/quantities: cannot add ${dimName(a.d)} + ${dimName(b.d)}`);
  return Q(a.v + b.v, a.d);
}
export function sub(a, b) {
  if (!dimEq(a.d, b.d)) throw new Error(`machina/quantities: cannot subtract ${dimName(b.d)} from ${dimName(a.d)}`);
  return Q(a.v - b.v, a.d);
}
export const mul = (a, b) => Q(a.v * b.v, dimMul(a.d, b.d));
export const div = (a, b) => Q(a.v / b.v, dimDiv(a.d, b.d));
export const scale = (q, k) => Q(q.v * k, q.d);
export const lte = (a, b) => { if (!dimEq(a.d, b.d)) throw new Error(`machina/quantities: cannot compare ${dimName(a.d)} ≤ ${dimName(b.d)}`); return a.v <= b.v; };
export const dimensionOf = (q) => dimName(q.d);

// ── physics helpers, dimension-correct by construction ──
export const weight = (mass, g = G.earth) => mul(mass, Q(g, DIM.accel));   // w = m·g  → force
export const workOf = (force, distance) => mul(force, distance);           // W = F·d  → work
export const powerOf = (work, time) => div(work, time);                    // P = W/t  → power
