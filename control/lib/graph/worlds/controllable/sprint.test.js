import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { lowerFeel, feelCard } from '../../gameworld/feel/lower.js';
import { emitThreeWorld } from '../../scene/scene-three.js';

// a person's sprint (rules-platform.js `sprintSpeed`): the sprint key held with the stick forward runs at the sprint;
// firing or the sights up drop out of it; a rule without one keeps every byte (no field, no page read)
const CW = composeLive(), DT = 1 / 60;
const person = (extra = {}) => ({ type: 'platform', speed: 4.6, walkSpeed: 1.6, collideRadius: 0.3, collideHeight: 1.7, ...extra });
const top = (rule, input, frames = 120) => {
  const w = CW.createWorld({ entities: [{ id: 'p', pilotable: true, rule, transform: { pos: [0, 0, 0], heading: 0 } }] }), e = w.byId.p;
  let v = 0;
  for (let f = 0; f < frames; f++) { const x = e.transform.pos[0]; CW.stepWorld(w, input, DT, { ground: () => 0 }); v = Math.max(v, (e.transform.pos[0] - x) / DT); }
  return { v: Math.round(v * 100) / 100, e };
};

describe('a person\'s sprint', () => {
  it('held with the stick forward, the body runs at the sprint; let go, at the run', () => {
    expect(top(person({ sprintSpeed: 7.2 }), { forward: 1, sprint: 1 }).v).toBeCloseTo(7.2, 1);
    expect(top(person({ sprintSpeed: 7.2 }), { forward: 1 }).v).toBeCloseTo(4.6, 1);
  });

  it('firing or the sights up drop out of it, and a walk is never a sprint', () => {
    expect(top(person({ sprintSpeed: 7.2 }), { forward: 1, sprint: 1, fire: 1 }).v).toBeCloseTo(4.6, 1);
    expect(top(person({ sprintSpeed: 7.2 }), { forward: 1, sprint: 1, aim: 1 }).v).toBeCloseTo(4.6, 1);
    expect(top(person({ sprintSpeed: 7.2 }), { forward: 1, sprint: 1, walk: 1 }).v).toBeCloseTo(1.6, 1);
  });

  it('a rule without one: the key does nothing and the body carries no sprint field', () => {
    const R = top(person(), { forward: 1, sprint: 1 });
    expect(R.v).toBeCloseTo(4.6, 1);
    expect(R.e).not.toHaveProperty('sprinting');
  });

  it('a feel carries its card\'s sprint and walk with its takes, and says so without them', () => {
    const card = feelCard('conscription'), T = lowerFeel(card, { takes: true }), N = lowerFeel(card);
    expect(T.rule.sprintSpeed).toBe(card.ground.sprint);
    expect(T.rule.walkSpeed).toBe(card.ground.walk);
    expect(T.carried).toEqual(expect.arrayContaining(['ground.sprint', 'ground.walk']));
    expect(N.rule).not.toHaveProperty('sprintSpeed');
    expect(N.rule).not.toHaveProperty('walkSpeed');
    expect(N.partly.map((p) => p.field)).toContain('ground.sprint');
  });

  it('the page reads Shift as the sprint only where a body has one', () => {
    const page = (rule) => emitThreeWorld({ entities: [{ id: 'p', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [0, 0, 0] } }], camera: { rule: 'follow', target: 'p' } });
    expect(page(person({ sprintSpeed: 7.2 }))).toContain('a person\'s sprint, held');
    expect(page(person())).not.toContain('a person\'s sprint, held');
  });
});
