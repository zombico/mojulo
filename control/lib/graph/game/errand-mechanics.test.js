// The errand's verbs (errand-mechanics.js): trade, cargo, deliver, each lowered onto the bag's guarded transfer. The laws:
// a trade spends its price for its item (a source with none), short of the price nothing moves, and it gives again only
// once the bag holds none; a fragile cargo loses a unit to each hit and fall, a perishable one to each period while
// carried, never below none; a deliver hands over what was asked only when all of it is held, else says what is short;
// each change is said for the store; one errand walked end to end wins; a malformed one says what is wrong.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] };
const ctx = { storeSchema: STORE, player: 'hero', spawn: [0, 0, 0] };
const EXIT = { kind: 'reach-exit', at: [99, 99, 0] };
const H = (item) => `held:bag:${item}`;

// a bus that a walker steps through spots on, with events fed between and timers run
function play(mechs, script, { fall } = {}) {
  const c = composeMechanics(mechs, { ...ctx, ...(fall !== undefined ? { fall } : {}) }), ev = c.events;
  const s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const step of script) {
    if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
    if (step.event) pump([{ type: step.event, ...(step.entity ? { entity: step.entity } : {}) }]);
    if (step.set) Object.assign(s.vars, step.set);
    if (step.secs) for (let k = 0; k < Math.round(step.secs * 10); k++) pump(B.tickTimers(s, 0.1));
  }
  return { c, s, vars: s.vars, log: s.log.map((r) => r.type) };
}
const away = { at: [50, 50, 0] };

describe('trade: an item had for its price', () => {
  it('a source gives its count once, and again only once the bag holds none', () => {
    const shelf = { kind: 'trade', item: 'eggs', at: [4, 0, 0], count: 12 };
    const r = play([shelf, EXIT], [{ at: [4, 0, 0] }, away, { at: [4, 0, 0] }]);
    expect(r.vars[H('eggs')]).toBe(12);
    expect(r.log).toContain('in:bag:eggs:12');
    const again = play([shelf, EXIT], [{ at: [4, 0, 0] }, away, { set: { [H('eggs')]: 0 } }, { at: [4, 0, 0] }]);
    expect(again.log.filter((t) => t === 'in:bag:eggs:12')).toHaveLength(2);
  });

  it('spends its price for its item; short of it, nothing moves and it says the price', () => {
    const shop = { kind: 'trade', item: 'eggs', at: [4, 0, 0], count: 12, needs: [{ item: 'coin', n: 3 }] };
    const broke = play([shop, EXIT], [{ set: { [H('coin')]: 2 } }, { at: [4, 0, 0] }]);
    expect(broke.vars[H('eggs')]).toBe(0);
    expect(broke.vars[H('coin')]).toBe(2);
    expect(broke.log).toContain('trade:eggs:short');
    const paid = play([shop, EXIT], [{ set: { [H('coin')]: 3 } }, { at: [4, 0, 0] }]);
    expect([paid.vars[H('coin')], paid.vars[H('eggs')]]).toEqual([0, 12]);
    expect(paid.log).toEqual(expect.arrayContaining(['out:bag:coin:3', 'in:bag:eggs:12', 'pickup:eggs']));
  });
});

describe('cargo: a carried item\'s condition', () => {
  it('fragile: a unit to each hit and each fall, never below none', () => {
    const eggs = { kind: 'cargo', item: 'eggs', fragile: true };
    const r = play([eggs, EXIT], [{ set: { [H('eggs')]: 2 } }, { event: 'hit:hero' }, { at: [0, 0, -50] }]);
    expect(r.vars[H('eggs')]).toBe(0);
    expect(r.log.filter((t) => t === 'cargo:lost:eggs')).toHaveLength(2);
    expect(r.log).toContain('out:bag:eggs:1');
    const more = play([eggs, EXIT], [{ event: 'hit:hero' }]);
    expect(more.vars[H('eggs')]).toBe(0);
    expect(more.log).not.toContain('cargo:lost:eggs');
  });

  it('perishable: a unit each period while any is carried, none while none is', () => {
    const meal = { kind: 'cargo', item: 'meal', perishable: 2 };
    expect(play([meal, EXIT], [{ set: { [H('meal')]: 10 } }, { secs: 5 }]).vars[H('meal')]).toBe(8);
    expect(play([meal, EXIT], [{ secs: 5 }]).log).not.toContain('cargo:lost:meal');
  });
});

