/**
 * Dress materials: a family's groups to materials, a metal group's metal from its own tone, a cube's overrides, and a
 * hero on a cube that names `materials` wearing them (its recipe's surfaces, its faces' metal), absent unless asked.
 */
import { describe, expect, it } from 'vitest';

import { FAMILY_MATERIALS, metalForTone, dressSurfaces, materialsErrors, agedSurface, agedTones, AGES, levelClothBake, CLOTHS, genreCloth } from './dress-materials.js';
import { validateBake } from '../polygonizer/surface-bake.js';
import { GENRES } from '../stylism/genres.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { readGeocube } from '../era/geocube.js';
import { validateArmorCard, SEEDED_ARMOR } from '../armor/styles.js';
import { armorMaterials } from '../armor/expand.js';

describe('dress materials: the table', () => {
  it('reads a metal off its tone: light gilt gold, dark gilt brass, orange-brown bronze, red-brown copper, grey steel', () => {
    expect(metalForTone('#d8b04c')).toBe('gold');
    expect(metalForTone('#8a6a24')).toBe('brass');
    expect(metalForTone('#b8742c')).toBe('bronze');
    expect(metalForTone('#a0402a')).toBe('copper');
    expect(metalForTone('#aeb4bb')).toBe('steel');
    expect(metalForTone('not a colour')).toBe('steel');
  });

  it('maps a family\'s groups, only those the palette paints, a metal group by its tone', () => {
    const plate = dressSurfaces({ family: 'plate', palette: { Plate: '#aeb4bb', Trim: '#c9a55a', Rivet: '#d7d2c4', Leather: '#5a3a22', Top: '#3b3833' } });
    expect(plate.Plate).toEqual({ metal: 'steel', finish: 'brushed' });
    expect(plate.Trim).toMatchObject({ metal: 'gold' });
    expect(plate.Leather).toBe('leather');
    expect(plate).not.toHaveProperty('Top');
    expect(plate).not.toHaveProperty('Helm');   // not painted, not worn
    // the same name in another family is another material: a hardsuit's plate is paint, a lamellar's lacquer satin
    expect(dressSurfaces({ family: 'hardsuit', palette: { Plate: '#e8eaed' } }).Plate).toBe('satin');
    expect(dressSurfaces({ family: 'lamellar', palette: { Kanamono: '#caa24a' } }).Kanamono).toMatchObject({ metal: 'gold' });
    expect(Object.keys(FAMILY_MATERIALS)).toEqual(['plate', 'lamellar', 'hardsuit']);
  });

  it('takes a cube\'s overrides, `false` leaving a group as paint, and refuses a bad one', () => {
    const s = dressSurfaces({ family: 'plate', palette: { Plate: '#aeb4bb', Trim: '#c9a55a' }, overrides: { Plate: { metal: 'titanium', finish: 'blasted' }, Trim: false } });
    expect(s).toEqual({ Plate: { metal: 'titanium', finish: 'blasted' } });
    expect(dressSurfaces({ palette: { Skin: '#e0b090' } })).toBeNull();
    expect(materialsErrors(true)).toEqual([]);
    expect(materialsErrors({ Plate: 'golden' })[0]).toMatch(/materials.Plate: unknown material 'golden'/);
    expect(materialsErrors('steel')[0]).toMatch(/materials is true/);
    expect(() => readGeocube({ from: 'valley-morning', materials: { plate: 'steel' } })).toThrow(/geocube: materials.plate: a palette group name/);
  });
});

describe('dress materials: age', () => {
  const palette = { Plate: '#aeb4bb', Trim: '#c9a55a', Accent: '#b98a44', Leather: '#5a3a22' };
  it('tarnishes copper alloys by years and blackens steel; gold, leather and a new cube are as they were', () => {
    expect(AGES).toEqual(['new', 'worn', 'old', 'ancient']);
    const years = ['worn', 'old', 'ancient'].map((a) => agedSurface({ metal: 'bronze', finish: 'polished' }, a).film.age);
    expect(years[0] < years[1] && years[1] < years[2]).toBe(true);
    expect(agedSurface({ metal: 'steel', finish: 'brushed' }, 'old')).toEqual({ metal: 'steel', finish: 'mill' });
    expect(agedSurface({ metal: 'gold', finish: 'polished' }, 'ancient')).toEqual({ metal: 'gold', finish: 'polished' });
    expect(agedSurface('leather', 'ancient')).toBe('leather');
    expect(dressSurfaces({ family: 'plate', palette, overrides: { age: 'new' } })).toEqual(dressSurfaces({ family: 'plate', palette }));
    const old = dressSurfaces({ family: 'plate', palette, overrides: { age: 'old' } });
    expect(old.Plate.finish).toBe('mill');
    expect(old.Accent.film).toEqual({ age: 20 });
    expect(old.Trim).toMatchObject({ metal: 'gold' });
    expect(old.Trim).not.toHaveProperty('film');
  });

  it('ages a group the cube names unless it names its own film or finish; refuses an unknown age', () => {
    const s = dressSurfaces({ family: 'plate', palette, overrides: { age: 'ancient', Plate: { metal: 'bronze', finish: 'planished' }, Accent: { metal: 'bronze', film: { age: 2 } } } });
    expect(s.Plate.film).toEqual({ age: 60 });
    expect(s.Accent.film).toEqual({ age: 2 });
    expect(materialsErrors({ age: 'old', Plate: 'steel' })).toEqual([]);
    expect(materialsErrors({ age: 'rusty' })[0]).toMatch(/materials.age: one of new, worn, old, ancient/);
  });

  it('moves an aged group\'s painted tone toward its aged colour, and no other', () => {
    const s = dressSurfaces({ family: 'plate', palette, overrides: { age: 'old' } });
    const t = agedTones(palette, s, 'old');
    expect(Object.keys(t).sort()).toEqual(['Accent', 'Plate', 'Rivet'].filter((g) => g in palette).sort());
    const lum = (h) => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0);
    expect(lum(t.Plate)).toBeLessThan(lum(palette.Plate));   // forged black scale
    expect(agedTones(palette, s, 'new')).toBeNull();
    expect(agedTones(palette, dressSurfaces({ family: 'plate', palette }), null)).toBeNull();
  });
});

