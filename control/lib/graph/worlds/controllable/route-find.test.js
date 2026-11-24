import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// A WALK THAT FINDS ITS WAY (route-find.js): a cue's walk with `find` goes round what stands in the way, arriving only
// at the places it named; without it, the cast's straight line stops at the wall and says stuck. The concept on one
// pocket; and a page whose world walks with no `find` carries none of it.
const E = composeLive();
const hooks = { ground: () => 0 };
// a U-shaped pocket open to the west: the walker inside it, its place east of the back wall
const U = [
  { min: [10, -20, 0], max: [14, 20, 30] },
  { min: [-20, 16, 0], max: [14, 20, 30] },
  { min: [-20, -20, 0], max: [14, -16, 30] },
];
const world = () => E.createWorld({ colliders: U, entities: [{ id: 'elder', rule: { type: 'walk', speed: 0, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const walk = (find) => {
  const w = world(), e = w.byId.elder;
  E.castOps(w, [{ op: 'walk', who: 'elder', points: [[30, 0]], names: ['well'], speed: 6, ...(find ? { find: true } : {}) }]);
  let arrivals = 0, prevA = 0;
  for (let i = 0; i < 60 * 40 && (e.route || i === 0); i++) { E.stepWorld(w, {}, 1 / 60, hooks); if ((e.arrivals || 0) > prevA) { arrivals++; prevA = e.arrivals; } }
  return { e, arrivals };
};

describe('a walk that finds its way', () => {
  it('goes round the wall to the place it named, and arrives there only', () => {
    const { e, arrivals } = walk(true);
    expect(Math.hypot(e.transform.pos[0] - 30, e.transform.pos[1])).toBeLessThan(0.5);
    expect(arrivals).toBe(1);
    expect(e.arrivedAt).toBe('well');
    expect(e.stucks || 0).toBe(0);
  });

  it('without find, the straight line stops at the wall, stuck', () => {
    const { e } = walk(false);
    expect(e.transform.pos[0]).toBeLessThan(10);
    expect(e.stucks).toBe(1);
  });

  it('is opt-in on the page: absent, not a byte', () => {
    expect(emissionSource()).not.toContain('route-find');
    expect(emissionSource({ routeFind: true })).toContain("registerBodyOwner('route-find'");
  });
});
