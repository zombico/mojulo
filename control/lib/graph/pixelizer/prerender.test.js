import { describe, it, expect } from 'vitest';

import { quantizeRgbaToRaster, projectFacesToSvg } from './prerender.js';
import { validatePixelRecipe } from './pixelizer.js';

// tiny synthetic RGBA: 4×2, left half red, right half blue, one transparent px
function synth() {
  const data = new Uint8Array(4 * 2 * 4);
  const put = (i, r, g, b, a) => { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a; };
  put(0, 200, 20, 20, 255); put(1, 210, 30, 30, 255); put(2, 20, 20, 200, 255); put(3, 30, 30, 210, 255);
  put(4, 205, 25, 25, 255); put(5, 0, 0, 0, 0); put(6, 25, 25, 205, 255); put(7, 20, 20, 200, 255);
  return data;
}

describe('prerender — the deterministic quantizer', () => {
  it('median-cuts to the budget, maps transparency to ".", and is byte-deterministic', () => {
    const a = quantizeRgbaToRaster(synth(), 4, 2, { budget: 15 });
    const b = quantizeRgbaToRaster(synth(), 4, 2, { budget: 15 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.palette.length).toBeLessThanOrEqual(15);
    expect(a.cells[1][1]).toBe('.'); // the transparent pixel
    expect(a.cells[0][0]).not.toBe(a.cells[0][2]); // red and blue land on different entries
    a.palette.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('respects a tight budget: two clusters at budget 2', () => {
    const q = quantizeRgbaToRaster(synth(), 4, 2, { budget: 2 });
    expect(q.palette.length).toBe(2);
  });

  it('a quantized raster is mintable as a 16bit sprite', () => {
    const raster = quantizeRgbaToRaster(synth(), 4, 2, { budget: 15 });
    const recipe = {
      kind: 'pixel-map',
      register: '16bit',
      size: [8, 4],
      background: null,
      sprites: { prop: raster },
      placements: [{ id: 'p', sprite: 'prop', cell: [1, 1] }],
    };
    expect(validatePixelRecipe(recipe)).toEqual([]);
  });

  it('projects lit faces to a bounds-fit transparent SVG deterministically', () => {
    const faces = [
      { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#aa4400' },
      { corners: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]], fill: '#cc6622' },
    ];
    const svg = projectFacesToSvg(faces, { W: 64, H: 64 });
    expect(svg).toBe(projectFacesToSvg(faces, { W: 64, H: 64 }));
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('<rect'); // transparent background
  });
});
