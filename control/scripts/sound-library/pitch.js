/**
 * The sound library's PITCH CONVERTER: what note a recorded take really is, and where it loops. The generator takes a
 * prompt's pitch as a hint (the spike: every take landed on the note's letter within about 25 cents, its octave by
 * chance), so an instrument's samples are zoned by their measured root, never by the note they were asked at.
 *
 *   fundamental(x, rate, { from?, seconds?, lo?, hi? }) → { hz, midi, cents, clarity }
 *        the harmonic product spectrum of a stretch of the take (a 2^n FFT of `seconds` from `from`, Hann windowed; the
 *        log magnitudes at 1…5 times each bin summed), its peak in [lo, hi] Hz refined by a parabola; `clarity` the
 *        peak's height over the median (a noise has none worth trusting)
 *   steadyPitch(x, rate, { lo?, hi? }) → { hz, midi, cents, spread, agree } | null: the fundamental read at six
 *        stretches of the take while it sounds (a struck note's ring, not the silence after it), searched in [lo, hi] Hz
 *        (conditioning gives the band round the note asked: a hum or a bell's odd partial falls outside it); the note is
 *        the largest group of reads agreeing within 40 cents, its median, kept only when at least half the reads join
 *        it: a blast or a gust has no such group (null), and one read slipped an octave sinks no take
 *   loopPoints(x, rate, hz, { from?, to?, periods? }) → [start, end] seconds: a held note's loop, an upward zero
 *        crossing near `from` (a share of the part of the take that still sounds, `soundingEnd`) to the one nearest a whole number of periods later, inside `to`, so
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

// where a take stops sounding (a 50 ms stretch 30 dB under its loudest), as a count of samples
export function soundingEnd(x, rate) {
  const W = Math.round(0.05 * rate), env = [];
  for (let s0 = 0; s0 + W <= x.length; s0 += W) { let e = 0; for (let i = s0; i < s0 + W; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / W)); }
  const peak = Math.max(...env, 1e-9);
  let last = env.length - 1;
  while (last > 0 && env[last] < peak * 0.0316) last--;
  return Math.min(x.length, (last + 1) * W);
}

export function loopPoints(x, rate, hz, { from = 0.35, to = 0.92, periods = null } = {}) {
  // (inside the part of the take that still sounds: a note held briefly before a silent tail loops on the note)
  const S = soundingEnd(x, rate);
  const P = rate / hz, start0 = Math.round(from * S), stop = Math.round(to * S);
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

export function steadyPitch(x, rate, { most = 40, lo = 40, hi = 4200, reads: n = 6 } = {}) {
  // (read inside the note while it sounds: a struck bell that dies in a second is read over that second, not over the
  // silence after it; the sounding part ends where a 50 ms stretch falls 30 dB under the loudest)
  const W = Math.round(0.05 * rate), env = [];
  for (let s0 = 0; s0 + W <= x.length; s0 += W) { let e = 0; for (let i = s0; i < s0 + W; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / W)); }
  const peak = Math.max(...env, 1e-9);
  let last = env.length - 1;
  while (last > 0 && env[last] < peak * 0.0316) last--;
  const T = Math.max(0.2, ((last + 1) * W) / rate), len = Math.min(0.5, T / 4);
  // (n reads spread over the sounding part, the last ending at its end; the note is the largest group of them that
  // agree within `most` cents, and it must hold at least half: one read slipped an octave or a fifth sinks no take)
  const reads = [...Array(n).keys()].map((k) => fundamental(x, rate, { from: 0.05 * T + (k / Math.max(1, n - 1)) * Math.max(0, T * 0.95 - len - 0.05 * T), seconds: len, lo, hi })).filter((r) => r.hz > 0);
  const m = reads.slice().sort((a, b) => a.midi - b.midi);
  let best = [];
  for (let a = 0, b = 0; b < m.length; b++) { while ((m[b].midi - m[a].midi) * 100 > most) a++; if (b - a + 1 > best.length) best = m.slice(a, b + 1); }
  if (best.length < Math.ceil(n / 2)) return null;
  const mid = best[best.length >> 1];
  return { hz: mid.hz, midi: mid.midi, cents: mid.cents, spread: Math.round((best[best.length - 1].midi - best[0].midi) * 100), agree: best.length };
}
