// The racer pole swept: every archetype at two builds (light and heavy) compiles, its hard laws held (every part on its
// mount, nothing in a wheel's sweep, within the budget), its figure a rig; and every part in the library builds at both
// ends of its rails.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from './racer.js';
import { PARTS } from './parts.js';
import { buildBlock } from '../era/blocks.js';
import { HUES } from '../egocube/outfit.js';

describe('the racer pole, swept', () => {
  for (const archetype of Object.keys(HUES)) for (const build of ['lithe', 'brute']) it(`${archetype}, ${build}`, () => {
    const S = solveRacer(racerFromSheet(rollEgocube({ facets: { archetype, build }, seed: 2 }), { seed: 2 }), { seed: 2 });
    expect(S.laws.filter((l) => ['touches', 'wheel-clear', 'budget'].includes(l.law))).toEqual([]);
    expect(S.figure.bones.length).toBe(5);
  });
  it('every part builds at both ends of its rails', () => {
    for (const [id, P] of Object.entries(PARTS)) for (const end of [0, 1]) {
      const params = Object.fromEntries(Object.entries(P.block.params).map(([k, r]) => [k, r[end]]));
      expect(() => buildBlock(P.block, { params, ring: 'near' }), `${id} at ${end ? 'top' : 'foot'}`).not.toThrow();
    }
  });
});
