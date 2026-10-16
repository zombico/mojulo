/**
 * Vertex contrast: the geocube's shaping of light in the vertex, each term on the smallest face set that shows it.
 */
import { describe, expect, it } from 'vitest';

import { CONTRAST_PRESETS, readContrast, contrastFaces } from './vertex-contrast.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = hexRgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const GREY = '#808080';
// a resolved contrast with every term off: a test turns on the one it studies
const OFF = { hemi: 0, foot: { height: 1.6, depth: 0 }, crevice: 0, ridge: 0, contact: 0, warmCool: 0, variation: 0,
  sky: '#86b4ec', ground: '#6a8a3a', shade: '#4c58b2', key: '#fff4d8', toLight: [0.4, 0.4, 0.82], seed: 7, mode: 'colour' };
const vc = (terms) => ({ ...OFF, ...terms });

// a 4×4 floor at z = 0 and a wall standing on its x = 4 edge, facing the floor, cut in metre cells so light has
// corners to land on; the junction corners are shared
function room() {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out.push({ corners: [[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], normal: [0, 0, 1], fill: GREY, group: 'stage:floor' });
  for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) out.push({ corners: [[4, j, k], [4, j + 1, k], [4, j + 1, k + 1], [4, j, k + 1]], normal: [-1, 0, 0], fill: GREY, group: 'stage:wall' });
  return out;
}
const at = (faces, p) => {
  for (const f of faces) { const k = f.corners.findIndex((c) => c[0] === p[0] && c[1] === p[1] && c[2] === p[2]); if (k >= 0 && f.cornerFills) return f.cornerFills[k]; }
  return null;
};
const wallAt = (faces, p) => at(faces.filter((f) => f.group === 'stage:wall'), p);
const floorAt = (faces, p) => at(faces.filter((f) => f.group === 'stage:floor'), p);

describe('contrast: reading the cube\'s term', () => {
  it('reads a preset, a preset with changes, and the terms alone (the rest off)', () => {
    expect(readContrast('wii')).toEqual({ ...CONTRAST_PRESETS.wii, foot: { ...CONTRAST_PRESETS.wii.foot } });
    expect(readContrast({ from: 'wii', hemi: 0.9 })).toMatchObject({ hemi: 0.9, crevice: CONTRAST_PRESETS.wii.crevice });
    expect(readContrast({ crevice: 0.5 })).toMatchObject({ crevice: 0.5, hemi: 0, foot: { depth: 0 } });
    expect(readContrast({ foot: { depth: 0.3 } }).foot).toEqual({ height: 1.6, depth: 0.3 });
  });
  it('reads absent and false as none', () => {
    expect(readContrast(undefined)).toBeNull();
    expect(readContrast(false)).toBeNull();
  });
  it('refuses what it does not know', () => {
    expect(() => readContrast('ps2')).toThrow(/not a preset/);
    expect(() => readContrast({ glow: 1 })).toThrow(/glow is not a term/);
    expect(() => readContrast({ hemi: 2 })).toThrow(/hemi is 0/);
    expect(() => readContrast({ foot: { height: 0 } })).toThrow(/foot.height/);
    expect(() => readContrast({ foot: { lip: 1 } })).toThrow(/foot.lip is not a setting/);
    expect(() => readContrast(3)).toThrow(/contrast is a preset/);
  });
});

