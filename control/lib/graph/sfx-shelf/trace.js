/**
 * sfx-shelf/trace — a rendered sound traced into a recipe: the `trace` gesture the beats kernel synthesizes back (a
 * noise vocoder). How a voice's sound joins the shelf without a sample: the numbers are traced once, where the voice
 * worker is, and played everywhere. Pure (samples in, a gesture out); `refineTrace` takes the renderer as an argument.
 *
 * A trace, frame by frame (`step` seconds a frame, from the sound's onset):
 *   lv      each band's level in dB (-80 silent): the sound's spectral shape moving in time
 *   voiced  how much of the frame is voiced, 0..100: noise where it is air, a sawtooth where it hums
 *   pitch   the hum's pitch in Hz
 *   side    its place, -100 (left) .. 100 (right)
 * A lane that says nothing (no voiced frame, no frame off centre) is left out.
 *
 * `traceSound` reads the levels the analysis sees, not what the synth needs to make them: a bandpass bank over noise
 * and a sawtooth has its own gain per band. `refineTrace` closes the loop: render the trace, trace the render on the
 * same frames, move each level by what it missed, again. The kernel's own constants (bands, q) are mirrored here and
 * held equal by the test.
 */
import { magnitudeSpectrum } from '../beats/audio-measure.js';

export const TRACE_BANDS = Object.freeze([150, 225, 330, 500, 740, 1100, 1640, 2440, 3640, 5420, 8070, 12000]);
export const TRACE_Q = 2;
export const TRACE_STEP = 0.01;
const FLOOR = -80, CEIL = 24, WINDOW = 2048;

const mono = (y) => (Array.isArray(y) ? (y.length > 1 ? y[0].map((v, i) => (v + y[1][i]) / 2) : y[0]) : y);
const clampDb = (v) => Math.max(FLOOR, Math.min(CEIL, Math.round(v)));

// each band's reach: from the geometric midpoint with the band below to the one above; the outer bands reach the ends
// of the spectrum, so every bit of energy the synth makes is counted somewhere and the loop can correct it
function bandEdges(bands, sr) {
  return bands.map((f, i) => [i ? Math.sqrt(bands[i - 1] * f) : 20, i < bands.length - 1 ? Math.sqrt(f * bands[i + 1]) : sr / 2]);
}

// the normalized autocorrelation's best lag in [sr/maxHz, sr/30]: { r, hz }
function periodicity(x, start, n, sr, maxHz = 500) {
  const lo = Math.floor(sr / maxHz), hi = Math.min(n - 64, Math.ceil(sr / 30));
  const f = new Float64Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[start + i] || 0;
  mean /= n;
  for (let i = 0; i < n; i++) f[i] = (x[start + i] || 0) - mean;
  const c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) c[i + 1] = c[i] + f[i] * f[i];
  if (c[n] < 1e-9) return { r: 0, hz: 0 };
  let best = 0, lag = 0;
  const rs = maxHz > 500 ? new Float64Array(hi + 1) : null;
  for (let L = lo; L <= hi; L++) {
    let s = 0;
    for (let i = 0; i + L < n; i++) s += f[i] * f[i + L];
    const r = s / Math.sqrt((c[n - L] - c[0]) * (c[n] - c[L]) + 1e-12);
    if (rs) rs[L] = r;
    if (r > best) { best = r; lag = L; }
  }
  // (a range opened past a voice's: a buzz correlates nearly as well at every multiple of its period, so the first lag
  // within 20 % of the best that is a peak is its period, not the best's multiple; a voice's range keeps the best)
  if (rs) for (let L = lo + 1; L < lag; L++) if (rs[L] >= 0.8 * best && rs[L] >= rs[L - 1] && rs[L] >= rs[L + 1]) { lag = L; break; }
  return { r: best, hz: lag ? sr / lag : 0 };
}

/**
 * The analysis on a frame grid: `F` frames, frame k centred at `start + k * step` seconds. `{ db, voiced, pitch, side }`,
 * each a lane (db: F × bands). The levels are mean power per bin in each band, in dB.
 */
export function analyzeFrames(y, sr, { start = 0, frames, step = TRACE_STEP, bands = TRACE_BANDS, maxHz = 500 } = {}) {
  const m = mono(y), [L, R] = Array.isArray(y) && y.length > 1 ? y : [m, m];
  const edges = bandEdges(bands, sr), half = WINDOW / 2;
  const db = [], voiced = [], pitch = [], side = [];
  for (let k = 0; k < frames; k++) {
    const c = Math.round((start + k * step) * sr), s0 = c - half;
    const mag = magnitudeSpectrum(m, Math.max(0, s0), WINDOW);
    const row = edges.map(([lo, hi]) => {
      let p = 0, nb = 0;
      for (let b = Math.max(1, Math.floor((lo * WINDOW) / sr)); b < Math.min(mag.length, Math.ceil((hi * WINDOW) / sr)); b++) { p += mag[b] * mag[b]; nb++; }
      return nb ? 10 * Math.log10(p / nb + 1e-20) : FLOOR;
    });
    db.push(row);
    const { r, hz } = periodicity(m, Math.max(0, s0), WINDOW, sr, maxHz);
    voiced.push(Math.round(Math.max(0, Math.min(1, (r - 0.35) / 0.4)) * 100));
    pitch.push(Math.round(hz || 100));
    let el = 0, er = 0;
    for (let i = Math.max(0, s0); i < Math.min(m.length, s0 + WINDOW); i++) { el += L[i] * L[i]; er += R[i] * R[i]; }
    side.push(Math.round(((4 / Math.PI) * Math.atan2(Math.sqrt(er), Math.sqrt(el)) - 1) * 100));
  }
  return { db, voiced, pitch, side };
}

