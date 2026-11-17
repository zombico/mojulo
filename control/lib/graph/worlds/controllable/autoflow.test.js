// THE AUTOFLOW (a fighting style of hero-kits.js on the moveset, combat-melee.js): ONE punch button. Pressed again it
// flows on; a pause turns the string; held, it is the charged blow (the `L+` beat: a press not taken until it is let go
// or filled); with the modifier, the super. Played on the brawler's own arsenal.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { lowerArsenal, CHARGE_FRAMES, BASIC_ARSENAL } from '../../gameworld/combos.js';
import { kitArsenal } from '../../gameworld/hero-kits.js';

const CW = composeLive(), DT = 1 / 60;
const world = (style = 'brawler') => {
  const W = lowerArsenal(kitArsenal({ style })), M = W[0].moveset;
  const w = CW.createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: M, moveClips: true },
      body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 10, radius: 0.35 }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100000, poise: 1e6, radius: 0.35 }, rule: { type: 'static' }, transform: { pos: [1.2, 0, 0], heading: Math.PI } },
  ] });
  const p = w.byId.p, hooks = { ground: () => 0 }, played = [];
  let last = null;
  const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { CW.stepWorld(w, inp, DT, hooks); const mv = p.swingT != null ? p.swingClip : null; if (mv && mv !== last) played.push(mv.replace(/^mv_hands_/, '').replace(/_still$/, '')); last = mv; } };
  // a tap: the button down two frames, then up
  const tap = (extra = {}) => { step({ fire: 1, ...extra }, 2); step({}, 1); };
  // until the live move has ended
  const end = (most = 240) => { for (let i = 0; i < most && p.swingT != null; i++) step({}); };
  step({}, 4);
  return { w, p, M, step, tap, end, played };
};

describe('the autoflow: one punch button', () => {
  it('pressed again as each blow plays, the flow goes on, punches and kicks, to its finisher', () => {
    const A = world();
    for (let k = 0; k < 4; k++) { A.tap(); for (let i = 0; i < 200 && A.played.length <= k; i++) A.step({}); for (let i = 0; i < 12; i++) A.step({}); }
    A.end();
    expect(A.played).toEqual(['jab', 'cross', 'kick', 'hook']);
  });

  it('a pause turns the string: the same two presses, a breath, and the next is the knee', () => {
    const A = world();
    A.tap(); for (let i = 0; i < 14; i++) A.step({});
    A.tap(); A.end();
    // (inside the pause window: after the move has ended, before the string lapses)
    A.step({}, Math.round((A.M.pause[0] + A.M.pause[1]) / 2 / DT));
    A.tap(); for (let i = 0; i < 60 && A.played.length < 3; i++) A.step({});
    expect(A.played).toEqual(['jab', 'cross', 'knee']);
  });

  it('held, the press is the charged blow: nothing until it fills, then the haymaker; let go early it is the jab', () => {
    const A = world();
    // held: no move while it fills (the charge is shown), the haymaker as it does
    A.step({ fire: 1 }, CHARGE_FRAMES - 4);
    expect(A.played).toEqual([]);
    expect(A.p.mvCharging).toBeGreaterThan(0.5);
    A.step({ fire: 1 }, 8);
    expect(A.played).toEqual(['haymaker']);
    expect(A.p.mvCharging).toBe(0);
    // let go before it fills: the plain light, taken as the button comes up
    const B = world();
    B.step({ fire: 1 }, 6); B.step({}, 3);
    expect(B.played).toEqual(['jab']);
  });

  it('held in the middle of a string it is that string\'s heavy; with the modifier the punch is the super, spent from the meter', () => {
    const A = world();
    A.tap(); for (let i = 0; i < 14; i++) A.step({});
    A.tap(); for (let i = 0; i < 14; i++) A.step({});
    for (let i = 0; i < 120 && A.played.length < 3; i++) A.step({ fire: 1 });
    expect(A.played).toEqual(['jab', 'cross', 'drive']);
    const S = world(), mp0 = S.p.mp;
    S.tap({ mod: 1 }); for (let i = 0; i < 30 && !S.played.length; i++) S.step({});
    expect(S.played).toEqual(['super']);
    expect(S.p.mp).toBeLessThan(mp0);
  });

  it('the special button finishes a reeling foe in reach, the hero turned to it; with none reeling it is no blow', () => {
    const A = world(), foe = A.w.byId.foe;
    A.step({ interact: 1 }, 2); A.step({}, 20);
    expect(A.played).toEqual([]);                    // (nobody reeling: the press is the level's own)
    foe.staggerT = 0; foe.transform.pos = [0, 1.6, 0];   // a foe reeling, off to the hero's left
    A.step({ interact: 1 }, 2);
    for (let i = 0; i < 30 && !A.played.length; i++) A.step({});
    expect(A.played).toEqual(['finish']);
    expect(A.p.mvFinish).toBe('foe');
    expect(Math.sin(A.p.transform.heading)).toBeGreaterThan(0.9);   // turned to it
    expect(A.M.finish.reach).toBeGreaterThan(1);
    // out of reach, it is not taken
    const B = world(); B.w.byId.foe.staggerT = 0; B.w.byId.foe.transform.pos = [9, 0, 0];
    B.step({ interact: 1 }, 2); B.step({}, 20);
    expect(B.played).toEqual([]);
  });

  it('a moveset with no held beat takes a press at once, as before, and says no charge', () => {
    expect(lowerArsenal(BASIC_ARSENAL)[0].moveset.charge).toBeUndefined();
    expect(lowerArsenal(BASIC_ARSENAL)[0].moveset.finish).toBeUndefined();
  });
});
