import { describe, expect, it } from 'vitest';

import { bakeBoxField, boxFromFootprint, boxFieldGLSL } from './effects-occluder.js';

// read the K index slots stored for grid cell (c, r) out of a baked cellData texture.
function cellSlots(baked, c, r) {
  const { cols, rows, tpc, K } = baked.grid;
  const { data, width } = baked.cellData;
  const out = [];
  for (let k = 0; k < K; k++) {
    const texelCol = c * tpc + Math.floor(k / 4);
    const comp = k % 4;
    out.push(data[(r * width + texelCol) * 4 + comp]);
  }
  return out.filter((v) => v >= 0);
}

describe('boxFromFootprint — fractal-city (z-up) → render (y-up) center form', () => {
  it('maps footprint + height to center + half-extents', () => {
    expect(boxFromFootprint({ x: 2, y: 4, w: 6, d: 8, z1: 10 })).toEqual({
      cx: 5, cz: 8, cy: 5, hx: 3, hz: 4, hy: 5,
    });
  });
  it('honours a non-zero base z0', () => {
    const b = boxFromFootprint({ x: 0, y: 0, w: 2, d: 2, z0: 4, z1: 10 });
    expect(b.cy).toBe(7);   // (4+10)/2
    expect(b.hy).toBe(3);   // (10-4)/2
  });
});

describe('bakeBoxField — the uniform-grid acceleration index', () => {
  it('packs box center + half-extents into the 2-texel-per-box data texture', () => {
    const baked = bakeBoxField([{ cx: 1, cy: 2, cz: 3, hx: 4, hy: 5, hz: 6 }], { cell: 4 });
    expect(baked.boxData.width).toBe(2);
    expect(baked.boxData.height).toBe(1);
    expect(baked.boxData.data.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 6, 0, 0]);
  });

  it('lists a box in every grid cell its XZ footprint overlaps', () => {
    // a box spanning x∈[-3,3], z∈[-3,3] with cell=4, margin=2 → origin (-5,-5), 3×3 grid
    const baked = bakeBoxField([{ cx: 0, cy: 2, cz: 0, hx: 3, hy: 2, hz: 3 }], { cell: 4, margin: 2 });
    expect(baked.grid.cols).toBe(3);
    expect(baked.grid.rows).toBe(3);
    // footprint -3..3 in world → cells covering origin region; box index 0 appears in those cells
    const covered = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (cellSlots(baked, c, r).includes(0)) covered.push([c, r]);
    expect(covered.length).toBeGreaterThanOrEqual(1);
    // the cell containing world origin (0,0) → ci = floor((0-(-5))/4)=1 → must list the box
    expect(cellSlots(baked, 1, 1)).toContain(0);
  });

  it('separates boxes that fall in different cells (the whole point of the index)', () => {
    const baked = bakeBoxField([
      { cx: -10, cy: 1, cz: 0, hx: 1, hy: 1, hz: 1 },
      { cx: 10, cy: 1, cz: 0, hx: 1, hy: 1, hz: 1 },
    ], { cell: 4, margin: 1 });
    // every cell holds at most one of the two far-apart boxes
    let maxPerCell = 0;
    for (let r = 0; r < baked.grid.rows; r++) for (let c = 0; c < baked.grid.cols; c++) {
      maxPerCell = Math.max(maxPerCell, cellSlots(baked, c, r).length);
    }
    expect(maxPerCell).toBe(1);
  });

  it('drops + counts overflow past the per-cell capacity K', () => {
    // 10 unit boxes stacked in the SAME cell, K=8 → 2 dropped writes
    const boxes = Array.from({ length: 10 }, (_, i) => ({ cx: 0, cy: i, cz: 0, hx: 0.4, hy: 0.4, hz: 0.4 }));
    const baked = bakeBoxField(boxes, { cell: 8, margin: 1, K: 8 });
    expect(baked.overflow).toBeGreaterThan(0);
    // no cell exceeds K live slots
    for (let r = 0; r < baked.grid.rows; r++) for (let c = 0; c < baked.grid.cols; c++) {
      expect(cellSlots(baked, c, r).length).toBeLessThanOrEqual(8);
    }
  });

  it('throws on an empty box set', () => {
    expect(() => bakeBoxField([])).toThrow(/at least one box/);
  });
});

describe('boxFieldGLSL — the GLSL that traverses the baked index', () => {
  it('defines the occluder seam (sdfScene / sceneNormal / ground) + texture decode', () => {
    const g = boxFieldGLSL({ K: 8 });
    expect(g).toContain('float sdfScene(vec3 p)');
    expect(g).toContain('vec3 sceneNormal(vec3 p)');
    expect(g).toContain('vec3 ground(vec3 p, vec3 rd)');
    expect(g).toContain('sampler2D uBoxTex');
    expect(g).toContain('sampler2D uCellTex');
    expect(g).toContain('max(wall, 0.1200)');          // conservative cell-bounded step (floored above surfEps)
  });

  it('unrolls the per-cell slot loop to match K (tpc = K/4 texels)', () => {
    expect(boxFieldGLSL({ K: 8 })).toContain('t < 2;');    // 8 slots → 2 RGBA texels
    expect(boxFieldGLSL({ K: 4 })).toContain('t < 1;');
  });
});
