// The voxel look's laws, on the smallest shapes that exercise each: a box voxelized into its shell within a cube of its
// bounds; only exposed sides drawn; a corner darkened by its neighbours; two bands (a stop each) and the sun's shadow;
// a detail winning its cube; the kit's voxel pole (flat colour, no tiles) and a set piece in cubes; determinism.
import { describe, it, expect } from 'vitest';
import { voxelize, voxelFaces, voxelSizeFor, AO_LEVELS } from './voxel-look.js';
import { trackKit } from './track-kit.js';
import { TRACK_BLOCKS, SETS, paintPiece } from './set-pieces.js';
import { buildBlock } from '../era/blocks.js';
import { SWATCH_KITS } from '../era/style/swatches.js';

const boxFaces = ([x0, y0, z0], [x1, y1, z1], extra = {}) => [
  [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
  [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
  [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
].map(([a, b, c, d, n]) => ({ corners: [a, b, c, d], normal: n, ...extra }));
const BANDS = { lit: [0.8, 0.2, 0.2], top: [0.9, 0.3, 0.3], shade: [0.4, 0.1, 0.3] };
const hexOf = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

describe('the voxel look', () => {
  it('voxelizes a box into its shell, within a cube of its bounds', () => {
    const v = voxelize(boxFaces([0, 0, 0], [2, 3, 1]), { size: 0.5, colourOf: () => BANDS });
    const ext = (k) => [Math.min(...[...v.cells.values()].map((c) => c[k])), Math.max(...[...v.cells.values()].map((c) => c[k]))];
    expect(ext('i')).toEqual([0, 3]); expect(ext('j')).toEqual([0, 5]); expect(ext('k')).toEqual([0, 1]);
    expect(voxelSizeFor({ lo: [0, 0, 0], hi: [24, 4, 4] })).toBe(1);
  });
  it('draws only exposed sides, a corner darkened by the cubes round it', () => {
    const cell = (i, j, k) => [`${i},${j},${k}`, { i, j, k, rgb: BANDS }];
    const v = { size: 1, cells: new Map([cell(0, 0, 0), cell(1, 0, 0), cell(1, 0, 1)]) };   // a step
    const f = voxelFaces(v, { shadows: false, jitter: 0 });
    // three cubes, the shared sides hidden: 18 − 4 sides, merged runs counted once
    expect(f.length).toBeLessThan(18);
    const top0 = f.find((x) => x.corners.every((p) => p[2] === 1) && x.corners.every((p) => p[0] <= 1));   // the low cube's top
    expect(top0.cornerFills).toBeTruthy();
    expect(new Set(top0.cornerFills).size).toBeGreaterThan(1);   // darker at the step's foot
    expect(AO_LEVELS[0]).toBeLessThan(AO_LEVELS[3]);
  });
  it('bands by stop, and the sun\'s shadow falls on what it reaches past a tower', () => {
    const cells = new Map();
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) cells.set(`${i},${j},0`, { i, j, k: 0, rgb: BANDS });
    for (let k = 1; k <= 8; k++) cells.set(`0,0,${k}`, { i: 0, j: 0, k, rgb: BANDS });
    const tops = voxelFaces({ size: 1, cells }, { jitter: 0 }).filter((x) => x.corners.every((p) => p[2] === 1));
    const fills = new Set(tops.flatMap((x) => [x.fill, ...(x.cornerFills ?? [])]));
    expect(fills.has(hexOf(BANDS.top))).toBe(true);
    expect([...fills].some((h) => h === hexOf(BANDS.shade))).toBe(true);   // the tower's shadow on the plate
  });
  it('a detail proud of a wall wins its cube; deterministic', () => {
    const wall = boxFaces([0, 0, 0], [4, 1, 3], { group: 'body' }), band = boxFaces([0, -0.1, 1], [4, 0, 1.6], { group: 'glass' });
    const v = voxelize([...wall, ...band], { size: 1, colourOf: (f) => f.group, priorityOf: (f) => (f.group === 'glass' ? 3 : 0) });
    expect([...v.cells.values()].some((c) => c.rgb === 'glass')).toBe(true);
    const a = voxelFaces(voxelize(wall, { size: 0.5, colourOf: () => BANDS }), {}), b = voxelFaces(voxelize(wall, { size: 0.5, colourOf: () => BANDS }), {});
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('the kit\'s voxel pole: flat colour, no tiles; a set piece in cubes', () => {
    const K = trackKit({ id: SWATCH_KITS[0], pole: 'voxel' });
    expect(K.pole).toBe('voxel');
    const q = K.surface('asphalt', [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(q.texture).toBeUndefined();
    const id = SETS.kart.focus.built, b = buildBlock(TRACK_BLOCKS[id], { library: TRACK_BLOCKS }), f = paintPiece(b.faces, K);
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) { expect(x.corners.length).toBe(4); expect(x.texture).toBeUndefined(); }
    // every side axis-aligned: cubes
    for (const x of f) expect([0, 1, 2].some((ax) => x.corners.every((p) => Math.abs(p[ax] - x.corners[0][ax]) < 1e-6))).toBe(true);
  });
});
