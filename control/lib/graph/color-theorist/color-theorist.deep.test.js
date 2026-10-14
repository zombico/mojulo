import { describe, it, expect } from 'vitest';
import { solvePalette, PALETTE_SCHEME_IDS, PALETTE_KEYS } from './solve.js';

// The sweep: every scheme in every key at the ends of every axis. The value laws (the ones a kit's look is built on)
// hold everywhere; the rest are advice and may fail at a corner, but every one is checked.
const ENDS = [-1, 1];
const VALUE_LAWS = ['ramps-climb', 'shade-is-colour', 'sky-brightest', 'ui-contrast'];

describe('the palette over its range', () => {
  for (const scheme of PALETTE_SCHEME_IDS) {
    it(`${scheme}: the value laws hold in every key at every axis end`, () => {
      for (const key of Object.keys(PALETTE_KEYS)) for (const heat of ENDS) for (const weight of ENDS) for (const activity of ENDS) {
        const K = solvePalette({ seed: 31, scheme, key, heat, weight, activity });
        for (const law of VALUE_LAWS) expect(K.checks.find((c) => c.law === law), `${scheme} ${key} h${heat} w${weight} a${activity}: ${law}`).toMatchObject({ ok: true });
      }
    });
  }
});
