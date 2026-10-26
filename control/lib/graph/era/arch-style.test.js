/**
 * The architectural style (era/arch-style.js): the card on its rails, its laws, and the town and the city it builds.
 * One starter per path, picked from the catalogue by what it exercises; every starter composes (its language is its
 * own procedure, so each is a case).
 */
import { describe, it, expect } from 'vitest';
import { readStyle, styleLaws, styleTownDress, styleGrammar, styleReadout, STYLE_IDS, STYLE_STARTERS, MATERIAL_WORDS, SURFACES } from './arch-style.js';
import { decompileAnchor } from './out-anchor-structure.js';
import { readGeocube, assembleGeocubeScene, geocubeTown } from './geocube.js';
import { geocubeCity } from './geocube-city.js';
import { assembleStageScene } from './stage.js';
import { townDressOf, leanHue } from './town-dress.js';
import { cityDressOf } from '../city/plan/dress.js';
import { readPaint } from '../city/plan/look.js';
import { resolveGrammar } from '../city/plan/grammars.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';

const lawOf = (S, id) => styleLaws(S).find((l) => l.law === id);
const pick = (pred) => STYLE_IDS.find((id) => pred(STYLE_STARTERS[id]));

describe('the style card', () => {
  it('every starter composes under every rail, builds a city grammar, and keeps its own laws', () => {
    for (const id of STYLE_IDS) {
      const S = readStyle(id);
      expect(() => decompileAnchor(S.language.id ?? S.language.doc)).not.toThrow();
      expect(() => resolveGrammar(styleGrammar(S, 'isekai-meadow', 1))).not.toThrow();
      expect(styleLaws(S).filter((l) => !l.ok).map((l) => `${id}: ${l.law}`)).toEqual([]);
    }
  });

  it('reads the same document every time, and { from, …changes } differs only where it says', () => {
    const id = pick((s) => s.materials.roof), S = readStyle(id);
    expect(JSON.stringify(readStyle(id))).toBe(JSON.stringify(S));
    const T = readStyle({ from: id, materials: { roof: 'shingle' } });
    expect(T.materials).toEqual({ ...S.materials, roof: 'shingle' });
    expect(T.language.doc.elements).toEqual(S.language.doc.elements);
    expect(T.palette).toEqual(S.palette);
    // a language changed over the starter's: one element moved on its rail, one dropped, the rest kept
    const U = readStyle({ from: id, language: { elements: { roof: { pitch: 56 }, door: { w: 1.3 } } } });
    const cap = (X) => Object.values(X.language.doc.elements).find((e) => e.kind === 'cap');
    expect(cap(U).pitch).toBe(56);
    expect({ ...cap(U), pitch: 0 }).toEqual({ ...cap(S), pitch: 0 });
    const dropped = Object.keys(S.language.doc.elements).find((k) => S.language.doc.elements[k].kind === 'sill');
    if (dropped) expect(readStyle({ from: id, language: { elements: { [dropped]: null } } }).language.doc.elements[dropped]).toBeUndefined();
  });

  it('refuses off its rails, naming what is allowed', () => {
    expect(() => readStyle('baroque')).toThrow(/not a starter \(whitewashed-island/);
    expect(() => readStyle({ from: STYLE_IDS[0], materials: { plaster: 'slate' } })).toThrow(/a wall word \(limewash.*'slate' is a roof's/);
    expect(() => readStyle({ from: STYLE_IDS[0], materials: { porch: 'boards' } })).toThrow(/not a surface/);
    expect(() => readStyle({ from: STYLE_IDS[0], palette: { roof: 'red' } })).toThrow(/'#rrggbb'/);
    expect(() => readStyle({ from: STYLE_IDS[0], language: { elements: { roof: { kind: 'cap', form: 'gable', pitch: 80 } } } })).toThrow(/pitch is 20–60/);
    expect(() => readStyle({ from: STYLE_IDS[0], city: { grain: 'atlantis' } })).toThrow(/grain is a city grammar/);
    expect(() => readStyle({ from: STYLE_IDS[0], class: 'baroque' })).toThrow(/'ancient' or 'modern'/);
    expect(() => readStyle({ read: 'a written one', class: 'modern', language: 'castle' })).toThrow(/not an anchor/);
  });

  it('advises and never refuses: the class, the cover against the pitch, the value order, idle surfaces', () => {
    const id = pick((s) => s.class === 'ancient' && s.materials.roof);
    const S = readStyle({ from: id, materials: { pier: 'precast', roof: 'thatch' }, language: { elements: { roof: { pitch: 32 } } }, palette: { shell: '#ffffff' } });
    expect(lawOf(S, 'class')).toMatchObject({ ok: false, value: ['pier: precast (modern)'] });
    expect(lawOf(S, 'cover-pitch')).toMatchObject({ ok: false, value: { cover: 'thatch', pitch: 32, min: 45 } });
    expect(lawOf(S, 'surfaces-built')).toMatchObject({ ok: false, value: ['shell'] });
    const dark = readStyle({ from: id, language: { elements: { roof: { value: 0.95 } } } });
    expect(lawOf(dark, 'value-order').ok).toBe(false);
    // the laws ride on the specimen's readout
    expect(styleReadout(S).laws).toEqual(styleLaws(S));
  });

  it('every word stands on one surface kind, its colour a hex or the cube\'s', () => {
    for (const [w, M] of Object.entries(MATERIAL_WORDS)) {
      expect(['wall', 'roof', 'ground'], w).toContain(M.on);
      expect(M.colour === null || /^#[0-9a-f]{6}$/.test(M.colour), w).toBe(true);
    }
    expect(Object.values(SURFACES).filter(Boolean).sort()).toEqual(expect.arrayContaining(['ground', 'roof', 'wall']));
  });
});

describe('the town in a style', () => {
  const gritty = readGeocube('limestone-crags'), quiet = readGeocube('island-noon');
  it('wears its words: relief on a gritty cube, colour alone on a quiet one; what it does not name, the cube\'s own', () => {
    expect(gritty.grit).toBeGreaterThanOrEqual(GRIT_PIXELS);
    expect(quiet.grit ?? 0).toBeLessThan(GRIT_PIXELS);
    const id = pick((s) => s.materials.plaster && s.palette?.paint), S = readStyle(id);
    const G = styleTownDress(S, gritty, townDressOf(gritty)), Q = styleTownDress(S, quiet, null);
    expect(G['str:plaster'].spec.cut).toBe(MATERIAL_WORDS[S.materials.plaster].tile({ grit: 1, stone: [1, 1, 1], mortar: [1, 1, 1], coat: [1, 1, 1], floor: [1, 1, 1], trim: [1, 1, 1], wear: {}, machine: {}, loss: 1 }).params.cut);
    expect(Q['str:plaster'].spec).toBeUndefined();
    expect(Q['str:paint']).toEqual({ colour: S.palette.paint });
    // a group the style does not name keeps the cube's dress
    const unnamed = Object.keys(townDressOf(gritty)).find((g) => !G[g] || G[g] === townDressOf(gritty)[g]);
    if (unnamed) expect(G[unnamed]).toEqual(townDressOf(gritty)[unnamed]);
  });

  it('a lit face leans its hue to the material and keeps its light', () => {
    const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    for (const f of ['#806040', '#3a3a3a', '#d8d0c0']) {
      const l = leanHue(f, '#8e2f25');
      expect(lum(l)).toBeCloseTo(lum(f), 2);
      expect(l).not.toBe(f);
    }
  });

  it('speaks the style\'s language in its street and its houses; the level\'s style over the settlement\'s anchor', () => {
    const id = pick((s) => s.language.compose?.tiers), S = readStyle(id);
    const P = assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'town', seed: 3, style: id }, {}, assembleStageScene);
    expect(P.geocube.town.anchor).toBe(S.language.doc.id);
    expect(P.geocube.style).toMatchObject({ id, class: S.class, language: id });
    expect(P.geocube.style.laws.every((l) => l.ok)).toBe(true);
    // limestone's harbour names the timber hall: a settlement's style keeps it, the level's style speaks over it
    const cube = readGeocube({ from: 'limestone-crags', settlements: { harbour: { ...readGeocube('limestone-crags').settlements.harbour, style: id } } });
    expect(geocubeTown(cube, { settlement: 'harbour' }).anchor).toBe('timber-hall');
    expect(geocubeTown(readGeocube('limestone-crags'), { settlement: 'harbour' }, id).anchor).toMatchObject({ id });
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'land', style: id }, {}, assembleStageScene)).toThrow(/style is the town's and the city's/);
    expect(() => readGeocube({ from: 'limestone-crags', buildings: { uses: [{ use: 'dwelling' }], style: 'baroque' } })).toThrow(/buildings\.style 'baroque' is not a starter/);
  });
});

