import { describe, it, expect } from 'vitest';
import {
  FURNISHINGS, ROLES, NOT_FURNISHINGS, furnishingNameIndex, resolveFurnishing, normalizeName,
  handlesOf, pieceOfType, piecesForRole,
} from './roster.js';
import {
  ARCHETYPES, FURNITURE_BANDS, FURNISH_PRIORITY, SHARE_ASSETS, WALL_HUG_TYPES, SEAT_TUCK_TYPES,
  TALL_STORAGE_TYPES, FURNITURE_FT, furnishElements,
} from '../polygonizer/floorplan-glyphs.js';
import { CONSTRUCTED_FOR } from '../polygonizer/floorplan-structure.js';
import { ROOM_SCENE_ELEMENT_PRESETS } from '../polygonizer/room-scene-elements.js';
import { FURNITURE_NETS } from '../polygonizer/furniture-cards.js';
import { ROOM_FURNITURE_ASSETS, getRoomFurnitureAsset } from '../architecture/room-assets.js';

const IDS = Object.keys(FURNISHINGS);
const MESH_ALIASES = Object.fromEntries(Object.values(ROOM_FURNITURE_ASSETS).map((a) => [a.id, a.aliases || []]));
const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const isNot = (k) => NOT_FURNISHINGS.includes(k);

// A legacy table's key is claimed when it is a row's type or spelling, the camelCase twin of one
// (the presets and nets carry both spellings), or a mesh a row owns (the kitchen run emits its
// mesh ids as types).
const claimedType = (k) => pieceOfType(k) || IDS.find((id) => handlesOf(id).types.some((t) => camel(t) === k)) || null;

// Every type and mesh the arrangers can emit: each glyph over a spread of rooms, both scales,
// a run of seeds (the study nook and the desk pick are seeded).
function emitted() {
  const types = new Set(), meshes = new Set();
  const glyphs = Object.keys(ARCHETYPES);
  for (const g of glyphs) {
    for (const scale of ['feet', 'share']) {
      for (const [w, h] of [[8, 8], [10, 12], [12, 13], [14, 14], [16, 20], [12, 18]]) {
        for (let seed = 1; seed <= 24; seed += 1) {
          for (const e of furnishElements(g, seed, { w, h, scale })) {
            types.add(e.type);
            if (e.asset) meshes.add(e.asset);
          }
        }
      }
    }
  }
  return { types, meshes };
}

// The row contract: what a row must say so the roster can name it honestly. A new piece fails
// here with the lines it still needs.
const CONTRACT = {
  label: (r) => typeof r.label === 'string' && r.label.length > 0 || 'label: what the piece is called in prose',
  role: (r) => r.role in ROLES || `role: one of ${Object.keys(ROLES).join(', ')}`,
  aliases: (r) => Array.isArray(r.aliases) && r.aliases.every((a) => typeof a === 'string' && a.length >= 3) || 'aliases: the words people say, 3+ characters each (an empty list when the label says it all)',
  renders: (r) => Boolean(r.type || r.asset || r.wears) || 'type or asset: how the piece renders (a box-net key, or the mesh it owns)',
  type: (r) => r.type == null || Boolean(ROOM_SCENE_ELEMENT_PRESETS[r.type] || FURNITURE_BANDS[r.type] || FURNITURE_NETS[r.type]) || `type: '${r.type}' is no preset, band or net`,
  spellings: (r) => (r.spellings || []).every((s) => ROOM_SCENE_ELEMENT_PRESETS[s] || FURNITURE_FT[s] != null || FURNITURE_NETS[s]) || 'spellings: legacy keys that exist in a legacy table',
  asset: (r) => r.asset == null || getRoomFurnitureAsset(r.asset)?.id === r.asset || `asset: '${r.asset}' is no room-asset id`,
  wears: (r) => r.wears == null || IDS.some((id) => FURNISHINGS[id].asset === r.wears) || `wears: '${r.wears}' is owned by no row`,
  constructed: (r) => r.constructed == null || (getRoomFurnitureAsset(r.constructed)?.id === r.constructed && r.constructed.startsWith('constructed-')) || `constructed: '${r.constructed}' is no constructed-* asset`,
};

describe('the furnishing row contract', () => {
  for (const [id, row] of Object.entries(FURNISHINGS)) {
    it(`${id} says everything the roster needs`, () => {
      const missing = Object.values(CONTRACT).map((check) => check(row)).filter((r) => r !== true);
      expect(missing, `the ${id} row needs:\n  ${missing.join('\n  ')}`).toEqual([]);
    });
  }

  it('fills every role with at least one piece', () => {
    for (const role of Object.keys(ROLES)) expect(piecesForRole(role), role).not.toEqual([]);
  });
});

