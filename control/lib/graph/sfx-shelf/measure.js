/**
 * sfx-shelf/measure — the yardstick a shelf sound is held to: the machine gate's numbers for one rendered cue. None
 * of them is an ears gate.
 *
 *   layers      the gestures the cue stacks (from the recipe): one voice is a blip, a realistic sound several
 *   ms          how long it sounds: onset to the last sample within 40 dB of its peak
 *   centroidHz  the attack's brightness: the spectral centroid of the first 4096 samples from the onset
 *   crestDb     peak over RMS across the sound: how much punch stands over its body
 *   bands       the share of its energy in each band (BANDS) across the whole sound: a full sound spreads, a thin one
 *               sits in one
 *   spread      how many bands it fills, 1 to 4: the inverse of the bands' summed squared shares
 *   width       how wide it is: 1 − the correlation of left and right (0: mono)
 *
 * The length, the attack and the crest are read off the mid (left plus right, halved); the bands off both channels'
 * power, so a panned layer counts once and in full. `measureSound`
 * is pure (samples in, numbers out). `renderSound` renders a cue the way an export does (beats-render's offline path,
 * the kernel's own engine), so what is measured is what ships. `meetsFloor` holds a better voice to the one it
 * improves on.
 */
import { centroid, bandEnergy, rms, peak, decodeWav, lrCorrelation } from '../beats/audio-measure.js';
import { renderBeatsOffline } from '../beats/beats-render.js';

/** The bands a sound's energy is split across (Hz, [lo, hi)). */
export const BANDS = Object.freeze({ sub: [20, 120], low: [120, 500], mid: [500, 3000], high: [3000, 20000] });

const FRAME = 4096;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * The numbers of a sound at `sr`: `y` is one channel (a Float32Array) or [left, right]. `layers` is the cue's gesture
 * count (the recipe's, not the render's).
 */
export function measureSound(y, sr, { layers = null } = {}) {
  const [L, R] = Array.isArray(y) ? (y.length > 1 ? y : [y[0], y[0]]) : [y, y];
  const m = L === R ? L : L.map((v, i) => (v + R[i]) / 2);
  const pk = peak(m);
  if (!pk) return { layers, ms: 0, centroidHz: 0, crestDb: 0, bands: Object.fromEntries(Object.keys(BANDS).map((b) => [b, 0])), spread: 0, width: 0 };
  const floor = pk * 0.01;
  let on = 0, end = 0;
  while (on < m.length && Math.abs(m[on]) < floor) on++;
  for (let i = m.length - 1; i >= 0; i--) if (Math.abs(m[i]) >= floor) { end = i + 1; break; }
  const e = Object.fromEntries(Object.keys(BANDS).map((b) => [b, 0]));
  // energy is both channels' power: a panned layer moves between them and loses none (the mid would lose it)
  for (let s = on; s < end; s += FRAME) for (const [b, [lo, hi]] of Object.entries(BANDS)) e[b] += bandEnergy(L, sr, s, FRAME, lo, hi) + (L === R ? bandEnergy(L, sr, s, FRAME, lo, hi) : bandEnergy(R, sr, s, FRAME, lo, hi));
  const total = Object.values(e).reduce((a, v) => a + v, 0) || 1;
  const shares = Object.values(e).map((v) => v / total);
  return {
    layers,
    ms: Math.round(((end - on) / sr) * 1000),
    centroidHz: Math.round(centroid(m, sr, on, FRAME)),
    crestDb: r2(20 * Math.log10(pk / (rms(m, on, end) || 1e-12))),
    bands: Object.fromEntries(Object.entries(e).map(([b, v]) => [b, r2(v / total)])),
    spread: r2(1 / shares.reduce((a, p) => a + p * p, 0)),
    width: L === R ? 0 : r2(Math.max(0, 1 - lrCorrelation(L.subarray(on, end), R.subarray(on, end)))),
  };
}

