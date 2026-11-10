import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, readRules, versusHash, hostedRules } from './versus-core.js';
import { solveFighter } from './versus-solver.js';
import { lawsFor } from './versus-laws.js';
import { runVersus } from './versus-match.js';
import { readVersusManifest } from './versus-page.js';
import { BTN } from './versus-input.js';

// extending a spawned game is editing its recipe: tunes, the fighter's own specials, a weapon, the rules' systems

const Z = { x: 0, y: 0, b: 0 };
const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const K = compileFighter(base);
const withRecipe = (over) => compileFighter({ ...base, ...over });

function fight(d, fighters, rules) {
  const ctx = { fighters };
  let s = newVersus(ctx, { rules: { intro: 1, ...(rules ?? {}) } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2);
  s.p[1].x = Math.round(d / 2);
  return { ctx, s };
}
function run(s, ctx, n, fn) {
  const events = [];
  for (let k = 0; k < n; k++) {
    s = stepVersus(s, fn(k, s), ctx);
    for (const e of s.events) events.push([k, e]);
  }
  return { s, events };
}
const tap = (k, at, b) => (k === at ? b : 0);
const has = (events, t) => events.some(([, e]) => e.t === t);

describe('versus extend: tune', () => {
  it('a tune changes the frames and the intended advantage, and the stun is still solved from it', () => {
    const F = withRecipe({ normals: { ...base.normals, 'stand.M': { ...base.normals['stand.M'], tune: { startup: 5, adv: { block: 2 }, guard: 'low' } } } });
    const m = F.moves['stand.M'];
    expect(m.startup).toBe(5);
    expect(m.adv.block).toBe(2);
    expect(m.adv.hit).toBe(K.moves['stand.M'].adv.hit);
    expect(m.guard).toBe('low');
    expect(m.tuned).toEqual(['startup', 'adv', 'guard']);
  });

  it('a tune it cannot read is refused with what it takes', () => {
    expect(() => withRecipe({ normals: { ...base.normals, 'stand.L': { family: 'jab', tune: { speed: 'fast' } } } })).toThrow(/speed is a whole number/);
    expect(() => withRecipe({ normals: { ...base.normals, 'stand.L': { family: 'jab', tune: { wobble: 1 } } } })).toThrow(/no 'wobble'/);
  });

  it('a special tunes flat or per strength', () => {
    const F = withRecipe({ specials: { ...base.specials, back: { id: 'rush', tune: { damage: 50, H: { damage: 150 } } } } });
    expect(F.moves['special.back.L'].damage).toBe(50);
    expect(F.moves['special.back.H'].damage).toBe(150);
  });
});

describe('versus extend: the fighter\'s own specials, from primitives', () => {
  const slide = {
    from: 'rush', limb: 'toeF', rps: 'rush', motion: '22',
    load: 'crouch', strike: { from: 'crouch', torso: 60, legF: [88, 92, 100] },
    at: { startup: 8, active: 10, recovery: 16, damage: 70, travel: 70 },
    profile: { low: 700, from: 2, to: 17 }, guard: 'low',
  };
  const F = withRecipe({ library: { specials: { slide } }, specials: { ...base.specials, down: { id: 'slide' } } });

  it('a low profile clips the hurtboxes under its height, so a fireball passes over', () => {
    const m = F.moves['special.down.M'];
    for (let f = 2; f <= 17; f++) for (const b of m.frames[f].hurt) expect(b[3]).toBeLessThanOrEqual(700);
    // P1 throws a fireball, P2 slides under it as it arrives: some timing slides through and lands
    let through = false;
    for (let at = 10; at < 50 && !through; at += 2) {
      const { ctx, s } = fight(2600, [K, F]);
      const r = run(s, ctx, 70, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.S) }, { x: 0, y: -1, b: tap(k, at, BTN.S) }]);
      const hits = r.events.filter(([, e]) => e.t === 'hit').map(([, e]) => e.p);
      through = hits.includes(1) && !hits.includes(0);
    }
    expect(through).toBe(true);
  });

  it('armor absorbs a strike: the damage lands, the stun does not', () => {
    const tank = withRecipe({ specials: { ...base.specials, back: { id: 'rush', tune: { armor: [1, 14, 1] } } } });
    const { ctx, s } = fight(800, [K, tank]);
    // P2 faces left: its back special is S + screen-right
    const r = run(s, ctx, 12, (k) => [{ x: 0, y: 0, b: tap(k, 2, BTN.L) }, { x: 1, y: 0, b: tap(k, 0, BTN.S) }]);
    expect(has(r.events, 'armor')).toBe(true);
    expect(r.s.p[1].hp).toBeLessThan(tank.hp);
    expect(r.s.p[1].mv).toBe('special.back.M');
  });

  it('a riposte catches a strike in its window and answers it', () => {
    const catcher = withRecipe({
      library: { specials: { catch: { from: 'rush', at: { startup: 20, recovery: 10, damage: 0, travel: 0 }, riposte: [1, 16, 120, 'down'], load: 'blockHigh', strike: 'blockHigh' } } },
      specials: { ...base.specials, back: { id: 'catch' } },
    });
    const { ctx, s } = fight(800, [K, catcher]);
    const r = run(s, ctx, 30, (k) => [{ x: 0, y: 0, b: tap(k, 2, BTN.L) }, { x: 1, y: 0, b: tap(k, 0, BTN.S) }]);
    expect(has(r.events, 'riposte')).toBe(true);
    expect(r.s.p[0].hp).toBe(K.hp - 120);
    expect(r.s.p[1].hp).toBe(catcher.hp);
  });

  it('a special the compiler cannot read says what it needs', () => {
    expect(() => withRecipe({ library: { specials: { odd: { limb: 'fistF', load: 'guard', strike: 'guard', at: { damage: 10 } } } } })).toThrow(/needs a startup/);
  });
});

