// Set-piece kinds: a set piece said in words, its site and its set piece laid by the kind's card
import { describe, it, expect } from 'vitest';
import { layKind, readKindWords, siteOf, SET_PIECE_KIND_IDS } from './set-piece-kinds.js';
import { setPieceLaws } from './set-piece.js';

describe('a set piece\'s kind', () => {
  it('lays a set piece that passes its laws, on blocks under its line', () => {
    for (const kind of SET_PIECE_KIND_IDS) {
      const K = layKind(kind);
      expect(setPieceLaws(K.setPiece).filter((l) => !l.ok), kind).toEqual([]);
      // the start stands on a block, at the set piece's height
      expect(K.blocks.some((b) => K.start[0] >= b.x[0] && K.start[0] <= b.x[1] && K.start[1] >= b.y[0] && K.start[1] <= b.y[1] && b.z[1] === K.start[2]), kind).toBe(true);
    }
  });
  it('takes its words, and teaches on one it does not', () => {
    expect(readKindWords('collapse', { courses: 3 })).toMatchObject({ courses: 3, height: 6, id: 'collapse' });
    expect(layKind('rooftop-run', { pursuers: 0, blast: false }).setPiece).not.toHaveProperty('pursuers');
    expect(() => readKindWords('heist')).toThrow(/rooftop-run, collapse, climb/);
    expect(() => readKindWords('climb', { courses: 3 })).toThrow(/not its word/);
    expect(() => readKindWords('climb', { face: 40 })).toThrow(/face is 3–14/);
  });
  it('a breakable block\'s faces are its own, and it is no collider', () => {
    const S = siteOf([{ id: 'slab', x: [0, 2], y: [0, 2], z: [3, 4], breaks: true }, { id: 'floor', x: [0, 2], y: [0, 2], z: [0, 1] }]);
    expect(S.breakables).toEqual([{ id: 'slab', min: [0, 0, 3], max: [2, 2, 4], hp: 6 }]);
    expect(S.colliders).toEqual([{ min: [0, 0, 0], max: [2, 2, 1] }]);
    expect(S.faces.filter((f) => f.node === 'slab').length).toBe(6);   // (a floating block's underside too)
  });
});
