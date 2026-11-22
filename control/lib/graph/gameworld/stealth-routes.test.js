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
  it('a wire is seen through: it stops a body walking, never a line of sight', () => {
    const wire = [{ min: [4, -3, 0], max: [4.5, 3, 1.5], sight: false }];
    expect(sees(post, [6, 0], E.prone.eye, 0, wire)).toBe(true);
    const R = sneakRoutes({ bounds: [0, 0, 9, 12], start: [4.5, 1], goal: [4.5, 11], boxes: [{ min: [0, 5, 0], max: [9, 5.5, 1], sight: false }], watchers: [], seconds: 60 });
    expect(R.direct).toBeNull();
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
  it('a strip of tall grass is a way past a post that sees the whole lane: low in the grass, never seen', () => {
    const post = { id: 'post', at: [7, 20], heading: -Math.PI / 2, cone: 1.2, range: 14, hear: 0 };
    const veils = [5, 9, 13, 17, 21, 25].map((y) => ({ at: [2.5, y], r: 2.2, h: 1.2 }));
    expect(sneakRoutes(lane({ watchers: [post] })).sneak).toBeNull();
    const R = sneakRoutes(lane({ watchers: [post], veils }));
    expect(R.direct.seen).toMatchObject({ by: 'post' });
    expect(R.sneak).not.toBeNull();
    expect(R.sneak.crouch + R.sneak.crawl).toBeGreaterThan(6);
    for (const p of R.sneak.path) expect(sees(post, p.at, E[p.stance].eye, p.t, [], veils), `at ${p.t} s`).toBe(false);
    // (standing in it is no use: the eye is over the grass)
    expect(sees(post, [2.5, 13], E.stand.eye, 0, [], veils)).toBe(true);
    expect(sees(post, [2.5, 13], E.crouch.eye, 0, [], veils)).toBe(false);
  });
  it('an empty place asks for no sneak, and says so', () => {
    const R = sneakRoutes(lane());
    expect(R.direct.seen).toBeNull();
    expect(R.verdicts.find((v) => v.law === 'the-first-try-is-seen').holds).toBe(false);
    expect(R.sneak.waits).toBe(0);
  });
});

describe('a guard only a takedown passes', () => {
  // a lane walled across with a cut in its middle; a sentry paces from the cut out north and back, looking wide, feeling a
  // body within three metres, and turning all the way round at each end; a clump of grass beside the cut to wait in; the
  // goal well past his far end (one a step past it is reached as he starts to turn)
  const sentry = { id: 'sentry', at: [4.5, 15], to: [4.5, 25], speed: 1.1, cone: 1.1, range: 16, hear: 7, near: { r: 3, back: 100 }, look: { secs: 6 } };
  const boxes = [{ min: [0, 14.8, 0], max: [3.4, 15.2, 1.2] }, { min: [5.6, 14.8, 0], max: [9, 15.2, 1.2] }];
  const place = { bounds: [0, 0, 9, 40], start: [4.5, 2], goal: [4.5, 38], seconds: 120, boxes, veils: [{ at: [1.6, 12], r: 1.6, h: 1.2 }], watchers: [sentry] };
  it('a patrol\'s look round: it stands at its end and turns all the way round, one way, and on to face back', () => {
    const T = 10 / 1.1, a = watcherAt(sentry, T + 0.01), b = watcherAt(sentry, T + 3), c = watcherAt(sentry, T + 6 - 0.01);
    expect(a.pos).toEqual([4.5, 25]); expect(a.looking).toBe(true);
    expect(b.heading - a.heading).toBeCloseTo(1.5 * Math.PI, 1);
    expect(Math.cos(c.heading - Math.PI / 2)).toBeCloseTo(-1, 2);        // (on to face back)
    expect(watcherAt(sentry, T + 7).pos[1]).toBeLessThan(25);             // (and walks back)
    expect(watcherAt({ ...sentry, look: undefined }, T + 1).looking).toBeUndefined();
  });
  it('near: a body within reach is seen at his side, never square behind him while he walks; all round while he looks round', () => {
    const at = (t) => watcherAt(sentry, t).pos;
    expect(sees({ ...sentry, near: undefined }, [at(2)[0] + 2, at(2)[1]], E.crouch.eye, 2, [])).toBe(false);   // (out of the cone)
    expect(sees(sentry, [at(2)[0] + 2, at(2)[1]], E.crouch.eye, 2, [])).toBe(true);                           // (at his side)
    expect(sees(sentry, [at(2)[0], at(2)[1] - 2], E.crouch.eye, 2, [])).toBe(false);                          // (square behind)
    const T = 10 / 1.1, h = watcherAt(sentry, T + 1).heading, P = [4.5 - 2 * Math.cos(h), 25 - 2 * Math.sin(h)];
    expect(sees(sentry, P, E.crouch.eye, T + 1, [])).toBe(true);                                                // (behind, as he looks round)
  });
  it('the cut on his line, the open ground swept as he turns: no way past him standing; one with him taken down from behind', () => {
    const R = sneakRoutes({ ...place, takedown: { by: ['sentry'] }, needs: 'takedown' }), law = (id) => R.verdicts.find((v) => v.law === id);
    expect(law('the-first-try-is-seen').holds).toBe(true);
    expect(law('no-way-past-standing').holds, law('no-way-past-standing').says).toBe(true);
    expect(law('a-takedown-opens-it').holds, law('a-takedown-opens-it').says).toBe(true);
    // (taken from the arc behind him, within reach, and never seen before it)
    const D = R.taken.down, g = watcherAt(sentry, D.t), dx = D.at[0] - g.pos[0], dy = D.at[1] - g.pos[1], d = Math.hypot(dx, dy);
    expect(d).toBeLessThanOrEqual(1.5);
    expect(-(Math.cos(g.heading) * dx + Math.sin(g.heading) * dy) / d).toBeGreaterThanOrEqual(Math.cos((50 * Math.PI) / 180));
    for (const p of R.taken.path.filter((q) => q.t < D.t)) expect(sees(sentry, p.at, E[p.stance].eye, p.t, boxes, place.veils), `at ${p.t} s`).toBe(false);
    // (and the same place without the takedown has no way: the takedown is what opens it)
    expect(sneakRoutes(place).sneak).toBeNull();
  }, 120_000);
  it('two bodies never share ground: no way passes within a body\'s width of a watcher on its feet', () => {
    const R = sneakRoutes({ bounds: [0, 0, 9, 30], start: [4.5, 1], goal: [4.5, 29], seconds: 120, watchers: [{ id: 'p', at: [0.5, 15], to: [8.5, 15], speed: 1.6, cone: 0.3, range: 3, hear: 0 }] });
    for (const p of R.sneak.path) { const g = watcherAt({ at: [0.5, 15], to: [8.5, 15], speed: 1.6 }, p.t); expect(Math.hypot(p.at[0] - g.pos[0], p.at[1] - g.pos[1])).toBeGreaterThanOrEqual(0.7); }
  });
});

