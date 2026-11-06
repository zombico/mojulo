import { describe, it, expect } from 'vitest';
import { readGrid, shapeOf, tileCentre, sideMiddle } from './grid.js';
import { riseAt, levelHeight } from '../era/out-tile.js';

// THE GLYPH GRID: a map written as rows of glyphs, one square tile each. A path tile's shape is solved from its path
// neighbours (an end, an I, an L, a T, an X), never written; the paths are one network; tiles meet edge to edge.

const G = readGrid({
  tile: 48,
  rows: [
    '. . # . .',
    '. t # t .',
    '# # # # #',
    '. . # . .',
    '. . S . .',
  ],
  key: { t: { town: 'block' }, S: { building: 'shrine' } },
});
const cell = (r, c) => G.at(r, c);

describe('the glyph grid', () => {
  it('solves each path tile\'s shape from its neighbours', () => {
    expect([cell(0, 2).shape, cell(0, 2).open]).toEqual(['end', ['s']]);          // the path's north end
    // (the west block's door faces this street; the east block's two roads tie, and the first clockwise, south, wins)
    expect([cell(1, 2).shape, cell(1, 2).open]).toEqual(['T', ['n', 's', 'w']]);
    expect(cell(2, 3).open).toEqual(['n', 'e', 'w']);
    expect([cell(2, 2).shape, cell(2, 2).open]).toEqual(['X', ['n', 'e', 's', 'w']]);   // the crossing
    expect([cell(2, 0).shape, cell(2, 0).open]).toEqual(['end', ['e']]);
    expect([cell(2, 1).shape, cell(2, 1).open]).toEqual(['I', ['e', 'w']]);   // (the town block north of it faces the main road, not it)
    expect([cell(3, 2).shape, cell(3, 2).open]).toEqual(['I', ['n', 's']]);       // down to the shrine
    // the places: what the key says stands there, open toward the paths that reach them
    expect(cell(4, 2)).toMatchObject({ kind: 'place', place: { building: 'shrine' }, open: ['n'] });
    expect(cell(0, 0).kind).toBe('land');
  });

  it('names every shape by its open edges', () => {
    expect(['n'].map(() => shapeOf(['n']))[0]).toBe('end');
    expect(shapeOf(['n', 's'])).toBe('I');
    expect(shapeOf(['e', 'w'])).toBe('I');
    expect(shapeOf(['n', 'e'])).toBe('L');
    expect(shapeOf(['s', 'w'])).toBe('L');
    expect(shapeOf(['n', 'e', 'w'])).toBe('T');
    expect(shapeOf(['n', 'e', 's', 'w'])).toBe('X');
  });

  it('tiles meet edge to edge: a side\'s middle is the same point from both tiles', () => {
    expect(tileCentre(G, 0, 0)).toEqual([24, -24]);
    expect(sideMiddle(G, 2, 1, 'e')).toEqual(sideMiddle(G, 2, 2, 'w'));
    expect(sideMiddle(G, 1, 2, 's')).toEqual(sideMiddle(G, 2, 2, 'n'));
  });

  it('refuses paths that are not one network, a stray path, a place the key does not name, and ragged rows', () => {
    expect(() => readGrid({ rows: ['# . #', '# . #'] })).toThrow(/not one network/);
    expect(() => readGrid({ rows: ['. . .', '. # .', '. . .'] })).toThrow(/meets no other path/);
    expect(() => readGrid({ rows: ['# q'] })).toThrow(/'q' is a place the key does not name/);
    expect(() => readGrid({ rows: ['# #', '#'] })).toThrow(/all one width/);
    expect(() => readGrid({ rows: ['#  #'], tile: 8 })).toThrow(/tile is a tile's side/);
  });

  it('gives a place one door, toward its main road or where its key says, and no road runs into its back', () => {
    const H = readGrid({ rows: ['. # .', 'h # .', '# # .'], key: { h: { use: 'dwelling' } } });
    // (the house has paths east and south; the east one is the main road: its door faces it)
    expect(H.at(1, 0).open).toEqual(['e']);
    expect(H.at(2, 0).open).toEqual(['e']);   // (so the path below it does not turn up into its back)
    const D = readGrid({ rows: ['. # .', 'h # .', '# # .'], key: { h: { use: 'dwelling', door: 's' } } });
    expect(D.at(1, 0).open).toEqual(['s']);
    expect(D.at(2, 0).open).toEqual(['n', 'e']);
    expect(() => readGrid({ rows: ['h #'], key: { h: { door: 'n' } } })).toThrow(/opens its door n, where no path lies/);
  });

  it('lays a second layer of regions over the tiles: each tile its region, the rise one height across every seam', () => {
    const R = readGrid({ rows: ['# # #', '. . #'], regions: { rows: ['t t m', '. . m'], key: { t: { name: 'the town' }, m: { name: 'the meadows', rise: 12, biocube: { flora: {} } } } } });
    expect([R.at(0, 0).region, R.at(0, 2).region, R.at(1, 0).region]).toEqual(['t', 'm', undefined]);
    expect(R.rise.z).toEqual([0, 0, 12, 0, 0, 12]);
    // (level round a tile's middle, climbing between centres, and continuous: no step anywhere along a row)
    const T = R.tile, y = -T / 2;
    expect(riseAt(T * 2.5, y, R.rise)).toBeCloseTo(12, 6);
    expect(riseAt(T * 0.5, y, R.rise)).toBeCloseTo(0, 6);
    let worst = 0; for (let x = 0; x < T * 3; x += 0.25) worst = Math.max(worst, Math.abs(riseAt(x + 0.25, y, R.rise) - riseAt(x, y, R.rise)));
    expect(worst).toBeLessThan(0.15);
    expect(levelHeight(T * 2.5, y, { seed: 3, rise: R.rise }) - levelHeight(T * 2.5, y, { seed: 3 })).toBeCloseTo(12, 6);
    expect(() => readGrid({ rows: ['# #'], regions: { rows: ['t'], key: { t: {} } } })).toThrow(/the map's own shape/);
    expect(() => readGrid({ rows: ['# #'], regions: { rows: ['t q'], key: { t: {} } } })).toThrow(/'q' is a region the key does not name/);
    expect(() => readGrid({ rows: ['# #'], regions: { rows: ['t t'], key: { t: { trees: 3 } } } })).toThrow(/not a region's word/);
    expect(() => readGrid({ rows: ['# #'], regions: { rows: ['t t'], key: { t: { rise: 400 } } } })).toThrow(/rise is metres/);
  });
});