describe('versus extend: weapons', () => {
  const S = withRecipe({ weapon: 'sword' });

  it('the blade outreaches the arm, is disjointed while it swings, and stays hurtable through a whiff', () => {
    const jab = S.moves['stand.L'], bare = K.moves['stand.L'];
    expect(jab.armed).toBe(true);
    expect(jab.reach).toBeGreaterThan(bare.reach + 400);
    const tip = jab.reach - S.body.limbR * 2;
    const reachOfHurt = (f) => Math.max(...jab.frames[f].hurt.map((b) => b[2]));
    for (let f = jab.startup; f < jab.startup + jab.active; f++) expect(reachOfHurt(f)).toBeLessThan(tip);
    expect(reachOfHurt(jab.startup + jab.active)).toBeGreaterThanOrEqual(tip);
    expect(jab.recovery).toBeGreaterThan(bare.recovery);
    expect(S.moves['stand.M'].armed).toBeUndefined(); // the rear hand is empty
  });

  it('the laws hold for an armed fighter, and flag a blade that pays nothing', () => {
    expect(lawsFor(S).filter((l) => !l.ok).map((l) => l.id)).toEqual([]);
    const free = withRecipe({
      weapon: { kind: 'sword', hurt: 'none' },
      normals: { ...base.normals, 'stand.L': { family: 'jab', tune: { recovery: 6 } } },
    });
    const law = lawsFor(free).find((l) => l.id === 'disjoint-pays');
    expect(law.ok).toBe(false);
    expect(law.measured.free).toContain('stand.L');
  });

  it('two blades that meet clash: neither lands', () => {
    let clashed = false;
    for (let d = 1600; d <= 2600 && !clashed; d += 100) {
      const { ctx, s } = fight(d, [S, S]);
      const r = run(s, ctx, 20, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.L) }, { x: 0, y: 0, b: tap(k, 0, BTN.L) }]);
      if (has(r.events, 'clash')) {
        clashed = true;
        expect(has(r.events, 'hit')).toBe(false);
      }
    }
    expect(clashed).toBe(true);
  });
});

