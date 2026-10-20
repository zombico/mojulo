/**
 * A particle on a plane: ψ(x, y, t) under iħ ∂ψ/∂t = −(ħ²/2m) ∇²ψ + V ψ on a square grid, stepped by split-step
 * Fourier (Strang: half the potential, the kinetic step exactly in k-space, half the potential). The grid's edge is
 * an absorbing rim, so what leaves is taken, not wrapped round. The potential is the plane's rows: today a wall with
 * slits (`slits`), `height` high where it stands. Its edges rise over two cells (a raised cosine centred on each
 * drawn edge): a wall sharp to the cell lets the wave through by the split step's own error, a thousand times more
 * than a smooth one, far more than it would tunnel. What the rim takes is counted as it is taken, so the probability
 * on the grid plus the probability taken is one to round-off.
 *
 * The far field is where the wave goes far away: the passed wave's transform, zero-padded 4× for a fine angular
 * grid, read along each direction θ over the packet's spread of wavenumbers. Detections are drawn from it one at a
 * time (seeded), as a screen far off would record them.
 *
 * Internal units: nanometres, femtoseconds and electronvolts (line.js's). x is the direction of travel, the wall
 * stands across it. Pure and deterministic.
 */

import { fft, fft2, wavenumber } from './fft.js';
import { HBAR_EVFS } from './line.js';

export const SHEET_FRAMES = 48;   // frames of |ψ|² the page plays
export const SHEET_RES = 64;      // their resolution (the grid averaged down)
export const READOUT = 120;       // readout samples over the run
export const BUDGET = 128 * 128 * 1500;   // grid-steps per solve: a world re-solves on every read

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The grid: n × n cells of side dx across [−L/2, L/2]², cell centres. */
export function planeGrid(L, n) {
  const dx = L / n, x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = -L / 2 + (j + 0.5) * dx;
  return { n, dx, x, L };
}

/** The slits' centres across the wall (y), in nm. */
export const slitCentres = (w) => Array.from({ length: w.count }, (_, k) => (k - (w.count - 1) / 2) * w.separation);

// a raised-cosine edge: 1 well inside (d ≤ −r), 0 well outside (d ≥ r), a half at the edge itself (d = 0)
const ramp = (d, r) => (d <= -r ? 1 : d >= r ? 0 : 0.5 * (1 - Math.sin((Math.PI * d) / (2 * r))));

/** How open the wall is across y (0 behind wall, 1 in a slit), its edges risen over `r`. */
export function openness(w, y, r) {
  let o = 0;
  for (const c of slitCentres(w)) o += ramp(Math.abs(y - c) - w.width / 2, r);
  return Math.min(1, o);
}

/** How much wall stands at (x, y), 0 to 1 (the potential is `height` times it), its edges risen over `r` (a cell). */
export const wallness = (w, x, y, r) => ramp(Math.abs(x - w.at) - w.thickness / 2, r) * (1 - openness(w, y, r));

/** Is (x, y) wall, as drawn? (at least half the wall's height stands there) */
export const inWall = (w, x, y, r) => wallness(w, x, y, r) >= 0.5;

/** The rows of the grid the wall leaves open, each with how open it is. */
export function openRows(w, g) {
  const out = [];
  for (let j = 0; j < g.n; j++) { const o = openness(w, g.x[j], g.dx); if (o > 0) out.push({ j, y: g.x[j], open: o }); }
  return out;
}

// the absorbing rim: a smooth ramp over `rim` cells at every edge, multiplied in after each step
function rimMask(n, rim) {
  const edge = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const d = Math.min(j, n - 1 - j);
    edge[j] = d >= rim ? 1 : 1 - 0.12 * ((rim - d) / rim) ** 3;
  }
  return edge;
}

/**
 * Run the plane. m = { L, n, hb2m, wall: { count, width, separation, thickness, at, height } | null,
 * packet: { at, sx, sy, energy }, duration, detections, seed }.
 */
