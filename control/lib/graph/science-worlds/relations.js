/**
 * The HANDOFF between scales: one rung reads another's measured series, mapped through a declared RELATION with its
 * source. Data flows up the ladder: a microscopic run's aggregated share becomes a classical liquid's yield and
 * viscosity. A relation is a row of this table with a citation, never a free function: the recipe picks a row and gives
 * the numbers the row asks for, and the page names the row and its source.
 *
 *   RELATIONS                    the rows: { id, reads, sets, formula, takes, citation, read(args, where), apply(x, a, base) }
 *   readRelations(list, where)   → [{ row, args }]: at most one relation per property set
 *   readHandoff(raw, where)      → { scale, observe, t: [s], values: [x], held, gates, title }: the lower rung, run
 *   handoffCurve(handoff, relations, medium) → { t, eta, tau }: the curve a gelling law steps along (gel.js's shape)
 *
 * Each rung keeps its own clock (seconds are seconds); past the lower rung's last sample its value holds, and the
 * readout says from when.
 */

import { quantity } from './contract.js';
import { solveMicroscopic } from './microscopic/solve.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const share = (v, where) => {
  if (typeof v !== 'number' || !(v >= 0 && v < 1)) fail(where, 'is a share, 0 or more and under 1');
  return v;
};

export const RELATIONS = [
  {
    id: 'percolation',
    reads: 'fraction', sets: 'yield',
    formula: 'τy = top · ((f − onset) / (1 − onset))^1.9 once the assembled share f passes the gel point `onset`, none before',
    takes: { top: 'the yield (Pa) when all of it has assembled; required', onset: 'the gel point, a share; default 0' },
    citation: 'de Gennes, J. Physique Lettres 1976: a gel\'s elasticity grows from its gel point with the percolation exponent, about 1.9 in three dimensions; the yield is taken to grow as the elasticity does',
    read(raw, where) {
      if (raw.top === undefined) fail(`${where}.top`, 'wants the yield when all of it has assembled (a stress)');
      const top = quantity(raw.top, 'stress', `${where}.top`);
      if (!(top > 0)) fail(`${where}.top`, 'is above 0');
      return { top, onset: raw.onset === undefined ? 0 : share(raw.onset, `${where}.onset`) };
    },
    apply: (f, a) => (f <= a.onset ? 0 : a.top * ((f - a.onset) / (1 - a.onset)) ** 1.9),
  },
  {
    id: 'krieger-dougherty',
    reads: 'fraction', sets: 'viscosity',
    formula: 'η = η₀ · (1 − φ/φm)^(−2.5·φm), the assembled matter filling φ = phi · f of the volume, φm = 0.64',
    takes: { phi: 'the share of the volume the assembled matter fills when all of it has assembled, under 0.64; required' },
    citation: 'Krieger & Dougherty, Trans. Soc. Rheol. 1959; the intrinsic viscosity 2.5 is Einstein\'s, and φm = 0.64 is random close packing',
    read(raw, where) {
      if (raw.phi === undefined) fail(`${where}.phi`, 'wants the share of the volume the assembled matter fills');
      const phi = share(raw.phi, `${where}.phi`);
      if (!(phi < 0.64)) fail(`${where}.phi`, 'is under 0.64 (random close packing: the liquid would no longer flow)');
      return { phi };
    },
    apply: (f, a, eta0) => eta0 * (1 - (a.phi * f) / 0.64) ** (-2.5 * 0.64),
  },
];
export const RELATION = Object.fromEntries(RELATIONS.map((r) => [r.id, r]));

export function readRelations(list, where) {
  if (!Array.isArray(list) || !list.length) fail(where, `wants [{ relation, … }] (${RELATIONS.map((r) => `${r.id} sets the ${r.sets}`).join('; ')})`);
  const seen = new Set();
  return list.map((raw, k) => {
    const w = `${where}[${k}]`;
    if (!isObj(raw) || !RELATION[raw.relation]) fail(`${w}.relation`, `is one of ${RELATIONS.map((r) => r.id).join(', ')}`);
    const row = RELATION[raw.relation];
    const extra = Object.keys(raw).filter((x) => x !== 'relation' && !(x in row.takes));
    if (extra.length) fail(`${w}.${extra[0]}`, `'${row.id}' takes ${Object.keys(row.takes).join(', ')}`);
    if (seen.has(row.sets)) fail(w, `two relations set the ${row.sets}`);
    seen.add(row.sets);
    return { row, args: row.read(raw, w) };
  });
}

/** The lower rung, run: a microscopic model whose aggregation's assembled share is read (`observe: 'aggregated'`). */
export function readHandoff(raw, where) {
  if (!isObj(raw)) fail(where, "wants { microscopic: <model>, observe: 'aggregated' }");
  const extra = Object.keys(raw).filter((k) => !['microscopic', 'observe'].includes(k));
  if (extra.length) fail(`${where}.${extra[0]}`, 'a handoff takes microscopic (the model read) and observe');
  if (!isObj(raw.microscopic)) fail(`${where}.microscopic`, 'wants the microscopic model the share is read from (its aggregation law)');
  if ((raw.observe ?? 'aggregated') !== 'aggregated') fail(`${where}.observe`, "is 'aggregated': the share of the species its aggregation law has assembled");
  let lower;
  try { lower = solveMicroscopic({ model: raw.microscopic }); } catch (e) { fail(`${where}.microscopic`, e.message.replace(/^science-worlds: /, '')); }
  if (!lower.series.aggregation) fail(`${where}.microscopic`, 'has no aggregation law: there is no assembled share to read');
  return {
    scale: 'microscopic', observe: 'aggregated', of: lower.aggregation.of,
    t: lower.tracks.t, values: lower.series.aggregation.fraction, held: lower.held,
    gates: lower.gates.map((g) => ({ id: g.id, ok: g.ok })), duration: lower.tracks.t[lower.tracks.t.length - 1],
  };
}

/** The curve a gelling law steps along, from the lower rung's share through the relations (the medium's own where none sets). */
export function handoffCurve(handoff, relations, medium) {
  const set = Object.fromEntries(relations.map((r) => [r.row.sets, r]));
  const eta0 = medium.viscosity, tau0 = medium.yield ?? 0;
  return {
    t: handoff.t.slice(),
    eta: handoff.values.map((f) => (set.viscosity ? set.viscosity.row.apply(f, set.viscosity.args, eta0) : eta0)),
    tau: handoff.values.map((f) => (set.yield ? tau0 + set.yield.row.apply(f, set.yield.args) : tau0)),
  };
}
