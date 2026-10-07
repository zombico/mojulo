import { describe, it, expect } from 'vitest';
import { FURNITURE_LANGUAGES, FURNITURE_LANGUAGE_NAMES, COMPOSED_ROLES, DEFAULT_LANGUAGE, composeForRole } from './languages.js';
import { FURNITURE_STYLES, FURNITURE_KINDS, resolveFurniture } from './forms.js';
import { FURNISHINGS, ROLES } from './roster.js';
import { HOUSE_STYLE_NAMES } from '../polygonizer/floorplan-styles.js';
import { FABRIC_PRESETS } from '../construction/fabric.js';
import { TIMBER_KEYS } from '../construction/timber.js';
import { structurizeFloorplan } from '../polygonizer/floorplan-structure.js';
import { lockedFurnitureFaces } from '../construction/facades.js';

const composedAssets = (faces) => faces.filter((f) => /^asset:composed-furniture/.test(f.group || ''));

describe('furniture languages: the contract', () => {
  it('speaks one language per house style, and a default', () => {
    expect([...FURNITURE_LANGUAGE_NAMES].sort()).toEqual([...HOUSE_STYLE_NAMES].sort());
    expect(FURNITURE_LANGUAGES[DEFAULT_LANGUAGE]).toBeTruthy();
  });

  it('composes only roles the roster has, each from a row with a style', () => {
    for (const role of COMPOSED_ROLES) {
      expect(ROLES[role], role).toBeTruthy();
      expect(Object.values(FURNISHINGS).some((r) => r.role === role && r.style), role).toBe(true);
    }
  });

  for (const [name, L] of Object.entries(FURNITURE_LANGUAGES)) {
    it(`${name}: every role, style, leg, cloth and timber is real, and a role's styles share one kind`, () => {
      expect(Object.keys(L.styles).sort()).toEqual([...COMPOSED_ROLES].sort());
      for (const [role, styles] of Object.entries(L.styles)) {
        const kinds = new Set(styles.map((s) => FURNITURE_STYLES[s] && FURNITURE_STYLES[s].kind));
        expect(kinds.has(undefined), `${name} ${role}: ${styles}`).toBe(false);
        expect(kinds.size, `${name} ${role} mixes kinds`).toBe(1);
        // the role's roster row composes with the same kind
        const row = Object.values(FURNISHINGS).find((r) => r.role === role && r.style);
        expect([...kinds][0], `${name} ${role}`).toBe(FURNITURE_STYLES[row.style].kind);
      }
      for (const legs of L.legs) expect(Object.keys(FURNITURE_KINDS.table.slots.legs)).toContain(legs);
      for (const f of L.fabrics) expect(FABRIC_PRESETS[f], f).toBeTruthy();
      for (const t of L.timbers) expect(TIMBER_KEYS).toContain(t);
    });
  }

  it('every pick resolves and builds, in every language, house and role', () => {
    for (const name of FURNITURE_LANGUAGE_NAMES) {
      for (let house = 1; house <= 6; house += 1) {
        for (const role of COMPOSED_ROLES) {
          const c = composeForRole(name, role, { houseSeed: house, roomSeed: 3, palette: { upholstery: '#3d6b5a', cabinet: '#dcd6c8' } });
          expect(() => resolveFurniture(c), `${name} ${role} ${JSON.stringify(c)}`).not.toThrow();
        }
      }
    }
  });

  it('keeps one timber through a house, and varies between houses', () => {
    const timbers = (house) => new Set(COMPOSED_ROLES.map((r) => composeForRole('cottage', r, { houseSeed: house, roomSeed: 9 }).finish.timber).filter(Boolean));
    for (let h = 1; h <= 5; h += 1) expect(timbers(h).size).toBe(1);
    const picks = new Set(Array.from({ length: 12 }, (_, h) => JSON.stringify(composeForRole('cottage', 'sofa', { houseSeed: h + 1, roomSeed: 9 }))));
    expect(picks.size).toBeGreaterThan(2);
  });
});

