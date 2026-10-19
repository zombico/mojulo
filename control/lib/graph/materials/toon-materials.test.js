/**
 * Toon materials: a hero's materials lowered for the character light (drawn, not reflected), and an anime hero on a cube
 * that names `materials` under its named character light taking them in its light, with no live metal on its faces.
 */
import { describe, expect, it } from 'vitest';

import { toonMaterials, TOON_MATERIAL } from './toon-materials.js';
import { lchOf, hexToRgb } from '../color-theorist/oklab.js';
import { heroRecord, expandLayeredManifest, planMaterialsErrors } from '../../mcp/tools/layered.js';
import { recipeTones, CREATURE_MATERIALS } from './dress-materials.js';
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

  it('keeps a coloured tone\'s hue in a steel shade (an orange body worked in steel never shades magenta)', () => {
    const [, , h0] = lch('#ee6611'), [, , h1] = lch(toonMaterials({ Body: { metal: 'steel', finish: 'brushed' } }, { Body: '#ee6611' }).shade.Body);
    expect(Math.abs(((h1 - h0 + 540) % 360) - 180)).toBeLessThan(25);
  });

  it('draws the cloths: silk a soft sheen, velvet deep and more in shade, wool soft, denim cool, linen as it was', () => {
    const P = { A: '#9a1f2e', B: '#24306e', C: '#806040', D: '#30508a', E: '#e0d8c8' };
    const C = toonMaterials({ A: 'silk', B: 'velvet', C: 'wool', D: 'denim', E: 'linen' }, P);
    expect(C.highlight.A).toMatchObject({ kind: 'gloss', threshold: TOON_MATERIAL.silk.gloss });
    expect(C.thresholds.B).toBe(TOON_MATERIAL.velvet.threshold);
    expect(lch(C.shade.B)[0]).toBeLessThan(lch(P.B)[0] * 0.65);
    expect(C.thresholds.C).toBeLessThan(0);
    expect(lch(C.shade.C)[0]).toBeGreaterThan(lch(P.C)[0] * 0.75);
    expect(C.shade.D).toBeDefined();
    for (const k of ['thresholds', 'shade', 'highlight']) expect(C[k]).not.toHaveProperty('E');
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

describe('toon materials: a creature on its level', () => {
  const PLAN = {
    schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' }, joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
    segments: [
      { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, group: 'Torso', tint: '#a85' },
      { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, group: 'Horn', tint: '#ddd3bd', mirror: 'name' },
    ],
  };
  const creature = (plan, geocube) => expandLayeredManifest({ kind: 'layered', plan, ...(geocube ? { geocube } : {}) });

  it('reads its tones off its parts\' tints, and wears its body\'s horn and its plan\'s materials, drawn in its light', () => {
    const plain = creature(PLAN);
    expect(recipeTones(plain.recipe)).toMatchObject({ Torso: '#aa8855', Horn: '#ddd3bd' });
    expect(plain.recipe).not.toHaveProperty('surfaces');
    const worn = creature({ ...PLAN, materials: { Torso: { metal: 'bronze', finish: 'polished' } } }, 'upland-morning');
    expect(worn.recipe.surfaces).toEqual({ Horn: CREATURE_MATERIALS.Horn, Torso: { metal: 'bronze', finish: 'polished' } });
    const L = resolveCharacterLight(worn), L0 = resolveCharacterLight(plain);
    expect(L.thresholds.Torso).toBe(TOON_MATERIAL.metal.threshold);
    expect(L.highlight.Horn).toMatchObject({ kind: 'gloss', threshold: TOON_MATERIAL.satin.gloss });
    expect(L0.thresholds?.Torso).toBeUndefined();
    // at the level's age its bronze turns, its painted tone with it
    const old = creature({ ...PLAN, materials: { Torso: { metal: 'bronze' } } }, { from: 'upland-morning', materials: { age: 'ancient' } });
    expect(old.recipe.surfaces.Torso.film).toEqual({ age: 60 });
    expect(old.recipe.palette.Torso).not.toBe('#aa8855');
  });

  it('refuses a bad material or an age on the plan by name', () => {
    expect(planMaterialsErrors({ Torso: 'golden' })[0]).toMatch(/plan.materials.Torso: unknown material 'golden'/);
    expect(planMaterialsErrors({ age: 'old' })[0]).toMatch(/age is the level's/);
    expect(() => creature({ ...PLAN, materials: { Torso: 'golden' } })).toThrow(/plan refused: plan.materials.Torso/);
  });
});

describe('toon materials: a shelf metal named by its word', () => {
  it('draws as the metal of that name, or steel when the optics hold none (gunmetal), and never throws', () => {
    const T = toonMaterials({ Shine: 'gold', Plate: 'chrome', Armor: 'gunmetal' }, { Shine: '#f0c24a', Plate: '#c3cad3', Armor: '#8b94a0' });
    for (const g of ['Shine', 'Plate', 'Armor']) {
      expect(T.thresholds[g], g).toBe(TOON_MATERIAL.metal.threshold);
      expect(T.highlight[g].kind, g).toBe('gloss');
    }
    // gold leans warm in shade, chrome cool: the metal's own optics, told apart in bands
    expect(T.shade.Shine).not.toBe(T.shade.Plate);
  });
});
