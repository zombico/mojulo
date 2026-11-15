// A MAP'S CLIFFS (map-cliffs.js, era/out-tile.js riseAt): a cliff is where the land steps and nobody walks. The concept
// on one small map: a scarp between two terraces that stand apart with no way between them, none where a way crosses,
// the land one height everywhere, and a rise with no scarps read exactly as it always was.
import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { levelGrid } from './map-sketch.js';
import { mapScarps, MAP_CLIFF } from './map-cliffs.js';
import { riseAt, SCARP } from '../era/out-tile.js';

// two blocks of 3 × 3 side by side: the low one and, east of it, one three steps (9 m) up; the walk crosses between them
const plan = { size: 3, rows: ['A B'], route: ['A', 'B'] };
const level = (cliffs, hi = '3') => ({ grid: { tile: 24, plan }, sketch: { ...(cliffs ? { cliffs: true } : {}), segments: {
  A: { status: 'approved', height: ['0 0 0', '0 0 0', '0 0 0'] },
  B: { status: 'approved', height: [`${hi} ${hi} ${hi}`, `1 2 ${hi}`, `${hi} ${hi} ${hi}`] } } } });

describe('a map\'s cliffs', () => {
  it('a scarp stands between two tiles that step apart with no way across, and never across a way', () => {
    const G = levelGrid(level(true)), S = G.rise.scarps, k = (r, c) => r * G.cols + c;
    // (the seam between the blocks: a cliff north and south of the gate, none at the gate the walk crosses by)
    expect([S.e[k(0, 2)], S.e[k(1, 2)], S.e[k(2, 2)]]).toEqual([1, 0, 1]);
    // (the way's own cutting: the terrace over it on both sides of its low tile)
    expect([S.s[k(0, 3)], S.s[k(1, 3)]]).toEqual([1, 1]);
    expect(G.sketch.laid.cliffs).toBe(mapScarps(G, G.rise).count);
    // (a step under a cliff's is a slope, as it was)
    expect(levelGrid(level(true, '1')).rise.scarps).toBeUndefined();
    expect(MAP_CLIFF.drop).toBeGreaterThan(3);
  });

  it('the land holds each terrace to the edge and steps there, and stays one height across it', () => {
    const G = levelGrid(level(true)), R = G.rise, T = R.tile, y = -0.5 * T, edge = 3 * T;
    // (well short of the edge the low terrace, well past it the high one: no long ramp across both tiles)
    const reach = SCARP.face / 2 + SCARP.wander + 0.1;
    expect(riseAt(edge - reach, y, R)).toBeCloseTo(0, 5);
    expect(riseAt(edge + reach, y, R)).toBeCloseTo(9, 5);
    // (continuous: no two points 5 cm apart stand more than the face's own slope apart)
    let worst = 0;
    for (let x = edge - 12; x < edge + 12; x += 0.05) for (const yy of [y, -0.99 * T, -1.01 * T, -1.5 * T]) worst = Math.max(worst, Math.abs(riseAt(x + 0.05, yy, R) - riseAt(x, yy, R)));
    expect(worst).toBeLessThan(9 * (0.05 / SCARP.face) * 2);
    // (at the gate the way keeps its eased climb: half way up its one step at the seam)
    expect(riseAt(edge, -1.5 * T, R)).toBeCloseTo(1.5, 1);
  });

  it('a sketch that asks no cliffs, and a rise with none, is read as it always was', () => {
    const plain = levelGrid(level(false)), asked = levelGrid(level(true));
    expect(plain.rise.scarps).toBeUndefined();
    expect(asked.rise.z).toEqual(plain.rise.z);
    const flat = levelGrid(level(true, '1'));
    expect(JSON.stringify(flat.rise)).toBe(JSON.stringify(levelGrid(level(false, '1')).rise));
    expect(() => levelGrid({ ...level(false), sketch: { cliffs: 'yes' } })).toThrow(/cliffs is true/);
    expect(mapScarps(readGrid({ tile: 24, plan }), null)).toBeNull();
  });
});