describe('bounty: a foe\'s fall drops its proof', () => {
  it('each fall of a foe it names drops its proof into the bag; another\'s drops nothing', () => {
    const r = play([{ kind: 'bounty', item: 'pelt', who: 'dire-wolf-*' }, EXIT], [{ event: 'down', entity: 'dire-wolf-1' }, { event: 'down', entity: 'bandit-1' }, { event: 'down', entity: 'dire-wolf-2' }]);
    expect(r.vars[H('pelt')]).toBe(2);
    expect(r.log.filter((t) => t === 'in:bag:pelt:1')).toHaveLength(2);
  });

  it('without `who`, an hp-pool\'s downs count, and it needs one to feed it', () => {
    const r = play([{ kind: 'hp-pool', entities: [{ id: 'rat', hp: 1 }] }, { kind: 'bounty', item: 'tail' }, EXIT], [{ event: 'hit:rat' }]);
    expect(r.vars[H('tail')]).toBe(1);
    expect(() => composeMechanics([{ kind: 'bounty', item: 'tail' }, EXIT], ctx)).toThrow(/no mechanic in this level emits 'enemy:down'/);
  });
});

describe('deliver: the giver\'s hand-in', () => {
  const giver = { kind: 'deliver', id: 'eggs-run', at: [10, 0, 0], wants: [{ item: 'eggs', min: 6 }, { item: 'milk' }] };
  it('takes what was asked only when all of it is held, and ends the level', () => {
    const short = play([giver], [{ set: { [H('eggs')]: 9 } }, { at: [10, 0, 0] }]);
    expect(short.log).toContain('errand:short:eggs-run');
    expect(short.log).not.toContain('errand:done:eggs-run');
    expect(short.vars[H('eggs')]).toBe(9);
    const done = play([giver], [{ set: { [H('eggs')]: 9, [H('milk')]: 1 } }, { at: [10, 0, 0] }]);
    expect(done.log).toContain('errand:done:eggs-run');
    expect([done.vars[H('eggs')], done.vars[H('milk')]]).toEqual([3, 0]);
    expect(done.c.on['errand:done:eggs-run']).toEqual({ end: 'success' });
    expect(done.c.audits).toEqual([{ mechanic: 'deliver', kind: 'walkto', target: [10, 0, 0] }]);
  });

  it('pays its reward into the bag as it takes what was asked (a bounty board: proofs for coin)', () => {
    const board = { kind: 'deliver', id: 'board', at: [10, 0, 0], wants: [{ item: 'pelt' }], reward: [{ item: 'coin', n: 5 }] };
    const r = play([{ kind: 'bounty', item: 'pelt', who: 'wolf' }, board], [{ at: [10, 0, 0] }, away, { event: 'down', entity: 'wolf' }, { at: [10, 0, 0] }]);
    expect(r.vars[H('coin')]).toBe(5);
    expect(r.vars[H('pelt')]).toBe(0);
    expect(r.log).toEqual(expect.arrayContaining(['errand:short:board', 'in:bag:coin:5', 'errand:done:board']));
    expect(() => composeMechanics([{ ...board, reward: [{ n: 2 }] }], ctx)).toThrow(/reward is/);
  });
});

describe('an errand on one level', () => {
  it('the job pays the coin, the shop trades it for eggs, a hit and a fall break two, ten are delivered', () => {
    const list = [
      { kind: 'bag', slice: 'bag' },
      { kind: 'trade', item: 'coin', at: [5, 5, 0], count: 3 },
      { kind: 'trade', item: 'eggs', at: [10, 0, 0], count: 12, needs: [{ item: 'coin', n: 3 }] },
      { kind: 'cargo', item: 'eggs', fragile: true },
      { kind: 'deliver', at: [0, 10, 0], wants: [{ item: 'eggs', min: 6 }] },
    ];
    // to the giver first: refused; then the shop with nothing: refused
    const r = play(list, [{ at: [0, 10, 0] }, { at: [10, 0, 0] }, { at: [5, 5, 0] }, { at: [10, 0, 0] }, { event: 'hit:hero' }, { at: [10, 0, -50] }, { at: [0, 10, 0] }]);
    expect(r.log.indexOf('errand:short:errand')).toBeLessThan(r.log.indexOf('errand:done:errand'));
    expect(r.log).toContain('trade:eggs:short');
    expect(r.log.filter((t) => t === 'cargo:lost:eggs')).toHaveLength(2);
    expect(r.log).toContain('errand:done:errand');
    expect(r.vars[H('eggs')]).toBe(4);
    // every change of the bag is one the store keeps: the bag mechanic carries it
    expect(r.c.bag).toEqual({ slice: 'bag' });
    expect(r.c.produces).toEqual([{ type: 'grant', slice: 'bag' }, { type: 'consume', slice: 'bag' }]);
  });

  it('says what is wrong with a malformed verb', () => {
    const bad = (m, re) => expect(() => composeMechanics([m, EXIT], ctx)).toThrow(re);
    bad({ kind: 'trade', at: [0, 0, 0] }, /item is what is had/);
    bad({ kind: 'trade', item: 'eggs', at: [0, 0, 0], needs: [{ item: 'eggs' }] }, /its own price/);
    bad({ kind: 'cargo', item: 'eggs' }, /fragile: true, or perishable/);
    bad({ kind: 'cargo', item: 'eggs', perishable: 0 }, /perishable is the seconds/);
    bad({ kind: 'deliver', at: [0, 0, 0] }, /wants is/);
    // the bag named by default: a level resolved before its game trusts it, the game's store checks it
    expect(() => composeMechanics([{ kind: 'deliver', at: [0, 0, 0], wants: [{ item: 'eggs' }] }], { player: 'hero', storeSchema: { slices: [{ name: 'hero', kind: 'character' }] } })).toThrow(/slice 'bag' is not in the store/);
  });
});

