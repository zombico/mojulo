/**
 * beats-song-dsp.js — engine-independent signal primitives for the singing
 * primitive (beats-song). The RENDER half's shared toolbox: WAV parse, the
 * squisher (time-scale), pitch detection, seeded noise, note→Hz, and the biquad
 * filter family. Extracted verbatim-in-behaviour from the sing spikes.
 *
 * Both L3 voice engines build on these: the baked-register vocoder and the
 * parametric formant synth (the locked-voice fork) share the filters, resampler,
 * and carrier math — only the FORMANT SOURCE differs (Kokoro samples vs. formant
 * targets). Keeping the primitives here is what makes L3 a replaceable rung. See
 * beats-song.plan.md.
 *
 * Pure functions, no IO except `readWavMono` (which parses an in-memory Buffer,
 * it does not touch disk). Deterministic: the only randomness is `mulberry32`,
 * the seeded dice the beats doctrine mandates (never Math.random).
 */

// ── note math ───────────────────────────────────────────────────────────────
// Standalone copy of the standard equal-temperament formula. The kernel has its
// own private `noteHz` closure and beats-midi exports `midiNote` (MIDI numbers,
// not Hz); neither is a reusable Hz helper, so this 5-liner stands on its own.
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Note name ("A4", "Bb1", "F#3") or a bare number (already Hz) → frequency in Hz. */
export function noteHz(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) throw new Error(`beats-song: bad note name "${name}" (expected e.g. "A4", "Bb1", "F#3")`);
  let semi = SEMI[m[1].toUpperCase()];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── seeded dice (doctrine: mulberry32, never Math.random) ────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `len` samples of seeded white noise in [-1, 1) — the sibilant carrier source. */
export function noiseSrc(len, rng) {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = rng() * 2 - 1;
  return out;
}

// ── WAV IO + trim ────────────────────────────────────────────────────────────
/**
 * Parse a mono channel out of an in-memory WAV Buffer. Handles both formats the
 * two Kokoro rungs emit: float32 (code 3, rung 1) and int16 PCM (code 1, rung 2).
 * Multi-channel input is downmixed to the first channel.
 */
export function readWavMono(buf) {
  let p = 12, fmt = null, off = null, len = 0;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      fmt = { code: buf.readUInt16LE(p + 8), ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    } else if (id === 'data') { off = p + 8; len = sz; }
    p += 8 + sz + (sz & 1);
  }
  if (!fmt || off == null) throw new Error('beats-song: not a RIFF/WAVE buffer');
  const out = [];
  if (fmt.code === 3 && fmt.bits === 32) {
    for (let i = off; i + 4 * fmt.ch <= off + len; i += 4 * fmt.ch) out.push(buf.readFloatLE(i));
  } else {
    for (let i = off; i + 2 * fmt.ch <= off + len; i += 2 * fmt.ch) out.push(buf.readInt16LE(i) / 32768);
  }
  return { data: Float32Array.from(out), sr: fmt.sr };
}

/** Trim leading/trailing near-silence below `floor` amplitude. Returns a subarray view. */
export function trim(d, floor = 0.02) {
  let s = 0, e = d.length - 1;
  while (s < e && Math.abs(d[s]) < floor) s++;
  while (e > s && Math.abs(d[e]) < floor) e--;
  return d.subarray(s, e + 1);
}

// ── the SQUISHER (time-scale, no chipmunk) ───────────────────────────────────
/**
 * Linearly resample `x` to exactly `outLen` samples. The killer move of the sing
 * pipeline: because the engines take only the modulator's ENVELOPE (pitch comes
 * from the carrier), a syllable render can be time-scaled freely with zero pitch
 * shift — multi-mora syllables squish to fit short notes, held notes stretch, and
 * every note is force-fit to its exact beat. See the plan's "The squisher".
 */
export function resampleTo(x, outLen) {
  const out = new Float32Array(outLen);
  const sc = (x.length - 1) / Math.max(1, outLen - 1);
  for (let i = 0; i < outLen; i++) {
    const p = i * sc, i0 = Math.floor(p), fr = p - i0;
    out[i] = x[i0] * (1 - fr) + (x[i0 + 1] ?? x[i0]) * fr;
  }
  return out;
}

// ── pitch detection (normalized autocorrelation) ─────────────────────────────
/**
 * Estimate f0 (Hz) from a voiced segment by normalized autocorrelation over the
 * `[fMin, fMax]` lag range, measured on a short window at the segment centre (the
 * steadiest part). Used to read the pitch of the baked reference vowel so the
 * carrier can be re-pitched to each note. Falls back to `fallback` if unvoiced.
 */
export function detectF0(x, sr, { fMin = 150, fMax = 350, fallback = 220 } = {}) {
  const c = Math.floor(x.length * 0.5), win = Math.min(x.length - c, Math.floor(sr * 0.06));
  const seg = x.subarray(c, c + win);
  const minL = Math.floor(sr / fMax), maxL = Math.floor(sr / fMin);
  let bestLag = -1, best = 0;
  for (let lag = minL; lag <= maxL; lag++) {
    let s = 0, e0 = 0, e1 = 0;
    for (let i = 0; i + lag < seg.length; i++) { s += seg[i] * seg[i + lag]; e0 += seg[i] * seg[i]; e1 += seg[i + lag] * seg[i + lag]; }
    const nc = s / (Math.sqrt(e0 * e1) || 1);
    if (nc > best) { best = nc; bestLag = lag; }
  }
  return bestLag > 0 ? sr / bestLag : fallback;
}

// ── the biquad filter family (shared by both engines) ────────────────────────
/** Band-pass biquad coefficients (constant skirt gain). */
export function bandpass(sr, f0, Q) {
  const w0 = (2 * Math.PI * f0) / sr, a = Math.sin(w0) / (2 * Q), c = Math.cos(w0), a0 = 1 + a;
  return { b0: a / a0, b1: 0, b2: -a / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 };
}

/** High-pass biquad coefficients. */
export function highpass(sr, f0, Q = 0.707) {
  const w0 = (2 * Math.PI * f0) / sr, a = Math.sin(w0) / (2 * Q), c = Math.cos(w0), a0 = 1 + a;
  return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 };
}

/** Run a Direct-Form-I biquad (coefficients from bandpass/highpass) over `x`. */
export function biquad(x, k) {
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i], y = k.b0 * xi + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}

/** One-pole low-pass at cutoff `fc` (smooths a carrier — tames vocoder buzz). */
export function lowpass1(x, sr, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / sr), out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y = a * y + (1 - a) * x[i]; out[i] = y; }
  return out;
}

/** Pre-emphasis (first-order high-boost) — flattens the spectral tilt before analysis. */
export function preEmph(x, coef = 0.97) {
  const out = new Float32Array(x.length);
  let prev = 0;
  for (let i = 0; i < x.length; i++) { out[i] = x[i] - coef * prev; prev = x[i]; }
  return out;
}

/** Peak-normalize a buffer in place to `peak` (default 0.9). Returns the same array. */
export function normalizePeak(x, peak = 0.9) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; }
  return x;
}

/** Float samples → a mono 16-bit PCM WAV Buffer (the writer readWavMono round-trips). */
export function writeWavMono(d, sr) {
  const pcm = Buffer.alloc(d.length * 2);
  for (let i = 0; i < d.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))), i * 2);
  const b = Buffer.alloc(44 + pcm.length);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(pcm.length, 40); pcm.copy(b, 44);
  return b;
}
