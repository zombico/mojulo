/**
 * machina/machines.js — the six classical simple machines as force-transformers, plus compound chains.
 *
 * This is Machina's net-new core. mechanics-view does trajectories and free-bodies; windmill-view does
 * force → torque → rotational work — but the *advantage devices* (the things that trade force for
 * distance) don't exist anywhere yet. Each machine here is a pure transformer: it carries an IDEAL
 * mechanical advantage `ima` set purely by geometry, derated by efficiency `eta ≤ 1` to an ACTUAL
 * advantage `ama = eta · ima`.
 *
 * The one invariant, made structural: a machine trades force for distance but never yields work for
 * free. Geometry fixes the distance ratio (d_in/d_out = ima); friction taxes only the force, so
 *   F_in = F_out / ama          d_in = d_out · ima
 *   W_in = F_in·d_in = (F_out/(eta·ima))·(ima·d_out) = (F_out·d_out)/eta = W_out / eta   ≥  W_out.
 * The rejected class — W_in < W_out (perpetual motion) — is impossible to express here, because eta is
 * clamped to (0, 1]. No-free-lunch is built in, not checked after the fact.
 *
 * Pure: no quantities-layer dependency (operates on plain canonical numbers — force in N, distance in
 * m, work in J), no rendering, no DB. The verify pass wraps these with typed Quantities + capacity.
 */

import { clampNum } from '../worlds/motion-vocabulary.js';

const TAU = Math.PI * 2;
const eta_ = (e) => clampNum(e, 1e-3, 1, 1);   // efficiency in (0,1]; default ideal. Clamped so ama≤ima.
const make = (kind, ima, eta, params) => { const e = eta_(eta); const i = Math.max(ima, 1e-6); return { kind, ima: i, eta: e, ama: e * i, params }; };

// ── the six. Each factory resolves geometry → ideal mechanical advantage, then normalises with eta. ──

// lever — force ↔ distance about a fulcrum. MA = effort arm / load arm.
export const lever = ({ effortArm, loadArm, eta }) => make('lever', clampNum(effortArm, 0, Infinity, 1) / clampNum(loadArm, 1e-6, Infinity, 1), eta, { effortArm, loadArm });
// wheel & axle — effort on the wheel rim drives the axle. MA = wheel radius / axle radius.
export const wheelAxle = ({ wheelR, axleR, eta }) => make('wheel-axle', clampNum(wheelR, 0, Infinity, 1) / clampNum(axleR, 1e-6, Infinity, 1), eta, { wheelR, axleR });
// pulley (block & tackle) — MA = number of rope segments supporting the load.
export const pulley = ({ segments, eta }) => make('pulley', clampNum(Math.round(segments), 1, 64, 1), eta, { segments });
// inclined plane — MA = slope length / rise.
export const incline = ({ slope, height, eta }) => make('incline', clampNum(slope, 0, Infinity, 1) / clampNum(height, 1e-6, Infinity, 1), eta, { slope, height });
// wedge — a moving inclined plane. MA = length / thickness.
export const wedge = ({ length, thickness, eta }) => make('wedge', clampNum(length, 0, Infinity, 1) / clampNum(thickness, 1e-6, Infinity, 1), eta, { length, thickness });
// screw — rotation → linear. MA = circumference of the effort lever / pitch (lead per turn).
export const screw = ({ leverR, pitch, eta }) => make('screw', (TAU * clampNum(leverR, 0, Infinity, 1)) / clampNum(pitch, 1e-6, Infinity, 1), eta, { leverR, pitch });

export const MACHINES = { lever, wheelAxle, pulley, incline, wedge, screw };

// ── propagate one transformer from the LOAD side to the EFFORT side. `out` = { force (N), distance (m) }
// the load demands; returns the effort `in` it requires plus the honest work accounting. ──
export function propagate(t, out) {
  const force = clampNum(out.force, 0, Infinity, 0);
  const distance = clampNum(out.distance, 0, Infinity, 0);
  const inForce = force / t.ama;        // friction taxes force …
  const inDist = distance * t.ima;      // … geometry fixes distance
  const workOut = force * distance;
  const workIn = inForce * inDist;      // = workOut / eta, always ≥ workOut
  return { in: { force: inForce, distance: inDist }, out: { force, distance }, workOut, workIn, loss: workIn - workOut };
}

// ── a compound machine is a chain of transformers from EFFORT → LOAD. Resolve it by folding the load
// demand back through each stage (load side first). Net advantage = ∏ ima; net efficiency = ∏ eta.
// Returns the effort the chain requires, every stage's borne force (for the force-capacity check), and
// the whole-chain work accounting. `loadOut` = { force, distance } at the load. ──
export function compound(chain, loadOut) {
  const stages = [];
  let cur = { force: clampNum(loadOut.force, 0, Infinity, 0), distance: clampNum(loadOut.distance, 0, Infinity, 0) };
  // fold from the stage nearest the load outward to the effort source
  for (let i = chain.length - 1; i >= 0; i--) {
    const step = propagate(chain[i], cur);
    stages.unshift({ kind: chain[i].kind, ima: chain[i].ima, eta: chain[i].eta, ama: chain[i].ama, borneForce: step.out.force, ...step });
    cur = step.in;
  }
  const netIma = chain.reduce((p, t) => p * t.ima, 1);
  const netEta = chain.reduce((p, t) => p * t.eta, 1);
  const workOut = loadOut.force * loadOut.distance;
  const workIn = cur.force * cur.distance;   // effort-side work = workOut / netEta
  return {
    effort: cur,                       // { force, distance } the operator must supply
    netIma, netEta, netAma: netIma * netEta,
    workOut, workIn, loss: workIn - workOut,
    stages,                            // per-stage borneForce feeds the force-capacity check
  };
}
