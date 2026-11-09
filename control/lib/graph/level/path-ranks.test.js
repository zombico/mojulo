import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { pathRanks, PATH_RANKS, RANK_ORDER, rankWords } from './path-ranks.js';
import { outTileSite } from '../era/out-tile.js';
import { ISEKAI_STYLES } from '../era/isekai.js';

// THE WAYS' RANKS: a glyph map's ways told apart from the network (a road joins places, the trunk is the walk's way, a
// branch that leads on is a path, a dead end a trace), and a tile's way laid at its width, meeting its neighbour's.

const rank = (R, r, c) => R.get(`${r},${c}`)?.rank;

describe('the ways\' ranks', () => {
  it('a road joins two places door to door; the walk\'s way is the trunk; a loop off it leads on; a dead end is a trace', () => {
    // (a house and a temple, the goal, joined along the top; the walk sets out from the far south end; a spur off the
    // house's side to nothing)
    const G = readGrid({ tile: 24, rows: ['h # # # g', '. # . # .', '# # . # .', '. . . # .', '. . . # .', '. . . # .', '. . . # .'], key: { h: { use: 'dwelling' }, g: { use: 'temple', goal: true } } });
    const R = pathRanks(G);
    expect(rank(R, 0, 2)).toBe('road');                 // (between the two doors)
    expect(rank(R, 6, 3)).toBe('track');                // (the walk sets out from the far end: the trunk, out of town)
    expect(rank(R, 2, 0)).toBe('trace');                // (a dead end off the way, nothing at it)
    // every path tile is ranked, and its widths are its rank's
    for (const x of G.cells.filter((c) => c.kind === 'path')) expect(R.get(`${x.r},${x.c}`).width).toBe(PATH_RANKS[rank(R, x.r, x.c)].width);
  });

  it('a branch that meets the trunk at two tiles is a way through, never a trace', () => {
    const G = readGrid({ tile: 24, rows: ['# # # # #', '# . . . #', '# # # # #'] });
    const R = pathRanks(G);
    const branch = G.cells.filter((x) => x.kind === 'path' && !R.trunk.has(`${x.r},${x.c}`));
    expect(branch.length).toBeGreaterThan(0);
    for (const x of branch) expect(rank(R, x.r, x.c)).toBe('path');
  });

  it('an edge is as wide as the wider of its two tiles, read the same from both sides', () => {
    const G = readGrid({ tile: 24, rows: ['h # # #', '. . . #'], key: { h: { use: 'dwelling' } } }), R = pathRanks(G);
    for (const x of G.cells.filter((c) => c.kind === 'path')) for (const s of x.open) {
      const d = { n: [-1, 0, 's'], s: [1, 0, 'n'], e: [0, 1, 'w'], w: [0, -1, 'e'] }[s], y = R.get(`${x.r + d[0]},${x.c + d[1]}`);
      if (!y) continue;
      expect(R.get(`${x.r},${x.c}`).edges[s]).toEqual(y.edges[d[2]]);
      expect(R.get(`${x.r},${x.c}`).edges[s].width).toBe(Math.max(R.get(`${x.r},${x.c}`).width, y.width));
    }
  });

  it('a region says its own: a rank, a surface, a width', () => {
    const G = readGrid({ tile: 24, rows: ['# # #'], regions: { rows: ['. . P'], key: { P: { name: 'the pass', path: { rank: 'trace', surface: 'gravel' } } } } });
    const R = pathRanks(G);
    expect(R.get('0,2')).toMatchObject({ rank: 'trace', surface: 'gravel' });
    expect(() => rankWords('lane')).toThrow(/rank/);
    expect(() => rankWords({ width: 40 })).toThrow(/width/);
    expect(RANK_ORDER).toEqual(Object.keys(PATH_RANKS).sort((a, b) => PATH_RANKS[a].width - PATH_RANKS[b].width));
  });

  it('a tile\'s way meets its neighbour\'s at their shared edge, and its edge stands where the walk\'s tests read it', () => {
    const st = ISEKAI_STYLES['isekai-meadow'], T = 24, way = (w, e) => ({ width: w, fringe: 0.8, edges: e });
    // (a road tile and a track tile side by side: the edge between them as wide as the road)
    const A = outTileSite(st, { size: T, open: ['e'], origin: [0, 0], way: way(4.2, { e: { width: 4.2, fringe: 0.45 } }) }, 1);
    const B = outTileSite(st, { size: T, open: ['w', 'e'], origin: [T, 0], way: way(2.4, { w: { width: 4.2, fringe: 0.45 }, e: { width: 2.4, fringe: 0.8 } }) }, 1);
    const hA = A.tile.halfAt(T - 0.01, T / 2), hB = B.tile.halfAt(0.01, T / 2);
    expect(hA).toBeCloseTo(hB, 2);
    // (at its middle the track is its own width, the wander within a tenth)
    expect(B.tile.halfAt(T / 2, T / 2) * 2).toBeGreaterThan(2.4 * 0.89);
    expect(B.tile.halfAt(T / 2, T / 2) * 2).toBeLessThan(2.4 * 1.11);
    // (a point on the way's edge reads at the edge for every test of trailDist against halfWAt)
    const e = B.tile.halfAt(T / 2, T / 2);
    expect(B.trailDist(T / 2, T / 2 + e)).toBeCloseTo(B.halfWAt(T / 2), 1);
    // (a tile with no way is the kit's one width, as it always was)
    const C = outTileSite(st, { size: T, open: ['w', 'e'], origin: [T, 0] }, 1);
    expect(C.tile.halfAt).toBeUndefined();
    expect(C.halfWAt(5)).toBe(st.trail.width / 2);
  });
});
