/**
 * The fast Fourier transform the plane system steps with: radix-2, complex, in place, on split real and imaginary
 * arrays (Float64Array), one dimension or the rows and columns of a square grid. Unnormalized forward, 1/N inverse,
 * so a forward then inverse round trip returns the input. Pure and deterministic.
 */

const TABLES = new Map();
function tables(n) {
  let t = TABLES.get(n);
  if (t) return t;
  if (n < 2 || (n & (n - 1))) throw new Error(`science-worlds: an FFT length is a power of two (got ${n})`);
  const rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
  t = { rev, cos, sin };
  TABLES.set(n, t);
  return t;
}

/** In-place FFT of n values starting at `off`, `stride` apart; `inverse` conjugates the twiddles (and scales 1/n). */
export function fft(re, im, n, { off = 0, stride = 1, inverse = false } = {}) {
  const { rev, cos, sin } = tables(n), sgn = inverse ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i * stride, b = off + j * stride;
      let t = re[a]; re[a] = re[b]; re[b] = t;
      t = im[a]; im[a] = im[b]; im[b] = t;
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2, step = n / size;
    for (let s = 0; s < n; s += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step], wi = sgn * sin[k * step];
        const a = off + (s + k) * stride, b = off + (s + k + half) * stride;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { const a = off + i * stride; re[a] /= n; im[a] /= n; }
}

/** In-place 2-D FFT of an n × n grid stored row-major (index = iy·n + ix). */
export function fft2(re, im, n, inverse = false) {
  for (let r = 0; r < n; r++) fft(re, im, n, { off: r * n, inverse });
  for (let c = 0; c < n; c++) fft(re, im, n, { off: c, stride: n, inverse });
}

/** The angular wavenumber of FFT bin i of n on a grid of spacing dx (bins past n/2 are the negative ones). */
export const wavenumber = (i, n, dx) => ((2 * Math.PI) / (n * dx)) * (i < n / 2 ? i : i - n);
