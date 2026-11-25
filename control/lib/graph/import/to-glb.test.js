import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toGlb, packGlb, safeRelative, imageMime, modelCandidates, pickEntry, FORMATS_REFUSED } from './to-glb.js';
import { inspectModel, unitsReading } from './inspect.js';
import { readModelPath } from './read-path.js';
import { parseGlb, readAccessor } from '../scene/scene-gltf-read.js';

// the smallest PNG (1×1) and a zip writer (stored, no compression) for the containers
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function zip(files) {
  const locals = [], cens = []; let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const nb = Buffer.from(name), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, data); cens.push(ch, nb); off += 30 + nb.length + data.length;
  }
  const cen = Buffer.concat(cens), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(cens.length / 2, 8); eocd.writeUInt16LE(cens.length / 2, 10); eocd.writeUInt32LE(cen.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cen, eocd]);
}

// one triangle as a glTF whose buffer (and, optionally, image) live in named files
function triangleGltf({ image = null, height = 2 } = {}) {
  const bin = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, height, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, ...(image ? { material: 0 } : {}) }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, height, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ uri: 'tri.bin', byteLength: 36 }],
    ...(image ? { images: [{ uri: image }], textures: [{ source: 0 }], materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }] } : {}),
  };
  return { json: Buffer.from(JSON.stringify(json)), bin };
}
const filesResolver = (files) => (rel) => files[rel] ?? null;