export function runPlane(m) {
  const g = planeGrid(m.L, m.n), { n, dx } = g, N2 = n * n;
  const hb2m = m.hb2m, pk = m.packet;
  const k0 = Math.sqrt(pk.energy / hb2m), skx = 1 / (2 * pk.sx), sky = 1 / (2 * pk.sy);
  const kmax = Math.hypot(k0 + 4 * skx, 4 * sky);
  const Emax = Math.max(hb2m * kmax * kmax, 1e-6);
  // the step: a fifth of the fastest phase in the state, within the budget
  let steps = Math.max(READOUT, Math.ceil(m.duration / ((0.2 * HBAR_EVFS) / Emax)));
  const warnings = [];
  const cap = Math.floor(BUDGET / N2);
  if (steps > cap) { steps = cap; warnings.push(`the work budget (${BUDGET.toLocaleString('en-US')} grid-steps a solve) coarsened the step; a shorter run or a smaller grid keeps the phases accurate`); }
  const dt = m.duration / steps;

  // the potential and its half-step phase, the kinetic phase, the rim
  const V = new Float64Array(N2);
  if (m.wall) for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) V[iy * n + ix] = m.wall.height * wallness(m.wall, g.x[ix], g.x[iy], dx);
  const vr = new Float64Array(N2), vi = new Float64Array(N2);
  for (let i = 0; i < N2; i++) { const a = (-V[i] * dt) / (2 * HBAR_EVFS); vr[i] = Math.cos(a); vi[i] = Math.sin(a); }
  const kr = new Float64Array(N2), ki = new Float64Array(N2);
  for (let iy = 0; iy < n; iy++) {
    const ky = wavenumber(iy, n, dx);
    for (let ix = 0; ix < n; ix++) {
      const kx = wavenumber(ix, n, dx), a = (-hb2m * (kx * kx + ky * ky) * dt) / HBAR_EVFS;
      kr[iy * n + ix] = Math.cos(a); ki[iy * n + ix] = Math.sin(a);
    }
  }
  const rim = Math.max(4, Math.round(n / 16)), edge = rimMask(n, rim);
  const mask = new Float64Array(N2);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) mask[iy * n + ix] = edge[ix] * edge[iy];

  // the packet: a Gaussian moving +x at k0
  const re = new Float64Array(N2), im = new Float64Array(N2);
  let norm0 = 0;
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const x = g.x[ix], y = g.x[iy], a = Math.exp(-((x - pk.at) ** 2) / (4 * pk.sx * pk.sx) - (y * y) / (4 * pk.sy * pk.sy));
    re[iy * n + ix] = a * Math.cos(k0 * x); im[iy * n + ix] = a * Math.sin(k0 * x);
    norm0 += a * a;
  }
  norm0 = Math.sqrt(norm0 * dx * dx);
  for (let i = 0; i < N2; i++) { re[i] /= norm0; im[i] /= norm0; }

  const back = m.wall ? m.wall.at + m.wall.thickness / 2 + dx : -Infinity;   // past the wall's far ramp
  const past = (x) => x > back;
  // what is on the grid, past the wall, and taken (by the rim, past the wall or not)
  const tally = () => {
    let on = 0, beyond = 0, exit = 0;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix, p = (re[i] * re[i] + im[i] * im[i]) * dx * dx;
      on += p; if (past(g.x[ix])) { beyond += p; if (g.x[ix] <= back + 1) exit += p; }
    }
    return { on, beyond, exit };
  };
  let taken = 0, takenPast = 0;
  const series = { t: [], norm: [], taken: [], past: [], takenPast: [] };
  const frames = [], f = SHEET_RES, down = n / f;
  const sheetAt = new Set(Array.from({ length: SHEET_FRAMES }, (_, k) => Math.round((k * steps) / (SHEET_FRAMES - 1))));
  const readAt = new Map(Array.from({ length: READOUT + 1 }, (_, k) => [Math.round((k * steps) / READOUT), k]));
  let snap = null, snapPast = -1, snapStep = 0, snapExit = 0;
  const record = (step) => {
    if (sheetAt.has(step)) {
      const fr = new Float64Array(f * f);
      for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
        const i = iy * n + ix;
        fr[Math.floor(iy / down) * f + Math.floor(ix / down)] += (re[i] * re[i] + im[i] * im[i]) / (down * down);
      }
      frames.push(fr);
    }
    if (readAt.has(step)) {
      const s = tally();
      series.t.push(step * dt); series.norm.push(s.on); series.taken.push(taken); series.past.push(s.beyond); series.takenPast.push(takenPast);
      // the far field is read from the moment the most of the wave stands past the wall
      if (s.beyond > snapPast) { snapPast = s.beyond; snap = { re: re.slice(), im: im.slice() }; snapStep = step; snapExit = s.exit; }
    }
  };
  const half = () => { for (let i = 0; i < N2; i++) { const a = re[i], b = im[i]; re[i] = a * vr[i] - b * vi[i]; im[i] = a * vi[i] + b * vr[i]; } };
  record(0);
  for (let s = 1; s <= steps; s++) {
    half();
    fft2(re, im, n);
    for (let i = 0; i < N2; i++) { const a = re[i], b = im[i]; re[i] = a * kr[i] - b * ki[i]; im[i] = a * ki[i] + b * kr[i]; }
    fft2(re, im, n, true);
    half();
    // the rim takes its share, counted as it is taken
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix, mk = mask[i];
      if (mk === 1) continue;
      const p = (re[i] * re[i] + im[i] * im[i]) * (1 - mk * mk) * dx * dx;
      taken += p; if (past(g.x[ix])) takenPast += p;
      re[i] *= mk; im[i] *= mk;
    }
    record(s);
  }
  return { g, V, k0, skx, sky, kmax, dt, steps, rim, series, frames, snap, snapStep, snapExit, back, warnings, hb2m };
}

