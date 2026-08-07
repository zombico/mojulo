/**
 * machina/mower.js — a reel (cylinder) push mower as a Machina problem, and the FIRST domain that
 * exercises the mid-tier window solver on something genuinely unlike the lifting examples:
 *
 *   • MA < 1 — the drivetrain is a SPEED multiplier (wheels turn slowly, the reel spins fast), the
 *     opposite of a hoist. The conservation invariant is identical; only the direction flips.
 *   • the load is RESISTIVE, not gravitational — "weight" generalises to grass shear resistance, and
 *     "distance/volume" generalises to swept AREA. Demand = mow an area, not lift a mass.
 *   • a two-sided gear-ratio window with a PHYSICAL story at each edge.
 *
 * Honest physics (the part that earns the window):
 *   • The shearing work itself is set by the AREA (specific cut energy × area) and is GEAR-RATIO
 *     INDEPENDENT — you cut the same grass however the reel is geared. So the irreducible push force
 *     for shearing does not move with r.
 *   • What grows with r is the reel's parasitic loss — windage + bearing friction ∝ ω_reel². Gear up
 *     harder → the reel spins faster → more parasitic drag reflected to the push. THIS is the upper bound.
 *   • Cut QUALITY needs enough cuts per metre of travel (else grass folds instead of shears); cuts/m
 *     ∝ r, so quality is the LOWER bound.
 *
 * Pure. Units in via quantities; computation in canonical SI.
 */

import { qty, toUnit } from './quantities.js';
import { margin } from './capacity.js';
import { sourceEnvelope, checkEnvelope, SOURCES } from './envelope.js';

const TAU = Math.PI * 2;
const num = (v, fb) => (Number.isFinite(+v) ? +v : fb);

// resolve a mower recipe into canonical scalars + the source envelope.
function resolve(recipe = {}) {
  const src = recipe.source || SOURCES.person;
  return {
    vf: toUnit(qty(recipe.pushSpeed?.value ?? 1.0, recipe.pushSpeed?.unit ?? 'm/s'), 'm/s'),
    Rw: toUnit(qty(recipe.wheelR?.value ?? 0.09, recipe.wheelR?.unit ?? 'm'), 'm'),
    Rr: toUnit(qty(recipe.reelR?.value ?? 0.06, recipe.reelR?.unit ?? 'm'), 'm'),
    B: num(recipe.blades, 5),
    eCut: num(recipe.specificCutEnergy, 4.0),       // J per m² of grass sheared (order-of-magnitude)
    cutWidth: toUnit(qty(recipe.cutWidth?.value ?? 0.4, recipe.cutWidth?.unit ?? 'm'), 'm'),
    area: num(recipe.area?.value ?? recipe.area, 200),                 // m²
    T: toUnit(qty(recipe.time?.value ?? 25, recipe.time?.unit ?? 'min'), 's'),
    minCutsPerM: num(recipe.minCutsPerM, 55),       // clean-cut threshold (cuts per metre of travel)
    drag: num(recipe.dragCoeff, 0.012),             // reel windage/friction: τ_drag = drag · ω_reel
    eta: num(recipe.eta, 0.85),
    env: sourceEnvelope({ maxForce: src.maxForce, maxSpeed: src.maxSpeed, maxPower: src.maxPower }),
  };
}

// evaluate the mower at one gear ratio r (= reel turns per wheel turn). Returns the readout + the
// named margin checks the window solver consumes.
export function evaluateMower(recipe, r) {
  const m = resolve(recipe);
  const wW = m.vf / m.Rw;                 // wheel angular speed (rad/s)
  const wR = r * wW;                      // reel angular speed — geared UP
  const cutsPerM = (m.B * r) / (TAU * m.Rw);

  const Fshear = (m.eCut * m.cutWidth) / m.eta;            // push force for shearing (r-independent)
  const Pdrag = m.drag * wR * wR;                          // reel windage/friction power ∝ ω²
  const Fdrag = Pdrag / (m.vf * m.eta);                    // reflected to the push (grows with r)
  const Fpush = Fshear + Fdrag;
  const Ppush = Fpush * m.vf;

  const areaRate = m.cutWidth * m.vf;                      // m²/s achievable
  const areaDemand = m.area / m.T;                         // m²/s required
  const env = checkEnvelope(m.env, Fpush, m.vf);

  const checks = [
    { name: 'cut quality', ...margin(m.minCutsPerM, cutsPerM) },   // need cutsPerM ≥ threshold (lower bound on r)
    { name: 'push force', ...env.force },                          // F_push ≤ source Fmax (upper bound on r)
    { name: 'push power', ...env.power },                          // P_push ≤ source Pmax (upper bound on r)
    { name: 'walk speed', ...env.speed },                          // v_f ≤ source Vmax (r-independent)
    { name: 'throughput', ...margin(areaDemand, areaRate) },       // area/time ≤ areaRate (r-independent)
  ];
  return { r, reelRpm: (wR / TAU) * 60, cutsPerM, Fpush, Ppush, Fshear, Fdrag, areaRate, areaDemand, checks };
}

export const MOWER_RATIO_RANGE = { from: 1, to: 16 };
