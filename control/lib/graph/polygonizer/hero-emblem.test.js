// The named hero's emblem and name (hero-emblem.js): an emblem lowers to field paint on the place it is worn, each layer
// coloured by its role from the hero's palette unless it fixes its own; the name is tidied and its words held.
import { describe, it, expect } from 'vitest';
import { EMBLEM_PLACES, EMBLEM_ROLES, emblemFieldPaint, validateEmblem, validateHeroName, readHeroName, heroFieldPaint } from './hero-emblem.js';

const RING = 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z M 50 25 A 25 25 0 1 0 50 75 A 25 25 0 1 0 50 25 Z';
const BAR = 'M 0 40 L 100 40 L 100 60 L 0 60 Z';

describe('a named hero\'s emblem', () => {
  it('lowers to field paint on its place, its layers in order, the field first and a charge over it', () => {
    const E = emblemFieldPaint({ layers: [{ path: RING }, { path: BAR }] });
    const P = EMBLEM_PLACES.chest;
    expect(E.map((e) => [e.group, e.chart, e.at, e.size, e.part])).toEqual([
      [EMBLEM_ROLES.field.group, 'front', [...P.at], P.size, [...P.part]],
      [EMBLEM_ROLES.charge.group, 'front', [...P.at], P.size, [...P.part]],
    ]);
    const back = emblemFieldPaint({ layers: [{ path: RING }], at: 'back', size: 0.5, offset: [0.1, -0.05] })[0];
    expect([back.chart, back.size, back.at.map((v) => +v.toFixed(3))]).toEqual(['back', 0.5, [0.6, 0.57]]);
  });
  it('colours a role from the hero\'s palette (its own group, then the suit colour it falls back to, then its own); a fixed colour paints a group of its own', () => {
    const one = (palette, layer = { path: RING }) => emblemFieldPaint({ layers: [layer] }, palette)[0];
    expect(one({ EmblemField: '#123456', OutfitAccent: '#abcdef' }).color).toBe('#123456');
    expect(one({ OutfitAccent: '#abcdef', Trim: '#fedcba' }).color).toBe('#abcdef');
    expect(one({ Trim: '#fedcba' }).color).toBe('#fedcba');
    expect(one({}).color).toBe(EMBLEM_ROLES.field.own);
    const fixed = emblemFieldPaint({ layers: [{ path: RING, color: '#ff0000' }, { path: BAR, color: '#00ff00' }] }, { EmblemField: '#123456' });
    expect(fixed.map((e) => [e.group, e.color])).toEqual([['EmblemLayer1', '#ff0000'], ['EmblemLayer2', '#00ff00']]);
  });
  it('names what it refuses, a layer\'s path as that layer\'s', () => {
    expect(validateEmblem(undefined)).toEqual([]);
    expect(validateEmblem({ layers: [{ path: RING, role: 'charge', color: '#112233' }], at: 'chest', size: 0.3 })).toEqual([]);
    expect(validateEmblem({ layers: [] })[0]).toMatch(/1 to 8 layers/);
    const errs = validateEmblem({ layers: [{ path: RING, role: 'glow', color: 'gold' }], at: 'hat', size: 2, spin: 1 }).join('\n');
    for (const want of ['emblem.spin: not an emblem word', 'emblem.at: where it is worn (chest, back)', 'emblem.size', 'layers[0].role: one of field, charge, outline', "layers[0].color: a fixed '#rrggbb'"]) expect(errs).toContain(want);
    expect(validateEmblem({ layers: [{ path: RING }, { path: 'a bat' }] })).toEqual([expect.stringMatching(/^emblem\.layers\[1\]\.path: a mark's path is an SVG path's d/)]);
  });
  it('paints under the row\'s own field paint, in the palette as the recipe reads it; a hero with none keeps the row\'s list', () => {
    const own = [{ part: 'torso', shape: 'star', group: 'Star', color: '#ffffff' }];
    const L = heroFieldPaint({ hero: { emblem: { layers: [{ path: RING }] } }, recipe: { palette: { EmblemField: '#0a0b0c' } }, fieldPaint: own });
    expect([L.length, L[0].color, L[1]]).toEqual([2, '#0a0b0c', own[0]]);
    expect(heroFieldPaint({ hero: {}, fieldPaint: own })).toBe(own);
    expect(heroFieldPaint({ hero: {} })).toBeUndefined();
  });
});

describe('a named hero\'s name', () => {
  it('is tidied, and refused when it is no name', () => {
    expect(readHeroName('  Captain   Vale ')).toBe('Captain Vale');
    expect(validateHeroName("Nightjar & O'Neil-2")).toEqual([]);
    expect(validateHeroName('')[0]).toMatch(/the hero's name/);
    expect(validateHeroName('x'.repeat(41))[0]).toMatch(/at most 40 characters/);
    expect(validateHeroName('<script>')[0]).toMatch(/letters, digits, spaces/);
    expect(() => readHeroName(7)).toThrow(/the hero's name/);
  });
});
