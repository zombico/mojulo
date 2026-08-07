/**
 * beats-song-choir — the LOCKED choir capability distilled from the
 * "Making of a Cyborg" spike line (render-cyborg → …-choir → …-phrasing →
 * …-choir-echo → …-production, 2026-07-15; retrospectives in
 * beats-song.plan.md). What survived the operator's ears is pinned here as
 * the "descratch3" presets; the render loop and echo are generic.
 *
 * The realism trick the score taught: a choir is many SLIGHTLY-DIFFERENT
 * voices — one locked voice de-locked per singer (detune / timing /
 * vocal-tract size / vibrato phase), NOT one voice duplicated. Placement is
 * ABSOLUTE-ONSET (sync-safe against a gridded beats bed): phrase-tuning may
 * stretch a note's SUSTAIN, never its onset.
 *
 * Seeded dice only (each note's seed derives from seedBase/voice/note index);
 * same inputs → byte-identical output.
 */

import { renderParametricNote, CONSONANTS } from './beats-song-voice-parametric.js';
import { lowpass1 } from './beats-song-dsp.js';

/**
 * Three-tier consonant hardness (descratch3): sustained consonants pushed hard
 * (they carry the chant), stops/fricatives restrained (they scratch at choir
 * density). Returns the per-consonant emphasis map renderParametricNote takes.
 */
export function tieredConsonantEmphasis({ sustained = 3.0, stop = 1.2, other = 1.1 } = {}) {
  const SUSTAINED = new Set(['m', 'n', 'r', 'w', 'y']);
  const STOP = new Set(['g', 'b', 'd', 'k', 't', 'p', 'ts', 'ch']);
  return Object.fromEntries(Object.entries(CONSONANTS).map(([k, s]) => [
    k, (s.emph ?? 1) * (SUSTAINED.has(k) ? sustained : STOP.has(k) ? stop : other),
  ]));
}

/** The locked 3-voice de-lock (descratch3): tight stagger, distinct tracts + vibrato phases. */
export const DESCRATCH3_VOICES = [
  { detuneCents: +5, timeMs: 0, formantScale: 0.98, vib: { depth: 0.26, rate: 5.1, delay: 0.42 } },
  { detuneCents: -7, timeMs: 6, formantScale: 1.02, vib: { depth: 0.30, rate: 5.6, delay: 0.50 } },
  { detuneCents: -12, timeMs: 11, formantScale: 1.06, vib: { depth: 0.24, rate: 4.8, delay: 0.58 } },
];

/** The locked dark echo (descratch3): long damped feedback, wet under the dry. */
export const DESCRATCH3_ECHO = { time: 0.42, feedback: 0.40, wet: 0.38, damp: 2200 };

/**
 * Phrase hold-weight → a bounded duration factor (the operator's phrasing as a
 * light TUNING layer, never a re-timing). Weight 3 is neutral.
 */
export function holdFactor(weight, { strength = 0.10, lo = 0.80, hi = 1.25 } = {}) {
  return Math.max(lo, Math.min(hi, 1 + strength * (weight - 3)));
}

/**
 * Render de-locked voices over absolute-onset sung notes into one mono buffer.
 * @param {Array} sung  [{ onsetSec, durSec, note, kata }] (kata = authorSyllable output)
 * @param {object} opts  { sr, lengthSec, voices=DESCRATCH3_VOICES, emphasis,
 *   consonantGain=1.2, seedBase=0x50f6, expression:{swell,attack,release} }
 * @returns {Float32Array} un-normalized choir sum (caller normalizes/mixes)
 */
export function renderChoirAbsolute(sung, {
  sr, lengthSec, voices = DESCRATCH3_VOICES, emphasis, consonantGain = 1.2,
  seedBase = 0x50f6, expression = { swell: 0.28, attack: 0.05, release: 0.14 },
} = {}) {
  if (!sr) throw new Error('beats-song-choir: renderChoirAbsolute requires { sr }');
  const nOut = Math.ceil((lengthSec ?? (Math.max(...sung.map((s) => s.onsetSec + s.durSec)) + 2.5)) * sr);
  const out = new Float32Array(nOut);
  voices.forEach((v, vi) => {
    const off = Math.round(((v.timeMs || 0) / 1000) * sr);
    sung.forEach((s, ni) => {
      const data = renderParametricNote(s.kata, s.note, s.durSec, {
        sr,
        seed: (seedBase + vi * 0x1111 + ni * 0x9e37) >>> 0,
        detuneCents: v.detuneCents,
        formantScale: v.formantScale,
        emphasis,
        consonantGain,
        expression: { vibrato: v.vib, ...expression },
      });
      const start = Math.round(s.onsetSec * sr) + off;
      for (let i = 0; i < data.length && start + i < nOut; i += 1) out[start + i] += data[i];
    });
  });
  return out;
}

/**
 * Dark feedback echo: damped delay line fed back on itself, wet mixed under
 * the dry. `damp` (Hz) lowpasses the wet path so repeats recede into dark.
 */
export function feedbackEcho(dry, sr, { time, feedback, wet, damp } = {}) {
  const D = Math.round(time * sr);
  const N = dry.length;
  const wetBuf = new Float32Array(N);
  for (let i = D; i < N; i += 1) wetBuf[i] = wetBuf[i - D] * feedback + (i - D < dry.length ? dry[i - D] : 0);
  const wd = damp ? lowpass1(wetBuf, sr, damp) : wetBuf;
  const o = new Float32Array(N);
  for (let i = 0; i < N; i += 1) o[i] = dry[i] + wet * wd[i];
  return o;
}
