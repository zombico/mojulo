/**
 * physics/hydro — the hydroelectric energy chain, pure and deterministic. One spec ({ head, flow })
 * resolves the WHOLE plant: hydrostatics at the dam (P = ρgh), the Torricelli/Bernoulli jet at the
 * nozzle (v = √(2g·H_eff)), the Pelton runner at maximum power transfer (bucket speed u = v/2,
 * ω = u/R, τ = P/ω), and the synchronous generator (pole pairs chosen so f = p·n/60 lands on the
 * grid frequency). Powers thread the chain with honest stage efficiencies:
 *
 *   P_hydraulic = ρ·g·Q·H  →  ×η_penstock·η_turbine → P_mech  →  ×η_generator → P_elec
 *
 * SI units throughout (m, m³/s, W, rad/s, Hz). No dice, no time integration — the chain is a set of
 * closed-form couplings, so "same spec → byte-identical chain" holds trivially. The hydro-view
 * scenarios all read from this one chain so every arc of the explainer quotes the SAME numbers.
 */

const TAU = Math.PI * 2;
export const G = 9.81;            // gravity (m/s²)
export const RHO_WATER = 1000;    // fresh water (kg/m³)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// stage efficiencies — realistic plant-scale figures (penstock friction, runner, generator).
export const HYDRO_ETA = { penstock: 0.95, turbine: 0.9, generator: 0.95 };

export const HYDRO_DEFAULTS = { head: 60, flow: 40, runnerRadius: 1.5, gridHz: 60 };

/**
 * Resolve the full energy chain for a plant spec. Pure.
 * @param {{ head?:number, flow?:number, runnerRadius?:number, gridHz?:number }} spec
 *   head — gross head H, reservoir surface to turbine (m, 5–300)
 *   flow — design discharge Q through the penstock (m³/s, 1–600)
 *   runnerRadius — Pelton runner pitch radius R (m, 0.4–4)
 *   gridHz — target grid frequency (50 or 60)
 * @returns the chain: spec, eta, headEff, jet, pressure, power, runner, generator, homes
 */
export function planHydroChain(spec = {}) {
  const head = clampNum(spec.head, 5, 300, HYDRO_DEFAULTS.head);
  const flow = clampNum(spec.flow, 1, 600, HYDRO_DEFAULTS.flow);
  const R = clampNum(spec.runnerRadius, 0.4, 4, HYDRO_DEFAULTS.runnerRadius);
  const gridHz = +spec.gridHz === 50 ? 50 : 60;

  // the dam: hydrostatic pressure at the base — what the wall must hold.
  const basePressure = RHO_WATER * G * head;                       // Pa

  // the nozzle: penstock friction taxes the head, the rest converts to the jet (Torricelli).
  const headEff = head * HYDRO_ETA.penstock;
  const jetV = Math.sqrt(2 * G * headEff);                        // m/s

  // the runner: a Pelton bucket extracts ALL the jet's kinetic energy when it runs at u = v/2
  // (the water leaves dead in the runner frame). Jet force from the momentum turn, θ ≈ 180°.
  const u = jetV / 2;
  const omega = u / R;                                            // rad/s
  const rpm = omega * 60 / TAU;
  const jetForce = 2 * RHO_WATER * flow * (jetV - u);             // N — F = ρQ(v−u)(1−cosθ), θ→180°

  // the powers, threaded through the stage efficiencies.
  const pHydraulic = RHO_WATER * G * flow * head;                 // W
  const pMech = RHO_WATER * G * flow * headEff * HYDRO_ETA.turbine;
  const pElec = pMech * HYDRO_ETA.generator;
  const torque = pMech / omega;                                   // N·m on the shaft

  // the generator: synchronous — pole pairs chosen so f = p·n/60 lands on the grid frequency.
  // Hydro runners are slow, so real machines carry MANY poles; ours does too.
  const polePairs = clamp(Math.round(gridHz * 60 / rpm), 1, 64);
  const f = polePairs * rpm / 60;                                 // Hz actually produced at this rpm

  const homes = Math.round(pElec / 1200);                         // ~1.2 kW average household draw

  return {
    spec: { head, flow, runnerRadius: R, gridHz },
    eta: { ...HYDRO_ETA },
    headEff,
    pressure: { base: basePressure },
    jet: { v: jetV },
    power: { hydraulic: pHydraulic, mech: pMech, elec: pElec },
    runner: { radius: R, u, omega, rpm, torque, jetForce },
    generator: { polePairs, poles: 2 * polePairs, f },
    homes,
  };
}
