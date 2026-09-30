// vegetation/bamboo — bamboo: a jointed culm, the stack as a lathe.
//
// A bamboo is a grass: no cambium (like the palm), and no bark, rings or spiral grain. Its fibres run axially, so the
// culm is a hollow tube cut into internodes by solid nodes, and its whole shape is a profile r(s) swept round a spine.
//   · EVERYTHING IS SET BEFORE IT SHOWS: the shoot carries all its nodes and its diameter when it emerges; each
//     internode then elongates from its own intercalary meristem, in a wave from the base up, over a few weeks.
//     Internode lengths here come from that wave: a supply bell (reserves from the rhizome) read through a sliding
//     window, laid down as wall volume, so an internode is long where the supply peaked and where the tube is thin.
//   · THE STACK IN TIME TURNED SIDEWAYS: a palm's age gradient runs up one trunk; a culm is one age from base to tip,
//     so the gradient runs across the grove, as cohorts. A culm keeps lignifying for a few years, then yellows and dies.
//   · MECHANICS: hollow (I/A grows with R/t), fibres packed toward the outer wall (EI above the area-averaged E), weak
//     in the hoop direction (so the nodes are ring stiffeners against ovalization), and a thin top loaded with leaves
//     that nods: the spine is the large-deflection cantilever, relaxed under culm, branch and leaf weight.
//   · DISTICHOUS: branches alternate sides by 180° (a grass), with the sulcus groove above each branch.
// Deterministic: mulberry32 dice from the seed.
import { G } from './mechanics.js';
import { mulberry32, vec, rot } from './grow.js';
import { blobTris } from './tree-mesh.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';
const { add, sub, mul, dot, cross, len, unit } = vec;
const UP = [0, 0, 1]; const DEG = Math.PI / 180;
function perp(d) { const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; return unit(cross(a, d)); }
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

// ── species ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Literature values (cited in docs/vegetation.md). H and D0 at size 1 (D0 the base diameter); a size class s scales
// D0 by s and H by s^hExp (Moso: H ∝ D^0.629, Inoue 2013). Along the culm (x = height fraction):
//   D(x) = D0·(1 − (1 − dTop)·x^taper)·(base + (1 − base)·min(1, x/xMax))·(1 + swell·e^(−x/0.02))   — a finite tip,
//          Bambusa's widest point ~4 m up (base < 1, PROSEA), Moso's butt swell (Inoue 2013);
//   t/D = t.mid + t.butt·e^(−x/t.len) + t.top·x³   — U-shaped: a thick butt, ~0.085 mid-culm, ~0.15 at the tip (Amada
//          et al. 1997 via Sato et al. 2017).
// wave (days): dt between internode starts, w each internode's elongation window, shape the window's beta exponents
// (Moso: a slow start then a ~6-day burst, Chen et al. 2022), the supply bell's peak and its widths before (widthL) and
// after (width) the peak. E (GPa, green) outer/inner wall with the gradient exponent p (Moso 25.6 / 3.8 dry, Jiang et
// al. 2024; ~quadratic, Amada 1997); ET the hoop/axial ratio; strain the outer fibres' failure strain (388 MPa / 25.6
// GPa, Jiang 2024). rho: WET density at maturity, outer/inner. mature: the whole-wall E factor rises fast (outer
// fibres done by ~6 months, Huang et al. 2012), the dry density slowly (0.26 → 0.63 g/cm³ by year 3, Uchida et al.
// 2022) while the moisture falls, so a first-year culm is lighter than a mature one.
export const BAMBOOS = {
  moso: {
    label: 'Moso (Phyllostachys edulis): running, giant', habit: 'running', H: 14, hExp: 0.63, D0: 0.095, nodes: 50,
    taper: 1.3, dTop: 0.12, base: 1, xMax: 0, swell: 0.1, t: { mid: 0.085, butt: 0.12, len: 0.05, top: 0.07 },
    wave: { dt: 0.45, w: 23, shape: [8, 1.5], peak: 21, widthL: 1, width: 5.5 }, beta: 1,
    E: { out: 23, in: 3.4, p: 2.2 }, ET: 0.07, strain: 0.015, rho: { out: 1200, in: 950 },
    mature: { E0: 0.55, tauE: 0.25, rhoDry: [0.26, 0.63], tauRho: 0.9, mc: [1.5, 0.7], tauMc: 1.0 },
    branchFrom: 0.36, perNode: 2, share: 0.85, branchLen: 1.8, branchAngle: 50, branchB: 1.2, branchD: 0.013,
    twigEvery: 0.07, twigLen: 0.3, letEvery: 0.03, leavesPerLet: 3, leafLen: 0.075, leafW: 0.0095, leafMass: 0.7e-4,
    ridge: 0.03, waxW: 0.03, bandW: 0.012, sulcus: 0.1, sheathLen: 0.34, sheathHold: 2, lean: 1.5, life: 10, zigzag: 0,
    colors: { young: [62, 128, 74], culm: [122, 150, 80], old: [170, 164, 98], grey: [178, 174, 148], wax: [196, 206, 196], band: [70, 72, 50], scar: [92, 88, 66],
      leaf: [104, 140, 58], leafDry: [168, 160, 84], branch: [120, 132, 74], sheath: [156, 116, 76], spot: [74, 54, 38] },
  },
  vulgaris: {
    label: 'Bambusa vulgaris: clumping, drooping at the top', habit: 'clumping', H: 13, hExp: 0.63, D0: 0.075, nodes: 43,
    taper: 2.0, dTop: 0.14, base: 0.88, xMax: 0.3, swell: 0, t: { mid: 0.13, butt: 0.07, len: 0.08, top: 0.05 },
    wave: { dt: 1.0, w: 20, shape: [4, 2], peak: 26, widthL: 11, width: 9.5 }, beta: 1,
    E: { out: 20, in: 3, p: 2.2 }, ET: 0.07, strain: 0.015, rho: { out: 1200, in: 950 },
    mature: { E0: 0.55, tauE: 0.25, rhoDry: [0.26, 0.63], tauRho: 0.9, mc: [1.5, 0.7], tauMc: 1.0 },
    branchFrom: 0.2, perNode: 3, branchLen: 2.3, branchAngle: 58, branchB: 2.0, branchD: 0.012,
    twigEvery: 0.1, twigLen: 0.35, letEvery: 0.07, leavesPerLet: 4, leafLen: 0.2, leafW: 0.028, leafMass: 4.0e-4,
    ridge: 0.05, waxW: 0, bandW: 0.015, sulcus: 0, sheathLen: 0.3, sheathHold: 30, lean: 12, life: 8, zigzag: 2.5, drift: 23, spread: 58,
    colors: { young: [74, 136, 58], culm: [98, 138, 62], old: [172, 160, 88], grey: [156, 150, 124], wax: [98, 138, 62], band: [70, 84, 46], scar: [84, 96, 56],
      leaf: [96, 136, 56], leafDry: [160, 150, 84], branch: [110, 134, 66], sheath: [150, 122, 80], spot: [110, 86, 56] },
  },
  reed: {
    label: 'common reed (Phragmites australis): the same builder, small', habit: 'bed', H: 2.8, hExp: 0.63, D0: 0.009, nodes: 18,
    taper: 1.2, dTop: 0.35, base: 1, xMax: 0, swell: 0, t: { mid: 0.14, butt: 0.03, len: 0.1, top: 0.06 },
    wave: { dt: 4, w: 20, shape: [2, 2], peak: 31, widthL: 16, width: 23.5 }, beta: 1,
    E: { out: 10, in: 3, p: 2 }, ET: 0.07, strain: 0.015, rho: { out: 1000, in: 800 },
    mature: { E0: 0.7, tauE: 0.1, rhoDry: [0.3, 0.45], tauRho: 0.2, mc: [2, 1.2], tauMc: 0.3 },
    branchFrom: 1, perNode: 0, culmLeaves: { from: 0.2, len: 0.38, w: 0.022, B: [2, 7], lee: 0.7 }, plume: 0.3,
    leafMass: 1.5e-3, leafLen: 0.38, leafW: 0.022,
    ridge: 0.04, waxW: 0, bandW: 0, sulcus: 0, sheathLen: 0.25, sheathHold: 30, lean: 3, life: 1, zigzag: 0,
    colors: { young: [120, 146, 80], culm: [150, 142, 92], old: [176, 160, 110], grey: [170, 160, 130], wax: [150, 142, 92], band: [120, 110, 70], scar: [120, 110, 70],
      leaf: [128, 142, 82], leafDry: [176, 160, 110], branch: [150, 142, 92], sheath: [150, 142, 92], spot: [120, 110, 70], plume: [150, 118, 110] },
  },
};
const specOf = (s) => (typeof s === 'string' ? BAMBOOS[s] : s);
export const diamAt = (sp, D0, x) => { const X = Math.min(1, Math.max(0, x)); return D0 * (1 - (1 - sp.dTop) * dmath.pow(X, sp.taper)) * (sp.xMax > 0 ? sp.base + (1 - sp.base) * Math.min(1, X / sp.xMax) : 1) * (1 + sp.swell * dmath.exp(-X / 0.02)); };
export const wallRatio = (sp, x) => sp.t.mid + sp.t.butt * dmath.exp(-x / sp.t.len) + sp.t.top * dmath.pow(x, 3);
/** Maturity at an age (years since elongation): the whole-wall E factor, and the wet density over the mature wet density. */
export function maturity(specIn, age) {
  const sp = specOf(specIn); const m = sp.mature; const a = Math.max(0, age);
  const dry = (t) => m.rhoDry[1] - (m.rhoDry[1] - m.rhoDry[0]) * dmath.exp(-t / m.tauRho), mc = (t) => m.mc[1] + (m.mc[0] - m.mc[1]) * dmath.exp(-t / m.tauMc);
  return { E: 1 - (1 - m.E0) * dmath.exp(-a / m.tauE), wet: (dry(a) * (1 + mc(a))) / (m.rhoDry[1] * (1 + m.mc[1])), dry: dry(a), mc: mc(a) };
}

