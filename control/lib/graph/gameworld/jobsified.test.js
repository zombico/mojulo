// Jobsified, the city's driving jobs (jobsified.js): an errand with `vehicle` is a SHIFT, worked by its row's mode. The
// laws: it reads as one item, its round's stops or piles (the row's by default), given by the Jobsified app unless it
// names its own, never a contact's or a mission; it lowers to one shift leg; the guide leads it as its own round (taken
// on the phone, into its vehicle, its work, then where it pays), the journal keeps it and the phone pays it; a level's
// depot's vehicles and its issued trucks are made cabs after the nearest, so no other car's id moves. The district it is
// laid in: jobsified.e2e.test.js.
import { describe, it, expect } from 'vitest';
import { readErrands, errandLegs } from './errand.js';
import { SHIFTS, SHIFT_MODES, shiftRoles, JOBSIFIED, issues, lawnOf, issuedOf, MOW } from './jobsified.js';
import { jobsOf, jobQuests, cityGuide, CITY_GUIDE } from './city-guide.js';
import { phoneUi } from './phone-ui.js';
import { levelCars, depotCabs, issuedCabs, CAB } from './cars.js';
import { YARDS } from '../geocity/fleets.js';

const G = { levels: { district: {}, docks: {} }, ids: ['district', 'docks'], topology: 'interconnected', links: [{ from: 'district', to: 'docks' }], start: 'district', foes: {} };
const BINS = { id: 'bin-round', giver: 'district', vehicle: 'garbage', repeat: true, reward: [{ item: 'coin', n: 40 }] };
const HAUL = { id: 'heavy-haul', giver: 'district', vehicle: 'heavy', repeat: true, reward: [{ item: 'coin', n: 60 }] };

