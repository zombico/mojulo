/**
 * A walker paced by its own walk (walker-pace.js): a walk's stride measured off its planted feet, a step in place none;
 * a six's groups found (a pair, a single) and each walked at its people's mean natural pace times its own.
 */
import { describe, expect, it } from 'vitest';

import { paceWalkers, walkStride, walkerGroups } from './walker-pace.js';

// (a walk on two feet: each planted half the cycle, sliding back `stride` a cycle, lifted 10 cm in its swing; `inPlace`: planted feet that never slide)
function walk(stride, { K = 24, inPlace = false } = {}) {
  const bones = [{ id: 'pelvis' }, { id: 'footL' }, { id: 'footR' }], b = [];
  for (let k = 0; k < K; k++) for (let bi = 0; bi < 3; bi++) {
    const ph = ((k / K) + (bi === 2 ? 0.5 : 0)) % 1, planted = ph < 0.5;
    const y = bi === 0 ? 0 : planted ? (inPlace ? 0 : stride / 4 - ph * stride) : -stride / 4 + (ph - 0.5) * stride, z = bi === 0 ? 0.9 : planted ? 0.06 : 0.16;
    b.push(0, 0, 0, 1, 0, y, z);
  }
  return { bones, clips: { forward: { k: K, b, s: 1.1 } }, figH: 1.7 };
}

describe('a walker paced by its own walk', () => {
  it('measures a walk\'s stride off its planted feet; a step in place has none', () => {
    expect(walkStride(walk(1.2))).toBeCloseTo(1.2, 2);
    expect(walkStride(walk(0.9))).toBeCloseTo(0.9, 2);
    expect(walkStride(walk(1.2, { inPlace: true }))).toBeNull();
    expect(walkStride({ bones: [{ id: 'pelvis' }], clips: { forward: { k: 2, b: [] } } })).toBeNull();
  });
  it('finds who walks together, and walks each group at its people\'s mean pace times its own', () => {
    const loop = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 0, 0]], back = loop.slice().reverse();
    const W = [
      { figure: 'a', path: loop, speed: 1.35, startFrac: 0.1 }, { figure: 'b', path: loop, speed: 1.35, startFrac: 0.106 },   // a pair
      { figure: 'a', path: back, speed: 1.2, startFrac: 0.35 },                                                             // a single the other way
      { figure: 'q', path: loop, speed: 1.35, startFrac: 0.6 },                                                             // a figure with no measured walk
    ];
    expect(walkerGroups(W).map((g) => g.slice().sort())).toEqual([[0, 1], [3], [2]]);
    const figures = { a: { clips: { forward: { stride: 1.1, s: 1.1 } } }, b: { clips: { forward: { stride: 1.4, s: 0.9 } } }, q: { clips: { forward: {} } } };
    const P = paceWalkers(W, figures, { base: 1.35 });
    expect(P[0].speed).toBe(P[1].speed);
    expect(P[0].speed).toBeCloseTo((1 + 1.4 / 0.9) / 2, 3);
    expect(P[2].speed).toBeCloseTo(1 * (1 + (1.2 / 1.35 - 1) / 2), 3);
    expect(P[3]).toBe(W[3]);
  });
});