describe('dress materials: the level\'s cloth and leather', () => {
  it('bakes the cloth and leather a figure wears, leaving what a material dresses to it', () => {
    const B = levelClothBake({ Plate: { metal: 'steel' }, Leather: 'leather', Wrap: 'matte', Suit: 'rubber', Trim: { metal: 'gold' } }, ['Skin', 'Top', 'Bottom', 'Shoes', 'Plate', 'Leather', 'Wrap', 'Suit', 'Trim', 'OutfitBase', 'Hair']);
    expect(B.finish).toEqual({ Top: 'cloth', Bottom: 'cloth', Shoes: 'leather', Leather: 'leather', Wrap: 'cloth', OutfitBase: 'cloth' });
    expect([...B.only].sort()).toEqual(Object.keys(B.finish).sort());
    expect(levelClothBake({}, ['Skin', 'Hair'])).toBeNull();
    // a stylist's cloth trim is cloth; a family's gilt trim keeps its metal
    expect(levelClothBake({}, ['Trim']).finish.Trim).toBe('cloth');
  });
});

describe('dress materials: the cloths', () => {
  it('names each cloth a material, paints it its own way, and every cloth is a bake finish', () => {
    for (const w of Object.keys(CLOTHS)) expect(materialsErrors({ Top: w })).toEqual([]);
    expect(validateBake({ finish: Object.fromEntries(Object.entries(CLOTHS).map(([w, F], i) => [`G${i}`, F])) })).toEqual([]);
    const B = levelClothBake({ Top: 'velvet', Outer: 'silk', Bottom: 'linen' }, ['Top', 'Outer', 'Bottom']);
    expect(B.finish).toEqual({ Top: CLOTHS.velvet, Outer: CLOTHS.silk, Bottom: 'cloth' });
    // velvet bright at its rims, silk a band toward the sky, wool no ridge
    expect(CLOTHS.velvet.edge).toBeGreaterThan(CLOTHS.wool.edge);
    expect(Math.max(...CLOTHS.silk.sky.map((p) => p[1]))).toBeGreaterThan(1.2);
  });

  it('dresses a stylist\'s garments in its genre\'s cloths, leather left to the leather groups', () => {
    expect(genreCloth(GENRES.fantasy.materials.cloth)).toEqual({ Top: 'linen', Outer: 'linen', Bottom: 'wool' });
    expect(genreCloth(GENRES.modern.materials.cloth)).toEqual({ Top: 'cotton', Outer: 'nylon', Bottom: 'denim' });
    expect(genreCloth(['leather'])).toBeNull();
    const s = dressSurfaces({ palette: { Top: '#2b2d3a', Bottom: '#3b3346', Leather: '#4a3324' }, cloth: genreCloth(GENRES.fantasy.materials.cloth), overrides: { Top: 'velvet' } });
    expect(s).toMatchObject({ Top: 'velvet', Bottom: 'wool', Leather: 'leather' });
  });
});

