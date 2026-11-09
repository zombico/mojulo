import { describe, it, expect } from 'vitest';
import { MECHA_ARCHETYPES, posedFrame } from './index.js';
import { gaitOf, gaitStances, gaitLaws, GAIT } from './mecha-gait.js';

// THE GAIT (mecha-gait.js): a frame's walk read from its structure and scaled to its size. One case per pattern, chosen
// from the shelf in code: a biped (the lightest), a four-legged frame; and between the smallest and the largest biped,
// dynamic similarity (the bigger strides longer, steps slower, walks faster).
const legs = (a) => Object.keys(MECHA_ARCHETYPES[a].legs).length;
const byMass = (f) => Object.keys(MECHA_ARCHETYPES).filter(f).sort((a, b) => MECHA_ARCHETYPES[a].mass - MECHA_ARCHETYPES[b].mass);
const bipeds = byMass((a) => legs(a) === 2), BIPED = bipeds[0], QUAD = byMass((a) => legs(a) === 4)[0];
const lawsOf = (a) => { const g = gaitOf(a), st = gaitStances(g); return { g, st, laws: gaitLaws(g, st, st.map((s) => posedFrame(a, s))) }; };

describe('a frame\'s gait', () => {
  it('a biped steps in alternation, a foot always down, every key within its joints\' ranges, a planted foot still', () => {
    const { g, st, laws } = lawsOf(BIPED);
    expect(g.pattern).toBe('alternate');
    expect(laws.filter((l) => !l.ok)).toEqual([]);
    expect(st).toHaveLength(GAIT.keys);
    // (half a cycle apart: each foot swings while the other is planted)
    expect(Math.abs(g.phase.r - g.phase.l)).toBe(0.5);
    expect(g.duty).toBeGreaterThan(0.5);
  });

  it('a four-legged frame walks its lateral sequence, three feet always down', () => {
    const { g, laws } = lawsOf(QUAD);
    expect(g.pattern).toBe('lateral sequence');
    expect(laws.filter((l) => !l.ok)).toEqual([]);
    expect(laws.find((l) => /fewer than 3/.test(l.name)).info).toBeGreaterThanOrEqual(3);
  });

  it('by its size: the bigger strides longer and steps slower, faster over the ground; its stride its legs\' reach at most', () => {
    const small = gaitOf(bipeds[0]), big = gaitOf(bipeds.at(-1));
    expect(big.L).toBeGreaterThan(small.L);
    expect(big.stride).toBeGreaterThan(small.stride);
    expect(big.cadence).toBeLessThan(small.cadence);
    expect(big.speed).toBeGreaterThan(small.speed);
    // (the natural cadence as 1/√L: the same Froude number at every size)
    expect(small.cadence * Math.sqrt(small.L)).toBeCloseTo(big.cadence * Math.sqrt(big.L), 2);
    for (const g of [small, big]) {
      expect(g.stride).toBeLessThanOrEqual(g.natural.stride + 1e-9);
      expect(g.limitedBy === 'reach').toBe(g.stride < g.natural.stride - 1e-6);
      expect(g.froude).toBeLessThanOrEqual(GAIT.run);
    }
  });

  it('refuses what is no frame', () => {
    expect(() => gaitOf('noSuchFrame')).toThrow(/mecha archetype/);
  });
});
