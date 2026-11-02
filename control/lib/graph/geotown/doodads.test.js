// THE STREET'S DOODADS, ROUND: each stands on its foot where it stood; a plain hand's pieces agree with each other, a
// toon register's each its own, exaggerated and incongruent.
import { describe, it, expect } from 'vitest';
import { toonOf, proportions, hydrantOf, binOf, postboxOf, lampOf, postOf } from './doodads.js';
import { mulberry32 } from '../city/plan/dice.js';
import { REGISTERS } from '../era/colour-register.js';

const span = (fs, i) => { const v = fs.flatMap((f) => f.corners.map((c) => c[i])); return [Math.min(...v), Math.max(...v)]; };
const PIECES = { hydrant: (D) => hydrantOf(4, 5, 1.2, [1, 0], D), bin: (D) => binOf(4, 5, 1.2, D), postbox: (D) => postboxOf(4, 5, 1.2, D), lamp: (D) => lampOf(4, 5, 1.2, [0, 1], 6, D), post: (D) => postOf(4, 5, 1.2, 3, 0.05, 'pole', D) };

describe('the doodads, round', () => {
  it('reads the toon register: a cel one by name, or bands and an outline; a continuous one not', () => {
    expect(toonOf({ ...REGISTERS.cel, name: 'cel' })).toBe(true);
    expect(toonOf({ steps: 3, outline: true })).toBe(true);
    expect(toonOf({ steps: 0 })).toBe(false);
    expect(toonOf(undefined)).toBe(false);
  });

  it('stands each piece on its foot, where it stood', () => {
    for (const [k, make] of Object.entries(PIECES)) for (const toon of [false, true]) {
      const fs = make(proportions(mulberry32(7), toon));
      expect(fs.length, k).toBeGreaterThan(8);
      expect(span(fs, 2)[0], k).toBeCloseTo(k === 'lamp' ? 1.2 : 1.2, 3);
      // (its foot over the place it was put)
      const foot = fs.flatMap((f) => f.corners).filter((c) => c[2] < 1.2 + 1e-6);
      for (const c of foot) expect(Math.hypot(c[0] - 4, c[1] - 5), k).toBeLessThan(0.6);
    }
  });

  it('draws a plain hand\'s pieces alike, a toon register\'s each its own', () => {
    const plain = [1, 2].map((s) => JSON.stringify(binOf(0, 0, 0, proportions(mulberry32(s), false))));
    expect(plain[0]).toBe(plain[1]);
    const toon = [1, 2, 3].map((s) => binOf(0, 0, 0, proportions(mulberry32(s), true)));
    expect(new Set(toon.map((fs) => JSON.stringify(fs))).size).toBe(3);
    // (incongruent: a toon hydrant's bonnet out of proportion with its barrel, beyond a plain one's)
    const ratio = (D) => { const fs = hydrantOf(0, 0, 0, [1, 0], D), w = (role) => { const v = fs.filter((f) => f.role === role).flatMap((f) => f.corners.map((c) => Math.hypot(c[0], c[1]))); return Math.max(...v); }; return w('yellow') / w('hydrant'); };
    const P0 = ratio(proportions(mulberry32(1), false));
    expect([1, 2, 3, 4].some((s) => Math.abs(ratio(proportions(mulberry32(s), true)) - P0) > 0.3)).toBe(true);
  });
});
