import { describe, it, expect } from 'vitest';
import {
  lattice, address, cellAt, step, shift, ray, rotate, mirror, orbit, distance, euler, latticeLaws, columnName,
} from './lattice.js';
import { latticeSvg } from './lattice-svg.js';
import { latticeFaces, latticeSceneHtml } from './lattice-css3d.js';

const names = (L, list) => list.map((i) => L.cells[i].name);

// One board per procedure: the square, and a hex in each orientation (rectangle and hexagon of hexes).
const BOARDS = {
  square: { shape: 'square', cols: 8, rows: 8 },
  pointy: { shape: 'hex', radius: 2 },
  flat: { shape: 'hex', orient: 'flat', cols: 5, rows: 4 },
};

describe('lattice: the relations hold', () => {
  for (const [label, spec] of Object.entries(BOARDS)) {
    it(`${label}: neighbours answer back, edges join their corners, aliases resolve`, () => {
      expect(latticeLaws(lattice(spec))).toEqual([]);
    });
  }

  it('counts the board games know: a chessboard, and the nineteen hexes of a settlers island', () => {
    const chess = lattice(BOARDS.square);
    expect([chess.cells.length, chess.corners.length, chess.edges.length]).toEqual([64, 81, 144]);
    const island = lattice(BOARDS.pointy);
    expect([island.cells.length, island.corners.length, island.edges.length]).toEqual([19, 54, 72]);
    // A hex's six corners and six edges; an inland corner meets three cells, a rim corner one or two.
    const mid = island.cells[cellAt(island, 'C3')];
    expect(mid.k).toHaveLength(6);
    expect(new Set(mid.k.map((k) => island.corners[k].cells.length))).toEqual(new Set([3]));
    expect(Math.min(...island.corners.map((c) => c.cells.length))).toBe(1);
  });

  it('Euler: corners - edges + cells is 1 for a board in one piece, one less for each hole', () => {
    for (const spec of Object.values(BOARDS)) expect(euler(lattice(spec))).toBe(1);
    expect(euler(lattice({ shape: 'square', cols: 3, rows: 3, omit: ['B2'] }))).toBe(0);
    expect(euler(lattice({ shape: 'hex', radius: 2, omit: ['C3'] }))).toBe(0);
  });

  it('heights[r][c] with null carves the board, rows from the south', () => {
    const L = lattice({ shape: 'square', heights: [[0, 1, null], [2, null, 0]] });
    expect(L.cells.map((c) => `${c.name}:${c.h}`)).toEqual(['A1:0', 'B1:1', 'A2:2', 'C2:0']);
    expect(L.cells[cellAt(L, 'A2')].at[2]).toBe(0.5);
    // A corner stands as high as the highest cell it touches.
    expect(L.corners[address(L, 'A1.ne').i].at[2]).toBe(0.5);
  });

  it('refuses a board it cannot lay', () => {
    expect(() => lattice({ shape: 'triangle', cols: 2, rows: 2 })).toThrow(/square' or 'hex/);
    expect(() => lattice({ shape: 'square', radius: 2 })).toThrow(/hexagon of hexes/);
    expect(() => lattice({ shape: 'square' })).toThrow(/cols and rows/);
    expect(() => lattice({ shape: 'square', cols: 1, rows: 1, omit: ['A1'] })).toThrow(/every cell/);
  });
});

