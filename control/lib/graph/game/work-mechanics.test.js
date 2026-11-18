// The work mechanic on the bus the page runs: what it lays, what it teaches, the work done by standing (and kept when
// left), what runs alone and burns, the shelf's two pads, one order a hand-in press, and the bell.
import { describe, it, expect } from 'vitest';
import { lowerMechanic, composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
// a small card: a board that chops (worked), a pot that cooks alone and burns, a plate; orders of one dish
const CARD = {
  id: 'bench', crew: { workers: 1, travel: 1 },
  stations: {
    chop: { verb: 'shovel', takes: { fish: 1 }, gives: { cut: 1 }, work: 2 },
    pot: { verb: 'shovel', takes: { rice: 1 }, gives: { cooked: 1 }, work: 1, wait: 3, hold: 2 },
    plate: { verb: 'bucket', takes: { cut: 1, cooked: 1 }, gives: { dish: 1 }, work: 1 },
  },
  demand: { every: 30, patience: 60, first: 0, cadence: 'steady', orders: [{ name: 'dish', wants: { dish: 1 } }] }, session: 120,
};
function level(params = {}) {
  const c = composeMechanics([{ kind: 'work', card: CARD, ...params }], { player: 'hero', spawn: [0, 0, 0], fall: 'none' });
  const s = B.createBusState(c.events, c.events.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  const press = (id) => pump([{ type: `use-w0-${id}` }]);
  const wait = (sec) => { for (let k = 0; k < sec * 4; k++) pump(B.tickTimers(s, 0.25)); };
  const leave = (id) => pump([{ type: 'exit', zone: `use-w0-${id}`, entity: 'hero' }]);
  return { c, s, V: s.vars, press, wait, leave, said: (t) => s.log.some((r) => r.type === t) };
}

describe('the work mechanic', () => {
  it('lays a use zone for each crate, station slot, shelf pad and the hand-in, and ends on the bell', () => {
    const m = lowerMechanic('work', { card: CARD }, { i: 0, player: 'hero', spawn: [0, 0, 0] });
    const uses = m.world.sources.map((z) => z.use).sort();
    expect(uses).toEqual(['w0-chop-0', 'w0-crate-fish', 'w0-crate-rice', 'w0-plate-0', 'w0-pot-0', 'w0-serve', 'w0-shelf-cooked-put', 'w0-shelf-cooked-take', 'w0-shelf-cut-put', 'w0-shelf-cut-take'].sort());
    expect(m.ends).toEqual(['success', 'fail']);
    expect(m.on).toEqual({ 'work:won': { end: 'success' }, 'work:lost': { end: 'fail' } });
    expect(m.work.hands).toBe(2);
  });
  it('teaches a card it cannot play', () => {
    expect(() => lowerMechanic('work', { card: 'nope' }, { i: 0, spawn: [0, 0, 0] })).toThrow(/starter/);
    expect(() => lowerMechanic('work', { card: CARD, hands: 1 }, { i: 0, spawn: [0, 0, 0] })).not.toThrow();
    expect(() => lowerMechanic('work', { card: { ...CARD, stations: { ...CARD.stations, pot: { ...CARD.stations.pot, gives: { cooked: 3 } } } }, hands: 2 }, { i: 0, spawn: [0, 0, 0] })).toThrow(/hands/);
  });
  it('a shovel is worked by standing at it: walked off it waits, its progress kept, and E resumes it', () => {
    const L = level();
    L.press('crate-fish');
    expect(L.V['held:bag:fish']).toBe(1);
    L.press('chop-0');
    expect(L.V['held:bag:fish']).toBe(0);
    L.wait(1);
    L.leave('chop-0');
    L.wait(5);
    expect(L.V['held:bag:cut']).toBe(0);
    expect(L.V['__w0:chop:0:p']).toBe(1);
    L.press('chop-0');
    L.wait(1.25);
    expect(L.V['held:bag:cut']).toBe(1);
    expect(L.said('work:made')).toBe(true);
  });
  it('what runs alone frees the hands, then burns when left past its hold', () => {
    const L = level();
    L.press('crate-rice'); L.press('pot-0'); L.wait(1.25);
    L.leave('pot-0');
    L.wait(3.25);
    expect(L.said('work:ready')).toBe(true);
    L.wait(2.5);
    expect(L.said('work:burned')).toBe(true);
    expect(L.V['w0:burned']).toBe(1);
    expect(L.V['__w0:pot:0']).toBe(0);
  });
  it('a shelf puts down on one pad and takes on the other', () => {
    const L = level();
    L.press('crate-fish'); L.press('chop-0'); L.wait(2.25);
    L.press('shelf-cut-put');
    expect([L.V['held:bag:cut'], L.V['held:w0-shelf-cut:cut'], L.V['w0:carry']]).toEqual([0, 1, 0]);
    L.press('shelf-cut-take');
    expect([L.V['held:bag:cut'], L.V['held:w0-shelf-cut:cut'], L.V['w0:carry']]).toEqual([1, 0, 1]);
  });
  it('shown, the work fills its pips as it is done, runs alone in its own, and goes out toward the burn', () => {
    const L = level({ show: true });
    const lit = (base) => [1, 2, 3, 4, 5].map((q) => L.s.byId[`w0-pot-0-pip-${base}-${q}`].on);
    L.press('crate-rice'); L.press('pot-0');
    L.wait(0.5);
    expect(lit('work')).toEqual([true, true, false, false, false]);
    L.wait(0.75);
    expect(lit('work').some(Boolean)).toBe(false);
    // what runs alone, then the hold: the pips lit are the fifths done (the wait) and the fifths left (the hold), read
    // off the slot's own clocks at every tick
    L.leave('pot-0');
    for (let k = 0; k < 4 * 5.5; k++) {
      L.wait(0.25);
      const P = L.V['__w0:pot:0'], w = L.V['__w0:pot:0:w'], h = L.V['__w0:pot:0:h'];
      if (P === 3) expect(lit('wait').filter(Boolean).length).toBe(Math.min(5, Math.floor((w * 5) / 3 + 1e-9)));
      if (P === 4) { expect(lit('wait').some(Boolean)).toBe(false); expect(lit('hold').filter(Boolean).length).toBe(5 - Math.floor((h * 5) / 2 + 1e-9)); }
    }
    expect(lit('hold')).toEqual([false, false, false, false, false]);
    expect(L.said('work:burned')).toBe(true);
    // absent, none of it is laid
    expect(level().s.entities.some((e) => e.type === 'work-pip')).toBe(false);
    expect(level().c.events.hud.some((h) => h.id)).toBe(false);
  });
  it('shown, what is in hand stands on the HUD only while it is held', () => {
    const L = level({ show: true });
    const row = L.c.events.hud.find((h) => h.id === 'w0-held-fish');
    expect(row).toMatchObject({ var: 'held:bag:fish', as: 'counter' });
    expect(L.V['ui-w0-held-fish']).toBe(0);
    L.press('crate-fish');
    expect(L.V['ui-w0-held-fish']).toBe(1);
    L.press('chop-0');
    expect(L.V['ui-w0-held-fish']).toBe(0);
  });
  it('one hand-in press serves one order, and the bell decides', () => {
    const L = level({ goal: 1, hands: 4 });
    const dish = () => {
      L.press('crate-fish'); L.press('chop-0'); L.wait(2.25);
      L.press('crate-rice'); L.press('pot-0'); L.wait(1.25); L.wait(3.25); L.press('pot-0');
      L.press('plate-0'); L.wait(1.25);
    };
    dish();
    expect(L.V['held:bag:dish']).toBe(1);
    L.wait(25);
    dish();
    expect(L.V['held:bag:dish']).toBe(2);
    L.press('serve');
    expect(L.V['w0:served']).toBe(1);
    expect(L.V['held:bag:dish']).toBe(1);
    L.wait(120);
    expect(L.said('work:won')).toBe(true);
  });
});

// SEATED (ctx.seats): every seat works the shift with its own hands; the stations, shelves and tickets are one
function seated(params = {}) {
  const c = composeMechanics([{ kind: 'work', card: CARD, ...params }], { player: 'hero', spawn: [0, 0, 0], fall: 'none', seats: ['hero-2'] });
  const s = B.createBusState(c.events, c.events.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  const press = (n, id) => pump([{ type: n === 1 ? `use-w0-${id}` : `s${n}:use-w0-${id}` }]);
  const leave = (n, id) => pump([{ type: 'exit', zone: n === 1 ? `use-w0-${id}` : `s${n}:use-w0-${id}`, entity: n === 1 ? 'hero' : `hero-${n}` }]);
  const wait = (sec) => { for (let k = 0; k < sec * 4; k++) pump(B.tickTimers(s, 0.25)); };
  return { c, s, V: s.vars, press, leave, wait };
}

describe('the work mechanic, seated', () => {
  it('no seats lays what it always did; seats lay each seat its own zones on its own body, never in the pilot\'s reach', () => {
    const ctx = { i: 0, player: 'hero', spawn: [0, 0, 0] };
    expect(lowerMechanic('work', { card: CARD, show: true }, { ...ctx, seats: [] })).toEqual(lowerMechanic('work', { card: CARD, show: true }, ctx));
    const m = lowerMechanic('work', { card: CARD }, { ...ctx, seats: ['hero-2'] });
    const one = m.world.sources.filter((z) => z.use), two = m.world.sources.filter((z) => z.seatUse);
    expect(two.map((z) => z.seatUse)).toEqual(one.map((z) => z.use));
    expect(two.every((z) => z.watch === 'hero-2' && z.seat === 2 && z.zone === `s2:use-${z.seatUse}`)).toBe(true);
    expect(one.every((z) => z.watch === 'hero' && !z.seat)).toBe(true);
    expect(m.work.seats).toEqual([{ n: 1, body: 'hero', hands: 'bag', carry: 'w0:carry' }, { n: 2, body: 'hero-2', hands: 'hands2', carry: 'w0:carry:2' }]);
  });
  it('each seat\'s state in its own corner, in its colour: its hands, and what it holds only while it holds it', () => {
    const L = seated({ show: true });
    const hud = L.c.events.hud;
    expect(hud.find((h) => h.var === 'w0:carry:2')).toMatchObject({ label: 'P2 hands', as: 'bar', slot: 'bottom-right', color: '#3b7be5' });
    const fish2 = hud.find((h) => h.id === 'w0-held-fish-2');
    expect(fish2).toMatchObject({ var: 'held:hands2:fish', slot: 'bottom-right', label: 'P2 fish' });
    expect(hud.find((h) => h.id === 'w0-held-fish')).toMatchObject({ var: 'held:bag:fish', slot: 'bottom-left' });
    L.press(2, 'crate-fish');
    expect([L.V['ui-w0-held-fish-2'], L.V['ui-w0-held-fish']]).toEqual([1, 0]);
  });
  it('each seat takes into its own hands, and walking off pauses only the work the walker was doing', () => {
    const L = seated();
    L.press(2, 'crate-fish');
    expect([L.V['held:hands2:fish'], L.V['held:bag:fish'], L.V['w0:carry:2'], L.V['w0:carry']]).toEqual([1, 0, 1, 0]);
    L.press(2, 'chop-0');
    expect(L.V['__w0:chop:0:by']).toBe(2);
    L.wait(1);
    L.leave(1, 'chop-0');   // seat 1 passing by: the chopping goes on
    expect(L.V['__w0:chop:0']).toBe(2);
    L.leave(2, 'chop-0');   // its own cook walks off: it waits
    expect(L.V['__w0:chop:0']).toBe(1);
    L.press(1, 'chop-0');   // seat 1 takes it up: done, it comes into seat 1's hands
    L.wait(1.25);
    expect([L.V['held:bag:cut'], L.V['held:hands2:cut']]).toEqual([1, 0]);
  });
  it('the shelf is the pass: one seat puts down, another takes up, and that seat serves', () => {
    const L = seated({ goal: 1, hands: 4 });
    L.press(1, 'crate-fish'); L.press(1, 'chop-0'); L.wait(2.25);
    L.press(1, 'shelf-cut-put');
    L.press(1, 'crate-rice'); L.press(1, 'pot-0'); L.wait(1.25); L.wait(3.25); L.press(1, 'pot-0');
    L.press(1, 'shelf-cooked-put');
    expect([L.V['held:w0-shelf-cut:cut'], L.V['held:w0-shelf-cooked:cooked'], L.V['w0:carry']]).toEqual([1, 1, 0]);
    L.press(2, 'shelf-cut-take'); L.press(2, 'shelf-cooked-take');
    L.press(2, 'plate-0'); L.wait(1.25);
    expect([L.V['held:hands2:dish'], L.V['held:bag:dish']]).toEqual([1, 0]);
    L.press(1, 'serve');   // seat 1's hands hold no dish: nothing served
    L.wait(0.25);
    expect(L.V['w0:served']).toBe(0);
    L.press(2, 'serve');
    expect([L.V['w0:served'], L.V['held:hands2:dish'], L.V['w0:carry:2']]).toEqual([1, 0, 0]);
  });
});
