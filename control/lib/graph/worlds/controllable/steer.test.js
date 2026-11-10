import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

// STEERED WHEELS (steer.js): a body that turns about a point beside it, by its front wheels' angle. On the runtime: the
// circle at full lock is the wheelbase over the lock's tangent; standing it does not turn; reversing it turns the other
// way; its wheels are steered at their rate; a body without `steer` is untouched.
const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const STEER = { wheelbase: 2, max: 30, rate: 60 };
const world = (steer = STEER) => E.createWorld({ entities: [{ id: 'v', pilotable: true, rule: { type: 'walk', speed: 5, turn: 2, eye: 0, ...(steer ? { steer } : {}) }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } }] });
const run = (w, input, n) => { for (let i = 0; i < n; i++) E.stepWorld(w, input, DT, hooks); return w.byId.v; };

describe('steered wheels', () => {
  it('at full lock it drives a circle of its wheelbase over the lock\'s tangent, turning right on D', () => {
    const w = world(), v = run(w, { forward: 1, turn: 1 }, 60);
    expect(v.steer).toBeCloseTo(STEER.max, 6);
    const h0 = v.transform.heading;
    run(w, { forward: 1, turn: 1 }, 60);
    const rate = -(v.transform.heading - h0);   // (heading + is a left turn)
    expect(rate).toBeCloseTo((5 * Math.tan(Math.PI / 6)) / STEER.wheelbase, 3);
  });
  it('standing it does not turn; reversing it turns the other way', () => {
    const w = world(), v = run(w, { forward: 0, turn: 1 }, 60);
    expect(v.transform.heading).toBe(0);
    expect(v.steer).toBeCloseTo(STEER.max, 6);
    run(w, { forward: -1, turn: 1 }, 30);
    expect(v.transform.heading).toBeGreaterThan(0);
  });
  it('its wheels are steered at their rate, and back to straight when let go', () => {
    const w = world(), v = run(w, { forward: 1, turn: 1 }, 15);
    expect(v.steer).toBeCloseTo(STEER.rate * 15 * DT, 6);
    run(w, { forward: 1, turn: 0 }, 60);
    expect(v.steer).toBeCloseTo(0, 6);
  });
  it('at speed its lock is what its grip allows: its wheels along the circle it drives', () => {
    const fast = { wheelbase: 2, max: 30, rate: 600 }, w = E.createWorld({ entities: [{ id: 'v', pilotable: true, rule: { type: 'walk', speed: 12, turn: 0.5, eye: 0, steer: fast }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } }] });
    const v = run(w, { forward: 1, turn: 1 }, 30), h0 = v.transform.heading;
    expect(v.steer).toBeCloseTo((Math.atan((2 * 0.5) / 12) * 180) / Math.PI, 4);
    run(w, { forward: 1, turn: 1 }, 30);
    expect(-(v.transform.heading - h0) * 2).toBeCloseTo((12 * Math.tan((v.steer * Math.PI) / 180)) / 2, 4);
  });
  it('a body without steer turns as its rule turns it, in place', () => {
    const v = run(world(null), { forward: 0, turn: 1 }, 30);
    expect(v.transform.heading).toBeLessThan(0);
    expect(v.steer).toBeUndefined();
  });
});
