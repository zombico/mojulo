/**
 * skin-relief — the skin's concepts on small swatches: deterministic from its seed; an absent layer adds nothing
 * (tier `form`, `pores: 0`, `creases: 0`); age deepens the relief; the keratin lines run along the tension; a crease
 * lies below the skin beside it; the cube reads its skin.
 */
import { describe, expect, it } from 'vitest';

import { skinRelief, creaseLines } from './skin-relief.js';
import { readEpidermis } from './epidermis.js';

// a 3 mm square sampled every 0.05 mm
const grid = (relief, f = (r) => r.h) => { const out = []; for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) out.push(f(relief.at(i * 0.05, j * 0.05))); return out; };
const std = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const RIM = { kind: 'radial', pivot: { u: -1.5, v: 1.5 }, span: [-30, 30], reach: [1, 8], count: 6, depth: 70 };

describe('the skin relief', () => {
  it('grows the same skin from the same seed, and another from another', () => {
    expect(grid(skinRelief({ region: 'cheek', seed: 3 }))).toEqual(grid(skinRelief({ region: 'cheek', seed: 3 })));
    expect(grid(skinRelief({ region: 'cheek', seed: 4 }))).not.toEqual(grid(skinRelief({ region: 'cheek', seed: 3 })));
  });
  it('adds nothing it is not asked for', () => {
    expect(grid(skinRelief({ fidelity: 'form', tethers: [RIM] })).every((h) => h === 0)).toBe(true);
    expect(grid(skinRelief({ pores: 0 }), (r) => r.pore).every((p) => p === 0)).toBe(true);
    expect(skinRelief({ creases: 0, tethers: [RIM] }).lines).toHaveLength(0);
    expect(grid(skinRelief({ region: 'nose' }), (r) => r.pore).some((p) => p > 0.5)).toBe(true);
  });
  it('deepens with age', () => {
    expect(std(grid(skinRelief({ region: 'forehead', age: 0.9 })))).toBeGreaterThan(1.3 * std(grid(skinRelief({ region: 'forehead', age: 0.1 }))));
    expect(creaseLines(RIM, { age: 0.9 }).length).toBeGreaterThan(creaseLines(RIM, { age: 0.1 }).length);
  });
  it('runs the keratin lines along the tension: the relief changes more across it than along it', () => {
    const energy = (angle) => {
      const r = skinRelief({ region: 'forehead', fidelity: 'keratin', pores: 0, angle }), d = 0.01;
      let along = 0, across = 0;
      for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) {
        const u = i * 0.05, v = j * 0.05, h = r.at(u, v).h;
        along += (r.at(u + d, v).h - h) ** 2; across += (r.at(u, v + d).h - h) ** 2;
      }
      return across / along;
    };
    expect(energy(0)).toBeGreaterThan(1.5);     // the tension along u: the lines run along u
    expect(energy(90)).toBeLessThan(1 / 1.5);   // turned, they turn
  });
  it('lays a crease below the skin beside it', () => {
    const r = skinRelief({ region: 'cheek', fidelity: 'creases', age: 0.8, tethers: [RIM] }), L = r.lines[0], p = L.pts[6], q = L.pts[7];
    const tx = q.u - p.u, ty = q.v - p.v, l = Math.hypot(tx, ty), side = { u: p.u - (ty / l) * 0.6, v: p.v + (tx / l) * 0.6 };
    expect(r.at(p.u, p.v).h).toBeLessThan(r.at(side.u, side.v).h - 0.5 * L.depth);
  });
  it('is the cube\'s skin: read with its numbers, or none', () => {
    expect(readEpidermis('default').skin.fidelity).toBe('micro');
    expect(readEpidermis({ skin: { age: 0.8 } }).skin).toMatchObject({ age: 0.8, fidelity: 'micro' });
    expect(readEpidermis({ skin: false }).skin).toBeNull();
    expect(() => readEpidermis({ skin: { fidelity: 'pores' } })).toThrow();
  });
});
