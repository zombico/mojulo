import { describe, it, expect } from 'vitest';
import { readHidden, hiddenSpots, HIDDEN } from './hidden-stars.js';

// a small district: two parks, a lot, a ramp, a yard and a dock, a box over one park's corner, a door by the lot
const ends = {
  spawn: [0, 0, 0],
  parks: [{ id: 'p1', rect: [60, 60, 100, 100] }, { id: 'p2', rect: [-160, 40, -120, 90] }],
  lots: [{ id: 'l1', rect: [200, -40, 230, -10] }],
  ramps: [{ id: 'r1', top: [0, -200, 9], foot: [0, -150, 0], w: 8 }],
  depots: [{ id: 'y1', at: [-200, -200, 0], half: [20, 15] }],
  dock: { id: 'd1', rect: [300, 200, 360, 240] },
  doors: [{ id: 'office', at: [228, -12, 0] }],
  colliders: [{ min: [96, 96, 0], max: [104, 104, 3] }],
};
Object.defineProperty(ends, 'ground', { value: () => 0, enumerable: false });

describe('the city\'s hidden stars', () => {
  it('reads a world\'s `hidden`: none, true, its count and item; refuses the rest', () => {
    expect(readHidden(undefined)).toBe(null);
    expect(readHidden(true)).toEqual({ stars: HIDDEN.stars, item: HIDDEN.item });
    expect(readHidden({ stars: 3, item: 'lost-tape' })).toEqual({ stars: 3, item: 'lost-tape' });
    expect(() => readHidden({ stars: 0 })).toThrow(/1 to/);
    expect(() => readHidden({ shiny: true })).toThrow(/not a setting/);
  });
  it('tucks them in out-of-the-way places, on the ground, out of every box, away from the start and the doors', () => {
    const S = hiddenSpots(ends, readHidden({ stars: 6 }), 4);
    expect(S.length).toBe(6);
    expect(new Set(S.map((s) => s.from)).size).toBeGreaterThan(3);
    for (const s of S) {
      expect(s.at[2]).toBeCloseTo(HIDDEN.lift);
      expect(Math.hypot(s.at[0], s.at[1])).toBeGreaterThanOrEqual(HIDDEN.start);
      expect(Math.hypot(s.at[0] - 228, s.at[1] + 12)).toBeGreaterThanOrEqual(HIDDEN.door);
      expect(s.at[0] > 95.4 && s.at[0] < 104.6 && s.at[1] > 95.4 && s.at[1] < 104.6).toBe(false);
    }
  });
  it('spreads them apart, no two nearer than its spacing; asks for more than fit and is given fewer', () => {
    const S = hiddenSpots(ends, readHidden({ stars: 24 }), 4);
    expect(S.length).toBeLessThan(24);
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) expect(Math.hypot(S[i].at[0] - S[j].at[0], S[i].at[1] - S[j].at[1])).toBeGreaterThanOrEqual(HIDDEN.apart);
  });
  it('is the same for the same seed, and none where nothing is hidden', () => {
    expect(hiddenSpots(ends, readHidden(true), 9)).toEqual(hiddenSpots(ends, readHidden(true), 9));
    expect(hiddenSpots(ends, null, 9)).toEqual([]);
  });
});