describe('versus extend: priority', () => {
  // two jabs that land on the same frame: one fighter's tuned to a higher level
  const strong = withRecipe({ normals: { ...base.normals, 'stand.L': { ...base.normals['stand.L'], tune: { priority: 3 } } } });
  const both = (d, fighters) => {
    const { ctx, s } = fight(d, fighters);
    return run(s, ctx, 20, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.L) }, { x: 0, y: 0, b: tap(k, 0, BTN.L) }]);
  };
  const traded = (fighters) => {
    for (let d = 500; d <= 1400; d += 25) {
      const r = both(d, fighters);
      const hits = r.events.filter(([, e]) => e.t === 'hit' || e.t === 'counter');
      if (hits.length) return { r, hits };
    }
    return null;
  };

  it('equal levels trade; the higher level lands alone, the other strike does not', () => {
    const even = traded([K, K]);
    expect(new Set(even.hits.map(([, e]) => e.p))).toEqual(new Set([0, 1]));
    const won = traded([strong, K]);
    expect(won.hits.map(([, e]) => e.p)).toEqual([0]);
    expect(won.r.events.find(([, e]) => e.t === 'priority')[1]).toMatchObject({ p: 0, over: [3, 1] });
    expect(won.r.s.p[0].hp).toBe(strong.hp);
  });

  it('the scale: a normal\'s strength, a special\'s own, a super 4, the DP 0; a tune moves it within 0 to 5', () => {
    expect(['L', 'M', 'H'].map((k) => K.moves[`stand.${k}`].priority)).toEqual([1, 2, 3]);
    const all = withRecipe({ specials: { neutral: { id: 'rising' }, forward: { id: 'rush' }, back: { id: 'spin' }, down: { id: 'leap' } }, super: { id: 'super-rising' } });
    const at = (dir) => ['L', 'M', 'H'].map((k) => all.moves[`special.${dir}.${k}`].priority);
    expect(at('neutral')).toEqual([0, 0, 0]);
    expect(at('forward')).toEqual([2, 3, 4]);
    expect(at('back')).toEqual([2, 2, 3]);
    expect(at('down')).toEqual([3, 3, 3]);
    expect(all.moves.super.priority).toBe(0);
    expect(withRecipe({ super: { id: 'super-rush' } }).moves.super.priority).toBe(4);
    expect(K.moves.throw.priority).toBeUndefined();
    expect(() => withRecipe({ normals: { ...base.normals, 'stand.L': { ...base.normals['stand.L'], tune: { priority: 6 } } } })).toThrow(/priority is a whole number from 0/);
  });

  it('the laws: priority is paid for in frames, and the DP yields', () => {
    expect(lawsFor(K).filter((l) => /priority|reversal-yields/.test(l.id)).every((l) => l.ok)).toBe(true);
    expect(lawsFor(strong).find((l) => l.id === 'priority-pays')).toMatchObject({ ok: false });
    const dp = withRecipe({ specials: { neutral: { id: 'rising', tune: { priority: 2 } } } });
    expect(lawsFor(dp).find((l) => l.id === 'reversal-yields')).toMatchObject({ ok: false });
  });
});

