// FOOTSTEPS (mind.js `rule.trail`): a party member walks where its ward walked. Round a wall the ward turned a corner of,
// it keeps to the ward's own ground (never through the wall), stands its own distance back along the steps when the ward
// stops, and one woken or left far behind is set down on its point.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const E = composeLive();
const DT = 1 / 30;
// a wall along x from -20 to 2 at y = 3: the ward walks north past its end, then west behind it
const WALL = { min: [-20, 2.8, 0], max: [2, 3.2, 3] };
const follower = (id, at, followDist) => ({ id, team: 'party', rule: { type: 'ai', speed: 4, mind: { motivation: 'escort', aggressiveness: 'passive' }, trail: true, escort: 'hero', followDist, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 }, body: { type: 'figure-rig', figure: id }, transform: { pos: at, heading: Math.PI / 2 } });
function world() {
  return E.createWorld({
    colliders: [WALL],
    entities: [
      { id: 'hero', pilotable: true, team: 'party', rule: { type: 'ai', speed: 0 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [4, 0, 0], heading: Math.PI / 2 } },
      follower('m1', [4, -1.6, 0], 1.6), follower('m2', [4, -2.7, 0], 2.7),
    ],
  });
}
// the ward moved by hand along its way (its own rule stands still), the world stepped between
function walk(st, path, speed, seen) {
  const h = st.byId.hero.transform;
  for (const [x, y] of path) {
    for (;;) {
      const dx = x - h.pos[0], dy = y - h.pos[1], d = Math.hypot(dx, dy); if (d < 1e-6) break;
      const s = Math.min(d, speed * DT); h.pos[0] += (dx / d) * s; h.pos[1] += (dy / d) * s; h.heading = Math.atan2(dy, dx);
      E.stepWorld(st, {}, DT, { ground: () => 0 });
      if (seen) seen(st);
    }
  }
}
const at = (st, id) => st.byId[id].transform.pos;

describe('a party member in its ward\'s footsteps', () => {
  it('rounds the wall the ward rounded, never through it, and stands in a file behind it when it stops', () => {
    const st = world(), crossed = [];
    walk(st, [[4, 6], [-6, 6]], 3.5, (s) => { for (const id of ['m1', 'm2']) { const p = at(s, id); if (p[0] < 2 && p[1] > 2.8 && p[1] < 3.2) crossed.push(id); } });
    for (let i = 0; i < 60; i++) E.stepWorld(st, {}, DT, { ground: () => 0 });
    expect(crossed).toEqual([]);
    // (behind the wall now, west along the ward's way, each its own distance back: a file, nearer first)
    const h = at(st, 'hero'), d = (id) => Math.hypot(at(st, id)[0] - h[0], at(st, id)[1] - h[1]);
    for (const id of ['m1', 'm2']) expect(at(st, id)[1]).toBeGreaterThan(5);
    expect(d('m1')).toBeCloseTo(1.6, 0);
    expect(d('m2')).toBeCloseTo(2.7, 0);
    expect(at(st, 'm2')[0]).toBeGreaterThan(at(st, 'm1')[0]);
  });

  it('one woken far behind is set down on its point', () => {
    const st = world();
    st.byId.m2.transform.pos = [-15, -10, 0];
    walk(st, [[4, 2]], 3, null);
    const h = at(st, 'hero');
    expect(Math.hypot(at(st, 'm2')[0] - h[0], at(st, 'm2')[1] - h[1])).toBeLessThan(3.5);
  });
});
