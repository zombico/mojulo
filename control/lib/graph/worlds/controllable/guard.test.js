import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { BASIC_ARSENAL, lowerArsenal } from '../../gameworld/combos.js';
import { feelRule, feelReport } from '../../gameworld/feel/lower.js';

// THE GUARD (combat-melee.js stepGuard / guardMeets; a feel card's lowered, gameworld/feel/lower.js): held, a blow from
// the front is BLOCKED (no hurt, a blockstun, pushed back) or, met within the parry window of raising it, PARRIED (the
// attacker's swing spent, it staggered open the riposte, the guard free at once); from behind, or with the guard down,
// the blow lands. One case a law, on the Zelda-like card's numbers.
const CW = composeLive();
const DT = 1 / 60, G = feelRule('fable-of-artesia').guard;
const world = ({ heading = 0 } = {}) => {
  const W = lowerArsenal(BASIC_ARSENAL);
  const w = CW.createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: W[0].moveset, weapon: W[0].sidearm.weapon, guard: G },
      body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 10, radius: 0.35 }, transform: { pos: [0, 0, 0], heading } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 50, radius: 0.35 }, rule: { type: 'static' }, transform: { pos: [1.4, 0, 0], heading: Math.PI } },
  ] });
  const p = w.byId.p, foe = w.byId.foe, hooks = { ground: () => 0 };
  const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, inp, DT, hooks); };
  // the foe's blow: a swing in its contact window, stepped once
  const blow = (inp = {}) => { foe.strikeParams = CW.meleeSwingSpec({ strikeReach: 2, strikeDamage: 10 }, {}, 'neutral', false).params; foe.swingT = 0.45; foe.struckThisSwing = {}; step(inp); };
  step({}, 4);
  return { w, p, foe, step, blow };
};

describe('the guard, lowered from the card', () => {
  it('the Zelda-like card\'s guard rides the platform rule in seconds, carried in part, not lost', () => {
    expect(G).toEqual({ move: 0.5, push: 1.5, stun: 0.2, parry: 0.1333, riposte: 0.6667 });
    const R = feelReport('fable-of-artesia');
    expect(R.partly.map((x) => x.field)).toContain('guard');
    expect(R.lost.map((x) => x.field)).not.toContain('guard');
  });
});

describe('the guard held', () => {
  it('a blow from the front, the guard up a while: blocked, unhurt, a blockstun that refuses the blade, pushed back', () => {
    const A = world();
    A.step({ guard: 1 }, 30);   // (half a second up: past the parry window)
    expect(A.p.guarding).toBe(true);
    expect(A.p.mvPose).toMatchObject({ clip: 'mv_guard_sword', prop: 'shield' });
    const x0 = A.p.transform.pos[0];
    A.blow({ guard: 1 });
    expect(A.p.body.hp).toBe(100);
    expect(A.p.lastGuard).toMatchObject({ kind: 'block', by: 'foe' });
    expect(A.p.blockT).toBeGreaterThan(0);
    A.step({ guard: 1, fire: 1 });
    expect(A.p.mvPress).toMatchObject({ beat: 'L', verdict: 'dropped', why: 'in blockstun' });
    A.step({ guard: 1 }, 12);
    expect(A.p.transform.pos[0]).toBeLessThan(x0 - 0.05);   // (pushed back, away from the foe)
    expect(A.p.blockT).toBe(0);
  });
  it('a blow met within the parry window of raising the guard: parried, the foe open for the riposte, the guard free', () => {
    const A = world();
    A.step({ guard: 1 }, 3);   // (raised three frames ago: inside the card's eight)
    A.blow({ guard: 1 });
    expect(A.p.body.hp).toBe(100);
    expect(A.p.lastGuard).toMatchObject({ kind: 'parry', by: 'foe' });
    expect(A.foe.swingT).toBe(null);
    expect(A.foe.staggerT).not.toBe(null);
    expect(A.foe.reactDur).toBeCloseTo(G.riposte, 4);
    expect(A.p.blockT).toBe(0);
    // the riposte: the blade taken at once, the foe still reeling
    A.step({ fire: 1 });
    expect(A.p.swingT).not.toBe(null);
    expect(A.foe.staggerT).not.toBe(null);
  });
  it('from behind, or with the guard down, the blow lands', () => {
    const B = world({ heading: Math.PI });
    B.step({ guard: 1 }, 30);
    B.blow({ guard: 1 });
    expect(B.p.body.hp).toBeLessThan(100);
    const D = world();
    D.blow();
    expect(D.p.body.hp).toBeLessThan(100);
  });
  it('the walk at the card\'s share of the run while the guard is up; a press out of it takes the move', () => {
    const run = (guard) => { const A = world(); A.foe.transform.pos = [30, 0, 0]; const y0 = A.p.transform.pos[1]; A.step({ guard, strafe: 1 }, 30); return Math.abs(A.p.transform.pos[1] - y0); };
    const free = run(0), guarded = run(1);
    expect(guarded / free).toBeGreaterThan(G.move * 0.7);
    expect(guarded / free).toBeLessThan(G.move * 1.3);
    const A = world();
    A.step({ guard: 1 }, 10);
    A.step({ guard: 1, fire: 1 });
    expect(A.p.guarding).toBe(false);
    expect(A.p.swingT).not.toBe(null);
  });
  it('the fist guards in its cover', () => {
    const A = world();
    A.step({ cycle: 1 }); A.step();
    A.step({ guard: 1 }, 5);
    expect(A.p.mvPose).toEqual({ clip: 'mv_guard_fist', phase: 0 });
  });
});
