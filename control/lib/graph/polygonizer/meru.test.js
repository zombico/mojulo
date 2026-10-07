/**
 * The meru: the shared vertical ruler. A storey stack (a house's, over its defaults) and named marks up one axis.
 */
import { describe, expect, it } from 'vitest';

import { meruStack, meruMarks, levelIndex } from './meru.js';
import { houseMeru, FLOORPLAN_DEFAULTS } from './floorplan-structure.js';

describe('the meru', () => {
  it('stacks storeys of their own heights, a slab between, below and above the ground', () => {
    const m = meruStack({ groundZ: 1, floorDrop: 0.5, wallHeight: 3, basementHeight: 2.5, upperHeight: 2.8 });
    expect(m.resolveStack([{ role: 'basement' }, { role: 'ground' }, { index: 1 }, { index: 2 }]).map((l) => l.floorZ)).toEqual([-2, 1, 4.5, 7.8]);
    expect(m.baseZ(2)).toBe(8);
    expect(levelIndex({ role: 'second' })).toBe(1);
  });

  it('a house\'s meru is the same ruler over the floorplan defaults', () => {
    const D = FLOORPLAN_DEFAULTS, h = houseMeru({ groundZ: 2 });
    const s = meruStack({ groundZ: 2, floorDrop: D.floorDrop, wallHeight: D.wallHeight, basementHeight: D.basementHeight, upperHeight: D.upperHeight });
    expect(h.storeyPitch).toBe(s.storeyPitch);
    expect(h.resolveStack([{ index: 0 }, { index: 1 }])).toEqual(s.resolveStack([{ index: 0 }, { index: 1 }]));
  });

  it('carries named marks up one axis, and refuses a mark below the one before it', () => {
    const m = meruMarks({ ground: 0, summit: 12, deck: 18, apex: 22.4 });
    expect(m.z('deck')).toBe(18);
    expect([m.base, m.top]).toEqual([0, 22.4]);
    expect(meruMarks([{ name: 'summit', z: 12 }, { name: 'tower', z: 12 }]).stack).toHaveLength(2);
    expect(() => meruMarks({ ground: 0, deck: 6, summit: 4 })).toThrow(/'summit' \(4 m\) stands below 'deck'/);
    expect(() => m.z('roof')).toThrow(/no mark 'roof'/);
  });
});
