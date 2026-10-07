// A falling stream of water — a faucet, a spigot, a spout — and the basin it fills. The stream is CLOSED FORM: a
// ballistic path that thins as it accelerates and carries a varicose ripple from the spout that grows until the
// column pinches into beads (Rayleigh–Plateau), all a function of (time of flight τ, time t), so the page draws it
// on the GPU with no state. The basin is the one stateful thing: its level obeys A·dh/dt = Q − drain − overflow.
//
//   jet       p(τ) = u₀τ + ½gτ² from the spout; continuity thins it, r(τ) = r₀·√(v₀/|v(τ)|)
//   regime    Weber We = ρv₀²r₀/σ against the dripping→jetting threshold (Clanet & Lasheras 1999): 4 for a fine
//             needle, far less for a wide spout, where gravity pulls a stream out of it (Bond number). Below it the
//             spout drips (Tate's law sets the drop), above it streams; an aerator makes the stream white
//   necking   a ripple born at the spout rides the jet with phase ω(t − τ), λ = 9.02·r₀ (the fastest-growing mode),
//             amplitude e^{G(τ) − K}, G = ∫0.343·√(σ/(ρr³))dτ: it grows faster as the jet thins, and where
//             1 + A·sin φ < 0 the column has broken into drops
//   the jump  on a thin layer the jet spreads as a fast glassy film that jumps up to a slow ring at
//             R ≈ C·Q^{5/8}·ν^{−3/8}·g^{−1/8} (Bohr et al. 1993); a deeper outer layer drowns it
//   the drain Torricelli: C_d·a·√(2gh)
//
//
// A SHEET is the same fall from a lip W m wide (a weir, a waterfall): over the brink the water runs at critical
// depth h_c = (q²/g)^{1/3} (q = Q/W), leaves at the brink depth 0.715·h_c with v₀ = q/h_b, and thins as 1/|v|.
// It stays glassy ("green water") for a while, whitens as air works into it, and past its break-up length — taken
// as L_b ≈ 30·h_c, so a thin veil frays within metres and a big river stays solid for tens — it splits into streaks
// and fingers and spreads sideways. A big turbulent round jet (a horsetail) aerates from its surface within a few
// diameters: L_b ≈ 24·r₀.
//
// Everything here is plain Math in SI units (metres, seconds, m³/s) and self-contained, so the page inlines these
// functions by toString() and the tests run the very same text. NECK_GLSL is the shader's twin of jetNeck().

export const WATER = { rho: 1000, sigma: 0.072, nu: 1e-6, g: 9.8 };

/** The stream's constants for a spout of radius r0 (m) at flow Q (m³/s) along unit dir. */
export function jetProfile({ r0, Q, dir = [0, 0, -1], aerated = false, K = 5 }) {
  const rho = 1000, sigma = 0.072, nu = 1e-6, g = 9.8;
  const n = Math.hypot(dir[0], dir[1], dir[2]) || 1, d = [dir[0] / n, dir[1] / n, dir[2] / n];
  const v0 = Q > 0 ? Q / (Math.PI * r0 * r0) : 0, We = (rho * v0 * v0 * r0) / sigma, Re = (2 * r0 * v0) / nu;
  // Clanet–Lasheras with inner = outer radius: We_c = 4·[1 + K·Bo² − √((1 + K·Bo²)² − 1)]², Bo = r₀·√(ρg/2σ), K 0.37
  const Bo = r0 * Math.sqrt((rho * g) / (2 * sigma)), kb = 1 + 0.37 * Bo * Bo, Wec = 4 * Math.pow(kb - Math.sqrt(kb * kb - 1), 2);
  const regime = !(Q > 0) ? 'off' : We < Wec ? 'drip' : aerated ? 'aerated' : 'jet';
  const lambda = 9.02 * r0, omega = v0 > 0 ? (2 * Math.PI * v0) / lambda : 0;
  // a drip: the drop the spout's rim can hold (Tate's law, Harkins–Brown factor 0.6), released every V/Q seconds
  const dropVol = (2 * Math.PI * r0 * sigma * 0.6) / (rho * g), dropR = Math.cbrt((3 * dropVol) / (4 * Math.PI));
  const rough = Math.max(0, Math.min(1, (Re - 4000) / 21000));
  return { shape: 'round', Lb: Re > 2e5 ? 24 * r0 : Infinity, r0, Q, dir: d, v0, We, Wec, Re, regime, lambda, omega, K, rough, dropVol, dropR, dripPeriod: Q > 0 ? dropVol / Q : Infinity,
    u0: [d[0] * v0, d[1] * v0, d[2] * v0] };
}

