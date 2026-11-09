import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { mapWater, waterTiles, CLIFF_DROP } from './map-water.js';
import { levelHeight } from '../era/out-tile.js';
import { tileWater, SHORE, CLIFF } from '../era/out-tile-water.js';

// THE MAP'S WATER: water tiles gathered into bodies at one level under their shore, each shore tile's edge a beach or a
// cliff, cut into each tile's land as a function of the level's frame, so two tiles meet at one height on every seam.

const T = 24, seed = 5;
// a tile's water as the map hands it, and its carve read on the level's frame
const tileOf = (G, MW, r, c) => {
  const o = [c * T, -(r + 1) * T], L = { seed, ...(G.rise ? { rise: G.rise } : {}) };
  const W = tileWater({ ...MW.near(r, c), seed }, { size: T, origin: o, land: (x, y) => levelHeight(o[0] + x, o[1] + y, L) });
  return { W, z: (X, Y) => W.carve(X - o[0], Y - o[1], levelHeight(X, Y, L)) };
};

describe('the map\'s water', () => {
  it('gathers water tiles into bodies, each standing under the lowest of its shore', () => {
    const G = readGrid({ tile: T, rows: ['# # # #', '. ~ ~ #', '. . . #', '~ . # #'] });
    expect([...waterTiles(G)].sort()).toEqual(['1,1', '1,2', '3,0']);
    const MW = mapWater(G, { seed });
    expect(MW.bodies.map((b) => b.tiles.length)).toEqual([2, 1]);
    // (the level under every point of the outline it stands against)
    const B = MW.bodies[0];
    for (let t = 0; t <= T; t += 2) expect(B.level).toBeLessThan(levelHeight(T + t, -T, { seed }));
    // (a map with no water: none)
    expect(mapWater(readGrid({ tile: T, rows: ['# #'] }), { seed })).toBe(null);
  });

  it('says each shore\'s edge: a region\'s word, else a cliff where the land stands high over the water, else a beach', () => {
    // (the east half risen a long way: its shore tiles stand far over the water)
    const G = readGrid({ tile: T, rows: ['# # # #', '. ~ . .', '. . . .'], regions: { rows: ['. . R R', '. . R R', 'B . R R'], key: { R: { name: 'the bluff', rise: 10 }, B: { name: 'the strand', shore: 'cliff' } } } });
    const MW = mapWater(G, { seed }), k = (r, c) => MW.shore.find((s) => s[0] === r && s[1] === c)?.[2];
    expect(k(1, 2)).toBe(1);                           // (risen: a cliff)
    expect(k(1, 0)).toBe(0);                           // (low beside it: a beach)
    expect(k(2, 0)).toBe(1);                           // (its region says a cliff)
    expect(CLIFF_DROP).toBeGreaterThan(SHORE.berm);
    expect(() => mapWater(readGrid({ tile: T, rows: ['# # ~'], regions: { rows: ['. B .'], key: { B: { shore: 'reef' } } } }), { seed })).toThrow(/shore/);
  });

  it('two tiles cut one height along their shared edge, wherever the shore crosses it', () => {
    const G = readGrid({ tile: T, rows: ['# # # #', '. ~ ~ .', '. ~ . .'], regions: { rows: ['. . . .', '. . . R', '. . R R'], key: { R: { name: 'the bluff', rise: 6 } } } });
    const MW = mapWater(G, { seed });
    // (every shared edge round the water, from both sides, every metre)
    for (const [r, c, r2, c2] of [[1, 1, 1, 2], [1, 2, 1, 3], [1, 1, 2, 1], [2, 1, 2, 2], [1, 2, 2, 2], [1, 0, 1, 1]]) {
      const A = tileOf(G, MW, r, c), B = tileOf(G, MW, r2, c2);
      for (let t = 0; t <= T; t += 1) {
        const [X, Y] = c2 > c ? [(c + 1) * T, -r * T - t] : [c * T + t, -(r + 1) * T];
        expect(Math.abs(A.z(X, Y) - B.z(X, Y))).toBeLessThan(1e-6);
      }
    }
  });

  it('a beach runs down into the water; a cliff stands over it and drops sheer; no water sheet lies inland', () => {
    const G = readGrid({ tile: T, rows: ['. ~ .', '# # #'], regions: { rows: ['B . C', '. . .'], key: { B: { shore: 'beach' }, C: { shore: 'cliff' } } } });
    const MW = mapWater(G, { seed }), L = MW.bodies[0].level, y = -T / 2;
    // (across the beach's tile into the water: the land falls to the water and under it)
    const beach = tileOf(G, MW, 0, 0), zs = [16, 20, 23, 26, 30, 34].map((x) => beach.z(x, y));
    expect(zs.at(-1)).toBeLessThan(L);
    expect(Math.min(...zs.slice(0, 2))).toBeGreaterThan(L - 0.5);
    // (across the cliff's: its lip at least CLIFF.min over the water, its foot under it a few metres on)
    const cliff = tileOf(G, MW, 0, 2);
    let lip = -Infinity, foot = Infinity;
    for (let x = 2 * T + 6; x > T + 6; x -= 0.5) { const z = cliff.z(x, y); if (z > L + 0.5) lip = Math.max(lip, z); else foot = Math.min(foot, z); }
    expect(lip).toBeGreaterThanOrEqual(L + CLIFF.min - 1e-6);
    expect(foot).toBeLessThan(L);
    // (the sheets: only on the water's side, never over the land of a tile with no water of its own)
    const Wt = tileOf(G, MW, 0, 1).W;
    expect(Wt.faces.length).toBeGreaterThan(0);
    for (const f of Wt.faces) expect(f.corners.every((c) => c[2] === Wt.faces[0].corners[0][2])).toBe(true);
    const far = mapWater(readGrid({ tile: T, rows: ['. . . ~', '# # # #'] }), { seed });
    expect(far.near(0, 0)).toBe(null);
  });
});
