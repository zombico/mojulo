// A TOWN'S CARS: the cars a town parks nearest where its level starts are bodies its hero gets into, each the town's own
// model in its own paint where the town stood it, on its class's drive rule with a cab; the town draws the rest, and
// none where a body stands; nothing is asked for and nothing is minted.
import { describe, it, expect } from 'vitest';
import { readGameworld } from './world.js';
import { gameStages, stageEnds } from './levels.js';
import { runSteps } from './runner.js';
import { levelCars, carsExtra, CAB } from './cars.js';
import { CAR_CARDS } from '../car-shelf/car-library.js';
import { assembleGeotownScene, GEOTOWN_KEYS } from '../geotown/scene.js';
import { composeLive } from '../worlds/controllable/compose.js';

// the smallest town that parks cars by its street: one main-street segment
const TOWN = { evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12, enter: [], shops: { cards: ['electronics'] } };
// (a modern town's game, made for a monitor: its hero in street clothes, no powers and nothing in its hands)
const WORLD = { id: 'drive-about', name: 'Drive about', seed: 4, screen: 'screen', style: { kit: 'trail-valley' },
  characters: { direction: { tradition: 'western' }, hero: { looks: { body: { cast: 'male' }, underlayer: { type: 'outfit', style: 'streetwear' } }, motion: { vibe: ['bold'] }, actions: { idiom: 'city-stalker-like' } } }, levels: { town: { name: 'Main street', seed: 4, geotown: TOWN } } };