describe('shift: a driving job in a city vehicle, from its depot and back (gameworld/jobsified.js)', () => {
  const DEPOT = [0, 40, 0], STOPS = [[60, 0, 0], [120, 0, 0]];
  const SHIFT = { kind: 'shift', id: 'bins', depot: DEPOT, radius: 9, cabs: ['car-7', 'car-9'], stops: STOPS.map((at) => ({ at })), reward: [{ item: 'coin', n: 40 }], after: 'took-bins', vehicle: 'garbage truck', yard: 'works yard', done: 'Bins emptied' };
  const TASK = { kind: 'task', id: 'bins', app: 'jobsified', flag: 'took-bins', name: 'Jobsified', subscribe: true };
  // (a bus a walker steps through, with whole events fed between: the mount's { type, rider, mount })
  function drive(mechs, script) {
    const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, ...mechs, EXIT], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
    let prev;
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    for (const step of script) {
      if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
      if (step.ev) pump([step.ev]);
    }
    return { vars: s.vars, log: s.log.map((r) => r.type) };
  }
  const take = { ev: { type: 'app:take:bins' } }, inCab = (m = 'car-7') => ({ ev: { type: 'mounted', rider: 'hero', mount: m } }), out = (m = 'car-7') => ({ ev: { type: 'dismounted', rider: 'hero', mount: m } });
  const round = [{ at: STOPS[0] }, { at: [90, 20, 0] }, { at: STOPS[1] }, { at: [60, 60, 0] }, { at: DEPOT }];

  it('is driven: in one of the depot\'s vehicles once taken, every stop made in it, back at the depot it pays', () => {
    const r = drive([SHIFT, TASK], [take, { at: DEPOT }, inCab(), ...round]);
    expect(r.log).toEqual(expect.arrayContaining(['flag:on-bins', 'flag:stop-bins-1', 'flag:stop-bins-2', 'flag:done-bins', 'errand:done:bins']));
    expect(r.vars[H('coin')]).toBe(40);
  });
  it('counts nothing before it is taken, on foot, or in a vehicle that is not the depot\'s', () => {
    for (const script of [[inCab(), ...round], [take, ...round], [take, inCab('car-3'), ...round], [take, inCab(), out(), ...round]]) {
      const r = drive([SHIFT, TASK], script);
      expect(r.log).not.toContain('errand:done:bins');
      expect(r.log.filter((t) => t.startsWith('flag:stop-'))).toEqual([]);
    }
    // (taken while already in one: on the clock at once)
    expect(drive([SHIFT, TASK], [inCab(), take, ...round]).log).toContain('errand:done:bins');
  });
  it('pays only for the whole round: back early says what is left, and a one-off pays once', () => {
    const early = drive([SHIFT, TASK], [take, inCab(), { at: STOPS[0] }, { at: [30, 60, 0] }, { at: DEPOT }]);
    expect(early.log).toContain('shift:short:bins');
    expect(early.log).not.toContain('errand:done:bins');
    const twice = drive([SHIFT, TASK], [take, inCab(), ...round, { at: [30, 80, 0] }, ...round]);
    expect(twice.log.filter((t) => t === 'errand:done:bins')).toHaveLength(1);
    expect(twice.vars[H('coin')]).toBe(40);
  });
  it('a standing shift opens its round again when it pays, and pays again for the next', () => {
    const again = drive([{ ...SHIFT, repeat: true }, TASK], [take, inCab(), ...round, ...round]);
    expect(again.log.filter((t) => t === 'errand:done:bins')).toHaveLength(2);
    expect(again.vars[H('coin')]).toBe(80);
    // (the round is the stops' own flags: a stop made twice in one round counts once)
    // (a yard is a box: brought back anywhere in it, a long yard's far end too)
    const yard = drive([{ ...SHIFT, half: [30, 6] }, TASK], [take, inCab(), { at: STOPS[0] }, { at: STOPS[1] }, { at: [60, 60, 0] }, { at: [-28, 44, 0] }]);
    expect(yard.log).toContain('errand:done:bins');
        const doubled = drive([{ ...SHIFT, repeat: true }, TASK], [take, inCab(), { at: STOPS[0] }, { at: [30, 60, 0] }, { at: STOPS[0] }, { at: [30, 60, 0] }, { at: DEPOT }]);
    expect(doubled.log).not.toContain('errand:done:bins');
  });
  it('a malformed shift says what is wrong', () => {
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, cabs: [] }, EXIT], ctx)).toThrow(/cabs is the ids/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, stops: [] }, EXIT], ctx)).toThrow(/stops is/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, depot: [1, 2] }, EXIT], ctx)).toThrow(/depot is/);
  });
});