// ── the elongation wave → internode lengths ─────────────────────────────────────────────────────────────────
/**
 * Internode i elongates over [i·dt, i·dt + w] (a beta-shaped window), fed by a supply bell S(t). The wall VOLUME it lays down
 * is V_i = ∫S·g; its length is V_i/(D_i·t_i)^β (β = 1: volume conservation), normalised to the culm height. Returns
 * the lengths, the section at each internode, and the height-growth curve the same wave predicts.
 */
export function elongation(specIn, { size = 1 } = {}) {
  const sp = specOf(specIn); const N = sp.nodes; const { dt, w, peak, width } = sp.wave; const h = 0.05;
  const S = (t) => dmath.exp(-0.5 * ((t - peak) / (t < peak ? (sp.wave.widthL ?? width) : width)) ** 2);   // rises, then drains
  const [ea, eb] = sp.wave.shape || [2, 2]; let Z = 0; for (let u = 0.0005; u < 1; u += 0.001) Z += dmath.pow(u, ea) * dmath.pow(1 - u, eb) * 0.001;
  const g = (u) => (u <= 0 || u >= w ? 0 : (dmath.pow(u / w, ea) * dmath.pow(1 - u / w, eb)) / (Z * w));        // a beta window: slow, then a burst
  const V = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let u = h / 2; u < w; u += h) s += S(i * dt + u) * g(u) * h; V[i] = s; }
  const Hs = sp.H * dmath.pow(size, sp.hExp), D0 = sp.D0 * size;
  let x = [...Array(N)].map((_, i) => (i + 0.5) / N); let L = [], D = [], T = [];
  for (let it = 0; it < 12; it++) {
    D = x.map((xi) => diamAt(sp, D0, xi)); T = x.map((xi, i) => D[i] * wallRatio(sp, xi));
    L = [...V].map((v, i) => v / dmath.pow(D[i] * T[i], sp.beta)); const sum = L.reduce((a, b) => a + b, 0); L = L.map((l) => (l * Hs) / sum);
    let acc = 0; x = L.map((l) => { const m = (acc + l / 2) / Hs; acc += l; return m; });
  }
  // the height curve: dH/dt = Σ L_i · S(t)·g(t − t_i)/V_i
  const Tend = (N - 1) * dt + w; const curve = []; let Hacc = 0, peakRate = 0, t95 = null;
  for (let t = 0; t <= Tend + 1e-9; t += 0.25) {
    let r = 0; for (let i = 0; i < N; i++) r += (L[i] * S(t) * g(t - i * dt)) / V[i];
    Hacc += r * 0.25; peakRate = Math.max(peakRate, r); if (t95 === null && Hacc >= 0.95 * Hs) t95 = t;
    if (Math.abs(t - Math.round(t)) < 1e-9) curve.push({ day: Math.round(t), height: +Hacc.toFixed(2), rate: +r.toFixed(3) });
  }
  const iMax = L.indexOf(Math.max(...L));
  // how many internodes are elongating at once on the day of peak growth (between 1% and 99% of their length)
  const tp = curve.reduce((m, c) => (c.rate > m.rate ? c : m), curve[0]).day; let simultaneous = 0;
  for (let i = 0; i < N; i++) { let a = 0; for (let u = h / 2; u < Math.min(w, tp - i * dt); u += h) a += S(i * dt + u) * g(u) * h; const fr = a / V[i]; if (fr > 0.01 && fr < 0.99) simultaneous++; }
  return { sp, L, D, T, x, V: [...V], Hs, D0, curve, peakRate, peakDay: tp, simultaneous, daysTo95: t95, days: Tend, iMax, maxFrac: iMax / N, S, g };
}
/** The fraction of internode i's length grown by day t (its S-weighted window, integrated). */
function grownFrac(el, i, t) {
  if (t === Infinity) return 1; const { dt, w } = el.sp.wave; const t0 = i * dt; if (t <= t0) return 0; if (t >= t0 + w) return 1;
  let a = 0; for (let u = 0.025; u < t - t0; u += 0.05) a += el.S(t0 + u) * el.g(u) * 0.05; return Math.min(1, a / el.V[i]);
}

