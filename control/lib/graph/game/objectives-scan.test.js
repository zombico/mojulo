// A SCAN (game/objectives.js `scan`): the ring stood in while the readout fills. Its clock runs only inside the ring and
// keeps what it had when the pilot steps out (`total: false` starts it again); met, what it found is said as an event a
// script answers. Driven on the bus by hand, as the objectives' own test drives them.
import { describe, expect, it } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { objectiveNames } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
function play(task) {
  const c = composeMechanics([{ kind: 'objectives', tasks: [task, { id: 'out', kind: 'reach', text: 'Out', at: [80, 0, 0] }] }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const stand = (at) => { for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); stand([0, 0, 0]);
  return { s, ev, stand, time, cur: () => s.vars[objectiveNames('obj').task], log: () => s.log };
}
const SCAN = { id: 'site', kind: 'scan', text: 'Scan the site', at: [40, 0, 0], radius: 10, seconds: 4, found: 'Nickel-iron, rich: a seam worth the rock' };

describe('a scan', () => {
  it('runs only inside its ring, keeps what it had stepping out, and is met when its seconds are in', () => {
    const P = play(SCAN);
    P.time(6);
    expect(P.cur()).toBe(0);                       // (outside the ring: nothing)
    P.stand([40, 0, 0]); P.time(2.5);
    P.stand([0, 0, 0]); P.time(5);
    expect(P.cur()).toBe(0);                       // (out of it: held where it was)
    P.stand([40, 2, 0]); P.time(2);
    expect(P.cur()).toBe(1);
    // (said as it is met: the event in the log, its words on the reaction that raises it; the bus's log keeps the type)
    expect(P.log().some((e) => e.type === 'objective:found')).toBe(true);
    expect(P.log().some((e) => e.type === 'objective:found:site')).toBe(true);   // (its task in its type, for a log that keeps types alone)
    expect(P.ev.reactions.find((r) => r.type === 'objective:found')).toMatchObject({ task: 'site', text: SCAN.found });
  });

  it('total: false starts it again when the pilot steps out', () => {
    const P = play({ ...SCAN, total: false });
    P.stand([40, 0, 0]); P.time(2.5); P.stand([0, 0, 0]); P.time(1.5); P.stand([40, 0, 0]); P.time(2.2);
    expect(P.cur()).toBe(0);
    P.time(2.5);
    expect(P.cur()).toBe(1);
  });

  it('refuses a scan with no ring or no seconds, teaching', () => {
    expect(() => composeMechanics([{ kind: 'objectives', tasks: [{ ...SCAN, radius: undefined }] }], { player: 'p', spawn: [0, 0, 0] })).toThrow(/radius is the ring's/);
    expect(() => composeMechanics([{ kind: 'objectives', tasks: [{ ...SCAN, seconds: 0 }] }], { player: 'p', spawn: [0, 0, 0] })).toThrow(/seconds is how long the scan takes/);
  });
});
