import { describe, expect, it } from 'vitest';

import { composeControllable, EMISSION } from './compose.js';

// ── COMBOS (combo-hitstun.plan.md P1): hitstun · juggle state · damage scaling, in combat-hit.js ──
const cw = composeControllable(EMISSION);
const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const foe = (body = {}, extra = {}) => ({ id: 'foe', rule: { type: 'static' }, transform: { pos: [2, 0, 0] }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1, toppleDur: 0.5, getupDur: 0.5, downPause: 0.25, wakeGuard: 0.5, ...body }, ...extra });
const world = (combo, body, extra) => cw.createWorld({ entities: [foe(body, extra)], ...(combo === undefined ? {} : { combo }) });
const run = (w, n, input = {}) => { for (let i = 0; i < n; i++) cw.stepWorld(w, input, DT, FLAT); return w; };
// one hit the way every damage site lands it: the combo seam scales + counts, then the reaction arms.
const hit = (w, dmg = 10, opts) => { const tg = w.byId.foe; const d = cw.comboDamage(tg, dmg); tg.body.hp = Math.max(0, tg.body.hp - d); cw.armReaction(tg, opts && opts.topple ? 'topple' : 'stagger', !!(opts && opts.topple), opts && opts.launch != null ? { launch: opts.launch } : undefined); return d; };

describe('opt-in', () => {
  it('without `combo` no entity carries combo fields (the replay hash is untouched), damage passes straight through, a mid-stagger hit is ignored as before', () => {
    const w = world(undefined);
    expect(w.combo).toBeNull();
    expect('comboCfg' in w.byId.foe).toBe(false);
    expect(hit(w, 40)).toBe(40);
    expect(w.byId.foe.reactDur).toBe(1);
    run(w, 30);
    const t0 = w.byId.foe.staggerT;
    hit(w, 40);
    expect(w.byId.foe.staggerT).toBe(t0);   // legacy: a second hit does not re-arm the stagger
    expect(w.byId.foe.comboHits).toBeUndefined();
  });

  it('normalizeCombo: defaults, sections switched off, per-body override and immunity', () => {
    expect(cw.normalizeCombo(true)).toEqual({ hitstun: { base: 0.5, decay: 1, min: 0.12 }, juggle: { launch: 8, lift: 0.7, hitLift: 3, gravity: 1, g: 20, max: 5, land: 'knockdown' }, scaling: { perHit: 0.9, floor: 0.3 }, reset: 0.3 });
    expect(cw.normalizeCombo({ hitstun: { decay: 0.8 }, juggle: false, scaling: false, reset: 1 })).toEqual({ hitstun: { base: 0.5, decay: 0.8, min: 0.12 }, juggle: null, scaling: null, reset: 1 });
    expect(cw.normalizeCombo(null)).toBeNull();
    const immune = world(true, { combo: false });
    expect('comboCfg' in immune.byId.foe).toBe(false);
    const own = world({ scaling: { perHit: 0.5 } }, { combo: { hitstun: { base: 2 } } });
    expect(own.byId.foe.comboCfg.hitstun.base).toBe(2);          // the body's section
    expect(own.byId.foe.comboCfg.scaling.perHit).toBe(0.5);      // the world's section survives the merge
    const noPoise = cw.createWorld({ entities: [foe({ poise: undefined })], combo: true });
    expect('comboCfg' in noPoise.byId.foe).toBe(false);          // only poise-bearing (reacting) bodies combo
  });
});

describe('hitstun', () => {
  it('each hit re-arms the stun; decay < 1 shortens it per hit down to `min`; decay 1 is static', () => {
    const w = world({ hitstun: { base: 1, decay: 0.5, min: 0.2 } });
    hit(w); expect(w.byId.foe.reactDur).toBe(1); expect(w.byId.foe.comboHits).toBe(1);
    run(w, 20);
    expect(w.byId.foe.staggerT).toBeGreaterThan(0.3);
    hit(w); expect(w.byId.foe.staggerT).toBe(0); expect(w.byId.foe.reactDur).toBe(0.5); expect(w.byId.foe.comboHits).toBe(2);
    hit(w); expect(w.byId.foe.reactDur).toBe(0.25);
    hit(w); expect(w.byId.foe.reactDur).toBe(0.2);               // the floor
    const s = world({ hitstun: { base: 0.7 } });
    hit(s); hit(s); hit(s);
    expect(s.byId.foe.reactDur).toBe(0.7); expect(s.byId.foe.comboHits).toBe(3);
  });

  it('a combo LINKS inside `reset` after recovery and drops past it; a knockdown ends it outright', () => {
    const w = world({ hitstun: { base: 0.2 }, reset: 0.3 });
    hit(w); hit(w);
    run(w, 20);                                                   // 0.33 s: the 0.2 s stun is over…
    expect(w.byId.foe.staggerT).toBeNull();
    run(w, 6);                                                    // …0.1 s upright: still inside the link window
    hit(w); expect(w.byId.foe.comboHits).toBe(3);
    run(w, 40);                                                   // past reset while upright: forgotten
    expect(w.byId.foe.comboHits).toBe(0);
    hit(w); expect(w.byId.foe.comboHits).toBe(1);
    hit(w, 10, { topple: true });                                 // the knockdown: fall → floored → getup → wake guard
    expect(w.byId.foe.reactClip).toBe('topple');
    run(w, 96);                                                   // fall .5 + floored .25 + rise .5 = 1.25 s; the .5 s wake guard is still up at 1.6 s
    expect(w.byId.foe.staggerT).toBeNull(); expect(w.byId.foe.comboHits).toBe(0); expect(w.byId.foe.invincible).toBe(true);   // rose with the guard, combo gone
  });
});

