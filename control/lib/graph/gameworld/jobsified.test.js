// Jobsified, the city's driving jobs (jobsified.js): an errand with `vehicle` is a SHIFT. The laws: it reads as one item,
// its round's stops (the row's by default), given by the Jobsified app unless it names its own, never a contact's or a
// mission; it lowers to one shift leg; the guide leads it as its own round (taken on the phone, into a vehicle at the
// depot, each stop waited on by its own flag, back), the journal keeps it and the phone pays it; a level's depot's
// vehicles are made cabs after the nearest, so no other car's id moves. The district it is laid in: jobsified.e2e.test.js.
import { describe, it, expect } from 'vitest';
import { readErrands, errandLegs } from './errand.js';
import { SHIFTS, shiftRoles, shiftWords, JOBSIFIED } from './jobsified.js';
import { jobsOf, jobQuests, cityGuide } from './city-guide.js';
import { phoneUi } from './phone-ui.js';
import { levelCars, depotCabs, CAB } from './cars.js';
import { YARDS } from '../geocity/fleets.js';

const G = { levels: { district: {}, docks: {} }, ids: ['district', 'docks'], topology: 'interconnected', links: [{ from: 'district', to: 'docks' }], start: 'district', foes: {} };
const BINS = { id: 'bin-round', giver: 'district', vehicle: 'garbage', repeat: true, reward: [{ item: 'coin', n: 40 }] };

