import { describe, expect, it } from 'vitest';

import { facesToUsda, facesToUsdz } from './scene-usd.js';
import { readZip } from './zip-writer.js';

const quad = (fill = '#808080', extra = {}) => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill, ...extra });
const wall = (fill = '#aabbcc', extra = {}) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill, ...extra });
// 1×1 white PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const prims = (text, type) => [...text.matchAll(new RegExp(`def ${type} "([^"]+)"`, 'g'))].map((m) => m[1]);

describe('facesToUsda', () => {
  it('returns null for nothing exportable', () => {
    expect(facesToUsda({ faces: [] })).toBeNull();
    expect(facesToUsda({})).toBeNull();
  });

  it('writes a z-up, metre-scaled layer with one indexed Mesh per group and displayColor', () => {
    const out = facesToUsda({ faces: [quad(), wall('#aabbcc', { group: 'shell:wall' })] }, { generator: 'test', title: 'two faces' });
    const t = out.text;
    expect(t.startsWith('#usda 1.0\n(')).toBe(true);
    expect(t).toContain('upAxis = "Z"');
    expect(t).toContain('metersPerUnit = 1');
    expect(t).toContain('defaultPrim = "mojulo"');
    expect(t).toContain('string title = "two faces"');
    expect(prims(t, 'Mesh').sort()).toEqual(['shell_wall', 'static']);
    expect(t).toContain('int[] faceVertexCounts = [3, 3]');
    expect(t).toContain('primvars:displayColor');
    expect(t).toContain('uniform token subdivisionScheme = "none"');
    // coordinates land verbatim (no root rotation): the wall's top edge is at z=2
    expect(t).toContain('(2, 0, 2)');
    expect(out.vertexCount).toBe(8); // 4 + 4 after dedup
    expect(out.triangleCount).toBe(4);
    expect(out.nodeCount).toBe(2);
    expect(out.sidecars).toEqual([]);
    expect(out.byteLength).toBe(Buffer.byteLength(t, 'utf8'));
    // untextured meshes bind no material: every viewer shows displayColor directly
    expect(t).not.toContain('def Scope "Looks"');
  });

  it('is byte-identical for the same input', () => {
    const p = { faces: [quad('#336699'), wall()] };
    expect(facesToUsda(p).bytes.equals(facesToUsda(p).bytes)).toBe(true);
  });

  it('carries metersPerUnit from the caller (true scale for Quick Look)', () => {
    expect(facesToUsda({ faces: [quad()] }, { metersPerUnit: 0.01 }).text).toContain('metersPerUnit = 0.01');
  });

  it('textured faces bind a UsdPreviewSurface with a UsdUVTexture on a sidecar image', () => {
    const f = quad('#808080', { texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    const out = facesToUsda({ faces: [f], textures: { label: PNG } });
    expect(out.sidecars.map((s) => s.name)).toEqual(['textures/label.png']);
    expect(out.sidecars[0].bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(out.textureCount).toBe(1);
    const t = out.text;
    expect(t).toContain('def Scope "Looks"');
    expect(t).toContain('uniform token info:id = "UsdUVTexture"');
    expect(t).toContain('asset inputs:file = @textures/label.png@');
    expect(t).toContain('primvars:st');
    expect(t).toContain('rel material:binding = </mojulo/Looks/static_label>');
    expect(t).toContain('prepend apiSchemas = ["MaterialBindingAPI"]');
  });

  it('pbr faces bind a lit material with the displayColor primvar as diffuse', () => {
    const t = facesToUsda({ faces: [quad('#808080', { pbr: [0.9, 0.3] })] }).text;
    expect(t).toContain('def Mesh "static_pbr"');
    expect(t).toContain('float inputs:metallic = 0.9');
    expect(t).toContain('float inputs:roughness = 0.3');
    expect(t).toContain('uniform token info:id = "UsdPrimvarReader_float3"');
  });

  it('water and decals carry displayOpacity', () => {
    const t = facesToUsda({ faces: [quad(), quad('rgba(20,60,120,0.6)', { water: true }), quad('#222', { decal: 'shadow', shadowAlpha: 0.4 })] }).text;
    expect(prims(t, 'Mesh').sort()).toEqual(['shadows', 'static', 'water']);
    expect(t).toContain('primvars:displayOpacity');
  });

  it('instanced repeats become a PointInstancer with one prototype and N transforms', () => {
    const out = facesToUsda({
      faces: [],
      repeats: [{ group: 'trees', template: [quad('#00aa00')], transforms: [{ pos: [10, 0, 0] }, { pos: [0, 20, 0], scale: 2, rotZ: Math.PI }] }],
    });
    const t = out.text;
    expect(t).toContain('def PointInstancer "trees"');
    expect(t).toContain('rel prototypes = [</mojulo/trees/proto>]');
    expect(t).toContain('int[] protoIndices = [0, 0]');
    expect(t).toContain('point3f[] positions = [(10, 0, 0), (0, 20, 0)]');
    expect(t).toContain('quath[] orientations = [(1, 0, 0, 0), (0, 0, 0, 1)]'); // (w, x, y, z); π about Z
    expect(t).toContain('float3[] scales = [(1, 1, 1), (2, 2, 2)]');
    expect(out.instancerCount).toBe(1);
    expect(out.triangleCount).toBe(4); // 2 tris × 2 instances
  });

  it('level semantics: cameras, entity Xforms with moj: customData, layer customLayerData', () => {
    const out = facesToUsda({
      faces: [quad()],
      cameras: [{ name: 'hero shot', worldFraming: { cameraPosition: [10, -10, 8], lookAt: [0, 0, 1], horizontalFov: 55 } }],
      entities: [{ id: 'hero', transform: { pos: [3, 4, 0], heading: 1.2 }, rule: { type: 'platform' }, body: { figure: 'hero' } }],
      walk: { spawn: [1, 2, 1.6] },
      colliders: [{ min: [0, 0, 0], max: [1, 1, 1] }],
    });
    const t = out.text;
    expect(t).toContain('def Camera "cam_hero_shot"');
    expect(t).toContain('token projection = "perspective"');
    expect(t).toContain('matrix4d xformOp:transform');
    expect(t).toContain('def Xform "entity_hero"');
    expect(t).toContain('string "moj:entity" = "hero"');
    expect(t).toContain('string "moj:rule" = "platform"');
    expect(t).toContain('double3 xformOp:translate = (3, 4, 0)');
    expect(t).toContain('customLayerData = {');
    expect(t).toContain('string "moj:spawn" = "[1,2,1.6]"');
    expect(t).toContain('"moj:colliders"');
    expect(out.cameraCount).toBe(1);
    expect(out.entityCount).toBe(1);
  });

  it('sanitizes prim names and keeps them unique', () => {
    const t = facesToUsda({ faces: [quad('#111', { group: '9 odd:name' }), quad('#222', { group: '9-odd name' })] }).text;
    expect(prims(t, 'Mesh').sort()).toEqual(['_9_odd_name', '_9_odd_name_2']);
  });
});

describe('facesToUsdz', () => {
  it('packs model.usda first, stored and 64-byte aligned, with the texture sidecars', () => {
    const f = quad('#808080', { texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    const out = facesToUsdz({ faces: [f], textures: { label: PNG } }, { title: 'zipped' });
    expect(out.files).toEqual(['model.usda', 'textures/label.png']);
    expect(out.sidecars).toEqual([]);
    const entries = readZip(out.bytes);
    expect(entries.map((e) => e.name)).toEqual(['model.usda', 'textures/label.png']);
    for (const e of entries) { expect(e.method).toBe('store'); expect(e.offset % 64).toBe(0); }
    expect(entries[0].data.toString('utf8')).toContain('#usda 1.0');
    expect(out.byteLength).toBe(out.bytes.length);
    expect(facesToUsdz({ faces: [f], textures: { label: PNG } }, { title: 'zipped' }).bytes.equals(out.bytes)).toBe(true);
  });

  it('returns null for nothing exportable', () => {
    expect(facesToUsdz({ faces: [] })).toBeNull();
  });
});
