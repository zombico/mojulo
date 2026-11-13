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