describe('a shift read', () => {
  it('each row is worked by a mode; one not issued its vehicle (nor on foot) by a fleet its yard keeps', () => {
    for (const [word, S] of Object.entries(SHIFTS)) {
      expect(SHIFT_MODES).toContain(S.mode);
      if (!issues(S) && !S.foot) expect(YARDS[S.yard].roles[word]).toBeGreaterThan(0);
      if (S.mode === 'collect') expect(S.load).toBeLessThanOrEqual(S.stops);
    }
  });
  it('is one item, its round\'s piles or stops, on Jobsified, and lowers to one shift leg at its giver', () => {
    const [E, H] = readErrands([BINS, HAUL], G), S = SHIFTS.garbage;
    expect(E).toMatchObject({ id: 'bin-round', vehicle: 'garbage', app: JOBSIFIED, repeat: true, list: [{ item: S.item, at: 'district', count: S.stops }] });
    expect(H).toMatchObject({ vehicle: 'heavy', app: JOBSIFIED, list: [{ item: SHIFTS.heavy.item, count: SHIFTS.heavy.stops }] });
    expect(readErrands([{ ...BINS, list: [{ item: 'bags', at: 'district', count: 6 }] }], G)[0].list[0]).toMatchObject({ item: 'bags', count: 6 });
    expect(readErrands([{ ...BINS, app: 'cityfu' }], G)[0].app).toBe('cityfu');
    expect(errandLegs([E], 'district')).toEqual([{ kind: 'shift', id: 'bin-round', vehicle: 'garbage', item: S.item, stops: S.stops, reward: [{ item: 'coin', n: 40 }], repeat: true, app: JOBSIFIED }]);
    expect(errandLegs([E], 'docks')).toEqual([]);
    // (a haul's truck is issued, not a depot's: no role of its)
    expect(shiftRoles([E, H], 'district')).toEqual(['garbage']);
    expect(shiftRoles([E], 'docks')).toEqual([]);
  });
  it('refuses what a shift is not: an unknown vehicle, a contact, a mission, a list of two, a stop elsewhere, a price', () => {
    expect(() => readErrands([{ ...BINS, vehicle: 'hovercraft' }], G)).toThrow(/vehicle is the city vehicle/);
    expect(() => readErrands([{ ...BINS, contact: 'vince' }], G)).toThrow(/no contact/);
    expect(() => readErrands([{ ...BINS, repeat: undefined, mission: {} }], G)).toThrow(/driven, not told/);
    expect(() => readErrands([{ ...BINS, list: [{ item: 'a', at: 'district' }, { item: 'b', at: 'district' }] }], G)).toThrow(/one item/);
    expect(() => readErrands([{ ...BINS, list: [{ item: 'bins', at: 'docks' }] }], G)).toThrow(/giver's level/);
    expect(() => readErrands([{ ...BINS, list: [{ item: 'bins', at: 'district', needs: ['coin'] }] }], G)).toThrow(/no needs/);
  });
});

// a level's laid shifts and their tasks, as levels.js lays them
const PILES = [[60, 0, 1], [120, 0, 1], [180, 30, 1]];
const COLLECT = { kind: 'shift', mode: 'collect', id: 'bin-round', name: 'Bin round', item: 'garbage', depot: [0, 40, 1], radius: 20, half: [20, 12], cabs: ['car-12'], stops: PILES.map((at) => ({ at, radius: 7 })), load: 2, hold: 1.5, unload: { at: [400, 0, 1], half: [23, 15] },
  reward: [{ item: 'coin', n: 40 }], repeat: true, after: 'took-bin-round', vehicle: 'garbage truck', yard: 'works yard', stop: 'Collect the garbage', done: 'Garbage collected' };
const HAULED = { kind: 'shift', mode: 'haul', id: 'heavy-haul', name: 'Heavy haul', item: 'haul', depot: [10, 60, 1], radius: 7, cabs: ['car-14'], site: { at: [600, 0, 1], half: [28, 20], to: 'building site' }, back: [10, 60, 1],
  reward: [{ item: 'coin', n: 60 }], repeat: true, after: 'took-heavy-haul', vehicle: 'flatbed truck', yard: 'works yard', place: 'bakery', done: 'Delivered' };
const task = (id) => ({ kind: 'task', id, app: JOBSIFIED, flag: `took-${id}`, name: 'Jobsified', ...(id === 'bin-round' ? { subscribe: true } : {}) });
const FARE = [{ kind: 'trade', item: 'passenger', at: [5, 5, 0], radius: 7, flag: 'had-passenger', after: 'took-fare', job: 'fare' }, { kind: 'deliver', id: 'fare', at: [9, 9, 0], wants: [{ item: 'passenger' }], reward: [{ item: 'coin', n: 12 }], repeat: true, after: 'took-fare', flag: 'done-fare' }, { kind: 'task', id: 'fare', app: 'taskfu', flag: 'took-fare', name: 'TaskFu', subscribe: true }];
const manifest = (mechanics) => ({ title: 'Hijack City · The district · 1', entities: [{ id: 'hero', pilotable: true, transform: { pos: [0, 0, 0] } }, { id: 'car-1', mount: { cab: true }, transform: { pos: [3, 0, 0] } }], game: { mechanics: [{ kind: 'bag', slice: 'bag' }, ...mechanics] } });

describe('a shift read by the guide, the journal and the phone', () => {
  it('collect: into the truck at the yard, then its piles (the way to the nearest not taken, the key to hold) until full, then the dump', () => {
    const [J] = jobsOf([COLLECT, task('bin-round')]);
    expect(J).toMatchObject({ id: 'bin-round', repeat: true, shift: true, starts: 'took-bin-round', app: JOBSIFIED, loop: 2 });
    expect(J.steps.map((s) => s.id)).toEqual(['app-bin-round', 'clock-bin-round', 'collect-bin-round', 'unload-bin-round']);
    expect(J.steps.map((s) => s.when)).toEqual(['flag-took-bin-round', 'flag-on-bin-round', 'flag-full-bin-round', undefined]);
    expect(J.steps[1].say).toBe('Get in a garbage truck at the works yard');
    expect(J.steps[2]).toMatchObject({ say: `Collect the garbage · hold ${CITY_GUIDE.hold}`, near: PILES.map((at, k) => ({ at, v: `flag-stop-bin-round-${k + 1}` })) });
    expect(J.steps[3]).toMatchObject({ say: 'Take the full garbage truck to the dump', at: COLLECT.unload.at, radius: 23, says: 'Paid 40 coin' });
    // (a one-off's last step waits on its pay; with no dump, the yard)
    expect(jobsOf([{ ...COLLECT, repeat: undefined }, task('bin-round')])[0].steps[3].when).toBe('flag-done-bin-round');
    expect(jobsOf([{ ...COLLECT, unload: undefined }, task('bin-round')])[0].steps[3]).toMatchObject({ say: 'Take the full garbage truck to the works yard', at: COLLECT.depot });
    expect(jobQuests([COLLECT, task('bin-round')])).toEqual([{ id: 'bin-round', name: 'Bin round', starts: 'took-bin-round', steps: J.steps.slice(1).map((s) => ({ log: s.say, done: s.flag })) }]);
  });
  it('haul: its truck taken where it is issued, driven to the site; round again from taking it', () => {
    const [J] = jobsOf([HAULED, task('heavy-haul')]);
    expect(J.steps.map((s) => [s.id, s.say])).toEqual([['app-heavy-haul', 'Take the heavy haul on Jobsified · P'], ['clock-heavy-haul', 'Take the flatbed truck outside the bakery by the works yard'], ['haul-heavy-haul', 'Drive the flatbed truck to the building site']]);
    expect(J.loop).toBe(1);
    expect(J.steps[2]).toMatchObject({ at: HAULED.site.at, radius: 28, says: 'Paid 60 coin', flag: 'done-heavy-haul' });
  });
  it('haul of several calls: each vehicle taken where it stands and driven to its site, in turn; round again from the first', () => {
    const CALLS = { ...HAULED, cabs: ['car-14', 'car-15'], calls: [{ cab: 'car-14', site: HAULED.site, back: [10, 60, 1], vehicle: 'concrete mixer', place: 'bakery' }, { cab: 'car-15', site: { at: [0, 600, 1], radius: 7, place: 'cafe' }, back: [30, 60, 1], vehicle: 'flatbed truck' }] };
    const [J] = jobsOf([CALLS, task('heavy-haul')]);
    expect(J.steps.map((s) => [s.id, s.say, s.when])).toEqual([
      ['app-heavy-haul', 'Take the heavy haul on Jobsified · P', 'flag-took-heavy-haul'],
      ['clock-heavy-haul-1', 'Take the concrete mixer outside the bakery by the works yard', 'flag-on-heavy-haul-1'], ['haul-heavy-haul-1', 'Drive the concrete mixer to the building site', 'flag-done-heavy-haul-1'],
      ['clock-heavy-haul-2', 'Take the flatbed truck by the works yard', 'flag-on-heavy-haul-2'], ['haul-heavy-haul-2', 'Drive the flatbed truck to the cafe', 'flag-done-heavy-haul-2']]);
    expect(J.loop).toBe(1);
    const g = cityGuide(manifest([CALLS, task('heavy-haul')]));
    expect(g.rounds).toEqual([{ when: 'flag-took-heavy-haul', at: g.steps.findIndex((s) => s.id === 'clock-heavy-haul-1'), from: g.steps.findIndex((s) => s.id === 'clock-heavy-haul-1'), end: g.steps.length }]);
  });
  it('sweep: its sweeper taken where it is issued, then the streets, the way to the nearest litter not yet swept', () => {
    const SW = { ...HAULED, mode: 'sweep', id: 'street-sweeping', site: undefined, vehicle: 'street sweeper', stops: PILES.map((at) => ({ at, radius: 3.2 })) };
    const [J] = jobsOf([SW, task('street-sweeping')]);
    expect(J.steps.map((s) => s.id)).toEqual(['app-street-sweeping', 'clock-street-sweeping', 'sweep-street-sweeping']);
    expect(J.steps[2]).toMatchObject({ say: 'Sweep the streets: drive over the litter', when: 'flag-done-street-sweeping', near: PILES.map((at, k) => ({ at, v: `flag-stop-street-sweeping-${k + 1}` })) });
    expect(J.loop).toBe(null);
  });
  it('mow: walked to the groundskeeper\'s shed, its round started there; done when one is won', () => {
    const MW = { kind: 'shift', mode: 'mow', id: 'groundskeeping', name: 'Groundskeeping', item: 'lawn', depot: [10, 60, 1], radius: 3, vehicle: 'ride-on mower', yard: 'park', reward: [{ item: 'coin', n: 45 }], repeat: true };
    const [J] = jobsOf([MW, task('groundskeeping')]);
    expect(J.steps.map((s) => s.id)).toEqual(['app-groundskeeping', 'clock-groundskeeping', 'mow-groundskeeping']);
    expect(J.steps[1]).toMatchObject({ say: 'Go to the groundskeeper\'s shed at the park', at: [10, 60, 1], when: 'flag-on-groundskeeping' });
    expect(J.steps[2]).toMatchObject({ when: 'flag-done-groundskeeping', says: 'Paid 45 coin' });
  });
  it('route: its bus taken where it is issued, then each stop in order, held at; the last pays', () => {
    const R = { ...COLLECT, mode: 'route', load: undefined, unload: undefined, back: [10, 60, 1], vehicle: 'bus', place: 'bakery', yard: 'bus depot', stop: 'Pick up at the bus stop', stops: PILES.map((at) => ({ at, radius: 7, place: 'cafe', riders: 2 })) };
    const [J] = jobsOf([R, task('bin-round')]);
    expect(J.steps.map((s) => s.id)).toEqual(['app-bin-round', 'clock-bin-round', 'stop-bin-round-1', 'stop-bin-round-2', 'stop-bin-round-3']);
    expect(J.steps[1].say).toBe('Take the bus outside the bakery by the bus depot');
    expect(J.steps[2].say).toBe(`Pick up at the bus stop by the cafe · hold ${CITY_GUIDE.hold}`);
    // (a standing route's last stop is reached by coming to it: its flag is laid again as it pays)
    expect(J.steps.map((s) => s.when)).toEqual(['flag-took-bin-round', 'flag-on-bin-round', 'flag-stop-bin-round-1', 'flag-stop-bin-round-2', undefined]);
    expect(J.steps[4]).toMatchObject({ flag: 'done-bin-round', says: 'Paid 40 coin' });
    expect(J.loop).toBe(2);
  });
  it('the guide goes to a job\'s round when it is taken, wherever it stood, and round again; a standing fare keeps the guide\'s own loop', () => {
    const g = cityGuide(manifest([...FARE, COLLECT, task('bin-round'), HAULED, task('heavy-haul')]));
    const c = g.steps.findIndex((s) => s.id === 'clock-bin-round'), h = g.steps.findIndex((s) => s.id === 'clock-heavy-haul');
    expect(g.rounds).toEqual([{ when: 'flag-took-bin-round', at: c, from: c + 1, end: c + 3 }, { when: 'flag-took-heavy-haul', at: h, from: h, end: h + 2 }]);
    expect(g.steps[g.loop].id).toBe('pick-passenger');
    expect(g.steps[c + 1].near).toHaveLength(PILES.length);
    expect(cityGuide(manifest(FARE)).rounds).toBeUndefined();
  });
  it('each is a task on the Jobsified tab of the phone, with its pay', () => {
    const P = phoneUi(manifest([...FARE, COLLECT, task('bin-round'), HAULED, task('heavy-haul')]));
    expect(P.apps.map((a) => [a.id, a.name, a.tasks.map((t) => [t.id, t.pays, t.repeat])])).toEqual([['taskfu', 'TaskFu', [['fare', '12 coin', true]]], [JOBSIFIED, 'Jobsified', [['bin-round', '40 coin', true], ['heavy-haul', '60 coin', true]]]]);
  });
});

describe('a depot\'s vehicles and an issued truck made cabs', () => {
  // (ends as levels.js tells them: parked cars, and a depot keeping some of them by role)
  const car = (x) => ({ at: [x, 0, 0], heading: 0, model: 'familySedan', paint: '#ffffff' });
  const parked = Array.from({ length: CAB.most + 3 }, (_, i) => car(i * 2)), truck = { ...car(800), model: 'loft:refuseTruck' }, near = { ...car(1), model: 'loft:refuseTruck' };
  const ends = { spawn: [0, 0, 0], parked: [...parked, truck, near] };
  Object.defineProperty(ends, 'depots', { value: [{ id: 'yard', yard: 'works', at: [800, 0, 0], radius: 20, cabs: [{ role: 'garbage', car: truck }, { role: 'garbage', car: near }] }] });
  const issued = [{ id: 'heavy-haul', at: [50, 9, 0], heading: 0, model: 'loft:flatbedTruck', paint: '#20497f' }];
  it('after the nearest, so every other car\'s id is the same; one already among them keeps its own; an issued truck after all', () => {
    const plain = levelCars(ends), more = levelCars(ends, { roles: ['garbage'] }), all = levelCars(ends, { roles: ['garbage'], issue: issued });
    expect(plain).toHaveLength(CAB.most);
    expect(more.slice(0, CAB.most)).toEqual(plain);
    expect(more.slice(CAB.most)).toEqual([truck]);
    expect(all).toEqual([...more, issued[0]]);
    expect(levelCars(ends, { roles: ['bus'] })).toEqual(plain);
    expect(depotCabs(ends, 'garbage').map((x) => x.ids)).toEqual([[`car-${CAB.most + 1}`, `car-${plain.indexOf(near) + 1}`]]);
    expect(depotCabs(ends, 'bus')).toEqual([]);
    expect(issuedCabs(ends, issued, { roles: ['garbage'] })).toEqual([`car-${CAB.most + 2}`]);
    expect(issuedCabs(ends, issued)).toEqual([`car-${CAB.most + 1}`]);
  });
});

describe('a groundskeeper\'s lawn (lawnOf)', () => {
  // (a park 60 by 36 with a path across it east to west, a pavilion, a tree; a strip too thin to mow nearer the start)
  const park = { id: 'B1.park', rect: [0, 0, 60, 36], z: 2, at: [30, 18, 2], trees: [[9, 9, 2]], things: [[0, 17, 60, 19], [40, 24, 48, 30]], gates: [] };
  const ends = { spawn: [100, 18, 2], parks: [{ id: 'A1.park', rect: [80, 0, 200, 8], z: 2, at: [140, 4, 2], trees: [], things: [], gates: [] }, park] };
  const L = lawnOf(ends);
  it('the nearest park wide enough; the shed\'s door on its path up from the edge nearest the start, the shed beside it', () => {
    expect(L.park).toBe('B1.park');
    expect(L.spot).toEqual({ at: [60 - MOW.spot, 18, 2], heading: expect.closeTo(Math.PI, 3) });
    expect(Math.abs(L.shed.at[1] - 18)).toBeCloseTo(MOW.shed);
    expect(L.shed.at[0]).toBeLessThan(60);
  });
  it('the park as the minigame\'s tiles, north up: its path a row of path, its pavilion and shed things, its tree; the mower at the door, nosed in', () => {
    const { rows, start } = L.lawn, W = rows[0].length;
    expect(W).toBeLessThanOrEqual(MOW.across);
    expect(rows.every((r) => r.length === W && /^[.=T#*]+$/.test(r))).toBe(true);
    expect(rows.filter((r) => /^=+$/.test(r))).toHaveLength(1);
    expect(rows.join('')).toMatch(/T/);
    expect(rows.join('').split('#').length - 1).toBeGreaterThanOrEqual(2);
    // (the tree in the south-west: low rows, west columns)
    const tj = rows.findIndex((r) => r.includes('T'));
    expect(tj).toBeGreaterThan(rows.length / 2);
    expect(rows[tj].indexOf('T')).toBeLessThan(W / 2);
    expect(rows[Math.floor(start[1])][Math.floor(start[0])]).toBe('=');
    expect(start[2]).toBeCloseTo(-Math.PI);
    expect(lawnOf(ends)).toEqual(L);
    expect(lawnOf({ spawn: [0, 0, 0] })).toBe(null);
  });
  it('a park on a terrace: its door at a path\'s end walked in at, not the nearer one walled over its walk', () => {
    // (the park stands 2 m over the walk on its east, level on its west)
    const W = lawnOf({ ...ends, ground: (x) => (x > 60 ? 0 : 2) });
    expect(W.spot.at[0]).toBeCloseTo(MOW.spot);
    expect(W.spot.heading).toBeCloseTo(0);
    expect(W.lawn.start[0]).toBeLessThan(2);
  });
  it('a mow is done on foot: no vehicle issued for it', () => {
    expect(issuedOf({ ...ends, kerbAt: () => null }, [{ id: 'groundskeeping', giver: 'district', vehicle: 'groundskeeper' }], 'district')).toEqual([]);
    expect(shiftRoles([{ id: 'groundskeeping', giver: 'district', vehicle: 'groundskeeper' }], 'district')).toEqual([]);
  });
});