describe('a shift read', () => {
  it('each row is a fleet its yard keeps, and says its own words', () => {
    for (const [role, S] of Object.entries(SHIFTS)) { expect(YARDS[S.yard].roles[role]).toBeGreaterThan(0); expect(S.stops).toBeGreaterThan(0); }
    const S = Object.values(SHIFTS)[0], w = shiftWords(S, 'bakery');
    expect(w.clock).toContain(S.vehicle);
    expect(w.stop).toMatch(/at the bakery$/);
    expect(w.back).toContain(S.vehicle);
  });
  it('is one item, its round\'s stops, on Jobsified, and lowers to one shift leg at its giver', () => {
    const [E] = readErrands([BINS], G), S = SHIFTS.garbage;
    expect(E).toMatchObject({ id: 'bin-round', vehicle: 'garbage', app: JOBSIFIED, repeat: true, list: [{ item: S.item, at: 'district', count: S.stops }] });
    expect(readErrands([{ ...BINS, list: [{ item: 'bags', at: 'district', count: 2 }] }], G)[0].list[0]).toMatchObject({ item: 'bags', count: 2 });
    expect(readErrands([{ ...BINS, app: 'cityfu' }], G)[0].app).toBe('cityfu');
    expect(errandLegs([E], 'district')).toEqual([{ kind: 'shift', id: 'bin-round', vehicle: 'garbage', item: S.item, stops: S.stops, reward: [{ item: 'coin', n: 40 }], repeat: true, app: JOBSIFIED }]);
    expect(errandLegs([E], 'docks')).toEqual([]);
    expect(shiftRoles([E], 'district')).toEqual(['garbage']);
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

// a level's laid shift and its task, as levels.js lays them
const SHIFT = { kind: 'shift', id: 'bin-round', name: 'Bin round', item: 'bins', depot: [0, 40, 1], radius: 20, cabs: ['car-12'], stops: [{ at: [60, 0, 1], radius: 7, place: 'bakery' }, { at: [120, 0, 1], radius: 7 }], reward: [{ item: 'coin', n: 40 }], repeat: true, after: 'took-bin-round', vehicle: 'garbage truck', yard: 'works yard', stop: 'Empty the bins', done: 'Bins emptied' };
const TASK = { kind: 'task', id: 'bin-round', app: JOBSIFIED, flag: 'took-bin-round', name: 'Jobsified', subscribe: true };
const FARE = [{ kind: 'trade', item: 'passenger', at: [5, 5, 0], radius: 7, flag: 'had-passenger', after: 'took-fare', job: 'fare' }, { kind: 'deliver', id: 'fare', at: [9, 9, 0], wants: [{ item: 'passenger' }], reward: [{ item: 'coin', n: 12 }], repeat: true, after: 'took-fare', flag: 'done-fare' }, { kind: 'task', id: 'fare', app: 'taskfu', flag: 'took-fare', name: 'TaskFu', subscribe: true }];
const manifest = (mechanics) => ({ title: 'Hijack City · The district · 1', entities: [{ id: 'hero', pilotable: true, transform: { pos: [0, 0, 0] } }, { id: 'car-1', mount: { cab: true }, transform: { pos: [3, 0, 0] } }], game: { mechanics: [{ kind: 'bag', slice: 'bag' }, ...mechanics] } });

describe('a shift read by the guide, the journal and the phone', () => {
  it('is a job of its own steps: taken on the app, into the vehicle at the yard, each stop, back; each waited on by its flag', () => {
    const [J] = jobsOf([SHIFT, TASK]);
    expect(J).toMatchObject({ id: 'bin-round', name: 'Bin round', repeat: true, shift: true, starts: 'took-bin-round', app: JOBSIFIED });
    expect(J.steps.map((s) => s.id)).toEqual(['app-bin-round', 'clock-bin-round', 'stop-bin-round-1', 'stop-bin-round-2', 'back-bin-round']);
    expect(J.steps.map((s) => s.when)).toEqual(['flag-took-bin-round', 'flag-on-bin-round', 'flag-stop-bin-round-1', 'flag-stop-bin-round-2', undefined]);
    expect(J.steps[1].say).toBe('Get in a garbage truck at the works yard');
    expect(J.steps[2].say).toBe('Empty the bins at the bakery');
    expect(J.steps[4]).toMatchObject({ say: 'Bring the garbage truck back to the works yard', at: SHIFT.depot, says: 'Paid 40 coin' });
    // (a one-off's way back waits on its pay: being at the yard is not it)
    expect(jobsOf([{ ...SHIFT, repeat: undefined }, TASK])[0].steps[4].when).toBe('flag-done-bin-round');
    expect(jobQuests([SHIFT, TASK])).toEqual([{ id: 'bin-round', name: 'Bin round', starts: 'took-bin-round', steps: J.steps.slice(1).map((s) => ({ log: s.say, done: s.flag })) }]);
  });
  it('the guide goes to its round when it is taken, wherever it stood, and round again; a standing fare keeps the guide\'s own loop', () => {
    const g = cityGuide(manifest([...FARE, SHIFT, TASK])), first = g.steps.findIndex((s) => s.id === 'clock-bin-round');
    expect(g.rounds).toEqual([{ when: 'flag-took-bin-round', at: first, from: first + 1, end: first + 4 }]);
    expect(g.steps[g.loop].id).toBe('pick-passenger');
    expect(g.steps.slice(first, first + 4).map((s) => s.kind)).toEqual(['find', 'find', 'find', 'find']);
    // (no shift, no rounds: the guide as it was)
    expect(cityGuide(manifest(FARE)).rounds).toBeUndefined();
  });
  it('is a task on the Jobsified tab of the phone, with its pay', () => {
    const P = phoneUi(manifest([...FARE, SHIFT, TASK]));
    expect(P.apps.map((a) => [a.id, a.name, a.tasks.map((t) => [t.id, t.pays, t.repeat])])).toEqual([['taskfu', 'TaskFu', [['fare', '12 coin', true]]], [JOBSIFIED, 'Jobsified', [['bin-round', '40 coin', true]]]]);
  });
});

describe('a depot\'s vehicles made cabs', () => {
  // (ends as levels.js tells them: parked cars, and a depot keeping some of them by role)
  const car = (x) => ({ at: [x, 0, 0], heading: 0, model: 'familySedan', paint: '#ffffff' });
  const parked = Array.from({ length: CAB.most + 3 }, (_, i) => car(i * 2)), truck = { ...car(800), model: 'loft:refuseTruck' }, near = { ...car(1), model: 'loft:refuseTruck' };
  const ends = { spawn: [0, 0, 0], parked: [...parked, truck, near] };
  Object.defineProperty(ends, 'depots', { value: [{ id: 'yard', yard: 'works', at: [800, 0, 0], radius: 20, cabs: [{ role: 'garbage', car: truck }, { role: 'garbage', car: near }] }] });
  it('after the nearest, so every other car\'s id is the same; one already among them keeps its own', () => {
    const plain = levelCars(ends), more = levelCars(ends, { roles: ['garbage'] });
    expect(plain).toHaveLength(CAB.most);
    expect(more.slice(0, CAB.most)).toEqual(plain);
    expect(more.slice(CAB.most)).toEqual([truck]);
    expect(levelCars(ends, { roles: ['bus'] })).toEqual(plain);
    expect(depotCabs(ends, 'garbage').map((x) => x.ids)).toEqual([[`car-${CAB.most + 1}`, `car-${plain.indexOf(near) + 1}`]]);
    expect(depotCabs(ends, 'bus')).toEqual([]);
  });
});
