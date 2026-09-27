// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';

// The canal profile rides compose_world's city overrides like metro: stored as `profile: 'canal'`
// (plus its layout when it names one) with a canal-ring frame when none is given.
describe('compose_world: the canal profile', () => {
  it('stores profile + the canal frame, and the plan reports it', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'canal' } });
    expect(r.recipe.profile).toBe('canal');
    expect(r.recipe.region).toEqual({ x: 2, y: 2, w: 240, d: 150 });
    expect('canals' in r.recipe).toBe(false);
    expect(r.stats.profile).toBe('canal');
    expect(r.stats.layout).toBe('ring');
  });
  it('a named layout is stored; an unknown one is dropped', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'canal', canals: { layout: 'parallel' }, region: { x: 2, y: 2, w: 120, d: 80 } } });
    expect(r.recipe.canals).toEqual({ layout: 'parallel' });
    expect(r.recipe.region).toEqual({ x: 2, y: 2, w: 120, d: 80 });
    expect(r.stats.layout).toBe('parallel');
    const junk = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'canal', canals: { layout: 'spiral' }, region: { x: 2, y: 2, w: 120, d: 80 } } });
    expect('canals' in junk.recipe).toBe(false);
  });
  it('canals without the profile store nothing', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { canals: { layout: 'ring' } } });
    expect('profile' in r.recipe).toBe(false);
    expect('canals' in r.recipe).toBe(false);
  });
});
