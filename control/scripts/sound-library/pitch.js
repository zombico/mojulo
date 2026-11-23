/**
 * The sound library's PITCH CONVERTER: what note a recorded take really is, and where it loops. The generator takes a
 * prompt's pitch as a hint (the spike: every take landed on the note's letter within about 25 cents, its octave by
 * chance), so an instrument's samples are zoned by their measured root, never by the note they were asked at.
 *
 *   fundamental(x, rate, { from?, seconds?, lo?, hi? }) → { hz, midi, cents, clarity }
 *        the harmonic product spectrum of a stretch of the take (a 2^n FFT of `seconds` from `from`, Hann windowed; the
 *        log magnitudes at 1…5 times each bin summed), its peak in [lo, hi] Hz refined by a parabola; `clarity` the
 *        peak's height over the median (a noise has none worth trusting)
 *   steadyPitch(x, rate) → { hz, midi, cents, spread } | null: the fundamental read at three stretches of the take while
 *        it sounds (its start, its middle, its later sustain: a struck note's ring, not the silence after it), their
 *        median and how far apart they are (cents): a take whose reads disagree by more than 40 cents is no note (a
 *        blast, a gust), null
 *   loopPoints(x, rate, hz, { from?, to?, periods? }) → [start, end] seconds: a held note's loop, an upward zero
 *        crossing near `from` (a share of the take) to the one nearest a whole number of periods later, inside `to`, so
 *        the seam meets itself in phase
 *
 * Pure (Float32Array in, numbers out); no clock, no dice.
 */

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const p = i + k, q = p + h, vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr;
        re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const midiOf = (hz) => 69 + 12 * Math.log2(hz / 440);

export function fundamental(x, rate, { from = 0.1, seconds = 1, lo = 40, hi = 1400 } = {}) {
  const s0 = Math.min(x.length - 1, Math.round(from * rate)), L = Math.max(16, Math.min(Math.round(seconds * rate), x.length - s0));
  let N = 1;
  while (N < L * 2) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < L; i++) re[i] = x[s0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1)));
  fft(re, im);
  const half = N >> 1, mag = new Float64Array(half);
  for (let i = 0; i < half; i++) mag[i] = Math.log(Math.hypot(re[i], im[i]) + 1e-9);
  const b0 = Math.max(2, Math.floor((lo * N) / rate)), b1 = Math.min(Math.floor(half / 5) - 1, Math.ceil((hi * N) / rate));
  // (a candidate's own bin must carry the note: within 30 dB of the loudest in the band, so a near-sine, whose harmonics
  // are all noise, is read at its one peak and not at a multiple of it; a piano's weak low fundamental still is)
  let top = -Infinity;
  for (let i = b0; i <= b1; i++) top = Math.max(top, mag[i]);
  const floor = top - Math.log(31.6);
  const hps = new Float64Array(b1 + 2);
  let best = -Infinity, bi = b0;
  for (let i = b0; i <= b1 + 1; i++) {
    let p = 0;
    for (let h = 1; h <= 5; h++) p += mag[i * h];
    hps[i] = p;
    if (i <= b1 && p > best && Math.max(mag[i - 1], mag[i], mag[i + 1]) >= floor) { best = p; bi = i; }
  }
  const a = hps[bi - 1], b = hps[bi], c = hps[bi + 1], d = a - 2 * b + c ? (a - c) / (2 * (a - 2 * b + c)) : 0;
  const hz = ((bi + Math.max(-0.5, Math.min(0.5, d))) * rate) / N;
  const sorted = Array.from(hps.slice(b0, b1 + 1)).sort((u, v) => u - v), median = sorted[sorted.length >> 1];
  const midi = midiOf(hz);
  return { hz: Math.round(hz * 100) / 100, midi: Math.round(midi * 100) / 100, cents: Math.round((midi - Math.round(midi)) * 100), clarity: Math.round((best - median) * 100) / 100 };
}

export function loopPoints(x, rate, hz, { from = 0.35, to = 0.92, periods = null } = {}) {
  const P = rate / hz, start0 = Math.round(from * x.length), stop = Math.round(to * x.length);
  const up = (i) => x[i - 1] <= 0 && x[i] > 0;
  let s = start0;
  while (s < stop && !up(s)) s++;
  // (as many whole periods as fit, a second or so of the note: a long loop hides the seam's colour)
  const k = periods ?? Math.max(1, Math.floor(Math.min(stop - s, rate * 1.2) / P));
  const want = s + k * P;
  let e = Math.round(want), best = Infinity;
  for (let i = Math.max(s + 1, Math.round(want - P / 2)); i <= Math.min(stop, Math.round(want + P / 2)); i++) if (up(i) && Math.abs(i - want) < best) { best = Math.abs(i - want); e = i; }
  return [Math.round((s / rate) * 1e5) / 1e5, Math.round((e / rate) * 1e5) / 1e5];
}

export function steadyPitch(x, rate, { most = 40 } = {}) {
  // (read inside the note while it sounds: a struck bell that dies in a second is read over that second, not over the
  // silence after it; the sounding part ends where a 50 ms stretch falls 30 dB under the loudest)
  const W = Math.round(0.05 * rate), env = [];
  for (let s0 = 0; s0 + W <= x.length; s0 += W) { let e = 0; for (let i = s0; i < s0 + W; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / W)); }
  const peak = Math.max(...env, 1e-9);
  let last = env.length - 1;
  while (last > 0 && env[last] < peak * 0.0316) last--;
  const T = Math.max(0.2, ((last + 1) * W) / rate), len = Math.min(0.5, T / 4);
  const reads = [0.08, 0.35, 0.6].map((f) => fundamental(x, rate, { from: f * T, seconds: len })).filter((r) => r.hz > 0);
  if (reads.length < 3) return null;
  const m = reads.map((r) => r.midi).sort((a, b) => a - b), spread = Math.round((m[2] - m[0]) * 100);
  if (spread > most) return null;
  const mid = reads.find((r) => r.midi === m[1]);
  return { hz: mid.hz, midi: mid.midi, cents: mid.cents, spread };
}