/**
 * The far field of the passed wave: P(θ) on `count` directions over ±maxDeg, from the snapshot's part past the wall
 * (from `from` on), its transform zero-padded `pad`×, integrated along each direction over k0 ± 4σk.
 */
export function farField(run, { from, count = 721, maxDeg = 85, pad = 4 } = {}) {
  const { g, snap, k0, skx } = run, n = g.n, P = pad * n, dx = g.dx;
  const re = new Float64Array(P * P), im = new Float64Array(P * P);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    if (!(g.x[ix] > from)) continue;
    re[iy * P + ix] = snap.re[iy * n + ix]; im[iy * P + ix] = snap.im[iy * n + ix];
  }
  fft2(re, im, P);
  const dk = (2 * Math.PI) / (P * dx);
  const power = (kx, ky) => {   // |Ψ|² at (kx, ky), bilinear on the padded grid (periodic)
    const fx = kx / dk, fy = ky / dk, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const at = (i, j) => { const a = ((i % P) + P) % P, b = ((j % P) + P) % P, q = b * P + a; return re[q] * re[q] + im[q] * im[q]; };
    return (1 - ax) * (1 - ay) * at(x0, y0) + ax * (1 - ay) * at(x0 + 1, y0) + (1 - ax) * ay * at(x0, y0 + 1) + ax * ay * at(x0 + 1, y0 + 1);
  };
  const theta = new Float64Array(count), p = new Float64Array(count);
  const K = 48, lo = Math.max(1e-6, k0 - 4 * skx), hi = k0 + 4 * skx, hk = (hi - lo) / K;
  for (let i = 0; i < count; i++) {
    const th = ((-maxDeg + (2 * maxDeg * i) / (count - 1)) * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    let acc = 0;
    for (let j = 0; j <= K; j++) {
      const k = lo + j * hk, w = j === 0 || j === K ? 0.5 : 1;
      acc += w * power(k * c, k * s) * k;
    }
    theta[i] = th; p[i] = acc * hk;
  }
  let tot = 0;
  for (let i = 1; i < count; i++) tot += 0.5 * (p[i] + p[i - 1]) * (theta[i] - theta[i - 1]);
  for (let i = 0; i < count; i++) p[i] /= tot;
  return { theta, p };
}