describe('versus extend: systems and rules', () => {
  it('absent, the systems change nothing: the same seed is the same fight, and no state carries them', () => {
    const a = runVersus({ fighters: [base, base], seed: 9, maxFrames: 1200 });
    const b = runVersus({ fighters: [base, base], seed: 9, maxFrames: 1200, rules: { systems: [] } });
    expect(b.hash).toBe(a.hash);
    expect('gd' in a.state.p[0] || 'burst' in a.state.p[0]).toBe(false);
  });

  it('parry: a fresh tap forward as a strike arrives takes no damage', () => {
    const { ctx, s } = fight(800, [K, K], { systems: ['parry'] });
    const r = run(s, ctx, 12, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.L) }, { x: k >= 1 ? -1 : 0, y: 0, b: 0 }]);
    expect(has(r.events, 'parry')).toBe(true);
    expect(r.s.p[1].hp).toBe(K.hp);
  });

  it('burst: S + T while being hit breaks free once a round', () => {
    const { ctx, s } = fight(800, [K, K], { systems: ['burst'] });
    const r = run(s, ctx, 30, (k, st) => [{ x: 0, y: 0, b: tap(k, 0, BTN.M) }, { x: 0, y: 0, b: st.p[1].st === 'hit' && !st.p[1].burst ? BTN.S | BTN.T : 0 }]);
    expect(has(r.events, 'burst')).toBe(true);
    expect(r.s.p[1].burst).toBe(1);
  });

  it('guard: blocking wears the bar until it is crushed', () => {
    const { ctx, s } = fight(700, [K, K], { systems: ['guard'], guardMax: 200 });
    const r = run(s, ctx, 60, (k) => [{ x: 0, y: 0, b: k % 10 === 0 ? BTN.L : 0 }, { x: 1, y: 0, b: 0 }]);
    expect(has(r.events, 'block')).toBe(true);
    expect(has(r.events, 'crush')).toBe(true);
  });

  it('the rules read whole or say what they take', () => {
    expect(readRules({ timer: 60, systems: ['parry', 'parry'] })).toEqual({ timer: 60, systems: ['parry'] });
    expect(() => readRules({ systems: ['dodge'] })).toThrow(/parry, burst, guard/);
    expect(() => readRules({ gravity: 2 })).toThrow(/no 'gravity'/);
  });
});

describe('versus extend: a spawned game, edited', () => {
  it('an intent carries the weapon, the tunes and the specials over the solve, and the game gate reads them', () => {
    const { recipe, notes } = solveFighter({ id: 'ronin', archetype: 'rushdown', weapon: 'katana', specials: { down: null }, tune: { 'special.forward': { invuln: [[1, 4, 'strike']] } } });
    expect(recipe.weapon).toBe('katana');
    expect(recipe.specials.down).toBeUndefined();
    expect(notes.some((n) => n.startsWith('weapon: katana'))).toBe(true);
    expect(readVersusManifest({ kind: 'game', engine: 'versus', roster: [{ id: 'ronin', archetype: 'rushdown', weapon: 'katana' }], rules: { systems: ['parry'] } }).ok).toBe(true);
    const bad = readVersusManifest({ kind: 'game', engine: 'versus', roster: [{ id: 'x', archetype: 'zoner', tune: { 'stand.M': { startup: 0 } } }], rules: { systems: ['dodge'] } });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/roster\[0\].*startup/);
    expect(bad.errors.join(' ')).toMatch(/systems/);
  });
});

