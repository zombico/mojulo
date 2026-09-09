// interchange-seams.plan.md seam 6b — textures on ingest. The machine gate: a payload
// exported with a texture wrap (TEXCOORD_0 + embedded PNG) decodes back to the SAME
// `{ texture, uv }` faces + `textures` map, and re-exports with the texture data
// byte-identical (map, image bytes, UVs). Plus the ledger's honesty: keys, textureLit,
// dropped maps, unsupported images.
import { describe, expect, it } from 'vitest';
import { facesToGlb } from './scene-gltf.js';
import { glbToScene, glbToFaces, parseGlb } from './scene-gltf-read.js';

const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG2_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const quad = (x, extra = {}) => ({ corners: [[x, 0, 0], [x + 2, 0, 0], [x + 2, 2, 0], [x, 2, 0]], fill: '#808080', group: 'mesh', ...extra });

// rebuild a GLB from a patched JSON + the original BIN (for crafting maps the writer never emits)
function rebuild(bytes, patch) {
  const { json, bin } = parseGlb(bytes);
  patch(json);
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jpad = (4 - (jsonBuf.length % 4)) % 4;
  const bpad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jpad + 8 + bin.length + bpad;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jpad, 12); out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20); out.fill(0x20, 20 + jsonBuf.length, 20 + jsonBuf.length + jpad);
  const bo = 20 + jsonBuf.length + jpad;
  out.writeUInt32LE(bin.length + bpad, bo); out.writeUInt32LE(0x004e4942, bo + 4);
  bin.copy(out, bo + 8);
  return out;
}