describe('contrast: each term moves what it should', () => {
  it('leaves the faces alone with no contrast, and shapes the same faces the same way twice', () => {
    const faces = room();
    expect(contrastFaces(faces, null)).toBe(faces);
    const spec = vc({ ...readContrast('wii') });
    expect(contrastFaces(room(), spec)).toEqual(contrastFaces(room(), spec));
  });
  it('hemi: what faces up keeps its value and leans to the sky; what faces down darkens', () => {
    const up = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], fill: GREY };
    const down = { ...up, normal: [0, 0, -1] };
    const [u, d] = contrastFaces([up, down], vc({ hemi: 1 }));
    expect(Math.abs(lum(u.fill) - lum(GREY))).toBeLessThan(2);
    expect(lum(d.fill)).toBeLessThan(lum(GREY) - 20);
    const [r, , b] = hexRgb(u.fill);
    expect(b).toBeGreaterThan(r);   // the sky is blue
  });
  it('foot: a wall darkens toward the floor beneath it; the floor is not its own foot', () => {
    const out = contrastFaces(room(), vc({ foot: { height: 2, depth: 0.5 } }));
    expect(lum(wallAt(out, [4, 1, 0]))).toBeLessThan(lum(wallAt(out, [4, 1, 1])));
    expect(lum(wallAt(out, [4, 1, 1]))).toBeLessThan(lum(wallAt(out, [4, 1, 3])));
    expect(wallAt(out, [4, 1, 3])).toBe(GREY);   // past the gradient's height
    expect(floorAt(out, [1, 1, 0])).toBe(GREY);
  });
  it('crevice: the junction of wall and floor darkens; the open floor and wall do not', () => {
    const out = contrastFaces(room(), vc({ crevice: 1 }));
    expect(lum(floorAt(out, [4, 2, 0]))).toBeLessThan(lum(GREY) - 10);
    expect(floorAt(out, [1, 2, 0])).toBe(GREY);
    expect(wallAt(out, [4, 2, 2])).toBe(GREY);
  });
  it('ridge: a convex lip is lifted', () => {
    // a step: a top at z = 1 over a riser facing −x, sharing the lip at x = 0
    const top = { corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], normal: [0, 0, 1], fill: GREY };
    const riser = { corners: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], normal: [-1, 0, 0], fill: GREY };
    const [t] = contrastFaces([top, riser], vc({ ridge: 1 }));
    // the lip most; the corner off it only by the one ring the measure is smoothed over
    expect(lum(t.cornerFills[0])).toBeGreaterThan(lum(t.cornerFills[1]));
    expect(lum(t.cornerFills[1])).toBeGreaterThanOrEqual(lum(GREY));
  });
  it('contact: the AO bake\'s occlusion is folded in toward the shade, and consumed', () => {
    const f = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], fill: GREY, vao: [0.5, 1, 1, 1] };
    const [o] = contrastFaces([f], vc({ contact: 1 }));
    expect(o.vao).toBeUndefined();
    expect(o.cornerFills[1]).toBe(GREY);
    const [r, , b] = hexRgb(o.cornerFills[0]);
    expect(b).toBeGreaterThan(r);   // the shade is a colour (blue-violet), never black
    // a contrast with no contact leaves the AO bake's own darkening to the mesh
    expect(contrastFaces([f], vc({ hemi: 0.5 }))[0].vao).toEqual([0.5, 1, 1, 1]);
  });
  it('warm/cool: the side the key reaches leans to the key, the other to the shade', () => {
    const lit = { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0.6, 0.6, 0.53], fill: GREY };
    const away = { ...lit, normal: [-0.6, -0.6, -0.53] };
    const [l, a] = contrastFaces([lit, away], vc({ warmCool: 1 }));
    const [lr, , lb] = hexRgb(l.fill), [ar, , ab] = hexRgb(a.fill);
    expect(lr - lb).toBeGreaterThan(ar - ab);
  });
  it('variation: value drifts across the world, the same way for the same seed', () => {
    const out = contrastFaces(room(), vc({ variation: 1 }));
    expect(new Set(out.flatMap((f) => f.cornerFills)).size).toBeGreaterThan(4);
    expect(contrastFaces(room(), vc({ variation: 1, seed: 8 }))).not.toEqual(out);
  });
  it('under a tone only value moves: every corner keeps its hue', () => {
    const tinted = room().map((f) => ({ ...f, fill: '#7a6a5a' }));
    const out = contrastFaces(tinted, vc({ ...readContrast('wii'), mode: 'value' }));
    for (const h of out.flatMap((f) => f.cornerFills)) {
      const [r, g, b] = hexRgb(h);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
  });
  it('leaves what lights itself, the air and unlit textures alone', () => {
    const q = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    const kept = [
      { corners: q, fill: '#ff9a3c', emissive: [1, 0.6, 0.2] },
      { corners: q, fill: '#3a3028', group: 'stage:fixture' },
      { corners: q, fill: '#9ab0c0', group: 'isekai:ridge' },
      { corners: q, fill: '#ffffff', texture: 'tile-a', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    ];
    const out = contrastFaces(kept, vc({ ...readContrast('wii') }));
    out.forEach((f, i) => expect(f).toBe(kept[i]));
  });
});
