// The lash page (hair-strands.js lashPage): a lash ribbon's cards' lashes, a solid root band and tapering, clumping
// lashes over clear ground; a card point's place on it by its cell.
import { describe, it, expect } from 'vitest';
import { lashPage, lashCellUV, LASH_PAGE } from './hair-strands.js';

describe('the lash page', () => {
  const P = lashPage({ w: 256, h: 64 }), a = (x, y) => P.rgba[(y * P.w + x) * 4 + 3];
  it('is solid along the root and open between the lashes toward their tips, the same twice', () => {
    for (let x = 0; x < P.w; x += 7) expect(a(x, 1)).toBe(255);
    const tipRow = Math.round(P.h * 0.5), open = Array.from({ length: P.w }, (_, x) => a(x, tipRow)).filter((v) => v === 0).length;
    expect(open / P.w).toBeGreaterThan(0.5);
    expect(lashPage({ w: 256, h: 64 }).rgba).toEqual(P.rgba);
  });
  it('places a card point in its cell, root at the top', () => {
    const [s0, t0] = lashCellUV(1, [0, 0]), [s1, t1] = lashCellUV(1, [1, 1]);
    expect(s0).toBeGreaterThan(1 / LASH_PAGE.cells); expect(s1).toBeLessThan(2 / LASH_PAGE.cells);
    expect(t0).toBeGreaterThan(t1);
  });
});
