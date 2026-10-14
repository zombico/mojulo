import { describe, it, expect } from 'vitest';
import { wildflower, wildflowerLadder, flowerRamp, WILDFLOWERS, WILDFLOWER_KINDS } from './wildflowers.js';

describe('wildflowers: stems and heads a tuft carries', () => {
  // one kind per head procedure: rays round an eye, cupped petals, a ball, a spike
  const cases = ['daisy', 'buttercup', 'clover', 'lupine'].filter((k) => WILDFLOWER_KINDS.includes(k));

  it('is a recipe: the same seed grows the same plant, another seed another', () => {
    const k = WILDFLOWER_KINDS[0];
    expect(JSON.stringify(wildflower(k, { seed: 4 }))).toBe(JSON.stringify(wildflower(k, { seed: 4 })));
    expect(JSON.stringify(wildflower(k, { seed: 4 }))).not.toBe(JSON.stringify(wildflower(k, { seed: 5 })));
  });

  it('stands its head over the tuft (height 1) on a stem, every vertex carrying its part and its place up its window', () => {
    for (const k of cases) {
      const T = wildflower(k, { seed: 2 }), parts = new Set(T.map((t) => t.part));
      expect(parts.has('stem') && parts.has('petal'), k).toBe(true);
      for (const t of T) { expect(['stem', 'petal', 'eye']).toContain(t.part); for (const v of t.v) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
      const top = Math.max(...T.filter((t) => t.part !== 'stem').flatMap((t) => t.p.map((p) => p[2])));
      expect(top, k).toBeGreaterThan(WILDFLOWERS[k].height[0] * 0.9);
      expect(Math.min(...T.flatMap((t) => t.p.map((p) => p[2])))).toBeGreaterThanOrEqual(0);
    }
  });

  it('thins down its ladder, and `size` and `lift` scale the head and the stem', () => {
    for (const k of cases) { const L = wildflowerLadder(k, { seed: 3 }); expect(L.L2.length).toBeGreaterThan(L.L1.length); expect(L.L1.length).toBeGreaterThan(L.L0.length); }
    const k = cases[0], span = (T) => { const P = T.filter((t) => t.part !== 'stem').flatMap((t) => t.p); return Math.max(...P.map((p) => p[0])) - Math.min(...P.map((p) => p[0])); };
    expect(span(wildflower(k, { seed: 1, size: 2 }))).toBeGreaterThan(1.5 * span(wildflower(k, { seed: 1 })));
    const hi = (T) => Math.max(...T.flatMap((t) => t.p.map((p) => p[2])));
    expect(hi(wildflower(k, { seed: 1, lift: 1.3 }))).toBeGreaterThan(hi(wildflower(k, { seed: 1 })));
  });

  it('takes its colours from the kit\'s palette, the first ramp it has', () => {
    expect(flowerRamp('daisy', 'petal', { cloud: [[0, 0, 0]] })).toBe('cloud');
    expect(flowerRamp('buttercup', 'petal', { soil: [[0, 0, 0]] })).toBe('soil');
    expect(flowerRamp('buttercup', 'petal', {})).toBeNull();
  });
});
