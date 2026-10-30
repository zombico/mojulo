import { describe, expect, it } from 'vitest';

import { quickWorld, goalMechanics } from './quick.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { readSeats } from '../worlds/world-scene.js';

// SEATS, LOWERED: a gameworld whose cube says soul.seats two or four lays a body per extra seat
// beside the hero (the hero itself, on its rule; while its seat is empty, after the hero on the escort motive) and names
// them in the level's `seats`. One seat, or none said, lays the level as it was.
const W = (cube, quick = {}) => ({ ...quickWorld({ id: 'coop', quick: { goal: 'collect', pickup: 'coin', camera: 'side', ...quick }, style: { kit: 'trail-valley' } }), ...(cube ? { intent: { cube } } : {}) });
const level = (w) => {
  const G = readGameworld(w), [stage] = gameStages(w);
  return stageLevelOrder(G, stage, { ref: 'coop-level', heroRef: 'h', goal: (ends) => goalMechanics(w.quick, ends) }).args.manifest;
};

describe('seats, lowered from the cube', () => {
  it('two seats: a second hero on the lane beside the first, its seat named, both on the hero\'s side', () => {
    const m = level(W({ soul: { seats: 'two', join: 'drop-in' } }));
    const [hero, two] = m.entities;
    expect(m.seats).toEqual({ bodies: ['hero-2'], max: 2, join: 'drop-in' });
    expect(two).toMatchObject({ id: 'hero-2', pilotable: true, team: hero.team, body: hero.body });
    expect(two.rule).toEqual(hero.rule);   // the hero's own rule (the lane, the feel) when its player drives it
    expect(two.ambient).toMatchObject({ type: 'ai', mind: { motivation: 'escort' }, escort: 'hero' });
    expect(Math.hypot(two.transform.pos[0] - hero.transform.pos[0], two.transform.pos[1] - hero.transform.pos[1])).toBeCloseTo(1, 1);
    expect(readSeats(m.seats, m.entities)).toEqual(m.seats);   // what the page reads takes it as laid
  }, 60_000);

  it('four seats lay three more; one seat, or none said, lays nothing', () => {
    const four = level(W({ soul: { seats: 'four' } }));
    expect(four.seats.bodies).toEqual(['hero-2', 'hero-3', 'hero-4']);
    const one = level(W({ soul: { seats: 'one' } })), none = level(W(null));
    expect(one.seats).toBeUndefined();
    expect(one.entities).toEqual(none.entities);
    expect(none.entities.some((e) => /^hero-\d$/.test(e.id))).toBe(false);
  }, 60_000);

  it('soul.pool gives the seats lives: three each of their own, or three a seat shared', () => {
    expect(level(W({ soul: { seats: 'two', pool: 'own' } })).seats).toMatchObject({ lives: 3, pool: 'own' });
    expect(level(W({ soul: { seats: 'four', pool: 'shared' } })).seats).toMatchObject({ lives: 12, pool: 'shared' });
    expect(level(W({ soul: { seats: 'two' } })).seats.lives).toBeUndefined();
  }, 60_000);

  it('first person seats one: there is no body for a second player to take', () => {
    expect(level(W({ soul: { seats: 'two' } }, { camera: 'first-person' })).seats).toBeUndefined();
  }, 60_000);
});

describe('the sim with the lowered seats', () => {
  const DT = 1 / 60, FLAT = { ground: () => 0 };
  const hero = (id, x) => ({ id, pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, transform: { pos: [x, 0, 0], heading: 0 } });
  it('a seated body fallen below the floor comes back above seat 1; seat 1 never swaps onto a seated body', () => {
    const w = createWorld({ entities: [hero('p1', 0), hero('p2', 2), hero('p3', 4)], seats: { bodies: ['p2'], floor: -5 } });
    w.byId.p2.transform.pos = [3, 60, -6];
    stepWorld(w, { seats: { 2: {} } }, DT, { ground: (p) => (p[1] > 50 ? null : 0) });   // over a pit
    expect(w.byId.p2.transform.pos.slice(0, 2)).toEqual(w.byId.p1.transform.pos.slice(0, 2));
    expect(w.byId.p2.transform.pos[2]).toBeGreaterThan(-1);
    stepWorld(w, { swap: 1 }, DT, FLAT);
    expect(w.pilotId).toBe('p3');   // past the seated p2, to the next free body
    stepWorld(w, {}, DT, FLAT);
    stepWorld(w, { swap: 1 }, DT, FLAT);
    expect(w.pilotId).toBe('p1');
  });

  it('the seats a page reads are checked against the world', () => {
    const E = [hero('p1', 0), hero('p2', 2), { id: 'rock', transform: { pos: [0, 0, 0] } }];
    expect(() => readSeats({ bodies: ['rock'] }, E)).toThrow(/not a pilotable entity/);
    expect(() => readSeats({ bodies: ['p1'] }, E)).toThrow(/is the pilot/);
    expect(() => readSeats({ bodies: ['p2'], max: 4 }, E)).toThrow(/max is 2 to 2/);
    expect(() => readSeats({ bodies: ['p2'], seat: 2 }, E)).toThrow(/not a seats key/);
    expect(readSeats({ bodies: ['p2'], drop: 'pause' }, E)).toEqual({ bodies: ['p2'], max: 2, drop: 'pause' });
    expect(readSeats({ bodies: ['p2'], lives: 3 }, E)).toEqual({ bodies: ['p2'], max: 2, lives: 3, pool: 'own' });
    expect(() => readSeats({ bodies: ['p2'], pool: 'shared' }, E)).toThrow(/give lives/);
    expect(() => readSeats({ bodies: ['p2'], lives: 0 }, E)).toThrow(/1 to 99/);
  });
});
