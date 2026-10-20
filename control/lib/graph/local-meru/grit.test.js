/**
 * Rock takes pixels when the style is gritty (shading `grit`): at GRIT_PIXELS or over, the cliff faces take a matte rock
 * tile as a detail texture over the light the land gives them, their vertex colour lifted by the tile's mean; under it,
 * or absent, the land is as it was. On one small island.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru, GRIT_PIXELS } from './plan.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const build = (shading) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: { geology: true, walk: 'base' }, shading } }, {});
const base = build(true), quiet = build({ grit: GRIT_PIXELS - 0.1 }), gritty = build({ grit: 0.7 });
const lin = (h) => [1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });

describe('rock takes pixels in a gritty style', () => {
  it('a quiet style\'s land is as it was, byte for byte', () => {
    expect(JSON.stringify(quiet.faces)).toBe(JSON.stringify(base.faces));
  });

  it('a gritty style\'s cliffs take the matte rock tile, and nothing else does', () => {
    const cliffs = gritty.faces.filter((f) => f.group === 'isekai:cliff');
    expect(cliffs.length).toBe(base.faces.filter((f) => f.group === 'isekai:cliff').length);
    expect(cliffs.every((f) => /^matte:rock-/.test(f.texture) && f.textureLit && f.uv.length === f.corners.length)).toBe(true);
    const rest = (p) => JSON.stringify(p.faces.filter((f) => f.group !== 'isekai:cliff'));
    expect(rest(gritty)).toBe(rest(base));
    expect(surfaceTexture(cliffs[0].texture)).toMatch(/^data:image\/png;base64,/);
  });

  it('the cliff keeps its light: its vertex colour is lifted by the tile\'s mean, so the product averages the same', () => {
    const was = base.faces.filter((f) => f.group === 'isekai:cliff'), now = gritty.faces.filter((f) => f.group === 'isekai:cliff');
    let n = 0;
    for (let i = 0; i < was.length; i += 7) {
      const a = lin(was[i].fill), b = lin(now[i].fill);
      for (let q = 0; q < 3; q++) if (b[q] < 0.999) { expect(Math.abs(b[q] * 0.72 - a[q])).toBeLessThan(0.01); n++; }
    }
    expect(n).toBeGreaterThan(10);
  });

  it('a geocube carries its grit into the land, and the land checks it', () => {
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.7 }), 'outside').meru.shading.grit).toBe(0.7);
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru.shading.grit).toBeUndefined();
    expect(() => readGeocube({ from: 'valley-morning', grit: 2 })).toThrow(/grit is how gritty the style is/);
    expect(() => readLocalMeru({ shading: { grit: -1 } })).toThrow(/shading\.grit is 0\.\.1/);
  });
});
