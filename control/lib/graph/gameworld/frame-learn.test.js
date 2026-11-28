// An operation that TEACHES (frame-goal.js): `learn` tasks, each a control shown and met only as the pilot does it (the
// guide's lesson said on the bus, game/objectives.js `act`), their lessons in the tasks' order, each shown once its
// task has begun; and an ally that HOLDS its ground, an instructor on the range, turned to the pilot.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, operationMechanics, FRAME_LESSONS } from './frame-goal.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';

const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const OP = { groups: [{ id: 'd', kind: 'gnat', at: [0.5, 0] }], tasks: [{ learn: 'move' }, { learn: 'boost', pause: 3, text: 'Boost across the plain' }, { reach: [0.4, 0] }, { learn: 'lock' }, { down: ['d'] }],
  allies: [{ id: 'cole', name: 'Cole', hold: true }] };

describe('an operation that teaches', () => {
  it('meets each learn task as its control is done, its lessons in the tasks\' order, each once its task has begun', () => {
    const op = readOperation(OP), T = operationMechanics(op, ends)[0].tasks, L = operationCast(op, ends).lessons;
    expect(T.filter((t) => t.kind === 'act').map((t) => [t.id, t.on])).toEqual([['t1', 'lesson:move'], ['t2', 'lesson:boost'], ['t4', 'lesson:lock']]);
    expect(T[1]).toMatchObject({ text: 'Boost across the plain', pause: 3 });
    expect(T[0].text).toBe('Move');                                     // (its words from the lesson where none are written)
    expect(L.map((l) => l.fact)).toEqual(['move', 'boost', 'lock']);
    expect(L[1].when).toEqual({ var: '__obj_in1', gte: 1 });
    expect(() => readOperation({ ...OP, tasks: [{ learn: 'energy' }] })).toThrow(/learn is a control the frame shows/);
    expect(FRAME_LESSONS.energy.fact).toBeUndefined();
    // (an act waits on an event the level raises: a scene's end)
    expect(operationMechanics(readOperation({ ...OP, tasks: [{ act: 'scene-end:candles', text: 'Watch' }] }), ends)[0].tasks[0]).toMatchObject({ kind: 'act', on: 'scene-end:candles', text: 'Watch' });
  });

  it('an ally that holds stands where it was stood, turned to the pilot, as the pilot walks off', () => {
    const E = composeLive(), X = operationCast(readOperation({ ...OP, groups: [{ id: 'd', kind: 'gnat', at: [0.9, 0.9] }] }), ends);
    const C = X.entities.find((e) => e.id === 'cole');
    expect(C.rule.mind).toMatchObject({ hold: true });
    expect(C.rule.mind.lead).toBeUndefined();
    const st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), C], pilot: 'p' }), at0 = st.byId.cole.transform.pos.slice();
    for (let i = 0; i < 300; i++) E.stepWorld(st, { forward: 1, boost: 1 }, 1 / 60, { ground: () => 0 });
    expect(Math.hypot(st.byId.cole.transform.pos[0] - at0[0], st.byId.cole.transform.pos[1] - at0[1])).toBeLessThan(2);
    expect(st.byId.p.transform.pos[0]).toBeGreaterThan(60);
  });
});
