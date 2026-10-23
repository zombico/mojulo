/**
 * A particle on a line: ψ(x, t) under iħ ∂ψ/∂t = −(ħ²/2m) ∂²ψ/∂x² + V(x) ψ, on a grid with hard walls at the line's
 * ends, stepped by Crank–Nicolson (exactly unitary: the norm and the energy of the discrete system hold to round-off).
 * Eigenstates of the same discrete Hamiltonian come from Sturm-sequence bisection and inverse iteration.
 *
 * Internal units: nanometres, femtoseconds and electronvolts (ħ = 0.6582 eV·fs), so the numbers stay near one.
 * Pure and deterministic.
 */

export const HBAR_EVFS = 0.6582119569;        // eV·fs
export const HB2M_E = 0.0380998212;           // ħ²/2mₑ in eV·nm²

/** The grid: n points strictly inside [−L/2, L/2] (the ends are walls). */
export function grid(L, n) {
  const dx = L / (n + 1);
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = -L / 2 + (j + 1) * dx;
  return { x, dx, n };
}

/** The Hamiltonian's tridiagonal: diagonal d (eV) and the one off-diagonal value e (eV). */
export function hamiltonian(g, V, hb2m) {
  const k = hb2m / (g.dx * g.dx);
  const d = new Float64Array(g.n);
  for (let j = 0; j < g.n; j++) d[j] = 2 * k + V[j];
  return { d, e: -k };
}

// eigenvalues below λ of the symmetric tridiagonal (d, e): the Sturm sequence's sign changes
function countBelow(H, lam) {
  let q = H.d[0] - lam, c = q < 0 ? 1 : 0;
  const e2 = H.e * H.e;
  for (let j = 1; j < H.d.length; j++) {
    q = H.d[j] - lam - e2 / (q === 0 ? 1e-300 : q);
    if (q < 0) c++;
  }
  return c;
}

/** The k lowest eigenpairs (k ≥ 1), eigenvalues ascending, eigenvectors normalized on the grid (Σ|v|²dx = 1). */
export function eigen(H, g, k) {
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < H.d.length; j++) { lo = Math.min(lo, H.d[j] - 2 * Math.abs(H.e)); hi = Math.max(hi, H.d[j] + 2 * Math.abs(H.e)); }
  const out = [];
  for (let i = 0; i < k; i++) {
    let a = lo, b = hi;
    for (let it = 0; it < 200 && b - a > 1e-13 * Math.max(1, Math.abs(a) + Math.abs(b)); it++) {
      const m = 0.5 * (a + b);
      if (countBelow(H, m) > i) b = m; else a = m;
    }
    const lam = 0.5 * (a + b);
    out.push({ E: lam, v: inverseIteration(H, g, lam) });
  }
  return out;
}

function inverseIteration(H, g, lam) {
  const n = H.d.length, shift = lam + 1e-10 * Math.max(1, Math.abs(lam));
  let v = new Float64Array(n);
  for (let j = 0; j < n; j++) v[j] = 1 + 0.5 * Math.sin(j * 1.2345);   // a deterministic, generic start
  for (let it = 0; it < 4; it++) {
    // solve (H − shift)·w = v by the Thomas algorithm
    const c = new Float64Array(n), w = new Float64Array(n);
    let b0 = H.d[0] - shift;
    c[0] = H.e / b0; w[0] = v[0] / b0;
    for (let j = 1; j < n; j++) {
      const m = H.d[j] - shift - H.e * c[j - 1];
      c[j] = H.e / m; w[j] = (v[j] - H.e * w[j - 1]) / m;
    }
    for (let j = n - 2; j >= 0; j--) w[j] -= c[j] * w[j + 1];
    let s = 0; for (let j = 0; j < n; j++) s += w[j] * w[j];
    s = Math.sqrt(s * g.dx);
    for (let j = 0; j < n; j++) w[j] /= s;
    v = w;
  }
  // a fixed sign convention: the largest lobe positive
  let big = 0; for (let j = 0; j < n; j++) if (Math.abs(v[j]) > Math.abs(v[big])) big = j;
  if (v[big] < 0) for (let j = 0; j < n; j++) v[j] = -v[j];
  return v;
}

/**
 * Crank–Nicolson stepper: (1 + iΔt H / 2ħ) ψⁿ⁺¹ = (1 − iΔt H / 2ħ) ψⁿ, the left side's elimination precomputed
 * (the Hamiltonian does not change).
 */
