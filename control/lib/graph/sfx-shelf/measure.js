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
 *
 * `measureSound` is pure (Float32Array in, numbers out). `renderSound` renders a cue the way an export does
 * (beats-render's offline path, the kernel's own engine), so what is measured is what ships.
 */
import { centroid, bandEnergy, rms, peak, decodeWav } from '../beats/audio-measure.js';
import { renderBeatsOffline } from '../beats/beats-render.js';

/** The bands a sound's energy is split across (Hz, [lo, hi)). */
export const BANDS = Object.freeze({ sub: [20, 120], low: [120, 500], mid: [500, 3000], high: [3000, 20000] });

const FRAME = 4096;
const r2 = (v) => Math.round(v * 100) / 100;

/** The numbers of a mono signal `y` at `sr`; `layers` is the cue's gesture count (the recipe's, not the render's). */
export function measureSound(y, sr, { layers = null } = {}) {
  const pk = peak(y);
  if (!pk) return { layers, ms: 0, centroidHz: 0, crestDb: 0, bands: Object.fromEntries(Object.keys(BANDS).map((b) => [b, 0])) };
  const floor = pk * 0.01;
  let on = 0, end = 0;
  while (on < y.length && Math.abs(y[on]) < floor) on++;
  for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i]) >= floor) { end = i + 1; break; }
  const e = Object.fromEntries(Object.keys(BANDS).map((b) => [b, 0]));
  for (let s = on; s < end; s += FRAME) for (const [b, [lo, hi]] of Object.entries(BANDS)) e[b] += bandEnergy(y, sr, s, FRAME, lo, hi);
  const total = Object.values(e).reduce((a, v) => a + v, 0) || 1;
  return {
    layers,
    ms: Math.round(((end - on) / sr) * 1000),
    centroidHz: Math.round(centroid(y, sr, on, FRAME)),
    crestDb: r2(20 * Math.log10(pk / (rms(y, on, end) || 1e-12))),
    bands: Object.fromEntries(Object.entries(e).map(([b, v]) => [b, r2(v / total)])),
  };
}

/**
 * Render one cue of a beats-sfx manifest offline and measure it: `{ ...measureSound, wav }`. `variant` is the per-hit
 * variant (0: the cue itself). Lazy-loads the native audio backend through beats-render.
 */
export async function renderSound(manifest, cue, { variant = 0, sampleRate = 44100 } = {}) {
  const { wav } = await renderBeatsOffline(manifest, { cue, tail: 0.5, sampleRate, ...(variant ? { variant } : {}) });
  const { sr, channels } = decodeWav(wav);
  return { ...measureSound(channels[0], sr, { layers: manifest.cues[cue].length }), wav };
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
  return off;
}
