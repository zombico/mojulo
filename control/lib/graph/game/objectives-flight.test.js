// OBJECTIVES IN THE AIR (game/objectives.js: gates, land, band, protect): a flight's tasks lowered onto the bus, driven
// by hand with a pilot whose facts are a fly rule's (its transform, airspeed, climb, the ground under it). The gates
// are flown in order and one flown out of turn does nothing; a landing is met only soft and inside a pad; a band's
// clock runs only while every gauge holds and starts again when one is left (or adds up), a heading's band wrapping
// through north; a protected one down loses the level, and an escort is met as it arrives. And what it refuses, teaching.
import { describe, expect, it } from 'vitest';

import { composeMechanics } from './mechanics.js';
import { objectiveNames } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const KT = 1 / 1.94384;   // a knot in m/s

/** The list on the bus, and a pilot to fly in it: its facts set by hand, the bus's sources read each step. */
function fly(tasks) {
  const c = composeMechanics([{ kind: 'objectives', tasks }], { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  const P = { id: 'p', transform: { pos: [0, 0, 0], heading: 0 }, airspeed: 0, climbRate: 0, agl: 0 }, others = {};
  let prev;
  const pump = (events) => { B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  const look = () => { const z = B.deriveZoneEvents([P, ...Object.values(others)], prev, ev.sources); prev = z.prev; pump(z.events); };
  const at = (pos, facts = {}) => { P.transform.pos = pos.slice(); Object.assign(P, facts); if (facts.heading !== undefined) P.transform.heading = facts.heading; look(); look(); };
  const time = (secs) => { for (let k = 0; k < Math.round(secs * 10); k++) { look(); pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); look();
  const cur = () => s.vars[objectiveNames('obj').task];
  return { c, s, P, at, time, cur, others, look, pump, log: () => s.log.map((r) => r.type) };
}
// a compass bearing (0 north, 90 east) as the fly rule's heading (radians from +x)
const hdg = (deg) => ((90 - deg) * Math.PI) / 180;

describe('objectives in the air', () => {
  it('gates are flown in order: one flown out of turn does nothing, each passed is said, the last meets the task', () => {
    const gates = [{ at: [0, 100, 50], radius: 10 }, { at: [0, 200, 80], radius: 10 }, { at: [0, 300, 60], radius: 10 }];
    const F = fly([{ id: 'course', kind: 'gates', text: 'Fly the gates', gates }]);
    F.at([0, 200, 80]);                 // the second first: nothing
    expect(F.log().filter((t) => t === 'objective:gate')).toEqual([]);
    F.at([0, 100, 50]); F.at([0, 150, 60]); F.at([0, 200, 80]);
    expect(F.log().filter((t) => t === 'objective:gate').length).toBe(2);
    expect(F.cur()).toBe(0);
    F.at([0, 250, 70]); F.at([0, 300, 60]);
    expect(F.cur()).toBe(1);
    expect(F.log()).toContain('objectives:done');
    // (a gate is met in three dimensions: under it is not through it)
    const G = fly([{ id: 'one', kind: 'gates', text: 'Fly it', gates: [gates[0]] }]);
    G.at([0, 100, 0]);
    expect(G.cur()).toBe(0);
  });

  it('a landing is met by a soft touchdown inside a pad: not a hard one, not one beside it, not before it is in hand', () => {
    const pads = [{ at: [0, 500, 1], half: [15, 300, 3] }];
    const tasks = [{ id: 'up', kind: 'reach', text: 'Climb out', at: [0, 0, 300], radius: 50, planar: false }, { id: 'down', kind: 'land', text: 'Land on the runway', pads }];
    const F = fly(tasks);
    F.at([0, 400, 1]); F.pump([{ type: 'touchdown', entity: 'p', hard: 0 }]);   // a landing before the climb: nothing
    expect(F.cur()).toBe(0);
    F.at([0, 0, 300]);
    expect(F.cur()).toBe(1);
    F.at([0, 400, 1]); F.pump([{ type: 'touchdown', entity: 'p', hard: 1 }]);   // too hard
    expect(F.cur()).toBe(1);
    F.at([80, 400, 1]); F.pump([{ type: 'touchdown', entity: 'p', hard: 0 }]);  // in the grass
    expect(F.cur()).toBe(1);
    F.at([0, 400, 1]); F.pump([{ type: 'touchdown', entity: 'p', hard: 0 }]);
    expect(F.cur()).toBe(2);
    expect(F.log()).toContain('objectives:done');
  });

  it('a band is held only while every gauge holds, and starts again when one is left', () => {
    const F = fly([{ id: 'level', kind: 'band', text: 'Hold 300 m, 90 kt, heading 270', band: { alt: [280, 320], speed: [85, 95], heading: [260, 280] }, seconds: 5 }]);
    F.at([0, 0, 300], { airspeed: 90 * KT, heading: hdg(270) });
    F.time(3.2);
    expect(F.s.vars.__obj_held0).toBe(3);
    F.at([0, 0, 360]);                  // climbed out of it: the clock starts again
    F.time(1.1);
    expect(F.s.vars.__obj_held0).toBe(0);
    F.at([0, 0, 300]);
    F.time(4.2);
    expect(F.cur()).toBe(0);
    F.time(1.1);
    expect(F.cur()).toBe(1);
    // (adding up: what was held before the slip counts)
    const T = fly([{ id: 'total', kind: 'band', text: 'Hold it', band: { speed: [85, null] }, seconds: 4, total: true }]);
    T.at([0, 0, 300], { airspeed: 90 * KT }); T.time(2.1);
    T.at([0, 0, 300], { airspeed: 60 * KT }); T.time(2.1);
    T.at([0, 0, 300], { airspeed: 90 * KT }); T.time(2.1);
    expect(T.cur()).toBe(1);
  });

  it('a heading band wraps through north', () => {
    const F = fly([{ id: 'north', kind: 'band', text: 'Fly north', band: { heading: [350, 10] }, seconds: 2 }]);
    F.at([0, 0, 300], { heading: hdg(355) }); F.time(1.1);
    F.at([0, 0, 300], { heading: hdg(5) }); F.time(1.1);
    expect(F.cur()).toBe(1);
    const G = fly([{ id: 'north', kind: 'band', text: 'Fly north', band: { heading: [350, 10] }, seconds: 2 }]);
    G.at([0, 0, 300], { heading: hdg(180) }); G.time(3.1);
    expect(G.cur()).toBe(0);
  });

  it('a protected one down loses the level; an escort is met as the first of them arrives', () => {
    const F = fly([{ id: 'cover', kind: 'protect', text: 'Keep the freighter up', who: ['freighter'], seconds: 3 }]);
    expect(F.c.on['objectives:failed']).toEqual({ end: 'fail' });
    F.time(1.1);
    F.pump([{ type: 'down', entity: 'freighter' }]);
    expect(F.log()).toContain('objectives:failed');
    const G = fly([{ id: 'cover', kind: 'protect', text: 'Keep it up', who: ['freighter'], seconds: 3 }]);
    G.time(3.2);
    expect(G.cur()).toBe(1);
    G.pump([{ type: 'down', entity: 'freighter' }]);      // down after it was met: the level was already won
    expect(G.log()).not.toContain('objectives:failed');
    const E = fly([{ id: 'escort', kind: 'protect', text: 'See it home', who: ['freighter'], arrive: { at: [0, 1000, 100], radius: 40 } }]);
    E.others.freighter = { id: 'freighter', transform: { pos: [0, 500, 100], heading: 0 } };
    E.look(); expect(E.cur()).toBe(0);
    E.others.freighter.transform.pos = [0, 990, 100]; E.look();
    expect(E.cur()).toBe(1);
  });

  it('refuses what it cannot lay, teaching', () => {
    const bad = (t) => () => fly([{ id: 't', text: 'x', ...t }]);
    expect(bad({ kind: 'gates', gates: [] })).toThrow(/gates is \[\{ at/);
    expect(bad({ kind: 'land', pads: [{ at: [0, 0, 0] }] })).toThrow(/pads is/);
    expect(bad({ kind: 'band', band: { altitude: [0, 1] }, seconds: 2 })).toThrow(/not a gauge \(alt, agl, speed/);
    expect(bad({ kind: 'band', band: { alt: [null, null] }, seconds: 2 })).toThrow(/not both null/);
    expect(bad({ kind: 'band', band: { alt: [300, 200] }, seconds: 2 })).toThrow(/only a heading wraps/);
    expect(bad({ kind: 'band', band: { alt: [200, 300] } })).toThrow(/seconds is how long the band is held/);
    expect(bad({ kind: 'protect', who: ['a'] })).toThrow(/met by seconds .* or by arrive/);
  });
});