/**
 * The thin-screen pattern of the grid's own slits: each open row a point source with the packet's amplitude there,
 * weighted by how open the row is, summed with the far-field phase k·y·sin θ and averaged over the packet's
 * wavenumbers. The grid's slits, not the drawn ones: the grid samples their edges at its cells.
 */
export function thinScreen(run, wall, packet, theta) {
  const { g, k0, skx, hb2m } = run;
  const rows = openRows(wall, g);
  // the packet's breadth when it reaches the wall (it spreads as it travels)
  const v = (2 * hb2m * k0) / HBAR_EVFS, tA = Math.max(0, (wall.at - packet.at) / v);
  const sy = packet.sy * Math.sqrt(1 + ((hb2m * tA) / (HBAR_EVFS * packet.sy * packet.sy)) ** 2);
  const amp = rows.map((q) => q.open * Math.exp(-(q.y ** 2) / (4 * sy * sy)));
  const out = new Float64Array(theta.length);
  for (let i = 0; i < theta.length; i++) {
    const s = Math.sin(theta[i]);
    let acc = 0, wt = 0;
    for (let q = -12; q <= 12; q++) {
      const k = k0 + (q / 3) * skx, w = Math.exp(-((q / 3) ** 2) / 2);
      let ar = 0, ai = 0;
      rows.forEach((q, r) => { const ph = k * q.y * s; ar += amp[r] * Math.cos(ph); ai += amp[r] * Math.sin(ph); });
      acc += w * (ar * ar + ai * ai); wt += w;
    }
    out[i] = acc / wt;
  }
  return out;
}

// a refined extremum near i by the parabola through its neighbours, as sin θ
function refine(theta, p, i) {
  if (i <= 0 || i >= p.length - 1) return Math.sin(theta[i]);
  const a = p[i - 1], b = p[i], c = p[i + 1], d = a - 2 * b + c;
  const off = d === 0 ? 0 : (0.5 * (a - c)) / d;
  return Math.sin(theta[i] + off * (theta[i + 1] - theta[i]));
}

/** The bright fringes' positions (sin θ), central first outward, above `floor` of the brightest. */
export function fringePeaks(theta, p, { floor = 0.02 } = {}) {
  const top = Math.max(...p), out = [];
  for (let i = 1; i < p.length - 1; i++) if (p[i] > p[i - 1] && p[i] >= p[i + 1] && p[i] >= floor * top) out.push(refine(theta, p, i));
  return out.sort((a, b) => Math.abs(a) - Math.abs(b));
}

/** The first dark minimum either side of the centre (sin θ, the two sides averaged). */
export function firstZero(theta, p) {
  const mid = theta.reduce((b, t, i) => (Math.abs(t) < Math.abs(theta[b]) ? i : b), 0);
  let r = mid; while (r < p.length - 1 && !(p[r] < p[r - 1] && p[r] <= p[r + 1])) r++;
  let l = mid; while (l > 0 && !(p[l] < p[l + 1] && p[l] <= p[l - 1])) l--;
  return 0.5 * (Math.abs(refine(theta, p, r)) + Math.abs(refine(theta, p, l)));
}

/** The central band's half width at half its height (sin θ, the two sides averaged). */
export function halfWidth(theta, p) {
  const mid = theta.reduce((b, t, i) => (Math.abs(t) < Math.abs(theta[b]) ? i : b), 0), h = p[mid] / 2;
  const cross = (dir) => {
    let i = mid; while (i + dir > 0 && i + dir < p.length - 1 && p[i + dir] > h) i += dir;
    const a = p[i], b = p[i + dir], f = a === b ? 0 : (a - h) / (a - b);
    return Math.abs(Math.sin(theta[i] + f * (theta[i + dir] - theta[i])));
  };
  return 0.5 * (cross(1) + cross(-1));
}

/**
 * The mean spacing (sin θ) of the bright fringes within `within` of the centre. With three slits or more the weak
 * maxima between the bright ones (a ninth as bright, or less) are left out.
 */
