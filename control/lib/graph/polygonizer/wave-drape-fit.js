/**
 * wave-drape-fit — the CREATABILITY GATE for a dreamed drape.
 *
 * A drape (cape/cloak/tabard) is not sculpted mesh; it is a wave-field — a bounded
 * superposition of plane waves over a quad (see buildWaveDrape in figure-garments.js,
 * and the `wave-field` leaf-mark primitive). That is precisely what lets us PROVE a
 * dreamed drape is creatable inside the substrate instead of hand-waving it:
 *
 *   "Can a bounded sum of plane waves reproduce the dreamed fold field within ε?"
 *
 * is a least-squares question. This module answers it by MATCHING PURSUIT over a
 * frequency dictionary — greedily pick the plane wave that explains the most
 * remaining fold energy, record it, subtract, repeat. The leftover residual IS the
 * proof metric:
 *   • residual small  → the drape is reachable, and the fitted `waves` ARE the
 *     recipe (hand them straight to a `fit:'wave-drape'` piece — proof and author
 *     are the same step).
 *   • residual large  → the fold pattern is OUTSIDE the wave-field's reach: a named
 *     vocabulary gap, not geometry to invent. That is the doctrine's escalation.
 *
 * The wave grammar mirrors wave-field.js `waveHeight` exactly:
 *   h(u,v) = Σ amp · sin(2π(cu·u + cv·v) + phase)
 * so a fitted set round-trips through sampleWaveField / buildWaveDrape unchanged.
 *
 * The target is a HEIGHT FIELD in displacement-axis units over the (u,v) drape
 * parameter square — the same scalar `waveHeight` returns. How an agent gets one
 * from a dreamed image (read the fold contours off the flat plate) is upstream and
 * out of scope here; this module is the deterministic judge over that field.
 */

const TAU = 2 * Math.PI;

// Default frequency dictionary. Biased toward a hanging drape's grain (folds run
// down the length → vary across the width `u`, persist along the drop `v`), but it
// still spans cross-folds so a genuinely 2D fold field can be fit or shown to miss.
const DEFAULT_FREQS = (() => {
  const us = [0.35, 0.6, 1, 1.5, 2, 3, 4, 5, 6, 8, 11];
  const vs = [0, 0.35, 0.6, 1, 1.5, 2, 3];
  const out = [];
  for (const cu of us) for (const cv of vs) { if (cu === 0 && cv === 0) continue; out.push({ cu, cv }); }
  return out;
})();

// Normalize the target into a dense Nu×Nv grid of heights. Accepts a 2D array
// (H[iu][iv]) or a function (u,v)=>height sampled on `samples`.
function toGrid(target, samples = { u: 22, v: 30 }) {
  if (Array.isArray(target)) {
    const grid = target.map((row) => row.slice());
    if (grid.length < 2 || grid.some((r) => !Array.isArray(r) || r.length < 2)) {
      throw new Error('fitWaveDrape: array target must be a ≥2×2 grid of heights');
    }
    return grid;
  }
  if (typeof target === 'function') {
    const Nu = Math.max(2, Math.floor(samples.u ?? 22)), Nv = Math.max(2, Math.floor(samples.v ?? 30));
    const grid = [];
    for (let iu = 0; iu <= Nu; iu++) {
      const row = [];
      for (let iv = 0; iv <= Nv; iv++) {
        const h = target(iu / Nu, iv / Nv);
        row.push(Number.isFinite(h) ? h : 0);
      }
      grid.push(row);
    }
    return grid;
  }
  throw new Error('fitWaveDrape: target must be a height grid (number[][]) or a (u,v)=>height function');
}

function rms(grid) {
  let s = 0, n = 0;
  for (const row of grid) for (const h of row) { s += h * h; n++; }
  return n ? Math.sqrt(s / n) : 0;
}

/**
 * Fit a dreamed drape height field as a bounded superposition of plane waves and
 * report whether it is creatable.
 *
 * @param {number[][] | ((u:number,v:number)=>number)} target  fold heights over (u,v)
 * @param {object} [opts]
 * @param {number} [opts.components=6]     max plane waves in the fit (bounded superposition)
 * @param {number} [opts.epsilon=0.18]     max relative residual to count as creatable
 * @param {number} [opts.maxAmplitude=4]   reject a fit that needs a wave larger than this
 * @param {{u:number,v:number}} [opts.samples]  grid density when target is a function
 * @param {Array<{cu:number,cv:number}>} [opts.freqs]  override the frequency dictionary
 * @returns {{ creatable, residual, relativeResidual, baseline, waves, maxAmplitude, reason }}
 */
