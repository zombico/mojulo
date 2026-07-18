/**
 * beats-song-voice-parametric.js — the LOCKED-VOICE L3 engine (the parametric fork).
 *
 * A Klatt-style formant synthesizer: a synthetic glottal source excited through a
 * cascade of formant resonators tuned to FIXED F1/F2/F3 targets per vowel. Because
 * the vocal tract is a fixed parameter set, the singer is ONE voice BY
 * CONSTRUCTION — no Kokoro sampling, no call-to-call formant drift, deterministic
 * and measurable. This is the fork the plan took (beats-song.plan.md, "The
 * parametric fork"): the aesthetic is a deliberately synthetic vocaloid.
 *
 * ENUNCIATION comes from a mora-level consonant model (beats-song-phonemes.js
 * decomposes the katakana): every consonant is articulated by class — fricatives
 * as spectrally-shaped noise, stops as a closure gap + burst, nasals/codas as a
 * low murmur, glides as a formant locus that morphs into the vowel. Crude by the
 * fork's design, but real consonants at every position, not a hiss at the front.
 *
 * The L3 contract: `(kata syllable, note pitch, duration, expression) → mono audio`,
 * consuming the SAME L5 katakana the authoring layer emits (beats-song-lyrics.js).
 * Pure + deterministic: seeded dice only (mulberry32), no IO.
 */

import { mulberry32, noiseSrc, normalizePeak, noteHz, highpass, bandpass, biquad, lowpass1 } from './beats-song-dsp.js';
import { romanizeKata } from './beats-song-phonemes.js';

// ── the one vocal tract: female/high vowel formants (Hz), brightened ─────────
// Fixed targets = one singer by construction. Set female and a touch high for a
// bright synthetic soprano; the operator's ears tune these, not a measure.
export const FEMALE_VOWEL_FORMANTS = {
  ア: [800, 1400, 2700],   // a — open
  イ: [350, 2600, 3200],   // i — close front, bright (high F2)
  ウ: [380, 1050, 2500],   // u — close back (JA u is fairly central)
  エ: [500, 2100, 2900],   // e — mid front
  オ: [520, 900, 2600],    // o — mid back
};
export const FORMANT_BW = [80, 100, 140];

// Nasal murmur pole set (m/n/coda) and glide loci that morph into the vowel. A
// glide's cue is the formant TRANSITION, not loudness — so the loci are deep and
// distinctive: w = strong lip-rounding (low F1, very low F2); r = the English
// bunched-r signature (low F3 near F2); y = palatal (very high F2). The engine
// HOLDS at the locus before gliding into the vowel so the movement is audible.
export const NASAL_FORMANTS = [260, 1000, 2200];
export const GLIDE_LOCI = { w: [300, 610, 2150], y: [270, 2400, 3100], r: [330, 1000, 1500] };

