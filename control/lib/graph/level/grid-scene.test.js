import { describe, it, expect } from 'vitest';
import { assembleGridScene } from './grid-scene.js';

// THE GLYPH MAP'S PAGE: every tile set at its square and composed into one; its laws say it is one walkable level.
// Stand-in tile pages (a flat ground sheet over the tile, nothing else) show the composing and the laws exactly.

const T = 24;
// a stand-in tile: its ground a grid of 4 m quads at height `h(x, y)` of the LEVEL's frame, plus anything `extra` adds
const tileStage = (h, extra = () => ({})) => async (m) => {
  const [ox, oy] = m.tile.origin, faces = [];
  for (let x = 0; x < T; x += 4) for (let y = 0; y < T; y += 4) {
    const c = [[x, y], [x + 4, y], [x + 4, y + 4], [x, y + 4]].map(([a, b]) => [a, b, h(ox + a, oy + b)]);
    faces.push({ corners: c, normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' });
  }
  return { faces, walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 }, ...extra(m) };
};
const level = (rows, key) => ({ kit: 'isekai-meadow', seed: 2, grid: { tile: T, rows, ...(key ? { key } : {}) } });
const law = (P, name) => P.map.laws.find((l) => l.law === name);

describe('the glyph map\'s page', () => {
  it('composes every tile into one page, each at its square, and its laws hold', async () => {
    const P = await assembleGridScene({ level: level(['# #', '. #']) }, {}, { buildStage: tileStage((x, y) => 0.01 * x) });
    expect(P.map.cells).toHaveLength(4);
    // (the north-east tile's ground stands at its square: x from 24 to 48, y from −24 to 0)
    const ne = P.faces.filter((f) => f.group === 'isekai:ground' && f.corners.every((c) => c[0] >= 24 && c[1] >= -24));
    expect(ne.length).toBeGreaterThan(0);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    // the map is closed: walls on its four sides, a rim beyond
    expect(P.colliders.filter((c) => /^map:edge:/.test(c.of))).toHaveLength(4);
    expect(P.faces.some((f) => f.group === 'map:rim')).toBe(true);
    // the walk starts at the first path end
    expect(P.walk.spawn[0]).toBeCloseTo(12, 5); expect(P.walk.spawn[1]).toBeCloseTo(-12, 5);
  });

  it('the laws see a seam that does not meet and a wall across a path', async () => {
    // (each tile's own height: the west tile a metre lower than the east one at their shared edge)
    const stepped = await assembleGridScene({ level: level(['# #']) }, {}, { buildStage: async (m) => (await tileStage(() => (m.tile.origin[0] > 0 ? 1 : 0))(m)) });
    expect(law(stepped, 'seams').ok).toBe(false);
    // a wall standing across the east tile's path
    const walled = await assembleGridScene({ level: level(['# #']) }, {}, { buildStage: tileStage(() => 0, (m) => (m.tile.origin[0] > 0 ? { colliders: [{ min: [8, 0, -1], max: [9, 24, 4] }] } : {})) });
    expect(law(walled, 'paths-clear').ok).toBe(false);
    expect(law(walled, 'paths-clear').value).toMatch(/row 1 column 2/);
  });
});