describe('one piece, one row: the legacy tables are all claimed', () => {
  const unclaimed = (keys) => keys.filter((k) => !isNot(k) && !claimedType(k));

  it('claims every box-net preset and net', () => {
    expect(unclaimed(Object.keys(ROOM_SCENE_ELEMENT_PRESETS))).toEqual([]);
    expect(unclaimed(Object.keys(FURNITURE_NETS))).toEqual([]);
  });

  it('claims every band, footprint, keep-order and placement-set key', () => {
    expect(unclaimed(Object.keys(FURNITURE_BANDS))).toEqual([]);
    expect(unclaimed(Object.keys(FURNITURE_FT))).toEqual([]);
    expect(unclaimed(Object.values(FURNISH_PRIORITY).flat())).toEqual([]);
    expect(unclaimed([...WALL_HUG_TYPES, ...SEAT_TUCK_TYPES, ...TALL_STORAGE_TYPES])).toEqual([]);
  });

  it('gives every room mesh to a row, as the mesh it owns or its constructed stand-in', () => {
    const meshes = new Set(IDS.flatMap((id) => handlesOf(id).meshes));
    expect(Object.keys(ROOM_FURNITURE_ASSETS).filter((a) => !meshes.has(a))).toEqual([]);
  });

  it('lets no two rows own one type, spelling or mesh', () => {
    const seen = new Map();
    for (const id of IDS) {
      const r = FURNISHINGS[id];
      for (const k of [...handlesOf(id).types.map((t) => `type:${t}`), ...(r.asset ? [`mesh:${r.asset}`] : [])]) {
        expect(seen.get(k), `${k} is claimed by ${seen.get(k)} and ${id}`).toBeUndefined();
        seen.set(k, id);
      }
    }
  });

  it('claims every type and mesh an arranger emits', () => {
    const { types, meshes } = emitted();
    expect([...types].filter((t) => !isNot(t) && !claimedType(t))).toEqual([]);
    const owned = new Set(IDS.flatMap((id) => handlesOf(id).meshes));
    expect([...meshes].filter((m) => !owned.has(m))).toEqual([]);
  });
});

describe('the rows agree with the legacy pairings', () => {
  it('SHARE_ASSETS swaps each type for the mesh its row owns or wears', () => {
    for (const [type, mesh] of Object.entries(SHARE_ASSETS)) {
      const r = FURNISHINGS[pieceOfType(type)];
      expect(r, type).toBeTruthy();
      expect([r.asset, r.wears], `${type} → ${mesh}`).toContain(mesh);
    }
  });

  it('CONSTRUCTED_FOR stands in the build its row names, keyed by type or mesh', () => {
    for (const [key, build] of Object.entries(CONSTRUCTED_FOR)) {
      const id = pieceOfType(key) || IDS.find((i) => FURNISHINGS[i].asset === key);
      expect(id, key).toBeTruthy();
      expect(FURNISHINGS[id].constructed, `${key} → ${build}`).toBe(build);
    }
  });

  it('names no wall opening as a furnishing', () => {
    for (const k of NOT_FURNISHINGS) expect(claimedType(k), k).toBeNull();
  });
});

describe('the words people say', () => {
  it('holds one word to one piece, the mesh aliases folded in', () => {
    expect(() => furnishingNameIndex(MESH_ALIASES)).not.toThrow();
    const index = furnishingNameIndex(MESH_ALIASES);
    for (const id of IDS) expect(index.get(normalizeName(FURNISHINGS[id].label)), id).toBe(id);
  });

  it('resolves the names people use', () => {
    const index = furnishingNameIndex(MESH_ALIASES);
    const r = (w) => resolveFurnishing(w, index)?.id ?? null;
    expect(r('couch')).toBe('sofa');
    expect(r('a Couch')).toBe('sofa');
    expect(r('chairs')).toBe('dining-chair');
    expect(r('office chair')).toBe('desk-chair');
    expect(r('bookshelves')).toBe('bookcase');
    expect(r('book shelf')).toBe('bookcase');
    expect(r('TV stand')).toBe('media-unit');
    expect(r('tv_stand')).toBe('media-unit');
    expect(r('benches')).toBe('bench');
    expect(r('credenza')).toBe('sideboard');          // the mesh's own alias
    expect(r('refrigerator')).toBe('kitchen-fridge');
    expect(r('mug')).toBe('cup');
    expect(r('tufted sofa')).toBe('chesterfield');   // the chesterfield owns its constructed mesh
    expect(r('upholstered sofa')).toBe(null);         // a shared stand-in's alias is not folded (no row owns it)
    expect(r('window')).toBe(null);
    expect(r('')).toBe(null);
  });

  it('resolves without the mesh registry too (the cached index)', () => {
    expect(resolveFurnishing('couch')?.id).toBe('sofa');
    expect(resolveFurnishing('credenza')).toBe(null);
  });

  it('is deterministic', () => {
    expect([...furnishingNameIndex(MESH_ALIASES)]).toEqual([...furnishingNameIndex(MESH_ALIASES)]);
  });
});
