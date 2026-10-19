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

import { clampNum } from '../worlds/motion-vocabulary.js';

// ── dimension signatures: exponents of the SI base [M(ass), L(ength), T(ime)]. Derived quantities are
// products of these — force = M·L·T⁻², work = M·L²·T⁻², power = M·L²·T⁻³. Count is dimensionless.
// The science worlds add charge (Q), temperature (K) and amount (N), defaulted to zero so every signature
// above them keeps its meaning and its name. ──
const dim = (M = 0, L = 0, T = 0, Q = 0, K = 0, N = 0) => ({ M, L, T, Q, K, N });
export const DIM = {
  scalar: dim(), mass: dim(1, 0, 0), length: dim(0, 1, 0), time: dim(0, 0, 1),
  velocity: dim(0, 1, -1), accel: dim(0, 1, -2),
  force: dim(1, 1, -2), work: dim(1, 2, -2), power: dim(1, 2, -3),
  // the strength sensor's quantities: stress (force per area), area, and the second moment of area (L⁴).
  // Torque has the dimension of work (N·m); its units below are aliases, so the guard cannot tell them apart.
  stress: dim(1, -1, -2), area: dim(0, 2, 0), moment2: dim(0, 4, 0),
  // the science worlds' quantities: a fluid's density and viscosity, a spring's stiffness and a damper's
  // coefficient, a volume; charge and the fields that push on it (E in V/m = N/C, B in tesla); temperature and amount.
  density: dim(1, -3, 0), viscosity: dim(1, -1, -1), stiffness: dim(1, 0, -2), damping: dim(1, 0, -1), volume: dim(0, 3, 0),
  charge: dim(0, 0, 0, 1), efield: dim(1, 1, -2, -1), bfield: dim(1, 0, -1, -1),
  temperature: dim(0, 0, 0, 0, 1), amount: dim(0, 0, 0, 0, 0, 1),
  // the microscopic scale's: how fast things diffuse and leak, how much is dissolved, how fast it reacts
  diffusivity: dim(0, 2, -1), frequency: dim(0, 0, -1), concentration: dim(0, -3, 0, 0, 0, 1), rate2: dim(0, 3, -1, 0, 0, -1),
};
const AXES = ['M', 'L', 'T', 'Q', 'K', 'N'];
const dimEq = (a, b) => AXES.every((k) => (a[k] || 0) === (b[k] || 0));
const dimMul = (a, b) => dim(...AXES.map((k) => (a[k] || 0) + (b[k] || 0)));
const dimDiv = (a, b) => dim(...AXES.map((k) => (a[k] || 0) - (b[k] || 0)));
const dimName = (d) => Object.keys(DIM).find((k) => dimEq(DIM[k], d))
  || `M${d.M}L${d.L}T${d.T}` + ['Q', 'K', 'N'].map((k) => (d[k] ? `${k}${d[k]}` : '')).join('');

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
  N: U(DIM.force, 1), kN: U(DIM.force, 1000), pN: U(DIM.force, 1e-12), fN: U(DIM.force, 1e-15), kgf: U(DIM.force, 9.80665), lbf: U(DIM.force, 4.4482216152605),
  // work / energy
  J: U(DIM.work, 1), kJ: U(DIM.work, 1000), Wh: U(DIM.work, 3600), kWh: U(DIM.work, 3.6e6),
  // power
  W: U(DIM.power, 1), kW: U(DIM.power, 1000), hp: U(DIM.power, 745.699872),
  // torque (dimensionally work; named apart for the reader)
  'N·m': U(DIM.work, 1), Nm: U(DIM.work, 1), 'N·mm': U(DIM.work, 1e-3), Nmm: U(DIM.work, 1e-3),
  // stress
  Pa: U(DIM.stress, 1), kPa: U(DIM.stress, 1e3), MPa: U(DIM.stress, 1e6), GPa: U(DIM.stress, 1e9), 'N/mm²': U(DIM.stress, 1e6), psi: U(DIM.stress, 6894.757293168),
  // area and second moment of area
  'm²': U(DIM.area, 1), 'mm²': U(DIM.area, 1e-6), 'm⁴': U(DIM.moment2, 1), 'mm⁴': U(DIM.moment2, 1e-12),
  // count / dimensionless (the demand multiplicity — "units", "pallets", "cases" are all scalar)
  '': U(DIM.scalar, 1), unit: U(DIM.scalar, 1), units: U(DIM.scalar, 1),
  pallet: U(DIM.scalar, 1), pallets: U(DIM.scalar, 1), case: U(DIM.scalar, 1), cases: U(DIM.scalar, 1), item: U(DIM.scalar, 1), items: U(DIM.scalar, 1),
  // the science worlds' units. Small lengths and masses, short times, angles (dimensionless), acceleration, the
  // fluid and spring constants, charge and fields, temperature and amount.
  'µm': U(DIM.length, 1e-6), um: U(DIM.length, 1e-6), nm: U(DIM.length, 1e-9), mg: U(DIM.mass, 1e-6),
  AU: U(DIM.length, 1.495978707e11), 'km/s': U(DIM.velocity, 1000),
  ms: U(DIM.time, 1e-3), ns: U(DIM.time, 1e-9), 'µs': U(DIM.time, 1e-6), us: U(DIM.time, 1e-6), d: U(DIM.time, 86400), yr: U(DIM.time, 365.25 * 86400),
  rad: U(DIM.scalar, 1), deg: U(DIM.scalar, Math.PI / 180), '°': U(DIM.scalar, Math.PI / 180),
  'm/s²': U(DIM.accel, 1), 'm/s2': U(DIM.accel, 1),
  'kg/m³': U(DIM.density, 1), 'kg/m3': U(DIM.density, 1), 'g/cm³': U(DIM.density, 1000), 'g/cm3': U(DIM.density, 1000),
  'Pa·s': U(DIM.viscosity, 1), 'Pa*s': U(DIM.viscosity, 1), 'mPa·s': U(DIM.viscosity, 1e-3),
  'N/m': U(DIM.stiffness, 1), 'kN/m': U(DIM.stiffness, 1000), 'N·s/m': U(DIM.damping, 1), 'N*s/m': U(DIM.damping, 1), 'kg/s': U(DIM.damping, 1),
  'm³': U(DIM.volume, 1), 'm3': U(DIM.volume, 1), L: U(DIM.volume, 1e-3), mL: U(DIM.volume, 1e-6),
  C: U(DIM.charge, 1), mC: U(DIM.charge, 1e-3), 'µC': U(DIM.charge, 1e-6), uC: U(DIM.charge, 1e-6), nC: U(DIM.charge, 1e-9), e: U(DIM.charge, 1.602176634e-19),
  'V/m': U(DIM.efield, 1), 'N/C': U(DIM.efield, 1), 'kV/m': U(DIM.efield, 1000),
  T: U(DIM.bfield, 1), mT: U(DIM.bfield, 1e-3), 'µT': U(DIM.bfield, 1e-6), uT: U(DIM.bfield, 1e-6), gauss: U(DIM.bfield, 1e-4),
  K: U(DIM.temperature, 1), mol: U(DIM.amount, 1),
  // small speeds (a permeability is a speed), diffusion coefficients, concentrations (molar = mol per litre), rate
  // constants (first order per second; second order per molar per second)
  'mm/s': U(DIM.velocity, 1e-3), 'µm/s': U(DIM.velocity, 1e-6), 'um/s': U(DIM.velocity, 1e-6), 'nm/s': U(DIM.velocity, 1e-9), 'cm/s': U(DIM.velocity, 0.01),
  'm²/s': U(DIM.diffusivity, 1), 'm2/s': U(DIM.diffusivity, 1), 'cm²/s': U(DIM.diffusivity, 1e-4), 'cm2/s': U(DIM.diffusivity, 1e-4),
  'µm²/s': U(DIM.diffusivity, 1e-12), 'um2/s': U(DIM.diffusivity, 1e-12), 'µm2/s': U(DIM.diffusivity, 1e-12),
  '/s': U(DIM.frequency, 1), 's⁻¹': U(DIM.frequency, 1), 's^-1': U(DIM.frequency, 1), Hz: U(DIM.frequency, 1), '/min': U(DIM.frequency, 1 / 60),
  M: U(DIM.concentration, 1000), mM: U(DIM.concentration, 1), 'µM': U(DIM.concentration, 1e-3), uM: U(DIM.concentration, 1e-3), nM: U(DIM.concentration, 1e-6), 'mol/m³': U(DIM.concentration, 1),
  '/M/s': U(DIM.rate2, 1e-3), 'M⁻¹s⁻¹': U(DIM.rate2, 1e-3), 'M^-1s^-1': U(DIM.rate2, 1e-3), '/µM/s': U(DIM.rate2, 1e3), '/uM/s': U(DIM.rate2, 1e3),
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