describe('the city in a style', () => {
  it('builds its grammar from the style: an ancient one without glass or towers, a flat cap raising no roofs', () => {
    const anc = pick((s) => s.class === 'ancient' && s.language.elements?.roof?.form === 'flat');
    const { city, style } = geocubeCity({ kind: 'geocube', cube: 'island-noon', show: 'city', style: anc });
    expect(style.id).toBe(anc);
    expect(city.grammar.skin.mix.glass).toEqual([0, 0, 0]);
    expect(city.grammar.tower.p).toBe(0);
    expect(city.grammar.facade.roof.p).toBe(0);
    expect(city.paint.style).toBe(anc);
    // the city's changes go over all of it
    const mod = pick((s) => s.class === 'modern' && s.city?.facade);
    expect(geocubeCity({ kind: 'geocube', cube: 'island-noon', show: 'city', style: mod }).city.grammar.facade.roof.form).toBe(STYLE_STARTERS[mod].city.facade.roof.form);
  });

  it('dresses its rhythms and ground in its words: a list picked by each building, glass left as drawn', () => {
    const id = pick((s) => s.class === 'modern'), P = readPaint({ geocube: 'limestone-crags', amount: 1, style: { from: id, materials: { punched: ['wire-brick', 'glass'], road: 'setts' } } });
    const D = cityDressOf(P, 3.66);
    expect(D.class).toBe('modern');
    expect(D.walls.punched).toHaveLength(2);
    expect(D.walls.punched[0].keys).toHaveLength(2);
    expect(D.walls.punched[1]).toEqual({});
    expect(D.ground['city:road'].keys).toHaveLength(2);
    // a quiet cube's city takes the colours alone
    const Q = cityDressOf(readPaint({ geocube: 'island-noon', amount: 1, style: id }), 3.66);
    expect(Object.values(Q.walls).flat().every((e) => !e.keys)).toBe(true);
    // absent a style, a quiet cube's city has no dress at all
    expect(cityDressOf(readPaint({ geocube: 'island-noon', amount: 1 }), 3.66)).toBeNull();
  });
});
