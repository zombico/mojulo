// A WARY group (frame-goal.js): a unit that goes about its own work, holding its fire until it is hit, so it can be
// spotted and pointed out before it is fought (a survey drone); the same unit unwary opens fire on sight.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast } from './frame-goal.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { frameEntity } from '../assault-frame/pilot.js';

const E = composeLive();
const ends = { spawn: [0, 0, 0], heading: 0, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const flat = { ground: () => 0 };
const fight = (wary) => {
  const op = readOperation({ groups: [{ id: 'scout', kind: 'gnat', count: 1, at: [0.16, 0], ...(wary ? { wary: true } : {}) }], tasks: [{ down: ['scout'] }] });
  const X = operationCast(op, ends), st = E.createWorld({ entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true }), ...X.entities], pilot: 'p' });
  // (the rounds it has spent from its magazine: what it fired, wherever they went)
  const fired = () => { const w = st.byId.scout.weapon; return w ? w.magazine - w.ammo : 0; };
  const run = (s) => { for (let i = 0; i < s * 60; i++) E.stepWorld(st, {}, 1 / 60, flat); };
  return { st, fired, run };
};

describe('a wary group', () => {
  it('holds its fire on a frame in its sight until it is hit, then fights', () => {
    const W = fight(true);
    W.run(8);
    expect(W.fired()).toBe(0);
    E.castOps(W.st, [{ op: 'hurt', who: 'scout', by: 1 }]);
    W.run(8);
    expect(W.fired()).toBeGreaterThan(0);
  });

  it('unwary, the same drone opens fire on sight; wary is a unit\'s word, not a frame\'s', () => {
    const U = fight(false);
    U.run(8);
    expect(U.fired()).toBeGreaterThan(0);
    expect(() => readOperation({ groups: [{ id: 'f', kind: 'frame', at: [0, 0], wary: true }], tasks: [{ down: ['f'] }] })).toThrow(/not a frame/);
  });
});
