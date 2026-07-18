import { describe, it, expect } from 'vitest';

import {
  tieredConsonantEmphasis, holdFactor, renderChoirAbsolute, feedbackEcho,
  DESCRATCH3_VOICES, DESCRATCH3_ECHO,
} from './beats-song-choir.js';
import { CONSONANTS } from './beats-song-voice-parametric.js';
import { authorSyllable } from './beats-song-lyrics.js';

describe('beats-song-choir — descratch3 tiers + phrasing', () => {
  it('pushes sustained consonants and restrains stops', () => {
    const e = tieredConsonantEmphasis();
    expect(e.m).toBeCloseTo((CONSONANTS.m.emph ?? 1) * 3.0, 6);
    expect(e.k).toBeCloseTo((CONSONANTS.k.emph ?? 1) * 1.2, 6);
    expect(e.s).toBeCloseTo((CONSONANTS.s.emph ?? 1) * 1.1, 6);
  });

  it('holdFactor is neutral at weight 3 and bounded', () => {
    expect(holdFactor(3)).toBe(1);
    expect(holdFactor(99)).toBe(1.25);
    expect(holdFactor(-99)).toBe(0.8);
  });
});

describe('beats-song-choir — absolute-onset choir + echo', () => {
  const SR = 8000;
  const sung = [{
    onsetSec: 0.1, durSec: 0.4, note: 'G4',
    kata: authorSyllable('ア', 0.4, { overrides: { ア: 'ア' }, raw: true }),
  }];

  it('renders a seeded, deterministic choir sum at the requested length', () => {
    const a = renderChoirAbsolute(sung, { sr: SR, voices: DESCRATCH3_VOICES });
    const b = renderChoirAbsolute(sung, { sr: SR, voices: DESCRATCH3_VOICES });
    expect(a.length).toBe(Math.ceil((0.1 + 0.4 + 2.5) * SR));
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
    expect(a.some((v) => v !== 0)).toBe(true);
    // silence before the first onset (voice 0 has no stagger)
    expect(a.slice(0, Math.floor(0.09 * SR)).every((v) => v === 0)).toBe(true);
  });

  it('feedbackEcho adds delayed energy after the dry note', () => {
    const dry = new Float32Array(SR); // 1s
    dry[100] = 1; // impulse
    const wet = feedbackEcho(dry, SR, { ...DESCRATCH3_ECHO, time: 0.05 });
    const tap = 100 + Math.round(0.05 * SR);
    expect(wet[100]).toBe(1); // dry preserved
    const around = wet.slice(tap - 5, tap + 40);
    expect(Math.max(...around.map(Math.abs))).toBeGreaterThan(0.05); // first (damped) repeat
  });
});