describe('damage scaling', () => {
  it('scales by perHit^k with a floor, k counting stunning hits already landed; forgets after the link window', () => {
    const w = world({ hitstun: { base: 1 }, scaling: { perHit: 0.5, floor: 0.2 } });
    expect(hit(w, 100)).toBe(100);
    expect(hit(w, 100)).toBe(50);
    expect(hit(w, 100)).toBe(25);
    expect(hit(w, 100)).toBe(20);                                 // floored at 0.2
    expect(w.byId.foe.comboScale).toBe(0.2);
    run(w, 90);                                                   // stun (1 s) + past reset
    expect(hit(w, 100)).toBe(100);
    expect(w.byId.foe.comboHits).toBe(1);
  });

  it('un-stunned chip never chains: without a reaction between them, hits stay k = 0', () => {
    const w = world({ hitstun: false, juggle: false, scaling: { perHit: 0.5 } });
    const tg = w.byId.foe;
    expect(cw.comboDamage(tg, 100)).toBe(100);
    run(w, 1);
    expect(cw.comboDamage(tg, 100)).toBe(100);                    // no stun armed ⇒ not a combo
    expect(tg.comboHits).toBe(1);
  });
});

describe('juggle state', () => {
  const J = { hitstun: { base: 0.3 }, juggle: { launch: 8, g: 20, max: 2 }, scaling: false };

  it('a launching hit throws the target up; it flies under the combo gravity, cannot act, and lands into the knockdown', () => {
    const w = world(J);
    hit(w, 10, { launch: 8 });
    const f = w.byId.foe;
    expect(f.juggle).toEqual({ vz: 8, z0: 0, knock: false });
    run(w, 12);
    expect(f.transform.pos[2]).toBeGreaterThan(1);
    expect(f.locomotion).toBe('topple'); expect(f.gaitPhase).toBe(0.35);   // the mid-air clip; the stun holds
    expect(f.staggerT).toBe(0);
    run(w, 40);                                                   // 8 u/s under g 20 ⇒ down in 0.8 s
    expect(f.juggle).toBeNull(); expect(f.transform.pos[2]).toBe(0);
    expect(f.reactClip).toBe('topple');                          // landing = the knockdown
    run(w, 120);
    expect(f.staggerT).toBeNull(); expect(f.comboHits).toBe(0);  // the getup ended the combo
  });

  it('hits while airborne keep the target up until `max`, then nothing lifts; `land: stand` recovers on its feet', () => {
    const w = world(J);
    hit(w, 10, { launch: 8 }); run(w, 20);
    const f = w.byId.foe;
    const vzFalling = f.juggle.vz; expect(vzFalling).toBeLessThan(8);
    hit(w); expect(f.juggle.vz).toBe(3);                          // hit 2 (≤ max): hitLift 3 tops up the fall
    run(w, 3);                                                    // three frames of gravity: 3 − 20·(3/60) = 2
    expect(f.juggle.vz).toBeCloseTo(2, 6);
    hit(w); expect(f.juggle.vz).toBeCloseTo(2, 6);                // hit 3 (> max 2): no lift, still falling
    const s = world({ ...J, juggle: { ...J.juggle, land: 'stand' } });
    hit(s, 10, { launch: 8 }); run(s, 60);
    expect(s.byId.foe.juggle).toBeNull(); expect(s.byId.foe.staggerT).toBeNull(); expect(s.byId.foe.reactClip).toBe('stagger');
    expect(s.byId.foe.transform.pos[2]).toBe(0);
  });

  it('gravity > 1 shortens the air time as the combo grows; a toppling hit mid-air knocks down on landing', () => {
    const airTime = (gravity) => {
      const w = world({ ...J, juggle: { ...J.juggle, gravity, max: 9 } });
      hit(w, 10, { launch: 8 }); hit(w, 10, { launch: 8 }); hit(w, 10, { launch: 8 });   // three launches in one frame: n = 3
      let n = 0; while (w.byId.foe.juggle && n < 600) { run(w, 1); n++; }
      return n;
    };
    expect(airTime(1.5)).toBeLessThan(airTime(1));
    const k = world({ ...J, juggle: { ...J.juggle, land: 'stand' } });
    hit(k, 10, { launch: 8 }); run(k, 5);
    hit(k, 10, { topple: true });
    expect(k.byId.foe.juggle.knock).toBe(true);
    run(k, 60);
    expect(k.byId.foe.reactClip).toBe('topple');                  // 'stand' overridden by the knocking hit
  });

  it('a melee verb with strikeLaunch launches its target (end to end through the swing)', () => {
    const w = cw.createWorld({ combo: true, entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10, strikeLaunch: 9 }, transform: { pos: [0, 0, 0], heading: 0 } },
      foe(),
    ] });
    run(w, 5); run(w, 24, { fire: 1 });
    expect(w.byId.foe.juggle).toBeTruthy();
    expect(w.byId.foe.transform.pos[2]).toBeGreaterThan(0);
    expect(w.byId.foe.body.hp).toBe(490);                         // hit 1: unscaled
    expect(w.byId.foe.comboHits).toBe(1);
  });
});