const G = readGameworld(WORLD), stage = gameStages(G)[0], E = stageEnds(stage.manifest);
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a town\'s cars', () => {
  it('a world takes no cars key: the cars are its town\'s', () => {
    expect(() => readGameworld({ ...WORLD, cars: true })).toThrow(/cars/);
  });
  it('a town level tells the cars it parks: their models and paints, where they stand', () => {
    expect(E.parked.length).toBeGreaterThan(0);
    for (const c of E.parked) { expect(typeof c.model).toBe('string'); expect(c.paint).toMatch(/^#[0-9a-f]{6}$/i); }
    expect(E.parked.some((c) => CAR_CARDS[c.model])).toBe(true);
    expect(Object.keys(E)).not.toContain('parked');
    // (the nearest its start first, none beyond its reach)
    const cars = levelCars(E), d = (c) => Math.hypot(c.at[0] - E.spawn[0], c.at[1] - E.spawn[1]);
    expect(cars.length).toBeGreaterThan(0); expect(cars.length).toBeLessThanOrEqual(CAB.most);
    expect(cars.map(d)).toEqual([...cars.map(d)].sort((a, b) => a - b));
    expect(Math.max(...cars.map(d))).toBeLessThanOrEqual(CAB.far);
    expect(levelCars({ spawn: E.spawn, parked: [] })).toEqual([]);
  });
  it('stands each as a body: drawn from the town\'s own template of its model in its paint, its class\'s drive rule, a cab with its hull', () => {
    const part = carsExtra()(E), cars = levelCars(E), own = part.entities.filter((e) => !e.mount.spare);
    expect(own.map((e) => e.id)).toEqual(cars.map((_, i) => `car-${i + 1}`));
    const c = own[0];
    expect(c.rule.type).toBe('drive');
    expect(c.rule.collideRadius).toBeGreaterThan(0);
    expect(c.mount).toMatchObject({ cab: true, slow: CAB.slow, pool: { model: cars[0].model } });
    expect(c.mount.pool.tint).toHaveLength(3);
    expect(c.mount.hull[1]).toBeGreaterThan(c.mount.hull[0]);
    expect(c.body).toEqual({ type: 'none' });
    expect(Object.keys(part.figures)).toEqual([]);
    expect(c.transform.pos).toEqual(cars[0].at);
    // (and the spares a vehicle taken from the traffic becomes: cabs with no body yet)
    const spares = part.entities.filter((e) => e.mount.spare);
    expect(spares).toHaveLength(CAB.spares);
    for (const sp of spares) { expect(sp.mount.pool).toBeUndefined(); expect(sp.mount.cab).toBe(true); }
    // (a stage that parks none stands none)
    expect(carsExtra()({ spawn: E.spawn, parked: [] })).toBeNull();
  });
  it('the run mints nothing for them and lays them in the level; the town draws no car where a body stands, and pools their models', () => {
    const S = runSteps(WORLD, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-')).order.manifest;
    expect(S.some((x) => x.key.startsWith('car-'))).toBe(false);
    const cars = level.entities.filter((e) => e.mount?.cab && !e.mount.spare);
    expect(cars).toHaveLength(levelCars(E).length);
    // (the hero still the pilot, on foot, made for a monitor, nothing in its hands)
    expect(level.entities.find((e) => e.pilotable)?.id).toBe('hero');
    expect(level.screen).toBe('screen');
    expect(level.entities.find((e) => e.id === 'hero').weapon).toBeUndefined();
    const own = Object.fromEntries(Object.entries(stage.manifest).filter(([k]) => GEOTOWN_KEYS.includes(k)));
    const count = (P) => P.repeats.filter((r) => r.group === 'geotown:car-paint').reduce((a, r) => a + r.transforms.length, 0);
    const all = assembleGeotownScene(own, {}), less = assembleGeotownScene(own, { driven: cars.map((c) => c.transform.pos) });
    expect(count(all) - count(less)).toBe(cars.length);
    expect(less.faces.length).toBe(all.faces.length);
    // (each body's model a pooled template, its paint and its trim; the town with no bodies pools none)
    const pools = new Set(less.repeats.filter((r) => r.pool).map((r) => r.pool));
    for (const c of cars) { expect(pools.has(`${c.mount.pool.model}|paint`)).toBe(true); expect(pools.has(`${c.mount.pool.model}|trim`)).toBe(true); }
    expect(all.repeats.some((r) => r.pool)).toBe(false);
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
    const K = { at: car.transform.pos.slice(), heading: car.transform.heading }, f = [Math.cos(K.heading), Math.sin(K.heading)], left = [-f[1], f[0]];
    hero.transform.pos = [K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4, E.ground(K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4) ?? K.at[2]];
    run(DT, { interact: 1 }); run(5);
    expect(st.pilotId).toBe('car-1');
    expect(hero.gone).toBe(true);
    const from = car.transform.pos.slice();
    // (a town's car is quick and its town small: driven a few car lengths, not for a time)
    const gone = () => Math.hypot(car.transform.pos[0] - from[0], car.transform.pos[1] - from[1]);
    for (let i = 0; i < 240 && gone() < 6; i++) run(DT, { forward: 1 });
    const went = gone();
    expect(went).toBeGreaterThan(5);
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
    // (and walks on, away from the car it left: a car is not walked through)
    hero.transform.heading = Math.atan2(hero.transform.pos[1] - car.transform.pos[1], hero.transform.pos[0] - car.transform.pos[0]);
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

describe('a fare (an errand on a stage with cars: picked up and set down from the kerb)', () => {
  const FARE = { ...WORLD, id: 'fares', topology: 'interconnected', errands: [{ id: 'fare', giver: 'town', reward: [{ item: 'coin', n: 5 }], list: [{ item: 'passenger', at: 'town' }] }] };
  it('its pick-up and its set-down stand apart along the street, each in a kerb\'s reach', async () => {
    const level = runSteps(FARE, { ref: 'gw' }).find((x) => x.key.startsWith('level-')).order.manifest;
    const M = level.game.mechanics, trade = M.find((m) => m.kind === 'trade'), deliver = M.find((m) => m.kind === 'deliver');
    expect(trade).toMatchObject({ item: 'passenger', radius: 7 });
    expect(deliver).toMatchObject({ id: 'fare', radius: 7, reward: [{ item: 'coin', n: 5 }] });
    expect(Math.hypot(trade.at[0] - deliver.at[0], trade.at[1] - deliver.at[1])).toBeGreaterThan(20);
    // (and neither where the level starts)
    expect(Math.hypot(trade.at[0] - E.spawn[0], trade.at[1] - E.spawn[1])).toBeGreaterThan(10);
  });
  it('a standing job pays each time and ends nothing: its hand-in is no end of the level', async () => {
    const OPEN = { ...FARE, id: 'open', errands: [{ ...FARE.errands[0], repeat: true }] };
    expect(() => readGameworld({ ...OPEN, errands: [{ ...FARE.errands[0], repeat: 2 }] })).toThrow(/repeat is true/);
    const level = runSteps(OPEN, { ref: 'gw' }).find((x) => x.key.startsWith('level-')).order.manifest;
    expect(level.game.mechanics.find((m) => m.kind === 'deliver')).toMatchObject({ id: 'fare', repeat: true });
    const { lowerDeliver } = await import('../game/errand-mechanics.js');
    const ctx = { i: 0, player: 'hero', resolve: () => {} }, d = { id: 'fare', at: [0, 0, 0], wants: [{ item: 'passenger' }], reward: [{ item: 'coin', n: 5 }] };
    expect(lowerDeliver(d, ctx).on).toEqual({ 'errand:done:fare': { end: 'success' } });
    const open = lowerDeliver({ ...d, repeat: true }, ctx);
    expect(open.on).toBeUndefined();
    expect(open.world.hud.some((h) => h.on === 'errand:done:fare' && /paid 5 coin/.test(h.text))).toBe(true);
  });
  it('a driver in a cab stands in a zone where its car is; one sent away stands in none', async () => {
    const { deriveZoneEvents } = await import('../worlds/event-bus.js');
    const src = [{ type: 'zone', zone: 'trade-passenger', at: [5, 0, 0], radius: 7, planar: true, watch: 'hero' }];
    const at = (extra) => deriveZoneEvents([{ id: 'hero', transform: { pos: [4, 1, 0] }, ...extra }], null, src).events.map((e) => e.type);
    expect(at({ gone: true, mountedOn: 'car-1' })).toEqual(['enter']);
    expect(at({ gone: true })).toEqual([]);
    expect(at({})).toEqual(['enter']);
  });
});