// ── the section: a graded hollow tube ────────────────────────────────────────────────────────────────────────────
/** EI, mass per metre, and the uniform-E comparisons for a tube of diameter D, wall t, at `age` years (maturity). */
export function section(specIn, D, t, age = 4, { graded = true } = {}) {
  const sp = specOf(specIn); const R = D / 2, ri = Math.max(0, R - t); const K = 24; const dr = (R - ri) / K; const mt = maturity(sp, age); const f = mt.E;
  let EI = 0, EA = 0, A = 0, m = 0;
  for (let k = 0; k < K; k++) {
    const r = ri + (k + 0.5) * dr, u = (k + 0.5) / K; const gw = graded ? dmath.pow(u, sp.E.p) : 1 / (sp.E.p + 1);
    const E = (sp.E.in + (sp.E.out - sp.E.in) * gw) * 1e9 * f; const rho = (sp.rho.in + (sp.rho.out - sp.rho.in) * gw) * mt.wet;
    EI += E * Math.PI * dmath.pow(r, 3) * dr; EA += E * 2 * Math.PI * r * dr; A += 2 * Math.PI * r * dr; m += rho * 2 * Math.PI * r * dr;
  }
  const Emean = EA / A;
  return { EI, A, q: m, Emean, EIuniform: (Emean * Math.PI * (dmath.pow(R, 4) - dmath.pow(ri, 4))) / 4, EIsolid: (Emean * A * A) / (4 * Math.PI), R, ri, t: R - ri };
}
/**
 * Brazier: the moment at which bending ovalizes a long tube, orthotropic (√(E_L·E_T)), against the moment at which the
 * outer fibres reach their failure strain (M = ε_f·EI/R). Below 1, a nodeless tube would ovalize before it breaks.
 */
export function brazierRatio(specIn, D, t, age = 4) {
  const sp = specOf(specIn); const s = section(sp, D, t, age); const R = (s.R + s.ri) / 2; const EL = s.Emean, ET = EL * sp.ET;
  const MB = ((2 * Math.SQRT2) / 9) * Math.PI * Math.sqrt(EL * ET) * R * t * t / Math.sqrt(1 - 0.3 * 0.3 * sp.ET);
  const Mf = (sp.strain * s.EI) / s.R;
  return { MB, Mf, ratio: MB / Mf, RoverT: R / t };
}

// ── the culm ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Grow one culm. `size` the size class, `age` years since it elongated (maturity and colour), `lean`/`az` the grown lean
 * (degrees, azimuth), `nodAz` the plane it nods in (default az), `days` a shoot still elongating (sheathed, leafless).
 * Returns { sp, N, L, z, D, T, spine: node points, branches, leaves, sheaths, twigs, tipAngle, ... }.
 */
