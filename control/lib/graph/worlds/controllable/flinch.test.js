// The FLINCH (rules-platform.js `flinch`, a feel card's `hit.flinch` with its `jumps.hurt`): a blow taken holds the hero in
// its hurt for the flinch's time, the stick and the jump not its own and its tap held; then it moves again. A rule
// without it is not held.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { feelRule } from '../../gameworld/feel/lower.js';

const E = composeLive(), DT = 1 / 60;
const world = (rule) => E.createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { ...rule, type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.67, move: 'lane', lane: [[0, -50], [0, 500]] }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } }], pilot: 'hero' });
const step = (st, input, n) => { for (let i = 0; i < n; i++) E.stepWorld(st, input, DT, { ground: () => 0 }); };

describe('the flinch', () => {
  const RULE = feelRule({ pole: 'galaxy-boy', takes: true });
  it('a run-and-gun hero\'s card carries it with its hurt clip; a hero whose card does not, none', () => {
    expect(RULE.flinch).toBeGreaterThan(0);
    expect(RULE.takes.hurt).toBe(true);
    expect(feelRule({ pole: 'jumping-giuseppe', takes: true }).flinch).toBeUndefined();
  });
  it('a blow taken holds it in its hurt, the stick and the tap not its own, for the flinch\'s time; then it runs', () => {
    const st = world(RULE), h = st.byId.hero;
    step(st, {}, 20);
    h.hits = 1;
    const s0 = h.transform.pos[1];
    step(st, { strafe: 1 }, 2);
    expect(h.locomotion).toBe('hurt');
    // (the blow read, a press of fire is no tap while it lasts)
    const shots0 = (st.projectiles || []).length;
    step(st, { strafe: 1, fire: 1 }, 1); step(st, { strafe: 1, fire: 0 }, 1); step(st, { strafe: 1, fire: 1 }, 1);
    expect((st.projectiles || []).length).toBe(shots0);
    expect(Math.abs(h.transform.pos[1] - s0)).toBeLessThan(0.05);
    step(st, { strafe: 1 }, Math.ceil(RULE.flinch / DT) + 30);
    expect(h.locomotion).not.toBe('hurt');
    expect(h.transform.pos[1] - s0).toBeGreaterThan(1);
  });
  it('a rule without it is never held', () => {
    const { flinch, ...plain } = RULE, st = world(plain), h = st.byId.hero;
    step(st, {}, 20); h.hits = 1; const s0 = h.transform.pos[1];
    step(st, { strafe: 1 }, 30);
    expect(h.flinchT).toBeUndefined();
    expect(h.transform.pos[1] - s0).toBeGreaterThan(0.5);
  });
});
