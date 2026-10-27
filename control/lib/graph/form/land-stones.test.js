/**
 * The scree's stones (form/land-stones.js): stood where the overlay lays scree, fewer where it thins, none on a cliff
 * face or off the scree, the same stones from the same ground.
 */
import { describe, expect, it } from 'vitest';

import { landLayers } from './land-layers.js';
import { landStones, stoneForms, STONE_SIZES, STONE_BULK, SHAPES } from './land-stones.js';

// a field of 1.5 m quads: a cliff's wall (standing faces) along x = 6, soil past it; the scree fans from its foot
const CELL = 1.5, N = 24;
function field() {
  const faces = [], cls = [];
  for (let j = 0; j < N; j++) {
    faces.push({ corners: [[6, j * CELL, 0], [6, (j + 1) * CELL, 0], [6, (j + 1) * CELL, 6], [6, j * CELL, 6]], normal: [-1, 0, 0] }); cls.push('cliff');
    for (let i = 4; i < N; i++) { const x = i * CELL, y = j * CELL; faces.push({ corners: [[x, y, 0], [x + CELL, y, 0], [x + CELL, y + CELL, 0], [x, y + CELL, 0]], normal: [0, 0, 1] }); cls.push('soil'); }
  }
  return { faces, form: { faces: cls.map((c) => ({ cls: c })) } };
}

describe('the scree\'s stones', () => {
  const { faces, form } = field(), L = landLayers(faces, form, { seed: 2 }), S = landStones(faces, L, { seed: 2 });

  it('stand where the scree is, more at the cliff\'s foot than out on the soil, none on the cliff\'s face', () => {
    expect(S.length).toBeGreaterThan(20);
    const near = S.filter((s) => s.at[0] < 6 + 3).length, far = S.filter((s) => s.at[0] > 6 + 9 && s.at[0] < 6 + 12).length;
    expect(near).toBeGreaterThan(far);
    for (const s of S) { expect(s.n[2]).toBeGreaterThan(0.5); expect(s.at[0]).toBeGreaterThanOrEqual(6); }
  });

  it('most small, a few large, each sunk into the ground', () => {
    const big = S.filter((s) => s.r > (STONE_SIZES[0] + STONE_SIZES[1]) / 2).length;
    expect(big).toBeLessThan(S.length / 4);
    for (const s of S) { expect(s.r).toBeGreaterThanOrEqual(STONE_SIZES[0]); expect(s.at[2]).toBeLessThan(s.r); }
  });

  it('none without scree, and the same stones from the same ground', () => {
    const bare = field(); bare.form.faces.forEach((f) => { if (f.cls === 'cliff') f.cls = 'soil'; });
    const LB = landLayers(bare.faces, bare.form, { seed: 2 });
    // (only the seeded patches' scree is left: far fewer stones)
    expect(landStones(bare.faces, LB, { seed: 2 }).length).toBeLessThan(S.length);
    expect(landStones(faces, L, { seed: 2 })).toEqual(S);
  });

  it('a trail\'s rubble: stones along its verge, as many as its degree asks, none without a trail', () => {
    const T = field();
    // (a trail across the soil, a hand above it, along y = 18)
    for (let x = 12; x < 30; x += 0.5) { T.faces.push({ corners: [[x, 17.2, 0.04], [x + 0.5, 17.2, 0.04], [x + 0.5, 18.8, 0.04], [x, 18.8, 0.04]], normal: [0, 0, 1] }); T.form.faces.push({ cls: 'trail' }); }
    const LT = landLayers(T.faces, T.form, { seed: 2 }), along = (st) => st.filter((s) => s.at[0] > 16 && s.at[0] < 28 && Math.abs(s.at[1] - 18) < 3).length;
    const none = landStones(T.faces, LT, { seed: 2 }), some = landStones(T.faces, LT, { seed: 2, rubble: 0.4 }), many = landStones(T.faces, LT, { seed: 2, rubble: 1 });
    expect(along(some)).toBeGreaterThan(along(none));
    expect(along(many)).toBeGreaterThan(along(some));
    // (the verge thicker than the trail's middle)
    const mid = many.filter((s) => s.at[0] > 16 && s.at[0] < 28 && Math.abs(s.at[1] - 18) < 0.5).length, edge = many.filter((s) => s.at[0] > 16 && s.at[0] < 28 && Math.abs(Math.abs(s.at[1] - 18) - 1.3) < 0.5).length;
    expect(edge).toBeGreaterThan(mid);
    expect(landStones(faces, L, { seed: 2, rubble: 1 })).toEqual(S);
  });

  it('the stones\' shapes are broken rock: chipped near, the block\'s facets far, each of a stone\'s bulk, the same each time', () => {
    const F = stoneForms({ rock: 'granite', seed: 5 });
    expect(F.near.length).toBe(SHAPES);
    for (const k of ['near', 'far']) for (const f of F[k]) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < f.pos.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], f.pos[i + c]); hi[c] = Math.max(hi[c], f.pos[i + c]); }
      const half = lo.map((v, c) => (hi[c] - v) / 2);
      expect(Math.cbrt(half[0] * half[1] * half[2])).toBeCloseTo(STONE_BULK, 5);
      // (a stone lies on its flattest side)
      expect(half[2]).toBeLessThan(Math.max(half[0], half[1]));
      for (let i = 0; i < f.nrm.length; i += 3) expect(Math.hypot(f.nrm[i], f.nrm[i + 1], f.nrm[i + 2])).toBeCloseTo(1, 4);
    }
    // (the far one its block alone, a few dozen facets; the near one chipped, many more)
    expect(F.far[0].pos.length / 9).toBeLessThan(80);
    expect(F.near[0].pos.length / 9).toBeGreaterThan(3 * (F.far[0].pos.length / 9));
    // (the same rock and seed, the same shapes; another seed, others)
    const G = stoneForms({ rock: 'granite', seed: 6 });
    expect(Buffer.from(G.far[0].pos.buffer).equals(Buffer.from(F.far[0].pos.buffer))).toBe(false);
  });
});
