import { describe, it, expect } from 'vitest';
import { outTileSite, tilePath, levelHeight } from './out-tile.js';
import { outTrailStyle } from './out-trail-board.js';

// A TILE of a glyph map as a site: its path from each open edge's middle (an L a quarter arc round its corner), its
// ground the level's one land read in its own place, so two tiles agree along the edge they share.

const { st } = outTrailStyle({ kit: 'isekai-meadow' });
const T = 48;

describe('a glyph map\'s tile', () => {
  it('runs its path from each open edge\'s middle: an I straight through, an L a quarter arc, an X to the centre', () => {
    const I = tilePath(T, ['n', 's']), L = tilePath(T, ['n', 'e']), X = tilePath(T, ['n', 'e', 's', 'w']);
    expect(I).toHaveLength(2);
    expect(L).toHaveLength(1);
    const arc = L[0], ends = [arc[0], arc[arc.length - 1]].map((p) => p.map((v) => +v.toFixed(3)));
    expect(ends).toEqual(expect.arrayContaining([[24, 48], [48, 24]]));
    // (the arc keeps half a tile from the corner it bends round, the north-east one)
    for (const p of arc) expect(Math.hypot(p[0] - T, p[1] - T)).toBeCloseTo(T / 2, 5);
    expect(X).toHaveLength(4);
    for (const P of X) expect(P[P.length - 1]).toEqual([24, 24]);
    expect(tilePath(T, [])).toEqual([]);
  });

  it('meets its neighbour along their shared edge: one land, one path height at the edge\'s middle', () => {
    // two tiles side by side, west and east, the path crossing the edge between them
    const W = outTileSite(st, { size: T, open: ['e', 'w'], origin: [0, 0], level: { seed: 5 } }, 3), E = outTileSite(st, { size: T, open: ['w', 'n'], origin: [T, 0], level: { seed: 5 } }, 9);
    for (let y = 0; y <= T; y += 6) expect(W.ground(T, y)).toBeCloseTo(E.ground(0, y), 2);
    expect(W.ground(T, T / 2)).toBeCloseTo(E.ground(0, T / 2), 2);
    // (and the land itself is the level's, read in place)
    expect(W.valley(10, 40)).toBeCloseTo(levelHeight(10, 40, { seed: 5 }), 6);
  });

  it('lays its path where the path is, and no path on a tile with none', () => {
    const L = outTileSite(st, { size: T, open: ['n', 'e'], origin: [0, 0] }, 1), none = outTileSite(st, { size: T, open: [], origin: [0, 0] }, 1);
    expect(L.trailDist(24, 48)).toBeLessThan(0.01);
    expect(L.trailDist(4, 4)).toBeGreaterThan(20);
    expect(none.trailDist(24, 24)).toBe(Infinity);
  });
});