// ── consonant articulation specs ──────────────────────────────────────────────
// dur/closure/fricTail in seconds; filt/burst are shaped-noise band specs; amp is
// the noise level; voiced keeps some glottal tone under the consonant. Operator-
// tunable — this table IS the enunciation knob for the parametric voice.
// Per-consonant articulation. `emph` is the MANUAL emphasis knob (default 1): it
// scales the fricative/stop noise level, or the nasal/glide murmur gain — dial any
// consonant up until it reads. Nasals (m/n) start emphasized and long because a
// murmur is intrinsically the softest, weakest cue (M was vanishing: "diamond" →
// "diafond"). Override live per render via `opts.emphasis = { m: 2.2, ... }`.
// `emph` calibrated against M=2.0 (the operator-approved reference): the weaker a
// consonant's intrinsic cue, the higher its emphasis. Sibilants (s/sh) are strong
// broadband noise → least; non-sibilant fricatives (f/h), voiced stops (g/d/b),
// nasals, and glides are the weakest cues → most.
export const CONSONANTS = {
  s:  { cls: 'fric', dur: 0.095, filt: { type: 'hp', f: 5500 }, amp: 0.5, voiced: false, emph: 1.2 },
  sh: { cls: 'fric', dur: 0.090, filt: { type: 'bp', f: 2800, q: 2.0 }, amp: 0.5, voiced: false, emph: 1.2 },
  f:  { cls: 'fric', dur: 0.070, filt: { type: 'bp', f: 1800, q: 1.0 }, amp: 0.38, voiced: false, emph: 1.8 },
  h:  { cls: 'fric', dur: 0.060, filt: { type: 'bp', f: 1400, q: 0.7 }, amp: 0.32, voiced: false, emph: 1.6 },
  z:  { cls: 'fric', dur: 0.070, filt: { type: 'hp', f: 5000 }, amp: 0.42, voiced: true, emph: 1.5 },
  j:  { cls: 'fric', dur: 0.075, filt: { type: 'bp', f: 2800, q: 2.0 }, amp: 0.42, voiced: true, emph: 1.5 },
  k:  { cls: 'stop', closure: 0.032, burst: { type: 'bp', f: 1800, q: 1.6 }, amp: 0.55, voiced: false, aspiration: 0.032, emph: 1.6 },
  t:  { cls: 'stop', closure: 0.028, burst: { type: 'hp', f: 3800 }, amp: 0.55, voiced: false, aspiration: 0.028, emph: 1.6 },
  p:  { cls: 'stop', closure: 0.028, burst: { type: 'lp', f: 1200 }, amp: 0.50, voiced: false, aspiration: 0.026, emph: 1.7 },
  ts: { cls: 'stop', closure: 0.026, burst: { type: 'hp', f: 4800 }, amp: 0.5, voiced: false, aspiration: 0.045, emph: 1.5 },
  ch: { cls: 'stop', closure: 0.026, burst: { type: 'bp', f: 3000, q: 2 }, amp: 0.5, voiced: false, aspiration: 0.040, emph: 1.5 },
  g:  { cls: 'stop', closure: 0.018, burst: { type: 'bp', f: 1800, q: 1.6 }, amp: 0.42, voiced: true, emph: 1.9 },
  d:  { cls: 'stop', closure: 0.016, burst: { type: 'hp', f: 3000 }, amp: 0.42, voiced: true, emph: 1.9 },
  b:  { cls: 'stop', closure: 0.016, burst: { type: 'lp', f: 1200 }, amp: 0.42, voiced: true, emph: 2.0 },
  n:  { cls: 'nasal', dur: 0.075, emph: 1.8 },
  m:  { cls: 'nasal', dur: 0.085, emph: 2.0 },
  // glides: longer, with a `hold` fraction spent parked at the locus before gliding
  // into the vowel (the transition is the cue; brief glides were inaudible). `dip`
  // is the amplitude constriction through the hold: a Japanese ラ行 /r/ is an alveolar
  // TAP, whose defining cue is a brief near-closure (an amplitude notch), NOT a smooth
  // formant slur — without it, R melted into the vowel and vanished. w/y are true
  // approximants (little constriction) so they barely dip.
  r:  { cls: 'glide', dur: 0.055, hold: 0.45, dip: 0.28, emph: 1.7 },
  w:  { cls: 'glide', dur: 0.072, hold: 0.55, dip: 0.72, emph: 1.6 },
  y:  { cls: 'glide', dur: 0.052, hold: 0.45, dip: 0.72, emph: 1.5 },
};

/** Resolve a consonant key, falling back a palatalized 'ky'/'ny' onto its base. */
function consSpec(key) {
  if (!key) return null;
  if (CONSONANTS[key]) return CONSONANTS[key];
  if (key.endsWith('y') && CONSONANTS[key.slice(0, -1)]) return CONSONANTS[key.slice(0, -1)];
  return null;
}

