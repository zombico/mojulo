import { describe, it, expect, vi } from 'vitest';
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

// THE RULES PASSED DOWN: what a stage's page says beyond its faces reaches the map's page, and what a stage has one
// of, a map has one of (a horizon a map, a hero tree a region), not one a tile.
describe('the map takes what a stage gives', () => {
  const two = { rows: ['a a', 'b b'], key: { a: { name: 'the town' }, b: { name: 'the meadows' } } };
  const levelR = (rows, regions) => ({ kit: 'isekai-meadow', seed: 2, grid: { tile: T, rows, regions } });

  it('names one hero tree a region and one horizon a map', async () => {
    const seen = [];
    await assembleGridScene({ level: levelR(['# #', '. #'], two) }, {}, { buildStage: async (m) => { seen.push(m.tile); return tileStage(() => 0)(m); } });
    // (the town's one bending tile holds its hero; the meadows have no straight or bending path, so none)
    expect(seen.filter((t) => t.hero).map((t) => t.origin)).toEqual([[T, -T]]);
    // (the first tile rings the map; every other tile lays no horizon of its own)
    expect(seen.filter((t) => t.backdrop !== false).map((t) => t.origin)).toEqual([[0, -T]]);
    // (but a place's tile keeps its far land: its building is seated on it)
    const placeSeen = [];
    await assembleGridScene({ level: level(['# h'], { h: { use: 'dwelling' } }) }, {}, { buildStage: async (m) => { placeSeen.push(m.tile); return tileStage(() => 0)(m); } });
    expect(placeSeen.find((t) => t.origin[0] === T).backdrop).toBeUndefined();
  });

  it('carries the soft groups, the cloud deck, the fauna and the trunks of every tile, on the level\'s frame', async () => {
    const b64 = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });
    const unb64 = (v) => { const b = Buffer.from(v.__b64, 'base64'); return new globalThis[v.t](b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
    const grid = { x0: 0, y0: 0, cell: 4, nx: 7, ny: 7, zlo: 0, zsc: 1e-6, z: b64(new Int16Array(49).fill(-32768)), m: b64(new Uint8Array(36).fill(1)) };
    const extra = (m) => {
      const east = m.tile.origin[0] > 0;
      return {
        soft: [east ? 'flora:brush' : 'isekai:soft'],
        ...(east ? {} : { effects: [{ kind: 'cloud-deck' }] }),
        liveGrass: { grid, cards: ['isekai:grass'], crowns: { groups: ['isekai:wood'], trunks: b64(Float32Array.from([1, 2, 0, 1, 2, 5, 0.3, 0.2])) } },
        fauna: { seed: 1, gnats: { colour: [1, 1, 1], per: 3, clouds: [[2, 3, 0]] } },
        faunaUnits: { entities: [{ id: 'fauna:deer:0:0', transform: { pos: [4, 5, 0], heading: 0 }, rule: { type: 'ai' }, body: { type: 'figure-rig', figure: 'fauna:deer' } }], figures: { 'fauna:deer': { species: 'deer' } } },
      };
    };
    const P = await assembleGridScene({ level: level(['# #']) }, {}, { buildStage: tileStage(() => 0, extra) });
    expect(P.soft).toEqual(['isekai:soft', 'flora:brush']);
    expect(P.effects).toEqual([{ kind: 'cloud-deck' }]);
    // (the east tile's swarm and herd moved by its square, x + 24; every unit its own name)
    expect(P.fauna.gnats.clouds).toEqual([[2, -21, 0], [26, -21, 0]]);
    expect(P.faunaUnits.entities.map((e) => e.transform.pos)).toEqual([[4, -19, 0], [28, -19, 0]]);
    expect(new Set(P.faunaUnits.entities.map((e) => e.id)).size).toBe(2);
    // (both tiles' trunks, each on the level's frame: the wood on the east tile is held by its own)
    const tr = Array.from(unb64(P.liveGrass.crowns.trunks));
    expect(tr).toHaveLength(16);
    expect(tr.slice(0, 2)).toEqual([1, -22]); expect(tr.slice(8, 10)).toEqual([25, -22]);
  });

  it('rings the map with its first tile\'s horizon, its heights scaled with its reach', async () => {
    // (a ring of ridges 30 m round the first tile's middle, 5 m tall: pushed out past the map, it stands taller by as much)
    const ridge = () => Array.from({ length: 16 }, (_, k) => { const a = (2 * Math.PI * k) / 16, b = (2 * Math.PI * (k + 1)) / 16, P = (t, z) => [12 + 30 * Math.cos(t), 12 + 30 * Math.sin(t), z]; return { corners: [P(a, 0), P(b, 0), P(b, 5), P(a, 5)], normal: [0, 0, 1], group: 'isekai:ridge', fill: '#556' }; });
    const build = async (m) => { const p = await tileStage(() => 0)(m); if (m.tile.origin[0] === 0) p.faces.push(...ridge()); return p; };
    const P = await assembleGridScene({ level: level(['# #']) }, {}, { buildStage: build });
    const R = P.faces.filter((f) => f.group === 'isekai:ridge');
    expect(R.length).toBeGreaterThan(0);
    const top = Math.max(...R.flatMap((f) => f.corners.map((c) => c[2]))), reach = Math.min(...R.flatMap((f) => f.corners.map((c) => Math.hypot(c[0] - 24, c[1] + 12))));
    expect(top / 5).toBeCloseTo(reach / 30, 1);
    expect(top).toBeGreaterThan(5);
  });

  it('builds each tile with the world\'s whole context, as the stage kind is built', async () => {
    const { WORLD_KINDS } = await import('../worlds/world-kinds.js');
    const spy = vi.spyOn(WORLD_KINDS.stage, 'resolve').mockImplementation((m) => tileStage(() => 0)(m));
    try {
      await WORLD_KINDS.map.resolve({ level: level(['# #']) }, { title: 'the valley', liveSun: true, unshaded: false, form: true });
      expect(spy).toHaveBeenCalledTimes(2);
      for (const [, ctx] of spy.mock.calls) expect(ctx).toMatchObject({ title: 'the valley', liveSun: true, form: true });
    } finally { spy.mockRestore(); }
  });

  it('stands the kit\'s hero tree only on the tile its map names, beside the path\'s middle and clear of the seams', async () => {
    const { isekaiTileCasters } = await import('../era/isekai.js');
    const tile = (more) => ({ kind: 'stage', kit: 'isekai-meadow', seed: 5, tile: { size: 48, open: ['n', 's'], origin: [0, -48], ...more } });
    const heroOf = (m) => isekaiTileCasters(m).trees.filter((t) => t.hero);
    expect(heroOf(tile())).toEqual([]);
    const [H] = heroOf(tile({ hero: true }));
    // (an I north to south: the hero beside its middle, its offset clear of every seam)
    expect(H.y).toBeCloseTo(24, 5);
    expect(Math.min(H.x, H.y, 48 - H.x, 48 - H.y)).toBeGreaterThan(5);
    // (a tile too small to hold one clear of its seams has none, named or not)
    expect(heroOf({ ...tile({ hero: true }), tile: { size: 12, open: ['n', 's'], origin: [0, -12], hero: true } })).toEqual([]);
  });

  it('refuses snow by name: no tile of a map lies on a polygon land yet', async () => {
    await expect(assembleGridScene({ level: { ...level(['# #']), snow: true } }, {}, { buildStage: tileStage(() => 0) })).rejects.toThrow(/the level says snow/);
    const snowy = { rows: ['a a'], key: { a: { name: 'the pass', snow: true } } };
    await expect(assembleGridScene({ level: levelR(['# #'], snowy) }, {}, { buildStage: tileStage(() => 0) })).rejects.toThrow(/region 'a' says snow/);
  });
});
