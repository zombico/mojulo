/**
 * machina/drivetrain.js — match an ENGINE (a torque–speed source) to a road load through a gearbox, and
 * make the same mid-tier window solver find the feasible OVERALL DRIVE RATIO. The rotational sibling of
 * the reel mower: there a human's force×speed box bounded the gear ratio; here an engine's torque curve
 * does, and the window has an engine-flavoured story at each edge:
 *   • ratio too LOW (too tall a gear) → engine sits at low rpm where it can't make enough torque — it
 *     LUGS and can't pull the load → lower bound (engine torque / idle)
 *   • ratio too HIGH (too short a gear) → engine spins past redline → upper bound
 *
 * Load model: hold a road speed v on a grade — F = m·g·sinθ + Crr·m·g·cosθ + ½·ρ·Cd·A·v² (grade +
 * rolling + aero). Steady-state and closed-form, so every ratio is cheaply checkable. Pure.
 */

import { qty, toUnit } from './quantities.js';
import { margin } from './capacity.js';
import { engineSource, ENGINES } from './envelope.js';

const num = (v, fb) => (Number.isFinite(+v) ? +v : fb);
const G = 9.8;

function resolve(p = {}) {
  const v = p.condition?.speed ? toUnit(qty(p.condition.speed.value, p.condition.speed.unit ?? 'm/s'), 'm/s') : 25;
  const grade = num(p.condition?.grade, 0);
  const theta = Math.atan(grade);
  const veh = p.vehicle || {};
  const m = num(veh.mass, 1300), Rw = num(veh.wheelR, 0.31), Crr = num(veh.Crr, 0.013), CdA = num(veh.CdA, 0.65), rho = num(veh.rho, 1.2);
  const F = m * G * Math.sin(theta) + Crr * m * G * Math.cos(theta) + 0.5 * rho * CdA * v * v;
  const eng = engineSource(p.engine || ENGINES['small-gas']);
  return {
    v, grade, eta: num(p.eta, 0.9), Rw, eng,
    Fresist: F, tauWheel: F * Rw, wWheel: v / Rw,
  };
}

// evaluate the drivetrain at one overall drive ratio g (= engine rpm / wheel rpm) → readout + checks.
export function evaluateDrivetrain(problem, g) {
  const d = resolve(problem);
  const rpm = (g * d.wWheel) * (60 / (2 * Math.PI));
  const tauNeed = d.tauWheel / (g * d.eta);          // engine torque the load demands at this ratio
  const tauAvail = d.eng.torqueAt(rpm);              // what the engine can make at that rpm (0 out of band)
  const checks = [
    { name: 'engine torque', ...margin(tauNeed, Math.max(tauAvail, 1e-6)) },   // can it pull? (lower bound)
    { name: 'idle (no stall)', ...margin(d.eng.idleRpm, rpm) },                // rpm ≥ idle (lower bound)
    { name: 'redline', ...margin(rpm, d.eng.redlineRpm) },                     // rpm ≤ redline (upper bound)
  ];
  return {
    g, rpm, tauNeed, tauAvail,
    powerNeedW: (d.tauWheel * d.wWheel) / d.eta,
    reserveNm: tauAvail - tauNeed,
    checks,
  };
}

export const DRIVE_RATIO_RANGE = { from: 1, to: 12 };
