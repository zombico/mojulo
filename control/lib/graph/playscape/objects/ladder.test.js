/**
 * The ladder: a climb from one level to the next (a lean ladder, fixed rungs, a rope, a net), called by its ends like
 * a bridge, holding the object laws and its own climb laws, built with the kit's joint, and climbed in the world: the
 * body takes hold, goes up, mounts the lip, comes back down from above, kicks off, and crosses a net.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { ladderParams, climbSurface, LADDER_VARIANT_IDS, LADDER_VARIANTS } from './ladder.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { dismantle } from '../destruct/dismantle.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const ladder = (spec) => resolveObject({ entry: 'ladder', to: [0, 0, 3], rise: 3, facing: [0, -1], ...spec });

describe('called by its ends', () => {
  it('a lean ladder stands 4:1 off the lip unless its foot is given', () => {
    const p = ladderParams({ to: [0, 0, 3], rise: 3, facing: [0, -1] });
    expect(p.lean).toBeCloseTo(75.96, 1);
    expect(climbSurface(p).base[1]).toBeCloseTo(-0.75, 3);   // a quarter of the rise out
    expect(ladderParams({ from: [0, -1.5, 0], to: [0, 0, 3] }).lean).toBeCloseTo(63.43, 1);
  });

  it('spaces its rungs evenly up the rise, near the asked pitch', () => {
    const p = ladderParams({ to: [0, 0, 2.9], rise: 2.9, facing: [0, -1] });
    expect(p.pitch * p.steps).toBeCloseTo(2.9, 6);
    expect(p.pitch).toBeGreaterThanOrEqual(0.25);
    expect(p.pitch).toBeLessThanOrEqual(0.3);
  });

  it('refuses what it cannot build, naming why', () => {
    expect(() => ladder({ variant: 'escalator' })).toThrow(/ladder, rungs, rope, net/);
    expect(() => ladder({ to: [0, 0, 0.3], rise: 0.3 })).toThrow(/at least 0.6 m/);
    expect(() => ladder({ elements: { gargoyles: true } })).toThrow(/not a ladder element/);
    expect(() => ladder({ timber: 'steel' })).toThrow(/timber is one of/);
    expect(() => resolveObject({ entry: 'ladder' })).toThrow(/give its ends/);
  });
});

describe('built of its elements, with the kit\'s joint', () => {
  it('every variant builds its elements; the joint word names the 33', () => {
    for (const v of LADDER_VARIANT_IDS) {
      const o = ladder({ variant: v, rise: 7, to: [0, 0, 7] });
      for (const e of LADDER_VARIANTS[v].elements.filter((x) => x !== 'joints')) expect(o.elements).toContain(e);
    }
    expect(ladder({ timber: 'culm' }).elements).toContain('lashings');
    expect(ladder({ timber: 'sawn' }).elements).toContain('pegs');
    expect(ladder({ variant: 'rungs' }).elements).toContain('collars');
    expect(ladder({ variant: 'rungs' }).elements).not.toContain('cage');   // caged past 6 m, or when asked
    expect(ladder({ variant: 'rungs', elements: { cage: true }, rise: 4, to: [0, 0, 4] }).elements).toContain('cage');
  });

  for (const v of LADDER_VARIANT_IDS) for (const rise of [2, 3, 5, 8]) {
    it(`${v}, ${rise} m holds the object laws and its climb laws`, () => {
      const o = ladder({ variant: v, rise, to: [0, 0, rise] });
      expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest)).toEqual([]);
      expect(o.laws.filter((l) => !l.ok)).toEqual([]);
    });
  }

  it('measures a ladder given its own numbers, never refusing it', () => {
    const steep = ladder({ from: [0, -0.2, 0] });
    expect(steep.laws.find((l) => l.law === 'four-to-one')).toMatchObject({ ok: false });
    const tall = ladder({ variant: 'rungs', rise: 8, to: [0, 0, 8], elements: { cage: false } });
    expect(tall.laws.find((l) => l.law === 'cage')).toMatchObject({ ok: false, value: 8 });
  });

  it('answers as a link: its climb, how long it takes, and where it lands you', () => {
    const o = ladder({});
    expect(o.climb).toMatchObject({ form: 'ladder', rise: 3, mounts: true, lateral: false });
    expect(o.climb.top[1]).toBeCloseTo(0.5, 6);   // onto the level, past the lip
    expect(ladder({ variant: 'net' }).climb.lateral).toBe(true);
    expect(ladder({ variant: 'rope', mount: false }).climb.top).toBeNull();
    expect(ladder({ variant: 'rope' }).climb.seconds).toBeGreaterThan(o.climb.seconds);
  });

  it('comes apart by its joints: sever the rails and the rungs fall', () => {
    const r = dismantle(ladder({ variant: 'rungs' }), { sever: ['brackets'], ground: 0 });
    expect(r.bodies.length).toBeGreaterThan(0);
  });
});

// two levels: the floor at 0 on the climb side (y < 0), a ledge 3 m up from y 0, its face a wall
const LEDGE = { min: [-6, 0, -1], max: [6, 6, 3] };
const ground = (pos) => (pos[1] >= 0 && pos[2] >= 3 - 0.4 ? 3 : 0);
function play(o, hero, input, ticks = 400) {
  const w = createWorld({ entities: [{ ...o.world.entities[0] }, { id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.3 }, ...hero }] });
  w.colliders = [LEDGE];
  const track = [];
  for (let i = 0; i < ticks; i++) { stepWorld(w, input(w.byId.hero, i), 1 / 60, { ground }); track.push({ pos: [...w.byId.hero.transform.pos], climbing: !!w.byId.hero.climbing, loco: w.byId.hero.locomotion }); }
  return { w, h: w.byId.hero, track };
}

describe('climbed in the world', () => {
  it('walk into it, go up it, and step off onto the level', () => {
    const o = ladder({});
    const { h, track } = play(o, { transform: { pos: [0, -3, 0], heading: Math.PI / 2 } }, () => ({ forward: 1 }));
    expect(track.some((s) => s.climbing && s.loco === 'climb')).toBe(true);
    expect(h.climbed).toMatchObject({ end: 'top' });
    expect(h.grounded).toBe(true);
    expect(h.transform.pos[2]).toBeCloseTo(3, 3);
    expect(h.transform.pos[1]).toBeGreaterThan(0.3);
    // it took about as long as the entry said
    const first = track.findIndex((s) => s.climbing), last = track.findLastIndex((s) => s.climbing);
    expect((last - first) / 60).toBeCloseTo(o.climb.seconds - 0.5, 0);
  });

  it('come down it from above, and let go at the foot', () => {
    const o = ladder({});
    // on the ledge, walking out over the lip toward the climb side; then hold back to go down
    const { h, track } = play(o, { transform: { pos: [0, 1.5, 3], heading: -Math.PI / 2 } }, (e) => ({ forward: e.climbing ? -1 : 1 }), 300);
    expect(track.some((s) => s.climbing)).toBe(true);
    expect(h.climbed).toMatchObject({ end: 'bottom' });
    expect(h.transform.pos[2]).toBeCloseTo(0, 3);
  });

  it('jump kicks off, out from the surface, and it cannot catch it again at once', () => {
    const o = ladder({ variant: 'rungs' });
    const { h, track } = play(o, { transform: { pos: [0, -1, 0], heading: Math.PI / 2 } }, (e, i) => ({ forward: i < 60 ? 1 : 0, jump: i === 60 ? 1 : 0 }), 160);
    const at = track[59].pos, after = track[100].pos;
    expect(track[59].climbing).toBe(true);
    expect(track[61].climbing).toBe(false);
    expect(after[1]).toBeLessThan(at[1] - 0.5);   // out, away from the wall
    expect(h.grounded).toBe(true);
  });

  it('a net is climbed across as well as up', () => {
    const o = ladder({ variant: 'net' });
    const { track } = play(o, { transform: { pos: [0, -3, 0], heading: Math.PI / 2 } }, (e) => ({ forward: e.climbing ? 0.3 : 1, strafe: e.climbing ? 1 : 0 }), 200);
    const xs = track.filter((s) => s.climbing).map((s) => s.pos[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.5);
  });

  it('a rope is caught from any side, falling past it toward it', () => {
    const o = ladder({ variant: 'rope', mount: false });
    const base = o.world.entities[0].rule.base;
    // dropped beside the rope, pressing toward it from +x
    const { track } = play(o, { transform: { pos: [base[0] + 0.5, base[1], 2.5], heading: Math.PI } }, () => ({ forward: 1 }), 30);
    expect(track.some((s) => s.climbing)).toBe(true);
  });
});
