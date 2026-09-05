/**
 * The LIT handoff (lit-handoff.plan.md step 1): `facesToGlb(payload, { lit: true })`
 * writes real pbrMetallicRoughness materials — no KHR_materials_unlit anywhere — with
 * COLOR_0 and authored NORMALs, so an importer's light shades the geometry. Default
 * export stays byte-identical (unlit).
 */
import { describe, expect, it } from 'vitest';
import { facesToGlb } from './scene-gltf.js';

const q = (x, y, z, extra = {}) => ({ corners: [[x, y, z], [x + 2, y, z], [x + 2, y + 2, z], [x, y + 2, z]], fill: '#8899aa', outNormal: [0, 0, 1], ...extra });
const FACES = [q(0, 0, 0), q(3, 0, 0, { group: 'asset:chair' }), q(6, 0, 1, { group: 'asset:chair', fill: '#c0ffee' })];
const glbJson = (bytes) => {
  const len = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + len).toString('utf8'));
};

describe('facesToGlb lit', () => {
  it('lit: real PBR materials, no unlit extension, normals + colours present', () => {
    const out = facesToGlb({ faces: FACES }, { generator: 't', lit: true });
    expect(out.lit).toBe(true);
    const j = glbJson(out.bytes);
    expect(j.extensionsUsed || []).not.toContain('KHR_materials_unlit');
    expect(j.materials.length).toBeGreaterThan(0);
    for (const m of j.materials) {
      expect(m.extensions?.KHR_materials_unlit).toBeUndefined();
      expect(m.pbrMetallicRoughness.metallicFactor).toBe(0);
      expect(m.pbrMetallicRoughness.roughnessFactor).toBeCloseTo(0.85, 6);
    }
    for (const mesh of j.meshes) for (const prim of mesh.primitives) {
      expect(prim.attributes.COLOR_0).toBeDefined();
      expect(prim.attributes.NORMAL).toBeDefined();
    }
  });

  it('roughness is a dial; default export is unlit and byte-identical to before', () => {
    const j = glbJson(facesToGlb({ faces: FACES }, { generator: 't', lit: true, roughness: 0.4 }).bytes);
    expect(j.materials[0].pbrMetallicRoughness.roughnessFactor).toBeCloseTo(0.4, 6);
    const a = facesToGlb({ faces: FACES }, { generator: 't' });
    const b = facesToGlb({ faces: FACES }, { generator: 't', lit: false });
    expect(a.lit).toBe(false);
    expect(Buffer.compare(a.bytes, b.bytes)).toBe(0);
    const ja = glbJson(a.bytes);
    expect(ja.extensionsUsed).toContain('KHR_materials_unlit');
    expect(ja.materials.every((m) => m.extensions?.KHR_materials_unlit)).toBe(true);
  });
});
