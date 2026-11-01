import { describe, it, expect } from 'vitest';
import { plantPool } from './pool.js';

// a street tree's crown RAISED (`clear`): carried whole up a clear trunk; absent, the pool is its own
describe('a raised crown: the whole crown carried up a clear trunk', () => {
  it('stands nothing but its trunk below the share of its height asked, and keeps its crown', () => {
    const open = plantPool({ species: 'beech', variants: 1, seed: 'raise' }), raised = plantPool({ species: 'beech', variants: 1, seed: 'raise', clear: 0.42 });
    const [o, r] = [open.variants[0].levels.L1, raised.variants[0].levels.L1];
    // (off the trunk: farther from its axis than its base girth)
    const girth = Math.max(...r.flatMap((f) => f.corners.filter((c) => c[2] < 0.01).map((c) => Math.hypot(c[0], c[1]))));
    for (const f of r) for (const c of f.corners) if (Math.hypot(c[0], c[1]) > girth + 1e-6) expect(c[2]).toBeGreaterThanOrEqual(0.42 - 1e-6);
    expect(Math.max(...r.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(1, 2);
    // the crown whole: as many faces as the open-grown tree's, and a trunk's sides
    expect(r.length).toBeGreaterThanOrEqual(o.length);
    expect(plantPool({ species: 'beech', variants: 1, seed: 'raise' }).variants[0].levels.L1).toEqual(o);
  });
});