// ── glottal source: a Rosenberg pulse train with vibrato (L4 expression) ─────
export function glottalSource(len, sr, f0Base, { vibrato = null } = {}) {
  const out = new Float32Array(len);
  let period = sr / f0Base, pos = 0;
  for (let i = 0; i < len; i++) {
    if (pos >= period) {
      pos -= period;
      const t = i / sr;
      let hz = f0Base;
      if (vibrato) {
        const on = Math.min(1, Math.max(0, (t - (vibrato.delay ?? 0.35)) / 0.3));
        hz = f0Base * Math.pow(2, (vibrato.depth * on * Math.sin(2 * Math.PI * (vibrato.rate ?? 5.5) * t)) / 12);
      }
      period = sr / hz;
    }
    const frac = pos / period, T1 = 0.4, T2 = 0.16;
    let g = 0;
    if (frac < T1) g = 0.5 * (1 - Math.cos((Math.PI * frac) / T1));
    else if (frac < T1 + T2) g = Math.cos((Math.PI * (frac - T1)) / (2 * T2));
    out[i] = g;
    pos += 1;
  }
  let mean = 0;
  for (const v of out) mean += v;
  mean /= len || 1;
  for (let i = 0; i < len; i++) out[i] -= mean;
  return out;
}

// ── time-varying Klatt resonator (per-sample centre freq for vowel morphing) ──
export function resonatorTV(x, sr, freqAt, bw) {
  const out = new Float32Array(x.length);
  const r = Math.exp((-Math.PI * bw) / sr), r2 = r * r;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const theta = (2 * Math.PI * freqAt[i]) / sr;
    const b1 = 2 * r * Math.cos(theta), b2 = -r2, a0 = 1 - b1 - b2;
    const y = a0 * x[i] + b1 * y1 + b2 * y2;
    y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}

/** Shaped noise for a fricative/burst: white noise through a band spec, peak `amp`. */
function shapedNoise(len, sr, rng, filt, amp) {
  let n = noiseSrc(len, rng);
  if (filt.type === 'hp') n = biquad(n, highpass(sr, filt.f, filt.q || 0.8));
  else if (filt.type === 'bp') n = biquad(n, bandpass(sr, filt.f, filt.q || 2));
  else if (filt.type === 'lp') n = lowpass1(n, sr, filt.f);
  return normalizePeak(n, amp);
}

