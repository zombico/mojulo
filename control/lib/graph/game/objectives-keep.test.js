// A TASK'S KEEP (game/objectives.js `keep`): an asset defended. One of its ids down while the task is in hand loses the
// level; with a retry it begins the task again, the ids stood up whole; down before or after the task, it costs nothing.
// Driven on the bus by hand.
import { describe, expect, it } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { objectiveNames, RETRY } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
function play(tasks, extra = {}) {
  const c = composeMechanics([{ kind: 'objectives', tasks, ...extra }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); stand([0, 0, 0]);
  const types = () => s.log.map((e) => e.type);
  return { c, s, stand, time, pump, types, ops: () => { const o = (s._ctrlOps ?? []).map(({ op, who }) => ({ op, who })); s._ctrlOps = []; return o; } };
}
// (a walk, then a wave to clear while the candle is kept up)
const TASKS = [{ id: 'a', kind: 'reach', text: 'A', at: [40, 0, 0], radius: 5 }, { id: 'b', kind: 'clear', text: 'B', foes: ['f'], keep: ['candle'] }];
const cur = objectiveNames('obj').task;

describe("a task's keep", () => {
  it('a kept id down while its task is in hand loses the level; down before it begins, nothing', () => {
    const P = play(TASKS);
    expect(P.c.on['objectives:failed']).toEqual({ end: 'fail' });
    P.pump([{ type: 'down', entity: 'candle' }]);
    expect(P.types()).not.toContain('objectives:failed');
    const Q = play(TASKS);
    Q.stand([40, 0, 0]);
    expect(Q.s.vars[cur]).toBe(1);
    Q.pump([{ type: 'down', entity: 'candle' }]);
    expect(Q.types()).toContain('objectives:failed');
  });

  it('with a retry it begins the task again, the kept ids and the foes stood up whole, the level going on', () => {
    const P = play(TASKS, { retry: true });
    expect(P.c.on['objectives:failed']).toBeUndefined();
    P.stand([40, 0, 0]); P.ops();
    P.pump([{ type: 'down', entity: 'candle' }]);
    P.time(RETRY.after + 0.2);
    expect(P.ops()).toEqual(expect.arrayContaining([{ op: 'spawn', who: 'candle' }, { op: 'spawn', who: 'p' }, { op: 'spawn', who: 'f' }]));
    expect(P.s.vars[cur]).toBe(1);
    expect(P.types()).not.toContain('objectives:failed');
  });

  it('is refused unless it names ids', () => {
    expect(() => play([{ ...TASKS[1], keep: [] }])).toThrow(/keep is the ids kept up/);
  });
});
