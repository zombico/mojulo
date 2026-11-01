/**
 * Bark as material (form/bark-material.js): a tile with its own colour, its relief's normal, the fissures' occlusion and
 * the relief kept for parallax; the same bytes twice; a rough bark deeper than a smooth one.
 */
import { describe, expect, it } from 'vitest';

import { barkMaterial } from './bark-material.js';
import { BARKS } from '../vegetation/bark.js';

// a smooth bark and a ridged one, chosen by the fracture model's own dilatation (δ ≈ 1 keeps up: smooth)
const smooth = Object.keys(BARKS).find((k) => BARKS[k].delta >= 1), ridged = Object.keys(BARKS).find((k) => BARKS[k].delta < 0.2 && !BARKS[k].plates);

describe('barkMaterial', () => {
  it('gives the textures a renderer lights, the same bytes twice, the relief over its full range', () => {
    const M = barkMaterial(ridged, { size: 64 });
    for (const k of ['baseColor', 'normal', 'orm', 'height']) expect(M[k].length).toBe(M.W * M.H * 3);
    expect(barkMaterial(ridged, { size: 64 })).toBe(M);
    let lo = 255, hi = 0; for (let i = 0; i < M.height.length; i += 3) { lo = Math.min(lo, M.height[i]); hi = Math.max(hi, M.height[i]); }
    expect(lo).toBe(0); expect(hi).toBe(255);
    // (its fissures occlude: the occlusion channel darker where the relief is low)
    let low = 0, nl = 0, high = 0, nh = 0; for (let i = 0; i < M.height.length; i += 3) { if (M.height[i] < 64) { low += M.orm[i]; nl++; } else if (M.height[i] > 192) { high += M.orm[i]; nh++; } }
    expect(low / nl).toBeLessThan(high / nh);
  });

  it('a ridged bark\'s relief is deeper than a smooth one\'s (the parallax\'s depth)', () => {
    expect(barkMaterial(ridged, { size: 64 }).depth).toBeGreaterThan(barkMaterial(smooth, { size: 64 }).depth * 3);
  });
});