// ── the mora → articulation timeline ──────────────────────────────────────────
// Lays consonant and vowel regions end to end, filling per-sample formant tracks
// (F1/F2/F3) and a voiced-gain track, and collecting noise/burst events. Formant
// and gain steps are smoothed afterward so vowels morph and there are no clicks.
function buildTimeline(moras, durSec, sr, formants, emphasis = {}) {
  const len = Math.max(1, Math.floor(durSec * sr));
  const emphOf = (cons, spec) => (emphasis[cons] ?? spec.emph ?? 1);

  // consonant time budget per mora, then share the rest across the vowels
  const cBudget = moras.map((m) => {
    const c = consSpec(m.cons);
    if (!c) return 0;
    if (c.cls === 'stop') return c.closure + 0.012 + (c.aspiration || 0);
    return c.dur;
  });
  let cSum = cBudget.reduce((a, b) => a + b, 0);
  const cCap = 0.6 * durSec;
  if (cSum > cCap && cSum > 0) { const k = cCap / cSum; for (let i = 0; i < cBudget.length; i++) cBudget[i] *= k; cSum = cCap; }
  const vTotal = Math.max(sr > 0 ? 0.02 : 0, durSec - cSum);
  const vEach = vTotal / moras.length;

  const F = [new Float32Array(len), new Float32Array(len), new Float32Array(len)];
  const gain = new Float32Array(len).fill(1);
  const noiseEvents = [];   // { start, len, filt, amp, fadeToVowel }   — unvoiced, added on top
  const bursts = [];        // { at, filt, amp }                        — stop releases, added on top
  const voicedBoosts = [];  // { start, end, mul } — voiced murmurs/glides boosted post-normalize

  const setF = (from, to, vec) => { for (let i = Math.max(0, from); i < Math.min(len, to); i++) { F[0][i] = vec[0]; F[1][i] = vec[1]; F[2][i] = vec[2]; } };
  const setGain = (from, to, val) => { for (let i = Math.max(0, from); i < Math.min(len, to); i++) gain[i] = val; };

  let pos = 0;
  moras.forEach((m, mi) => {
    const vowel = formants[m.vowel] || formants['ア'];
    const cLen = Math.round(cBudget[mi] * sr);
    const vLen = mi === moras.length - 1 ? len - (pos + cLen) : Math.round(vEach * sr);
    const cStart = pos, vStart = pos + cLen, vEnd = vStart + vLen;
    const spec = consSpec(m.cons);
    const e = spec ? emphOf(m.cons, spec) : 1;

    if (spec && cLen > 0) {
      if (spec.cls === 'fric') {
        setF(cStart, vStart, vowel);
        setGain(cStart, vStart, spec.voiced ? 0.5 : 0.12);
        noiseEvents.push({ start: cStart, len: cLen, filt: spec.filt, amp: spec.amp * e, fadeToVowel: true });
      } else if (spec.cls === 'stop') {
        const closN = Math.round(spec.closure * sr);
        setF(cStart, vStart, vowel);
        setGain(cStart, cStart + closN, spec.voiced ? 0.15 : 0.0);   // closure
        bursts.push({ at: cStart + closN, filt: spec.burst, amp: spec.amp * e });
        // aspiration: a short breathy tail after the burst (the puff of a voiceless
        // stop) — the single biggest cue that makes a brief stop legible.
        if (spec.aspiration) noiseEvents.push({ start: cStart + closN + Math.round(0.008 * sr), len: Math.round(spec.aspiration * sr), filt: { type: spec.burst.type, f: spec.burst.f, q: spec.burst.q }, amp: spec.amp * 0.7 * e, fadeToVowel: true });
      } else if (spec.cls === 'nasal') {
        // Voiced low murmur; boosted AFTER the vowel-body normalize (voicedBoosts)
        // so emphasis makes it pop without ducking the vowel via peak-normalize.
        setF(cStart, vStart, NASAL_FORMANTS);
        setGain(cStart, vStart, 0.85);
        voicedBoosts.push({ start: cStart, end: vStart, mul: e });
      } else if (spec.cls === 'glide') {
        // Hold at the deep locus for `hold` of the region so the ear registers the
        // glide's shape, THEN transition into the vowel over the remainder. The
        // formant EXCURSION is the cue; emphasis (voicedBoosts) is only a light lift.
        const locus = GLIDE_LOCI[m.cons] || GLIDE_LOCI[(m.cons || '').replace(/y$/, '')] || vowel;
        const cN = Math.max(1, vStart - cStart), holdN = Math.floor(cN * (spec.hold ?? 0.5));
        const dip = spec.dip ?? 0.72;
        for (let i = cStart; i < vStart && i < len; i++) {
          const u = i < cStart + holdN ? 0 : (i - (cStart + holdN)) / Math.max(1, cN - holdN);
          for (let k = 0; k < 3; k++) F[k][i] = locus[k] * (1 - u) + vowel[k] * u;
          // amplitude constriction: a V-notch through the hold (deepest mid-hold),
          // recovering as the formants glide into the vowel. This is the tap/flap
          // cue — a brief near-closure — that a pure formant slur was missing.
          let notch = 1;
          if (i < cStart + holdN) { const h = holdN > 1 ? (i - cStart) / (holdN - 1) : 0.5; notch = 1 - (1 - dip) * Math.sin(Math.PI * h); }
          gain[i] = (0.78 + 0.22 * u) * notch;   // voiced, slightly under the vowel, dipped at the tap
        }
        voicedBoosts.push({ start: cStart, end: vStart, mul: e });
      }
    }

    // the vowel body
    setF(vStart, vEnd, vowel);
    // gently duck the vowel ONSET after an obstruent so the consonant isn't masked
    // (softened: floor 0.5 over ~25ms — the harder duck muddied the vowel).
    if (spec && cLen > 0 && (spec.cls === 'fric' || spec.cls === 'stop')) {
      const rampN = Math.min(Math.round(0.025 * sr), Math.floor(vLen * 0.5));
      for (let i = vStart; i < vStart + rampN && i < len; i++) gain[i] = 0.5 + 0.5 * ((i - vStart) / Math.max(1, rampN));
    }

    // moraic-nasal coda: colour the tail toward the nasal pole and boost that
    // murmur (emphasized like an onset nasal — the "-n" of twin/won).
    if (m.coda === 'n') {
      const codaN = Math.min(Math.round(0.055 * sr), Math.floor(vLen * 0.45));
      for (let i = vEnd - codaN; i < vEnd && i < len; i++) { const u = (i - (vEnd - codaN)) / Math.max(1, codaN); for (let k = 0; k < 3; k++) F[k][i] = vowel[k] * (1 - u) + NASAL_FORMANTS[k] * u; gain[i] = 1 - 0.15 * u; }
      voicedBoosts.push({ start: vEnd - codaN, end: vEnd, mul: (emphasis['n'] ?? CONSONANTS.n.emph) });
    }
    pos = vEnd;
  });
  // fill any tail and smooth steps into glides (formants ~45Hz, gain ~180Hz)
  if (pos < len) setF(pos, len, formants[moras[moras.length - 1].vowel] || formants['ア']);
  const Fs = F.map((tr) => lowpass1(tr, sr, 45));
  const gs = lowpass1(gain, sr, 180);
  return { len, F: Fs, gain: gs, noiseEvents, bursts, voicedBoosts };
}