describe('import: every file people bring becomes one GLB at the door', () => {
  it('reads an OBJ with its MTL and texture: polygons fanned, uv flipped to glTF, materials in first-use order', async () => {
    const obj = Buffer.from([
      'mtllib look.mtl', 'v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0', 'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1',
      'usemtl skin', 'f 1/1 2/2 3/3 4/4', 'usemtl cloth', 'f -4/1 -2/3 -1/4',
    ].join('\n'));
    const mtl = Buffer.from('newmtl skin\nKd 1 0.5 0.25\nmap_Kd -s 1 1 1 tex/skin.png\nnewmtl cloth\nKd 0.2 0.4 0.6\nd 0.5\n');
    const r = await toGlb(obj, 'man.obj', { resolve: filesResolver({ 'look.mtl': mtl, 'tex/skin.png': PNG }) });
    const { json, bin } = parseGlb(r.bytes);
    expect(r.from).toMatchObject({ format: 'obj', up: 'y', files: ['look.mtl', 'tex/skin.png'] });
    expect(json.meshes[0].primitives.map((p) => json.materials[p.material].name)).toEqual(['skin', 'cloth']);
    expect(json.meshes[0].primitives.map((p) => json.accessors[p.indices].count)).toEqual([6, 3]);
    expect(json.materials[0].pbrMetallicRoughness.baseColorTexture).toEqual({ index: 0 });
    expect(json.materials[1].alphaMode).toBe('BLEND');
    expect(json.images[0].mimeType).toBe('image/png');
    // OBJ's v runs up from the bottom; glTF's down from the top
    const uv = readAccessor(json, bin, json.meshes[0].primitives[0].attributes.TEXCOORD_0);
    expect(uv.slice(0, 2)).toEqual([0, 1]);
    expect(inspectModel(r.bytes).triangles).toBe(3);
    // the same file gives the same bytes
    expect(Buffer.compare(r.bytes, (await toGlb(obj, 'man.obj', { resolve: filesResolver({ 'look.mtl': mtl, 'tex/skin.png': PNG }) })).bytes)).toBe(0);
  });

  it('pulls a .gltf\'s buffer and images into the GLB, and names an image that did not come', async () => {
    const { json, bin } = triangleGltf({ image: 'img%20one.png' });
    const ok = await toGlb(json, 'm.gltf', { resolve: filesResolver({ 'tri.bin': bin, 'img one.png': PNG }) });
    const g = parseGlb(ok.bytes).json;
    expect(g.buffers).toHaveLength(1);
    expect(g.buffers[0].uri).toBeUndefined();
    expect(g.images[0]).toMatchObject({ mimeType: 'image/png' });
    expect(g.images[0].uri).toBeUndefined();
    expect(ok.ledger.images_missing).toEqual([]);
    const missing = await toGlb(json, 'm.gltf', { resolve: filesResolver({ 'tri.bin': bin }) });
    expect(missing.ledger.images_missing).toEqual(['img%20one.png']);
    expect(missing.ledger.notes.join(' ')).toMatch(/did not come with it/);
    await expect(toGlb(json, 'm.gltf', { resolve: filesResolver({}) })).rejects.toThrow(/not beside it/);
  });

  it('keeps a GLB that names nothing outside itself byte for byte', async () => {
    const { json, bin } = triangleGltf();
    const j = JSON.parse(json); delete j.buffers[0].uri;
    const glb = packGlb(j, bin);
    expect(Buffer.compare((await toGlb(glb, 'a.glb')).bytes, glb)).toBe(0);
    expect(Buffer.compare((await toGlb(glb, 'a.vrm')).bytes, glb)).toBe(0);
  });

  it('never reads a neighbour above the model, an absolute path or a URL', async () => {
    expect(safeRelative('../secret.bin')).toBe(null);
    expect(safeRelative('a/../../b')).toBe(null);
    expect(safeRelative('/etc/passwd')).toBe(null);
    expect(safeRelative('https://x.test/a.bin')).toBe(null);
    expect(safeRelative('file:///a.bin')).toBe(null);
    expect(safeRelative('./tex\\a%20b.png')).toBe('tex/a b.png');
    const asked = [];
    const j = JSON.parse(triangleGltf().json); j.buffers[0].uri = '../tri.bin';
    await expect(toGlb(Buffer.from(JSON.stringify(j)), 'm.gltf', { resolve: (r) => { asked.push(r); return null; } })).rejects.toThrow(/not beside it/);
    expect(asked).toEqual([]);
  });

  it('opens a zip: the one model in it, its neighbours by its folder; several models are asked for by name', async () => {
    const { json, bin } = triangleGltf();
    const one = zip({ 'pack/m.gltf': json, 'pack/tri.bin': bin, '__MACOSX/pack/._m.gltf': Buffer.from('x') });
    const r = await toGlb(one, 'pack.zip');
    expect(r.from).toMatchObject({ container: 'zip', entry: 'pack/m.gltf', format: 'gltf' });
    const two = zip({ 'a.obj': Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'b.obj': Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') });
    await expect(toGlb(two, 'kit.zip')).rejects.toThrow(/holds 2 models; name the one meant as `entry`: a\.obj, b\.obj/);
    expect((await toGlb(two, 'kit.zip', { entry: 'b.obj' })).from.entry).toBe('b.obj');
    expect(modelCandidates(['x/a.obj', 'b.glb', 'c.gltf', 'notes.txt'])).toEqual(['b.glb', 'c.gltf', 'x/a.obj']);
    expect(pickEntry(['a.obj', 'z/b.glb'])).toBe('z/b.glb');
  });

  it('refuses what it cannot read, with the line that gets it in', async () => {
    await expect(toGlb(Buffer.from('Kaydara FBX Binary  \0'), 'walk.fbx')).rejects.toThrow(/FBX is not read here yet: export it .* as a GLB/);
    for (const ext of ['dae', 'usdz', 'blend', 'ply']) expect(FORMATS_REFUSED[ext]).toMatch(/GLB/);
    const j = JSON.parse(triangleGltf().json); j.extensionsUsed = ['KHR_draco_mesh_compression']; j.extensionsRequired = ['KHR_draco_mesh_compression'];
    await expect(toGlb(Buffer.from(JSON.stringify(j)), 'm.gltf', { resolve: () => triangleGltf().bin })).rejects.toThrow(/Draco-compressed geometry, which is not read here/);
    await expect(toGlb(Buffer.from('hello'), 'notes.txt')).rejects.toThrow(/not a format mojulo reads/);
    expect(imageMime(Buffer.from('GIF89a......'))).toBe(null);
  });

  it('stands a file written on another axis on glTF\'s y at its root, its vertices untouched', async () => {
    const tri = Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 2\nf 1 2 3\n'); // 2 tall on its z
    const asIs = inspectModel((await toGlb(tri, 't.obj')).bytes);
    const turned = inspectModel((await toGlb(tri, 't.obj', { up: 'z' })).bytes);
    expect(asIs.rest.height).toBe(0);
    expect(turned.rest.height).toBe(2);
    await expect(toGlb(tri, 't.obj', { up: 'x' })).rejects.toThrow(/`up` is 'y' or 'z'/);
  });
});

describe('import: what a model holds, read once', () => {
  // a Mixamo-shaped figure: its vertices written in centimetres under an armature scaled 0.01
  function cmFigure() {
    const bin = Buffer.alloc(36 + 12 + 48 + 64);
    [0, 0, 0, 40, 0, 0, 0, 180, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4)); // positions, cm
    // joints (three ubyte VEC4s, all joint 0) are the zeros already there; weights wholly on it
    for (let i = 0; i < 3; i++) bin.writeFloatLE(1, 48 + i * 16);
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1].forEach((v, i) => bin.writeFloatLE(v, 96 + i * 4)); // inverse bind
    const json = {
      asset: { version: '2.0', extras: { author: 'someone', license: 'CC-BY-NC-4.0' } }, scene: 0, scenes: [{ nodes: [0, 1] }],
      nodes: [{ name: 'Armature', scale: [0.01, 0.01, 0.01], children: [2] }, { name: 'Body', mesh: 0, skin: 0 }, { name: 'mixamorig:Hips' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
      skins: [{ joints: [2], inverseBindMatrices: 3 }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [40, 180, 0] },
        { bufferView: 1, componentType: 5121, count: 3, type: 'VEC4' },
        { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
        { bufferView: 3, componentType: 5126, count: 1, type: 'MAT4' },
      ],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 12 }, { buffer: 0, byteOffset: 48, byteLength: 48 }, { buffer: 0, byteOffset: 96, byteLength: 64 }],
      buffers: [{ byteLength: bin.length }],
    };
    return packGlb(json, bin);
  }

  it('measures a skinned figure as its skin stands it, not as its mesh node\'s box', () => {
    const i = inspectModel(cmFigure());
    expect(i.rest.skinned).toBe(true);
    expect(i.rest.height).toBeCloseTo(1.8, 4); // 180 written, 0.01 applied through the joint
    expect(i.units).toMatchObject({ assumed: 'm' });
    expect(i.skins[0].names).toEqual(['mixamorig:Hips']);
    expect(i.licence).toMatchObject({ author: 'someone', name: 'CC-BY-NC-4.0', basis: 'asset' });
    expect(i.warnings.join(' ')).toMatch(/non-commercial/);
  });

  it('reads a figure\'s height every way its numbers could be meant, and says which fit', () => {
    expect(unitsReading(1.8, { figure: true })).toMatchObject({ assumed: 'm' });
    const cm = unitsReading(180, { figure: true });
    expect(cm).toMatchObject({ assumed: 'cm', ambiguous: true });
    expect(cm.readings.find((r) => r.units === 'cm').height).toBe(1.8);
    expect(unitsReading(180).assumed).toBe('m'); // a prop is read at its own numbers
    expect(() => inspectModel(packGlb({ asset: { version: '2.0' }, scenes: [{ nodes: [] }] }))).toThrow(/draws nothing/);
  });
});

