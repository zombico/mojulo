/**
 * A liquid that SETS: the `gelling` law's curve of state, the hold a yield stress gives a sphere, and the Bingham film
 * a layer of it makes on a slope. Pure; the kernel steps the bodies in it (kernel.js `gel`), this file reads the recipe
 * and checks the layer.
 *
 *   readCurve(raw, medium, where) → { t: [s], eta: [Pa·s], tau: [Pa] }: the medium's viscosity and yield along the run,
 *                                   from `[{ at, viscosity?, yield? }]` (each point keeps what it does not say from the
 *                                   one before; the first from the medium itself). Between points the viscosity moves
 *                                   by its logarithm (a setting liquid's climbs by decades), the yield linearly
 *   curveAt(c, t) → { eta, tau }
 *   holdCapacity(r) → N per Pa: the net force a yield stress of 1 Pa holds a sphere of radius r against. A sphere is
 *                     held while τy ≥ 0.048·Δρ·g·D (Beris, Tsamopoulos, Armstrong & Brown, J. Fluid Mech. 1985), that is
 *                     while its net weight ≤ τy·π·D² / (6 × 0.048); read as a force, any net force
 *   filmFlux(rho, g, slope, h, eta, tau) → m²/s: a Bingham layer's flow per unit width down a slope (the closed form:
 *                     q = ρ·g·sinθ·h³ / 3η · (1 − 3ζ/2 + ζ³/2), ζ = τy / (ρ·g·h·sinθ); none once ζ ≥ 1)
 *   filmFluxNumeric(…) → the same flux by integrating the film's velocity profile (the gate's other side)
 */

import { quantity } from '../contract.js';

export const GEL_CLOSED_FORMS = [
  { id: 'bingham-film', want: 'a layer of a setting liquid on its slope flows as a Bingham film: its flux, the velocity profile integrated, is ρ·g·sinθ·h³/3η·(1 − 3ζ/2 + ζ³/2), and none once the yield passes ρ·g·h·sinθ, within a millionth of its flow with no yield' },
];
export const BERIS_Y = 0.048;           // the critical yield parameter τy / (Δρ·g·D) for a sphere (Beris et al. 1985)
const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readCurve(raw, medium, where) {
  const start = { eta: medium.viscosity, tau: medium.yield ?? 0 };
  if (!(start.eta > 0)) fail(where, `${medium.id} has no viscosity to start from`);
  if (raw === undefined) return { t: [0], eta: [start.eta], tau: [start.tau] };
  if (!Array.isArray(raw) || !raw.length || raw.length > 32) fail(where, 'wants [{ at, viscosity?, yield? }], 1 to 32 points along the run');
  const t = [], eta = [], tau = [];
  let prev = start, last = -Infinity;
  raw.forEach((p, k) => {
    const w = `${where}[${k}]`;
    if (!isObj(p)) fail(w, 'wants { at, viscosity?, yield? }');
    const extra = Object.keys(p).filter((x) => !['at', 'viscosity', 'yield'].includes(x));
    if (extra.length) fail(w, `unknown field '${extra[0]}' (a point takes at, viscosity, yield)`);
    const at = quantity(p.at, 'time', `${w}.at`);
    if (!(at >= 0) || at <= last) fail(`${w}.at`, 'the points run forward in time from 0');
    const e = p.viscosity === undefined ? prev.eta : quantity(p.viscosity, 'viscosity', `${w}.viscosity`);
    const y = p.yield === undefined ? prev.tau : quantity(p.yield, 'stress', `${w}.yield`);
    if (!(e > 0)) fail(`${w}.viscosity`, 'is above 0');
    if (!(y >= 0)) fail(`${w}.yield`, 'is 0 or more');
    t.push(at); eta.push(e); tau.push(y); prev = { eta: e, tau: y }; last = at;
  });
  if (t[0] > 0) { t.unshift(0); eta.unshift(start.eta); tau.unshift(start.tau); }
  return { t, eta, tau };
}

export function curveAt(c, time) {
  const n = c.t.length;
  if (n === 1 || time <= c.t[0]) return { eta: c.eta[0], tau: c.tau[0] };
  if (time >= c.t[n - 1]) return { eta: c.eta[n - 1], tau: c.tau[n - 1] };
  let k = 0;
  while (c.t[k + 1] < time) k++;
  const u = (time - c.t[k]) / (c.t[k + 1] - c.t[k]);
  return { eta: Math.exp(Math.log(c.eta[k]) + u * (Math.log(c.eta[k + 1]) - Math.log(c.eta[k]))), tau: c.tau[k] + u * (c.tau[k + 1] - c.tau[k]) };
}

export const holdCapacity = (r) => (Math.PI * (2 * r) ** 2) / (6 * BERIS_Y);

export function filmFlux(rho, g, slope, h, eta, tau) {
  const drive = rho * g * Math.sin(slope);
  if (!(drive > 0) || !(h > 0)) return 0;
  const z = tau / (drive * h);
  if (z >= 1) return 0;
  return (drive * h ** 3) / (3 * eta) * (1 - 1.5 * z + 0.5 * z ** 3);
}

// the film's velocity profile u(y) = ∫ γ̇, γ̇ = (τ(y) − τy)/η in the sheared zone below y₀, where the stress τ(y) =
// ρ·g·sinθ·(h − y) passes the yield; above y₀ a plug rides at u(y₀). Integrated twice by Simpson's rule over the
// sheared zone alone (so a thin one near the yield is resolved), then the plug added
export function filmFluxNumeric(rho, g, slope, h, eta, tau, n = 2000) {
  const drive = rho * g * Math.sin(slope);
  if (!(drive > 0) || !(h > 0)) return 0;
  const y0 = h - tau / drive;
  if (!(y0 > 0)) return 0;
  const dy = y0 / n, rate = (y) => Math.max(0, drive * (h - y) - tau) / eta;
  const u = new Float64Array(n + 1);
  for (let k = 1; k <= n; k++) {
    const a = (k - 1) * dy, b = k * dy;
    u[k] = u[k - 1] + (dy / 6) * (rate(a) + 4 * rate((a + b) / 2) + rate(b));
  }
  let q = 0;
  for (let k = 1; k + 1 <= n; k += 2) q += (dy / 3) * (u[k - 1] + 4 * u[k] + u[k + 1]);
  return q + u[n] * (h - y0);
}