const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 0; };

/**
 * A hum held steady: frame by frame the tracker can catch a harmonic (a leap of an octave or more) or flip between air
 * and hum where the voicing is weak, and a sawtooth playing that leaps and the noise under it flutters. The pitch is
 * anchored on the strongly voiced frames' median, a frame more than a third off it is that median, and the rest is
 * median-smoothed over five frames; the voicing is averaged over five frames, a trace of it dropped.
 */
export function steadyHum(voiced, pitch) {
  const strong = pitch.filter((h, k) => voiced[k] >= 60);
  const anchor = median(strong.length ? strong : pitch.filter((h, k) => voiced[k] >= 20));
  const held = pitch.map((h) => (Math.abs(h / anchor - 1) <= 1 / 3 ? h : anchor));
  const near = (xs, k) => xs.slice(Math.max(0, k - 2), k + 3);
  return {
    voiced: voiced.map((v, k) => { const m = Math.round(near(voiced, k).reduce((a, x) => a + x, 0) / near(voiced, k).length); return m < 15 ? 0 : m; }),
    pitch: held.map((h, k) => Math.round(median(near(held, k)))),
  };
}

/**
 * A sound (`y`: one channel, or [left, right]) at `sr` traced into a trace gesture: the frames from its onset to its
 * last sample within `rangeDb` of its peak. The levels are the analysis's, uncalibrated: `refineTrace` makes them the
 * synth's. `voicing: false` traces it as air only: band-limited noise reads as periodic, so a sound made of air says so.
 * `maxHz` is the highest pitch the hum is looked for at (500, a voice's; a bird's buzz is higher): a buzz above it is
 * traced as band noise, which sounds like sandpaper.
 */
export function traceSound(y, sr, { step = TRACE_STEP, bands = TRACE_BANDS, rangeDb = 50, voicing = true, maxHz = 500 } = {}) {
  const m = mono(y);
  let pk = 0;
  for (const v of m) pk = Math.max(pk, Math.abs(v));
  if (!pk) throw new Error('trace: the sound is silent');
  const th = pk * 10 ** (-rangeDb / 20);
  let on = 0, end = m.length - 1;
  while (on < m.length && Math.abs(m[on]) < th) on++;
  while (end > on && Math.abs(m[end]) < th) end--;
  const frames = Math.max(1, Math.ceil((end - on) / (step * sr)) + 1);
  const a = analyzeFrames(y, sr, { start: on / sr, frames, step, bands, maxHz });
  const g = { type: 'trace', step, lv: a.db.map((row) => row.map(clampDb)) };
  if (bands !== TRACE_BANDS) g.bands = [...bands];
  if (voicing && a.voiced.some((v) => v >= 20)) { const h = steadyHum(a.voiced, a.pitch); g.voiced = h.voiced; g.pitch = h.pitch; }
  if (a.side.some((s) => Math.abs(s) >= 5)) g.side = a.side;
  return { gesture: g, onset: on / sr, targets: a.db };
}

/**
 * Close the loop: render the trace (`render(gesture)` → `{ sr, channels }`, the cue at t = 0), trace the render on the
 * same frames, move each level by what it missed. `targets` are the original's levels (traceSound's). Returns the
 * refined gesture and the remaining error (mean |dB| missed, weighted by each cell's energy).
 */
export async function refineTrace(gesture, targets, render, { iterations = 3 } = {}) {
  let g = { ...gesture, lv: gesture.lv.map((r) => [...r]) }, err = Infinity;
  const bands = g.bands || TRACE_BANDS, step = g.step || TRACE_STEP;
  for (let it = 0; it <= iterations; it++) {
    const { sr, channels } = await render(g);
    const got = analyzeFrames(channels.length > 1 ? channels : channels[0], sr, { start: 0, frames: g.lv.length, step, bands }).db;
    let sum = 0, wsum = 0;
    const top = Math.max(...targets.flat());
    const next = g.lv.map((row, k) => row.map((v, i) => {
      if (targets[k][i] < top - 60) return FLOOR;          // below the sound's range: silent
      const miss = targets[k][i] - got[k][i], w = 10 ** ((targets[k][i] - top) / 10);
      sum += Math.abs(miss) * w; wsum += w;
      return clampDb(v + miss);
    }));
    err = wsum ? sum / wsum : 0;                           // weighted by energy: the loud cells are what is heard
    if (it === iterations) break;
    g = { ...g, lv: next };
  }
  return { gesture: g, error: Math.round(err * 10) / 10 };
}
