// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';
import { mintFractalCity } from './scene-city.js';

// The metro profile rides compose_world's city overrides: stored as `profile: 'metro'`
// with a downtown frame when none is given; a city without it stores no profile key at all.
describe('compose_world: the metro profile', () => {
  it('stores profile + a downtown frame, and the plan reports it', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro' } });
    expect(r.recipe.profile).toBe('metro');
    expect(r.recipe.region).toEqual({ x: 2, y: 2, w: 220, d: 140 });
    expect(r.stats.profile).toBe('metro');
    expect(r.note).toBeUndefined();
  });
  it('an explicit region wins, and metro may recurse to depth 6', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro', region: { x: 2, y: 2, w: 120, d: 80 }, context: { depth: 9 } } });
    expect(r.recipe.region).toEqual({ x: 2, y: 2, w: 120, d: 80 });
    expect(r.recipe.depth).toBe(6);
  });
  it('a new mint wears the round street kit beside frontage; the caller can keep the block kit', () => {
    expect(composeWorld({ base: 'city', seed: 3 }).recipe.elements).toMatchObject({ frontage: true, roundKit: true });
    expect(mintFractalCity({ seed: 3, elements: { round: false } }).recipe.elements).toEqual({ round: false, frontage: true });
    expect(mintFractalCity({ seed: 3, elements: ['roads'] }).recipe.elements).toEqual(['roads', 'frontage', 'roundKit']);
  });
  it('a stock city stores no profile and keeps the 1–3 depth clamp', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { context: { depth: 9 } } });
    expect('profile' in r.recipe).toBe(false);
    expect(r.recipe.depth).toBe(3);
    const junk = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'mega' } });
    expect('profile' in junk.recipe).toBe(false);
  });
});

// A metro mint writes one flavour into the row: the one asked for, else the landmark's own city, else a
// seeded roll in the locale's region, else over all. The planner never rolls, so the row keeps saying so.
describe('compose_world: the metro flavour', () => {
  it('an asked flavour is stored by its canonical name with the locale it implies', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro', flavor: 'Paris' } });
    expect(r.recipe.flavor).toBe('paris');
    expect(r.recipe.locale).toBe('europe');
    expect(r.stats.flavor).toBe('paris');
  });
  it('a landmark brings its own city; an explicit flavour still wins', () => {
    expect(composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro', asset: { monument: 'colosseum' } } }).recipe.flavor).toBe('mediterranean');
    expect(composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro', flavor: 'tokyo', asset: { monument: 'colosseum' } } }).recipe.flavor).toBe('tokyo');
  });
  it('the dice: a region rolls among its own flavours, the same seed rolls the same, and the roll is stored', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = composeWorld({ base: 'city', seed, overrides: { profile: 'metro', context: { locale: 'europe' } } });
      expect(['paris', 'london', 'mediterranean']).toContain(r.recipe.flavor);
      expect(composeWorld({ base: 'city', seed, overrides: { profile: 'metro', context: { locale: 'europe' } } }).recipe.flavor).toBe(r.recipe.flavor);
    }
    const open = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => composeWorld({ base: 'city', seed, overrides: { profile: 'metro' } }).recipe.flavor));
    expect(open.size).toBeGreaterThan(3);
  }, 60_000);   // about 10 s on a laptop and up to 25 s on a loaded CI runner, against the 30 s default
  it('a stock city stores no flavour even when asked', () => {
    expect('flavor' in composeWorld({ base: 'city', seed: 3, overrides: { flavor: 'paris' } }).recipe).toBe(false);
  });
});

