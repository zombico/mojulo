// The jobs' piles (job-stops.js): what a level's collecting driving jobs show and press. The laws: each collecting job's
// piles are heaps keyed to their own flags (a mow's shed where its round is started), the vars its line reads, its load and its hold in ticks; a job of any other
// mode, or a level with none, shows nothing; the tailgate's moment rises, holds and falls inside itself.
import { describe, it, expect } from 'vitest';
import { jobStopsOf, JOB_KEY } from './job-stops.js';
import { JOB_MOTION, jobEnv } from './job-motion.js';

const COLLECT = { kind: 'shift', mode: 'collect', id: 'bin-round', depot: [0, 0, 0], cabs: ['car-12'], stops: [{ at: [60, 0, 1] }, { at: [120, 4, 2] }], load: 2, hold: 1.5, vehicle: 'garbage truck', unload: { at: [300, 0, 0], half: [20, 10] } };
const of = (mechanics) => jobStopsOf({ game: { mechanics } });

describe('the jobs\' piles', () => {
  it('a collecting job\'s piles, each keyed to its flag; its vars, load and hold; where it is emptied', () => {
    expect(of([COLLECT])).toEqual({ jobs: [{ id: 'bin-round', mode: 'collect', cabs: ['car-12'], done: 'errand:done:bin-round', piles: [{ at: [60, 0, 1], v: 'flag-stop-bin-round-1' }, { at: [120, 4, 2], v: 'flag-stop-bin-round-2' }],
      vars: { in: 'in-bin-round', at: 'at-bin-round', prog: 'prog-bin-round', load: 'load-bin-round', on: 'flag-on-bin-round', full: 'flag-full-bin-round', next: 'next-bin-round' }, load: 2, where: 'the dump', ticks: 15, key: JOB_KEY.label, vehicle: 'garbage truck' }] });
    // (a route's stops: each its people waiting and the way out to its street)
    const route = of([{ ...COLLECT, mode: 'route', id: 'bus', vehicle: 'bus', stops: [{ at: [60, 0, 1], riders: 3, N: [0, -1] }] }]).jobs[0];
    expect(route).toMatchObject({ mode: 'route', vehicle: 'bus', piles: [{ at: [60, 0, 1], v: 'flag-stop-bus-1', riders: 3, N: [0, -1] }] });
    expect(route.load).toBeUndefined();
    // (a mow: no piles, its round a minigame; its shed at the park)
    const mow = of([{ kind: 'shift', mode: 'mow', id: 'grounds', depot: [60, 0, 1], shed: { at: [62, 3, 1], heading: 1.5708, half: [1.4, 1.1] } }]);
    expect(mow).toEqual({ jobs: [], sheds: [{ id: 'grounds', at: [62, 3, 1], heading: 1.571, half: [1.4, 1.1] }] });
    expect(of([{ ...COLLECT, unload: undefined, yard: 'works yard' }]).jobs[0].where).toBe('the works yard');
    expect(of([{ ...COLLECT, mode: 'haul' }])).toBe(null);
    expect(of([{ kind: 'bag', slice: 'bag' }])).toBe(null);
    expect(jobStopsOf({})).toBe(null);
  });
  it('the tailgate\'s moment rises, holds and falls inside itself, eased, never out of [0, 1]', () => {
    const M = JOB_MOTION.tip;
    expect(jobEnv(-0.1, M.up, M.down)).toBe(0);
    expect(jobEnv((M.up[1] + M.down[0]) / 2, M.up, M.down)).toBe(1);
    expect(jobEnv(1.1, M.up, M.down)).toBe(0);
    for (let u = 0; u <= 1; u += 0.05) { const e = jobEnv(u, M.up, M.down); expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1); }
  });
});
