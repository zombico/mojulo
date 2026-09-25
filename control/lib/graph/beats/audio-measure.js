/**
 * audio-measure — the machine-gate measurements for rendered beats audio
 * (test and probe support; nothing in the product imports this). Plain JS over
 * Float32Arrays: WAV decode, stereo correlation, spectral centroid, pitch by
 * autocorrelation, decay time by a fitted slope, and true peak. These are the
 * numbers the audio-fidelity gates assert on; none of them is an ears gate.
 */

// Decode a RIFF/WAVE Buffer (16/24-bit PCM or 32-bit float) → { sr, bits, channels }.
export function decodeWav(buf) {
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), nCh: buf.readUInt16LE(off + 10), sr: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = { start: off + 8, size };
    off += 8 + size + (size % 2);
  }
  const { nCh, sr, bits, format } = fmt;
  const bytes = bits / 8;
  const len = Math.floor(data.size / (bytes * nCh));
  const channels = Array.from({ length: nCh }, () => new Float32Array(len));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const o = data.start + (i * nCh + c) * bytes;
      let v;
      if (format === 3) v = buf.readFloatLE(o);
      else if (bits === 24) v = buf.readIntLE(o, 3) / 8388608;
      else v = buf.readInt16LE(o) / 32768;
      channels[c][i] = v;
    }
  }
  return { sr, bits, format, channels };
}

export function lrCorrelation(L, R) {
  let lr = 0, ll = 0, rr = 0;
  for (let i = 0; i < L.length; i++) { lr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i]; }
  return lr / (Math.sqrt(ll * rr) || 1);
}

export function rms(y, a = 0, b = y.length) {
  let s = 0;
  for (let i = a; i < b; i++) s += y[i] * y[i];
  return Math.sqrt(s / Math.max(1, b - a));
}

export function peak(y) {
  let p = 0;
  for (let i = 0; i < y.length; i++) p = Math.max(p, Math.abs(y[i]));
  return p;
}

// in-place radix-2 FFT magnitude of a Hann-windowed frame (n = power of two).
export function magnitudeSpectrum(y, start, n) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (y[start + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const xr = ar * wr - ai * wi, xi = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr; im[i + k] += xi;
      }
    }
  }
  const mag = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

// magnitude-weighted spectral centroid (Hz) of one frame.
export function centroid(y, sr, start = 0, n = 4096) {
  const mag = magnitudeSpectrum(y, start, n);
  let num = 0, den = 0;
  for (let k = 1; k < mag.length; k++) { num += k * mag[k]; den += mag[k]; }
  return den ? (num / den) * (sr / n) : 0;
}

// fraction of a frame's energy in [lo, hi) Hz.
export function bandEnergy(y, sr, start, n, lo, hi) {
  const mag = magnitudeSpectrum(y, start, n);
  let e = 0;
  for (let k = Math.ceil((lo * n) / sr); k < Math.min(mag.length, (hi * n) / sr); k++) e += mag[k] * mag[k];
  return e;
}

// fundamental by normalized autocorrelation + parabolic interpolation, searching
// periods around sr/expectHz (the audio-probe method).
export function pitchHz(y, sr, start, win, expectHz) {
  const P = sr / expectHz;
  const lo = Math.max(2, Math.floor(P * 0.9)), hi = Math.ceil(P * 1.1);
  const s = y.subarray(start, start + win + hi);
  const r = [];
  let best = -2, bl = lo;
  for (let L = lo; L <= hi; L++) {
    let a = 0, e0 = 0, e1 = 0;
    for (let i = 0; i < win; i++) { a += s[i] * s[i + L]; e0 += s[i] * s[i]; e1 += s[i + L] * s[i + L]; }
    r[L] = a / (Math.sqrt(e0 * e1) || 1);
    if (r[L] > best) { best = r[L]; bl = L; }
  }
  const a = r[bl - 1] ?? best, b = best, c = r[bl + 1] ?? best;
  const d = (a - c) / (2 * (a - 2 * b + c) || 1);
  return sr / (bl + d);
}

// RBJ bandpass (constant 0 dB peak) — isolates one partial before a decay fit.
export function bandpass(y, sr, f0, q = 8) {
  const w = (2 * Math.PI * f0) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  const out = new Float32Array(y.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < y.length; i++) {
    const v = b0 * y[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
  }
  return out;
}

export function cents(measured, target) { return 1200 * Math.log2(measured / target); }

// decay time to −60 dB, from a least-squares line through the 20 ms RMS
// envelope (dB) between `fromDb` and `toDb` below its peak — the T30-style
// extrapolation, robust to the fast early decay of bright partials.
export function t60(y, sr, fromDb = -5, toDb = -35) {
  const w = Math.round(sr * 0.02);
  const env = [];
  for (let i = 0; i + w <= y.length; i += w) env.push(20 * Math.log10(rms(y, i, i + w) || 1e-12));
  let pk = -Infinity, pi = 0;
  env.forEach((v, i) => { if (v > pk) { pk = v; pi = i; } });
  const xs = [], ys = [];
  for (let i = pi; i < env.length; i++) {
    const rel = env[i] - pk;
    if (rel <= fromDb && rel >= toDb) { xs.push(i * 0.02); ys.push(rel); }
    if (rel < toDb) break;
  }
  if (xs.length < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxy / sxx; // dB per second
  return slope < 0 ? -60 / slope : null;
}