// ── render one sung note ──────────────────────────────────────────────────────
/**
 * `(kata, hz|note, durSec) → Float32Array` at `sr`. One phase-continuous glottal
 * source at the note pitch, cascaded through three resonators whose targets follow
 * the mora timeline, with consonant noise/bursts spliced in and an amplitude
 * envelope (attack, optional belt swell, release).
 */
export function renderParametricNote(kata, pitch, durSec, opts = {}) {
  const { sr = 24000, seed = 1, expression = {}, formants = FEMALE_VOWEL_FORMANTS, consonantGain = 1.3, emphasis = {}, detuneCents = 0, formantScale = 1 } = opts;
  // detune (cents) re-pitches the whole note; formantScale re-sizes the vocal tract
  // (bigger tract = lower formants). Both are the choir levers: the SAME locked
  // voice de-locked slightly per singer so N voices read as a section, not a clone.
  const hz = noteHz(pitch) * Math.pow(2, detuneCents / 1200);
  const rng = mulberry32(seed >>> 0);
  const moras = romanizeKata(kata);
  const tl = buildTimeline(moras, durSec, sr, formants, emphasis);
  const len = tl.len;
  if (formantScale !== 1) for (let k = 0; k < 3; k++) for (let i = 0; i < len; i++) tl.F[k][i] *= formantScale;

  // voiced tract: glottal source → the three time-varying formant resonators
  let sig = glottalSource(len, sr, hz, expression);
  for (let k = 0; k < 3; k++) sig = resonatorTV(sig, sr, tl.F[k], FORMANT_BW[k]);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = sig[i] * tl.gain[i];
  // Fix the VOICED (vowel) body at a fixed level FIRST, so the consonants added
  // next sit at an absolute level relative to it — not divided away by the vowel
  // peak (a global peak-normalize made `consonantGain` inert; see the plan).
  normalizePeak(out, 0.62);
  // Boost voiced consonants (nasal murmurs, glide transitions, codas) AFTER the
  // normalize so their emphasis pops without the peak-normalize ducking the vowels
  // — the "emphasis by decoupling" principle for the voiced consonant classes.
  for (const nr of tl.voicedBoosts) for (let i = nr.start; i < nr.end && i < len; i++) out[i] *= nr.mul;

  // splice consonant noise (fricatives) and bursts (stop releases) at absolute
  // level. `consonantGain` is now a real ratio control against the fixed vowel body.
  for (const ev of tl.noiseEvents) {
    const nz = shapedNoise(ev.len, sr, rng, ev.filt, ev.amp);
    for (let j = 0; j < ev.len && ev.start + j < len; j++) {
      const w = ev.fadeToVowel ? 1 - j / ev.len : 1;   // fricative fades into the vowel
      out[ev.start + j] += nz[j] * (0.4 + 0.6 * w) * consonantGain;
    }
  }
  for (const b of tl.bursts) {
    const bl = Math.round(0.012 * sr), nz = shapedNoise(bl, sr, rng, b.filt, b.amp);
    for (let j = 0; j < bl && b.at + j < len; j++) out[b.at + j] += nz[j] * Math.exp(-j / (bl * 0.4)) * consonantGain;
  }

  // amplitude envelope: attack, optional belt swell, release
  const { attack = 0.02, release = 0.06, swell = 0 } = expression;
  // A VOICED onset consonant (a ラ行 tap or a leading nasal) lives in the glottal
  // tract, so — unlike a fricative/stop, which is spliced on top and escapes the
  // envelope — it rides UNDER the attack ramp and gets masked (this is why R
  // "wasn't pronounced"). Snap the attack short for a voiced-lead note so the
  // consonant is articulated at onset instead of ramped away.
  const leadSpec = consSpec(moras[0] && moras[0].cons);
  const voicedLead = leadSpec && (leadSpec.cls === 'glide' || leadSpec.cls === 'nasal');
  const attackEff = voicedLead ? Math.min(attack, 0.006) : attack;
  const aN = Math.min(len, Math.floor(attackEff * sr)), rN = Math.min(len, Math.floor(release * sr));
  for (let i = 0; i < len; i++) {
    let env = 1;
    if (i < aN) env = i / aN;
    else if (i > len - rN) env = (len - i) / rN;
    if (swell > 0) { const t = i / len; env *= 1 + swell * Math.min(1, t / 0.65) * (t < 0.65 ? 1 : (1 - t) / 0.35); }
    out[i] *= env;
  }
  // Soft-limit: transparent below the knee (0.72) so the vowel body stays clean,
  // only rounding off consonant/nasal overshoots — the harsh full-range tanh muddied
  // the vowels. Keeps the signal within [-1, 1].
  const knee = 0.72;
  for (let i = 0; i < len; i++) {
    const ax = Math.abs(out[i]);
    if (ax > knee) out[i] = Math.sign(out[i]) * (knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee)));
  }
  return out;
}

// ── sequence a whole authored score into one mono track ───────────────────────
/**
 * Render an authored score (from `authorScore`: `{ note, durSec, kata }[]`) into a
 * single mono Float32Array. Notes are laid end to end; `seed` seeds the first note
 * and each subsequent note derives deterministically.
 */
export function renderParametricSong(score, opts = {}) {
  const { sr = 24000, seed = 0x50f6, expression = {}, tail = 0.5, consonantGain = 1.3, emphasis = {}, detuneCents = 0, formantScale = 1 } = opts;
  const totalSec = score.reduce((t, ev) => t + ev.durSec, 0) + tail;
  const total = Math.max(1, Math.ceil(totalSec * sr));
  const out = new Float32Array(total);
  let t = 0, n = 0;
  for (const ev of score) {
    if (!ev.isRest) {   // a rest just advances the clock — silence, no render
      const note = renderParametricNote(ev.kata, ev.note, ev.durSec, { sr, seed: seed + n * 0x9e37, expression, consonantGain, emphasis, detuneCents, formantScale });
      const start = Math.floor(t * sr);
      for (let i = 0; i < note.length && start + i < total; i++) out[start + i] += note[i];
    }
    t += ev.durSec; n++;
  }
  return { data: out, sr };
}
