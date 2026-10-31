/**
 * The form render's grass (scene/channels/form-grass.js): every sward has its clump, the short one spares polygons, each
 * length its own areas, all of it placed once over the map and drawn as the camera's mode has it, and the page's block
 * parses.
 */
import { describe, expect, it } from 'vitest';

import { GRASS_TIERS, SWARD_LENGTH, STILL_FIELD, POV_GRASS, GRASS_HEIGHT, formGrassScript } from './form-grass.js';
import { SWARDS } from '../../era/biocube.js';

// a clump's triangles: each blade a strip of segments, two triangles a segment (the tip narrowed, not closed); a
// bristle, one segment, a single triangle, and its dark twin another
const tris = (c) => c.blades * (c.segs === 1 ? (c.dark ? 2 : 1) : c.segs * 2);

describe('form grass', () => {
  it('each of the biocube\'s swards grows a clump, and the short one\'s clump spends fewer triangles', () => {
    for (const w of SWARDS) expect(GRASS_TIERS.some((t) => t.sward === w)).toBe(true);
    const tall = GRASS_TIERS.find((t) => t.sward === 'tall'), short = GRASS_TIERS.find((t) => t.sward === 'short');
    expect(tris(short.clump)).toBeLessThan(tris(tall.clump));
  });

  it('each length its own areas: one tier a sward, their bands on the map apart, the medium between the tall and the short', () => {
    const ws = GRASS_TIERS.map((t) => t.sward);
    expect(new Set(ws).size).toBe(ws.length);
    const L = ['tall', 'medium', 'short'].map((w) => SWARD_LENGTH[w]);
    expect(L).toEqual([...L].sort((a, b) => a - b));
    for (let i = 1; i < L.length; i++) expect(L[i] - L[i - 1]).toBeGreaterThanOrEqual(2 * SWARD_LENGTH.band);
    const top = (w) => { const T = GRASS_TIERS.find((t) => t.sward === w); return T.scale * T.clump.height[1]; };
    expect(top('tall')).toBeGreaterThan(top('medium'));
    expect(top('medium')).toBeGreaterThan(top('short'));
    // (on the page each tier keeps to its band: no clump where the sward is another length)
    expect(formGrassScript()).toContain('const dL = Math.abs(m.sw - SL[T.sward]) / SL.band; if (dL >= 1) return;');
  });

  it('the short sward is a bed: bristles scattered over the cell, so its cells run together, each with a dark twin', () => {
    const C = GRASS_TIERS.find((t) => t.sward === 'short').clump;
    expect(C.bed).toBe(true);
    expect(C.dark).toBe(true);
  });

  it('the field: the grass and the drifts placed once over the map, in tiles, nothing following the eye, nothing dithered', () => {
    const src = formGrassScript();
    expect(STILL_FIELD.tile).toBeGreaterThan(0);
    expect(src).toContain('const stand = (tg, R, mat, kind = \'grass\') => {');
    // (no grid that walks with the camera, no carpet, no far forms: what is placed is placed once)
    expect(src).not.toContain('cameraPosition.xy / uSp');
    expect(src).not.toContain('form-grass-patch');
    expect(src).not.toContain("['near', 'far']");
    expect(src).not.toContain('aShell');
    expect(src).not.toContain('> vFade ) discard');
    expect(GRASS_TIERS.some((t) => t.sward === 'any')).toBe(false);
  });

  it('by the camera\'s mode: POV real grass to the view cone\'s reach, thinning, strands past it; aerial all of it', () => {
    const src = formGrassScript();
    // (no share of the map: the reach is the cone's, and a tile its frustum does not see is not drawn)
    expect(POV_GRASS.share).toBeUndefined();
    expect(src).toContain('const CONE = window.__mojCone');
    expect(src).toContain('PV.uPovR.value = pov ? RP : 1e6');
    expect(src).toContain('&& CONE.sees(T.s)');
    expect(POV_GRASS.thin).toBeLessThan(1);
    expect(POV_GRASS.strands.px).toBeGreaterThan(0);
    expect(src).toContain('window.__formGrassView = (v) =>');
    expect(src).toContain("'form-grass-strands'");
  });

  it('wanders in height (a slow field, taller and shorter stretches, each clump its own share), and carries a few weeds', () => {
    expect(GRASS_HEIGHT.range[0]).toBeLessThan(1);
    expect(GRASS_HEIGHT.range[1]).toBeGreaterThan(1);
    expect(GRASS_HEIGHT.clump).toBeGreaterThan(0);
    const src = formGrassScript();
    expect(src).toContain('T.scale * tall(x, y) * (1 + GH.clump');
    expect(src).toContain('const Wd = Gm.weeds;');
  });

  it('bends in the page\'s one gust field when it has one, and stands still when it has none', () => {
    const src = formGrassScript();
    expect(src).toContain('mojWindAt');
    expect(src).toContain('__mojTerrain');
    expect(src).not.toContain('brush');
    expect(src).toContain('fgBend');
  });

  it('the page\'s block parses, and names every tier', () => {
    const src = formGrassScript();
    expect(() => new Function('THREE', 'scene', 'D', 'LAYER_U', 'bytes', src)).not.toThrow();
    for (const t of GRASS_TIERS) expect(src).toContain(t.id);
  });
});
