// The form render's material (relief-material.js) and the bond as polygons (bond.js): a relief read into the maps an
// engine lights, never a light of its own; and the bond's bricks where the paint's are, course for course.
import { describe, expect, it } from 'vitest';
import { reliefMaterial, CAVITY_OCCLUSION } from './relief-material.js';
import { brickBond, brickFaces } from './bond.js';
import { dressedMaterial, dressedTile, BRICK } from '../matte-paint/dressed.js';

const W = 8, H = 8, px = 0.01;
const field = (f) => Float32Array.from({ length: W * H }, (_, k) => f(k % W, Math.floor(k / W)));
const base = Buffer.alloc(W * H * 3, 100);
const at = (buf, i, j) => [...buf.subarray((j * W + i) * 3, (j * W + i) * 3 + 3)];

describe('a relief read as material', () => {
  it('a flat face is a flat normal, fully lit, its roughness the material\'s', () => {
    const M = reliefMaterial({ W, H, px, height: field(() => 0) }, { base, rough: 0.8 });
    expect(at(M.normal, 3, 3)).toEqual([128, 128, 255]);
    expect(at(M.orm, 3, 3)).toEqual([255, 204, 0]);
    expect(M.baseColor).toBe(base);
  });

  it('a slope tilts the normal against it: rising along the row, it looks back; rising to the top, it looks down', () => {
    const along = reliefMaterial({ W, H, px, height: field((i) => i * 0.002), tile: false }, { base });
    expect(at(along.normal, 4, 4)[0]).toBeLessThan(128);
    const upward = reliefMaterial({ W, H, px, height: field((i, j) => -j * 0.002), tile: false }, { base });
    expect(at(upward.normal, 4, 4)[1]).toBeLessThan(128);
    // a hollow occludes as deep as light.js finds it, a crest is polished
    const C = reliefMaterial({ W, H, px, height: field(() => 0) }, { base, cavity: new Float32Array(W * H).fill(1), convex: new Float32Array(W * H).fill(1), rough: 0.8 });
    expect(at(C.orm, 0, 0)[0]).toBe(Math.round((1 - CAVITY_OCCLUSION) * 255));
    expect(at(C.orm, 0, 0)[1]).toBeLessThan(204);
    expect(() => reliefMaterial({ W, H, px, height: new Float32Array(3) }, { base })).toThrow(/a relief is/);
  });
});

describe('a dressed brick as material', () => {
  const CFG = { cut: 'brick', stone: [158, 74, 52], mortar: [196, 188, 172], rows: 8, cols: 4, metres: 1 };
  it('the same cut the paint draws, its colour without the paint\'s light, the same bytes each time', () => {
    const A = dressedMaterial(CFG, { size: 64, seed: 3 }), B = dressedMaterial(CFG, { size: 64, seed: 3 });
    expect(Buffer.compare(A.normal, B.normal)).toBe(0);
    expect(Buffer.compare(A.baseColor, B.baseColor)).toBe(0);
    expect(Buffer.compare(A.baseColor, dressedTile(CFG, { size: 64, seed: 3 }).rgb)).not.toBe(0);
    expect(() => dressedMaterial({ ...CFG, cut: 'ashlar' })).toThrow(/still drawn as paint/);
  });

  it('the bond\'s bricks stand where the paint\'s are: a brick\'s middle is its face, the joint under it the mortar', () => {
    const size = 256, M = dressedMaterial(CFG, { size, seed: 3 }), wall = { width: 0.9, height: 0.75 };
    const { bricks } = brickBond(CFG, wall);
    // the paint's row 0 is the wall's top: a point z up the wall is row (height − z) of the repeat
    const h = (x, z) => { const i = Math.floor(((x % 1) + 1) % 1 * size), j = Math.floor((((wall.height - z) % 1) + 1) % 1 * size); return M.height[j * size + i]; };
    const inner = bricks.filter((b) => b.z0 > 0.05 && b.x1 - b.x0 > 0.1);
    expect(inner.length).toBeGreaterThan(8);
    for (const b of inner) {
      expect(h((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)).toBeGreaterThan(-0.0015);
      expect(h((b.x0 + b.x1) / 2, b.z0 - BRICK.joint / 2)).toBeLessThan(-BRICK.mortar + 0.0021);
    }
    // a half bond: the next course's joints sit half a brick along
    const r0 = bricks.filter((b) => b.row === 0 && b.x0 > 0).map((b) => b.x0), r1 = bricks.filter((b) => b.row === 1 && b.x0 > 0).map((b) => b.x0);
    expect(Math.abs(r1[0] - r0[0])).toBeCloseTo(1 / CFG.cols / 2, 3);
  });

  it('each brick a face and its four returns back to the mortar, the mortar a plane behind; a bond teaches', () => {
    const bond = brickBond(CFG, { width: 0.5, height: 0.5 }), F = brickFaces(bond);
    expect(F.filter((f) => f.part === 'brick')).toHaveLength(bond.bricks.length * 5);
    expect(F.filter((f) => f.part === 'mortar')).toHaveLength(1);
    expect(Math.max(...F.flatMap((f) => f.corners.map((c) => c[1])))).toBe(BRICK.mortar);
    expect(() => brickBond({ rows: 0, cols: 2 }, { width: 1, height: 1 })).toThrow(/a bond is/);
  });
});
