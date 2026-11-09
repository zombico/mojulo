import { describe, it, expect } from 'vitest';
import { readLane, legacyLane, laneOf, lanePoint, laneEnds } from './versus-lane.js';
import { ARENA_PLANE } from './versus-arena.js';

describe('versus lane: where a fight runs on a level', () => {
  it('a stored arena\'s words are a lane at heading 0, its centre at x 0 on its plane', () => {
    expect(legacyLane({ plane: ARENA_PLANE, half: 6, floor: 0.75 })).toEqual({ at: [0, ARENA_PLANE], heading: 0, half: 6, floor: 0.75 });
    // (a versus block with no lane of its own reads its legacy words; one with a lane reads the lane)
    expect(laneOf({ plane: 6, half: 8 })).toEqual({ at: [0, 6], heading: 0, half: 8, floor: 0 });
    expect(laneOf({ plane: 6, half: 8, lane: { at: [3, 4], heading: 90, half: 5, floor: 2 } })).toEqual({ at: [3, 4], heading: 90, half: 5, floor: 2 });
  });

  it('maps lane-local metres to the world: along the heading, across toward the far side, up from the floor', () => {
    const L = readLane({ at: [10, -4], heading: 90, half: 6, floor: 3 });
    // (heading 90: the lane runs along +y, its far side is −x, the camera's side +x)
    expect(lanePoint(L, 2, 0, 0)).toEqual([10, -2, 3]);
    expect(lanePoint(L, 0, 1, 0.5)).toEqual([9, -4, 3.5]);
    expect(laneEnds(L)).toEqual([[10, -10, 3], [10, 2, 3]]);
    // (any heading: the two walls are 2·half apart, the centre between them)
    const T = readLane({ at: [1, 2], heading: 35, half: 7.5 });
    const [a, b] = laneEnds(T);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(15, 3);
    expect([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]).toEqual([expect.closeTo(1, 3), expect.closeTo(2, 3)]);
  });

  it('settles a heading into one turn, and refuses a lane by the field that is wrong', () => {
    expect(readLane({ half: 5, heading: -90 }).heading).toBe(270);
    expect(readLane({ half: 5, heading: 450 }).heading).toBe(90);
    expect(() => readLane({ half: 1 })).toThrow(/half/);
    expect(() => readLane({ half: 5, at: [0] })).toThrow(/at/);
    expect(() => readLane({ half: 5, back: 0.5 })).toThrow(/back/);
    expect(() => readLane({ half: 5, plane: 6 })).toThrow(/plane is not a lane's word/);
  });
});
