/**
 * The resampler (resample.js, matte-paint/detail.js resamplePlan): a painted detail tile read again at seeded shifts so
 * it does not repeat at scale, each by a plan read off how the tile is built; absent a plan, the page emits nothing.
 */
import { describe, expect, it } from 'vitest';

import { resampleScript } from './resample.js';
import { detailKey, resamplePlan, resamplePlans } from '../../matte-paint/detail.js';
import { emitThreeWorld } from '../scene-three.js';

const key = (cfg, metres = 2) => detailKey({ stone: [150, 140, 120], mortar: [90, 84, 74], ...cfg }, 5, metres, 0);

describe('a tile\'s plan', () => {
  it('is read off how it is built: coursed work by bands of whole courses, boards by strips, a grid by its units, free work by hexes', () => {
    expect(resamplePlan(key({ rows: 5, cols: 2 }))).toMatchObject({ kind: 'courses', stepU: 0, stepV: 0.2 });
    // (an exact bond: shifted by whole bricks along and whole bond periods down, so the bond holds across a cut)
    expect(resamplePlan(key({ cut: 'brick', rows: 16, cols: 5 }, 1.2))).toMatchObject({ kind: 'courses', stepU: 0.2, stepV: 0.125 });
    expect(resamplePlan(key({ cut: 'boards', cols: 9 }))).toMatchObject({ kind: 'strips', stepV: 0 });
    expect(resamplePlan(key({ cut: 'pavement', cols: 2 }, 3))).toMatchObject({ kind: 'grid', stepU: 0.5, stepV: 0.5 });
    expect(resamplePlan(key({ cut: 'asphalt' }, 4))).toMatchObject({ kind: 'hex' });
    expect(resamplePlan(key({ cut: 'render', rows: 6 }, 3))).toMatchObject({ kind: 'hex', stepV: 0.16667 });
    // a band is whole courses: its cut falls on a bed joint
    for (const cfg of [{ rows: 5 }, { cut: 'brick', rows: 16, cols: 5 }, { cut: 'setts', rows: 10, cols: 8 }]) { const p = resamplePlan(key(cfg)); expect(Math.abs(p.bandV / p.stepV - Math.round(p.bandV / p.stepV)), JSON.stringify(cfg)).toBeLessThan(1e-3); }
    expect(resamplePlan('stone-brick-a')).toBeNull();
    expect(Object.keys(resamplePlans([key({ rows: 5 }), 'gen:stone-brick-abc-a']))).toEqual([key({ rows: 5 })]);
  });
});

describe('the page', () => {
  const k = key({ cut: 'brick', rows: 16, cols: 5 }, 1.2), tex = { [k]: 'data:image/png;base64,iVBORw0KGgo=' };
  const faces = [{ corners: [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]], fill: '#9c5440', texture: k, textureLit: true, uv: [[0, 0], [3, 0], [3, 2], [0, 2]] }];
  it('patches the meshes whose tile has a plan, and only those; absent plans, nothing of it is emitted', () => {
    const plain = emitThreeWorld({ faces, textures: tex }), on = emitThreeWorld({ faces, textures: tex, resample: resamplePlans([k]) });
    expect(plain).not.toMatch(/__RESAMPLE/);
    expect(on).toMatch(/__RESAMPLE/); expect(on).toMatch(/rsRead/);
    // (a plan for a tile the page does not draw emits nothing)
    expect(emitThreeWorld({ faces, textures: tex, resample: resamplePlans([key({ rows: 5 })]) })).toBe(plain);
    expect(resampleScript(resamplePlans([k]))).toMatch(/#include <map_fragment>/);
  });
});