export function growCulm(specIn, { seed = 1, size = 1, age = 3, lean = null, az = 0, days = Infinity, leaves = true, relaxIters = 900 } = {}) {
  const sp = specOf(specIn); const rng = mulberry32((seed * 2654435761) >>> 0); const el = elongation(sp, { size }); const N = sp.nodes;
  const Lfull = el.L.map((l) => l * (0.94 + 0.12 * rng()));
  const L = Lfull.map((l, i) => l * grownFrac(el, i, days));
  const z = [0]; for (let i = 0; i < N; i++) z.push(z[i] + L[i]);
  const sec = el.D.map((D, i) => section(sp, D, el.T[i], days === Infinity ? age : 0.02));
  const leafy = leaves && days === Infinity;
  // the branch plan (distichous: node k's bud faces φ0 + kπ), before the spine, since its weight bends it
  const kb = Math.round(sp.branchFrom * N); const plan = []; const phi0 = rng() * 2 * Math.PI; const sH = dmath.pow(size, sp.hExp);
  const shares = sp.perNode === 2 ? [[1, -26], [sp.share ?? 0.62, 26]] : sp.perNode === 3 ? [[1, 0], [0.55, -(sp.spread ?? 38)], [0.55, sp.spread ?? 38]] : [];   // a cluster: one dominant, two splayed
  const drift = (sp.drift ?? 5) * DEG;                     // the plane of alternation twists a few degrees a node
  if (leafy) for (let k = Math.max(1, kb); k < N; k++) {
    const xi = (k - kb) / Math.max(1, N - kb); const Lb = sp.branchLen * sH * dmath.pow(dmath.sin(Math.PI * (0.16 + 0.8 * xi)), 0.7) * (0.85 + 0.3 * rng());
    for (const [share, off] of shares) plan.push({ k, az: phi0 + (k % 2) * Math.PI + k * drift + off * DEG, bud: phi0 + (k % 2) * Math.PI + k * drift, len: Lb * share });
  }
  const twigsOf = (b) => Math.max(1, Math.floor((0.8 * b.len) / sp.twigEvery));
  const leavesOfTwig = (tl) => (1 + Math.floor((0.85 * tl) / sp.letEvery)) * sp.leavesPerLet;
  const nodeMass = new Float64Array(N + 1);
  for (const b of plan) { const d = sp.branchD * Math.sqrt(b.len / sp.branchLen); nodeMass[b.k] += 900 * Math.PI * (d / 2) ** 2 * b.len * 0.45 + twigsOf(b) * leavesOfTwig(sp.twigLen * 0.85) * sp.leafMass; }
  if (sp.culmLeaves && leafy) for (let k = Math.round(sp.culmLeaves.from * N); k < N; k++) nodeMass[k] += sp.leafMass;
  // the spine: the grown lean, then the large-deflection cantilever relaxed under its weight (2-D, in the lean plane)
  const L0 = (lean ?? sp.lean) * DEG; const phiG = L.map((_, i) => Math.max(L0, 0.3 * DEG) + (sp.zigzag && i > 0.4 * N ? (i % 2 ? 1 : -1) * sp.zigzag * DEG * 0.5 : 0));
  const phi = [...phiG]; let resid = 0;
  const EI = sec.map((s) => s.EI), mseg = sec.map((s, i) => s.q * L[i]);
  for (let it = 0; it < relaxIters; it++) {
    const x = [0]; for (let i = 0; i < N; i++) x.push(x[i] + L[i] * dmath.sin(phi[i]));
    const xm = L.map((_, i) => (x[i] + x[i + 1]) / 2);
    // moment about node j from everything above: suffix sums of m and m·x
    const Sm = new Float64Array(N + 2), Smx = new Float64Array(N + 2);
    for (let i = N - 1; i >= 0; i--) { Sm[i] = Sm[i + 1] + mseg[i] + nodeMass[i + 1]; Smx[i] = Smx[i + 1] + mseg[i] * xm[i] + nodeMass[i + 1] * x[i + 1]; }
    let acc = 0; resid = 0;
    for (let j = 0; j < N; j++) {
      const M = G * (Smx[j] - Sm[j] * x[j]); const kap = M / EI[j]; const target = phiG[j] + acc + 0.5 * kap * L[j]; acc += kap * L[j];
      const nw = phi[j] + 0.18 * (Math.min(Math.PI * 0.95, target) - phi[j]); resid = Math.max(resid, Math.abs(nw - phi[j])); phi[j] = nw;
    }
    if (resid < 1e-7) break;
  }
  const h = [dmath.cos(az * DEG), dmath.sin(az * DEG), 0];
  const P = [[0, 0, 0]]; for (let i = 0; i < N; i++) { const d = add(mul(h, dmath.sin(phi[i])), mul(UP, dmath.cos(phi[i]))); P.push(add(P[i], mul(d, L[i]))); }
  const Tseg = L.map((l, i) => (l > 1e-6 ? unit(sub(P[i + 1], P[i])) : unit(add(mul(h, dmath.sin(phi[i])), mul(UP, dmath.cos(phi[i]))))));
  const Tn = P.map((_, k) => unit(add(Tseg[Math.max(0, k - 1)], Tseg[Math.min(N - 1, k)])));
  let Nv = perp(Tn[0]); const Nn = Tn.map((t) => (Nv = unit(sub(Nv, mul(t, dot(Nv, t))))));
  const culm = { sp, seed, size, age, days, N, L, Lfull, z, D: el.D, T: el.T, sec, P, Tseg, Tn, Nn, phi, tipAngle: phi[N - 1] / DEG, baseLean: phi[0] / DEG, relaxResid: resid, el, kb, plan, nodeMass, height: P[N][2] };
  culm.frameAt = (s) => frameAt(culm, s);
  if (leafy) buildFoliage(culm, rng);
  return culm;
}
/** The transported frame and centre at arc s along the spine (between nodes: the segment's tangent). */
function frameAt(c, s) {
  const { z, P, Tseg, Tn, Nn, N } = c; let k = 0; while (k < N - 1 && z[k + 1] <= s) k++;
  const Lk = z[k + 1] - z[k]; const f = Lk > 1e-9 ? Math.max(0, Math.min(1, (s - z[k]) / Lk)) : 0;
  const T = f <= 1e-6 ? Tn[k] : f >= 1 - 1e-6 ? Tn[k + 1] : Tseg[k];
  const Nf = unit(sub(lerp(Nn[k], Nn[k + 1], f), mul(T, dot(lerp(Nn[k], Nn[k + 1], f), T))));
  return { c: lerp(P[k], P[k + 1], f), T, N: Nf, B: cross(T, Nf), k, f };
}
/** Branches (elastica), twigs (alternate), leaf fans; or, for a reed, a leaf per node and a plume. */
function buildFoliage(c, rng) {
  const { sp } = c; c.branches = []; c.twigs = []; c.leaves = []; c.blades = [];
  const leaf = (base, dir, Ll, Wl, col) => c.leaves.push({ base, dir, len: Ll, w: Wl, col });
  for (const b of c.plan) {
    const F = frameAt(c, c.z[b.k]); const radial = add(mul(F.N, dmath.cos(b.az)), mul(F.B, dmath.sin(b.az)));
    const base = add(F.c, mul(radial, c.D[Math.min(c.N - 1, b.k)] / 2));
    const a = sp.branchAngle * DEG; const d0 = unit(add(mul(F.T, dmath.cos(a)), mul(radial, dmath.sin(a))));
    let hor = sub(d0, mul(UP, d0[2])); if (len(hor) < 1e-3) hor = radial; hor = unit(hor);
    const th0 = dmath.asin(Math.max(-1, Math.min(1, d0[2]))); const B = sp.branchB * dmath.pow(b.len / sp.branchLen, 1.2);
    const pts = elasticaPts(B, th0, 12).map(([x, y]) => add(base, add(mul(hor, x * b.len), mul(UP, y * b.len))));
    const br = { k: b.k, az: b.az, len: b.len, pts, r0: (sp.branchD * Math.sqrt(b.len / sp.branchLen)) / 2 }; c.branches.push(br);
    const nt = Math.max(1, Math.floor((0.8 * b.len) / sp.twigEvery));
    for (let q = 0; q < nt; q++) {
      const u = 0.2 + (0.8 * (q + 0.5)) / nt; const at = polyAt(pts, u); const t = unit(polyTan(pts, u));
      let side = cross(t, UP); side = len(side) < 1e-3 ? perp(t) : unit(side); const sg = q % 2 ? 1 : -1;
      side = rot(side, t, sg * (15 + 45 * rng()) * DEG);                                        // twigs splay round the branch
      const td = unit(add(add(mul(t, dmath.cos(55 * DEG)), mul(side, sg * dmath.sin(55 * DEG))), [0, 0, -0.12]));
      const tl = sp.twigLen * (0.7 + 0.6 * rng()) * (1 - 0.35 * u); const end = add(at, mul(td, tl)); const tw = { a: at, b: end, first: c.leaves.length, branch: br }; c.twigs.push(tw);
      // leafy branchlets along the twig (alternate), and a fan at its end: each a few leaves, spread and hanging
      const nl = Math.floor((0.85 * tl) / sp.letEvery); let tside = cross(td, UP); tside = len(tside) < 1e-3 ? perp(td) : unit(tside);
      for (let l = 0; l <= nl; l++) {
        const tip = l === nl; const at2 = tip ? end : add(at, mul(td, tl * (0.15 + (0.85 * l) / Math.max(1, nl))));
        const base = tip ? td : unit(add(mul(td, 0.6), mul(tside, l % 2 ? 0.8 : -0.8)));
        const n = sp.leavesPerLet; const col = mix(sp.colors.leaf, sp.colors.leafDry, 0.25 * rng() * rng());
        for (let q = 0; q < n; q++) {
          const off = n > 1 ? (-45 + (90 * q) / (n - 1)) * DEG + (rng() - 0.5) * 0.35 : 0;
          const ld = unit(add(rot(sub(base, mul(UP, base[2])), UP, off), [0, 0, -(0.3 + 0.55 * rng())]));
          leaf(at2, ld, sp.leafLen * (0.8 + 0.35 * rng()), sp.leafW * (0.85 + 0.3 * rng()), mix(col, sp.colors.leafDry, 0.12 * rng()));
        }
      }
      tw.last = c.leaves.length;
    }
  }
  if (sp.culmLeaves) {                                      // reed: one blade per node, alternate sides, an elastica each
    const cl = sp.culmLeaves; const phi0 = rng() * 2 * Math.PI;
    for (let k = Math.round(cl.from * c.N); k < c.N; k++) {
      const F = frameAt(c, c.z[k]); const azk = phi0 + (k % 2) * Math.PI; const radial = add(mul(F.N, dmath.cos(azk)), mul(F.B, dmath.sin(azk)));
      const xi = k / c.N; const Ll = cl.len * (1 - 0.5 * xi) * (0.85 + 0.3 * rng()) * dmath.pow(c.size, c.sp.hExp);
      const lee = [dmath.cos(c.windAz ?? 0), dmath.sin(c.windAz ?? 0), 0]; const out = unit(add(mul(radial, 1 - (cl.lee ?? 0)), mul(lee, cl.lee ?? 0)));   // blades turn downwind
      const d0 = unit(add(mul(F.T, dmath.cos(32 * DEG)), mul(out, dmath.sin(32 * DEG)))); let hor = unit(sub(d0, mul(UP, d0[2])));
      const B = cl.B[0] + (cl.B[1] - cl.B[0]) * rng(); const pts = elasticaPts(B, dmath.asin(d0[2]), 8).map(([x, y]) => add(F.c, add(mul(hor, x * Ll), mul(UP, y * Ll))));
      c.blades.push({ pts, w: cl.w * (1 - 0.3 * xi), col: mix(sp.colors.leaf, sp.colors.leafDry, 0.2 + 0.4 * xi * rng()) });
    }
    c.plume = { at: c.P[c.N], dir: c.Tn[c.N], len: sp.plume * dmath.pow(c.size, c.sp.hExp) };
  }
}
function elasticaPts(B, theta0, n) {
  // θ'' = B(1 − s)cosθ by shooting (mechanics.js's elastica, inlined coarse for the many branches)
  const run = (k0) => { let th = theta0, k = k0, x = 0, y = 0; const pts = [[0, 0]]; const hh = 1 / 40; for (let i = 0; i < 40; i++) { const s = i * hh; const kk = k + 0.5 * hh * B * (1 - s) * dmath.cos(th); const thm = th + 0.5 * hh * k; k += hh * B * (1 - s - hh / 2) * dmath.cos(thm); const thN = th + hh * kk; x += hh * dmath.cos((th + thN) / 2); y += hh * dmath.sin((th + thN) / 2); th = thN; pts.push([x, y]); } return { k, pts }; };
  let lo = -B / 2 - 1e-9, hi = 1e-9; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (run(lo).k * run(m).k <= 0) hi = m; else lo = m; }
  const all = run((lo + hi) / 2).pts; return [...Array(n + 1)].map((_, q) => all[Math.round((q * 40) / n)]);
}
function polyAt(pts, u) { const f = u * (pts.length - 1); const i = Math.min(pts.length - 2, Math.floor(f)); return lerp(pts[i], pts[i + 1], f - i); }
function polyTan(pts, u) { const f = u * (pts.length - 1); const i = Math.min(pts.length - 2, Math.floor(f)); return sub(pts[i + 1], pts[i]); }

