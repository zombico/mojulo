// The foe shelf's sweep: every class at every rank on its stand-in, and every class against the whole fauna roster.
// The laws (foes.test.js) hold one class per procedure; this holds the shelf's range ends: a stand-in that fits, a
// mind that resolves every situation without an advisory, and a class that some species can wear.
import { describe, it, expect } from 'vitest';
import { FOE_CLASSES } from './index.js';
import { resolveFoe } from './resolve.js';
import { fitOf } from './fit.js';
import { SPECIES } from '../fauna/species.js';
import { RANKS, SITUATIONS } from '../mind/vocab.js';

describe('foe shelf sweep', () => {
  it('every class resolves at every rank on its stand-in, every situation answered, no advisory', () => {
    for (const c of Object.values(FOE_CLASSES)) {
      for (const rank of Object.keys(RANKS)) {
        const f = resolveFoe({ class: c.id, rank });
        expect(f.body, c.id).toBe(c.standIn);
        expect(Object.keys(f.mind.situations), c.id).toEqual(Object.keys(SITUATIONS));
        expect(f.advisories, `${c.id} ${rank}`).toEqual([]);
      }
    }
  });
  it('every class fits some species beside its stand-in, and no species makes the fit throw', () => {
    const ids = Object.keys(SPECIES);
    for (const c of Object.values(FOE_CLASSES)) {
      const fit = ids.filter((s) => fitOf(c.id, s).ok);
      expect(fit, c.id).toContain(c.standIn);
      expect(fit.length, c.id).toBeGreaterThan(1);
    }
  }, 120_000);
});
