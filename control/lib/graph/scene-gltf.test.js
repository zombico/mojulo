import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';

// A minimal unit quad on the ground plane (z=0), corners in TL,TR,BR,BL order.
function quad(fill = '#808080', extra = {}) {
  return {
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    fill,
    ...extra,
  };
}

// Parse a GLB Buffer back into { json, binLength } for assertions.
function parseGlb(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2); // version 2
  expect(buf.readUInt32LE(8)).toBe(buf.length); // total length matches
  const jsonLen = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binChunkOffset = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binChunkOffset);
  expect(buf.readUInt32LE(binChunkOffset + 4)).toBe(0x004e4942); // 'BIN\0'
  return { json, binLen };
}

describe('facesToGlb', () => {
  it('returns null for an empty face list', () => {
    expect(facesToGlb({ faces: [] })).toBeNull();
    expect(facesToGlb({})).toBeNull();
  });

  it('emits a valid GLB container for a single quad', () => {
    const out = facesToGlb({ faces: [quad()] });
    expect(out).not.toBeNull();
    const { json, binLen } = parseGlb(out.bytes);
    expect(json.asset.version).toBe('2.0');
    // total length and chunk lengths are 4-byte aligned
    expect(out.bytes.length % 4).toBe(0);
    expect(binLen % 4).toBe(0);
    expect(json.buffers[0].byteLength).toBe(binLen);
  });

  it('exports unlit materials (KHR_materials_unlit) with vertex colours', () => {
    const { json } = parseGlb(facesToGlb({ faces: [quad()] }).bytes);
    expect(json.extensionsUsed).toContain('KHR_materials_unlit');
    expect(json.materials[0].extensions.KHR_materials_unlit).toBeDefined();
    // every primitive carries POSITION + COLOR_0
    for (const mesh of json.meshes) {
      for (const prim of mesh.primitives) {
        expect(prim.attributes.POSITION).toBeDefined();
        expect(prim.attributes.COLOR_0).toBeDefined();
        expect(prim.mode).toBe(4); // TRIANGLES
      }
    }
  });

  it('counts two triangles and six vertices per quad', () => {
    const out = facesToGlb({ faces: [quad()] });
    expect(out.triangleCount).toBe(2);
    expect(out.vertexCount).toBe(6);
    expect(out.nodeCount).toBe(1);
  });

  it('POSITION accessors carry min/max bounds', () => {
    const { json } = parseGlb(facesToGlb({ faces: [quad()] }).bytes);
    const posAcc = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    expect(posAcc.type).toBe('VEC3');
    expect(posAcc.min).toEqual([0, 0, 0]);
    expect(posAcc.max).toEqual([1, 1, 0]);
  });

  it('roots geometry under a z-up→y-up rotated node', () => {
    const { json } = parseGlb(facesToGlb({ faces: [quad()] }).bytes);
    expect(json.scenes[0].nodes).toHaveLength(1);
    const root = json.nodes[json.scenes[0].nodes[0]];
    expect(root.rotation).toBeDefined();
    // -90° about X ≈ [-0.7071, 0, 0, 0.7071]
    expect(root.rotation[0]).toBeCloseTo(-0.70710678, 5);
    expect(root.rotation[3]).toBeCloseTo(0.70710678, 5);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it('splits faces into one node per render group', () => {
    const out = facesToGlb({
      faces: [
        quad('#ff0000', { group: 'shell:wall-a' }),
        quad('#00ff00', { group: 'shell:wall-b' }),
        quad('#0000ff'), // → 'static'
      ],
    });
    const { json } = parseGlb(out.bytes);
    const names = json.nodes.filter((n) => n.mesh != null).map((n) => n.name).sort();
    expect(names).toEqual(['shell:wall-a', 'shell:wall-b', 'static']);
  });

  it('exports water as a blended VEC4-colour mesh', () => {
    const { json } = parseGlb(facesToGlb({ faces: [quad('rgba(20,60,120,0.6)', { water: true })] }).bytes);
    const waterMesh = json.meshes.find((m) => m.name === 'water');
    expect(waterMesh).toBeDefined();
    const prim = waterMesh.primitives[0];
    expect(json.accessors[prim.attributes.COLOR_0].type).toBe('VEC4');
    expect(json.materials[prim.material].alphaMode).toBe('BLEND');
  });

  it('exports flat shadow decals as a blended mesh', () => {
    const { json } = parseGlb(
      facesToGlb({ faces: [quad('#222', { decal: 'shadow', shadowAlpha: 0.4 })] }).bytes,
    );
    const shadow = json.meshes.find((m) => m.name === 'shadows');
    expect(shadow).toBeDefined();
    expect(json.materials[shadow.primitives[0].material].alphaMode).toBe('BLEND');
  });
});
