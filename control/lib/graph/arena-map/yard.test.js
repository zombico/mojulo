// A YARD, DESIGNED PIECE BY PIECE (yard.js). One small yard with a thing stood on it. The concepts: a yard is made of
// pieces, never of cells (a container is its whole length of mass, a barrier a low wall on a line); what stood there
// is kept and the ground before the way out is left clear; it is fenced on three sides and walled on the fourth, and
// that bounds it; it is one ground; designed, it holds its laws no worse than it did empty; its lights stand over its
// prizes; the same seed designs the same yard and another seed another.
import { describe, expect, it } from 'vitest';
import { designYard, yardMap, yardAscii, towerCells, PIECES, YARD, TOWER } from './yard.js';
import { mapLaws } from './laws.js';
import { indexMap, sees } from './map.js';

const FIXED = [{ kind: 'walker', cells: [[5, 3], [6, 3], [5, 4], [6, 4]] }], ASK = { nx: 12, ny: 8, door: 3, fixed: FIXED, seed: 1, passes: 160 };
const held = (M, id) => mapLaws(M).laws.find((l) => l.law === id).holds;
const keyOf = (c) => `${c[0]},${c[1]}`;

describe('a yard\'s map', () => {
  const Y = { nx: 6, ny: 4, fixed: [], pieces: [{ kind: 'container-40', i: 1, j: 1, along: 'x', high: 1 }, { kind: 'container-20', i: 0, j: 2, along: 'y', high: 2 }, { kind: 'barrier', i: 4, j: 2, side: 'e' }] }, M = yardMap(Y), I = indexMap(M);
  it('is its pieces: a container its whole length of mass the way it lies, a barrier a low wall on its line', () => {
    expect(M.solids.map(keyOf).sort()).toEqual(['1,1', '2,1', '3,1', '4,1', '0,2', '0,3'].sort());
    expect(PIECES['container-40'].cells).toBe(4);
    expect(M.walls.find((w) => w.at[0] === 4 && w.at[1] === 2 && w.side === 'e')).toMatchObject({ kind: 'low' });
    // (a container stops a line; a barrier stops a body and not an eye's line)
    expect(sees(I, [2, 0, 0], [2, 2, 0])).toBe(false);
    expect(sees(I, [4, 2, 0], [5, 2, 0])).toBe(true);
    expect(I.adj.get('4,2,0').some((e) => e.to === '5,2,0')).toBe(false);
  });
  it('is fenced on three sides and walled by the building on the fourth: bounded, a rail being what stops a body', () => {
    const edge = (i, j, side) => M.walls.find((w) => w.at[0] === i && w.at[1] === j && w.side === side)?.kind;
    expect([edge(-1, 0, 'e'), edge(5, 0, 'e'), edge(0, -1, 'n'), edge(0, 3, 'n')]).toEqual(['low', 'low', 'low', 'full']);
    expect(held(M, 'bounded')).toBe(true);
    expect(held({ ...M, walls: M.walls.filter((w) => !(w.at[0] === -1 && w.at[1] === 0)) }, 'bounded')).toBe(false);
  });
});

describe('a yard, designed', () => {
  const D = designYard(ASK), empty = mapLaws(yardMap({ nx: ASK.nx, ny: ASK.ny, fixed: FIXED, pieces: [] }));
  it('keeps what stood there and the ground before its way out, and stays one ground', () => {
    const solid = new Set(D.map.solids.map(keyOf));
    for (const c of FIXED[0].cells) expect(solid.has(keyOf(c))).toBe(true);
    for (let j = ASK.ny - YARD.clear; j < ASK.ny; j++) for (let i = ASK.door - 1; i <= ASK.door + 1; i++) expect(solid.has(`${i},${j}`)).toBe(false);
    expect(D.laws.find((l) => l.law === 'connected').holds).toBe(true);
    expect(D.pieces.every((p) => PIECES[p.kind])).toBe(true);
    expect(D.pieces.some((p) => p.kind !== 'barrier')).toBe(true);
  });
  it('holds its laws no worse than the yard did empty, and stands its lights over its prizes, apart', () => {
    expect(D.held).toBeGreaterThanOrEqual(empty.held);
    expect(D.lights.length).toBeGreaterThan(0);
    expect(D.lights.length).toBeLessThanOrEqual(YARD.lights);
    const prizes = D.furnished.items.map((x) => keyOf(x.at));
    for (const l of D.lights) expect(prizes).toContain(keyOf(l));
    for (const a of D.lights) for (const b of D.lights) if (a !== b) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(YARD.apart);
  });
  it('is the seed\'s: the same seed the same yard, another seed another', () => {
    expect(designYard(ASK).pieces).toEqual(D.pieces);
    expect(designYard({ ...ASK, seed: 2 }).pieces).not.toEqual(D.pieces);
  });
}, 240000);

describe('a yard with a tower', () => {
  it('is high ground with two ways up, its stairs and their feet kept clear, and nothing of the yard cut off by it', () => {
    const T = { i: 6, j: 3 }, D = designYard({ nx: 14, ny: 8, door: 2, towers: [T], seed: 1, passes: 160 }), held = (id) => D.laws.find((l) => l.law === id).holds;
    expect(D.map.nz).toBe(2);
    expect(D.map.floors.filter((f) => f[2] === 1)).toHaveLength(TOWER.deck * TOWER.deck);
    expect(D.map.ramps).toHaveLength(2);
    expect(held('connected')).toBe(true);
    expect(held('levels-twice')).toBe(true);
    const keep = new Set(towerCells(T).map((c) => c.join(',')));
    for (const p of D.pieces.filter((q) => q.kind !== 'barrier')) for (let t = 0; t < PIECES[p.kind].cells; t++) expect(keep.has((p.along === 'y' ? [p.i, p.j + t] : [p.i + t, p.j]).join(','))).toBe(false);
    expect(yardAscii(D)).toMatch(/T/);
    expect(() => designYard({ nx: 14, ny: 8, towers: [{ i: 1, j: 3 }] })).toThrow(/does not stand in a yard/);
  }, 120000);
});