describe('versus extend: the gate reads everything the fight reads', () => {
  const ROW = { from: 'fireball', at: { L: { startup: 13, recovery: 30, speed: 45 }, M: { startup: 12, recovery: 31, speed: 60 }, H: { startup: 11, recovery: 32, speed: 80 } } };

  it('a motion is numpad digits; any of them reads, in the classic scheme too', () => {
    expect(() => withRecipe({ library: { specials: { odd: { ...ROW, motion: '2x8' } } }, specials: { ...base.specials, neutral: { id: 'odd' } } })).toThrow(/motion is 2 to 8 numpad digits/);
    expect(() => withRecipe({ specials: { ...base.specials, neutral: { id: 'fireball', motion: '5' } } })).toThrow(/special.neutral motion/);
    const F = withRecipe({ library: { specials: { beam: { ...ROW, motion: '28' } } }, specials: { ...base.specials, neutral: { id: 'beam' } } });
    const ctx = { fighters: [F, K] };
    let s = newVersus(ctx, { schemes: ['classic', 'classic'], rules: { intro: 1 } });
    s = stepVersus(s, [Z, Z], ctx);
    const pads = [{ x: 0, y: -1, b: 0 }, { x: 0, y: -1, b: 0 }, { x: 0, y: 1, b: BTN.M }];
    const r = run(s, ctx, 20, (k) => [pads[k] ?? Z, Z]);
    expect(r.events.some(([, e]) => e.t === 'special' && e.slot === 'special.neutral.M')).toBe(true);
  });

  it('the cast, body and movement are read: whole numbers in range, or it says which', () => {
    expect(() => withRecipe({ hp: 'lots' })).toThrow(/hp is a whole number/);
    expect(() => withRecipe({ jump: { g: 0 } })).toThrow(/jump.g is a whole number from 1/);
    expect(() => withRecipe({ dash: { f: { frames: 0 } } })).toThrow(/dash.f.frames/);
    expect(() => withRecipe({ walk: { f: 52.5 } })).toThrow(/walk.f/);
    expect(() => withRecipe({ cast: 'giant' })).toThrow(/cast 'giant'/);
    expect(() => withRecipe({ body: { height: 'tall' } })).toThrow(/body.height/);
    expect(withRecipe({ hp: 1200, walk: { f: 60 }, jump: { g: 7 }, body: { arm: 1.1 } }).hp).toBe(1200);
  });

  it('a tune key the move would never read is refused, never ignored', () => {
    expect(() => withRecipe({ normals: { ...base.normals, 'stand.M': { family: 'straight', tune: { landing: 4 } } } })).toThrow(/tune.landing does nothing on a normal/);
    expect(() => withRecipe({ normals: { ...base.normals, 'air.H': { family: 'air-stomp', tune: { adv: { hit: 4 } } } } })).toThrow(/tune.adv does nothing on an air normal/);
    expect(() => withRecipe({ throw: { tune: { chip: 5 } } })).toThrow(/tune.chip does nothing on a throw/);
    expect(() => withRecipe({ specials: { ...base.specials, neutral: { id: 'fireball', tune: { guard: 'low' } } } })).toThrow(/tune.guard does nothing on fireball/);
    expect(() => withRecipe({ specials: { ...base.specials, forward: { id: 'rising', tune: { recovery: 9 } } } })).toThrow(/tune.recovery does nothing on rising/);
    expect(() => withRecipe({ super: { id: 'super-fireball', tune: { adv: { hit: 30 } } } })).toThrow(/tune.adv does nothing on super-fireball/);
  });

  it('what a tune says it does, it does: hits on a normal, adv on a super, meter on a throw', () => {
    const two = withRecipe({ normals: { ...base.normals, 'stand.H': { ...base.normals['stand.H'], tune: { hits: 2 } } } }).moves['stand.H'];
    expect([two.hits, two.rehit, two.damage]).toEqual([2, Math.floor(two.active / 2), Math.round(K.moves['stand.H'].damage / 2)]);
    const rush = solveFighter({ id: 'r', archetype: 'rushdown' }).recipe;
    const plus = compileFighter({ ...rush, super: { id: 'super-rush', tune: { adv: { hit: 30 } } } }).moves.super;
    expect(plus.hitstun - compileFighter(rush).moves.super.hitstun).toBe(10);
    const greedy = withRecipe({ throw: { tune: { meter: 150 } } });
    const { ctx, s } = fight(700, [greedy, K]);
    const r = run(s, ctx, 60, (k) => [{ x: 0, y: 0, b: tap(k, 0, BTN.T) }, Z]);
    expect(has(r.events, 'throw')).toBe(true);
    expect(r.s.p[0].meter).toBe(150);
  });

  it('the replay fingerprint is the whole state: a field the fight carries, changed, changes it', () => {
    const { s } = fight(1200, [K, K]);
    const t = { ...s, p: s.p.map((p, i) => (i ? p : { ...p, inv: p.inv + 1 })) };
    expect(versusHash(t)).not.toBe(versusHash(s));
    expect(versusHash({ ...s, events: [{ t: 'hit' }] })).toBe(versusHash(s));
  });

  it('the game gate stamps each fighter with its laws, and refuses none for them', () => {
    const g = readVersusManifest({ kind: 'game', engine: 'versus', roster: [{ id: 'kata', archetype: 'all-rounder' }, { id: 'slow', archetype: 'zoner', tune: { 'stand.L': { startup: 9 } } }] });
    expect(g.ok).toBe(true);
    expect(g.laws.map((l) => l.id)).toEqual(['kata', 'slow']);
    expect(g.laws[0].broken).toEqual([]);
    expect(g.laws[1].broken).toContain('reach-costs');   // a slow jab: something reaching further starts sooner
    expect(g.laws[1].held + g.laws[1].broken.length).toBe(g.laws[1].of);
  });
});

