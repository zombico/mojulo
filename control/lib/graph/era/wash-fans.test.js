// Wash fans (wash-fans.js): where rain runs off a trail it slows (at its dips and the foot of each descent) and drops
// what it carried. Held on two made lands, each a trail along x = 12 coming down a slope to level ground at y = 20: one
// falling away to the east (a fan opens off the trail on that side), one sunk in its banks (the water stays in it: a lobe
// on the trail, run on down it).
import { describe, it, expect } from 'vitest';
import { washFans } from './wash-fans.js';
import { assembleStageScene } from './stage.js';

const down = (y) => (y < 20 ? (20 - y) * 0.1 : 0);
const site = (cross) => ({ D: 40, trailX: () => 12, halfWAt: () => 1, ground: (x, y) => down(y) + cross(x - 12) });
const EAST = site((d) => -0.08 * d), SUNK = site((d) => 0.08 * Math.abs(d));

describe('a trail\'s wash', () => {
  it('opens a fan off the trail on its low side, at the foot of its descent, downhill', () => {
    const W = washFans(EAST, { amount: 1, seed: 3 });
    expect(W.laws.filter((r) => !r.ok)).toEqual([]);
    expect(W.fans).toHaveLength(1);
    const F = W.fans[0];
    expect(F.on).toBe('side');
    expect(Math.abs(F.at[1] - 20)).toBeLessThan(2);
    expect(F.dir[0]).toBeGreaterThan(0.9);
    expect(W.sand(13 + F.len / 2, F.at[1])).toBeGreaterThan(0);
    expect(W.sand(11, F.at[1])).toBeLessThanOrEqual(0);
  });

  it('lays a lobe on a trail sunk in its banks, run on down it; none when not asked; the same every time', () => {
    const W = washFans(SUNK, { amount: 1, seed: 3 });
    expect(W.laws.filter((r) => !r.ok)).toEqual([]);
    expect(W.fans.map((F) => F.on)).toEqual(['trail']);
    // (down the trail from the foot: the level ground's way, never back up the slope)
    expect(W.lobe(12, W.fans[0].at[1] + 1)).toBeGreaterThan(0);
    expect(W.lobe(12, W.fans[0].at[1] - 3)).toBeLessThanOrEqual(0);
    expect(washFans(SUNK, { amount: 0, seed: 3 }).fans).toEqual([]);
    expect(JSON.stringify(washFans(EAST, { amount: 1, seed: 3 }).fans)).toBe(JSON.stringify(washFans(EAST, { amount: 1, seed: 3 }).fans));
  });
});

describe('the wash on a stage', () => {
  it('is laid with the trail\'s debris, as sand where it lies; asked nothing, none', () => {
    const M = { kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon', biocube: { from: 'meadow' } } };
    const fell = assembleStageScene({ ...M, skandart: 1 }, {}), plain = assembleStageScene(M, {});
    expect(fell.skandart.wash).toMatchObject({ laws: [] });
    const sand = (P) => P.faces.filter((f) => f.group === 'isekai:sand').length;
    expect(sand(fell)).toBeGreaterThan(sand(plain));
  }, 120_000);
});
