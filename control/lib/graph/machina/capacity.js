/**
 * machina/capacity.js — typed capacity. Capacity is never a bare number: "solve the capacity problem"
 * is different math per kind, so each kind is its own primitive with its own check.
 *
 *   • force   — the max static force an element bears (a beam rated to 500 kg). Checked against the
 *               peak borne force in the mechanism (or a named stage).
 *   • rate    — the throughput envelope (a conveyor moving 60 items/min) and/or the available power
 *               budget. Checked against demand throughput and required sustained power.
 *   • storage — the max count held at once (a bin holds 200). Checked against the staged buffer.
 *
 * A capacity entry resolves to plain canonical numbers (force N, throughput units/s, power W, count) so
 * the verify pass can compare them to demand. Margins are reported as headroom, never a bare boolean.
 */

import { clampNum } from '../worlds/motion-vocabulary.js';
import { toUnit } from './quantities.js';

// throughput is count-per-time; express it as {value, per:'s'|'min'|'h'} → canonical units/second.
const PER = { s: 1, min: 60, h: 3600 };
const perToSec = (per) => PER[per] || 1;
export const throughput = (value, per = 's') => clampNum(value, 0, Infinity, 0) / perToSec(per);

// ── typed constructors. Each returns a normalised descriptor the verify pass consumes. ──

// force capacity. `rating` is a force Quantity; `on` selects WHAT bears it:
//   • 'effort' (default) — the force the operator/source must supply (a person can crank ≤ 250 N).
//   • 'peak'             — the worst-loaded element anywhere in the chain (a global structural bound).
//   • <kind|index>       — a specific stage's borne force (this rope, this screw).
// The default is 'effort' because "how much force must someone supply" is the question machines answer;
// checking a strength limit against the load the machine is built to overcome was the original bug.
export const forceCapacity = ({ rating, on = 'effort', label }) =>
  ({ kind: 'force', ratingN: toUnit(rating, 'N'), on, label: label || (on === 'effort' ? 'force (effort)' : on === 'peak' ? 'force (peak)' : `force @ ${on}`) });

// rate capacity. Either a `throughput` ceiling (units/s, via the helper above) or a `power` budget
// Quantity, or both. Whichever are present get checked.
export const rateCapacity = ({ throughput: tp = null, power = null, label }) =>
  ({ kind: 'rate', throughputCap: tp == null ? null : clampNum(tp, 0, Infinity, 0), powerCapW: power == null ? null : toUnit(power, 'W'), label: label || 'rate' });

// storage capacity. `rating` is a max count held at once.
export const storageCapacity = ({ rating, label }) =>
  ({ kind: 'storage', ratingCount: clampNum(rating, 0, Infinity, 0), label: label || 'storage' });

export const CAPACITY = { force: forceCapacity, rate: rateCapacity, storage: storageCapacity };

// ── margin: headroom on a "required ≤ rating" constraint. ok + absolute + fractional, so a barely-feasible
// design and a 10×-overbuilt one read as different answers (the non-negative-margins discipline). ──
export function margin(required, rating) {
  const ok = required <= rating + 1e-9;
  const marginAbs = rating - required;
  const marginFrac = rating > 0 ? marginAbs / rating : (required > 0 ? -Infinity : 1);
  const utilization = rating > 0 ? required / rating : (required > 0 ? Infinity : 0);
  return { ok, required, rating, marginAbs, marginFrac, utilization };
}