export function fitWaveDrape(target, opts = {}) {
  const { components = 6, epsilon = 0.18, maxAmplitude = 4, samples, freqs = DEFAULT_FREQS } = opts;
  const grid = toGrid(target, samples);
  const Nu = grid.length - 1, Nv = grid[0].length - 1;

  // The DC term (mean height) is the drape's baseline, carried by the corners /
  // pin→free envelope, not a fold. Subtract it and fit the zero-mean fold field.
  let mean = 0, count = 0;
  for (const row of grid) for (const h of row) { mean += h; count++; }
  mean = count ? mean / count : 0;
  const R = grid.map((row) => row.map((h) => h - mean));   // residual we drive toward 0
  const foldEnergy = rms(R) || 1e-9;                       // the fold RMS we must explain

  // Precompute (u,v) so each candidate only recomputes its own phase term.
  const U = [], Vv = [];
  for (let iu = 0; iu <= Nu; iu++) U.push(iu / Nu);
  for (let iv = 0; iv <= Nv; iv++) Vv.push(iv / Nv);

  const waves = [];
  let peakAmp = 0;
  for (let k = 0; k < components; k++) {
    let best = null;
    for (const { cu, cv } of freqs) {
      // Project the current residual onto sin θ and cos θ at this frequency.
      // The best amp/phase at (cu,cv) is amp=hypot(a,b), phase=atan2(b,a), where
      // a,b are the LS coefficients of sinθ, cosθ (near-orthogonal on the grid).
      let rs = 0, rc = 0, ss = 0, cc = 0;
      for (let iu = 0; iu <= Nu; iu++) {
        const cuU = cu * U[iu];
        for (let iv = 0; iv <= Nv; iv++) {
          const th = TAU * (cuU + cv * Vv[iv]);
          const st = Math.sin(th), ct = Math.cos(th), r = R[iu][iv];
          rs += r * st; rc += r * ct; ss += st * st; cc += ct * ct;
        }
      }
      const a = ss > 1e-9 ? rs / ss : 0, b = cc > 1e-9 ? rc / cc : 0;
      const energy = a * a * ss + b * b * cc;              // fold energy this wave removes
      if (!best || energy > best.energy) best = { cu, cv, a, b, energy };
    }
    if (!best || best.energy < 1e-9) break;                // nothing left to explain
    const amp = Math.hypot(best.a, best.b);
    const phase = Math.atan2(best.b, best.a);
    peakAmp = Math.max(peakAmp, amp);
    // Subtract the fitted wave from the residual.
    for (let iu = 0; iu <= Nu; iu++) {
      const cuU = best.cu * U[iu];
      for (let iv = 0; iv <= Nv; iv++) {
        R[iu][iv] -= amp * Math.sin(TAU * (cuU + best.cv * Vv[iv]) + phase);
      }
    }
    waves.push({ amplitude: amp, cycles: { u: best.cu, v: best.cv }, phase });
  }

  const residual = rms(R);
  const relativeResidual = residual / foldEnergy;
  const withinAmp = peakAmp <= maxAmplitude;
  const withinResidual = relativeResidual <= epsilon;
  const creatable = withinResidual && withinAmp;
  let reason;
  if (creatable) reason = `reachable — ${waves.length} plane waves explain ${(100 * (1 - relativeResidual)).toFixed(1)}% of the fold field`;
  else if (!withinAmp) reason = `unbounded — the fit needs a wave of amplitude ${peakAmp.toFixed(2)} > maxAmplitude ${maxAmplitude}; not a bounded superposition`;
  else reason = `out of reach — ${(100 * relativeResidual).toFixed(1)}% of the fold field is unexplained (> ${(100 * epsilon).toFixed(0)}%); name this as a vocabulary gap, do not sculpt it`;

  return { creatable, residual, relativeResidual, baseline: mean, waves, maxAmplitude: peakAmp, reason };
}

/**
 * Sample a known wave set into a height grid — the inverse of fitWaveDrape, so a
 * round-trip (sample → fit) is a test the fitter recovers what it should. Mirrors
 * wave-field.js `waveHeight`.
 */
export function sampleDrapeHeightField(waves, samples = { u: 22, v: 30 }, baseline = 0) {
  const Nu = Math.max(2, Math.floor(samples.u ?? 22)), Nv = Math.max(2, Math.floor(samples.v ?? 30));
  const grid = [];
  for (let iu = 0; iu <= Nu; iu++) {
    const u = iu / Nu, row = [];
    for (let iv = 0; iv <= Nv; iv++) {
      const v = iv / Nv;
      let h = baseline;
      for (const w of waves) {
        const amp = Number.isFinite(w.amplitude) ? w.amplitude : 0;
        const cu = Number.isFinite(w.cycles?.u) ? w.cycles.u : 0;
        const cv = Number.isFinite(w.cycles?.v) ? w.cycles.v : 0;
        const phase = Number.isFinite(w.phase) ? w.phase : 0;
        h += amp * Math.sin(TAU * (cu * u + cv * v) + phase);
      }
      row.push(h);
    }
    grid.push(row);
  }
  return grid;
}
