// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';

// An explicit block layout is the operator's anchor intent (fractal-city.js header): a THEME-implied
// root anchor is dropped when the call lays blocks and does not name `asset.anchor` itself; a named
// anchor, or a call without blocks, keeps it. mars-colony is the theme pack that implies a tower.
const BLOCKS = [{ rect: { x: 4, y: 4, w: 8, d: 6 }, use: 'residential' }, { rect: { x: 16, y: 4, w: 8, d: 6 }, use: 'commercial' }];

describe('compose_world: blocks drop a theme-implied anchor', () => {
  it('mars-colony implies a tower when no blocks are laid', () => {
    const r = composeWorld({ base: 'city', theme: 'mars-colony', seed: 3 });
    expect(r.recipe.anchor).toBe('tower');
    expect(r.stats.anchors).toBeGreaterThan(0);
  });

  it('laying blocks without naming an anchor drops the theme tower (stored recipe + planned city)', () => {
    const r = composeWorld({ base: 'city', theme: 'mars-colony', seed: 3, overrides: { blocks: BLOCKS } });
    expect(r.recipe.anchor).toBeNull();
    expect(r.recipe.blocks).toEqual(BLOCKS);
    expect(r.stats.blocksLaid.length).toBe(2);
    expect(r.stats.blocksLaid.every((b) => !b.overlapsReserved)).toBe(true);
    expect(r.note).toBeUndefined();                     // nothing was silently ignored
  });

  it('a call that names asset.anchor itself keeps it beside the blocks', () => {
    const r = composeWorld({ base: 'city', theme: 'mars-colony', seed: 3, overrides: { blocks: BLOCKS, asset: { anchor: 'tower' } } });
    expect(r.recipe.anchor).toBe('tower');
    expect(r.stats.blocksLaid.length).toBe(2);
  });

  it('the drop is city-only and leaves the rest of the theme (time, density, depth) in place', () => {
    const r = composeWorld({ base: 'city', theme: 'mars-colony', seed: 3, overrides: { blocks: BLOCKS } });
    expect(r.recipe.time).toBe('night');
    expect(r.recipe.density).toBe(0.8);
    expect(r.recipe.depth).toBe(3);
  });
});
