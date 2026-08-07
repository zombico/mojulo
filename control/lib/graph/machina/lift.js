/**
 * machina/lift.js — the lift/hoist problem as a window-solvable domain, so the mid-tier solver can be
 * pointed back at v1's failure and turn "❌ binding: rate" into a constructive answer.
 *
 * The correction this encodes: at a flat power budget, mechanical advantage CANCELS out of the time
 * (work-conservation), so power and an external throughput cap can't bound MA — a higher gear ratio
 * never fixes a throughput WALL. The honest upper bound on MA is the SOURCE: the worker can only crank
 * so fast, and higher MA means a longer effort stroke per lift, so at a capped crank speed the job
 * takes longer. So:
 *   • effort FORCE = load/(η·MA) decreases with MA → the source force ceiling sets MA_min (lower edge)
 *   • effort SPEED = total stroke / time grows with MA → the source speed ceiling sets MA_max (upper edge)
 *   • effort POWER = w·N·d/(η·T) is MA-INDEPENDENT → a pass/fail gate, never an edge
 * That two-sided window is exactly what a force-only or power-only view cannot produce. Pure.
 */

import { qty, toUnit, weight, G } from './quantities.js';
import { sourceEnvelope, checkEnvelope, SOURCES } from './envelope.js';

const num = (v, fb) => (Number.isFinite(+v) ? +v : fb);

function resolve(p = {}) {
  const src = p.source || SOURCES.person;
  const w = p.unitWeight ? toUnit(qty(p.unitWeight.value, p.unitWeight.unit ?? 'N'), 'N')
    : toUnit(weight(qty(p.unitMass?.value ?? 1, p.unitMass?.unit ?? 'kg'), num(p.g, G.earth)), 'N');
  return {
    w, N: num(p.count, 1),
    d: toUnit(qty(p.distance?.value ?? 1, p.distance?.unit ?? 'm'), 'm'),
    T: p.time ? toUnit(qty(p.time.value, p.time.unit ?? 's'), 's') : null,
    uPC: num(p.unitsPerCycle, 1), eta: num(p.eta, 1),
    env: sourceEnvelope(src),
  };
}

// evaluate the lift at one net mechanical advantage MA → readout + the named margin checks.
export function evaluateLift(problem, MA) {
  const m = resolve(problem);
  const loadF = m.w * m.uPC;
  const effortF = loadF / (m.eta * MA);
  const dIn = m.d * MA;                       // effort stroke per cycle (grows with MA)
  const cycles = Math.ceil(m.N / m.uPC);
  const effortTravel = cycles * dIn;
  const effortSpeed = m.T ? effortTravel / m.T : 0;
  const env = checkEnvelope(m.env, effortF, effortSpeed);
  const checks = [
    { name: 'effort force', ...env.force },   // load/(η·MA) ≤ Fmax → MA lower bound
    { name: 'crank speed', ...env.speed },    // stroke/time ≤ Vmax → MA upper bound
    { name: 'worker power', ...env.power },   // MA-independent gate
  ];
  return { MA, effortF, effortSpeed, effortPower: effortF * effortSpeed, cycles, checks };
}

export const LIFT_MA_RANGE = { from: 1, to: 16 };
