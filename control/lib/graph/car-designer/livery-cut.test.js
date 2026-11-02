// The livery, cut: a field vehicle's paint as words. The words read whole (a pattern or the object, its colours, scale,
// angle, seed and marks) and refused naming what they take; a setting read to its camo; a camo cut into the base paint
// only, each band its share of the painted area, the area kept, the same twice and another seed another pattern; a
// digital pattern cut at its cells; mono a recolour; the stencils read left to right as one faces them. One pattern per
// way of cutting, chosen in code.
import { describe, it, expect } from 'vitest';
import { readLivery, camoForSetting, paintLivery, stencilMarks, liveryBase, CAMO, CAMO_IDS, LIVERY_PATTERNS } from './livery-cut.js';
import { plate } from './mil-hull.js';
import { flatNormals } from './mil-hull.js';

const BASE = '#4b5320', OTHER = '#7a2a1c';
const areaOf = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]; } return Math.hypot(...n) / 2; };
// a box hull the size of a small vehicle, in the base paint, and a red fitting beside it
const hull = () => flatNormals([
  ...plate({ axis: 'y', profile: [[-1, 0.4], [1, 0.4], [1, 1.4], [-1, 1.4]], from: -2, to: 2, r: 0.04, seg: 2, look: { part: 'hull', material: 'milPaint', albedo: BASE } }),
  ...plate({ axis: 'z', profile: [[1, 0], [1.2, 0], [1.2, 0.2], [1, 0.2]], from: 1, to: 1.2, look: { part: 'shackle', material: 'milPaint', albedo: OTHER } }),
]);
const SMOOTH = CAMO_IDS.find((k) => !CAMO[k].cell), CELLED = CAMO_IDS.find((k) => CAMO[k].cell);

describe('the words', () => {
  it('reads a pattern word or the whole object, the pattern\'s own filling what is not said', () => {
    const L = readLivery(SMOOTH);
    expect(L).toMatchObject({ pattern: SMOOTH, colours: CAMO[SMOOTH].colours, scale: CAMO[SMOOTH].scale, angle: 0, marks: { number: null, emblem: 'chevron' } });
    const own = readLivery({ pattern: SMOOTH, colours: ['#C2B280'], scale: 1.2, angle: 30, seed: 4, marks: { number: '207', emblem: false } });
    expect(own.colours[0]).toBe('#c2b280');
    expect(own.colours.slice(1)).toEqual(CAMO[SMOOTH].colours.slice(1));
    expect(own).toMatchObject({ scale: 1.2, angle: 30, seed: 4, marks: { number: '207', emblem: false } });
    expect(readLivery({ pattern: SMOOTH, marks: false }).marks).toBe(false);
    expect(readLivery(undefined)).toBe(null);
    expect(liveryBase(own)).toBe('#c2b280');
  });
  it('refuses what it does not take, naming what it does', () => {
    expect(() => readLivery('paisley')).toThrow(new RegExp(LIVERY_PATTERNS.join(' \\| ')));
    expect(() => readLivery({ pattern: SMOOTH, colour: '#fff' })).toThrow(/'colour' is not one of its words/);
    expect(() => readLivery({ pattern: SMOOTH, colours: CAMO[SMOOTH].colours.concat('#000000') })).toThrow(/colours are up to/);
    expect(() => readLivery({ pattern: SMOOTH, scale: 9 })).toThrow(/0\.15 to 3/);
    expect(() => readLivery({ pattern: SMOOTH, marks: { number: 'A1' } })).toThrow(/one to four digits/);
  });
  it('a setting reads its camo from its kit, its biome or its words; a setting that says nothing reads none', () => {
    expect(camoForSetting({ kit: 'jungle-trail' })).toBe('tiger');
    expect(camoForSetting({ biome: 'desert' })).toBe('desert');
    expect(camoForSetting({ words: 'a snowbound pass' })).toBe('winter');
    expect(camoForSetting({ kit: 'trail-valley' })).toBe('woodland');
    expect(camoForSetting({})).toBe(null);
    for (const c of [camoForSetting({ kit: 'jungle-trail' }), camoForSetting({ biome: 'desert' })]) expect(CAMO_IDS).toContain(c);
  });
});

