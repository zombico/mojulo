/**
 * glTF texture-transport edge cases (skin-over-mesh.plan.md phase 0b): the
 * TEXCOORD_0 / baseColorTexture / PNG-only-embed rules the atlas skins of
 * phase 2 will ride. Pinned before any skin work lands.
 */
import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';

// 1×1 PNG (the emit-fixtures label pixel) and a non-embeddable SVG data URL.
const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`;

const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const quad = (extra = {}) => ({
  corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
  fill: '#808080',
  ...extra,
});

function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}
const texPrim = (json, key = 'tex') => {
  const mesh = json.meshes.find((m) => m.name === `static:${key}`);
  return mesh ? mesh.primitives[0] : null;
};

describe('facesToGlb — texture transport', () => {
  it('a textured face exports TEXCOORD_0 + an embedded PNG baseColorTexture', () => {
    const json = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV })],
      textures: { tex: PNG_URL },
    }).bytes);
    const prim = texPrim(json);
    expect(prim.attributes.TEXCOORD_0).toBeDefined();
    expect(json.images).toHaveLength(1);
    expect(json.images[0].mimeType).toBe('image/png');
    const mat = json.materials[prim.material];
    expect(mat.pbrMetallicRoughness.baseColorTexture).toEqual({ index: 0 });
  });

  it('an unlit sticker omits COLOR_0; textureLit multiplies texel × baked colour via COLOR_0', () => {
    const sticker = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV })],
      textures: { tex: PNG_URL },
    }).bytes);
    expect(texPrim(sticker).attributes.COLOR_0).toBeUndefined();
    const lit = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV, textureLit: true })],
      textures: { tex: PNG_URL },
    }).bytes);
    expect(texPrim(lit).attributes.COLOR_0).toBeDefined();
  });

  it('PNG-only embed rule: an SVG data URL embeds nothing and drops TEXCOORD_0 — geometry survives on baked colour', () => {
    const json = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV })],
      textures: { tex: SVG_URL },
    }).bytes);
    expect(json.images ?? []).toHaveLength(0);
    const prim = texPrim(json);
    expect(prim).not.toBeNull();
    expect(prim.attributes.TEXCOORD_0).toBeUndefined();
    expect(prim.attributes.COLOR_0).toBeDefined();
    expect(json.materials[prim.material].pbrMetallicRoughness.baseColorTexture).toBeUndefined();
  });

  it('a missing textures entry behaves like a non-embeddable one (fallback, no crash)', () => {
    const json = parseGlb(facesToGlb({ faces: [quad({ texture: 'tex', uv: UV })] }).bytes);
    expect(texPrim(json).attributes.TEXCOORD_0).toBeUndefined();
  });

  it('texture × pbr: the tile rides as the albedo of a REAL lit material (no unlit extension)', () => {
    const json = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV, pbr: [0.8, 0.3] })],
      textures: { tex: PNG_URL },
    }).bytes);
    const mat = json.materials[texPrim(json).material];
    expect(mat.extensions?.KHR_materials_unlit).toBeUndefined();
    expect(mat.pbrMetallicRoughness.metallicFactor).toBe(0.8);
    expect(mat.pbrMetallicRoughness.roughnessFactor).toBe(0.3);
    expect(mat.pbrMetallicRoughness.baseColorTexture).toEqual({ index: 0 });
  });

  it('welds the textured quad diagonal (uv rides the weld key): 4 vertices, 6 indices', () => {
    const json = parseGlb(facesToGlb({
      faces: [quad({ texture: 'tex', uv: UV, textureLit: true })],
      textures: { tex: PNG_URL },
    }).bytes);
    const prim = texPrim(json);
    expect(prim.indices).toBeDefined();
    expect(json.accessors[prim.attributes.POSITION].count).toBe(4);
    expect(json.accessors[prim.attributes.TEXCOORD_0].count).toBe(4);
    expect(json.accessors[prim.indices].count).toBe(6);
  });

  it('identical positions with DIFFERENT uvs do not weld (the uv quantum splits them)', () => {
    // two coincident quads, one uv-shifted by more than 1/4096 — 8 distinct verts, not 4
    const json = parseGlb(facesToGlb({
      faces: [
        quad({ texture: 'tex', uv: UV, textureLit: true }),
        quad({ texture: 'tex', uv: UV.map(([u, v]) => [u + 0.25, v]), textureLit: true }),
      ],
      textures: { tex: PNG_URL },
    }).bytes);
    const prim = texPrim(json);
    expect(json.accessors[prim.attributes.POSITION].count).toBe(8);
  });
});
