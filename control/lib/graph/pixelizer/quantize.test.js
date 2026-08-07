import { describe, it, expect } from 'vitest';

import { buildPalette, quantizeRgba, diffRasters, unionCels } from './quantize.js';

// synthetic RGBA helpers: paint solid blocks into a raw buffer
const raw = (w, h, painter) => {
  const buf = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = painter(x, y);
      buf.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return buf;
};

describe('buildPalette — deterministic median cut', () => {
  it('is byte-stable across calls and honors the budget', () => {
    const colors = [[250, 10, 10, 5], [10, 250, 10, 5], [10, 10, 250, 5], [240, 20, 20, 3], [128, 128, 128, 9]];
    const a = buildPalette(colors, 3);
    const b = buildPalette(colors.slice().reverse(), 3);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(3);
  });

  it('separates well-spread colors into their own entries', () => {
    const colors = [[255, 0, 0, 10], [0, 255, 0, 10], [0, 0, 255, 10]];
    const pal = buildPalette(colors, 3);
    expect(pal).toEqual([[0, 0, 255], [0, 255, 0], [255, 0, 0]]);
  });
});

describe('quantizeRgba — box filter + nearest map, pure', () => {
  // 8x8 source: left half red, right half blue → 4x4 grid
  const src = raw(8, 8, (x) => (x < 4 ? [200, 0, 0] : [0, 0, 200]));

  it('maps solid blocks to solid cells with a 2-color palette', () => {
    const q = quantizeRgba(src, 8, 8, { grid: [4, 4], budget: 4 });
    expect(q.palette).toEqual(['#0000c8', '#c80000']);
    expect(q.cells).toEqual(['2211', '2211', '2211', '2211']);
  });

  it('is pure: identical output on repeat calls', () => {
    expect(quantizeRgba(src, 8, 8, { grid: [4, 4] })).toEqual(quantizeRgba(src, 8, 8, { grid: [4, 4] }));
  });

  it('knocks the background out to transparent', () => {
    const q = quantizeRgba(src, 8, 8, { grid: [4, 4], transparent: { color: '#c80000', tol: 10 } });
    expect(q.cells.every((row) => row.startsWith('..'))).toBe(true);
  });

  it('quantizes against a pinned palette without rebuilding one', () => {
    const q = quantizeRgba(src, 8, 8, { grid: [4, 4], palette: ['#ff0000', '#0000ff', '#00ff00'] });
    expect(q.palette).toEqual(['#ff0000', '#0000ff', '#00ff00']);
    expect(q.cells[0]).toBe('1122');
  });
});

describe('diffRasters + unionCels — the sub-cel extractor', () => {
  const base = { size: [6, 4], palette: ['#111111', '#222222'], cells: ['111111', '111111', '111111', '111111'] };
  const variant = { size: [6, 4], palette: ['#111111', '#222222'], cells: ['111111', '112211', '112211', '111111'] };

  it('extracts the minimal changed bbox as a transparent-backed overlay', () => {
    const d = diffRasters(base, variant);
    expect(d.cell).toEqual([2, 1]);
    expect(d.sprite.size).toEqual([2, 2]);
    expect(d.sprite.cells).toEqual(['22', '22']);
    expect(d.changedRatio).toBeCloseTo(4 / 24);
  });

  it('returns null when nothing changed', () => {
    expect(diffRasters(base, base)).toBe(null);
  });

  it('unionCels pads cels onto one shared box with a matching blank', () => {
    const other = { cell: [1, 2], sprite: { size: [2, 2], palette: base.palette, cells: ['22', '2.'] } };
    const d = diffRasters(base, variant);
    const u = unionCels([d, other]);
    expect(u.cell).toEqual([1, 1]);
    expect(u.sprites[0].size).toEqual(u.sprites[1].size);
    expect(u.blank.cells.every((r) => /^\.+$/.test(r))).toBe(true);
    // first cel's pixels land at the right offset inside the union box
    expect(u.sprites[0].cells[0][1]).toBe('2');
  });
});
