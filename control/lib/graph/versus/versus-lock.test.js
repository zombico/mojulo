// A lock super: the first blow that lands catches, the rest is a script (versus-core.js lockStep). The hit-combo kind
// plays in the fight with the clock running; the cutscene kind stops the clock. One case per kind, one fighter.
import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, hurtBoxes, versusHash } from './versus-core.js';
import { SUPERS } from './versus-library.js';
import { versusGameData } from './versus-page.js';

const roster = versusGameData({}).roster;
const recipe = (id) => roster.find((r) => r.id === id).recipe;
const lockOf = (kind) => Object.keys(SUPERS).find((id) => SUPERS[id].lock?.kind === kind);
const ctxWith = (superId) => ({ fighters: [compileFighter({ ...recipe(roster[0].id), super: { id: superId } }), compileFighter(recipe(roster[1].id))] });

// P1 closes in with a full meter after the intro and fires the super (modern: S + H); P2 stands, or holds back
function play(ctx, { block = false, n = 360 } = {}) {
  let s = newVersus(ctx);
  const states = [], events = [];
  for (let f = 0; f < n; f++) {
    if (f === 95) { s.p[0].x = s.p[1].x - 800; s.p[0].meter = 1000; }
    s = stepVersus(s, [f === 100 ? { x: 0, y: 0, b: 8 | 4 } : { x: 0, y: 0, b: 0 }, { x: block ? 1 : 0, y: 0, b: 0 }], ctx);
    states.push(s); events.push(...s.events.map((e) => ({ ...e, f })));
  }
  return { states, events, end: s };
}

describe('versus lock supers', () => {
  it('compiles a lock as a script whose blows share the super\'s damage, and refuses one that cannot lock', () => {
    const m = ctxWith(lockOf('combo')).fighters[0].moves.super;
    expect(m.lock.beats.reduce((a, b) => a + b, 0)).toBe(SUPERS[lockOf('combo')].damage);
    expect(m.hits).toBe(1);
    const bad = (lock, more = {}) => () => compileFighter({ ...recipe(roster[0].id), super: { id: 'mine' }, library: { supers: { mine: { from: 'rush', startup: 6, damage: 200, lock, ...more } } } });
    expect(bad({ kind: 'movie', hits: 3, every: 6 })).toThrow(/kind is one of/);
    expect(bad({ kind: 'combo', hits: 1, every: 6 })).toThrow(/hits is a whole number/);
    expect(bad({ kind: 'combo', hits: 3, every: 6 }, { from: 'fireball', speed: 100 })).toThrow(/only a grounded strike locks/);
  });

  it('the hit-combo super lands every blow on its beat in the fight, both untouchable, the clock running, then the finish', () => {
    const ctx = ctxWith(lockOf('combo')), L = ctx.fighters[0].moves.super.lock;
    const r = play(ctx), hits = r.events.filter((e) => e.t === 'hit' && e.lock === 'combo');
    expect(hits.map((e) => e.beat)).toEqual(L.beats.map((_, i) => i + 1));
    expect(hits.reduce((a, e) => a + e.dmg, 0)).toBe(L.beats.reduce((a, b) => a + b, 0));
    const locked = r.states.filter((s) => s.lock);
    expect(locked.length).toBeGreaterThan(L.every * (L.beats.length - 1));
    expect(locked.every((s) => hurtBoxes(s.p[0], ctx.fighters[0]).length === 0 && hurtBoxes(s.p[1], ctx.fighters[1]).length === 0)).toBe(true);
    expect(locked.at(-1).timer).toBeLessThan(locked[0].timer);
    expect(r.events.some((e) => e.t === 'unlock')).toBe(true);
    expect(r.end.lock).toBeUndefined();
  });

  it('the cutscene super stops the clock for its script', () => {
    const r = play(ctxWith(lockOf('cutscene'))), locked = r.states.filter((s) => s.lock);
    expect(locked.length).toBeGreaterThan(0);
    expect(new Set(locked.map((s) => s.timer)).size).toBe(1);
    expect(r.events.filter((e) => e.t === 'hit' && e.lock === 'cutscene').length).toBe(SUPERS[lockOf('cutscene')].lock.hits);
  });

  it('blocked, a lock super is one blocked blow and no script', () => {
    const r = play(ctxWith(lockOf('combo')), { block: true });
    expect(r.events.filter((e) => e.t === 'block').length).toBe(1);
    expect(r.states.some((s) => s.lock)).toBe(false);
  });

  it('is the same fight twice, and a step leaves the state it was given alone (rollback)', () => {
    const ctx = ctxWith(lockOf('combo')), a = play(ctx), b = play(ctx);
    expect(a.states.map(versusHash)).toEqual(b.states.map(versusHash));
    const mid = a.states.find((s) => s.lock && s.lock.k > 3), before = versusHash(mid);
    stepVersus(mid, [{ x: 0, y: 0, b: 0 }, { x: 0, y: 0, b: 0 }], ctx);
    expect(versusHash(mid)).toBe(before);
  });
});
