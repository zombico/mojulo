// A PROP'S PLUME on a frame operation (frame-goal.js a prop's `plume`, scene/channels/plume.js): its bell as drawn, its
// axis up, its plasma's colour, carried to the page; a card with no bell refused.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, PLUME_COLOUR } from './frame-goal.js';
import { GROUND_UNITS, GROUNDFORCE_SCALE } from '../groundforce/index.js';

describe('a prop\'s plume', () => {
  it('a frame operation\'s prop with a plume carries its bell, as drawn, to the page; one without a bell is refused', () => {
    const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
    const base = { groups: [{ id: 'd', kind: 'gnat', at: [0.5, 0] }], tasks: [{ down: ['d'] }] };
    const [pl] = operationCast(readOperation({ ...base, props: [{ id: 'c1', unit: 'candle', at: [0, 0.2], plume: true }] }), ends).plumes;
    const B = GROUND_UNITS.candle.bell;
    expect(pl).toEqual({ who: 'c1', at: B.at.map((v) => Math.round(v * GROUNDFORCE_SCALE * 100) / 100), r: Math.round(B.r * GROUNDFORCE_SCALE * 100) / 100, dir: [0, 0, 1], colour: PLUME_COLOUR });
    const unbelled = Object.keys(GROUND_UNITS).find((k) => !GROUND_UNITS[k].bell);
    expect(() => readOperation({ ...base, props: [{ id: 'c1', unit: unbelled, at: [0, 0.2], plume: true }] })).toThrow(/on a card with a bell/);
  });
});