describe("furnishing: 'composed' in a house", () => {
  const ONE = { width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], doors: [{ x: 12, y: 26, room: 0, edge: 'S' }] };
  const DINE = { width: 22, height: 20, rooms: [{ x: 1, y: 1, w: 20, h: 18, glyph: 'D' }], doors: [{ x: 10, y: 19, room: 0, edge: 'S' }] };

  it('draws the composed roles as composed pieces, and leaves the rest', () => {
    const plain = structurizeFloorplan(ONE, { furnish: true, style: 'cottage' });
    const room = structurizeFloorplan(ONE, { furnish: true, style: 'cottage', furnishing: 'composed' });
    expect(composedAssets(plain.faces)).toEqual([]);
    expect(composedAssets(room.faces).length).toBeGreaterThan(100);
    expect(room.faces.some((f) => /^asset:bordered-rug/.test(f.group || ''))).toBe(true);   // the rug keeps its mesh
  });

  it('dresses a media console with its television, as the room\'s own does', () => {
    const { locked } = resolveFurniture({ like: 'media-console' });
    const plain = lockedFurnitureFaces(locked, { unitMm: 1 }), dressed = lockedFurnitureFaces(locked, { unitMm: 1, dress: 'media-console' });
    const top = Math.max(...plain.flatMap((f) => f.corners.map((c) => c[2])));
    expect(dressed.filter((f) => f.group === 'tv').length).toBeGreaterThan(0);
    expect(Math.max(...dressed.filter((f) => f.group === 'tv').flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(top);
  });

  it('is deterministic, and a different house seed refurnishes it', () => {
    const at = (seed) => JSON.stringify(composedAssets(structurizeFloorplan({ ...ONE, seed }, { furnish: true, style: 'brick', furnishing: 'composed' }).faces));
    expect(at(3)).toBe(at(3));
    const variants = new Set([1, 2, 3, 4, 5, 6].map(at));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('seats one table with one chair, and names what stands', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = structurizeFloorplan({ ...DINE, seed }, { furnish: true, style: 'cottage', furnishing: 'composed' });
      // a dining room composes three roles — the table, its chairs, the sideboard — so three styles stand, however many chairs
      const groups = new Set(composedAssets(r.faces).map((f) => f.group));
      expect(groups.size, [...groups].join(', ')).toBe(3);
      expect([...groups].some((g) => /:(chair|windsor-side-chair)$/.test(g))).toBe(true);
    }
  });

  it('takes the house\'s and a room\'s overrides, the room winning', () => {
    const withSofa = (furniture, roomFurniture) => structurizeFloorplan(
      { ...ONE, rooms: [{ ...ONE.rooms[0], ...(roomFurniture ? { furniture: roomFurniture } : {}) }] },
      { furnish: true, style: 'modern', furnishing: 'composed', ...(furniture ? { furniture } : {}) });
    const base = composedAssets(withSofa(null, null).faces).length;
    expect(composedAssets(withSofa({ sofa: 'omit', 'easy-chair': 'omit', 'coffee-table': 'omit', bookcase: 'omit', media: 'omit' }, null).faces)).toEqual([]);
    expect(composedAssets(withSofa({ sofa: 'omit' }, { sofa: { like: 'chesterfield' } }).faces).length).toBeGreaterThan(0);
    expect(composedAssets(withSofa(null, { sofa: { like: 'chesterfield', finish: { fabric: 'tartan' } } }).faces).length).not.toBe(base);
  });

  it('refuses a bad language or override, naming what is valid', () => {
    expect(() => structurizeFloorplan(ONE, { furnish: true, furnishing: 'composed', furnitureLanguage: 'gothic' })).toThrow(/furnitureLanguage: one of cottage, brick, modern, tofu, mission/);
    expect(() => structurizeFloorplan(ONE, { furnish: true, furnishing: 'composed', furniture: { bed: 'omit' } })).toThrow(/furniture.bed: a role a composed room fills/);
    expect(() => structurizeFloorplan(ONE, { furnish: true, furnishing: 'composed', furniture: { sofa: { like: 'farmhouse-table' } } })).toThrow(/'farmhouse-table' is a table; the sofa is a sofa/);
    expect(() => structurizeFloorplan(ONE, { furnish: true, furnishing: 'composed', furniture: { sofa: { forms: { arms: 'scroll' } } } })).toThrow(/arms 'scroll' is not one of/);
  });

  it('changes nothing without the opt-in', () => {
    // the pinned one-room hash (construction/facades.test.js) holds; this checks the composed path is the only door
    const a = structurizeFloorplan(ONE, { furnish: true });
    const b = structurizeFloorplan(ONE, { furnish: true, furniture: { sofa: 'omit' } });   // ignored without the opt-in
    expect(JSON.stringify(b.faces)).toBe(JSON.stringify(a.faces));
  });
});
