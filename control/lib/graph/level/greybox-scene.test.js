import { describe, it, expect } from 'vitest';
import { readGreybox, greyboxBlockFaces, assembleGreyboxScene, GREYBOX_TONES } from './greybox-scene.js';

describe('greybox: a level blocked out in boxes, in values', () => {
  const block = { at: [2, 3, 1], size: [4, 2, 3], turn: 90, tone: 'wall' };

  it('a block is its top and four sides, each facing out, shaded by its tone', () => {
    const F = greyboxBlockFaces(readGreybox({ blocks: [block] }).blocks[0]);
    expect(F).toHaveLength(5);
    for (const f of F) {
      // (each face's corners turn about its normal: counter-clockwise seen from outside)
      const [a, b, c] = f.corners, u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      expect(n[0] * f.normal[0] + n[1] * f.normal[1] + n[2] * f.normal[2]).toBeGreaterThan(0);
      expect(f.group).toBe('greybox:wall');
    }
    // (turned 90°: its 4 m width runs along y; its top is at its base plus its height)
    const top = F[0].corners;
    expect(Math.max(...top.map((p) => p[1])) - Math.min(...top.map((p) => p[1]))).toBeCloseTo(4, 3);
    expect(top.every((p) => p[2] === 4)).toBe(true);
    // (the top, facing the sun, is lighter than a side turned away from it: the sun comes from −x, −y, above)
    const lum = (hex) => parseInt(hex.slice(1, 3), 16);
    const away = F.find((f) => f.normal[2] === 0 && -0.35 * f.normal[0] - 0.55 * f.normal[1] < 0);
    expect(lum(F[0].fill)).toBeGreaterThan(lum(away.fill));
    expect(lum(F[0].fill)).toBeLessThanOrEqual(lum(GREYBOX_TONES.wall));
  });

  it('is a function of its blocks, with a camera over it and a walk on its floor', () => {
    const m = { kind: 'greybox', blocks: [{ at: [0, 0, -0.3], size: [20, 10, 0.3] }, block] };
    const A = assembleGreyboxScene(m), B = assembleGreyboxScene(m);
    expect(JSON.stringify(A)).toBe(JSON.stringify(B));
    expect(A.faces).toHaveLength(10);
    expect(A.cameras[0].name).toBe('over');
    expect(A.walk.spawn[2]).toBeCloseTo(1.7, 3);
    expect(A.greybox.floor).toBe(0);
  });

  it('refuses a block by the word that is wrong', () => {
    expect(() => readGreybox({ blocks: [] })).toThrow(/blocks/);
    expect(() => readGreybox({ blocks: [{ at: [0, 0], size: [1, 1, 1] }] })).toThrow(/at/);
    expect(() => readGreybox({ blocks: [{ at: [0, 0, 0], size: [1, 0, 1] }] })).toThrow(/size/);
    expect(() => readGreybox({ blocks: [{ ...block, tone: 'grass' }] })).toThrow(/tone/);
    expect(() => readGreybox({ blocks: [block], kit: 'gothic-nave' })).toThrow(/kit/);
  });
});
