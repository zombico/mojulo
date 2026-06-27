/**
 * machina/envelope.js — the SOURCE envelope: the force×speed×power limits of whatever supplies the
 * effort (a person, a motor, a hydraulic ram). This is the mid-tier upgrade over a flat power budget:
 * a real source can't deliver max force at max speed. The feasible operating region in (force, speed)
 * is the box force≤Fmax, speed≤Vmax, clipped by the hyperbola force·speed ≤ Pmax.
 *
 * Why it matters (and why the MA window needs it): at a flat power budget alone, mechanical advantage
 * CANCELS out of the time (work-conservation), so there's no upper bound on MA. The two-sided window
 * only appears when the source has a force ceiling (→ MA lower bound) AND a speed ceiling (→ MA upper
 * bound). The envelope is what makes "can a person actually do this" honest. Pure.
 */

import { qty, toUnit } from './quantities.js';
import { margin } from './capacity.js';

// presets — rough, honest order-of-magnitude human/motor envelopes (override per problem).
export const SOURCES = {
  // a person doing sustained two-handed work: ~250 N, ~1.3 m/s walking pace, ~150 W continuous.
  person: { maxForce: { value: 250, unit: 'N' }, maxSpeed: { value: 1.3, unit: 'm/s' }, maxPower: { value: 150, unit: 'W' } },
  // a brief one-person heave: more force, less duration-bound power.
  'person-burst': { maxForce: { value: 400, unit: 'N' }, maxSpeed: { value: 0.6, unit: 'm/s' }, maxPower: { value: 300, unit: 'W' } },
};

// each limit is a { value, unit } pair (as in SOURCES / a recipe), or omitted = ∞.
const asN = (o) => (o == null ? Infinity : toUnit(qty(o.value, o.unit), 'N'));
const asV = (o) => (o == null ? Infinity : toUnit(qty(o.value, o.unit), 'm/s'));
const asW = (o) => (o == null ? Infinity : toUnit(qty(o.value, o.unit), 'W'));

// build a source envelope from { maxForce, maxSpeed, maxPower } pairs (any may be omitted = ∞).
export function sourceEnvelope({ maxForce, maxSpeed, maxPower } = {}) {
  return { maxForceN: asN(maxForce), maxSpeedMS: asV(maxSpeed), maxPowerW: asW(maxPower) };
}

// check an operating point (effort force in N, effort speed in m/s) against the envelope → three margins.
export function checkEnvelope(env, forceN, speedMS) {
  const force = margin(forceN, env.maxForceN);
  const speed = margin(speedMS, env.maxSpeedMS);
  const power = margin(forceN * speedMS, env.maxPowerW);
  return { ok: force.ok && speed.ok && power.ok, force, speed, power };
}

// ── ROTATIONAL source: an engine/motor as a torque–speed CURVE (the box above is just a crude curve).
// `torqueCurve` is ascending [[rpm, N·m], …]; torque available falls to 0 outside [idleRpm, redlineRpm].
// This is what lets the same window solver size a drivetrain: at each gear ratio the engine sits at one
// rpm on the curve, and the load is checked against the torque AVAILABLE there. ──
export const ENGINES = {
  // a small gasoline four: ~150 N·m peak torque @ ~4000 rpm, ~74 kW peak power @ ~6000 rpm.
  'small-gas': { idleRpm: 850, redlineRpm: 6500, torqueCurve: [[850, 95], [2000, 130], [3000, 148], [4000, 150], [5000, 140], [6000, 118], [6500, 100]] },
};

const RPM_TO_RADS = (2 * Math.PI) / 60;

export function engineSource({ idleRpm, redlineRpm, torqueCurve }) {
  const curve = torqueCurve.slice().sort((a, b) => a[0] - b[0]);
  const idle = idleRpm ?? curve[0][0], redline = redlineRpm ?? curve[curve.length - 1][0];
  const torqueAt = (rpm) => {
    if (rpm < idle || rpm > redline) return 0;
    if (rpm <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i++) {
      if (rpm <= curve[i][0]) { const [r0, t0] = curve[i - 1], [r1, t1] = curve[i]; return t0 + ((rpm - r0) / (r1 - r0)) * (t1 - t0); }
    }
    return curve[curve.length - 1][1];
  };
  // peak power point (torque × ω over the curve)
  let peakPowerW = 0, peakPowerRpm = idle;
  for (const [rpm, tq] of curve) { const p = tq * rpm * RPM_TO_RADS; if (p > peakPowerW) { peakPowerW = p; peakPowerRpm = rpm; } }
  const peakTorque = curve.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { idleRpm: idle, redlineRpm: redline, torqueAt, peakPowerW, peakPowerRpm, peakTorqueNm: peakTorque[1], peakTorqueRpm: peakTorque[0], RPM_TO_RADS };
}