describe('import: a model on this machine\'s disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-import-'));
  const { json, bin } = triangleGltf();
  mkdirSync(path.join(dir, 'stool'));
  writeFileSync(path.join(dir, 'stool', 'm.gltf'), json);
  writeFileSync(path.join(dir, 'stool', 'tri.bin'), bin);
  mkdirSync(path.join(dir, 'kit'));
  writeFileSync(path.join(dir, 'kit', 'a.obj'), 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  writeFileSync(path.join(dir, 'kit', 'b.obj'), 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  writeFileSync(path.join(dir, 'tri.bin'), bin);
  mkdirSync(path.join(dir, 'inner'));
  const climbing = JSON.parse(json); climbing.buffers[0].uri = '../tri.bin';
  writeFileSync(path.join(dir, 'inner', 'm.gltf'), JSON.stringify(climbing));

  it('reads a folder\'s one model with its neighbours, and a file by its path', async () => {
    const f = await readModelPath(path.join(dir, 'stool'));
    expect(f.from).toMatchObject({ format: 'gltf', files: ['tri.bin'] });
    expect((await readModelPath(path.join(dir, 'stool', 'm.gltf'))).bytes.equals(f.bytes)).toBe(true);
  });

  it('asks which model a folder of several is meant, refuses a URL and a path not there', async () => {
    await expect(readModelPath(path.join(dir, 'kit'))).rejects.toThrow(/holds 2 models; name the one meant as `entry`/);
    expect((await readModelPath(path.join(dir, 'kit'), { entry: 'a.obj' })).from.format).toBe('obj');
    await expect(readModelPath('https://example.test/a.glb')).rejects.toThrow(/is a URL: mojulo reads a file on this machine/);
    await expect(readModelPath(path.join(dir, 'nope.glb'))).rejects.toThrow(/is not on this machine/);
  });

  it('never reads above the folder a model was found in', async () => {
    await expect(readModelPath(path.join(dir, 'inner', 'm.gltf'))).rejects.toThrow(/not beside it/);
  });
});