describe('versus extend: an arena hosted by its game', () => {
  it('fights by the game\'s rules as they are now, not the copy the arena was made with; its walls stay its own', () => {
    const made = { systems: ['parry'], timer: 60, half: 5000 };
    expect(hostedRules(made, { timer: 45 }, 7000)).toEqual({ timer: 45, half: 7000 });   // parry, dropped from the game, stays dropped
    expect(hostedRules(made, {}, 7000)).toEqual({ half: 7000 });
    expect(hostedRules(made, undefined, 7000)).toEqual({ systems: ['parry'], timer: 60, half: 7000 });   // on its own
  });
});

describe('versus extend: a stance that stoops (a beast\'s head carried low)', () => {
  const top = (F, k) => Math.max(...F.idle[k].hurt.map((b) => b[3]));
  const front = (F, k) => Math.max(...F.idle[k].hurt.map((b) => b[2]));
  it('its rests sink: the head lower standing and crouched, the front where it was; the jabs thrown from the rest shorter, every other move as it was', () => {
    const S = withRecipe({ stance: { stoop: 26 } }), T = withRecipe({ stance: { stoop: 26 }, tradition: 'boxing' }), B = withRecipe({ tradition: 'boxing' });
    for (const [plain, low] of [[K, S], [B, T]]) {
      expect(top(low, 'stand')).toBeLessThan(top(plain, 'stand') - 40);
      expect(top(low, 'crouch')).toBeLessThan(top(plain, 'crouch') - 100);
      expect(front(low, 'stand')).toBeLessThanOrEqual(front(plain, 'stand') + 30);
      // (a move's own poses are its own: the mid and heavy normals, the air's and the specials land where they did; the
      // lights, thrown from the rest, start from the sunk shoulder: the trade a hunched beast makes, a smaller target for
      // a shorter jab; the grab reaches from the chest, a little further)
      for (const slot of ['stand.M', 'stand.H', 'crouch.M', 'crouch.H', 'air.M', 'special.back.M']) expect(low.moves[slot].reach, slot).toBe(plain.moves[slot].reach);
      for (const slot of ['stand.L', 'crouch.L']) { expect(low.moves[slot].reach).toBeLessThan(plain.moves[slot].reach); expect(low.moves[slot].reach).toBeGreaterThan(plain.moves[slot].reach * 0.88); }
      expect(low.moves.throw.reach).toBeLessThan(plain.moves.throw.reach * 1.06);
      // (the body drawn stands its rests: the poses it carries are the stooped ones)
      expect(low.poses.guard.torso).toBeGreaterThan((plain.poses?.guard ?? low.poses.guard).torso - 0.01);
    }
    expect(S.poses.crouch.legF[0]).toBeGreaterThan(70);
  });
  it('absent, a fighter compiles as it did; a stoop past what the stance reads is refused', () => {
    expect(JSON.stringify(withRecipe({ stance: { open: 45 } }).idle)).toBe(JSON.stringify(withRecipe({ stance: { open: 45, stoop: 0 } }).idle));
    expect(K.poses).toBeUndefined();
    expect(() => withRecipe({ stance: { stoop: 45 } })).toThrow(/stance\.stoop is degrees from 0 to 30/);
  });
});
