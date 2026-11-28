// An operation's ALLIES (frame-goal.js): read, teaching what it refuses, and stood beside the drop on the pilot's side,
// a leader's places the operation's reaches' and scans' in order.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, ALLY } from './frame-goal.js';

const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47, bound: [-500, -500, 500, 500] } };
const OP = { groups: [{ id: 'drones', kind: 'gnat', count: 2, at: [0, 0.5] }], tasks: [{ reach: [0, 0.2] }, { scan: [0.3, 0.2] }, { down: ['drones'] }], allies: [{ id: 'cole', name: 'Cole' }] };

describe('an operation\'s allies', () => {
  it('stands each beside the drop on the pilot\'s side, leading through the operation\'s places', () => {
    const op = readOperation(OP), X = operationCast(op, ends), C = X.entities.find((e) => e.id === 'cole');
    expect(C.team).toBeUndefined();
    expect(C.ally).toEqual({ name: 'Cole' });
    expect(C.rule.mind).toMatchObject({ ally: true, engage: ALLY.engage });
    expect(C.rule.mind.lead.map((L) => L.at.slice(0, 2))).toEqual([[0, 100], [150, 100]]);
    expect(C.rule.gravity).toBe(2.47);
    expect(C.body.hp).toBeGreaterThan(operationCast(readOperation({ ...OP, allies: [{ id: 'cole', name: 'Cole', ap: 1 }] }), ends).entities.find((e) => e.id === 'cole').body.hp);
    expect(X.figures['frame-ally-cole'].assault.build).toBe(ALLY.build);
  });

  it('refuses an ally it cannot read, teaching', () => {
    expect(() => readOperation({ ...OP, allies: [{ id: 'drones', name: 'X' }] })).toThrow(/not a group's/);
    expect(() => readOperation({ ...OP, allies: [{ id: 'cole' }] })).toThrow(/name is what it is called/);
    expect(() => readOperation({ ...OP, allies: [{ id: 'cole', name: 'Cole', wings: 2 }] })).toThrow(/wings is not part of an ally/);
  });
});
