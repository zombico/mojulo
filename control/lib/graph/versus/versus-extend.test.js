import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, readRules } from './versus-core.js';
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
