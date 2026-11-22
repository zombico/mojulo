// THE LIGHT MOODS, every one: its plot within the stage's settings, its shade within a room's, its grade a game's.
import { describe, it, expect } from 'vitest';
import { LIGHT_MOODS, MOOD_IDS, moodOf } from './action-first-level.js';
import { PLOT_KEYS } from '../era/stage.js';
import { readGameGrade } from './grade.js';

describe('every light mood', () => {
  it('writes a plot the stage reads, a shade in its range and a grade a game takes', () => {
    for (const m of MOOD_IDS) {
      const M = moodOf(m, ['gate', 'hall', 'gallery', 'sanctum']);
      for (const R of Object.values(M.plot)) for (const [k, v] of Object.entries(R)) {
        const [lo, hi, whole] = PLOT_KEYS[k] ?? []; expect(PLOT_KEYS[k], `${m}.${k}`).toBeDefined();
        expect(v >= lo && v <= hi && (!whole || Number.isInteger(v)), `${m}.${k} ${v}`).toBe(true);
      }
      expect(M.shade >= 0.02 && M.shade <= 0.6, m).toBe(true);
      expect(() => readGameGrade(M.grade), m).not.toThrow();
      expect(typeof LIGHT_MOODS[m].says).toBe('string');
    }
  });
});
