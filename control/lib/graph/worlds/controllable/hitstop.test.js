import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { lowerFeel, feelCard } from '../../gameworld/feel/lower.js';
import { POLE_IDS, poleCard } from '../../gameworld/feel/cards.js';

// HITSTOP: a gameworld feel's `hit.hitstop` lowered onto the strike, and a melee connect freezing both bodies for its frames
const CW = composeLive();
const DT = 1 / 60;
const body = () => ({ type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hittable: true, hp: 100, radius: 0.5, poise: 100, staggerDur: 1 });
const ent = (id, x, rule = {}) => ({ id, rule: { type: 'static', ...rule }, transform: { pos: [x, 0, 0], heading: 0 }, body: body() });
function swingAt(hitstop) {
  const w = CW.createWorld({ entities: [ent('hero', 0, hitstop ? { hitstop } : {}), ent('foe', 1.5)] }), hero = w.byId.hero;
  hero.strikeParams = CW.meleeSwingSpec({ strikeReach: 2, strikeDamage: 4 }, {}, 'neutral', false).params;
  hero.swingT = 0.4; hero.struckThisSwing = {};
  return w;
}

describe('the feel lowers its hitstop onto the strike', () => {
  it('a card with a hitstop carries it (frames at 60 fps); a card without leaves the rule without one', () => {
    const stops = POLE_IDS.find((id) => poleCard(id).hit?.hitstop?.max > 0), none = POLE_IDS.find((id) => !poleCard(id).hit?.hitstop);
    const L = lowerFeel(feelCard(stops)), H = poleCard(stops).hit.hitstop;
    expect(L.rule.hitstop).toEqual({ base: H.base, perMs: H.perMs, max: H.max });
    expect(L.carried).toContain('hit.hitstop');
    expect(L.lost.map((x) => x.field)).not.toContain('hit.hitstop');
    expect(lowerFeel(feelCard(none)).rule.hitstop).toBeUndefined();
  });
});

describe('a connect freezes both bodies', () => {
  it('the striker and the struck hold for base + perMs × the shove frames (at most max), then play on', () => {
    const w = swingAt({ base: 4, perMs: 0.6, max: 14 }), hero = w.byId.hero, foe = w.byId.foe;
    CW.stepWorld(w, {}, DT, { ground: () => 0 });
    expect(hero.meleeHitCount).toBe(1);
    expect(hero.hitstopT).toBeCloseTo(4 / 60, 9);
    const stagger = foe.staggerT;
    let held = 0; while (foe.hitstopT > 0 && held < 30) { CW.stepWorld(w, {}, DT, { ground: () => 0 }); expect(foe.staggerT).toBe(stagger); held++; }
    expect(held).toBe(4);
    expect(hero.hitstopT).toBe(0);
    CW.stepWorld(w, {}, DT, { ground: () => 0 });
    expect(foe.staggerT).not.toBe(stagger);   // the reaction runs again
    // the shove sizes it, capped
    const big = swingAt({ base: 4, perMs: 0.6, max: 14 }); big.byId.hero.strikeParams.impact = 100;
    CW.stepWorld(big, {}, DT, { ground: () => 0 });
    expect(big.byId.hero.hitstopT).toBeCloseTo(14 / 60, 9);
  });
  it('opt-in: the builder is composed only into a page that asks; without a hitstop no body carries one and the stagger runs from the first frame', () => {
    expect(emissionSource({})).not.toContain('stepWithHitstop');
    expect(emissionSource({ hitstop: true })).toContain('stepWithHitstop');
    const w = swingAt(null), foe = w.byId.foe;
    CW.stepWorld(w, {}, DT, { ground: () => 0 });
    expect(w.byId.hero.hitstopT).toBeUndefined(); expect(foe.hitstopT).toBeUndefined();
    const s = foe.staggerT; CW.stepWorld(w, {}, DT, { ground: () => 0 }); expect(foe.staggerT).not.toBe(s);
  });
});
