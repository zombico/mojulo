// THE STREET'S DOODADS, ROUND: each stands on its foot where it stood; a plain hand's pieces agree with each other, a
// toon register's each its own, exaggerated and incongruent.
import { describe, it, expect } from 'vitest';
import { toonOf, proportions, hydrantOf, binOf, postboxOf, lampOf, postOf, ringOf, shelterOf, toyCarOf } from './doodads.js';
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

describe('the rings, the shelters and the cars, round', () => {
  it('stands a toy car inside a plain car\'s footprint, on its wheels, a toon one too', () => {
    for (const toon of [false, true]) for (const seed of [1, 2, 3]) {
      const fs = toyCarOf('u', '#c83c3c', proportions(mulberry32(seed), toon));
      const [x0, x1] = span(fs, 0), [y0, y1] = span(fs, 1), [z0] = span(fs, 2);
      expect(x0).toBeGreaterThanOrEqual(-2.15 - 1e-6); expect(x1).toBeLessThanOrEqual(2.16);
      expect(y1 - y0).toBeLessThan(1.9);
      expect(z0).toBeGreaterThanOrEqual(-1e-6);
      expect(fs.some((f) => f.role === 'tyre')).toBe(true);
    }
  });
  it('keeps a shelter\'s posts on its corners and its roof over them', () => {
    const rect = [0, 0, 3.8, 1.4], fs = shelterOf(rect, 0.15, true, 0, 1, proportions(mulberry32(5), true), mulberry32(6));
    const feet = fs.filter((f) => f.role === 'shelter').flatMap((f) => f.corners).filter((c) => c[2] < 0.15 + 1e-6);
    for (const c of feet) expect(Math.min(...[[0, 0], [3.8, 0], [3.8, 1.4], [0, 1.4]].map(([x, y]) => Math.hypot(c[0] - x, c[1] - y)))).toBeLessThan(0.1);
    expect(fs.some((f) => f.role === 'glass')).toBe(true);
    expect(fs.some((f) => f.role === 'seat')).toBe(true);
  });
  it('rings a bike ring round its post, a toon one tipped off its plane', () => {
    const plain = ringOf(0, 0, 0, true, proportions(mulberry32(1), false)), toon = ringOf(0, 0, 0, true, proportions(mulberry32(1), true));
    expect(span(plain, 1)[1] - span(plain, 1)[0]).toBeLessThan(0.1);          // (a plain ring in its plane, across the walk)
    expect(span(toon, 1)[1] - span(toon, 1)[0]).toBeGreaterThan(span(plain, 1)[1] - span(plain, 1)[0]);
  });
});
