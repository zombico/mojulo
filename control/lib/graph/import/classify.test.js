import { describe, it, expect } from 'vitest';
import { classifyShape, HEADS } from './classify.js';

// boxes as triangles (native frame, z up): [x0, y0, z0, x1, y1, z1]
function boxes(list) {
  const out = [];
  for (const [x0, y0, z0, x1, y1, z1] of list) {
    const c = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
    for (const [a, b, d, e] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) out.push(...c(a), ...c(b), ...c(d), ...c(a), ...c(d), ...c(e));
  }
  return out;
}
// a figure of `heads` heads standing H tall: legs parted to the crotch, a torso, a neck, a head, arms out in a T
function figure({ H = 1.8, heads = 7.5, arms = 'T' } = {}) {
  const head = H / heads, crown = H, chin = crown - head, neckTop = chin, neckBot = chin - head * 0.3;
  const crotch = Math.min(H * 0.47, neckBot - head * 0.6), shoulder = neckBot;
  const w = head * 0.8;
  const legs = [[-w * 0.9, -w / 3, 0, -w * 0.15, w / 3, crotch], [w * 0.15, -w / 3, 0, w * 0.9, w / 3, crotch]];
  const torso = [[-w, -w / 2, crotch, w, w / 2, shoulder]];
  const neck = [[-w / 4, -w / 4, neckBot, w / 4, w / 4, neckTop]];
  const hd = [[-w * 0.55, -w * 0.6, chin, w * 0.55, w * 0.6, crown]];
  const armBoxes = arms === 'T' ? [[-w - H * 0.4, -w / 5, shoulder - w / 3, -w, w / 5, shoulder], [w, -w / 5, shoulder - w / 3, w + H * 0.4, w / 5, shoulder]] : [];
  return boxes([...legs, ...torso, ...neck, ...hd, ...armBoxes]);
}

describe('classify: what a model is, by its shape', () => {
  it('reads a person\'s proportions as a body, its heads-tall near what it was built at', () => {
    const c = classifyShape(figure({ heads: 7.5 }));
    expect(c.class).toBe('body');
    expect(c.legs).toBe(2);
    expect(c.headsTall).toBeGreaterThan(6);
    expect(c.headsTall).toBeLessThan(9);
    expect(c.crotch).toBeGreaterThan(0.6);
  });

  it('reads a head a third of the figure or more as a mascot, whatever its size', () => {
    for (const H of [0.5, 4.5]) {
      const c = classifyShape(figure({ H, heads: 2.5 }));
      expect(c.class).toBe('mascot');
      expect(c.headsTall).toBeLessThanOrEqual(HEADS.MASCOT_MAX);
    }
  });

  it('reads between the bands as a stylized body, and says it could be said otherwise', () => {
    const c = classifyShape(figure({ heads: 3.9 }));
    expect(c.class).toBe('body');
    expect(c.basis).toMatch(/stylized body.*as: 'mascot'/);
  });

  it('takes a skeleton\'s chin over the slice\'s, since hair and a collar hide a neck', () => {
    const tris = figure({ heads: 7.5 });
    const c = classifyShape(tris, { rigged: 'humanoid', chin: 1.8 - 1.8 / 3 });
    expect(c.chinBy).toBe('skeleton');
    expect(c.headsTall).toBe(3);
    expect(c.class).toBe('mascot');
  });

  it('reads a thing on four legs with no skeleton as furniture, and with one as a creature', () => {
    const table = boxes([[0, 0, 0, 0.05, 0.05, 0.7], [0.95, 0, 0, 1, 0.05, 0.7], [0, 0.95, 0, 0.05, 1, 0.7], [0.95, 0.95, 0, 1, 1, 0.7], [0, 0, 0.7, 1, 1, 0.75]]);
    expect(classifyShape(table)).toMatchObject({ class: 'prop', legs: 4 });
    expect(classifyShape(table, { rigged: 'other' }).class).toBe('creature');
  });

  it('reads a thing on no legs as a prop, a biped as one whatever its skeleton says of it', () => {
    expect(classifyShape(boxes([[0, 0, 0, 1, 1, 1]])).class).toBe('prop');
    expect(classifyShape(figure(), { rigged: 'other' }).class).toBe('body');
  });

  it('is the same reading from the same triangles', () => {
    expect(JSON.stringify(classifyShape(figure()))).toBe(JSON.stringify(classifyShape(figure())));
  });
});
