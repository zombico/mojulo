// THE CITY'S SHOPS (shop-mechanics.js), walked on the bus: the respray takes a car driven in by a wanted player with the
// price, repaints it and the law loses them; the gun shop sells a box of rounds into the player's gun.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const WANT = { kind: 'wanted', police: ['police-1', 'police-2'], per: 2, stars: 2 };
const RESPRAY = { kind: 'respray', at: [50, 0, 0], price: 40 };
const GUNS = { kind: 'gunshop', at: [20, 0, 0], price: 30, rounds: 24 };

function play(M, script, { coin = 0 } = {}) {
  const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, ...M, { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  s.vars['held:bag:coin'] = coin;
  s._ctrlOps = [];
  let prev;
  for (const step of script) {
    if (step.event) pump([{ type: step.event }]);
    // (a body come to a place: the zones' own derivation, twice, so it is an onset)
    if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: step.who ?? 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
  }
  return { vars: s.vars, log: s.log.map((r) => r.type), ops: s._ctrlOps || [] };
}
const jack = { event: 'mayhem:carjack' }, inCar = { at: [50, 0, 0], who: 'car-1' };

describe('the respray', () => {
  it('a car driven in by a wanted player with the price: paid, repainted, and the law loses them', () => {
    const r = play([WANT, RESPRAY], [jack, jack, inCar], { coin: 100 });
    expect(r.log).toContain('respray:done');
    expect(r.vars).toMatchObject({ wanted: 0, 'held:bag:coin': 60 });
    expect(r.ops.find((o) => o.op === 'repaint')).toMatchObject({ who: 'hero' });
    expect(r.ops.filter((o) => o.op === 'vanish').map((o) => o.who)).toEqual(expect.arrayContaining(['police-1', 'police-2']));
  });
  it('with no stars, nothing to hide; short of the price, it says so and takes nothing; on foot it is no garage', () => {
    expect(play([WANT, RESPRAY], [inCar], { coin: 100 }).log).toContain('respray:clean');
    const short = play([WANT, RESPRAY], [jack, inCar], { coin: 10 });
    expect(short.log).toContain('respray:short'); expect(short.vars).toMatchObject({ wanted: 1, 'held:bag:coin': 10 });
    expect(play([WANT, RESPRAY], [jack, { at: [50, 0, 0] }], { coin: 100 }).log).not.toContain('respray:done');
  });
});

describe('the gun shop', () => {
  it('walked into with the price: a box of rounds into the player\'s gun; short, nothing', () => {
    const r = play([GUNS], [{ at: [20, 0, 0] }], { coin: 45 });
    expect(r.log).toContain('gunshop:bought');
    expect(r.vars['held:bag:coin']).toBe(15);
    expect(r.ops.find((o) => o.op === 'rearm')).toMatchObject({ who: 'hero', by: 24 });
    const poor = play([GUNS], [{ at: [20, 0, 0] }], { coin: 5 });
    expect(poor.log).toContain('gunshop:short'); expect(poor.ops.some((o) => o.op === 'rearm')).toBe(false);
  });
});

describe('the forger (and the job that asks for its papers)', () => {
  const FORGER = { kind: 'forger', at: [80, 0, 0], price: 150, item: 'fake-id', name: 'heavy machinery licence' };
  const TASK = { kind: 'task', id: 'heavy', app: 'jobsified', flag: 'took-heavy', name: 'Jobsified', subscribe: true, needs: { item: 'fake-id', name: 'heavy machinery licence' } };
  it('walked into with the price: the papers into the bag, once; short, it says so; had, it says so', () => {
    const r = play([FORGER], [{ at: [80, 0, 0] }, { at: [0, 0, 0] }, { at: [80, 0, 0] }], { coin: 400 });
    expect(r.vars).toMatchObject({ 'held:bag:fake-id': 1, 'held:bag:coin': 250 });
    expect(r.log).toContain('forger:had');
    const short = play([FORGER], [{ at: [80, 0, 0] }], { coin: 40 });
    expect(short.log).toContain('forger:short');
    expect(short.vars).toMatchObject({ 'held:bag:fake-id': 0, 'held:bag:coin': 40 });
  });
  it('a task that asks for papers is taken only with them: without, the app says what it needs', () => {
    const without = play([TASK], [{ event: 'app:take:heavy' }]);
    expect(without.log).toContain('task:needs:heavy');
    expect(without.vars['flag-took-heavy']).toBe(0);
    const bought = play([FORGER, TASK], [{ at: [80, 0, 0] }, { event: 'app:take:heavy' }], { coin: 150 });
    expect(bought.vars['flag-took-heavy']).toBe(1);
    // (a task that asks for nothing is taken as it always was)
    const { needs: _n, ...free } = TASK;
    expect(play([free], [{ event: 'app:take:heavy' }]).vars['flag-took-heavy']).toBe(1);
  });
});

describe('the forger of several papers (a licence, an office badge)', () => {
  const PAPERS = [{ item: 'fake-id', name: 'heavy machinery licence', price: 150 }, { item: 'office-id', name: 'office ID badge', price: 90, says: 'You are Gary now.' }];
  const FORGER = { kind: 'forger', at: [80, 0, 0], papers: PAPERS, asks: { heavy: 0, temp: 1 } };
  const task = (id, app, needs) => ({ kind: 'task', id, app, flag: `took-${id}`, name: app, subscribe: true, needs });
  const TASKS = [task('heavy', 'jobsified', { item: 'fake-id', name: 'heavy machinery licence' }), task('temp', 'placeholder', { item: 'office-id', name: 'office ID badge' })];
  it('sells the paper the job last turned away asked for, at its price; asked for none, it asks what for', () => {
    const none = play([FORGER, ...TASKS], [{ at: [80, 0, 0] }], { coin: 400 });
    expect(none.log).toContain('forger:what');
    expect(none.vars['held:bag:coin']).toBe(400);
    const badge = play([FORGER, ...TASKS], [{ event: 'app:take:temp' }, { at: [80, 0, 0] }, { event: 'app:take:temp' }], { coin: 400 });
    expect(badge.vars).toMatchObject({ 'held:bag:office-id': 1, 'held:bag:fake-id': 0, 'held:bag:coin': 310, 'flag-took-temp': 1 });
    expect(badge.log).toContain('forger:bought:2');
    // (then the licence, when the heavy call turns the player away)
    const both = play([FORGER, ...TASKS], [{ event: 'app:take:temp' }, { at: [80, 0, 0] }, { at: [0, 0, 0] }, { event: 'app:take:heavy' }, { at: [80, 0, 0] }], { coin: 400 });
    expect(both.vars).toMatchObject({ 'held:bag:office-id': 1, 'held:bag:fake-id': 1, 'held:bag:coin': 160 });
    // (short of it, it says so and takes nothing)
    const short = play([FORGER, ...TASKS], [{ event: 'app:take:temp' }, { at: [80, 0, 0] }], { coin: 50 });
    expect(short.log).toContain('forger:short:2');
    expect(short.vars['held:bag:coin']).toBe(50);
  });
});