describe('lattice: names and addresses', () => {
  it('names a cell by column letter and row number; a corner or edge by any cell touching it', () => {
    expect([0, 25, 26, 27].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB']);
    const L = lattice(BOARDS.square);
    expect(address(L, 'C4')).toEqual({ kind: 'cell', i: cellAt(L, 'C4') });
    // The corner north-east of B2 is north-west of C2, south-east of B3, south-west of C3.
    const k = address(L, 'B2.ne');
    expect(k.kind).toBe('corner');
    for (const alias of ['C2.nw', 'B3.se', 'C3.sw']) expect(address(L, alias)).toEqual(k);
    expect(L.corners[k.i].name).toBe('B2.ne');
    // An edge: B2's north is B3's south.
    expect(address(L, 'B2.n')).toEqual(address(L, 'B3.s'));
    expect(address(L, 'B2.n').kind).toBe('edge');
    expect(address(L, 'Z9')).toBeNull();
  });

  it('a hex names its corners and edges by different ways (pointy: n is a corner, ne an edge)', () => {
    const L = lattice(BOARDS.pointy);
    expect(address(L, 'C3.n').kind).toBe('corner');
    expect(address(L, 'C3.ne').kind).toBe('edge');
    const F = lattice(BOARDS.flat);
    expect(address(F, 'B2.n').kind).toBe('edge');
    expect(address(F, 'B2.e').kind).toBe('corner');
  });
});

describe('lattice: moving on it', () => {
  it('a ray slides until the board ends; step and shift agree with the ways', () => {
    const L = lattice(BOARDS.square), a1 = cellAt(L, 'A1');
    expect(names(L, ray(L, a1, 'NE'))).toEqual(['B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8']);
    expect(names(L, ray(L, cellAt(L, 'D4'), 'W'))).toEqual(['C4', 'B4', 'A4']);
    expect(step(L, a1, 'S')).toBe(-1);
    expect(L.cells[step(L, a1, 'N')].name).toBe('A2');
    expect(L.cells[shift(L, a1, [1, 2])].name).toBe('B3');
    expect(ray(L, a1, [0, 0])).toEqual([]);
    expect(() => ray(L, a1, 'ENE')).toThrow(/no way 'ENE'/);
  });

  it('a ray stops at a hole', () => {
    const L = lattice({ shape: 'square', cols: 5, rows: 1, omit: ['C1'] });
    expect(names(L, ray(L, cellAt(L, 'A1'), 'E'))).toEqual(['B1']);
  });

  it('turns and mirrors: a full turn is the identity, a mirror undoes itself', () => {
    for (const spec of Object.values(BOARDS)) {
      const L = lattice(spec), v = [2, 1];
      expect(rotate(L, v, L.dirs.length)).toEqual(v);
      expect(mirror(L, mirror(L, v))).toEqual(v);
      // A turn carries each way to the next, and a mirror to its reflection across N-S.
      L.dirs.forEach((d) => {
        expect(rotate(L, d.v)).toEqual(L.dirs[d.rot].v);
        expect(mirror(L, d.v)).toEqual(L.dirs[d.mirror].v);
      });
      L.diags.forEach((d) => expect(rotate(L, d.v)).toEqual(L.diags[d.rot].v));
    }
  });

  it('an orbit is a piece\'s moves from one vector: a knight is eight, a rook four, a hex step six', () => {
    const L = lattice(BOARDS.square);
    expect(orbit(L, [1, 2])).toHaveLength(8);
    expect(orbit(L, [1, 2], { reflect: false })).toHaveLength(4);
    expect(orbit(L, 'N')).toEqual([[0, 1], [-1, 0], [0, -1], [1, 0]]);
    // The knight from D4 reaches its eight squares.
    const d4 = cellAt(L, 'D4');
    expect(names(L, orbit(L, [1, 2]).map((v) => shift(L, d4, v))).sort()).toEqual(['B3', 'B5', 'C2', 'C6', 'E2', 'E6', 'F3', 'F5']);
    const H = lattice(BOARDS.pointy);
    expect(orbit(H, 'E')).toHaveLength(6);
    expect(orbit(H, [1, 2])).toHaveLength(12);
    expect(new Set(orbit(H, 'E').map((v) => H.dirs.findIndex((d) => d.v[0] === v[0] && d.v[1] === v[1]))).size).toBe(6);
  });

  it('distance in steps: a square with or without diagonals, a hex across its edges', () => {
    const L = lattice(BOARDS.square);
    expect(distance(L, cellAt(L, 'A1'), cellAt(L, 'C4'))).toBe(5);
    expect(distance(L, cellAt(L, 'A1'), cellAt(L, 'C4'), { diagonal: true })).toBe(3);
    const H = lattice(BOARDS.pointy), mid = cellAt(H, 'C3');
    const ring = H.cells.map((_, i) => distance(H, mid, i));
    expect([0, 1, 2].map((n) => ring.filter((d) => d === n).length)).toEqual([1, 6, 12]);
  });
});

describe('lattice: the same board twice is the same bytes', () => {
  it('the record, the SVG plan and the CSS3D page', () => {
    const spec = { shape: 'hex', radius: 2, heights: { C3: 2, B3: 1 } };
    const [a, b] = [lattice(spec), lattice(spec)];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const show = { corners: true, edges: true, highlight: { cells: ['C3'], corners: ['C3.n'], edges: ['C3.ne'] } };
    expect(latticeSvg(a, show)).toBe(latticeSvg(b, show));
    expect(latticeSceneHtml(a)).toBe(latticeSceneHtml(b));
  });
});

describe('lattice views', () => {
  it('the plan draws a polygon a cell; corners and edges only when asked or highlighted', () => {
    const L = lattice(BOARDS.pointy);
    const plain = latticeSvg(L);
    expect(plain.match(/<polygon /g)).toHaveLength(19);
    expect(plain).not.toMatch(/<circle|<line/);
    const lit = latticeSvg(L, { highlight: { corners: ['C3.n'], edges: ['C3.ne'] } });
    expect(lit.match(/<circle /g)).toHaveLength(1);
    expect(lit.match(/<line /g)).toHaveLength(1);
    expect(latticeSvg(L, { corners: true, edges: true }).match(/<circle /g)).toHaveLength(54);
  });

  it('CSS3D: a top a cell, a side only where a cell stands above what is next to it', () => {
    const flat = lattice({ shape: 'square', cols: 3, rows: 3 });
    const faces = latticeFaces(flat);
    expect(faces.filter((f) => f.group.startsWith('cell:'))).toHaveLength(9);
    // Level ground: sides only round the rim, down to the slab.
    expect(faces.filter((f) => f.group.startsWith('side:'))).toHaveLength(12);
    const raised = lattice({ shape: 'square', cols: 3, rows: 3, heights: { B2: 2 } });
    expect(latticeFaces(raised).filter((f) => f.group.startsWith('side:'))).toHaveLength(16);
    // A hex top is clipped to its hexagon.
    expect(latticeFaces(lattice(BOARDS.pointy)).filter((f) => f.clip)).toHaveLength(19);
  });
});
