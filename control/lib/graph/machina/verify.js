/**
 * machina/verify.js — the verify pass. Where the quantity layer and the machines meet: it resolves a
 * demand (count × weight × distance, optionally over time) through a mechanism (a compound chain), then
 * checks the result against the typed capacity envelope and reports feasibility as per-constraint
 * margins. This is the generate-and-verify core: Machina can only ever emit a design it has checked.
 *
 * The five invariants (from machina.plan.md):
 *   1. conservation of work — structural (machines.js clamps eta ≤ 1, so W_in ≥ W_out always). Reported,
 *      never violated; surfaces net efficiency + total work lost to friction.
 *   2. force capacity   — no element bears more than its rating.
 *   3. rate capacity    — sustained power ≤ budget, and throughput ≥ demand.
 *   4. storage capacity — staged buffer ≤ rating.
 *   5. non-negative margins — feasibility is headroom per constraint, not a boolean (see capacity.js).
 *
 * Pure: numbers in, verdict out. No rendering, no DB.
 */

import { clampNum } from '../motion-vocabulary.js';
import { toUnit } from './quantities.js';
import { compound } from './machines.js';
import { margin } from './capacity.js';

// ── resolve the demand through the mechanism. demand: { unitWeight (force Qty), count N, distance (len
// Qty), time? (time Qty), unitsPerCycle? }. mechanism: an array of transformers (effort → load). ──
const asNum = (x) => (x && typeof x === 'object' && 'v' in x) ? x.v : x;   // accept a count() Quantity or a plain number

export function resolveDemand(demand, mechanism) {
  const unitW = toUnit(demand.unitWeight, 'N');
  const N = clampNum(asNum(demand.count), 0, Infinity, 0);
  const dist = toUnit(demand.distance, 'm');
  const perCycle = clampNum(demand.unitsPerCycle, 1, Infinity, 1);
  const T = demand.time ? toUnit(demand.time, 's') : null;

  const loadForce = unitW * perCycle;                 // a cycle moves `perCycle` units together
  const res = compound(mechanism, { force: loadForce, distance: dist });
  const cycles = Math.ceil(N / perCycle) || 0;

  const workOutTotal = res.workOut * cycles;          // useful work delivered to the load
  const workInTotal = res.workIn * cycles;            // effort work spent (= workOut / netEta)
  const peakBorneForce = Math.max(res.effort.force, ...res.stages.map((s) => s.borneForce), 0);

  return {
    N, perCycle, cycles, distM: dist, timeS: T,
    mechanism: { netIma: res.netIma, netEta: res.netEta, netAma: res.netAma, effort: res.effort, stages: res.stages },
    workOutTotal, workInTotal, lossTotal: workInTotal - workOutTotal,
    powerRequiredW: T ? workInTotal / T : null,        // sustained effort power
    throughputReq: T ? N / T : null,                   // units/second the job demands
    peakBorneForce,
  };
}

// ── check one typed capacity entry against the resolved demand → an invariant result with a margin. ──
function checkCapacity(cap, R) {
  if (cap.kind === 'force') {
    // what bears the force: the effort source, the peak-loaded element, or a named stage
    let borne;
    if (cap.on === 'effort') borne = R.mechanism.effort.force;
    else if (cap.on === 'peak') borne = R.peakBorneForce;
    else { const s = typeof cap.on === 'number' ? R.mechanism.stages[cap.on] : R.mechanism.stages.find((x) => x.kind === cap.on); borne = s ? s.borneForce : R.peakBorneForce; }
    return { name: cap.label, kind: 'force', ...margin(borne, cap.ratingN), unit: 'N' };
  }
  if (cap.kind === 'rate') {
    const parts = [];
    if (cap.powerCapW != null && R.powerRequiredW != null) parts.push({ sub: 'power', ...margin(R.powerRequiredW, cap.powerCapW), unit: 'W' });
    if (cap.throughputCap != null && R.throughputReq != null) parts.push({ sub: 'throughput', ...margin(R.throughputReq, cap.throughputCap), unit: '/s' });
    const ok = parts.every((p) => p.ok);
    const tightest = parts.slice().sort((a, b) => a.marginFrac - b.marginFrac)[0] || { marginFrac: 1, utilization: 0 };
    return { name: cap.label, kind: 'rate', ok, parts, marginFrac: tightest.marginFrac, utilization: tightest.utilization };
  }
  if (cap.kind === 'storage') {
    return { name: cap.label, kind: 'storage', ...margin(R.perCycle, cap.ratingCount), unit: 'count' };
  }
  return { name: cap.label || cap.kind, kind: cap.kind, ok: true, marginFrac: 1, utilization: 0, note: 'unknown capacity kind — skipped' };
}

// ── the verify pass. demand + mechanism + capacities → { feasible, demand, mechanism, invariants,
// binding }. Rejects nothing silently: an infeasible result names every binding constraint. ──
export function verify(demand, mechanism, capacities = []) {
  const R = resolveDemand(demand, mechanism);

  // invariant 1: conservation of work — structural, always satisfied; report the efficiency + loss.
  const conservation = {
    name: 'conservation of work', kind: 'conservation', ok: R.workInTotal >= R.workOutTotal - 1e-9,
    netEta: R.mechanism.netEta, workOut: R.workOutTotal, workIn: R.workInTotal, loss: R.lossTotal,
  };

  // invariants 2–4: the typed capacity checks. invariant 5 (non-negative margins) is the reporting form.
  const capChecks = capacities.map((c) => checkCapacity(c, R));
  const invariants = [conservation, ...capChecks];
  const feasible = invariants.every((i) => i.ok);
  const binding = invariants.filter((i) => !i.ok).map((i) => i.name);

  return { feasible, binding, demand: R, mechanism: R.mechanism, invariants };
}
