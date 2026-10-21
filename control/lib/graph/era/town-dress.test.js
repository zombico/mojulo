/**
 * A gritty cube's street dressed from relief (town-dress.js): its walls a detail on their own colour and light, laid
 * world-locked; a quiet cube's street as it was.
 */
import { describe, expect, it } from 'vitest';

import { readGeocube, geocubeTown, assembleGeocubeScene } from './geocube.js';
import { townDressOf, dressTownFace, DETAIL_MEAN } from './town-dress.js';
import { assembleStageScene } from './stage.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linOf = (hex) => [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
const gritty = readGeocube({ from: 'valley-morning', grit: 0.7 }), quiet = readGeocube('valley-morning');
const wall = (w, fill = '#a08c78') => ({ corners: [[0, 0, 0], [w, 0, 0], [w, 0, 3], [0, 0, 3]], normal: [0, -1, 0], group: 'town:wall', fill, cornerFills: [fill, fill, fill, fill] });

describe('a street\'s dress', () => {
  it('is a gritty cube\'s alone: its plaster a render over stone, its stone ashlar, its plinth a course; a quiet cube\'s street has none', () => {
    expect(townDressOf(quiet)).toBeNull();
    expect(townDressOf(readGeocube({ from: 'valley-morning', grit: GRIT_PIXELS - 0.01 }))).toBeNull();
    const D = townDressOf(gritty);
    expect(D['str:plaster'].spec).toMatchObject({ gen: 'dressed', cut: 'render', grit: 0.7 });
    expect(D['str:stone'].spec).toMatchObject({ gen: 'dressed', grit: 0.7 });
    expect(D.plinth.spec).toMatchObject({ gen: 'dressed', rows: 2 });
    expect(geocubeTown(quiet, { settlement: { houses: 2 } }).dress).toBeUndefined();
    expect(geocubeTown(gritty, { settlement: { houses: 2 } }).dress).toEqual(D);
  });

  it('keeps a wall\'s colour and light: its fill lifted by the detail\'s mean, so the two multiplied are the fill again', () => {
    const D = townDressOf(gritty), f = wall(4), d = dressTownFace(f, 'str:plaster', D);
    expect(d.textureLit).toBe(true); expect(d.texture).toMatch(/^detail:dressed-/);
    linOf(d.fill).forEach((v, k) => expect(v * DETAIL_MEAN).toBeCloseTo(linOf(f.fill)[k], 2));
    // (a roof, a floor and a group the dress does not name are left as they were)
    expect(dressTownFace({ ...f, normal: [0, 0, 1] }, 'str:plaster', D)).toEqual({ ...f, normal: [0, 0, 1] });
    expect(dressTownFace(f, 'str:timber', D)).toBe(f);
  });

  it('is laid world-locked: a wall twice as wide carries twice the repeats; the same wall the same bytes', () => {
    const D = townDressOf(gritty), span = (w) => { const u = dressTownFace(wall(w), 'str:stone', D).uv.map((p) => p[0]); return Math.max(...u) - Math.min(...u); };
    expect(span(8)).toBeCloseTo(2 * span(4), 3);
    expect(span(4)).toBeCloseTo(4 / D['str:stone'].metres, 3);
    expect(JSON.stringify(dressTownFace(wall(4), 'str:stone', D))).toBe(JSON.stringify(dressTownFace(wall(4), 'str:stone', D)));
  });

  it('serves its detail as a 512-texel tile', () => {
    const key = dressTownFace(wall(4), 'plinth', townDressOf(gritty)).texture, png = Buffer.from(surfaceTexture(key).split(',')[1], 'base64');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([512, 512]);
  });
});

describe('a cube\'s town dressed', () => {
  it('a gritty cube\'s houses wear it on their stone and plaster walls; a quiet cube\'s town draws no detail', () => {
    const show = (cube) => assembleGeocubeScene({ kind: 'geocube', cube, show: 'town', seed: 3 }, {}, assembleStageScene);
    const lime = show('limestone-crags');
    expect(lime.faces.filter((f) => f.group === 'town:wall' && /^detail:/.test(f.texture || '')).length).toBeGreaterThan(0);
    expect(lime.faces.some((f) => f.group === 'town:opening' && f.texture)).toBe(false);
    expect(show('valley-morning').faces.some((f) => /^detail:/.test(f.texture || ''))).toBe(false);
  });
});
