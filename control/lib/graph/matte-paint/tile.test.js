import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { paintRockTile, readRockTile } from './tile.js';

// A ROCK FACE TILE: periodic both ways, a detail texture held at its mean. A small tile: the concepts.
const small = { w: 2, h: 2, ppm: 32, seed: 5, grit: 0.8 };
function rows(png) {
  let o = 8; const idat = []; let W = 0, H = 0;
  while (o < png.length) { const len = png.readUInt32BE(o), type = png.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { W = png.readUInt32BE(o + 8); H = png.readUInt32BE(o + 12); } if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), row = 1 + W * 3;
  return { W, H, at: (x, y) => raw[y * row + 1 + x * 3 + 1] };   // the green channel
}

describe('a rock face tile', () => {
  it('paints the same bytes every time', () => {
    expect(paintRockTile(small).png.equals(paintRockTile(small).png)).toBe(true);
  });

  it('meets itself at both edges: the seam is no rougher than the tile inside', () => {
    const { W, H, at } = rows(paintRockTile(small).png), col = (a, b) => { let s = 0; for (let y = 0; y < H; y++) s += Math.abs(at(a, y) - at(b, y)); return s / H; };
    const row = (a, b) => { let s = 0; for (let x = 0; x < W; x++) s += Math.abs(at(x, a) - at(x, b)); return s / W; };
    let inside = 0; for (let x = 1; x < W; x++) inside += col(x - 1, x); inside /= W - 1;
    let insideY = 0; for (let y = 1; y < H; y++) insideY += row(y - 1, y); insideY /= H - 1;
    expect(col(W - 1, 0)).toBeLessThan(inside * 2.5);
    expect(row(H - 1, 0)).toBeLessThan(insideY * 2.5);
  });

  it('is a detail texture: its mean, in linear light, is the mean it names', () => {
    const t = paintRockTile(small);
    expect(Math.abs(t.measured - t.mean)).toBeLessThan(0.03);
  });

  it('a quieter tile varies less', () => {
    const spread = (grit) => { const { W, H, at } = rows(paintRockTile({ ...small, grit }).png); let s = 0, s2 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = at(x, y); s += v; s2 += v * v; } const n = W * H; return Math.sqrt(s2 / n - (s / n) ** 2); };
    expect(spread(0.1)).toBeLessThan(spread(1));
  });

  it('is checked', () => {
    expect(() => readRockTile({ beds: { count: 40 } })).toThrow(/beds\.count is a whole number from 1 to 16/);
    expect(() => readRockTile({ rock: 'cheese' })).toThrow(/rock is a rock preset/);
    expect(() => readRockTile({ moss: {} })).toThrow(/moss is not part of a rock tile/);
    expect(readRockTile({ joints: false }).joints).toBe(false);
  });
});
