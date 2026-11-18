// Tall grass (tall-grass.js): a geocube's grass only in the patches a level lays, whole inside, thinning over a ragged
// edge, drawn to the patches' height, and each patch a veil the runtime's sight reads.
import { describe, it, expect } from 'vitest';
import { readTallGrass, patchCover, standOf, veilsOf, TALL_GRASS } from './tall-grass.js';

describe('a geocube\'s tall grass', () => {
  it('reads its patches, defaults their radius and height, and leaves out what is malformed', () => {
    const T = readTallGrass({ patches: [{ at: [4, 5] }, { at: [10, 0], r: 99, h: 0.1 }, { at: 'here' }] });
    expect(T.patches).toEqual([{ at: [4, 5], r: TALL_GRASS.r, h: TALL_GRASS.h }, { at: [10, 0], r: TALL_GRASS.rMax, h: TALL_GRASS.hMin }]);
    expect(T.elsewhere).toBe('none');
    expect(readTallGrass({ patches: [] })).toBeNull();
    expect(readTallGrass(null)).toBeNull();
    expect(readTallGrass({ patches: [{ at: [0, 0] }], elsewhere: 'grass' }).elsewhere).toBe('grass');
  });

  it('is whole inside a patch, gone past its edge, and between over a ragged edge', () => {
    const P = readTallGrass({ patches: [{ at: [0, 0], r: 3 }] }).patches;
    expect(patchCover(0, 0, P)).toBe(1);
    expect(patchCover(1.5, 1, P)).toBe(1);
    expect(patchCover(5, 0, P)).toBe(0);
    // (round the rim, the edge wanders: not one cover all the way round)
    const rim = Array.from({ length: 24 }, (_, k) => patchCover(3 * Math.cos(k / 3.82), 3 * Math.sin(k / 3.82), P));
    expect(Math.max(...rim) - Math.min(...rim)).toBeGreaterThan(0.1);
    expect(patchCover(3, 0, P)).toBe(patchCover(3, 0, P));   // (and the same at the same place)
  });

  it('draws its clump to the patches\' height, and lays each as a veil on the ground', () => {
    const P = readTallGrass({ patches: [{ at: [0, 0], h: 1.24 }] }).patches;
    expect(standOf(P).scale).toBeCloseTo(1.24 / TALL_GRASS.tip, 3);
    expect(veilsOf(P, () => 2.5)).toEqual([{ at: [0, 0, 2.5], r: TALL_GRASS.r, h: 1.24 }]);
    expect(veilsOf(P)[0].at[2]).toBe(0);
  });

});

describe('a painted field (elsewhere: paint)', () => {
  it('is read, and the page builds no short sward and paints the field from the eye out; asked for nothing, neither', async () => {
    expect(readTallGrass({ patches: [{ at: [0, 0] }], elsewhere: 'paint' }).elsewhere).toBe('paint');
    expect(readTallGrass({ patches: [{ at: [0, 0] }], elsewhere: 'lawn' }).elsewhere).toBe('none');
    expect(readTallGrass({ patches: [{ at: [0, 0] }], elsewhere: 'meadow' }).elsewhere).toBe('meadow');   // (the land's meadow, never tall)
    const { formGrassScript } = await import('../scene/channels/form-grass.js'), { farFieldScript } = await import('../scene/channels/far-field.js');
    expect(formGrassScript({ stand: true, paint: true })).toContain('if (FD && FD.paint) return;');
    expect(formGrassScript({ stand: true })).not.toContain('FD.paint');
    expect(farFieldScript({ paint: true })).toContain('uFarR.value = live ? 0.5 : 1e6');
    expect(farFieldScript()).toContain('uFarR.value = live ? CO.reach : 1e6');
  });
});
