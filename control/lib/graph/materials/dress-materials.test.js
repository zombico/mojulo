/**
 * Dress materials: a family's groups to materials, a metal group's metal from its own tone, a cube's overrides, and a
 * hero on a cube that names `materials` wearing them (its recipe's surfaces, its faces' metal), absent unless asked.
 */
import { describe, expect, it } from 'vitest';

import { FAMILY_MATERIALS, metalForTone, dressSurfaces, materialsErrors, agedSurface, agedTones, AGES } from './dress-materials.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { readGeocube } from '../era/geocube.js';

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
  });

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
