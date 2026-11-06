import { describe, it, expect } from 'vitest';
import { readGrid, shapeOf, tileCentre, sideMiddle } from './grid.js';

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
    expect([cell(1, 2).shape, cell(1, 2).open]).toEqual(['X', ['n', 'e', 's', 'w']]);   // (the town blocks open onto it)
    expect([cell(2, 2).shape, cell(2, 2).open]).toEqual(['X', ['n', 'e', 's', 'w']]);   // the crossing
    expect([cell(2, 0).shape, cell(2, 0).open]).toEqual(['end', ['e']]);
    expect([cell(2, 1).shape, cell(2, 1).open]).toEqual(['T', ['n', 'e', 'w']]);   // (the town block north of it)
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
});