describe('the cut', () => {
  // (what faces the ground stands out of the shares: it is one colour, unseen)
  const faces = hull(), painted = faces.filter((f) => f.albedo === BASE), area = painted.reduce((s, f) => s + areaOf(f.corners), 0);
  const seen = (fs) => fs.filter((f) => f.outNormal[2] > -0.6), seenArea = seen(painted).reduce((s, f) => s + areaOf(f.corners), 0);
  it('a camo cuts the base paint only: its bands each their share of the painted area, the area kept, every piece lit', () => {
    const L = readLivery(SMOOTH), out = paintLivery(faces, L, { base: BASE, seed: 3 });
    expect(out.filter((f) => f.albedo === OTHER)).toEqual(faces.filter((f) => f.albedo === OTHER));
    const pieces = out.filter((f) => f.part === 'hull');
    expect(pieces.length).toBeGreaterThan(painted.length);
    expect(pieces.every((f) => L.colours.includes(f.albedo))).toBe(true);
    expect(pieces.reduce((s, f) => s + areaOf(f.corners), 0) / area).toBeCloseTo(1, 3);
    CAMO[SMOOTH].shares.forEach((share, b) => {
      const got = seen(pieces).filter((f) => f.albedo === L.colours[b]).reduce((s, f) => s + areaOf(f.corners), 0) / seenArea;
      expect(Math.abs(got - share), `band ${b}`).toBeLessThan(0.06);
    });
    for (const f of pieces) {
      expect(f.cornerNormals).toHaveLength(f.corners.length);
      for (const n of f.cornerNormals) expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(1e-4);
    }
  });
  it('is the same twice, and another seed lays another pattern', () => {
    const L = readLivery(SMOOTH), a = paintLivery(faces, L, { base: BASE, seed: 3 });
    expect(JSON.stringify(paintLivery(faces, L, { base: BASE, seed: 3 }))).toBe(JSON.stringify(a));
    expect(JSON.stringify(paintLivery(faces, L, { base: BASE, seed: 4 }))).not.toBe(JSON.stringify(a));
  });
  it('a digital pattern is cut at its cells: each piece inside one cell, one colour', () => {
    const L = readLivery(CELLED), cell = CAMO[CELLED].cell, out = paintLivery(faces, L, { base: BASE, seed: 3 }).filter((f) => f.part === 'hull');
    for (const f of seen(out)) {
      const mid = [0, 1, 2].map((k) => f.corners.reduce((s, p) => s + p[k], 0) / f.corners.length), at = mid.map((x) => Math.floor(x / cell));
      for (const p of f.corners) for (let k = 0; k < 3; k++) { expect(p[k]).toBeGreaterThanOrEqual(at[k] * cell - 1e-5); expect(p[k]).toBeLessThanOrEqual((at[k] + 1) * cell + 1e-5); }
    }
    expect(out.reduce((s, f) => s + areaOf(f.corners), 0) / area).toBeCloseTo(1, 3);
  });
  it('mono recolours the base and cuts nothing; no livery leaves the faces as they were', () => {
    const out = paintLivery(faces, readLivery({ pattern: 'mono', colours: ['#b49b6c'] }), { base: BASE });
    expect(out).toHaveLength(faces.length);
    expect(out.filter((f) => f.part === 'hull').every((f) => f.albedo === '#b49b6c')).toBe(true);
    expect(paintLivery(faces, null, { base: BASE })).toBe(faces);
  });
});

describe('the stencils', () => {
  const A = (role, out, up) => ({ id: 'm', kind: 'mark', role, at: [0, 0, 1], out, up, h: 0.1 });
  it('a number reads left to right as one faces it, one stencil segment a face; an emblem; none when marks are false', () => {
    const L = readLivery({ pattern: SMOOTH, marks: { number: '17', emblem: false } });
    // facing a surface that looks along −y (standing at −y, looking +y), one's right is +x
    const out = stencilMarks([A('number', [0, -1, 0], [0, 0, 1])], L);
    expect(out).toHaveLength('bc'.length + 'abc'.length);
    const xs = out.map((f) => f.corners.reduce((s, p) => s + p[0], 0) / 4), firstDigit = xs.slice(0, 2), second = xs.slice(2);
    expect(Math.max(...firstDigit)).toBeLessThan(Math.min(...second));
    for (const f of out) expect(f.outNormal[1]).toBeCloseTo(-1, 6);
    expect(stencilMarks([A('emblem', [0, -1, 0], [0, 0, 1])], readLivery(SMOOTH))).toHaveLength(2);
    expect(stencilMarks([A('number', [0, -1, 0], [0, 0, 1])], readLivery({ pattern: SMOOTH, marks: false }))).toEqual([]);
  });
});
