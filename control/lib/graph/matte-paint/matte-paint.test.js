import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { paintSurface, readMatte } from './index.js';
import { reliefField } from './relief.js';
import { lightRelief } from './light.js';

// MICRO MATTE PAINTING: a face painted from its relief and a light, cut to its outline. Small faces: the concepts, not
// a catalogue of finishes.
const RAMP = ['#202428', '#40464e', '#666d76', '#9aa0a8', '#d4d8dc'];
const face = (more = {}) => ({ outline: { shape: 'block', w: 0.4, h: 0.2 }, ppm: 128, seed: 3, paint: { ramp: RAMP }, ...more });
// the PNG's RGBA texels back (the encoder's own layout: one filter byte per row, colour type 6)
function texels(png) {
  let o = 8; const idat = []; let W = 0;
  while (o < png.length) { const len = png.readUInt32BE(o), type = png.toString('ascii', o + 4, o + 8); if (type === 'IHDR') W = png.readUInt32BE(o + 8); if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), row = 1 + W * 4;
  return (x, y) => [...raw.subarray(y * row + 1 + x * 4, y * row + 5 + x * 4)];
}
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('a matte-painted face', () => {
  it('paints the same bytes every time, and another seed paints another face', () => {
    const a = paintSurface(face()), b = paintSurface(face());
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.png.equals(paintSurface(face({ seed: 4 })).png)).toBe(false);
    expect([a.W, a.H]).toEqual([51, 26]);
  });

  it('is cut to its outline: clear outside, solid inside', () => {
    const { png, W, H } = paintSurface(face({ outline: { shape: 'block', w: 0.4, h: 0.2, round: 0.05 }, relief: { spall: false } })), at = texels(png);
    expect(at(0, 0)[3]).toBe(0);
    expect(at(Math.floor(W / 2), Math.floor(H / 2))[3]).toBe(255);
  });

  it('a spall breaks the outline: where the fracture falls deep enough the stone is gone', () => {
    const S = readMatte(face({ grit: 1, relief: { spall: { count: 8, depth: 0.05, cut: 0.006 } } }));
    const f = reliefField({ outline: S.outline, ppm: S.ppm, relief: S.relief, grit: 1, seed: S.seed });
    const plain = reliefField({ outline: S.outline, ppm: S.ppm, relief: { ...S.relief, spall: false }, grit: 1, seed: S.seed });
    const solid = (F) => F.inside.reduce((n, d) => n + (d > 0), 0);
    expect(solid(f)).toBeLessThan(solid(plain));
  });

  it('the light is held at a mean of 1, so the vertex light still does the large shading', () => {
    const S = readMatte(face({ grit: 1 }));
    const f = reliefField({ outline: S.outline, ppm: S.ppm, relief: S.relief, grit: 1, seed: S.seed }), { value } = lightRelief(f, S.light);
    let s = 0, n = 0; f.inside.forEach((d, k) => { if (d > 0) { s += value[k]; n++; } });
    expect(Math.abs(s / n - 1)).toBeLessThan(1e-3);
  });

  it('no line is drawn: a groove reads by its walls, the one facing the light lighter', () => {
    // a V-groove down the middle of a flat face, lit from the left and then from the right
    const W = 40, H = 20, px = 1 / 128, height = new Float32Array(W * H), inside = new Float32Array(W * H).fill(1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) height[j * W + i] = -0.006 * Math.max(0, 1 - Math.abs(i - 20) / 4);
    const field = { W, H, px, height, inside }, L = readMatte(face()).light;
    const left = lightRelief(field, { ...L, az: 180, el: 35 }).value, right = lightRelief(field, { ...L, az: 0, el: 35 }).value;
    const k = (i) => 10 * W + i;
    // from the left, the wall that faces left (right of the axis) is lit and its opposite shaded; and the other way round
    expect(left[k(22)]).toBeGreaterThan(left[k(18)]);
    expect(right[k(18)]).toBeGreaterThan(right[k(22)]);
  });

  it('grit roughens it: the light varies more across a gritty face', () => {
    const spread = (grit) => {
      const S = readMatte(face({ grit })), f = reliefField({ outline: S.outline, ppm: S.ppm, relief: S.relief, grit, seed: S.seed }), { value } = lightRelief(f, S.light);
      let s = 0, s2 = 0, n = 0; f.inside.forEach((d, k) => { if (d > 0.02) { s += value[k]; s2 += value[k] * value[k]; n++; } });
      return Math.sqrt(s2 / n - (s / n) * (s / n));
    };
    expect(spread(1)).toBeGreaterThan(spread(0) * 1.5);
  });

  it('a layer that is absent adds nothing', () => {
    const g = { grit: 0.6 };
    expect(paintSurface(face({ ...g, relief: { pit: false } })).png.equals(paintSurface(face({ ...g, relief: { pit: { density: 0 } } })).png)).toBe(true);
    expect(paintSurface(face(g)).png.equals(paintSurface(face({ ...g, paint: { ramp: RAMP, moss: false } })).png)).toBe(true);
  });

  it('the spec is checked: a setting outside its range, a layer it does not have, the ramp it needs', () => {
    expect(() => paintSurface(face({ relief: { groove: { width: 0.5 } } }))).toThrow(/relief\.groove\.width is a number from 0\.001 to 0\.02/);
    expect(() => paintSurface(face({ relief: { stripes: {} } }))).toThrow(/relief\.stripes is not a layer/);
    expect(() => paintSurface({ outline: { shape: 'block', w: 0.4, h: 0.2 }, paint: {} })).toThrow(/the ramp is the material/);
    expect(() => paintSurface(face({ paint: { ramp: RAMP, moss: {} } }))).toThrow(/paint\.moss\.ramp is the colour it lays in/);
    expect(() => paintSurface(face({ outline: { shape: 'block', w: 3, h: 3 }, ppm: 512 }))).toThrow(/at most 1024 a side/);
  });
});
