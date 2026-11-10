import { describe, it, expect } from 'vitest';
import { flightPlan, flightReport, speedOf, HOVER_SPEEDS, HOVER } from './hover-bot.js';

describe('the hover bot: a flight planned at a speed, and what it saw', () => {
  const path = [[0, 0], [30, 0], [30, 40]];

  it('samples a path every speed × interval metres, each sample its heading along the path', () => {
    const walk = flightPlan(path, { speed: 'walk' }), drive = flightPlan(path, { speed: 'drive' });
    expect(walk.length).toBe(Math.floor(70 / (HOVER_SPEEDS.walk * HOVER.dt)) + 1);
    expect(drive.length).toBeLessThan(walk.length / 5);
    for (let k = 1; k < walk.length; k++) expect(walk[k].s - walk[k - 1].s).toBeCloseTo(HOVER_SPEEDS.walk * HOVER.dt, 2);
    expect(walk[0]).toEqual({ at: [0, 0], heading: 0, s: 0 });
    expect(walk.at(-1).heading).toBeCloseTo(Math.PI / 2, 3);
    expect(flightPlan(path, { speed: 5, dt: 1 }).length).toBe(15);
    expect(() => speedOf('sprint')).toThrow(/crawl \| walk/);
    expect(() => flightPlan([[0, 0]])).toThrow(/two or more/);
  });

  it('reports its holes, the steps its ground takes, its steepest slope, the groups under it', () => {
    const S = (x, z, g = 'walk', triangles = 100) => ({ at: [x, 0], s: x, ground: z === null ? null : { z, group: g }, triangles });
    const R = flightReport([S(0, 0), S(1, 0.05), S(2, 0.1), S(3, 0.6, 'step'), S(4, null), S(5, 0.6), S(6, 0.62, 'walk', 300)]);
    expect(R.holes).toEqual([[4, 0]]);
    expect(R.steps).toEqual([{ at: [3, 0], dz: 0.5, from: 'walk', to: 'step' }]);
    expect(R.steepest).toBeCloseTo(0.05, 6);
    expect(R.groups).toEqual({ walk: 5, step: 1 });
    expect(R.triangles).toEqual({ max: 300, mean: 133 });
    expect(R.length).toBe(6);
  });
});
