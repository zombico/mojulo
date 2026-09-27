// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';

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
  it('a stock city stores no profile and keeps the 1–3 depth clamp', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { context: { depth: 9 } } });
    expect('profile' in r.recipe).toBe(false);
    expect(r.recipe.depth).toBe(3);
    const junk = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'mega' } });
    expect('profile' in junk.recipe).toBe(false);
  });
});