/**
 * Render one cue of a beats-sfx manifest offline and measure it: `{ ...measureSound, wav }`. `variant` is the per-hit
 * variant (0: the cue itself); `far` (0..1) places it at a distance, and a manifest's `mix` puts it in a space (the SFX
 * mixer). Lazy-loads the native audio backend through beats-render.
 */
export async function renderSound(manifest, cue, { variant = 0, far = 0, sampleRate = 44100 } = {}) {
  const { wav } = await renderBeatsOffline(manifest, { cue, tail: 0.5, sampleRate, ...(variant ? { variant } : {}), ...(far ? { far } : {}) });
  const { sr, channels } = decodeWav(wav);
  return { ...measureSound(channels, sr, { layers: manifest.cues[cue].length }), wav };
}

/**
 * How far a measure is off another on the yardstick, as readable lines (none: within tolerance). The layers exact, the
 * rest near: a render differs by a hair across CPUs and runtimes.
 */
export function nearBaseline(m, b) {
  if (!b || !b.bands) return ['no baseline'];
  const off = [];
  if (m.layers !== b.layers) off.push(`layers ${m.layers} ≠ ${b.layers}`);
  if (Math.abs(m.ms - b.ms) > Math.max(3, b.ms * 0.03)) off.push(`ms ${m.ms} vs ${b.ms}`);
  if (Math.abs(m.centroidHz - b.centroidHz) > Math.max(40, b.centroidHz * 0.03)) off.push(`centroid ${m.centroidHz} vs ${b.centroidHz}`);
  if (Math.abs(m.crestDb - b.crestDb) > 0.3) off.push(`crest ${m.crestDb} vs ${b.crestDb}`);
  for (const k of Object.keys(BANDS)) if (Math.abs(m.bands[k] - b.bands[k]) > 0.02) off.push(`${k} ${m.bands[k]} vs ${b.bands[k]}`);
  for (const k of ['spread', 'width']) if (Math.abs(m[k] - b[k]) > 0.05) off.push(`${k} ${m[k]} vs ${b[k]}`);
  return off;
}

/**
 * The floor law: what a better voice of a sound must keep of the voice it improves on, as readable lines (none: it
 * meets its floor). It stacks at least as many layers; it fills at least as many bands, or stays full where the floor
 * already was (`full`: 2.5 of the 4); it keeps its punch (crest at most 3 dB under) and at least 80 % of its length;
 * and it stays the same sound: an attack within half to twice as bright, at most four times as long. Measured dry (no space): the sound itself, not the room a level puts it in. A machine
 * gate: whether it is better is the ears'.
 */
export const FLOOR_LAW = Object.freeze({ crestDrop: 3, minLength: 0.8, maxLength: 4, brightness: [0.5, 2], spreadSlack: 0.05, full: 2.5 });
export function meetsFloor(m, f) {
  if (!f || !f.bands) return ['no floor'];
  const L = FLOOR_LAW, off = [];
  if (m.layers < f.layers) off.push(`layers ${m.layers} < ${f.layers}`);
  if (m.spread < Math.min(f.spread, L.full) - L.spreadSlack) off.push(`spread ${m.spread} < ${Math.min(f.spread, L.full)}`);
  if (m.crestDb < f.crestDb - L.crestDrop) off.push(`crest ${m.crestDb} dB, more than ${L.crestDrop} dB under ${f.crestDb}`);
  if (m.ms < f.ms * L.minLength) off.push(`length ${m.ms} ms, under ${L.minLength} × ${f.ms}`);
  if (m.ms > f.ms * L.maxLength) off.push(`length ${m.ms} ms, over ${L.maxLength} × ${f.ms}: another sound`);
  if (m.centroidHz < f.centroidHz * L.brightness[0] || m.centroidHz > f.centroidHz * L.brightness[1]) off.push(`attack ${m.centroidHz} Hz against ${f.centroidHz}: another sound`);
  return off;
}
