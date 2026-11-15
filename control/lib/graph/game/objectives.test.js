// OBJECTIVES (game/objectives.js): a level's tasks done in order, lowered onto the bus. The smallest list that plays
// each kind once (a take, a clear, a hold, a reach), driven on the bus by hand: a task begins as its section is walked
// into and wakes its own foes; a way on is sealed until its task is met and puts a body back; a task met out of turn
// moves nothing on; the hold's waves come on its clock; the last task met wins. And what it refuses, teaching.
import { describe, expect, it } from 'vitest';

import { composeMechanics, MECHANIC_KINDS, TERMINAL_KINDS } from './mechanics.js';
import { OBJECTIVE_KINDS, objectiveNames, objectivesOf } from './objectives.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const zone = (x) => ({ at: [x, 0, 1], half: [4, 6, 3] });
const TASKS = [
  { id: 'arm', kind: 'take', text: 'Take the rounds', zone: zone(0), at: [3, 0, 0], door: { at: [5, 0, 0], back: [3.5, 0, 0] } },
  { id: 'room', kind: 'clear', text: 'Clear the room', zone: zone(10), foes: ['foe-1', 'foe-2'], door: { at: [15, 0, 0], back: [13.5, 0, 0] } },
  { id: 'yard', kind: 'hold', text: 'Hold the yard', zone: zone(20), seconds: 6, every: 2, waves: [['foe-3'], ['foe-4']], door: { at: [25, 0, 0], back: [23.5, 0, 0] } },
  { id: 'out', kind: 'reach', text: 'Get out', zone: zone(30), at: [32, 0, 0] },
];
const LIST = [{ kind: 'objectives', tasks: TASKS }];

/** The list on the bus, and a walker to stand in it. */
function play(list = LIST) {
  const c = composeMechanics(list, { player: 'p', spawn: [0, 0, 0], fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  const woke = [];
  let prev, at = [0, 0, 0];
  const pump = (events) => {
    B.processEvents(s, events); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); }
    for (const o of s._ctrlOps ?? []) if (o.op === 'spawn') woke.push(o.who);
    s._ctrlOps = [];
    const back = s._ctrlWarps?.p; if (back) { at = back.slice(); s._ctrlWarps = {}; }
  };
  const stand = (to) => { at = to.slice(); for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } return at; };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []); stand(at);
  const cur = () => s.vars[objectiveNames('obj').task];
  return { c, s, woke, stand, time, cur, down: (id) => pump([{ type: 'down', entity: id }]), log: () => s.log.map((r) => r.type) };
}

describe('objectives', () => {
  it('is a mechanic that can win a level', () => {
    expect(MECHANIC_KINDS).toContain('objectives');
    expect(TERMINAL_KINDS).toContain('objectives');
    expect(objectivesOf(LIST)).toBe(LIST[0]);
    const { c } = play();
    expect(c.on['objectives:done']).toEqual({ end: 'success' });
  });
  it('seals a way on until its task is met, and puts a body that walks into it back', () => {
    const P = play();
    expect(P.stand(TASKS[0].door.at)).toEqual(TASKS[0].door.back);
    expect(P.log()).toContain('objective:sealed');
    P.stand(TASKS[0].at);
    expect(P.cur()).toBe(1);
    // met: the same way lets the body through
    expect(P.stand(TASKS[0].door.at)).toEqual(TASKS[0].door.at);
  });
  it('wakes a section\'s foes as it is walked into, never before, and is met when every one is down', () => {
    const P = play();
    expect(P.woke).toEqual([]);
    P.stand(TASKS[0].at); P.stand(TASKS[1].zone.at);
    expect(P.woke).toEqual(['foe-1', 'foe-2']);
    P.down('foe-1');
    expect(P.cur()).toBe(1);
    P.down('foe-2');
    expect(P.cur()).toBe(2);
  });
  it('moves nothing on for a task met out of turn', () => {
    const P = play();
    // (the exit walked into before anything is done: not the task in hand)
    P.stand(TASKS[3].at);
    expect(P.cur()).toBe(0);
    expect(P.log()).not.toContain('objectives:done');
  });
  it('holds on a clock that runs only once the yard is walked into, its waves on it; the last task wins', () => {
    const P = play();
    P.stand(TASKS[0].at); P.stand(TASKS[1].zone.at); P.down('foe-1'); P.down('foe-2');
    P.time(8);   // the clock has not begun: nobody is in the yard
    expect(P.cur()).toBe(2);
    P.stand(TASKS[2].zone.at);
    P.time(2);
    expect(P.woke).toContain('foe-3');
    expect(P.woke).not.toContain('foe-4');
    P.time(6);
    expect(P.woke).toContain('foe-4');
    expect(P.cur()).toBe(3);
    P.stand(TASKS[3].zone.at); P.stand(TASKS[3].at);
    expect(P.cur()).toBe(4);
    expect(P.log()).toContain('objectives:done');
  });
  it('refuses a list it cannot play, saying why', () => {
    const bad = (tasks) => () => composeMechanics([{ kind: 'objectives', tasks }], { player: 'p' });
    expect(bad([])).toThrow(/needs tasks/);
    expect(bad([{ id: 'a', kind: 'dance', text: 'x' }])).toThrow(new RegExp(OBJECTIVE_KINDS.join(', ')));
    expect(bad([{ id: 'a', kind: 'clear', text: 'x', foes: [] }])).toThrow(/foes is the ids/);
    expect(bad([{ id: 'a', kind: 'clear', text: 'x', foes: ['f'] }, { id: 'b', kind: 'clear', text: 'y', foes: ['f'] }])).toThrow(/woken twice/);
    expect(bad([{ id: 'a', kind: 'hold', text: 'x' }])).toThrow(/seconds/);
    expect(bad([{ id: 'a', kind: 'reach', text: 'x', at: [0, 0, 0] }, { id: 'a', kind: 'reach', text: 'y', at: [1, 0, 0] }])).toThrow(/named twice/);
  });
});
