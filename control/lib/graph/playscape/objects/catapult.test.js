/**
 * The catapult: it stays put and throws the player, tuned by the approach (fixed, redirect, bounce). Its arc is
 * stepped with the platform rule's own integrator, so a solved target is where the world lands the rider; the rider
 * steers in the air unless the throw is locked (a scenic route).
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { catapultParams, throwFor, flight, CATAPULT_VARIANT_IDS } from './catapult.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const cat = (spec) => resolveObject({ entry: 'catapult', ...spec });

describe('the throw, by the approach', () => {
  it('fixed throws one arc whatever the approach', () => {
    const p = catapultParams({ mode: 'fixed', power: 12, angle: 60 });
    expect(throwFor(p, { run: [0, 0] })).toEqual(throwFor(p, { run: [9, 0], fall: 20 }));
  });

  it('redirect keeps the run-up\'s speed and sends it along the pad', () => {
    const p = catapultParams({ mode: 'redirect', dir: [0, 1], power: 10, angle: 45, gain: 1 });
    const v = throwFor(p, { run: [4, 0] });   // run in sideways at 4 m/s: thrown along +y at 10 + 4
    expect(Math.hypot(...v)).toBeCloseTo(14, 6);
    expect(v[0]).toBeCloseTo(0, 6);
  });

  it('bounce returns the fall, at least its power, and keeps the run', () => {
    const p = catapultParams({ mode: 'bounce', power: 8, restitution: 0.8 });
    expect(throwFor(p, { run: [2, 1], fall: 20 })).toEqual([2, 1, 16]);
    expect(throwFor(p, { fall: 3 })[2]).toBe(8);
  });

  it('a cone takes only the approaches it faces', () => {
    const p = catapultParams({ mode: 'redirect', dir: [1, 0], cone: 60 });
    expect(throwFor(p, { run: [6, 0] })).not.toBeNull();
    expect(throwFor(p, { run: [-6, 0] })).toBeNull();
    expect(throwFor(p, { run: [0, 0] })).toBeNull();   // a cone needs a run-up
    expect(cat({ variant: 'redirect', cone: 60, approach: { run: [0, 6] } }).arc).toBeNull();
  });

  it('refuses what it cannot build, naming why', () => {
    expect(() => cat({ variant: 'sling' })).toThrow(/fixed, redirect, bounce/);
    expect(() => cat({ variant: 'bounce', target: [6, 0, 0] })).toThrow(/fixed throw only/);
    expect(() => cat({ variant: 'fixed', target: [200, 0, 0], cap: 20 })).toThrow(/out of reach/);
  });
});

describe('it answers for itself', () => {
  it('a fixed throw solves its power to land on a target', () => {
    const o = cat({ variant: 'fixed', target: [10, 0, 2], at: [0, 0, 0] });
    expect(o.arc.land[0]).toBeCloseTo(10, 3);
    expect(o.arc.land[2]).toBeCloseTo(o.pad.top[2] + 2, 6);
    expect(o.arc.apex[2]).toBeGreaterThan(o.arc.land[2]);
  });

  it('its tube holds the rider\'s body all along the arc', () => {
    const o = cat({ variant: 'fixed', power: 14 });
    for (const q of o.arc.points) {
      expect(o.arc.tube.some((b) => q[0] >= b.min[0] - 1e-6 && q[0] <= b.max[0] + 1e-6 && q[2] >= b.min[2] - 1e-6 && q[2] + 1.8 <= b.max[2] + 1e-6)).toBe(true);
    }
  });

  it('steers by default; a locked throw has no reach', () => {
    expect(cat({ variant: 'fixed' }).steer).toBe(true);
    expect(cat({ variant: 'fixed' }).reach).toBeGreaterThan(0);
    expect(cat({ variant: 'fixed', locked: true })).toMatchObject({ steer: false, reach: 0 });
  });

  it('its plate is a lift leaf: t is the throw', () => {
    const [a, b] = [0, 1].map((t) => cat({ variant: 'fixed', t }).collider[0]);
    expect(b.min[2] - a.min[2]).toBeCloseTo(0.25, 6);
  });

  it('lowers to a pad with its collider and a launcher', () => {
    const w = cat({ variant: 'redirect', cone: 90, locked: true }).world;
    expect(w.colliders).toHaveLength(1);
    expect(w.entities[0].rule).toMatchObject({ type: 'launcher', mode: 'redirect', cone: 90, locked: true });
  });
});

describe('the greybox skin holds the object laws', () => {
  for (const variant of CATAPULT_VARIANT_IDS) for (const area of [1, 2.25, 4]) for (const t of [0, 1]) {
    it(`${variant}, ${area} m², t ${t}`, () => {
      const o = cat({ variant, area, t });
      expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest)).toEqual([]);
    });
  }
});

// a level: the floor at 0, the pad (top 0.3) at the origin, and a ledge 2 m up from x 8 to 14
const level = (o) => (pos) => {
  const h = o.pad.half;
  if (Math.abs(pos[0] - o.pad.top[0]) <= h[0] && Math.abs(pos[1] - o.pad.top[1]) <= h[1]) return o.pad.top[2];
  if (pos[0] >= 8 && pos[0] <= 14 && Math.abs(pos[1]) <= 3) return 2.3;
  return 0;
};
function play(o, hero, input = () => ({}), ticks = 300) {
  const w = createWorld({ entities: [{ ...o.world.entities[0] }, { id: 'hero', pilotable: true, rule: { type: 'platform' }, ...hero }] });
  const ground = level(o), track = [];
  let launchedAt = -1;
  for (let i = 0; i < ticks; i++) {
    stepWorld(w, input(w.byId.hero), 1 / 60, { ground });
    track.push([...w.byId.hero.transform.pos]);
    if (launchedAt < 0 && w.byId.catapult.lastLaunch) launchedAt = i;
  }
  return { w, track, after: track.slice(launchedAt) };
}

describe('in the platformer world', () => {
  it('a fixed throw at a target lands the rider on it, where the entry said', () => {
    const o = cat({ variant: 'fixed', target: [10, 0, 2] });
    const { w, track } = play(o, { transform: { pos: [0, 0, 1] } });   // dropped onto the pad
    expect(w.byId.catapult.lastLaunch).toMatchObject({ rider: 'hero', mode: 'fixed' });
    const h = w.byId.hero.transform.pos;
    expect(w.byId.hero.grounded).toBe(true);
    expect(h[2]).toBeCloseTo(2.3, 3);
    expect(h[0]).toBeCloseTo(o.arc.land[0], 0);
    expect(Math.abs(h[0] - 10)).toBeLessThan(0.25);
    expect(Math.max(...track.map((p) => p[2]))).toBeCloseTo(o.arc.apex[2], 1);
  });

  it('redirect: a faster run-up goes further', () => {
    const o = cat({ variant: 'redirect', power: 6, angle: 40, at: [6, 0, 0] });
    const land = (speed) => {
      const { w } = play(o, { rule: { type: 'platform', speed }, transform: { pos: [0, 0, 0], heading: 0 } }, () => ({ forward: 1 }), 120);
      return w.byId.catapult.lastLaunch.vel;
    };
    const slow = land(4), fast = land(8);
    expect(Math.hypot(...fast)).toBeGreaterThan(Math.hypot(...slow) + 3);
  });

  it('bounce: a higher drop goes higher', () => {
    const o = cat({ variant: 'bounce', power: 6, restitution: 0.9 });
    const peak = (z) => Math.max(...play(o, { transform: { pos: [0, 0, z] } }, () => ({}), 240).after.map((p) => p[2]));
    expect(peak(10)).toBeGreaterThan(peak(3) + 2);
  });

  it('the rider steers in the air; a locked throw holds its arc', () => {
    // the stick is held sideways (+y) only while airborne from the throw
    const run = (locked) => play(cat({ variant: 'fixed', target: [10, 0, 2], locked }), { transform: { pos: [0, 0, 1], heading: Math.PI / 2 } }, (h) => ({ forward: h.launchedBy ? 1 : 0 })).w.byId.hero.transform.pos;
    const steered = run(false), held = run(true);
    expect(Math.abs(held[1])).toBeLessThan(1e-6);   // locked: the stick does nothing until it lands
    expect(Math.abs(held[0] - 10)).toBeLessThan(0.25);
    expect(steered[1]).toBeGreaterThan(1);          // free: it drifts under the held stick
  });
});
