// A TASK'S OPS (game/objectives.js `ops`): the cast told as it begins, once (a group that comes with it uncounted, an
// ally let go), on the bus's control queue as a clear's own foes are woken. Driven on the bus by hand.
import { describe, expect, it } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
function play(tasks) {
  const c = composeMechanics([{ kind: 'objectives', tasks }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  pump(ev.initial ?? []); stand([0, 0, 0]);
  return { s, stand, ops: () => { const o = (s._ctrlOps ?? []).map(({ op, who, fresh }) => ({ op, who, ...(fresh ? { fresh } : {}) })); s._ctrlOps = []; return o; } };
}

describe('a task\'s ops', () => {
  it('are issued as it begins, once, beside a clear\'s own foes woken', () => {
    const P = play([{ id: 'a', kind: 'reach', text: 'A', at: [40, 0, 0], radius: 5 }, { id: 'b', kind: 'clear', text: 'B', foes: ['f'], ops: [{ op: 'spawn', who: 'g', fresh: true }, { op: 'unhold', who: 'cole' }] }]);
    expect(P.ops()).toEqual([]);
    P.stand([40, 0, 0]);
    expect(P.ops()).toEqual([{ op: 'spawn', who: 'f', fresh: true }, { op: 'spawn', who: 'g', fresh: true }, { op: 'unhold', who: 'cole' }]);
    P.stand([0, 0, 0]); P.stand([40, 0, 0]);
    expect(P.ops()).toEqual([]);
  });

  it('are refused unless each names its op and who', () => {
    expect(() => play([{ id: 'a', kind: 'hold', text: 'A', seconds: 3, ops: [{ op: 'spawn' }] }])).toThrow(/ops is \[\{ op, who/);
  });
});
