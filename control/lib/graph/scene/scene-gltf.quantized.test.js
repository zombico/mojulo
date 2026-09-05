import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { glbToFaces, parseGlb } from './scene-gltf-read.js';

// interchange-seams.plan.md seam 6a — KHR_mesh_quantization behind `quantize: true`.
// Off ⇒ byte-identical float export (the existing pins); on ⇒ int16 positions under a
// dequantizing node TRS, uint16 colours, int8 normals, strides multiples of 4, the extension
// declared REQUIRED, and a round-trip through the reader within the quantization step.

const quad = (fill = '#808080', extra = {}) => ({ corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], fill, ...extra });
const wall = (fill = '#aabbcc', extra = {}) => ({ corners: [[0, 0, 0], [10, 0, 0], [10, 0, 5], [0, 0, 5]], fill, ...extra });
const PAYLOAD = {
  faces: [quad('#ff0000'), wall('#00ff00', { group: 'shell:wall', outNormal: [0, -1, 0] })],
  repeats: [{ group: 'trees', template: [quad('#00aa00')], transforms: [{ pos: [100, 0, 0] }, { pos: [0, 200, 0], scale: 2, rotZ: Math.PI / 2 }] }],
};

const centroid = (f) => f.corners.slice(0, 3).reduce((a, c) => [a[0] + c[0] / 3, a[1] + c[1] / 3, a[2] + c[2] / 3], [0, 0, 0]);

describe('facesToGlb quantize', () => {
  it('off (default) is byte-identical to quantize:false', () => {
    expect(facesToGlb(PAYLOAD).bytes.equals(facesToGlb(PAYLOAD, { quantize: false }).bytes)).toBe(true);
    const { json } = parseGlb(facesToGlb(PAYLOAD).bytes);
    expect(json.extensionsUsed).not.toContain('KHR_mesh_quantization');
    expect(json.extensionsRequired).toBeUndefined();
  });

  it('declares the extension as required and writes int16/uint16/int8 attributes with 4-aligned strides', () => {
    const out = facesToGlb(PAYLOAD, { quantize: true });
    expect(out.quantized).toBe(true);
    expect(out.quantizeStep).toBeGreaterThan(0);
    expect(out.quantizeStep).toBeLessThan(0.001); // a 10-unit box → 5/32767 per axis
    const { json } = parseGlb(out.bytes);
    expect(json.extensionsUsed).toContain('KHR_mesh_quantization');
    expect(json.extensionsRequired).toEqual(['KHR_mesh_quantization']);
    for (const mesh of json.meshes) {
      const a = mesh.primitives[0].attributes;
      const pos = json.accessors[a.POSITION];
      expect(pos.componentType).toBe(5122);
      expect(pos.normalized).toBe(true);
      expect(json.bufferViews[pos.bufferView].byteStride).toBe(8);
      const col = json.accessors[a.COLOR_0];
      expect(col.componentType).toBe(5123);
      expect(json.bufferViews[col.bufferView].byteStride).toBe(8);
      if (a.NORMAL != null) {
        expect(json.accessors[a.NORMAL].componentType).toBe(5120);
        expect(json.bufferViews[json.accessors[a.NORMAL].bufferView].byteStride).toBe(4);
      }
    }
    // every mesh node (or the instanced child) carries the dequantizing TRS
    const meshNodes = json.nodes.filter((n) => n.mesh != null);
    expect(meshNodes.length).toBeGreaterThan(0);
    for (const n of meshNodes) { expect(n.translation).toHaveLength(3); expect(n.scale).toHaveLength(3); }
    // the instance nodes keep the World's TRS and parent the dequant child
    const inst = json.nodes.find((n) => n.name === 'trees:1');
    expect(inst.scale).toEqual([2, 2, 2]);
    expect(inst.children).toHaveLength(1);
    expect(json.nodes[inst.children[0]].mesh).toBeDefined();
  });

  it('is smaller than the float export', () => {
    const big = { faces: [] };
    for (let i = 0; i < 200; i++) big.faces.push({ ...quad('#808080'), corners: [[i, 0, 0], [i + 1, 0, 0], [i + 1, 1, 0], [i, 1, 0]] });
    // 24 → 16 bytes per vertex (pos 12→8, colour 12→8); JSON overhead keeps a small fixture from
    // reaching the asymptote, so pin the direction here and the per-vertex accounting below.
    const q = facesToGlb(big, { quantize: true }), f = facesToGlb(big);
    expect(q.byteLength).toBeLessThan(f.byteLength * 0.8);
    const { json } = parseGlb(q.bytes);
    const a = json.meshes[0].primitives[0].attributes;
    const n = json.accessors[a.POSITION].count;
    expect(json.bufferViews[json.accessors[a.POSITION].bufferView].byteLength).toBe(n * 8);
    expect(json.bufferViews[json.accessors[a.COLOR_0].bufferView].byteLength).toBe(n * 8);
  });

  it('round-trips through the reader within the quantization step, instances included', () => {
    const float = glbToFaces(facesToGlb(PAYLOAD).bytes);
    const quant = glbToFaces(facesToGlb(PAYLOAD, { quantize: true }).bytes);
    expect(quant.length).toBe(float.length);
    const key = (f) => centroid(f).map((v) => Math.round(v * 10) / 10).join(',');
    const byKey = new Map(float.map((f) => [key(f), f]));
    for (const f of quant) {
      const twin = byKey.get(key(f));
      expect(twin, `no float twin for ${key(f)}`).toBeTruthy();
      const a = centroid(f), b = centroid(twin);
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01);
      expect(f.fill).toBe(twin.fill);
    }
  });

  it('keeps repeating-tile UVs as float, unit UVs as uint16', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
    const unit = quad('#808080', { texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    const tile = quad('#808080', { texture: 'tile', uv: [[0, 0], [8, 0], [8, 8], [0, 8]] });
    const { json } = parseGlb(facesToGlb({ faces: [unit, tile], textures: { label: PNG, tile: PNG } }, { quantize: true }).bytes);
    const types = json.meshes.map((m) => json.accessors[m.primitives[0].attributes.TEXCOORD_0]?.componentType).filter(Boolean).sort();
    expect(types).toEqual([5123, 5126]);
  });
});
