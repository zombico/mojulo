// How wet a place is, by degree (era/wetness.js).
import { describe, it, expect } from 'vitest';
import { readWetness, DEGREES, WET_SPOTS_MOST } from './wetness.js';

describe('wetness: degrees, and what each lays', () => {
  it('the degrees rise together: a place is never wetter on its faces than it has pools for, and only rain strikes them', () => {
    const order = ['dry', 'damp', 'wet', 'raining', 'downpour'].map((d) => DEGREES[d]);
    for (let i = 1; i < order.length; i++) for (const k of ['amount', 'walls', 'pools']) expect(order[i][k], k).toBeGreaterThanOrEqual(order[i - 1][k]);
    expect(DEGREES.damp.pools).toBe(0);
    expect(order.filter((d) => d.rain > 0)).toEqual([DEGREES.raining, DEGREES.downpour]);
    // (a wall never wetter than the ground under it)
    for (const d of order) expect(d.walls).toBeLessThanOrEqual(Math.max(d.amount, 1));
  });

  it('a word, a dial or a degree: true is wet, a number the faces alone, dry and nothing the same', () => {
    expect(readWetness(true)).toMatchObject(DEGREES.wet);
    expect(readWetness('raining').rain).toBe(1);
    expect(readWetness(0.5)).toMatchObject({ amount: 0.5, pools: 0 });
    for (const v of [undefined, false, 0, 'dry']) expect(readWetness(v)).toBeNull();
  });

  it('a spot has a cause somewhere: a place, a reach, how wet at its heart, and whether its heart stands as a pool', () => {
    const W = readWetness({ spots: [{ at: [3, 4], size: 5, pool: true }, { at: [1, 1, 2.5], size: 2, amount: 0.5 }] });
    expect(W.amount).toBe(0);
    expect(W.spots[0]).toEqual({ at: [3, 4, 0], r: 2.5, amount: 0.9, pool: true });
    expect(W.spots[1].at[2]).toBe(2.5);
    expect(readWetness({ degree: 'damp', spots: [{ at: [0, 0], size: 3 }] }).amount).toBe(DEGREES.damp.amount);
  });

  it('what it is not is said', () => {
    expect(() => readWetness('soggy')).toThrow(/wet is/);
    expect(() => readWetness(2)).toThrow(/wet is/);
    expect(() => readWetness({ spots: Array.from({ length: WET_SPOTS_MOST + 1 }, () => ({ at: [0, 0], size: 1 })) })).toThrow(/wet is/);
  });
});
