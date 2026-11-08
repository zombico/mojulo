/**
 * What a science body is MADE OF: the bridge from rupa's matter table (rupa/matter.js, SI throughout) to the science
 * worlds. Read-only: a science world never changes a matter's numbers, because the same table drives the games'
 * `destruction: 'physical'` and a value there is a compatibility promise over minted rows. One truth for density,
 * stiffness, toughness and bounce, whether the thing is a brick in a level or a ball on a bench.
 *
 *   readBodyMatter(spec, where)   → the matter record a body names (an id, or { is, …overrides }); a liquid or a gas is
 *                                   a medium, never a body, and says so
 *   readMedium(spec, where)       → the matter record a law's `medium` names: a liquid or a gas
 *   sphereMass(m, r)              → density × the sphere's volume × the matter's fill (a sheet-metal ball is a shell)
 *   bodyBudget(m, r)              → { joules, stiff }: the energy the sphere absorbs before it fails (toughness × volume ×
 *                                   fill: rupa's hit points, derived) and its stiffness (E × fill)
 *   impactOf(a, b, vn)            → rupa's own `impact` (the page's function, re-exported by rupa/index.js): the closing
 *                                   energy dissipated, ½μv²(1 − e²), split inversely to stiffness, and whether the
 *                                   struck side breaks
 *   verdictOf(share, budget, m)   → 'holds' | 'dents' | 'breaks': a share under the budget holds, except that a plastic
 *                                   matter keeps a dent once the share passes what its yield takes elastically
 *
 *   transportOf(m, where)        → { k, emissivity }: how heat moves through and off it (rupa's TRANSPORT table, kept apart
 *                                   from MATTER so no game page changes); a matter of its own (no `is`) has none
 *   heatShare(m, T)              → the share of its strength a matter keeps at T kelvin (rupa's heatFactor: whole at
 *                                   20 °C, half at `soften`, none at `melt`)
 *
 * The run is never altered by a verdict: a body that would break is reported, not broken (breaking mid-run is a
 * later law). The readout says so.
 */

import { resolveMatter, isLiquid, isGas, isFluid, isPlastic, TRANSPORT } from '../rupa/matter.js';
import { rupaPhysics } from '../rupa/index.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const sphereVolume = (r) => (4 / 3) * Math.PI * r * r * r;

function readMatter(spec, where) {
  try { return resolveMatter(spec, where); } catch (e) { return fail(where, e.message.replace(/^.*?: /, '')); }
}

/** The matter a body is made of. A body is a solid: a liquid or gas is the medium round it. */
export function readBodyMatter(spec, where) {
  const m = readMatter(spec, where);
  if (isLiquid(m) || isGas(m)) fail(where, `${m.id} is a ${isLiquid(m) ? 'liquid' : 'gas'}: a body is a solid; name it as a law's \`medium\` (drag, buoyancy) instead`);
  return m;
}

/** The fluid a law's `medium` names: what a body moves through or floats in. */
export function readMedium(spec, where) {
  const m = readMatter(spec, where);
  if (!isFluid(m)) fail(where, `${m.id} is not a liquid or a gas: a medium is what a body moves through`);
  return m;
}

export const sphereMass = (m, r) => m.density * sphereVolume(r) * (m.fill ?? 1);

export function bodyBudget(m, r) {
  const V = sphereVolume(r), fill = m.fill ?? 1;
  return { joules: m.toughness * V * fill, stiff: (m.E ?? 10e9) * fill };
}

/**
 * One contact through rupa's impact law. `a` and `b` are { mass, bounce, stiff, joules?, fixed? }; a side with no
 * matter is rigid and ideal (bounce 1, stiffness ∞), so it takes none of the dissipated energy.
 */
export function impactOf(a, b, vn) {
  return rupaPhysics.impact(a, b, vn);
}

/**
 * What the share of the dissipated energy a body took does to it. Elastic work a sphere can store before it yields is
 * about σy² / 2E per cubic metre (a plastic matter); past it, the shape a blow leaves stays (a dent). Past its whole
 * budget it fails.
 */
export function verdictOf(share, budget, m, r) {
  if (share >= budget.joules) return 'breaks';
  if (isPlastic(m) && share > (m.yield * m.yield) / (2 * (m.E ?? 10e9)) * sphereVolume(r) * (m.fill ?? 1)) return 'dents';
  return 'holds';
}

/** A short line naming where a derived number came from, for the readout. */
export const sourceOf = (m) => `${m.label ?? m.id} (rupa matter table)`;

/** How heat moves through and off a matter: its conductivity (W/(m·K)) and its surface's emissivity. */
export function transportOf(m, where) {
  const t = TRANSPORT[String(m.id).replace(/\+$/, '')];
  if (!t) fail(where, `${m.id} names no conductivity or emissivity: build it on a matter of the table (\`{ is: 'steel', … }\`)`);
  return t;
}

/** The share of its strength a matter keeps at T kelvin (rupa's own heatFactor, in °C). */
export const heatShare = (m, T) => rupaPhysics.heatFactor(T - 273.15, m.soften, m.melt);
