// A PLACE AS IT STANDS, READ AS AN ARENA MAP (read-colliders.js). The concepts, on the smallest place that shows each:
// a mass at a body's height is a solid; a wall thinner than a cell is a wall on the edge it stands across, full over
// an eye and low under it, and a doorway is the edge nothing stands across; what is under a knee or over a head is
// not in the way; the edge is left open and the laws say so.
import { describe, expect, it } from 'vitest';
import { readCollidersMap } from './read-colliders.js';
import { indexMap, sees } from './map.js';
import { mapLaws } from './laws.js';

const box = (x0, y0, x1, y1, z0, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
describe('a place read from its colliders', () => {
  // a yard 18 m by 12 with a wall down its middle (a doorway in it), a crate, a barrier, a kerb and a roof slab
  const cols = [box(8.8, 0, 9.2, 4.6, 0, 3), box(8.8, 7.4, 9.2, 12, 0, 3), box(12, 6, 15, 9, 0, 2.6), box(2.8, -0.5, 3.2, 3.2, 0, 1.1), box(0, 0, 18, 12, -0.3, 0.1), box(0, 0, 18, 12, 4, 4.3)];
  const M = readCollidersMap(cols, { rect: [0, 0, 18, 12], z: 0 }), I = indexMap(M);
  it('makes a mass a solid, a thin wall an edge, a low thing a low wall, and leaves a doorway open', () => {
    expect([M.nx, M.ny, M.nz]).toEqual([6, 4, 1]);
    expect(M.solids).toEqual([[4, 2, 0]]);
    const wall = (i, j, side) => M.walls.find((w) => w.at[0] === i && w.at[1] === j && w.side === side)?.kind ?? null;
    // (the wall at x = 9 stands between columns 2 and 3: across rows 0 and 3, and not across rows 1 and 2, where its
    // doorway stands, off either cell's middle)
    expect([0, 1, 2, 3].map((j) => wall(2, j, 'e'))).toEqual(['full', null, null, 'full']);
    // (the barrier at x = 3 between columns 0 and 1, the whole of row 0's edge: low)
    expect(wall(0, 0, 'e')).toBe('low');
    expect(wall(0, 1, 'e')).toBeNull();
    // (the kerb under a knee and the slab over a head are not in the way: every cell is ground)
    expect(M.floors).toHaveLength(24);
  });
  it('is walked and seen as the place is: through the doorway, not through the wall; over the barrier', () => {
    expect(sees(I, [1, 0, 0], [4, 0, 0])).toBe(false);
    expect(sees(I, [1, 1, 0], [4, 1, 0])).toBe(true);
    expect(sees(I, [0, 0, 0], [1, 0, 0])).toBe(true);
    const L = mapLaws(M).laws;
    expect(L.find((l) => l.law === 'connected').holds).toBe(true);
    expect(L.find((l) => l.law === 'bounded').holds).toBe(false);
    expect(M.read.notes.join(' ')).toMatch(/edge left open/);
    expect(readCollidersMap(cols, { rect: [0, 0, 18, 12], z: 0 })).toEqual(M);
  });
  it('leaves out what it is told to', () => {
    expect(readCollidersMap(cols, { rect: [0, 0, 18, 12], z: 0, skip: (c) => c.max[2] === 2.6 }).solids).toEqual([]);
  });
});