export function stepper(H, dt) {
  const n = H.d.length, a = dt / (2 * HBAR_EVFS);
  // A = 1 + i·a·H : diagonal (1, a·d), off (0, a·e)
  const cr = new Float64Array(n), ci = new Float64Array(n), mr = new Float64Array(n), mi = new Float64Array(n);
  const offR = 0, offI = a * H.e;
  let br = 1, bi = a * H.d[0];
  let den = br * br + bi * bi;
  mr[0] = br; mi[0] = bi;
  cr[0] = (offR * br + offI * bi) / den; ci[0] = (offI * br - offR * bi) / den;
  for (let j = 1; j < n; j++) {
    // m_j = A_jj − A_j,j−1 · c_{j−1}
    const pr = offR * cr[j - 1] - offI * ci[j - 1], pi = offR * ci[j - 1] + offI * cr[j - 1];
    br = 1 - pr; bi = a * H.d[j] - pi;
    mr[j] = br; mi[j] = bi;
    den = br * br + bi * bi;
    cr[j] = (offR * br + offI * bi) / den; ci[j] = (offI * br - offR * bi) / den;
  }
  const rr = new Float64Array(n), ri = new Float64Array(n);
  return function step(re, im) {
    // right side: (1 − i·a·H) ψ
    for (let j = 0; j < n; j++) {
      const hr = H.d[j] * re[j] + H.e * ((j > 0 ? re[j - 1] : 0) + (j < n - 1 ? re[j + 1] : 0));
      const hi = H.d[j] * im[j] + H.e * ((j > 0 ? im[j - 1] : 0) + (j < n - 1 ? im[j + 1] : 0));
      rr[j] = re[j] + a * hi; ri[j] = im[j] - a * hr;
    }
    // forward: y_j = (r_j − A_j,j−1·y_{j−1}) / m_j
    for (let j = 0; j < n; j++) {
      let sr = rr[j], si = ri[j];
      if (j > 0) { sr -= offR * re[j - 1] - offI * im[j - 1]; si -= offR * im[j - 1] + offI * re[j - 1]; }
      const d2 = mr[j] * mr[j] + mi[j] * mi[j];
      re[j] = (sr * mr[j] + si * mi[j]) / d2; im[j] = (si * mr[j] - sr * mi[j]) / d2;
    }
    // back: ψ_j = y_j − c_j·ψ_{j+1}
    for (let j = n - 2; j >= 0; j--) {
      const xr = cr[j] * re[j + 1] - ci[j] * im[j + 1], xi = cr[j] * im[j + 1] + ci[j] * re[j + 1];
      re[j] -= xr; im[j] -= xi;
    }
  };
}

/** What a state shows: its norm, mean position and spread, energy, and the share beyond a point. */
export function measure(g, H, re, im, cut = null) {
  let N = 0, X = 0, X2 = 0, E = 0, right = 0;
  const n = g.n;
  for (let j = 0; j < n; j++) {
    const p = re[j] * re[j] + im[j] * im[j];
    N += p; X += p * g.x[j]; X2 += p * g.x[j] * g.x[j];
    if (cut !== null && g.x[j] > cut) right += p;
    const hr = H.d[j] * re[j] + H.e * ((j > 0 ? re[j - 1] : 0) + (j < n - 1 ? re[j + 1] : 0));
    const hi = H.d[j] * im[j] + H.e * ((j > 0 ? im[j - 1] : 0) + (j < n - 1 ? im[j + 1] : 0));
    E += re[j] * hr + im[j] * hi;
  }
  N *= g.dx; X *= g.dx; X2 *= g.dx; E *= g.dx; right *= g.dx;
  const mean = X / N;
  return { norm: N, x: mean, sigma: Math.sqrt(Math.max(0, X2 / N - mean * mean)), E: E / N, right: right / N };
}

/** The transmission of a rectangular barrier (height V0, width a) at energy E, both in eV, a in nm. */
export function barrierT(E, V0, a, hb2m) {
  if (E <= 0) return 0;
  if (Math.abs(E - V0) < 1e-12 * V0) return 1 / (1 + (a * a * V0) / (4 * hb2m));
  if (E < V0) { const kap = Math.sqrt((V0 - E) / hb2m), s = Math.sinh(kap * a); return 1 / (1 + (V0 * V0 * s * s) / (4 * E * (V0 - E))); }
  const k2 = Math.sqrt((E - V0) / hb2m), s = Math.sin(k2 * a);
  return 1 / (1 + (V0 * V0 * s * s) / (4 * E * (E - V0)));
}

/** The transmission of a potential step (height V0) at energy E (eV): the share of probability current passed. */
export function stepT(E, V0) {
  if (E <= V0) return 0;
  const k1 = Math.sqrt(E), k2 = Math.sqrt(E - V0);
  return (4 * k1 * k2) / ((k1 + k2) * (k1 + k2));
}
