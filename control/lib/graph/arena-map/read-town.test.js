// A TOWN OR A CITY, CUT AS AN ARENA MAP (read-town.js). One case a procedure: a town's block (masses on streets), a
// city's industry (masses, rounds and a fence) and a city's shore (water), each chosen from its table in code. The
// concepts: the cut is a window of the design on the arena grid, one level, walled where ground meets its edge; water
// is a cell with no floor that nothing stands in and a line crosses; the arena is one ground; the reading repeats; the
// generator grows a cut with what it is made of kept; the ground draws water and keeps a body out of it.
import { describe, expect, it } from 'vitest';
import { readTownMap, readCityMap, readGroundMap, CITY_ONS, CUT } from './read-town.js';
import { CELL } from './blocks.js';
import { indexMap, sees } from './map.js';
import { mapLaws } from './laws.js';
import { growArenaMap } from './generate.js';
import { mapGround } from './ground.js';
import { designGeocity } from '../geocity/design.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';
import { WATERFRONT_KINDS } from '../geocity/waterfront.js';
import { SEGMENTS } from '../geotown/pattern.js';

const held = (M, id) => mapLaws(M).laws.find((l) => l.law === id).holds;
const keyOf = (c) => c.join(',');
// (a block segment with a main street: shops in a row, an alley, houses behind)
const MAIN = Object.keys(SEGMENTS).find((s) => SEGMENTS[s].main);
const CITY = designGeocity({}, { seed: 1 });
const blocks = CITY.regions.flatMap((r) => r.blocks ?? []);
// (an industrial segment this metro has a block of; a shore segment its main shore has)
const WORKS = INDUSTRY_SEGMENTS.find((k) => blocks.some((b) => b.kind === k));
const SHORE = WATERFRONT_KINDS.find((k) => (CITY.waterfront ?? []).find((w) => w.main)?.segments.some((g) => g.kind === k));

describe('the rasteriser', () => {
  const G = { bounds: [0, 0, 30, 30], masses: [{ rect: [6, 6, 12, 12], h: 6, what: 'hut' }, { rect: [18, 18, 21, 21], h: 0.5, what: 'kerb' }], rounds: [{ at: [22.5, 7.5], r: 1.6, h: 10, what: 'tank' }], wet: (x, y) => y > 24 };
  const M = readGroundMap(G, { cut: [0, 0, 30, 30] });
  it('classes each cell: a mass taller than an eye a solid, water a cell with no floor, the rest floor; a low thing is said and left out', () => {
    expect([M.nx, M.ny, M.nz]).toEqual([10, 10, 1]);
    expect(M.solids.map(keyOf).sort()).toEqual(['2,2,0', '2,3,0', '3,2,0', '3,3,0', '7,2,0'].sort());
    expect(M.read.water).toHaveLength(20);
    const floor = new Set(M.floors.map(keyOf));
    for (const w of M.read.water) expect(floor.has(keyOf(w))).toBe(false);
    expect(floor.has('6,6,0')).toBe(true);
    expect(M.read.notes.join(' ')).toMatch(/lower than an eye/);
    expect(M.read.share.floor + M.read.share.mass + M.read.share.water).toBeCloseTo(1, 2);
  });
  it('walls the cut where ground meets its edge and nowhere over water; nothing stands in water and a line crosses it', () => {
    expect(held(M, 'bounded')).toBe(true);
    expect(M.walls.some((w) => w.at[1] >= 8)).toBe(false);
    const I = indexMap(M);
    expect(I.standable(4, 9, 0)).toBe(false);
    // (two places on one shore see each other across a bay of water between them)
    const B = readGroundMap({ bounds: [0, 0, 30, 12], wet: (x, y) => x > 9 && x < 21 && y > 3 }, { cut: [0, 0, 30, 12] });
    expect(sees(indexMap(B), [1, 3, 0], [8, 3, 0])).toBe(true);
    expect(indexMap(B).standable(5, 3, 0)).toBe(false);
  });
  it('keeps one ground: a court no way leads to is read as mass, and a fence is a low wall that keeps the larger side', () => {
    const ring = { bounds: [0, 0, 30, 30], masses: [{ rect: [9, 9, 21, 12], h: 6 }, { rect: [9, 18, 21, 21], h: 6 }, { rect: [9, 9, 12, 21], h: 6 }, { rect: [18, 9, 21, 21], h: 6 }] };
    const R = readGroundMap(ring, { cut: [0, 0, 30, 30] });
    expect(R.solids.map(keyOf)).toContain('4,4,0');
    expect(R.read.notes.join(' ')).toMatch(/no way leads to/);
    expect(held(R, 'connected')).toBe(true);
    const F = readGroundMap({ bounds: [0, 0, 30, 30], fences: [[0, 0, 12, 30]] }, { cut: [0, 0, 30, 30] });
    expect(F.walls.some((w) => w.kind === 'low')).toBe(false);          // (the far side closed: no fence left between two grounds)
    expect(F.solids.length).toBe(4 * 10);
    expect(F.read.notes.join(' ')).toMatch(/far side of a fence/);
  });
  it('picks the window with the most edge when none is named, and takes a named one as written', () => {
    const wide = { bounds: [0, 0, 90, 30], masses: [{ rect: [66, 9, 72, 15], h: 6 }, { rect: [75, 18, 81, 24], h: 6 }] };
    const P = readGroundMap(wide, { size: 30 });
    expect(P.read.picked).toBe(true);
    expect(P.read.cut[0]).toBeGreaterThanOrEqual(51);
    const N = readGroundMap(wide, { at: [15, 15], size: 30 });
    expect(N.read.picked).toBe(false);
    expect(N.read.cut).toEqual([0, 0, 30, 30]);
    expect(N.solids).toEqual([]);
  });
});