// ── colour by age (the stack sideways: a grove's cohorts) ────────────────────────────────────────────────────────
/**
 * The culm's colour at an age (foresters' 'du' classes, Xu et al. 2022): year 1 emerald with white wax, years 2–3 light
 * green with the wax gone, years 4–5 greenish-yellow with darkening nodes, then greyish-white.
 */
export function culmColor(specIn, age) {
  const sp = specOf(specIn); const C = sp.colors;
  if (age < 1) return C.young; if (age < 3.5) return C.culm; if (age < 5.5) return mix(C.culm, C.old, (age - 3.5) / 2); return mix(C.old, C.grey, Math.min(1, (age - 5.5) / 3));
}
/** The per-instance tint from a template's own colour (young templates: C.young; the rest: C.culm) to the colour at `age`. */
export const ageTint = (specIn, age) => { const sp = specOf(specIn); const base = age < 1 ? sp.colors.young : sp.colors.culm; const c = culmColor(sp, age); return c.map((x, i) => +(x / base[i]).toFixed(3)); };

// ── the lathe ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The culm's rings along its arc, by level: 'ridge' (L3: four rings a node — the ridge's silhouette, the wax band, the
 * sheath scar), 'band' (L2: two rings a node, colour only, and only where the internode is at least `bandMin` long),
 * 'plain' (L1/L0: `segs` rings, the taper alone). A ring carries the colour of the strip above it.
 */
