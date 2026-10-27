/**
 * The island drawn larger and geo only (`island.scale`, `cell`, `cover`, `walk: 'none'`): the seed a path is grown on,
 * at a game's scale, flown and zoomed. Each opt-in: absent, the island is as it always was.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru } from './plan.js';
import { assembleStageScene } from '../era/stage.js';

// the smallest island with a beach, a high shore and a raised mound (each build is seconds)
const BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }];
const meru = (island, tiers = BASES) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers, island } }, {});
const of = (p, g) => p.faces.filter((f) => f.group === g);

describe('local meru: the island at scale, geo only', () => {
  it('reads its new settings and refuses what they are not', () => {
    expect(readLocalMeru({ island: true }).island).toMatchObject({ cell: 0.5, scale: 1, cover: 'grass', walk: 'all' });
    expect(() => readLocalMeru({ island: { cell: 9 } })).toThrow(/island.cell is the land's quad/);
    expect(() => readLocalMeru({ island: { scale: 0 } })).toThrow(/island.scale is how much larger/);
    expect(() => readLocalMeru({ island: { cover: 'moss' } })).toThrow(/island.cover is 'grass'/);
    expect(() => readLocalMeru({ island: { walk: 'fly' } })).toThrow(/'none' \(no walk/);
  });

  it('its defaults written out build the island as it always was, byte for byte', () => {
    const geo = { geology: true, walk: 'base' };
    expect(JSON.stringify(meru({ ...geo, cell: 0.5, scale: 1, cover: 'grass' }).faces)).toBe(JSON.stringify(meru(geo).faces));
  }, 60_000);

  it('three times larger in coarser quads: fewer faces for the larger land, bare soil and scree, no grass, no walk', () => {
    const small = meru({ geology: true, walk: 'base' });
    const big = meru({ geology: true, walk: 'none', seabed: 'merged', cell: 1.5, scale: 3, cover: 'soil', beach: 27, sea: 2.1, depth: 9, high: { height: 13.5 } },
      BASES.map(({ height, foot, summit, ...t }) => ({ ...t, height: height * 3, foot: foot * 3, summit: summit * 3 })));
    const span = (p) => { const xs = of(p, 'isekai:sand').flatMap((f) => f.corners.map((c) => c[0])); return Math.max(...xs) - Math.min(...xs); };
    expect(span(big)).toBeGreaterThan(2.5 * span(small));
    expect(big.faces.length).toBeLessThan(small.faces.length);
    expect(of(big, 'isekai:ground')).toHaveLength(0);
    expect(of(big, 'isekai:soil').length).toBeGreaterThan(0);
    expect(of(big, 'isekai:scree').length).toBeGreaterThan(0);
    expect(of(big, 'isekai:trail')).toHaveLength(0);
    expect(of(small, 'isekai:trail').length).toBeGreaterThan(0);
  }, 120_000);
});
