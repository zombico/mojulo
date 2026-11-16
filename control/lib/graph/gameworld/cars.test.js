// A WORLD'S CARS: parked at the kerb beside where a town level starts, each a ride's build on its own drive rule with a
// cab the hero gets into; the run mints a ride once; a world without the key is as it was.
import { describe, it, expect } from 'vitest';
import { readGameworld } from './world.js';
import { gameStages, stageEnds } from './levels.js';
import { runSteps } from './runner.js';
import { readCars, carRides, carsExtra, CAB } from './cars.js';
import { RIDES } from './ride.js';
import { composeLive } from '../worlds/controllable/compose.js';

// the smallest town with a street to park on: one main-street segment
const TOWN = { evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12, enter: [], shops: { cards: ['electronics'] } };
// (a modern town's game, made for a monitor: its hero in street clothes, no powers and nothing in its hands)
const WORLD = { id: 'drive-about', name: 'Drive about', seed: 4, screen: 'screen', style: { kit: 'trail-valley' },
  characters: { direction: { tradition: 'western' }, hero: { looks: { body: { cast: 'male' }, underlayer: { type: 'outfit', style: 'streetwear' } }, motion: { vibe: ['bold'] }, actions: { idiom: 'city-stalker-like' } } }, cars: [{ ride: 'coupe' }, { ride: 'coupe' }], levels: { town: { name: 'Main street', seed: 4, geotown: TOWN } } };
const G = readGameworld(WORLD), stage = gameStages(G)[0], E = stageEnds(stage.manifest);
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a world\'s cars', () => {
  it('reads: one, a count, a list of rides; refuses the rest', () => {
    expect(readCars(undefined)).toBeNull();
    expect(readCars(true)).toEqual([{ ride: 'car' }]);
    expect(readCars(2).map((c) => c.ride)).toEqual(Object.keys(RIDES).slice(0, 2));
    expect(G.cars).toEqual([{ ride: 'coupe' }, { ride: 'coupe' }]);
    expect(carRides(G.cars)).toEqual(['coupe']);
    expect(() => readGameworld({ ...WORLD, cars: [{ ride: 'tank' }] })).toThrow(/cars\[0\].ride is/);
    expect(() => readGameworld({ ...WORLD, cars: 9 })).toThrow(/cars is true, a count/);
  });
  it('a town level tells its kerb: spots on its road beside its start, a car\'s length apart, clear of every box', () => {
    expect(E.kerbs.length).toBeGreaterThanOrEqual(2);
    for (const k of E.kerbs) {
      expect(E.colliders.some((c) => within([k.at[0], k.at[1], k.at[2] + 0.7], c))).toBe(false);
      expect(Math.hypot(k.at[0] - E.spawn[0], k.at[1] - E.spawn[1])).toBeLessThan(40);
    }
    expect(Math.hypot(E.kerbs[0].at[0] - E.kerbs[1].at[0], E.kerbs[0].at[1] - E.kerbs[1].at[1])).toBeGreaterThan(5);
    // (the nearest within a walk of the hero, and not on it)
    const d0 = Math.hypot(E.kerbs[0].at[0] - E.spawn[0], E.kerbs[0].at[1] - E.spawn[1]);
    expect(d0).toBeGreaterThan(1.2); expect(d0).toBeLessThan(16);
    expect(Object.keys(E)).not.toContain('kerbs');
  });
  it('stands each car at a spot: its ride\'s drive rule with a box, a cab, its build its figure', () => {
    const part = carsExtra(G.cars, (r) => `sk_${r}`, 4)(E);
    expect(part.entities.map((e) => e.id)).toEqual(['car-1', 'car-2']);
    const c = part.entities[0];
    expect(c.rule.type).toBe('drive');
    expect(c.rule.collideRadius).toBeGreaterThan(0);
    expect(c.mount).toMatchObject({ cab: true, reach: CAB.reach, slow: CAB.slow });
    expect(part.figures['car-1']).toMatchObject({ vehicleRef: 'sk_coupe' });
    expect(c.transform.pos.slice(0, 2)).toEqual(E.kerbs[0].at.slice(0, 2));
    // (a stage with no road beside its start stands none)
    expect(carsExtra(G.cars, () => 'x', 4)({ kerbs: [] })).toBeNull();
  });
  it('the run mints a ride once and lays the cars in the level; a world without the key has neither', () => {
    const S = runSteps(WORLD, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-')).order.manifest;
    expect(S.filter((x) => x.key.startsWith('car-')).map((x) => x.key)).toEqual(['car-coupe']);
    expect(S.find((x) => x.key === 'car-coupe').order.manifest.kind).toBe('assembler');
    const cars = level.entities.filter((e) => e.mount?.cab);
    expect(cars).toHaveLength(2);
    expect(level.figures['car-1'].vehicleRef).toBe(S.find((x) => x.key === 'car-coupe').ref);
    // (the hero still the pilot, on foot, and the level still its own)
    expect(level.entities.find((e) => e.pilotable)?.id).toBe('hero');
    // (made for a monitor, and its hero carries nothing: no weapon's figure beside its own)
    expect(level.screen).toBe('screen');
    expect(level.entities.find((e) => e.id === 'hero').weapon).toBeUndefined();
    const { cars: _c, ...bare } = WORLD, S0 = runSteps(bare, { ref: 'gw' }), L0 = S0.find((x) => x.key.startsWith('level-')).order.manifest;
    expect(S0.some((x) => x.key.startsWith('car-'))).toBe(false);
    expect((L0.entities ?? []).some((e) => e.mount)).toBe(false);
  });
});

