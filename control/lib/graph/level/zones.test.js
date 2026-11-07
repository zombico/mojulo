import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { readPlan, fillSegment } from './plan.js';
import { zoneOf, readZone, ZONE } from './zones.js';
import { assembleGridScene } from './grid-scene.js';
import { levelHeight } from '../era/out-tile.js';

// THE WORLD MAP: a planned map built a segment a page. Four segments of 3 × 3 tiles: the town (A) east to the fields (B),
// south to the keep (D); the woods (C) off the walk, joined to the town and the keep. Each a zone, crossed at its gates.
const T = 24;
const plan = {
  size: 3, rows: ['A B', 'C D'], route: ['A', 'B', 'D'], joins: [['A', 'C'], ['C', 'D']],
  key: { A: { name: 'the town' }, B: { name: 'the fields', rise: 2 }, C: { name: 'the woods' }, D: { name: 'the keep', rise: 4, goal: { use: 'temple' } } },
};
const grid = { tile: T, plan };
const level = (zone, more = {}) => ({ kit: 'isekai-meadow', seed: 5, grid, ...(zone ? { zone } : {}), ...more });
// (a stand-in tile: its ground on the level's one land, in its own frame, 4 m a cell)
const tileStage = async (m) => {
  const [ox, oy] = m.tile.origin, L = m.tile.level, faces = [];
  const z = (x, y) => Math.round(levelHeight(ox + x, oy + y, L) * 1e5) / 1e5;
  for (let x = 0; x < T; x += 4) for (let y = 0; y < T; y += 4) faces.push({ corners: [[x, y, z(x, y)], [x + 4, y, z(x + 4, y)], [x + 4, y + 4, z(x + 4, y + 4)], [x, y + 4, z(x, y + 4)]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' });
  return { faces, walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 } };
};

describe('a plan\'s joins', () => {
  it('lays a gate between neighbours off the walk, reaches a segment by them, and fills it gate to gate', () => {
    const P = readPlan(plan);
    expect(P.gates.filter((g) => g.join).map((g) => [g.from, g.to, g.side])).toEqual([['A', 'C', 's'], ['C', 'D', 'e']]);
    expect(P.ways).toEqual({ A: { e: 'B', s: 'C' }, B: { w: 'A', s: 'D' }, C: { n: 'A', e: 'D' }, D: { n: 'B', w: 'C' } });
    // (off the walk: a pocket)
    expect(P.roles).toEqual({ A: 'arrival', B: 'passage', D: 'climax', C: 'pocket' });
    // (its fill: an arm from its middle to each gate, north and east)
    expect(fillSegment(P, 'C').rows).toEqual(['. # .', '. # #', '. . .']);
    // (a written segment holds every gate, the joins' too)
    expect(() => readGrid({ ...grid, segments: { C: { rows: ['. # .', '. # .', '. . .'] } } })).toThrow(/gate on the east side/);
  });

  it('refuses a join that is no pair of neighbours, or one already joined, and a segment nothing reaches', () => {
    const P = (p) => () => readPlan({ ...plan, ...p });
    expect(P({ joins: [['A', 'D']] })).toThrow(/do not share a side/);
    expect(P({ joins: [['B', 'A']] })).toThrow(/already joined/);
    expect(P({ joins: [['A', 'X']] })).toThrow(/'X' is not a segment/);
    expect(P({ joins: undefined })).toThrow(/never reaches 'C'.*joins/);
  });
});

describe('a zone of the world map', () => {
  it('has its square, its apron, its ways and where its page sets out', () => {
    const G = readGrid(grid), B = zoneOf(G, 'B', { seed: 5 }), A = zoneOf(G, 'A', { seed: 5 });
    expect(B.at).toEqual([0, 3]);
    expect(B.own.size).toBe(9);
    // (a tile out from its square, within the map: rows 0–3, columns 2–5)
    expect(B.built.size).toBe(16);
    expect(B.ways.map((w) => [w.side, w.to])).toEqual([['s', 'D'], ['w', 'A']]);
    // A GATE IS ONE POINT ON BOTH PAGES: the crossing the same, each side's exit and arrival in its own square, on one land
    const ab = A.ways.find((w) => w.to === 'B'), ba = B.ways.find((w) => w.to === 'A');
    expect(ab.cross).toEqual(ba.cross);
    expect(ab.cross).toEqual([72, -36]);
    expect(ab.exit[0]).toBeCloseTo(72 - ZONE.exitIn); expect(ba.exit[0]).toBeCloseTo(72 + ZONE.exitIn);
    expect(ba.arrive[0]).toBeCloseTo(72 + ZONE.arriveIn);
    expect(ba.arrive[2]).toBeCloseTo(levelHeight(ba.arrive[0], ba.arrive[1], { seed: 5, rise: G.rise }), 2);
    // (facing in: B's west way faces east)
    expect(ba.heading).toBeCloseTo(0);
    // (the town holds the map's start; the fields set out where the walk comes in, from the town)
    expect(A.spawn.heading).toBeNull();
    expect(B.spawn).toMatchObject({ at: ba.arrive, heading: ba.heading });
    // (the word read)
    expect(readZone(level('B'))).toEqual({ id: 'B', apron: 1 });
    expect(() => readZone({ grid: { rows: ['#'] }, zone: 'A' })).toThrow(/planned map/);
    expect(() => readZone({ ...level('B'), apron: 5 })).toThrow(/apron is 0 to 2/);
    expect(() => zoneOf(G, 'Q')).toThrow(/no segment/);
  });

  it('builds a segment as its own page: its tiles and apron, walls open at its gates, its laws holding', async () => {
    const P = await assembleGridScene({ level: level('B') }, {}, { buildStage: tileStage });
    expect(P.map.cells).toHaveLength(16);
    expect(P.map.zone).toMatchObject({ id: 'B', at: [0, 3], size: 3, box: [72, -72, 144, 0] });
    expect(P.map.zone.ways.map((w) => w.to)).toEqual(['D', 'A']);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    expect(P.map.laws.find((l) => l.law === 'zone-ways').value).toMatch(/2 ways out: s to D, w to A/);
    // (the walls stand on its square's border, broken at each gate: none over a crossing)
    const walls = P.colliders.filter((c) => /^zone:edge/.test(c.of));
    for (const w of P.map.zone.ways) expect(walls.some((b) => w.cross[0] >= b.min[0] && w.cross[0] <= b.max[0] && w.cross[1] >= b.min[1] && w.cross[1] <= b.max[1])).toBe(false);
    expect(walls.length).toBe(6);
    // (set down at its way in from the town)
    expect(P.walk.spawn[0]).toBeCloseTo(78);
  });

  it('lays the same ground at a border on both pages: the seam is the plan\'s', async () => {
    const [A, B] = await Promise.all(['A', 'B'].map((z) => assembleGridScene({ level: level(z) }, {}, { buildStage: tileStage })));
    // (the tile across the gate, B's own, is A's apron: its ground the same faces on both pages)
    const tileFaces = (P, x0) => P.faces.filter((f) => f.group === 'isekai:ground' && f.corners.every((c) => c[0] >= x0 - 0.01 && c[0] <= x0 + T + 0.01 && c[1] <= -24 + 0.01 && c[1] >= -48 - 0.01)).map((f) => f.corners);
    expect(tileFaces(A, 72).length).toBeGreaterThan(0);
    expect(tileFaces(A, 72)).toEqual(tileFaces(B, 72));
  });

  it('asks a homely inside for its places: the town\'s house furnished as a town\'s, never a crypt\'s stone rooms', async () => {
    const seen = [];
    await assembleGridScene({ level: { ...level('A'), grid: { ...grid, segments: { A: { rows: ['. . .', 'h # #', '. # .'], key: { h: { use: 'dwelling' } } } } } } }, {}, { buildStage: async (m) => { seen.push(m); return tileStage(m); } });
    const house = seen.flatMap((m) => m.buildings ?? []);
    expect(house).toEqual([expect.objectContaining({ use: 'dwelling', homely: true })]);
  });

  it('builds several segments as one page: the gate between them road, walls round their whole outline, its laws holding', async () => {
    const P = await assembleGridScene({ level: level(['A', 'B']) }, {}, { buildStage: tileStage });
    // (the town and the fields, 18 tiles, and the ring of the rest round them: rows 0–3, columns 0–5)
    expect(P.map.cells).toHaveLength(24);
    expect(P.map.zone).toMatchObject({ id: 'A+B', box: [0, -72, 144, 0] });
    expect(P.map.zone.ways.map((w) => `${w.side}:${w.to}`).sort()).toEqual(['s:C', 's:D']);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    // (no wall across the road between them, at the town's east edge, x = 72)
    expect(P.colliders.filter((c) => /^zone:edge/.test(c.of)).some((c) => c.min[0] <= 72 && c.max[0] >= 72 && c.min[1] <= -36 && c.max[1] >= -36)).toBe(false);
    expect(() => readZone({ ...level(null), zone: ['A', 'A'] })).toThrow(/a list of segments/);
  });

  it('leaves a map with no zone as it was: the whole map on one page', async () => {
    const P = await assembleGridScene({ level: level(null) }, {}, { buildStage: tileStage });
    expect(P.map.cells).toHaveLength(36);
    expect(P.map.zone).toBeUndefined();
    expect(P.colliders.filter((c) => /^map:edge/.test(c.of))).toHaveLength(4);
  });
});