describe('dress materials: an armour card\'s own', () => {
  it('sits over its family\'s, under the cube\'s, and ages with the level', () => {
    const palette = { Plate: '#8c7a5b', Trim: '#3d3a36', Suit: '#1b1c1f' }, card = { Trim: { metal: 'steel', finish: 'blasted' } };
    expect(dressSurfaces({ family: 'hardsuit', palette })).toMatchObject({ Plate: 'satin', Trim: 'satin' });
    expect(dressSurfaces({ family: 'hardsuit', card, palette })).toMatchObject({ Plate: 'satin', Trim: card.Trim, Suit: 'rubber' });
    expect(dressSurfaces({ family: 'hardsuit', card, palette, overrides: { Trim: 'satin' } }).Trim).toBe('satin');
    expect(dressSurfaces({ family: 'hardsuit', card, palette, overrides: { age: 'old' } }).Trim).toEqual({ metal: 'steel', finish: 'mill' });
    expect(dressSurfaces({ family: 'hardsuit', card: { Trim: false }, palette })).not.toHaveProperty('Trim');
  });

  it('is checked on the card, and the samples that name metal carry it', () => {
    expect(validateArmorCard({ family: 'hardsuit', materials: { Trim: { metal: 'steel' } } })).toEqual([]);
    expect(validateArmorCard({ family: 'hardsuit', materials: { Trim: 'golden' } })[0]).toMatch(/style.materials.Trim: unknown material 'golden'/);
    expect(validateArmorCard({ family: 'hardsuit', materials: 'steel' })[0]).toMatch(/style.materials: \{ <group>: <material> \}/);
    expect(validateArmorCard({ family: 'hardsuit', materials: { trim: 'satin' } })[0]).toMatch(/a piece group name/);
    for (const [id, card] of Object.entries(SEEDED_ARMOR)) expect(validateArmorCard(card, id)).toEqual([]);
    expect(armorMaterials({ type: 'armor', style: 'grim-scifi' })).toEqual({ Trim: { metal: 'steel', finish: 'blasted' } });
    expect(armorMaterials({ type: 'armor', style: 'knight' })).toBeNull();
  });
});

describe('dress materials: a hero on a cube that names them', () => {
  const KNIGHT = { type: 'armor', style: 'knight' };
  const recipeOf = (geocube) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: KNIGHT, ...(geocube ? { geocube } : {}) }) }).recipe;

  it('wears them as its recipe\'s surfaces; a hero on a cube without them, or on none, wears tones', () => {
    const worn = recipeOf('upland-morning');
    expect(worn.surfaces.Plate).toEqual({ metal: 'steel', finish: 'brushed' });
    expect(worn.surfaces.Leather).toBe('leather');
    expect(recipeOf('valley-morning')).not.toHaveProperty('surfaces');
    expect(recipeOf()).not.toHaveProperty('surfaces');
    // an aged cube: the plate blackened, its painted tone with it
    const aged = recipeOf({ from: 'upland-morning', materials: { age: 'old' } });
    expect(aged.surfaces.Plate).toEqual({ metal: 'steel', finish: 'mill' });
    expect(aged.palette.Plate).not.toBe(worn.palette.Plate);
    expect(aged.palette.Trim).toBe(worn.palette.Trim);
    // a sci-fi hero: painted shell, its card's metal where the card names it; nothing off a cube without materials
    const suit = (style, geocube) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: { type: 'armor', style }, geocube }) }).recipe;
    expect(suit('grim-scifi', 'upland-morning').surfaces).toMatchObject({ Plate: 'satin', Trim: { metal: 'steel', finish: 'blasted' } });
    expect(suit('armored-hero', 'upland-morning').surfaces.Face).toEqual({ metal: 'stainless', finish: 'brushed' });
    expect(suit('fantasy-space', 'upland-morning').surfaces.Trim).toBe('satin');
    expect(suit('grim-scifi', 'valley-morning')).not.toHaveProperty('surfaces');
  }, 120000);   // (the hard-suits under armour laws 2 build their heavy suits in seconds each)

  it('paints a plain hero\'s cloth on a level that names materials, and nothing on one that does not', async () => {
    const plain = (geocube) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', geocube }) });
    const dressed = plain('upland-morning'), bare = plain({ from: 'upland-morning', materials: false });
    expect(dressed.recipe.surfaces).toEqual({});
    expect(bare.recipe).not.toHaveProperty('surfaces');
    const [a, b] = await Promise.all([dressed, bare].map((manifest) => resolveWorldScene({ title: 't', manifest })));
    const fills = (p) => p.payload.faces.map((f) => JSON.stringify(f.cornerFills ?? f.fill));
    const A = fills(a), B = fills(b);
    expect(A.length).toBe(B.length);
    expect(A.filter((x, i) => x !== B[i]).length).toBeGreaterThan(100);
  }, 120000);

  it('shades its plate as live metal in the world', async () => {
    const manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: KNIGHT, geocube: 'upland-morning' }) });
    const { payload } = await resolveWorldScene({ title: 't', manifest });
    const metal = payload.faces.filter((f) => f.metal);
    expect(metal.length).toBeGreaterThan(50);
    expect(new Set(metal.map((f) => JSON.parse(f.metal.s).metal))).toContain('steel');
    // the moving parts carry it too (the rig pack the clip preview draws), and the plate takes the cube's occlusion
    const parts = payload.figures.body.parts.filter(Boolean);
    expect(parts.filter((p) => p.metal).length).toBeGreaterThan(5);
    expect(parts.filter((p) => p.metal).every((p) => p.metal.surfaces.length && typeof p.metal.a === 'string')).toBe(true);
    expect(payload.vertexContrast).toMatchObject({ only: 'metal', metal: 1 });
  }, 120000);
});