export function fringeSpacing(theta, p, within, count = 2) {
  const peaks = fringePeaks(theta, p, { floor: count >= 3 ? 0.25 : 0.02 }).filter((s) => Math.abs(s) < within).sort((a, b) => a - b);
  if (peaks.length < 3) return null;
  return (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1);
}

/** `count` detections drawn one at a time from P(θ) (seeded): their angles. */
export function detections(theta, p, count, seed) {
  const rand = mulberry32(seed), cdf = new Float64Array(theta.length);
  for (let i = 1; i < theta.length; i++) cdf[i] = cdf[i - 1] + 0.5 * (p[i] + p[i - 1]) * (theta[i] - theta[i - 1]);
  const tot = cdf[cdf.length - 1], out = [];
  for (let k = 0; k < count; k++) {
    const u = rand() * tot;
    let lo = 0, hi = cdf.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const f = cdf[hi] > cdf[lo] ? (u - cdf[lo]) / (cdf[hi] - cdf[lo]) : 0;
    out.push(theta[lo] + f * (theta[hi] - theta[lo]));
  }
  return { angles: out, cdf, total: tot };
}

/**
 * The wall as the grid draws it, struck head on: a 1-D packet at the same energy, on the same spacing and step,
 * against the wall's cells and height, by the same split-step scheme. Returns the share that gets through.
 */
export function wallLeak({ dx, dt, steps, hb2m, wall, packet }) {
  const n = 512, L = n * dx, x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = -L / 2 + (j + 0.5) * dx;
  const k0 = Math.sqrt(packet.energy / hb2m);
  const re = new Float64Array(n), im = new Float64Array(n);
  const start = -Math.min(L / 4, 4 * packet.sx + wall.thickness);
  let nrm = 0;
  for (let j = 0; j < n; j++) { const a = Math.exp(-((x[j] - start) ** 2) / (4 * packet.sx * packet.sx)); re[j] = a * Math.cos(k0 * x[j]); im[j] = a * Math.sin(k0 * x[j]); nrm += a * a; }
  nrm = Math.sqrt(nrm * dx);
  for (let j = 0; j < n; j++) { re[j] /= nrm; im[j] /= nrm; }
  const W = (xx) => wall.height * ramp(Math.abs(xx) - wall.thickness / 2, dx);
  const vr = new Float64Array(n), vi = new Float64Array(n), kr = new Float64Array(n), ki = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const a = (-W(x[j]) * dt) / (2 * HBAR_EVFS); vr[j] = Math.cos(a); vi[j] = Math.sin(a);
    const k = wavenumber(j, n, dx), b = (-hb2m * k * k * dt) / HBAR_EVFS; kr[j] = Math.cos(b); ki[j] = Math.sin(b);
  }
  const edge = rimMask(n, 32);
  let through = 0;
  // long enough for the packet to reach and leave the wall, however the plane's run is timed
  const v = (2 * hb2m * k0) / HBAR_EVFS, need = Math.ceil(((-start + 4 * packet.sx) / v) / dt);
  for (let s = 0; s < Math.max(steps, need); s++) {
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * vr[j] - b * vi[j]; im[j] = a * vi[j] + b * vr[j]; }
    fft(re, im, n);
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * kr[j] - b * ki[j]; im[j] = a * ki[j] + b * kr[j]; }
    fft(re, im, n, { inverse: true });
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * vr[j] - b * vi[j]; im[j] = a * vi[j] + b * vr[j]; }
    for (let j = 0; j < n; j++) {
      const mk = edge[j];
      if (mk === 1) continue;
      if (x[j] > wall.thickness / 2 + dx) through += (re[j] * re[j] + im[j] * im[j]) * (1 - mk * mk) * dx;
      re[j] *= mk; im[j] *= mk;
    }
  }
  for (let j = 0; j < n; j++) if (x[j] > wall.thickness / 2 + dx) through += (re[j] * re[j] + im[j] * im[j]) * dx;
  return through;
}
