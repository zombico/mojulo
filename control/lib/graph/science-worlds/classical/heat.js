/**
 * Heat on a classical world: the `heat` law's pass over a run already made. Heat moves no body, so it never enters
 * the kernel: the motion is solved first, then each heated body's temperature is stepped along it, sample by sample,
 * reading who touches whom from the recorded positions. A model without the law is untouched, byte for byte.
 *
 * Each body with a matter and a radius is LUMPED: one temperature throughout, held as its enthalpy H (heat × mass per
 * kelvin, then the latent heat at its melting point, where the temperature stands still until it has all gone in).
 *
 *   dH/dt = − h·A·(T − T∞)                     convection to the medium (h: the law's, or still air's or water's order)
 *           − ε·σ·A·(T⁴ − T∞⁴)                 radiation to surroundings at T∞ (ε: the matter's surface, rupa TRANSPORT)
 *           − Σ G·(T − T_other)                conduction through a contact spot to a touching body or a plane with
 *                                              matter (a plane is a reservoir at its own temperature)
 *
 * A contact conducts through a spot of radius a (the law's `contact`, at most half the smaller radius): each side
 * spreads the heat into a half-space with resistance 1/(4·k·a) (Holm's constriction resistance), so G = 4a / (1/k₁ + 1/k₂).
 * Stepped by RK4 at a fiftieth of the fastest body's time constant (C / its total conductance); each channel's heat is
 * summed with the same weights, so the bookkeeping closes to rounding.
 *
 *   runHeat(model, run, ctx) → null (no heat law) | { members, T: [[K] per sample], series, readout, gates,
 *                                                     assumptions, warnings, tAt(i, t) → K }
 */

import { transportOf, heatShare } from '../matter.js';
import { planeNormal } from './laws.js';

export const SIGMA = 5.670374419e-8;    // W/(m²·K⁴), the Stefan–Boltzmann constant (CODATA 2018, exact)
export const H_GAS = 10;                // W/(m²·K): natural convection in still air (typical 2–25)
export const H_LIQUID = 500;            // W/(m²·K): natural convection in water (typical 50–1000)
const STEP = 0.02;                      // the heat step's share of the fastest time constant
const MAX_HEAT_STEPS = 2e6;

export const HEAT_CLOSED_FORMS = [
  { id: 'cooling', want: 'a body that loses heat by convection alone, touching nothing, follows Newton\'s cooling: T − T∞ = (T₀ − T∞)·e^(−h·A·t / m·c), within one part in a million' },
];

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const celsius = (K) => sig(K - 273.15, 5);
const gate = (id, want, ok, value, detail) => ({ id, want, ok: !!ok, value, detail });
const dist = (x, i, j) => Math.hypot(x[3 * i] - x[3 * j], x[3 * i + 1] - x[3 * j + 1], x[3 * i + 2] - x[3 * j + 2]);

/** The temperature a body's enthalpy means: below its melting point, at it while the latent heat goes in, above it. */
function tempOf(H, b) {
  if (b.Tm === null || H < b.C * b.Tm) return H / b.C;
  if (H < b.C * b.Tm + b.L) return b.Tm;
  return (H - b.L) / b.C;
}
const moltenOf = (H, b) => (b.Tm === null ? 0 : b.L > 0 ? Math.min(1, Math.max(0, (H - b.C * b.Tm) / b.L)) : (H >= b.C * b.Tm ? 1 : 0));

