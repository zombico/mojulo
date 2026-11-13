/**
 * The far box (channels/far-box.js): the grass past the reach as a volume, first as a wireframe. Claims under test: the
 * box stands on the ground it is given and to its sward's height; a wall rises only where grass meets no grass; the
 * same map makes the same lines; a page that does not ask for it carries none of it.
 */
import { describe, expect, it } from 'vitest';

import { FAR_BOX, FAR_BOX_HEIGHTS, farBoxLines, farBoxScript, readFarBox } from './far-box.js';
import { formLandScript } from './form-land.js';

// (a small map: a sloping ground, grass on its left half, tall in the lower rows and short in the upper)
const N = 16, cell = 0.5, z = [10, 4];
const px = new Uint8Array(N * N * 4);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const q = (j * N + i) * 4, zq = Math.round(((i + 1) / (N + 1)) * 65535);
  px[q] = zq >> 8; px[q + 1] = zq & 255; px[q + 2] = i < N / 2 ? 255 : 0; px[q + 3] = j < N / 2 ? 0 : 255;
}
const K = { cell: 2, cover: FAR_BOX.cover, share: FAR_BOX.share, heights: FAR_BOX_HEIGHTS, band: 0.25 };
const B = farBoxLines(px, [N, N], cell, [0, 0], z, K);
const ground = (x) => z[0] + (((x + cell / 2) / cell + 0.5) / (N + 1)) * z[1];

describe('the far box', () => {
  it('stands on the ground and to its sward\'s height', () => {
    expect(B.size).toEqual([4, 4]);
    expect(B.cells).toBe(8);
    expect(FAR_BOX_HEIGHTS[0]).toBeGreaterThan(FAR_BOX_HEIGHTS[1]);
    expect(FAR_BOX_HEIGHTS[1]).toBeGreaterThan(FAR_BOX_HEIGHTS[2]);
    for (let v = 0; v < B.kind.length; v++) {
      const x = B.pos[v * 3], y = B.pos[v * 3 + 1], lift = B.pos[v * 3 + 2] - ground(x);
      // (every vertex is at the ground or a sward's height over it, the ground the map's, to a cell's slope)
      const nearest = [0, ...FAR_BOX_HEIGHTS].reduce((a, h) => (Math.abs(lift - h) < Math.abs(lift - a) ? h : a), 99);
      expect(Math.abs(lift - nearest)).toBeLessThan(0.2);
      expect(x).toBeGreaterThanOrEqual(-cell / 2); expect(y).toBeGreaterThanOrEqual(-cell / 2);
    }
    // (the tall rows stand taller than the short ones)
    const top = (ylo, yhi) => { let m = 0; for (let v = 0; v < B.kind.length; v++) { const y = B.pos[v * 3 + 1]; if (y > ylo && y < yhi) m = Math.max(m, B.pos[v * 3 + 2] - ground(B.pos[v * 3])); } return m; };
    expect(top(-1, 2)).toBeGreaterThan(top(5, 8.5));
  });
  it('walls only where grass meets no grass', () => {
    let walls = 0, inner = 0;
    for (let l = 0; l < B.kind.length / 2; l++) {
      const a = l * 6, wall = B.kind[l * 2] === 3; if (wall) walls++; else inner++;
      // (a wall's line lies on the field's edge: the map's border or the seam at x = 4 m less the half cell)
      if (wall) expect([-0.25, 3.75].some((e) => Math.abs(B.pos[a] - e) < 1e-6 && Math.abs(B.pos[a + 3] - e) < 1e-6) || [-0.25, 7.75].some((e) => Math.abs(B.pos[a + 1] - e) < 1e-6 && Math.abs(B.pos[a + 4] - e) < 1e-6)).toBe(true);
    }
    expect(walls).toBeGreaterThan(0); expect(inner).toBeGreaterThan(0);
    // (no grass at all: no line)
    expect(farBoxLines(new Uint8Array(N * N * 4), [N, N], cell, [0, 0], z, K).pos.length).toBe(0);
  });
  it('is the same lines for the same map, and absent unless asked', () => {
    const again = farBoxLines(px, [N, N], cell, [0, 0], z, K);
    expect(Array.from(again.pos)).toEqual(Array.from(B.pos));
    expect(farBoxScript(null)).toBe('');
    const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };
    expect(formLandScript(land)).not.toContain('far box');
    expect(formLandScript({ ...land, farBox: true })).toContain('window.__formFarBox');
    expect(readFarBox(undefined)).toBe(null);
    expect(readFarBox(true)).toEqual({ cell: FAR_BOX.cell });
    expect(readFarBox({ cell: 4 })).toEqual({ cell: 4 });
    expect(() => readFarBox({ cell: 100 })).toThrow(/farBox\.cell/);
    expect(() => readFarBox({ size: 2 })).toThrow(/not a setting/);
  });
});