export function culmRings(c, { mode = 'ridge', bandMin = 0, segs = 10, color = null, wax = false } = {}) {
  const { sp, z, N } = c; const C = sp.colors; const body = color || (wax ? C.young : C.culm); const rings = []; const r = (i) => c.D[Math.min(N - 1, Math.max(0, i))] / 2;
  const useWax = wax && sp.waxW > 0; const bandCol = useWax ? C.wax : C.band;     // year 1: the wax ring; later: a darkening node
  const last = z[N];
  if (mode === 'plain') { for (let q = 0; q <= segs; q++) { const s = (last * q) / segs; const i = Math.min(N - 1, z.findIndex((zz) => zz > s) - 1); rings.push({ s, r: r(i < 0 ? N - 1 : i), col: body, i: Math.max(0, i) }); } rings[rings.length - 1].r *= 0.6; return rings; }
  for (let i = 0; i < N; i++) {
    const a = z[i], b = z[i + 1], Li = b - a; if (Li < 1e-5) continue; const ri = r(i); const rw = Math.min(0.25 * Li, 0.3 * ri);
    const bw = Math.min(0.3 * Li, useWax ? sp.waxW : sp.bandW); const hasBand = bw > 0;
    if (mode === 'ridge') {
      rings.push({ s: a + (i ? rw : 0), r: ri, col: body, i });
      if (hasBand && bw > rw) rings.push({ s: b - bw, r: ri, col: bandCol, i });
      rings.push({ s: b - rw, r: ri, col: mix(C.scar, hasBand ? bandCol : body, 0.5), i });
      if (i < N - 1) rings.push({ s: b, r: ri * (1 + sp.ridge), col: mix(C.scar, body, 0.35), i: i + 1, node: true });
    } else {                                                                              // 'band'
      const banded = Li >= bandMin && hasBand;
      if (!rings.length || banded) rings.push({ s: a, r: ri, col: body, i });
      if (banded) rings.push({ s: b - bw, r: ri, col: bandCol, i });
    }
  }
  rings.push({ s: last, r: r(N - 1) * 0.6, col: body, i: N - 1 });
  return rings;
}
/** Rings → quads round the spine: { corners, c, uv (u round, v = node coordinate), n (outward) }. */
export function culmQuads(c, rings, { sides = 14, sulcus = true } = {}) {
  const { sp } = c; const quads = []; let prev = null;
  const sulAz = (i) => { const k = i; const b = c.plan && c.plan.find((p) => p.k === k); return b && sp.sulcus > 0 && sulcus ? b.bud : null; };
  const vOf = (s, i) => { const Li = c.z[i + 1] - c.z[i]; return i + (Li > 1e-6 ? Math.max(0, Math.min(1, (s - c.z[i]) / Li)) : 0); };
  for (const rg of rings) {
    const F = frameAt(c, rg.s); const sa = sulAz(rg.i); const v = vOf(rg.s, Math.min(c.N - 1, rg.i));
    const ring = [...Array(sides + 1)].map((_, j) => { const a = (2 * Math.PI * j) / sides; let rr = rg.r;
      if (sa !== null && !rg.node) { let d = (a - sa) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; rr *= 1 - sp.sulcus * dmath.exp(-((d / 0.42) ** 2)); }
      return add(F.c, add(mul(F.N, rr * dmath.cos(a)), mul(F.B, rr * dmath.sin(a)))); });
    if (prev) for (let j = 0; j < sides; j++) {
      const q = [prev.ring[j], prev.ring[j + 1], ring[j + 1], ring[j]]; const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
      const n = unit(sub(mid, lerp(prev.c, F.c, 0.5)));
      quads.push({ corners: q, c: prev.col, n, uv: [[j / sides, prev.v], [(j + 1) / sides, prev.v], [(j + 1) / sides, v], [j / sides, v]] });
    }
    prev = { ring, c: F.c, col: rg.col, v };
  }
  return quads;
}
const quadsToTris = (qs, kind = 'culm') => { const t = []; for (const q of qs) { t.push({ p: [q.corners[0], q.corners[1], q.corners[2]], c: q.c, kind }, { p: [q.corners[0], q.corners[2], q.corners[3]], c: q.c, kind }); } return t; };
export function culmTris(c, { mode = 'ridge', sides = 14, bandMin = 0, segs = 10, color = null, sulcus = true, wax = false } = {}) {
  return quadsToTris(culmQuads(c, culmRings(c, { mode, bandMin, segs, color, wax }), { sides, sulcus: sulcus && mode === 'ridge' }));
}
function tube(pts, r0, r1, sides, col, kind) {
  const n = pts.length; const T = pts.map((_, i) => unit(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]))); let Nv = perp(T[0]); const tris = []; let prev = null;
  for (let i = 0; i < n; i++) { Nv = unit(sub(Nv, mul(T[i], dot(Nv, T[i])))); const B = cross(T[i], Nv); const r = r0 + (r1 - r0) * (i / (n - 1));
    const ring = [...Array(sides)].map((_, j) => { const a = (2 * Math.PI * j) / sides; return add(pts[i], add(mul(Nv, r * dmath.cos(a)), mul(B, r * dmath.sin(a)))); });
    if (prev) for (let j = 0; j < sides; j++) { const j2 = (j + 1) % sides; tris.push({ p: [prev[j], prev[j2], ring[j2]], c: col, kind }, { p: [prev[j], ring[j2], ring[j]], c: col, kind }); }
    prev = ring; }
  return tris;
}
function leafTri(L, tris) {
  let side = cross(L.dir, UP); side = len(side) < 1e-3 ? perp(L.dir) : unit(side);
  const m = add(L.base, mul(L.dir, 0.32 * L.len)); const tip = add(add(L.base, mul(L.dir, L.len)), [0, 0, -0.12 * L.len]);
  const a = add(m, mul(side, L.w / 2)), b = add(m, mul(side, -L.w / 2));
  tris.push({ p: [L.base, a, tip], c: L.col, kind: 'leaf' }, { p: [L.base, tip, b], c: L.col, kind: 'leaf' });
}
/** Coverage-preserving foliage blobs (the tree ladder's Beer–Lambert rule) from the leaves, clustered on a grid of `cell`. */
function foliageBlobs(c, cell, { tint = null } = {}) {
  const { sp } = c; const cells = new Map(); const A = 0.66 * sp.leafLen * sp.leafW;
  const pts = c.leaves ? c.leaves.map((l) => add(l.base, mul(l.dir, l.len / 2))) : [];
  if (c.blades) for (const b of c.blades) pts.push(b.pts[Math.floor(b.pts.length / 2)]);
  for (const p of pts) { const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`; if (!cells.has(k)) cells.set(k, { s: [0, 0, 0], ss: [0, 0, 0], w: 0 }); const g = cells.get(k); for (let i = 0; i < 3; i++) { g.s[i] += p[i]; g.ss[i] += p[i] * p[i]; } g.w++; }
  const tris = [];
  for (const g of [...cells.values()].sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.s[2] - b.s[2])) {
    const m = g.s.map((x) => x / g.w); const sd = g.ss.map((x, i) => Math.sqrt(Math.max(0, x / g.w - m[i] * m[i])));
    const ext = sd.map((x) => Math.max(0.6 * sp.leafLen, 1.6 * x + 0.5 * sp.leafLen)); const lai = (g.w * A) / (Math.PI * ext[0] * ext[1] + 1e-9); const cover = 1 - dmath.exp(-0.5 * lai);
    ext[2] = Math.max(ext[2], 0.5 * Math.max(ext[0], ext[1])); const r = ext.map((x) => Math.max(0.5 * sp.leafLen, x * dmath.pow(cover, 0.35)));
    for (const t of blobTris(m, r, tint || mix(sp.colors.leaf, [60, 84, 40], 0.25 * (1 - cover)))) tris.push(t);
  }
  return tris;
}
/**
 * Foliage by level: 'leaves' (L3: branches and twigs as tubes, every leaf), 'fans' (L2: branches as 3-sided tubes, a
 * card per twig's spray), 'sprays' (L1: a card per branch, its width shrunk by Beer–Lambert coverage, rolled and
 * drooped per card), 'blobs0' (L0: coverage-preserving clusters of cell H/2.5); 'blobs' (cell H/7) kept for comparison.
 */
export function foliageTris(c, { mode = 'leaves' } = {}) {
  const { sp } = c; const tris = []; if (!c.leaves && !c.blades) return tris;
  if (mode === 'sprays') {                                                                  // L1: one card per branch
    for (const b of c.branches || []) {
      const lv = (c.twigs || []).filter((tw) => tw.branch === b); const n = lv.reduce((s, tw) => s + tw.last - tw.first, 0); if (!n) continue;
      const a = polyAt(b.pts, 0.18), e = b.pts[b.pts.length - 1]; const d = unit(sub(e, a)); let side = cross(d, UP); side = len(side) < 1e-3 ? perp(d) : unit(side);
      const Lc = len(sub(e, a)) + sp.leafLen, Wc = 2 * sp.twigLen * 0.8 + sp.leafLen;                    // the spray's extent
      const cover = 1 - dmath.exp((-0.5 * n * 0.66 * sp.leafLen * sp.leafW) / (0.5 * Lc * Wc));          // Beer–Lambert over the card
      const hsh = dmath.sin(b.k * 12.9898 + b.az * 78.233) * 43758.5453; const u1 = hsh - Math.floor(hsh), u2 = (hsh * 7.13) - Math.floor(hsh * 7.13);
      side = rot(side, d, (u1 - 0.5) * 1.3);                                                     // each card rolls on its own axis
      const w = 0.5 * Wc * dmath.pow(cover, 0.5) * (0.8 + 0.4 * u2); const drop = [0, 0, -(0.15 + 0.35 * u2) * sp.twigLen];
      const m = add(lerp(a, e, 0.5), drop), tip = add(add(e, mul(d, sp.leafLen)), drop); const col = mix(mix(sp.colors.leaf, [60, 84, 40], 0.3 * (1 - cover)), sp.colors.leafDry, 0.15 * u1);
      tris.push({ p: [a, add(m, mul(side, w)), tip], c: col, kind: 'leaf' }, { p: [a, tip, add(m, mul(side, -w))], c: col, kind: 'leaf' });
    }
    for (const b of c.blades || []) bladeTris(b, tris, 4); if (c.plume) plumeTris(c, tris, 3); return tris;
  }
  if (mode === 'blobs' || mode === 'blobs0') { for (const t of foliageBlobs(c, c.height / (mode === 'blobs' ? 7 : 2.5))) tris.push(t); if (c.plume && mode === 'blobs') plumeTris(c, tris, 3); return tris; }
  for (const b of c.branches || []) for (const t of tube(mode === 'leaves' ? b.pts : b.pts.filter((_, i) => i % 3 === 0 || i === b.pts.length - 1), b.r0, b.r0 * 0.3, mode === 'leaves' ? 4 : 3, sp.colors.branch, 'branch')) tris.push(t);
  if (mode === 'leaves') {
    for (const tw of c.twigs || []) { const d = unit(sub(tw.b, tw.a)); let s = cross(d, UP); s = len(s) < 1e-3 ? perp(d) : unit(s); const w = 0.0015; tris.push({ p: [add(tw.a, mul(s, w)), add(tw.a, mul(s, -w)), tw.b], c: sp.colors.branch, kind: 'branch' }); }
    for (const l of c.leaves || []) leafTri(l, tris);
  } else {                                                                                 // 'fans': one spray card per twig
    for (const tw of c.twigs || []) {
      const g = (c.leaves || []).slice(tw.first, tw.last); if (!g.length) continue; const d = unit(sub(tw.b, tw.a)); const ln = g.reduce((s, l) => s + l.len, 0) / g.length;
      let side = cross(d, UP); side = len(side) < 1e-3 ? perp(d) : unit(side); const drop = [0, 0, -0.35 * ln];
      const a = add(tw.a, mul(d, 0.1 * len(sub(tw.b, tw.a)))), b = add(add(tw.b, mul(d, 0.7 * ln)), drop); const w = 0.75 * ln;
      const m = add(lerp(a, b, 0.55), drop); tris.push({ p: [a, add(m, mul(side, w)), b], c: g[0].col, kind: 'leaf' }, { p: [a, b, add(m, mul(side, -w))], c: g[g.length - 1].col, kind: 'leaf' });
    }
  }
  for (const b of c.blades || []) bladeTris(b, tris, mode === 'leaves' ? 1 : 2);
  if (c.plume) plumeTris(c, tris, mode === 'leaves' ? 16 : 6);
  return tris;
}
function bladeTris(b, tris, step) {
  const pts = b.pts.filter((_, i) => i % step === 0 || i === b.pts.length - 1);
  for (let i = 0; i < pts.length - 1; i++) { const d = unit(sub(pts[i + 1], pts[i])); let s = cross(d, UP); s = len(s) < 1e-3 ? perp(d) : unit(s); const w0 = b.w * (1 - (0.85 * i) / (pts.length - 1)), w1 = b.w * (1 - (0.85 * (i + 1)) / (pts.length - 1));
    tris.push({ p: [add(pts[i], mul(s, w0 / 2)), add(pts[i], mul(s, -w0 / 2)), add(pts[i + 1], mul(s, -w1 / 2))], c: b.col, kind: 'leaf' }, { p: [add(pts[i], mul(s, w0 / 2)), add(pts[i + 1], mul(s, -w1 / 2)), add(pts[i + 1], mul(s, w1 / 2))], c: b.col, kind: 'leaf' }); }
}
function plumeTris(c, tris, n) {
  // a panicle: n drooping strands from the culm tip, each a thin sliver
  const { at, dir, len: Lp } = c.plume; const col = c.sp.colors.plume; const U = perp(dir), V = cross(dir, U);
  for (let q = 0; q < n; q++) { const a = (2 * Math.PI * q) / n; const out = add(mul(U, dmath.cos(a)), mul(V, dmath.sin(a))); const base = add(at, mul(dir, -0.25 * Lp * (q % 3) / 2));
    const tip = add(add(base, mul(dir, 0.55 * Lp)), add(mul(out, 0.22 * Lp), [0, 0, -0.35 * Lp])); const mid = add(add(base, mul(dir, 0.45 * Lp)), mul(out, 0.12 * Lp));
    tris.push({ p: [base, add(mid, mul(out, 0.03)), tip], c: col, kind: 'leaf' }, { p: [base, tip, add(mid, mul(out, -0.03))], c: col, kind: 'leaf' }); }
}
/** Culm sheaths on a shoot still elongating: a sleeve per node up to sheathLen, closing to a spear, spotted. */
export function sheathTris(c, { sides = 10 } = {}) {
  const { sp, z, N, days } = c; if (days === Infinity) return []; const tris = []; const rng = mulberry32(c.seed * 31 + 7); const { dt, w } = sp.wave;
  for (let i = 0; i < N; i++) {
    const done = i * dt + w; if (days > done + sp.sheathHold) continue;                  // this sheath has fallen
    const s0 = z[i], sl = Math.max(sp.sheathLen * dmath.pow(c.size, sp.hExp) * (1 - 0.5 * (i / N)), 1.08 * c.Lfull[i]); const s1 = Math.min(z[N] + 0.25 * sl, s0 + sl);   // a sheath wraps its whole internode
    // it hugs the culm (just outside it), and past the shoot's tip the nested sheaths close to a spear
    const past = s0 + sl > z[N]; const r0 = (c.D[i] / 2) * 1.07, r1 = past ? Math.max(0.003, r0 * 0.25 * (1 - Math.min(1, (s0 + sl - z[N]) / sl)) + 0.003) : r0 * 0.99;
    const pts = [0, 0.5, 1].map((u) => frameAt(c, Math.min(z[N], s0 + u * (s1 - s0)))); const top = Math.min(1, (z[N] - s0) / (s1 - s0));
    let prev = null;
    for (let q = 0; q < 3; q++) { const F = pts[q]; const u = q / 2; const rr = r0 + (r1 - r0) * u; const cc = q === 2 && top < 1 ? add(F.c, mul(F.T, (s1 - z[N]) * 0.9)) : F.c;
      const ring = [...Array(sides + 1)].map((_, j) => { const a = (2 * Math.PI * j) / sides; return add(cc, add(mul(F.N, rr * dmath.cos(a)), mul(F.B, rr * dmath.sin(a)))); });
      if (prev) for (let j = 0; j < sides; j++) { const col = rng() < 0.3 ? sp.colors.spot : mix(sp.colors.sheath, sp.colors.spot, 0.25 * rng()); tris.push({ p: [prev[j], prev[j + 1], ring[j + 1]], c: col, kind: 'sheath' }, { p: [prev[j], ring[j + 1], ring[j]], c: col, kind: 'sheath' }); }
      prev = ring; }
  }
  return tris;
}
/** The ladder, culm and foliage apart (each picks its level by its own ruler: the culm's diameter, the leaf's length). */
export function culmLadder(c, { bandPx = 3, l2MinDpx = 4, wax = false } = {}) {
  // L2 is used while the culm is at least l2MinDpx wide, so an internode of length L spans L·(l2MinDpx/D0) px there:
  // a band is drawn only where that is ≥ bandPx.
  const bandMin = (bandPx * c.D[0]) / l2MinDpx;
  const culm = { L3: culmTris(c, { mode: 'ridge', sides: 14, wax }), L2: culmTris(c, { mode: 'band', sides: 7, bandMin, wax }), L1: culmTris(c, { mode: 'plain', sides: 5, segs: 10, wax }), L0: culmTris(c, { mode: 'plain', sides: 3, segs: 5, wax }) };
  const foliage = { L3: foliageTris(c, { mode: 'leaves' }), L2: foliageTris(c, { mode: 'fans' }), L1: foliageTris(c, { mode: 'sprays' }), L0: foliageTris(c, { mode: 'blobs0' }) };
  const rings = { L3: culmRings(c, { mode: 'ridge', wax }).length, L2: culmRings(c, { mode: 'band', bandMin, wax }).length, L1: 11, L0: 6 };
  return { culm, foliage, rings, bandMin };
}

// ── groves ─────────────────────────────────────────────────────────────────────────────────────────────────
class Hash { constructor(cell) { this.cell = cell; this.m = new Map(); } key(x, y) { return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`; }
  add(p) { const k = this.key(p.pos[0], p.pos[1]); (this.m.get(k) || this.m.set(k, []).get(k)).push(p); }
  near(x, y, r, alive) { const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell); const R = Math.ceil(r / this.cell); for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { const l = this.m.get(`${cx + i},${cy + j}`); if (l) for (const p of l) if (alive(p) && dmath.hypot(p.pos[0] - x, p.pos[1] - y) < r) return true; } return false; } }
