/**
 * The hydrogen atom's orbitals, exactly: ψ_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ), with the radial function from the
 * associated Laguerre polynomials and the REAL spherical harmonics (the p_x, d_xy … shapes a chemistry book draws:
 * m > 0 the cos(mφ) combination, m < 0 the sin(|m|φ) one). Lengths in Bohr radii.
 *
 * A cloud is drawn by sampling: r from the radial distribution r²R² (its cumulative table inverted), the angles by
 * rejection against |Y|². Each point is one sampled position, so the cloud's density IS |ψ|²; the gates check that.
 * Seeded (mulberry32). Pure.
 */

export const MAX_N = 7;

const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };

/** The generalized Laguerre polynomial L_k^α(x) by its three-term recursion. */
export function laguerre(k, alpha, x) {
  if (k === 0) return 1;
  let a = 1, b = 1 + alpha - x;
  for (let j = 1; j < k; j++) { const c = ((2 * j + 1 + alpha - x) * b - (j + alpha) * a) / (j + 1); a = b; b = c; }
  return b;
}

/** R_nl(r), r in Bohr radii, normalized so ∫ r² R² dr = 1. */
export function radial(n, l, r) {
  const rho = (2 * r) / n;
  const norm = Math.sqrt((2 / n) ** 3 * fact(n - l - 1) / (2 * n * fact(n + l)));
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** The associated Legendre function P_l^m(x) for m ≥ 0 (Condon–Shortley phase), by recursion. */
function legendre(l, m, x) {
  let pmm = 1;
  if (m > 0) { const s = Math.sqrt((1 - x) * (1 + x)); let f = 1; for (let i = 1; i <= m; i++) { pmm *= -f * s; f += 2; } }
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pl = 0;
  for (let ll = m + 2; ll <= l; ll++) { pl = (x * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m); pmm = pm1; pm1 = pl; }
  return pl;
}

/** The real spherical harmonic Y_lm(θ, φ). */
export function realY(l, m, theta, phi) {
  const am = Math.abs(m);
  const K = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am)));
  const P = legendre(l, am, Math.cos(theta));
  if (m === 0) return K * P;
  return Math.SQRT2 * K * P * (m > 0 ? Math.cos(am * phi) : Math.sin(am * phi));
}

const NAMES = { 0: 's', 1: 'p', 2: 'd', 3: 'f', 4: 'g', 5: 'h', 6: 'i' };
const REAL = { '1,0': 'z', '1,1': 'x', '1,-1': 'y', '2,0': 'z²', '2,1': 'xz', '2,-1': 'yz', '2,2': 'x²−y²', '2,-2': 'xy' };
/** A chemist's name for an orbital: 1s, 2p_x, 3d_xy, 4f (m = 2) … */
export function orbitalName(n, l, m) {
  const tail = REAL[`${l},${m}`];
  return `${n}${NAMES[l]}${tail ? `_${tail}` : l > 0 ? ` (m = ${m})` : ''}`;
}

/** How far out the cloud is worth sampling: past where the radial distribution's tail holds a millionth. */
export const reach = (n) => 2 * n * n + 12 * n + 10;

/** The radial distribution's cumulative table on [0, reach(n)], for inverse sampling and the χ² bins. */
export function radialTable(n, l, steps = 4000) {
  const rmax = reach(n), dr = rmax / steps, r = new Float64Array(steps + 1), cdf = new Float64Array(steps + 1);
  let acc = 0, prev = 0;
  for (let i = 0; i <= steps; i++) {
    r[i] = i * dr;
    const R = radial(n, l, r[i]), p = r[i] * r[i] * R * R;
    if (i > 0) acc += 0.5 * (p + prev) * dr;
    cdf[i] = acc; prev = p;
  }
  return { r, cdf, total: acc };
}

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

/** `count` points sampled from |ψ_nlm|², each with the wavefunction's sign there. Positions in Bohr radii. */
export function sampleCloud(n, l, m, count, seed) {
  const rand = mulberry32(seed);
  const T = radialTable(n, l);
  // the angular bound for rejection: |Y|² sinθ never exceeds its largest value on a fine grid (with a margin)
  let ymax = 0;
  for (let i = 0; i <= 90; i++) for (let k = 0; k <= 90; k++) {
    const th = (Math.PI * i) / 90, ph = (2 * Math.PI * k) / 90, y = realY(l, m, th, ph);
    ymax = Math.max(ymax, y * y * Math.sin(th));
  }
  ymax *= 1.15;
  const pts = [], signs = [], radii = [];
  for (let s = 0; s < count; s++) {
    // r from the radial cumulative table
    const u = rand() * T.total;
    let lo = 0, hi = T.cdf.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T.cdf[mid] < u) lo = mid; else hi = mid; }
    const f = T.cdf[hi] > T.cdf[lo] ? (u - T.cdf[lo]) / (T.cdf[hi] - T.cdf[lo]) : 0;
    const r = T.r[lo] + f * (T.r[hi] - T.r[lo]);
    // the angles by rejection against |Y|² sinθ
    let th = 0, ph = 0;
    for (let tries = 0; tries < 10000; tries++) {
      th = Math.PI * rand(); ph = 2 * Math.PI * rand();
      const y = realY(l, m, th, ph);
      if (rand() * ymax <= y * y * Math.sin(th)) break;
    }
    const st = Math.sin(th);
    pts.push([r * st * Math.cos(ph), r * st * Math.sin(ph), r * Math.cos(th)]);
    signs.push(Math.sign(radial(n, l, r) * realY(l, m, th, ph)) || 1);
    radii.push(r);
  }
  return { points: pts, signs, radii, table: T };
}

/** The radial function's sign changes on a fine grid out to its reach: the radial node count. */
export function radialNodes(n, l) {
  const rmax = reach(n);
  let c = 0, prev = radial(n, l, 1e-6);
  for (let i = 1; i <= 20000; i++) {
    const v = radial(n, l, (rmax * i) / 20000);
    if (Math.abs(v) > 1e-12 && Math.abs(prev) > 1e-12 && Math.sign(v) !== Math.sign(prev)) c++;
    if (Math.abs(v) > 1e-12) prev = v;
  }
  return c;
}
