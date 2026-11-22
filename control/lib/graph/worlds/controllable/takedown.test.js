import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE TAKEDOWN (takedown.js): a watcher that has not seen the body, come up on from behind, goes down in one move.

const E = composeLive();
const hooks = { ground: () => 0 };
// a watcher at the origin facing +x, the body at `at` facing `heading`
const world = (at, heading, { seen = false, takedown = {} } = {}) => {
  const w = E.createWorld({
    camera: { rule: 'follow', target: 'p' },
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, ...(takedown ? { takedown } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [at[0], at[1], 0], heading } },
      { id: 'g', team: 'guards', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ],
  });
  // (a watcher is a body with a mind: its rule's type read as one, standing still here)
  w.byId.g.rule = { ...w.byId.g.rule, type: 'ai' };
  if (seen) w.byId.g.lastSeen = { id: 'p', t: 0, pos: [at[0], at[1], 0] };
  return w;
};
const press = (w) => { E.stepWorld(w, { act: 1 }, 1 / 60, hooks); for (let k = 0; k < 80; k++) E.stepWorld(w, {}, 1 / 60, hooks); return w.byId.g; };

describe('the takedown', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithTakedown');
    expect(emissionSource({ takedown: true })).toContain('stepWithTakedown');
  });
  it('from behind, unseen, near and facing it: the watcher goes down, at the move\'s middle', () => {
    const w = world([-1.2, 0], 0);
    expect(E.takedownTarget(w, w.byId.p)).toBe(w.byId.g);
    E.stepWorld(w, { act: 1 }, 1 / 60, hooks);
    for (let k = 0; k < 20; k++) E.stepWorld(w, {}, 1 / 60, hooks);
    expect(w.byId.g.downed).toBeFalsy();                       // 0.35 s in: not yet
    for (let k = 0; k < 20; k++) E.stepWorld(w, {}, 1 / 60, hooks);
    expect(w.byId.g.downed).toBe(true);
    expect(w.byId.g.body.hp).toBe(0);
    expect(w.byId.p.takedowns).toBe(1);
  });
  it('not from the front, not from too far, not turned away, not once it has seen the body, and not without the rule', () => {
    expect(press(world([1.2, 0], Math.PI)).downed).toBeFalsy();                  // in front of it
    expect(press(world([-3, 0], 0)).downed).toBeFalsy();                         // too far
    expect(press(world([-1.2, 0], Math.PI)).downed).toBeFalsy();                 // its back to the watcher
    expect(press(world([-1.2, 0], 0, { seen: true })).downed).toBeFalsy();       // seen
    expect(press(world([-1.2, 0], 0, { takedown: null })).downed).toBeFalsy();
    expect(press(world([-1.0, 0.6], 0.2)).downed).toBe(true);                     // off its back, inside the arc
  });
  it('the body is held through the move', () => {
    const w = world([-1.2, 0], 0); E.stepWorld(w, { act: 1 }, 1 / 60, hooks);
    for (let k = 0; k < 30; k++) E.stepWorld(w, { forward: 1 }, 1 / 60, hooks);
    expect(Math.hypot(w.byId.p.transform.pos[0] + 1.2, w.byId.p.transform.pos[1])).toBeLessThan(0.05);
  });
});
