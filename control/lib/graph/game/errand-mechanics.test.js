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
      if (step.secs) for (let k = 0; k < Math.round(step.secs * 10); k++) pump(B.tickTimers(s, 0.1));
    }
    return { vars: s.vars, log: s.log.map((r) => r.type), warps: s._ctrlWarps };
  }
  const take = { ev: { type: 'app:take:bins' } }, inCab = (m = 'car-7') => ({ ev: { type: 'mounted', rider: 'hero', mount: m } }), out = (m = 'car-7') => ({ ev: { type: 'dismounted', rider: 'hero', mount: m } });
  // (at a place, the key held for its seconds and let go, then on a little)
  const holdAt = (at, secs = 1.6) => [{ at }, { ev: { type: 'shift:hold:bins' } }, { secs }, { ev: { type: 'shift:let:bins' } }, { at: [at[0], 40, 0] }];
  // ROUTE: its stops in order, each held at (its doors open); the last pays
  const ROUTE = { ...SHIFT, mode: 'route', hold: 1.5, done: 'Doors closed' }, round = [...holdAt(STOPS[0]), ...holdAt(STOPS[1])];

  it('route: the next stop held at in the vehicle once taken is made; the last made pays', () => {
    const r = drive([ROUTE, TASK], [take, inCab(), ...round]);
    expect(r.log).toEqual(expect.arrayContaining(['flag:on-bins', 'flag:stop-bins-1', 'flag:stop-bins-2', 'flag:done-bins', 'errand:done:bins']));
    expect(r.vars[H('coin')]).toBe(40);
  });
  it('route: nothing counts before it is taken, on foot, in a vehicle not its own, out of order or for a short hold', () => {
    for (const script of [[inCab(), ...round], [take, ...round], [take, inCab('car-3'), ...round], [take, inCab(), out(), ...round], [take, inCab(), ...holdAt(STOPS[1])], [take, inCab(), ...holdAt(STOPS[0], 0.5)]]) {
      const r = drive([ROUTE, TASK], script);
      expect(r.log).not.toContain('errand:done:bins');
      expect(r.log.filter((t) => t.startsWith('flag:stop-'))).toEqual([]);
    }
    // (taken while already in one: on the clock at once)
    expect(drive([ROUTE, TASK], [inCab(), take, ...round]).log).toContain('errand:done:bins');
  });
  it('route: a one-off pays once; a standing one begins again from its first stop and pays again', () => {
    const twice = drive([ROUTE, TASK], [take, inCab(), ...round, ...round]);
    expect(twice.log.filter((t) => t === 'errand:done:bins')).toHaveLength(1);
    const again = drive([{ ...ROUTE, repeat: true }, TASK], [take, inCab(), ...round, ...round]);
    expect(again.log.filter((t) => t === 'errand:done:bins')).toHaveLength(2);
    expect(again.vars[H('coin')]).toBe(80);
    expect(again.vars['next-bins']).toBe(1);
  });
  it('is paid with a card: its name over its pay', () => {
    const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...ROUTE, repeat: true }, EXIT], ctx);
    expect(c.events.hud).toContainEqual({ on: 'shift:paid:bins', as: 'banner', text: 'Route complete', sub: 'Paid 40 coin · another when you are ready' });
  });
  // COLLECT: piles held at in the vehicle, a load, emptied at the dump
  const PILES = [[60, 0, 0], [120, 0, 0], [180, 0, 0]], DUMP = [300, 0, 0];
  const COLLECT = { ...SHIFT, mode: 'collect', stops: PILES.map((at) => ({ at })), load: 2, hold: 1, unload: { at: DUMP, half: [12, 8] } };
  it('collect: a pile held at in the vehicle for its seconds is taken on; a short hold, on foot, or with the vehicle full takes nothing', () => {
    const r = drive([COLLECT, TASK], [take, inCab(), ...holdAt(PILES[0], 1.2)]);
    expect(r.log).toContain('flag:stop-bins-1');
    expect(r.vars['load-bins']).toBe(1);
    expect(drive([COLLECT, TASK], [take, inCab(), ...holdAt(PILES[0], 0.5)]).vars['load-bins']).toBe(0);
    expect(drive([COLLECT, TASK], [take, inCab(), out(), ...holdAt(PILES[0])]).vars['load-bins']).toBe(0);
    const full = drive([COLLECT, TASK], [take, inCab(), ...holdAt(PILES[0]), ...holdAt(PILES[1]), ...holdAt(PILES[2])]);
    expect(full.vars['load-bins']).toBe(2);
    expect(full.vars['flag-full-bins']).toBe(1);
    expect(full.log).toContain('shift:isfull:bins');
    expect(full.vars['flag-stop-bins-3']).toBe(0);
  });
  it('collect: full, emptied at the dump it pays and is empty again; not full, it says so; every pile taken, all are laid again', () => {
    const r = drive([{ ...COLLECT, repeat: true }, TASK], [take, inCab(), ...holdAt(PILES[0]), { at: DUMP }, { at: [250, 40, 0] }, ...holdAt(PILES[1]), { at: DUMP }]);
    expect(r.log).toContain('shift:short:bins');
    expect(r.log.filter((t) => t === 'errand:done:bins')).toHaveLength(1);
    expect(r.vars[H('coin')]).toBe(40);
    expect(r.vars['load-bins']).toBe(0);
    expect(r.vars['flag-full-bins']).toBe(0);
    const swept = drive([{ ...COLLECT, load: 3 }, TASK], [take, inCab(), ...PILES.flatMap((p) => holdAt(p))]);
    expect(swept.log).toContain('shift:swept:bins');
    expect(PILES.map((_, k) => swept.vars[`flag-stop-bins-${k + 1}`])).toEqual([0, 0, 0]);
  });
  // HAUL: driven to its site, paid; got out there, taken back to its spot
  const HAUL = { kind: 'shift', mode: 'haul', id: 'bins', depot: [0, 0, 0], cabs: ['car-7'], site: { at: [400, 0, 0], half: [20, 15] }, back: [0, 0, 0], reward: [{ item: 'coin', n: 60 }], after: 'took-bins', repeat: true };
  it('haul: driven to its site it pays once a run; got out there, it goes back to its spot and the next run is open', () => {
    const r = drive([HAUL, TASK], [take, inCab(), { at: [200, 0, 0] }, { at: [395, 10, 0] }, { at: [380, 0, 0] }, { at: [395, 10, 0] }]);
    expect(r.log.filter((t) => t === 'errand:done:bins')).toHaveLength(1);
    expect(r.vars[H('coin')]).toBe(60);
    const back = drive([HAUL, TASK], [take, inCab(), { at: [395, 10, 0] }, out()]);
    expect(back.warps).toEqual({ 'car-7': [0, 0, 0] });
    expect(back.vars['delivered-bins']).toBe(0);
    expect(back.vars['flag-on-bins']).toBe(0);
    // (on foot at the site: nothing)
    expect(drive([HAUL, TASK], [take, { at: [395, 10, 0] }]).log).not.toContain('errand:done:bins');
  });
  it('haul of several calls: only the vehicle called counts; each delivered and left goes back, the next called; after the last, the first', () => {
    const CALLS = { ...HAUL, cabs: ['car-7', 'car-8'], calls: [{ cab: 'car-7', site: { at: [400, 0, 0], radius: 10 }, back: [0, 0, 0] }, { cab: 'car-8', site: { at: [0, 400, 0], radius: 10 }, back: [5, 0, 0] }] };
    // (the second's vehicle while the first is called: nothing)
    expect(drive([CALLS, TASK], [take, inCab('car-8'), { at: [0, 400, 0] }]).log).not.toContain('errand:done:bins');
    const r = drive([CALLS, TASK], [take, inCab('car-7'), { at: [400, 0, 0] }, out('car-7'), inCab('car-8'), { at: [0, 400, 0] }, out('car-8')]);
    expect(r.log.filter((t) => t === 'errand:done:bins')).toHaveLength(2);
    expect(r.vars[H('coin')]).toBe(120);
    expect(r.vars['call-bins']).toBe(1);
    expect(r.warps).toEqual({ 'car-7': [0, 0, 0], 'car-8': [5, 0, 0] });
    expect([1, 2].map((k) => [r.vars[`flag-on-bins-${k}`], r.vars[`flag-done-bins-${k}`]])).toEqual([[0, 0], [0, 0]]);
    // (mid-round, each call's own flags kept for the guide)
    const mid = drive([CALLS, TASK], [take, inCab('car-7'), { at: [400, 0, 0] }, out('car-7')]);
    expect([mid.vars['call-bins'], mid.vars['flag-on-bins-1'], mid.vars['flag-done-bins-1']]).toEqual([2, 1, 1]);
  });
  it('a malformed shift says what is wrong', () => {
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...COLLECT, load: 9 }, EXIT], ctx)).toThrow(/load is how many/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...HAUL, site: undefined }, EXIT], ctx)).toThrow(/site is/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, mode: 'fly' }, EXIT], ctx)).toThrow(/mode is/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, cabs: [] }, EXIT], ctx)).toThrow(/cabs is the ids/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, stops: [] }, EXIT], ctx)).toThrow(/stops is/);
    expect(() => composeMechanics([{ kind: 'bag', slice: 'bag' }, { ...SHIFT, depot: [1, 2] }, EXIT], ctx)).toThrow(/depot is/);
  });
});