export function runHeat(model, run, ctx) {
  const laws = model.laws.filter(({ row }) => row.id === 'heat');
  if (!laws.length) return null;
  if (laws.length > 1) fail('model.laws', 'one heat law: it already covers every body with a matter (narrow it with on)');
  const law = laws[0].entry;
  const Ta = law.ambient ?? 293.15;
  const medium = law.medium ?? null;
  const liquid = medium && medium.family === 'liquid';
  const h = law.h ?? (liquid ? H_LIQUID : H_GAS);
  const hFrom = law.h !== undefined ? 'given' : liquid ? `natural convection in a still liquid (typical 50–1000 W/(m²·K)), ${medium.id}` : 'natural convection in still air (typical 2–25 W/(m²·K))';
  const radiation = law.radiation ?? true;
  const spot = law.contact ?? 0.001;

  // the heated bodies: a matter and a radius each (the law's `on`, or every one that has them)
  const listed = law.on ? new Set(law.on) : null;
  const B = [];
  model.bodies.forEach((b, i) => {
    if (!b.matter || !(b.radius > 0) || (listed && !listed.has(b.id))) return;
    const tr = transportOf(b.matter, `model.bodies.${b.id}.matter`);
    const m = b.matter, C = b.mass * m.heat;
    B.push({
      i, id: b.id, r: b.radius, A: 4 * Math.PI * b.radius * b.radius, C, k: tr.k, eps: radiation ? tr.emissivity : 0,
      Tm: m.melt === null || m.melt === undefined ? null : m.melt + 273.15, L: b.mass * (m.fusion || 0), matter: m,
      T0: b.temperature ?? Ta,
    });
  });
  const member = new Map(B.map((b, u) => [b.i, u]));
  // the planes that pass heat: those with a matter, at their own temperature or the ambient
  const planes = model.laws.filter(({ row, entry }) => row.id === 'plane' && entry.matter).map(({ entry }) => ({
    p: entry.point ?? [0, 0, 0], n: planeNormal(entry, ctx), k: transportOf(entry.matter, 'model.laws.plane.matter').k,
    T: entry.temperature ?? Ta, on: entry.on ? new Set(entry.on) : null, id: entry.id ?? 'plane',
  }));

  // who touches whom at a sample: pairs of heated bodies, and heated bodies on a plane with matter
  const touching = (x) => {
    const pairs = [], onPlane = [];
    for (let u = 0; u < B.length; u++) {
      for (let w = u + 1; w < B.length; w++) {
        const a = B[u], b = B[w], tol = Math.max(1e-3 * Math.min(a.r, b.r), 1e-9);
        if (dist(x, a.i, b.i) <= a.r + b.r + tol) {
          const s = Math.min(spot, a.r / 2, b.r / 2);
          pairs.push({ u, w, G: (4 * s) / (1 / a.k + 1 / b.k) });
        }
      }
      for (let q = 0; q < planes.length; q++) {
        const P = planes[q], a = B[u];
        if (P.on && !P.on.has(a.id)) continue;
        const d = (x[3 * a.i] - P.p[0]) * P.n[0] + (x[3 * a.i + 1] - P.p[1]) * P.n[1] + (x[3 * a.i + 2] - P.p[2]) * P.n[2];
        if (Math.abs(d - a.r) <= Math.max(1e-3 * a.r, 1e-9)) {
          const s = Math.min(spot, a.r / 2);
          onPlane.push({ u, q, G: (4 * s) / (1 / a.k + 1 / P.k) });
        }
      }
    }
    return { pairs, onPlane };
  };

  // the flows at a state: dH per body, and each channel's heat leaving the bodies (convection, radiation, planes),
  // and the heat that passes between bodies
  const flows = (H, c) => {
    const T = H.map((x, u) => tempOf(x, B[u]));
    const d = new Float64Array(B.length), out = { conv: 0, rad: 0, plane: 0, pass: 0 };
    B.forEach((b, u) => {
      const qc = h * b.A * (T[u] - Ta), qr = b.eps * SIGMA * b.A * (T[u] ** 4 - Ta ** 4);
      d[u] -= qc + qr; out.conv += qc; out.rad += qr;
    });
    for (const { u, w, G } of c.pairs) { const q = G * (T[u] - T[w]); d[u] -= q; d[w] += q; out.pass += Math.abs(q); }
    for (const { u, q: pq, G } of c.onPlane) { const q = G * (T[u] - planes[pq].T); d[u] -= q; out.plane += q; }
    return { d, out };
  };
  // the fastest time constant at a state: each body's capacity over everything it trades heat through
  const fastest = (H, c) => {
    const G = B.map((b, u) => h * b.A + 4 * b.eps * SIGMA * b.A * Math.max(tempOf(H[u], b), Ta) ** 3);
    for (const { u, w, G: g } of c.pairs) { G[u] += g; G[w] += g; }
    for (const { u, G: g } of c.onPlane) G[u] += g;
    return Math.min(...B.map((b, u) => (G[u] > 0 ? b.C / G[u] : Infinity)));
  };

  let H = B.map((b) => {
    if (b.Tm === null || b.T0 < b.Tm) return b.C * b.T0;
    return b.C * b.T0 + b.L;                      // a body that starts above its melting point starts molten
  });
  const H0 = H.reduce((s, x) => s + x, 0);
  const T = [H.map((x, u) => tempOf(x, B[u]))], molten = [H.map((x, u) => moltenOf(x, B[u]))];
  const total = { conv: 0, rad: 0, plane: 0, pass: 0 };
  const touched = new Set();
  let steps = 0, coarse = false, tauMin = Infinity;
  const budget = MAX_HEAT_STEPS / Math.max(1, run.t.length - 1);
  for (let k = 1; k < run.t.length; k++) {
    const span = run.t[k] - run.t[k - 1], c = touching(run.x[k - 1]);
    for (const { u, w } of c.pairs) { touched.add(u); touched.add(w); }
    for (const { u } of c.onPlane) touched.add(u);
    const tau = fastest(H, c);
    tauMin = Math.min(tauMin, tau);
    let n = Math.max(1, Math.ceil(span / (STEP * tau) - 1e-9));
    if (n > budget) { n = Math.max(1, Math.floor(budget)); coarse = true; }
    const dt = span / n;
    for (let s = 0; s < n; s++) {
      const k1 = flows(H, c), H2 = H.map((x, u) => x + 0.5 * dt * k1.d[u]);
      const k2 = flows(H2, c), H3 = H.map((x, u) => x + 0.5 * dt * k2.d[u]);
      const k3 = flows(H3, c), H4 = H.map((x, u) => x + dt * k3.d[u]);
      const k4 = flows(H4, c);
      H = H.map((x, u) => x + (dt / 6) * (k1.d[u] + 2 * k2.d[u] + 2 * k3.d[u] + k4.d[u]));
      for (const key of Object.keys(total)) total[key] += (dt / 6) * (k1.out[key] + 2 * k2.out[key] + 2 * k3.out[key] + k4.out[key]);
    }
    steps += n;
    T.push(H.map((x, u) => tempOf(x, B[u])));
    molten.push(H.map((x, u) => moltenOf(x, B[u])));
  }

  // ── the gates ──
  const gates = [], warnings = [], assumptions = [];
  if (coarse) warnings.push(`the heat step budget (${MAX_HEAT_STEPS} steps) coarsened its step; shorten the duration`);
  gates.push(gate('heat-dt-resolves', `the heat step is at most a fiftieth of the fastest body's time constant`, !coarse,
    { tau: sig(tauMin), steps }, coarse ? 'the step budget ran out: the temperatures are approximate' : `the fastest body's time constant is ${sig(tauMin, 3)} s`));
  const H1 = H.reduce((s, x) => s + x, 0), out = total.conv + total.rad + total.plane;
  const scale = Math.abs(H1 - H0) + Math.abs(total.conv) + Math.abs(total.rad) + Math.abs(total.plane) + total.pass;
  const drift = scale > 0 ? Math.abs(H1 - H0 + out) / scale : 0;
  gates.push(gate('heat-conserved', 'the heat the bodies lose is the heat that leaves them (to the medium, the surroundings and the planes), to one part in a billion; what passes between bodies is neither made nor lost',
    drift <= 1e-9, { drift: sig(drift, 3), left: sig(out), passed: sig(total.pass) }, drift <= 1e-9 ? 'every joule is accounted for' : 'the books do not close: the step is too coarse'));
  // lumped: the inside keeps up with the surface while Bi = h_eff·(V/A) / k stays small
  const Tmax = B.map((b, u) => Math.max(...T.map((row) => row[u])));
  const biot = B.map((b, u) => ((h + 4 * b.eps * SIGMA * Math.max(Tmax[u], Ta) ** 3) * (b.r / 3)) / b.k);
  const worstBi = Math.max(...biot), atBi = B[biot.indexOf(worstBi)].id;
  gates.push(gate('lumped-holds', 'each body is one temperature throughout: its Biot number h·(V/A)/k is under 0.1', worstBi <= 0.1, { biot: sig(worstBi, 3), body: atBi },
    worstBi <= 0.1 ? 'heat crosses the inside far faster than it leaves the surface' : `${atBi}'s inside lags its surface (Bi ${sig(worstBi, 2)}): its temperature here is a mean, and its surface runs ${Tmax[biot.indexOf(worstBi)] > Ta ? 'cooler' : 'warmer'} than shown`));
  const melters = B.filter((b) => b.Tm !== null);
  if (melters.length) {
    const melted = B.map((b, u) => ({ b, at: molten.findIndex((row) => row[u] > 0) })).filter(({ b, at }) => b.Tm !== null && at >= 0);
    gates.push(gate('bodies-solid', 'no body reaches its melting point (the run keeps every body a solid sphere)', !melted.length,
      { melted: melted.map(({ b, at }) => `${b.id} at t = ${sig(run.t[at], 4)} s`) },
      melted.length ? `${melted.map(({ b }) => b.id).join(', ')} melts: its motion past that is a solid's, not what would happen` : 'every body stays below its melting point'));
  }
  // Newton's cooling, where the model is exactly that: convection alone, nothing touched, no melting on the way
  if (!radiation) {
    const lone = B.map((b, u) => u).filter((u) => !touched.has(u) && Math.abs(B[u].T0 - Ta) > 0 && molten.every((row) => row[u] === molten[0][u]) && (B[u].Tm === null || (B[u].T0 < B[u].Tm && Tmax[u] < B[u].Tm)));
    if (lone.length) {
      let worst = 0, end = null;
      for (const u of lone) {
        const b = B[u], rate = (h * b.A) / b.C;
        run.t.forEach((t, k) => {
          const want = Ta + (b.T0 - Ta) * Math.exp(-rate * t);
          worst = Math.max(worst, Math.abs(T[k][u] - want) / Math.abs(b.T0 - Ta));
        });
        if (end === null) end = { body: b.id, expected: Ta + (b.T0 - Ta) * Math.exp(-rate * run.t.at(-1)), measured: T.at(-1)[u] };
      }
      gates.push(gate('closed-form:cooling', HEAT_CLOSED_FORMS[0].want, worst <= 1e-6,
        { expected: { [`T_end(${end.body})`]: sig(end.expected) }, measured: { [`T_end(${end.body})`]: sig(end.measured) }, error: sig(worst, 3) },
        worst <= 1e-6 ? 'the run matches the textbook answer' : `off by ${sig(worst * 100, 3)}% of the starting difference`));
    }
  }

  // ── the readout ──
  const bodies = {};
  B.forEach((b, u) => {
    const col = T.map((row) => row[u]), mol = molten.map((row) => row[u]);
    const K = (v) => ({ K: sig(v), C: celsius(v) });
    bodies[b.id] = {
      matter: b.matter.id, start: K(col[0]), end: K(col.at(-1)), max: K(Math.max(...col)), min: K(Math.min(...col)),
      capacity: { value: sig(b.C), unit: 'J/K', from: 'mass × specific heat (rupa matter table)' },
      conductivity: { value: b.k, unit: 'W/(m·K)' }, emissivity: radiation ? b.eps : 0,
      strength: { value: sig(heatShare(b.matter, Math.max(...col)), 3), at: 'its hottest', from: 'rupa\'s heat factor: whole at 20 °C, half at its softening point, none at its melting point' },
      ...(b.Tm !== null ? { melts: K(b.Tm), molten: { max: sig(Math.max(...mol), 3), end: sig(mol.at(-1), 3) } } : {}),
      biot: sig(biot[u], 3),
    };
  });
  assumptions.push(`Heat: h = ${sig(h, 3)} W/(m²·K) (${hFrom}); radiation ${radiation ? 'to surroundings at the ambient, each surface\'s emissivity from rupa\'s table' : 'left out'}; touching bodies conduct through a spot ${sig(spot * 1000, 3)} mm in radius (contact), a plane with no matter conducts none.`);
  const readout = {
    ambient: { K: sig(Ta), C: celsius(Ta) }, h: { value: sig(h), unit: 'W/(m²·K)', from: hFrom }, radiation, contact: { value: spot, unit: 'm' },
    bodies, left: { convection: sig(total.conv), radiation: sig(total.rad), planes: sig(total.plane), unit: 'J' }, passed: { value: sig(total.pass), unit: 'J' },
  };
  const series = Object.fromEntries(B.map((b, u) => [b.id, T.map((row) => sig(row[u], 9))]));
  // a body's temperature at a run time (K): its own if it is heated, its given one (or the ambient) if not
  const tAt = (i, t) => {
    const u = member.get(i);
    if (u === undefined) return model.bodies[i].temperature ?? Ta;
    let k = 0;
    while (k + 1 < run.t.length && run.t[k + 1] <= t) k++;
    return T[k][u];
  };
  return { members: B.map((b) => b.id), series, readout, gates, assumptions, warnings, tAt };
}
