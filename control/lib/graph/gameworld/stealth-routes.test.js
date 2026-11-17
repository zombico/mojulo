// Stealth routes: the ways through a watched place, found by search (stealth-routes.js). The concept, on the smallest
// places that show it: a watcher's sight is its cone, range and a line in height; a patrol's round is timed; the first
// try is seen, and the ways that are not cost patience or a detour.
import { describe, it, expect } from 'vitest';
import { sneakRoutes, sees, watcherAt, SNEAK_STANCES } from './stealth-routes.js';

const E = SNEAK_STANCES;
describe('what a watcher sees', () => {
  const post = { id: 'g', at: [0, 0], heading: 0, cone: 0.6, range: 14 };
  it('inside its cone and range, with a clear line; not behind it, not past its range', () => {
    expect(sees(post, [8, 0], E.stand.eye, 0, [])).toBe(true);
    expect(sees(post, [-8, 0], E.stand.eye, 0, [])).toBe(false);
    expect(sees(post, [8, 8], E.stand.eye, 0, [])).toBe(false);
    expect(sees(post, [20, 0], E.stand.eye, 0, [])).toBe(false);
  });
  it('a line in height: a metre of cover hides a crouch and not a body standing; half a metre hides only a body lying', () => {
    const wall = (h) => [{ min: [4, -3, 0], max: [4.5, 3, h] }];
    expect(sees(post, [6, 0], E.stand.eye, 0, wall(1))).toBe(true);
    expect(sees(post, [6, 0], E.crouch.eye, 0, wall(1))).toBe(false);
    // (close behind the half metre: from further back the line clears it and a lying body is seen)
    expect(sees(post, [5, 0], E.crouch.eye, 0, wall(0.5))).toBe(true);
    expect(sees(post, [5, 0], E.prone.eye, 0, wall(0.5))).toBe(false);
    expect(sees(post, [9, 0], E.prone.eye, 0, wall(0.5))).toBe(true);
  });
  it('a patrol walks its round and looks the way it walks', () => {
    const p = { id: 'p', at: [0, 0], to: [8, 0], speed: 2 };
    expect(watcherAt(p, 2)).toMatchObject({ pos: [4, 0], heading: 0 });
    expect(watcherAt(p, 6).pos[0]).toBeCloseTo(4, 6);
    expect(Math.abs(watcherAt(p, 6).heading)).toBeCloseTo(Math.PI, 6);   // (on its way back)
  });
});

describe('the ways through', () => {
  // a lane 9 m wide and 30 long, walled either side by the bounds; a post in its middle looking down it at the start
  const lane = (extra = {}) => ({ bounds: [0, 0, 9, 30], start: [4.5, 1], goal: [4.5, 29], seconds: 200, ...extra });
  it('a post that looks down the lane sees the straight way, and with no cover there is no way unseen', () => {
    const R = sneakRoutes(lane({ watchers: [{ id: 'post', at: [4.5, 20], heading: -Math.PI / 2, cone: 1.2, range: 14, hear: 0 }] }));
    expect(R.direct.seen).toMatchObject({ by: 'post' });
    expect(R.sneak).toBeNull();
    expect(R.verdicts.find((v) => v.law === 'a-way-unseen').holds).toBe(false);
  });
  it('a low wall along one side is a way past it: lower, slower and longer than the straight way', () => {
    // (the wall hides a crouch from the post; it stops short of the far end, where the post no longer looks)
    const R = sneakRoutes(lane({ boxes: [{ min: [2.4, 5, 0], max: [2.8, 24, 1.05] }], watchers: [{ id: 'post', at: [5.5, 20], heading: -Math.PI / 2, cone: 1.2, range: 14, hear: 0 }] }));
    expect(R.direct.seen).not.toBeNull();
    expect(R.sneak).not.toBeNull();
    expect(R.sneak.crouch + R.sneak.crawl).toBeGreaterThan(8);
    expect(R.sneak.seconds).toBeGreaterThan(R.direct.seconds);
    expect(R.verdicts.find((v) => v.law === 'it-costs-patience-or-a-detour').holds).toBe(true);
  });
  it('a patrol across the lane: the straight way is seen, and the way found is seen by no one when it is walked again', () => {
    const patrol = { id: 'patrol', at: [0.5, 15], to: [8.5, 15], speed: 1.6, cone: 1.2, range: 12, hear: 5 };
    const boxes = [{ min: [0, 9.6, 0], max: [3, 10, 1.6] }];
    const R = sneakRoutes(lane({ watchers: [patrol], boxes }));
    expect(R.direct.seen).toMatchObject({ by: 'patrol' });
    expect(R.sneak).not.toBeNull();
    for (const p of R.sneak.path) expect(sees(patrol, p.at, E[p.stance].eye, p.t, boxes), `at ${p.t} s`).toBe(false);
    expect(R.sneak.path.at(-1).at[1]).toBeGreaterThan(26);
  });
  it('an empty place asks for no sneak, and says so', () => {
    const R = sneakRoutes(lane());
    expect(R.direct.seen).toBeNull();
    expect(R.verdicts.find((v) => v.law === 'the-first-try-is-seen').holds).toBe(false);
    expect(R.sneak.waits).toBe(0);
  });
});
