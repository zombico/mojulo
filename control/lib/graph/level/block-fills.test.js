// THE TRAIL LIBRARY (block-fills.js): the templates a block of a planned map is laid by. The concept, on one template a
// procedure (the way through, the ring, the branch off the middle, the lanes), picked from the library in code: every
// one lays ways a segment's law holds, a ring is two ways round, a template with no room falls back, and a plan that
// names none is laid as it always was.
import { describe, it, expect } from 'vitest';
import { BLOCK_FILLS, BLOCK_FILL_IDS, layFill, blockRing } from './block-fills.js';
import { readPlan, fillSegment, readSegment, gateTile } from './plan.js';
import { readGrid } from './grid.js';

// one template a procedure: the first of the library laid by each
const PROCEDURE = { through: 'through', round: 'ring', loop: 'ring', spur: 'branch', crossroads: 'branch', switchback: 'lanes' };
const ONE_EACH = [...new Set(Object.values(PROCEDURE))].map((p) => BLOCK_FILL_IDS.find((id) => PROCEDURE[id] === p));
// a block walked west to east, a neighbour on each of those sides and open land north and south
const planOf = (size, fill, extra = {}) => ({ size, rows: ['A B C'], route: ['A', 'B', 'C'], key: { B: { ...(fill ? { fill } : {}), ...extra } } });
const paths = (rows) => rows.flatMap((r, i) => (Array.isArray(r) ? r : r.replace(/\s+/g, '').split('')).map((g, j) => (g === '#' ? [i, j] : null))).filter(Boolean);

describe('the trail library', () => {
  it('every template names a procedure, and the library says what each reads as', () => {
    expect(Object.keys(PROCEDURE).sort()).toEqual([...BLOCK_FILL_IDS].sort());
    for (const id of BLOCK_FILL_IDS) expect(BLOCK_FILLS[id].reads.length, id).toBeGreaterThan(10);
  });

  it('a template lays ways a segment\'s law holds: a path at each gate, none on a neighbour\'s border, all reached', () => {
    for (const id of ONE_EACH) {
      const size = Math.max(5, BLOCK_FILLS[id].min), P = readPlan(planOf(size, id)), seg = fillSegment(P, 'B');
      expect(() => readSegment(P, 'B', seg), id).not.toThrow();
      expect(layFill(size, { in: 'w', out: 'e' }, id).laid, id).toBe(id);
      // (and the map it is stitched into is one network)
      expect(() => readGrid({ tile: 24, plan: planOf(size, id) }), id).not.toThrow();
    }
  });

  it('a plan that names no template is laid through, as it always was', () => {
    const P = readPlan(planOf(5)), Q = readPlan(planOf(5, 'through'));
    expect(fillSegment(P, 'B')).toEqual(fillSegment(Q, 'B'));
    expect(fillSegment(P, 'B').rows).toEqual(['. . . . .', '. . . . .', '# # # # #', '. . . . .', '. . . . .']);
  });

  it('a ring is two ways round: every tile of it has two neighbours on it, its middle left open', () => {
    const n = 5, G = layFill(n, { in: 'w', out: 'e' }, 'loop').rows, ring = blockRing(n);
    for (const [r, c] of ring) expect(G[r][c]).toBe('#');
    expect(G[2][2]).toBe('.');
    const near = ([r, c]) => ring.filter(([a, b]) => Math.abs(a - r) + Math.abs(b - c) === 1).length;
    for (const t of ring) expect(near(t)).toBe(2);
    // (round: the same ring less one stretch between its gates, so it is one way)
    const R = layFill(n, { in: 'w', out: 'e' }, 'round').rows, on = ring.filter(([r, c]) => R[r][c] === '#');
    expect(on.length).toBeLessThan(ring.length);
    expect(on.filter((t) => on.filter(([a, b]) => Math.abs(a - t[0]) + Math.abs(b - t[1]) === 1).length === 1)).toHaveLength(2);
  });

  it('a branch off the middle stops a tile short of the border; lanes run the block end to end', () => {
    const spur = paths(fillSegment(readPlan(planOf(5, 'spur')), 'B').rows), n = 5;
    expect(spur.some(([r, c]) => r !== 2 && c === 2)).toBe(true);
    expect(spur.every(([r]) => r > 0 && r < n - 1)).toBe(true);
    const lanes = paths(layFill(7, { in: 'w', out: 'e' }, 'switchback').rows), through = paths(layFill(7, { in: 'w', out: 'e' }, 'through').rows);
    expect(lanes.length).toBeGreaterThan(through.length * 2);
  });

  it('a template with no room or no gates for it is laid as the nearest that fits, and says so', () => {
    expect(layFill(5, { in: 'w', out: 'e' }, 'switchback').laid).toBe('round');
    expect(layFill(7, { in: 'w', out: 'n' }, 'switchback').laid).toBe('round');
    expect(layFill(3, { in: 'w', out: 'e' }, 'loop').laid).toBe('through');
    expect(layFill(5, { out: 'e' }, 'round').laid).toBe('through');
    expect(() => layFill(5, {}, 'maze')).toThrow(/no trail template/);
    expect(() => readPlan(planOf(5, 'maze'))).toThrow(/fill is a template of the trail library/);
  });

  it('a goal stands at the middle of any template, a way at its door', () => {
    const plan = { size: 5, rows: ['A B'], route: ['A', 'B'], key: { B: { fill: 'loop', goal: { use: 'keep' } } } };
    const G = readGrid({ tile: 24, plan }), goal = G.cells.find((x) => x.kind === 'place');
    expect([goal.r, goal.c]).toEqual([2, 7]);
    expect(goal.open).toHaveLength(1);
    // (a template that branches off the middle would end its branches at the goal's walls: laid through)
    const S = fillSegment(readPlan({ ...plan, key: { B: { fill: 'crossroads', goal: { use: 'keep' } } } }), 'B');
    expect(paths(S.rows).map(String)).toEqual([String(gateTile(5, 'w')), '2,1']);
  });
});
