import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stlToFaces, threeMfToFaces, meshFileToFaces, unzipEntries, MESH_DEFAULT_TINT } from './mesh-read.js';
import { facesTo3mf } from './scene-3mf.js';
import { facesToGlb } from './scene-gltf.js';
import { glbToScene } from './scene-gltf-read.js';

const here = dirname(fileURLToPath(import.meta.url));
const DUO_A = readFileSync(join(here, 'fixtures/openscad-duo-half-a.3mf'));

const ASCII_STL = `solid tet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 0 1
      vertex 0 1 1
    endloop
  endfacet
endsolid tet
`;

const box = (faces) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k += 1) { if (c[k] < min[k]) min[k] = c[k]; if (c[k] > max[k]) max[k] = c[k]; }
  return [0, 1, 2].map((k) => Math.round((max[k] - min[k]) * 100) / 100);
};

describe('mesh-read — STL', () => {
  it('reads an ascii STL into grey, shaded, closed-ring faces with outward normals', () => {
    const faces = stlToFaces(Buffer.from(ASCII_STL));
    expect(faces).toHaveLength(2);
    expect(faces[0].corners).toHaveLength(4);
    expect(faces[0].corners[0]).toEqual(faces[0].corners[3]);
    expect(faces[0].tint).toBe(MESH_DEFAULT_TINT);
    expect(faces[0].outNormal.map(Math.round)).toEqual([0, 0, -1]);
    expect(faces[1].outNormal.map(Math.round)).toEqual([0, 0, 1]);
    expect(faces[0].fill).not.toBe(faces[1].fill); // the studio light shades the two faces differently
    expect(stlToFaces(Buffer.from('not an stl'))).toBeNull();
  });
});

describe('mesh-read — 3MF', () => {
  it("reads OpenSCAD's 3MF: every triangle, its basematerials colour, the declared size", () => {
    const faces = threeMfToFaces(DUO_A);
    expect(faces).toHaveLength(2256);
    // the camera half spans x −82.3 … −3 plus the hinge barrel to +2.6
    expect(box(faces)).toEqual([84.9, 117.8, 8.4]);
    const tints = new Set(faces.map((f) => f.tint));
    expect(tints.has('#2b3242')).toBe(true);  // the body
    expect(tints.has('#efe3b8')).toBe(true);  // the flash
    expect(tints.has(MESH_DEFAULT_TINT)).toBe(false);
  });

  it("round-trips mojulo's own 3MF writer (deflate entries, palette by p1)", () => {
    const src = stlToFaces(Buffer.from(ASCII_STL), { tint: '#ff0000' });
    const out = facesTo3mf({ faces: src }, { scale: 1, title: 't' });
    expect(out).toBeTruthy();
    const names = [...unzipEntries(out.bytes).keys()];
    expect(names.some((n) => /\.model$/.test(n))).toBe(true);
    const back = threeMfToFaces(out.bytes);
    expect(back).toHaveLength(2);
    // the writer stores the BAKED fill (vertex colour), so the tint comes back shaded, not raw
    const tints = new Set(back.map((f) => f.tint));
    expect(tints.size).toBeGreaterThanOrEqual(1);
    expect(tints.has(MESH_DEFAULT_TINT)).toBe(false);
    for (const t of tints) expect(t).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a build item transform moves the object', () => {
    const model = `<?xml version="1.0"?><model unit="millimeter"><resources>
      <object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
      <triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources>
      <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 10 20 30"/></build></model>`;
    // a stored-method zip of one entry, built by hand
    const zip = storedZip('3D/3dmodel.model', Buffer.from(model));
    const faces = threeMfToFaces(zip);
    expect(faces).toHaveLength(1);
    expect(faces[0].corners[0]).toEqual([10, 20, 30]);
  });
});

describe('mesh-read — the door', () => {
  it('routes by extension and the result survives the GLB the bind stores', () => {
    const faces = meshFileToFaces(DUO_A, '/tmp/part.3mf');
    const glb = facesToGlb({ faces }, { generator: 'test' });
    expect(glb).toBeTruthy();
    const scene = glbToScene(glb.bytes);
    expect(scene.faces).toHaveLength(2256);
    expect(meshFileToFaces(Buffer.from(ASCII_STL), 'a.stl')).toHaveLength(2);
    expect(meshFileToFaces(Buffer.from('x'), 'a.glb')).toBeNull();
  });
});

// minimal zip writer for the fixture above: one STORED entry + central directory + EOCD
function storedZip(name, data) {
  const nameBuf = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 10);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(0, 42);
  const cenStart = local.length + nameBuf.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cen.length + nameBuf.length, 12); eocd.writeUInt32LE(cenStart, 16);
  return Buffer.concat([local, nameBuf, data, cen, nameBuf, eocd]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
