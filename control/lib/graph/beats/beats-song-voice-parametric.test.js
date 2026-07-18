import { describe, expect, it } from 'vitest';

import {
  FEMALE_VOWEL_FORMANTS,
  FORMANT_BW,
  glottalSource,
  resonatorTV,
  renderParametricNote,
  renderParametricSong,
} from './beats-song-voice-parametric.js';
import { authorScore } from './beats-song-lyrics.js';

const finite = (x) => x.every((v) => Number.isFinite(v));
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('vowel formant table', () => {
  it('has three ascending-ish targets per Japanese vowel', () => {
    for (const v of ['ア', 'イ', 'ウ', 'エ', 'オ']) {
      const f = FEMALE_VOWEL_FORMANTS[v];
      expect(f).toHaveLength(3);
      expect(f[0]).toBeLessThan(f[2]);   // F1 below F3
    }
    expect(FORMANT_BW).toHaveLength(3);
  });
});

describe('glottalSource', () => {
  it('produces a finite, DC-removed, non-silent waveform', () => {
    const g = glottalSource(24000, 24000, 293);
    expect(g).toHaveLength(24000);
    expect(finite(g)).toBe(true);
    const mean = g.reduce((s, v) => s + v, 0) / g.length;
    expect(Math.abs(mean)).toBeLessThan(1e-3);   // centered
    expect(rms(g)).toBeGreaterThan(0.01);
  });
});

describe('resonatorTV', () => {
  it('is stable (bounded output) for a constant formant track', () => {
    const src = glottalSource(4800, 24000, 220);
    const freqAt = new Float32Array(4800).fill(800);
    const out = resonatorTV(src, 24000, freqAt, 80);
    expect(finite(out)).toBe(true);
    let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(50);   // resonant but not blowing up
  });
});

describe('renderParametricNote', () => {
  it('renders a note of the requested duration, finite and within range', () => {
    const note = renderParametricNote('ア', 'A4', 1.0, { sr: 24000 });
    expect(note.length).toBe(24000);
    expect(finite(note)).toBe(true);
    let peak = 0; for (const v of note) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.3);   // not silent
    expect(peak).toBeLessThanOrEqual(1);  // soft-limited into range
  });

  it('is deterministic for the same inputs and seed', () => {
    const a = renderParametricNote('ハイ', 'D4', 1.2, { seed: 5 });
    const b = renderParametricNote('ハイ', 'D4', 1.2, { seed: 5 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('a higher note has a higher glottal rate (more energy up top is not required, but pitch differs)', () => {
    // sanity: different pitches yield different renders (the carrier tracks the note)
    const lo = renderParametricNote('ア', 'C4', 1.0, { seed: 1 });
    const hi = renderParametricNote('ア', 'C5', 1.0, { seed: 1 });
    expect(Array.from(lo)).not.toEqual(Array.from(hi));
  });
});

describe('renderParametricSong', () => {
  it('sequences an authored score into one finite mono track at the right length', () => {
    const score = authorScore([['Twin', 'C4', 1], ['star', 'G4', 2]], 120);
    const { data, sr } = renderParametricSong(score, { sr: 24000, tail: 0.5 });
    expect(sr).toBe(24000);
    // 0.5 + 1.0 beats' seconds + 0.5 tail = (0.5 + 1.0 + 0.5) s
    expect(data.length).toBeCloseTo(2.0 * 24000, -3);
    expect(finite(data)).toBe(true);
    expect(rms(data)).toBeGreaterThan(0.01);
  });

  it('is deterministic end to end', () => {
    const score = authorScore([['How', 'F4', 1], ['are', 'C4', 2]], 108);
    const a = renderParametricSong(score, { sr: 24000 }).data;
    const b = renderParametricSong(score, { sr: 24000 }).data;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