/**
 * A running (leptomorph) grove: rhizome tips wander `ext` m a year (Moso 1.27 ± 0.90, Kawai et al. 2008) and branch; buds every `bud` m send up a culm with
 * probability `pEmerge` a year while the bud is younger than `budLife` and no living culm stands within `rMin`. A
 * culm's size rises with the grove's age (establishment, done clonally) and is smaller at the frontier; it lives `life`.
 */
export function runningGrove({ W = 100, D = 70, years = 24, seed = 3, founders = 24, ext = 1.3, bud = 0.4, rMin = 1.5, pEmerge = 0.15, budLife = 8, life = 10, tau = 3.5, branchP = 0.35 } = {}) {
  const rng = mulberry32(seed); const tips = []; const sites = []; const culms = []; const rhizomes = []; const H = new Hash(rMin * 1.35);
  for (let f = 0; f < founders; f++) tips.push({ pos: [W * ((f % 4) + 0.2 + 0.6 * rng()) / 4, D * (Math.floor(f / 4) % 3 + 0.2 + 0.6 * rng()) / 3], dir: rng() * 2 * Math.PI });
  for (let y = 1; y <= years; y++) {
    const alive = (p) => y - p.born < p.life;
    for (const t of [...tips]) {
      if (t.dead) continue; const steps = Math.round(ext / bud);
      for (let s = 0; s < steps; s++) { t.dir += (rng() - 0.5) * 0.5; const np = [t.pos[0] + bud * dmath.cos(t.dir), t.pos[1] + bud * dmath.sin(t.dir)];
        rhizomes.push([t.pos, np, y]); t.pos = np; sites.push({ pos: np, born: y });
        if (np[0] < -5 || np[0] > W + 5 || np[1] < -5 || np[1] > D + 5) { t.dead = true; break; } }
      if (!t.dead && rng() < branchP) tips.push({ pos: [...t.pos], dir: t.dir + (rng() < 0.5 ? -1 : 1) * (0.6 + 0.5 * rng()) });
    }
    for (const s of sites) {
      if (y - s.born >= budLife || y === s.born && rng() < 0.5 || rng() >= pEmerge) continue;
      const pos = [s.pos[0] + (rng() - 0.5) * 0.3, s.pos[1] + (rng() - 0.5) * 0.3]; if (H.near(pos[0], pos[1], rMin * (0.45 + 0.9 * rng()), alive)) continue;   // each shoot's own room
      const size = (0.42 + 0.58 * (1 - dmath.exp(-y / tau))) * (1 - 0.3 * dmath.exp(-(y - s.born) / 1.5)) * (0.88 + 0.24 * rng());
      const c = { pos, born: y, size, life: life * (0.8 + 0.4 * rng()) }; culms.push(c); H.add(c);
    }
  }
  const living = culms.filter((c) => years - c.born < c.life && c.pos[0] >= 0 && c.pos[0] <= W && c.pos[1] >= 0 && c.pos[1] <= D).map((c) => ({ ...c, age: years - c.born }));
  return { kind: 'running', W, D, years, culms: living, rhizomes, all: culms.length };
}
/**
 * A clumping (pachymorph) grove: each clump begins as one culm; every culm sends up about `perCulm` new culms the next
 * year on short necks, outward from the clump's centre, while the clump holds fewer than `cap` living culms (B. vulgaris:
 * 50–90 culms, ~7 m across after 10 years, PROSEA). Culms lean
 * out by how far out they stand, and live `life` years.
 */
