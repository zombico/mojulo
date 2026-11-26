// The jobs' stops (job-stops.js): what a level's jobs show where they are done. The laws: a driving job's round puts a
// bin at each of its stops, keyed to the stop's own flag and the trucks that may make it; a trade for a person is a
// passenger waiting at their pick-up; any other hand-in is a parcel handed over; a level with none of them shows nothing;
// the timings' shape rises, holds and falls inside its moment.
import { describe, it, expect } from 'vitest';
import { jobStopsOf } from './job-stops.js';
import { JOB_MOTION, jobEnv } from './job-motion.js';

const SHIFT = { kind: 'shift', id: 'bin-round', depot: [0, 0, 0], cabs: ['car-12', 'car-13'], stops: [{ at: [60, 0, 1] }, { at: [120, 4, 2] }] };
const FARE = [{ kind: 'trade', item: 'passenger', at: [5, 5, 0], job: 'fare' }, { kind: 'deliver', id: 'fare', at: [9, 9, 0], wants: [{ item: 'passenger' }] }];
const PARCEL = { kind: 'deliver', id: 'pickup', at: [30, 3, 0], wants: [{ item: 'package' }] };
const of = (mechanics) => jobStopsOf({ game: { mechanics } });

describe('the jobs\' stops', () => {
  it('a round\'s stops each a bin, keyed to its flag and its trucks; a passenger at a fare\'s pick-up; a parcel at any other hand-in', () => {
    expect(of([SHIFT, ...FARE, PARCEL])).toEqual({
      bins: [{ id: 'bin-round', cabs: ['car-12', 'car-13'], done: 'errand:done:bin-round', stops: [{ at: [60, 0, 1], v: 'flag-stop-bin-round-1' }, { at: [120, 4, 2], v: 'flag-stop-bin-round-2' }] }],
      fares: [{ at: [5, 5, 0], held: 'held:bag:passenger', seed: 0 }],
      parcels: [{ at: [30, 3, 0], on: 'errand:done:pickup' }],
    });
    expect(of([{ kind: 'bag', slice: 'bag' }])).toBe(null);
    expect(jobStopsOf({})).toBe(null);
  });
  it('each moment rises, holds and falls inside itself, eased, never out of [0, 1]', () => {
    for (const M of [JOB_MOTION.lift, JOB_MOTION.tip]) {
      expect(jobEnv(-0.1, M.up, M.down)).toBe(0);
      expect(jobEnv((M.up[1] + M.down[0]) / 2, M.up, M.down)).toBe(1);
      expect(jobEnv(1.1, M.up, M.down)).toBe(0);
      for (let u = 0; u <= 1; u += 0.05) { const e = jobEnv(u, M.up, M.down); expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1); }
    }
  });
});
