import { describe, it, expect } from 'vitest';
import { dressedTile } from './dressed.js';
import { tileFamilyOf, normalizeTileSpec } from '../era/tile-specs.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

// DRESSED STONE: ashlar painted from relief as a room's tile. Small repeats keep it quick: the laws are the same at 512.
const CFG = { stone: [176, 168, 150], mortar: [120, 114, 102], metres: 1, rows: 3, cols: 2 };
const lum = (t, i, j) => { const k = (j * t.W + i) * 3; return (t.rgb[k] + t.rgb[k + 1] + t.rgb[k + 2]) / 3; };

describe('a dressed-stone tile', () => {
  const T = dressedTile(CFG, { size: 128, seed: 7 });

  it('is seamless: the step across each edge is no bigger than a step inside', () => {
    let edgeX = 0, inX = 0, edgeY = 0, inY = 0;
    for (let j = 0; j < T.H; j++) { edgeX += Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)); inX += Math.abs(lum(T, T.W / 2, j) - lum(T, T.W / 2 - 1, j)); }
    for (let i = 0; i < T.W; i++) { edgeY += Math.abs(lum(T, i, T.H - 1) - lum(T, i, 0)); inY += Math.abs(lum(T, i, T.H / 2) - lum(T, i, T.H / 2 - 1)); }
    expect(edgeX).toBeLessThan(2 * inX + T.H * 2);
    expect(edgeY).toBeLessThan(2 * inY + T.W * 2);
  });

  it('is the same bytes for the same numbers, and another stone for another seed or finish', () => {
    expect(Buffer.compare(dressedTile(CFG, { size: 128, seed: 7 }).rgb, T.rgb)).toBe(0);
    expect(Buffer.compare(dressedTile(CFG, { size: 128, seed: 8 }).rgb, T.rgb)).not.toBe(0);
    expect(Buffer.compare(dressedTile({ ...CFG, tool: 'pitched' }, { size: 128, seed: 7 }).rgb, T.rgb)).not.toBe(0);
  });

  it('sits its stone round the ramp\'s middle, the mortar darker', () => {
    let s = 0; for (let j = 0; j < T.H; j++) for (let i = 0; i < T.W; i++) s += lum(T, i, j);
    const m = s / (T.W * T.H), stone = CFG.stone.reduce((a, b) => a + b) / 3;
    expect(m).toBeGreaterThan(stone * 0.7); expect(m).toBeLessThan(stone * 1.15);
  });
});

describe('dressed stone as a tile spec', () => {
  it('is refused outside its rails, and its metres are part of what it is', () => {
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], rows: 20 })).toThrow(/rows/);
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], tool: 'chiselled' })).toThrow(/tool/);
    const a = tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102] }), b = tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102], scale: 3 });
    expect(a).toMatch(/^gen:dressed-/); expect(b).not.toBe(a);
  });
  it('is painted past the sixth generation\'s density: 512 texels a side', () => {
    const url = surfaceTexture(`${tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102], scale: 1, rows: 2 })}-a`);
    const png = Buffer.from(url.split(',')[1], 'base64');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([512, 512]);
  });
});
