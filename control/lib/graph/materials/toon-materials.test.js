/**
 * Toon materials: a hero's materials lowered for the character light (drawn, not reflected), and an anime hero on a cube
 * that names `materials` under its named character light taking them in its light, with no live metal on its faces.
 */
import { describe, expect, it } from 'vitest';

import { toonMaterials, TOON_MATERIAL } from './toon-materials.js';
import { lchOf, hexToRgb } from '../color-theorist/oklab.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveCharacterLight } from '../polygonizer/station-loft-shade.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const lch = (hex) => lchOf(hexToRgb(hex));

describe('toon materials: the lowering', () => {
  const palette = { Plate: '#aeb4bb', Trim: '#c9a55a', Leather: '#5a3a22', Visor: '#203040', Suit: '#2a2a30', Lacquer: '#8a2020', Odoshi: '#30406a' };
  const T = toonMaterials({ Plate: { metal: 'steel', finish: 'brushed' }, Trim: { metal: 'gold', finish: 'polished' }, Leather: 'leather', Visor: 'glass', Suit: 'rubber', Lacquer: 'satin', Odoshi: 'matte' }, palette);

  it('draws metal by its dark: a higher step, a darker shade leaning warm for gold and cool for steel, a gloss', () => {
    expect(T.thresholds).toMatchObject({ Plate: TOON_MATERIAL.metal.threshold, Trim: TOON_MATERIAL.metal.threshold });
    for (const g of ['Plate', 'Trim']) expect(lch(T.shade[g])[0]).toBeLessThan(lch(palette[g])[0] * 0.6);
    const [, , goldH] = lch(T.shade.Trim), [, , steelH] = lch(T.shade.Plate);
    expect(goldH).toBeLessThan(90);              // toward red-orange
    expect(steelH).toBeGreaterThan(200);         // toward blue
    expect(T.highlight.Plate).toMatchObject({ kind: 'gloss', threshold: TOON_MATERIAL.metal.gloss, band: [0, 1] });
    expect(lch(T.highlight.Trim.colour)[0]).toBeGreaterThan(0.9);
  });

  it('gives lacquer a small gloss, leather a warm shade and a dull band, glass a white glint, rubber a deeper shade, cloth nothing', () => {
    expect(T.highlight.Lacquer.threshold).toBe(TOON_MATERIAL.satin.gloss);
    expect(T.thresholds.Leather).toBe(TOON_MATERIAL.leather.threshold);
    expect(T.highlight.Leather.band).toEqual([0, TOON_MATERIAL.leather.band]);
    expect(T.highlight.Visor.colour).toBe('#ffffff');
    expect(T.shade.Suit).toBeDefined();
    expect(T.highlight).not.toHaveProperty('Suit');
    for (const k of ['thresholds', 'shade', 'highlight']) expect(T[k]).not.toHaveProperty('Odoshi');
  });

  it('is null with nothing to lower: no surfaces, or none the palette paints', () => {
    expect(toonMaterials(null, palette)).toBeNull();
    expect(toonMaterials({ Plate: { metal: 'steel' } }, {})).toBeNull();
    expect(toonMaterials({ Odoshi: 'matte' }, palette)).toBeNull();
  });
});

describe('toon materials: an anime hero under the character light', () => {
  const anime = (geocube) => expandLayeredManifest({ kind: 'layered', toon: { light: true }, hero: heroRecord({ cast: 'female', head: 'anime', adorn: { type: 'armor', style: 'knight' }, ...(geocube ? { geocube } : {}) }) });

  it('takes its cube\'s materials drawn in its light; a hero without them keeps the light as it was', () => {
    const worn = resolveCharacterLight(anime('upland-morning')), plain = resolveCharacterLight(anime('valley-morning'));
    expect(worn.thresholds.Plate).toBe(TOON_MATERIAL.metal.threshold);
    expect(worn.highlight.Plate).toMatchObject({ kind: 'gloss' });
    expect(typeof worn.shade.Plate).toBe('string');
    expect(plain.thresholds?.Plate).toBeUndefined();
  });

  it('wears no live metal: the plate is drawn, not reflected', async () => {
    const { payload } = await resolveWorldScene({ title: 't', manifest: anime('upland-morning') });
    expect(payload.faces.filter((f) => f.metal)).toHaveLength(0);
    expect((payload.figures?.body?.parts ?? []).filter((p) => p?.metal)).toHaveLength(0);
  }, 120000);
});