describe('a town\'s block', () => {
  const M = readTownMap({ segment: MAIN }, { seed: 1 });
  it(`(${MAIN}) is its buildings closed on its streets, alley and yards, a ${CUT} m window on one level`, () => {
    expect(M.nx).toBe(CUT / CELL);
    expect(M.nz).toBe(1);
    expect(M.read.water).toEqual([]);
    expect(M.read.share.mass).toBeGreaterThan(0.1);
    expect(M.read.share.floor).toBeGreaterThan(0.4);
    expect(held(M, 'bounded') && held(M, 'connected')).toBe(true);
    expect(readTownMap({ segment: MAIN }, { seed: 1 })).toEqual(M);
  });
});

describe('a city\'s cuts', () => {
  it(`(${WORKS}) industry is its block's own plan: masses, in a cut of one ground`, () => {
    const M = readCityMap({}, { seed: 1, on: WORKS, design: CITY });
    expect(M.read.masses).toBeGreaterThan(0);
    expect(M.solids.length).toBeGreaterThan(0);
    expect(held(M, 'bounded') && held(M, 'connected')).toBe(true);
    expect(readCityMap({}, { seed: 1, on: WORKS, design: CITY })).toEqual(M);
  });
  it(`(${SHORE}) a shore is ground out to its edge and water past it`, () => {
    const M = readCityMap({}, { seed: 1, on: SHORE, design: CITY, size: 36 });
    expect(M.read.share.water).toBeGreaterThan(0.2);
    expect(M.read.share.floor).toBeGreaterThan(0.2);
    expect(held(M, 'bounded') && held(M, 'connected')).toBe(true);
  });
  it('is held to a row of a closed table, and says what the city has when it has none', () => {
    expect(CITY_ONS).toEqual([...INDUSTRY_SEGMENTS, ...WATERFRONT_KINDS]);
    expect(() => readCityMap({}, { on: 'forest', design: CITY })).toThrow(/held to one of/);
  });
});

describe('a cut, grown', () => {
  const M = readCityMap({}, { seed: 1, on: SHORE, design: CITY, size: 36 }), G = growArenaMap({ map: M, seed: 1, passes: 400 });
  it('holds more of the laws than it was read with, and is never cut in two or opened', () => {
    expect(G.template).toBe('given');
    expect(G.held).toBeGreaterThan(mapLaws(M).held);
    expect(G.laws.find((l) => l.law === 'connected').holds && G.laws.find((l) => l.law === 'bounded').holds).toBe(true);
  });
  it('keeps what the place is made of: every mass, and no floor laid or pillar stood on its water', () => {
    const solid = new Set(G.map.solids.map(keyOf)), floor = new Set(G.map.floors.map(keyOf));
    for (const c of M.solids) expect(solid.has(keyOf(c))).toBe(true);
    for (const c of M.read.water) { expect(floor.has(keyOf(c))).toBe(false); expect(solid.has(keyOf(c))).toBe(false); }
    expect(G.map.read.water).toEqual(M.read.water);
    expect(growArenaMap({ map: M, seed: 1, passes: 400 }).map).toEqual(G.map);
  });
  it('is laid as ground with its water drawn under the floor\'s level and a kerb kept over it', () => {
    const L = mapGround(G.map), wet = L.faces.filter((f) => f.group === 'map:water');
    expect(wet).toHaveLength(M.read.water.length);
    expect(wet.every((f) => f.corners.every((c) => c[2] < 0))).toBe(true);
    const [i, j] = M.read.water[0];
    expect(L.colliders.some((c) => c.min[0] === i * CELL && c.min[1] === j * CELL && c.max[2] > 0.3 && c.max[2] < 1.2)).toBe(true);
    // (a map with no water lays not one face or collider more)
    expect(mapGround({ ...G.map, read: { ...G.map.read, water: [] } }).faces.length).toBe(L.faces.length - wet.length);
  });
});
