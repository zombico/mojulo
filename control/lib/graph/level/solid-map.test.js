import { describe, it, expect } from 'vitest';
import { assembleGridScene } from './grid-scene.js';
import { levelHeight } from '../era/out-tile.js';

// A WALKED MAP IS SOLID: each tile is asked for its trees' trunks and its boulders as colliders (`tile.solid`), and the page
// is told which groups are no footing (`footless`: a tree's crown and leaves), so a hero walks round a tree and never up
// into its leaves.
const T = 24, plan = { size: 3, rows: ['A B'], route: ['A', 'B'], key: { A: { name: 'the town' }, B: { name: 'the fields' } } };
const level = { kit: 'isekai-meadow', seed: 5, grid: { tile: T, plan } };
const seen = [];
const stand = async (m) => {
  seen.push(m);
  const [ox, oy] = m.tile.origin, L = m.tile.level, z = (x, y) => Math.round(levelHeight(ox + x, oy + y, L) * 1e5) / 1e5;
  return { faces: [{ corners: [[0, 0, z(0, 0)], [T, 0, z(T, 0)], [T, T, z(T, T)], [0, T, z(0, T)]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' }], walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 }, colliders: m.tile.solid ? [{ min: [10, 10, 0], max: [10.6, 10.6, 3.5], of: 'flora:trunk' }] : [] };
};

describe('a walked map', () => {
  it('asks each tile for its flora solid, lays the trunks where the tile stands them, and names the footless groups', async () => {
    const P = await assembleGridScene({ level }, {}, { buildStage: stand });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((m) => m.tile.solid === true)).toBe(true);
    const trunks = P.colliders.filter((c) => c.of === 'flora:trunk');
    // (one a tile here, each placed by its tile: no two at the same spot)
    expect(trunks.length).toBe(seen.length);
    expect(new Set(trunks.map((c) => c.min.join(','))).size).toBe(trunks.length);
    expect(P.footless).toEqual(expect.arrayContaining(['isekai:crown', 'isekai:leaves', 'isekai:trees:']));
  });
});

// THE KIT'S SIDE (era/isekai.js): a tile asked solid gives a trunk collider a tree, about its foot, and a boulder's its
// faces' box drawn in a little; not asked, not a byte more
import { assembleStageScene } from '../era/stage.js';
describe('a solid tile of the meadow kit', () => {
  it('stands a collider on each trunk and each boulder only when asked', async () => {
    const tile = (more) => ({ kind: 'stage', kit: 'isekai-meadow', seed: 5, tile: { size: 24, open: ['e', 'w'], origin: [0, -24], level: { seed: 5 }, ...more } });
    const [solid, plain] = await Promise.all([assembleStageScene(tile({ solid: true })), assembleStageScene(tile())]);
    const flora = (P) => (P.colliders ?? []).filter((c) => /^flora:/.test(c.of));
    expect(flora(plain)).toEqual([]);
    const trunks = flora(solid).filter((c) => c.of === 'flora:trunk');
    expect(trunks.length).toBeGreaterThan(0);
    for (const c of trunks) { expect(c.max[0] - c.min[0]).toBeGreaterThanOrEqual(0.5); expect(c.max[2] - c.min[2]).toBeCloseTo(3.5, 5); }
    // (everything else the same: the faces untouched)
    expect(solid.faces.length).toBe(plain.faces.length);
  });
});