export function clumpGrove({ W = 100, D = 70, clumps = 14, years = 14, seed = 5, neck = 0.36, perCulm = 2.4, cap = 80, life = 12, tau = 3, minGap = 9 } = {}) {
  const rng = mulberry32(seed); const centres = [];
  for (let t = 0; centres.length < clumps && t < 5000; t++) { const p = [W * (0.08 + 0.84 * rng()), D * (0.08 + 0.84 * rng())]; if (centres.every((c) => dmath.hypot(c[0] - p[0], c[1] - p[1]) > minGap)) centres.push(p); }
  const culms = []; const H = new Hash(0.3);
  centres.forEach((ctr, ci) => {
    const y0 = Math.floor(rng() * 4); const mine = [{ pos: [...ctr], born: y0, size: 0.4, life: life, clump: ci }]; culms.push(mine[0]); H.add(mine[0]);
    for (let y = y0 + 1; y <= years; y++) {
      const alive = (p) => y - p.born < p.life; const living = mine.filter(alive).length; if (living >= cap) continue;
      // every culm up to two years old sends up shoots on short necks (Poisson, mean perCulm/2 a year)
      for (const p of mine.filter((q) => y - q.born >= 1 && y - q.born <= 2)) {
        let n = 0; for (let e = dmath.exp(-perCulm / 2), pr = rng(); pr > e; pr *= rng()) n++;
        for (let k = 0; k < n; k++) {
          const out = dmath.hypot(p.pos[0] - ctr[0], p.pos[1] - ctr[1]) > 0.05 ? dmath.atan2(p.pos[1] - ctr[1], p.pos[0] - ctr[0]) : rng() * 2 * Math.PI;
          const a = out + (rng() - 0.5) * 3.2; const pos = [p.pos[0] + neck * (0.7 + 0.6 * rng()) * dmath.cos(a), p.pos[1] + neck * (0.7 + 0.6 * rng()) * dmath.sin(a)];
          if (H.near(pos[0], pos[1], 0.16, alive)) continue;
          const size = (0.4 + 0.6 * (1 - dmath.exp(-(y - y0) / tau))) * (0.88 + 0.24 * rng());
          const c = { pos, born: y, size, life: life * (0.8 + 0.4 * rng()), clump: ci }; mine.push(c); culms.push(c); H.add(c);
        }
      }
    }
  });
  const living = culms.filter((c) => years - c.born < c.life).map((c) => ({ ...c, age: years - c.born }));
  // the outward lean: by how far out a culm stands in its clump
  const R = centres.map((ctr, ci) => Math.max(0.3, ...living.filter((c) => c.clump === ci).map((c) => dmath.hypot(c.pos[0] - ctr[0], c.pos[1] - ctr[1]))));
  for (const c of living) { const ctr = centres[c.clump]; const d = dmath.hypot(c.pos[0] - ctr[0], c.pos[1] - ctr[1]); c.lean = 3 + 24 * dmath.pow(Math.min(1, d / R[c.clump]), 1.2); c.az = d > 0.05 ? dmath.atan2(c.pos[1] - ctr[1], c.pos[0] - ctr[0]) / DEG : 0; }
  return { kind: 'clumping', W, D, years, culms: living, centres, all: culms.length };
}
/** Clark–Evans R: mean nearest-neighbour distance over its expectation for a Poisson pattern of the same density. */
export function clarkEvans(culms, { W, D, margin = 5 }) {
  const inner = culms.filter((c) => c.pos[0] > margin && c.pos[0] < W - margin && c.pos[1] > margin && c.pos[1] < D - margin);
  const H = new Map(); const cell = 2; for (const c of culms) { const k = `${Math.floor(c.pos[0] / cell)},${Math.floor(c.pos[1] / cell)}`; (H.get(k) || H.set(k, []).get(k)).push(c); }
  let sum = 0; for (const c of inner) { let best = Infinity; const cx = Math.floor(c.pos[0] / cell), cy = Math.floor(c.pos[1] / cell);
    for (let R = 1; R < 30 && (best === Infinity || best > (R - 1) * cell); R++) { best = Infinity; for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const q of H.get(`${cx + i},${cy + j}`) || []) if (q !== c) best = Math.min(best, dmath.hypot(q.pos[0] - c.pos[0], q.pos[1] - c.pos[1])); }
    sum += best; }
  const dens = inner.length / ((W - 2 * margin) * (D - 2 * margin)); const obs = sum / inner.length;
  return { R: +(obs / (0.5 / Math.sqrt(dens))).toFixed(2), perHa: Math.round(dens * 1e4), meanNN: +obs.toFixed(2), n: inner.length };
}
/** The bamboo wall in section: vascular bundles denser toward the outer wall (the graded fibre fraction). */
export function wallAt(specIn, D, t, x, y) {
  const sp = specOf(specIn); const R = D / 2, ri = R - t; const r = dmath.hypot(x, y); if (r > R || r < ri) return null; const u = (r - ri) / t;
  const vf = 0.15 + 0.5 * dmath.pow(u, sp.E.p); const cell = 0.0016 / Math.sqrt(vf / 0.3); const gx = Math.floor(x / cell), gy = Math.floor(y / cell); let near = Infinity;
  const hh = (i, j, s) => { let hsh = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177); return ((hsh ^ (hsh >>> 16)) >>> 0) / 4294967296; };
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const cx = (gx + dx + 0.2 + 0.6 * hh(gx + dx, gy + dy, 1)) * cell, cy = (gy + dy + 0.2 + 0.6 * hh(gx + dx, gy + dy, 2)) * cell; near = Math.min(near, dmath.hypot(x - cx, y - cy)); }
  const rb = cell * Math.sqrt(vf / Math.PI) * 0.95; if (u > 0.97) return [96, 130, 62];                       // the epidermis
  return near < rb ? mix([150, 120, 70], [70, 52, 30], Math.min(1, u * 1.3)) : mix([232, 222, 186], [214, 200, 156], u);
}