/** A sheet pouring over a lip W m wide at Q m³/s, leaving along unit dir (horizontal for a weir). */
export function sheetProfile({ W, Q, dir = [0, -1, 0] }) {
  const g = 9.8, q = Q > 0 && W > 0 ? Q / W : 0, hc = Math.cbrt((q * q) / g), hb = 0.715 * hc, v0 = hb > 0 ? q / hb : 0;
  const n = Math.hypot(dir[0], dir[1], dir[2]) || 1, d = [dir[0] / n, dir[1] / n, dir[2] / n];
  return { shape: 'sheet', W, Q, q, hc, hb, v0, r0: hb, dir: d, u0: [d[0] * v0, d[1] * v0, d[2] * v0], Lb: 30 * hc, regime: Q > 0 ? 'sheet' : 'off', K: 99 };
}

/** How white the falling water is after dropping `drop` m, by its break-up length Lb: 0 glassy → 1 broken up. */
export function fallAeration(Lb, drop) {
  if (!(Lb > 0) || !Number.isFinite(Lb)) return 0;
  const u = Math.max(0, Math.min(1, (drop - 0.08 * Lb) / (0.92 * Lb)));
  return u * u * (3 - 2 * u);
}

/** Where the stream is τ seconds after leaving the spout: position (m from the spout), velocity, speed, radius. */
export function jetAt(j, tau) {
  const g = 9.8, vx = j.u0[0], vy = j.u0[1], vz = j.u0[2] - g * tau;
  const speed = Math.hypot(vx, vy, vz);
  return { p: [j.u0[0] * tau, j.u0[1] * tau, j.u0[2] * tau - 0.5 * g * tau * tau], v: [vx, vy, vz], speed, r: speed > 0 ? j.r0 * Math.sqrt(j.v0 / speed) : j.r0 };
}

/** The necking amplitude e^{G(τ) − K} at n + 1 even steps of τ over [0, tauMax] (trapezoid on G), capped at 3. */
export function jetGrowth(j, tauMax, n) {
  const sigma = 0.072, rho = 1000, out = new Float64Array(n + 1);
  let G = 0, prev = 0;
  for (let i = 0; i <= n; i++) {
    const r = jetAt(j, (i / n) * tauMax).r, rate = 0.343 * Math.sqrt(sigma / (rho * r * r * r));
    if (i > 0) G += 0.5 * (prev + rate) * (tauMax / n);
    prev = rate;
    out[i] = Math.min(3, Math.exp(G - j.K));
  }
  return out;
}

/**
 * The ripple's frequency. A steady jet carries one frequency down its length, and the one that wins is the fastest
 * mode where the necking grows into view (A ≥ 0.3) — λ = 9.02·r there, not at the spout: a trickle thins to a third
 * of its spout radius before it beads. `amp` is jetGrowth's table over [0, tauMax].
 */
export function jetOmega(j, tauMax, amp) {
  const n = amp.length - 1;
  let i = 0; while (i < n && amp[i] < 0.3) i++;
  const at = jetAt(j, (i / n) * tauMax);
  return (2 * Math.PI * at.speed) / (9.02 * at.r);
}

/** The radius factor at necking amplitude A and phase ph: two incommensurate modes, never below 0 (a break). */
export function jetNeck(A, ph) {
  return Math.min(1.9, Math.max(0, 1 + A * (0.7 * Math.sin(ph) + 0.3 * Math.sin(1.37 * ph + 1.1))));
}

/** Flight time until the stream has dropped dz metres (dz < 0: below the spout). */
export function jetHitTime(j, dz) {
  const g = 9.8, uz = j.u0[2], disc = uz * uz - 2 * g * dz;
  return disc < 0 ? Infinity : (uz + Math.sqrt(disc)) / g;
}

/** Radius (m) of the hydraulic jump where a stream of Q m³/s meets a layer hOut m deep (0 once drowned). */
export function jumpRadius(Q, hOut) {
  if (!(Q > 0)) return 0;
  return 0.15 * Math.pow(Q, 0.625) * Math.pow(1e-6, -0.375) * Math.pow(9.8, -0.125) * Math.exp(-Math.max(0, hOut) / 0.008);
}

/**
 * One step of a basin's water depth h (m above the drain): inflow Q, out through the drain when the plug is out
 * (Torricelli, C_d 0.6), over the overflow slot when it is reached. `b`: { area m², drainR m, overflowH m, overflowW m }.
 */
export function basinStep(h, dt, Q, plug, b) {
  const g = 9.8, out = plug ? 0 : 0.6 * Math.PI * b.drainR * b.drainR * Math.sqrt(2 * g * Math.max(0, h));
  const over = h > b.overflowH ? (2 / 3) * 0.6 * b.overflowW * Math.sqrt(2 * g) * Math.pow(h - b.overflowH, 1.5) : 0;
  return Math.max(0, h + (dt * (Q - out - over)) / b.area);
}