describe('a car driven on the town\'s street (the level\'s own bodies on the runtime, its ground and its boxes)', () => {
  const S = runSteps(WORLD, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-')).order.manifest;
  const R = composeLive(), DT = 1 / 30, ground = (p) => E.ground(p[0], p[1]);
  const st = R.createWorld({ entities: level.entities, colliders: E.colliders, camera: level.camera });
  const run = (s, input = {}) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) R.stepWorld(st, input, DT, { ground }); };
  const hero = st.byId.hero, car = st.byId['car-1'];
  const boxed = (e) => E.colliders.some((c) => within([e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + 0.7], c));
  it('the hero walks to the car, gets in, drives down the street on its ground, stops, and gets out on foot', () => {
    // (set down within its reach, as a walk across the pavement leaves it)
    const K = E.kerbs[0], f = [Math.cos(K.heading), Math.sin(K.heading)], left = [-f[1], f[0]];
    hero.transform.pos = [K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4, E.ground(K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4) ?? K.at[2]];
    run(DT, { interact: 1 }); run(5);
    expect(st.pilotId).toBe('car-1');
    expect(hero.gone).toBe(true);
    const from = car.transform.pos.slice();
    run(4, { forward: 1 });
    const went = Math.hypot(car.transform.pos[0] - from[0], car.transform.pos[1] - from[1]);
    expect(went).toBeGreaterThan(8);
    // (on the town's ground all the way, never through a box)
    const gz = E.ground(car.transform.pos[0], car.transform.pos[1]);
    expect(gz).not.toBeNull();
    expect(Math.abs(car.transform.pos[2] - (car.rule.eye ?? 0) - gz)).toBeLessThan(0.3);
    expect(boxed(car)).toBe(false);
    run(8, { forward: -1 }); car.speed = 0; run(0.5);
    run(DT, { interact: 1 }); run(1.5);
    expect(st.pilotId).toBe('hero');
    expect(hero.gone).toBe(false);
    expect(boxed(hero)).toBe(false);
    expect(E.ground(hero.transform.pos[0], hero.transform.pos[1])).not.toBeNull();
    // (and walks on)
    const h0 = hero.transform.pos.slice(); run(1, { forward: 1 });
    expect(Math.hypot(hero.transform.pos[0] - h0[0], hero.transform.pos[1] - h0[1])).toBeGreaterThan(0.5);
  });
  it('a wall stops it: driven at the row of shops, it never enters a box', () => {
    // (turned to face the buildings beside the street and driven at them)
    const a = shopsAt(), to = Math.atan2(a[1] - car.transform.pos[1], a[0] - car.transform.pos[0]);
    hero.transform.pos = [car.transform.pos[0], car.transform.pos[1] + 0.1, car.transform.pos[2]];
    st.pilotId = 'car-1'; car.riderId = 'hero'; hero.mountedOn = 'car-1'; hero.mountPhase = 'ride'; hero.riderRule = hero.riderRule ?? hero.rule; hero.rule = { type: 'mounted' };
    car.transform.heading = to; car.speed = 0;
    run(6, { forward: 1 });
    expect(boxed(car)).toBe(false);
    // (nor a shop's inside through its door: a car is wider than a doorway)
    const t = E.tills[0].at;
    expect(Math.hypot(car.transform.pos[0] - t[0], car.transform.pos[1] - t[1])).toBeGreaterThan(2);
    function shopsAt() { const q = E.tills[0].at; return [q[0], q[1]]; }
  });
});
