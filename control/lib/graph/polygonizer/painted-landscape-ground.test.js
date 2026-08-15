import { describe, it, expect } from 'vitest';
import {
  validatePaintedLandscape,
  buildTerrainWorldMesh,
  GROUND_PRESETS,
  groundPresetIds,
} from './painted-landscape.js';

// A steep wall + flat apron so both slope classes exist deterministically.
const CLIFF = {
  fields: {
    wall: { kind: 'gradient', from: { x: 0, y: -5, z: 0 }, to: { x: 0, y: -10, z: 0 }, fromValue: 0, toValue: 10, beyond: 'clamp' },
    elevation: { kind: 'sum', components: [{ field: 'wall' }] },
  },
  field: 'elevation',
  samples: { u: 24, v: 24 },
};
const base = (ground) => ({
  kind: 'painted-landscape',
  splatch: 'bone-trio',
  seed: 'ground-test',
  elevation: CLIFF,
  ...(ground !== undefined ? { ground } : {}),
});

describe('painted-landscape — ground surface textures', () => {
  it('accepts every preset id and the object form', () => {
    for (const id of groundPresetIds()) expect(validatePaintedLandscape(base(id))).toEqual([]);
    expect(validatePaintedLandscape(base({ steep: 'rock-sandstone', tile: 2, flatMin: 0.5, contrast: 1.4, cloud: 0.3 }))).toEqual([]);
  });

  it('rejects unknown presets and bad dial values', () => {
    expect(validatePaintedLandscape(base('marble')).some((e) => e.includes('unknown ground preset'))).toBe(true);
    expect(validatePaintedLandscape(base([1])).length).toBe(1);
    expect(validatePaintedLandscape(base({ cloud: 1.5 })).some((e) => e.includes('ground.cloud'))).toBe(true);
    expect(validatePaintedLandscape(base({ tile: 0 })).some((e) => e.includes('ground.tile'))).toBe(true);
    expect(validatePaintedLandscape(base({ flatMin: 2 })).some((e) => e.includes('ground.flatMin'))).toBe(true);
    expect(validatePaintedLandscape(base({ contrast: -1 })).some((e) => e.includes('ground.contrast'))).toBe(true);
  });

  it('absent ground leaves the face list texture-free (byte-identical guarantee)', () => {
    const { faces } = buildTerrainWorldMesh(base());
    expect(faces.some((f) => f.texture || f.uv || f.cornerFills)).toBe(false);
  });

  it('a preset textures both slope classes, rotates family variants, and bakes the cloud', () => {
    const { faces } = buildTerrainWorldMesh(base('sandstone'));
    const textured = faces.filter((f) => f.texture);
    expect(textured.length).toBeGreaterThan(0);
    const keys = new Set(textured.map((f) => f.texture));
    // steep tile is a family name → only rotated -a..d variants appear, never the bare key
    expect([...keys].some((k) => /^rock-sandstone-[a-d]$/.test(k))).toBe(true);
    expect(keys.has('rock-sandstone')).toBe(false);
    expect([...keys].filter((k) => k.startsWith('rock-sandstone-')).length).toBeGreaterThan(1);
    expect(keys.has(GROUND_PRESETS.sandstone.flat)).toBe(true);
    for (const f of textured) {
      expect(f.textureLit).toBe(true);
      expect(f.uv).toHaveLength(4);
      expect(f.cornerFills).toHaveLength(4);   // cloud is on by default → per-corner bake
    }
  });

  it('cloud: 0 disables the per-corner bake but keeps textures', () => {
    const { faces } = buildTerrainWorldMesh(base({ ...GROUND_PRESETS.sandstone, cloud: 0 }));
    const textured = faces.filter((f) => f.texture);
    expect(textured.length).toBeGreaterThan(0);
    expect(textured.some((f) => f.cornerFills)).toBe(false);
  });

  it('is deterministic — same manifest → identical face list', () => {
    const a = buildTerrainWorldMesh(base('sandstone'));
    const b = buildTerrainWorldMesh(base('sandstone'));
    expect(a.faces).toEqual(b.faces);
  });
});