// the shader's twin of jetNeck (GLSL∩JS once `float ` becomes `let `)
export const NECK_GLSL = `
float jetNeck(float A, float ph) {
  return min(1.9, max(0.0, 1.0 + A * (0.7 * sin(ph) + 0.3 * sin(1.37 * ph + 1.1))));
}
`;

const r4 = (v) => +(+v).toFixed(4);
const num = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

/**
 * Normalise a recipe's `jets` list. A jet: { at: [x, y, z] (the spout, world units), dir, radius (m), flow (L/s),
 * aerated, into (the shallows body it falls into), plug, drain (m), overflow (m above the drain) }.
 */
export function normalizeJets(list, { bodies = [], metersPerUnit = 1 } = {}) {
  const L = 1 / (Number.isFinite(+metersPerUnit) && +metersPerUnit > 0 ? +metersPerUnit : 1);
  const out = [];
  for (const [i, raw] of (Array.isArray(list) ? list : []).entries()) {
    if (!raw || !Array.isArray(raw.at)) continue;
    const body = bodies.find((b) => b.id === raw.into) || null;
    const j = {
      id: raw.id || `jet${i}`, at: raw.at.slice(0, 3).map((v) => r4(num(v, -1e5, 1e5, 0))), dir: (raw.dir || [0, 0, -1]).slice(0, 3).map((v) => r4(num(v, -1, 1, 0))),
      radius: r4(num(raw.radius, 0.0005, 3, 0.005)), flow: r4(Number.isFinite(+raw.discharge) ? num(raw.discharge * 1000, 0, 1e7, 60) : num(raw.flow, 0, 1e7, 0.06)), aerated: !!raw.aerated, K: r4(num(raw.noise, 1, 12, 5)),
      into: body ? body.id : null, L: r4(L),
    };
    // a sheet: the lip's width (world units) across the direction it pours, horizontal
    if (raw.shape === 'sheet') {
      j.shape = 'sheet'; j.width = r4(num(raw.width, 0.05 * L, 500 * L, 4 * L));
      // the approach: the river the sheet pours from — its surface draws down `head` m to the brink over `length`
      // (world) and narrows from the channel's half-width `half` (world) to the lip's: drawn as the sheet's tongue
      if (raw.approach && typeof raw.approach === 'object') j.approach = { length: r4(num(raw.approach.length, 0.1 * L, 100 * L, 4 * L)), head: r4(num(raw.approach.head, 0, 10, 0.3)), half: r4(num(raw.approach.half, 0.05 * L, 300 * L, j.width / 2)) };
    }
    if (raw.mist != null) j.mist = !!raw.mist;
    if (Number.isFinite(+raw.fall)) j.fall = r4(num(raw.fall, 0.05, 2000, 3));          // m: how far it may fall (where to look for its landing)
    if (raw.controls != null) j.controls = !!raw.controls;
    if (body && body.kind === 'basin') {
      j.basin = { area: r4((body.size[0] * body.size[1]) / (L * L)), drainR: r4(num(raw.drain, 0.005, 0.1, body.drain / L)), overflowH: r4(num(raw.overflow, 0.01, 2, (body.deep + body.dish) / L - 0.03)),
        overflowW: 0.03, floor: r4(body.drainZ), plug: raw.plug !== false, h0: r4(num(raw.fill, 0, 2, 0)) };
    }
    out.push(j);
  }
  return out;
}

/** A faucet's chrome as faces: a pillar from the counter, an arm out over the basin, a nozzle down to the spout. */
export function faucetFaces(jet, { counter, back = 0.16, color = '#c4ccd3' } = {}) {
  const L = jet.L, [sx, sy, sz] = jet.at, w = 0.018 * L, top = sz + 0.05 * L, by = sy + back * L;
  const box = (x0, y0, z0, x1, y1, z1, fill) => {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    return [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [0, 3, 2, 1]].map((q) => ({ corners: q.map((k) => c[k]), fill, doubleSided: true, group: `faucet:${jet.id}` }));
  };
  return [
    ...box(sx - w, by - w, counter, sx + w, by + w, top + w, color),                         // the pillar
    ...box(sx - w * 0.8, sy - w * 0.8, top - w * 0.8, sx + w * 0.8, by, top + w * 0.8, color), // the arm
    ...box(sx - w * 0.9, sy - w * 0.9, sz, sx + w * 0.9, sy + w * 0.9, top, color),           // the nozzle
    ...box(sx - w * 0.5, by + w, top - w * 0.4, sx + w * 0.5, by + 3.2 * w, top + w * 0.4, '#d8dde2'), // the lever
  ];
}
