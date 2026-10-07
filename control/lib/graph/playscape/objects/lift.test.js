/**
 * The lift: a deck between stops. It answers for its shaft, landings, headroom and ride time; two stops ride, more
 * call; and in the world a ride lift waits for its rider, carries them up, and comes home after its dwell.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { liftParams } from './lift.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const lift = (spec) => resolveObject({ entry: 'lift', ...spec });

describe('the lift answers for itself', () => {
  it('its shaft runs from under the lowest stop to a rider\'s headroom over the highest', () => {
    const o = lift({ area: 4, stops: [0, 6], thick: 0.4 });
    expect(o.shaft.min[2]).toBeCloseTo(-0.4, 6);
    expect(o.shaft.max[2]).toBeCloseTo(6 + 2.1, 6);
    expect(o.shaft.max[0] - o.shaft.min[0]).toBeCloseTo(2, 6);
  });

  it('lands at every stop, with a step off to either side', () => {
    const o = lift({ stops: [0, 4, 9] });
    expect(o.landings.map((l) => l.z)).toEqual([0, 4, 9]);
    expect(o.landings[1].t).toBeCloseTo(4 / 9, 4);
    expect(o.landings.every((l) => l.exits.length === 2)).toBe(true);
  });

  it('two stops ride, more stops are called', () => {
    expect(lift({ stops: [0, 6] }).variant).toBe('ride');
    expect(lift({ stops: [0, 4, 9] }).variant).toBe('call');
    expect(lift({ stops: [0, 4, 9] }).world.note).toMatch(/not in the world runtime yet/);
  });

  it('says how long a ride takes, and refuses stops a rider could not stand between', () => {
    expect(lift({ stops: [0, 6], speed: 2 }).ride).toEqual({ seconds: 3, dwell: 2 });
    expect(() => liftParams({ stops: [0, 1.5] })).toThrow(/at least 2\.1 m apart/);
  });
});

describe('in the platformer world', () => {
  it('waits for its rider, carries them up, and comes home after its dwell', () => {
    const o = lift({ area: 4, stops: [0, 6], speed: 3, dwell: 1, at: [0, 0, 0] });
    const w = createWorld({ entities: [o.world.entities[0], { id: 'hero', rule: { type: 'platform', speed: 0 }, transform: { pos: [8, 0, 0] } }] });
    const deckTop = () => w.byId.lift.transform.pos[2] + 0.2;
    const ground = (pos) => (Math.abs(pos[0] - w.byId.lift.transform.pos[0]) <= 1 && Math.abs(pos[1]) <= 1 ? deckTop() : 0);
    for (let i = 0; i < 60; i++) stepWorld(w, {}, 1 / 60, { ground });
    expect(deckTop()).toBeCloseTo(0, 3);                              // nobody on: it waits at the bottom
    w.byId.hero.transform.pos = [0, 0, deckTop()];                    // step on
    for (let i = 0; i < 150; i++) stepWorld(w, {}, 1 / 60, { ground });
    expect(deckTop()).toBeCloseTo(6, 2);                              // 6 m at 3 m/s: up in 2 s
    expect(w.byId.hero.transform.pos[2]).toBeCloseTo(6, 1);           // and the rider with it
    w.byId.hero.transform.pos = [8, 0, 6];                            // step off at the top
    for (let i = 0; i < 60 * 4; i++) stepWorld(w, {}, 1 / 60, { ground });
    expect(deckTop()).toBeCloseTo(0, 2);                              // a second's dwell, two seconds down: home
  });
});
