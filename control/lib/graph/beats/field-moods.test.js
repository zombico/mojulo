import { describe, expect, it } from 'vitest';

import { fieldSoundtrack, FIELD_MOODS } from './field-moods.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { fieldGates } from './field-gates.js';

// The hand-written takes — the field gates (`field-gates.js`, the principles of
// card `beats-field-orchestra`). None of this is an ears gate.

const MOODS = Object.keys(FIELD_MOODS);

describe('field moods', () => {
  it('every mood is a valid, warning-free beats composition', () => {
    for (const mood of MOODS) {
      const v = validateBeatsManifest(fieldSoundtrack(mood));
      expect(v.errors || [], mood).toEqual([]);
      expect(v.warnings || [], mood).toEqual([]);
    }
  });

  it('is deterministic per seed, the seed moves it, an unknown mood teaches', () => {
    for (const mood of MOODS) {
      expect(JSON.stringify(fieldSoundtrack(mood, 3))).toBe(JSON.stringify(fieldSoundtrack(mood, 3)));
      expect(fieldSoundtrack(mood, 3).seed).not.toBe(fieldSoundtrack(mood, 4).seed);
      expect(fieldSoundtrack(mood).seed).toBe(FIELD_MOODS[mood].base);
    }
    expect(() => fieldSoundtrack('swamp')).toThrow(/the moods: plains, desert, village, forest, highlands, expedition, wayfarer/);
  });

  it('every take passes the field gates (village keeps its flute counterline over the last pass, by ear)', () => {
    // the one approved exception: village's flute holds long notes over the clarinet's last pass.
    const EXCEPT = { village: /^answer: bar 1[2-5] has 2 leads/ };
    for (const mood of MOODS) {
      const breaches = fieldGates(fieldSoundtrack(mood), FIELD_MOODS[mood].energy).filter((x) => !(EXCEPT[mood] && EXCEPT[mood].test(x)));
      expect(breaches, mood).toEqual([]);
    }
  });
});