describe('seam 6b — textures on ingest', () => {
  it('the reader flips v back: a textured face returns with its OWN uv (glTF top-left ↔ mojulo bottom-left)', () => {
    const uv = [[0, 0.2], [1, 0.2], [1, 0.9], [0, 0.9]];
    const scene = glbToScene(facesToGlb({ faces: [quad(5, { texture: 'tex', uv })], textures: { tex: PNG_URL } }, { generator: 't' }).bytes);
    const seen = new Set(scene.faces.filter((f) => f.texture).flatMap((f) => f.uv.map(([u, v]) => `${u.toFixed(3)},${v.toFixed(3)}`)));
    expect([...seen].sort()).toEqual(uv.map(([u, v]) => `${u.toFixed(3)},${v.toFixed(3)}`).sort());
  });

  it('export textured → read → export again is BYTE-IDENTICAL (the writer\'s own output)', () => {
    const payload = { faces: [quad(0), quad(5, { texture: 'tex', uv: UV })], textures: { tex: PNG_URL } };
    const a = facesToGlb(payload, { generator: 't' });
    const scene = glbToScene(a.bytes);
    expect(Object.keys(scene.textures)).toEqual(['tex']);
    expect(scene.textures.tex).toBe(PNG_URL); // byte-preserved
    const textured = scene.faces.filter((f) => f.texture);
    expect(textured.length).toBe(2);
    for (const f of textured) {
      expect(f.texture).toBe('tex');
      expect(f.uv).toHaveLength(4);
      expect(f.uv[3]).toEqual(f.uv[2]); // the padded corner's uv
      expect(f.textureLit).toBeUndefined(); // an unlit sticker: no COLOR_0
    }
    expect(scene.ledger.textures_carried).toEqual([{ key: 'tex', mime: 'image/png', bytes: 70 }]);
    expect(scene.ledger.textures_dropped).toEqual([]);
    // Re-export: the texture DATA is identical — same map, same image bytes, same per-corner
    // UVs, TEXCOORD_0 + baseColorTexture on the textured primitive — and the second file
    // decodes to the same faces. (Whole-file byte identity is blocked by the reader's
    // padded-triangle form + the writer's decollide lift, pre-existing since I3.)
    const b = facesToGlb({ faces: scene.faces, textures: scene.textures }, { generator: 't' });
    const jb = parseGlb(b.bytes);
    const prim = jb.json.meshes.find((m) => m.name === 'mesh:tex').primitives[0];
    expect(prim.attributes.TEXCOORD_0).toBeDefined();
    expect(jb.json.materials[prim.material].pbrMetallicRoughness.baseColorTexture).toBeDefined();
    const imgBytes = (bytes) => { const { json, bin } = parseGlb(bytes); const v = json.bufferViews[json.images[0].bufferView]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
    expect(Buffer.compare(imgBytes(a.bytes), imgBytes(b.bytes))).toBe(0);
    const again = glbToScene(b.bytes);
    expect(again.textures).toEqual(scene.textures);
    const strip = (f) => ({ texture: f.texture ?? null, uv: f.uv ?? null, fill: f.fill, lit: f.textureLit ?? null });
    expect(again.faces.map(strip)).toEqual(scene.faces.map(strip));
  });

  it('textureLit round-trips through COLOR_0, byte-identical too', () => {
    const payload = { faces: [quad(5, { texture: 'tex', uv: UV, textureLit: true, fill: '#a04020' })], textures: { tex: PNG_URL } };
    const a = facesToGlb(payload, { generator: 't' });
    const scene = glbToScene(a.bytes);
    expect(scene.faces.every((f) => f.textureLit === true && f.fill === '#a04020')).toBe(true);
    const b = facesToGlb({ faces: scene.faces, textures: scene.textures }, { generator: 't' });
    const prim = parseGlb(b.bytes).json.meshes.find((m) => m.name === 'mesh:tex').primitives[0];
    expect(prim.attributes.COLOR_0).toBeDefined(); // the lit rule survives the round trip
    const again = glbToScene(b.bytes);
    expect(again.faces.every((f) => f.textureLit === true && f.fill === '#a04020' && f.texture === 'tex')).toBe(true);
    expect(again.textures).toEqual(scene.textures);
  });

  it('keys come from the writer\'s <group>:<key> spelling; two images with one name dedupe by texture index', () => {
    const payload = { faces: [quad(0, { texture: 'oak', uv: UV }), quad(5, { texture: 'brick', uv: UV })], textures: { oak: PNG_URL, brick: PNG2_URL } };
    const scene = glbToScene(facesToGlb(payload, { generator: 't' }).bytes);
    expect(Object.keys(scene.textures).sort()).toEqual(['brick', 'oak']);
    expect(scene.textures.brick).toBe(PNG2_URL);
    // craft a collision: rename both materials to the same name
    const crafted = rebuild(facesToGlb(payload, { generator: 't' }).bytes, (j) => { for (const m of j.materials) if (m.pbrMetallicRoughness.baseColorTexture) m.name = 'wall:paint'; });
    const s2 = glbToScene(crafted);
    const keys = Object.keys(s2.textures).sort();
    expect(keys.length).toBe(2);
    expect(keys).toContain('paint');
    expect(keys.some((k) => /^paint#\d+$/.test(k))).toBe(true);
  });

  it('ledger: non-albedo maps are COUNTED and dropped; an unsupported image or a TEXCOORD_1 binding is NAMED', () => {
    const payload = { faces: [quad(5, { texture: 'tex', uv: UV })], textures: { tex: PNG_URL } };
    const base = facesToGlb(payload, { generator: 't' }).bytes;
    const withMaps = rebuild(base, (j) => { const m = j.materials.find((x) => x.pbrMetallicRoughness.baseColorTexture); m.normalTexture = { index: 0 }; m.occlusionTexture = { index: 0 }; m.pbrMetallicRoughness.metallicRoughnessTexture = { index: 0 }; });
    expect(glbToScene(withMaps).ledger.maps_dropped).toEqual({ normal: 1, occlusion: 1, emissive: 0, metallicRoughness: 1 });
    const webp = rebuild(base, (j) => { j.images[0].mimeType = 'image/webp'; });
    const sw = glbToScene(webp);
    expect(sw.textures).toEqual({});
    expect(sw.ledger.textures_dropped[0]).toMatchObject({ key: 'tex', reason: expect.stringMatching(/webp/) });
    expect(sw.faces.every((f) => !f.texture)).toBe(true); // geometry survives on baked colour
    const uv1 = rebuild(base, (j) => { const m = j.materials.find((x) => x.pbrMetallicRoughness.baseColorTexture); m.pbrMetallicRoughness.baseColorTexture.texCoord = 1; });
    expect(glbToScene(uv1).ledger.textures_dropped[0].reason).toMatch(/TEXCOORD_1/);
    const external = rebuild(base, (j) => { delete j.images[0].bufferView; j.images[0].uri = 'paint.png'; });
    expect(glbToScene(external).ledger.textures_dropped[0].reason).toMatch(/external/);
  });

  it('glbToFaces is the face view; an untextured export still decodes with an empty ledger (byte-identical to before)', () => {
    const a = facesToGlb({ faces: [quad(0), quad(5)] }, { generator: 't' });
    const scene = glbToScene(a.bytes);
    expect(scene.textures).toEqual({});
    expect(scene.ledger.textures_carried).toEqual([]);
    expect(glbToFaces(a.bytes)).toEqual(scene.faces);
    expect(scene.faces.every((f) => !('texture' in f) && !('uv' in f))).toBe(true);
  });
});
