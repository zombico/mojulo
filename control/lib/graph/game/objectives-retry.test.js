// A RETRY (game/objectives.js `retry`, RETRY): the player down while a task is in hand: the screen faded, then the player
// up whole where it fell and the task begun again (its foes up and whole, its `again` ops), the level going on, never
// lost. Driven on the bus by hand.
import { describe, expect, it } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { objectiveNames, RETRY } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';
import { SCREEN_VARS } from '../playscape/ui/cues.js';

const B = buildBus();
function play(tasks, extra = {}) {
  const c = composeMechanics([{ kind: 'objectives', tasks, ...extra }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); stand([0, 0, 0]);
  return { c, s, stand, time, pump, ops: () => { const o = (s._ctrlOps ?? []).map(({ op, who, at }) => ({ op, who, ...(at ? { at } : {}) })); s._ctrlOps = []; return o; } };
}
const TASKS = [{ id: 'a', kind: 'reach', text: 'A', at: [40, 0, 0], radius: 5 }, { id: 'b', kind: 'clear', text: 'B', foes: ['f'], again: [{ op: 'spawn', who: 'f', at: [90, 0, 0] }] }];

describe('a retry', () => {
  it('fades the screen as the player falls, then stands it up and begins the task in hand again, its foe put back', () => {
    const P = play(TASKS, { retry: true });
    P.stand([40, 0, 0]); P.ops();
    P.pump([{ type: 'down', entity: 'p' }]);
    expect(P.s.vars[SCREEN_VARS.fade]).toBe(1);
    expect(P.ops()).toEqual([]);
    P.time(RETRY.after + 0.2);
    expect(P.ops()).toEqual([{ op: 'spawn', who: 'p' }, { op: 'spawn', who: 'f' }, { op: 'spawn', who: 'f', at: [90, 0, 0] }]);
    P.time(RETRY.back + 0.2);
    expect(P.s.vars[SCREEN_VARS.fade]).toBe(0);
    expect(P.s.vars[objectiveNames('obj').retries]).toBe(1);
    expect(P.s.vars[objectiveNames('obj').task]).toBe(1);                       // (still the task in hand: nothing lost)
    expect(P.c.on.dead).toBeUndefined();
  });

  it('is refused unless it can be done', () => {
    expect(() => play(TASKS, { retry: { after: 99 } })).toThrow(/retry is true, or/);
    expect(() => play([{ ...TASKS[0], again: [{ op: 'spawn' }] }], { retry: true })).toThrow(/again is \[\{ op, who/);
  });
});
