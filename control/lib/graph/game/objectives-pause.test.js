// A PAUSE (game/objectives.js `pause`): a beat let breathe, the next task begun its seconds after the one before is met;
// a place reached in the pause is met as the task begins, never before it. QUIET: no count of the tasks met on the HUD.
// And a hold's clock shown only while it is in hand. Driven on the bus by hand, as the scan's test drives it.
import { describe, expect, it } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { objectiveNames } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
function play(tasks, extra = {}) {
  const c = composeMechanics([{ kind: 'objectives', tasks, ...extra }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); stand([0, 0, 0]);
  return { s, ev, stand, time, pump, cur: () => s.vars[objectiveNames('obj').task], begun: () => s.log.filter((e) => e.type === 'objective:begin').length };
}
const A = { id: 'a', kind: 'reach', text: 'A', at: [40, 0, 0], radius: 5 };
const Bt = { id: 'b', kind: 'reach', text: 'B', at: [80, 0, 0], radius: 5, pause: 4 };

describe('a pause', () => {
  it('begins the next task its seconds after the one before is met', () => {
    const P = play([A, Bt]);
    P.stand([40, 0, 0]);
    expect(P.cur()).toBe(1);
    expect(P.begun()).toBe(1);
    P.time(3);
    expect(P.begun()).toBe(1);                      // (still breathing)
    P.time(1.5);
    expect(P.begun()).toBe(2);
  });

  it('a place reached in the pause is not met before its task begins, and is met as it begins', () => {
    const P = play([A, Bt]);
    P.stand([40, 0, 0]); P.stand([80, 0, 0]);
    expect(P.cur()).toBe(1);                        // (there already: not met, not begun)
    P.time(4.5);
    expect(P.cur()).toBe(2);                        // (met as it began, standing in it)
  });

  it('a pause on the first waits after the level starts; quiet shows no count; a hold\'s clock only while in hand', () => {
    const P = play([{ ...A, pause: 2 }]);
    expect(P.begun()).toBe(0);
    P.time(2.5);
    expect(P.begun()).toBe(1);
    const hud = (x) => composeMechanics([{ kind: 'objectives', tasks: [A, { id: 'h', kind: 'hold', text: 'Hold', seconds: 5 }], ...x }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }).events.hud;
    expect(hud({}).some((r) => r.label === 'Objective')).toBe(true);
    expect(hud({ quiet: true }).some((r) => r.label === 'Objective')).toBe(false);
    expect(hud({}).find((r) => r.label === 'Hold')).toMatchObject({ id: 'obj-hold-1' });
    expect(() => composeMechanics([{ kind: 'objectives', tasks: [{ ...A, pause: 40 }] }], { player: 'p', spawn: [0, 0, 0] })).toThrow(/pause is the seconds/);
  });

  it('an act is met when the page says it was done, only while it is in hand', () => {
    const P = play([{ id: 'walk', kind: 'act', on: 'lesson:move', text: 'Walk' }, { id: 'go', kind: 'act', on: 'lesson:boost', text: 'Boost', pause: 1 }]);
    P.pump([{ type: 'lesson:boost' }]);
    expect(P.cur()).toBe(0);                                  // (not the task in hand: nothing)
    P.pump([{ type: 'lesson:move' }]);
    expect(P.cur()).toBe(1);
    P.pump([{ type: 'lesson:boost' }]);
    expect(P.cur()).toBe(1);                                  // (said in the pause, before it began: not met)
    P.time(1.5); P.pump([{ type: 'lesson:boost' }]);
    expect(P.cur()).toBe(2);
    expect(() => composeMechanics([{ kind: 'objectives', tasks: [{ id: 'x', kind: 'act', text: 'X' }] }], { player: 'p', spawn: [0, 0, 0] })).toThrow(/on is the bus event/);
  });
});
