// interchange.plan.md I3 — the GLB reader (the bind-back door's decoder).
// The machine gate is the WRITER→READER round trip: a payload exported via
// facesToGlb decodes back to the same triangle count and (within float32
// tolerance) the same positions and colours, in mojulo's z-up frame.

import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { parseGlb, glbToFaces, readBoundMeshFaces } from './scene-gltf-read.js';

const EPS = 1e-5;
const close = (a, b) => Math.abs(a - b) < EPS;
const sameCorner = (a, b) => close(a[0], b[0]) && close(a[1], b[1]) && close(a[2], b[2]);

// Two well-separated quads (no decollide interference): one flat-filled, one
// per-corner gradient — the cornerFills currency the reader must round-trip.
const QUAD_A = {
  corners: [[0, 0, 0], [4, 0, 0], [4, 3, 0], [0, 3, 0]],
  fill: '#88aacc',
  group: 'walls',
};
const QUAD_B = {
  corners: [[10, 0, 2], [14, 0, 2], [14, 0, 6], [10, 0, 6]],
  fill: '#802010',
  cornerFills: ['#802010', '#207040', '#103080', '#c0a020'],
  group: 'walls',
};
// A padded triangle ([a,b,c,c] — padTrianglesForWorld's convention).
const PAD_TRI = {
  corners: [[20, 0, 0], [24, 0, 0], [22, 3, 0], [22, 3, 0]],
  fill: '#446688',
  group: 'walls',
};

describe('writer → reader round trip (the I3 fidelity gate)', () => {
  it('decodes the same triangle count, positions, and colours facesToGlb wrote', () => {
    const exported = facesToGlb({ faces: [QUAD_A, QUAD_B, PAD_TRI] }, { generator: 'test' });
    const decoded = glbToFaces(exported.bytes, { group: 'back' });
    // triangle-count identity: one decoded face per written triangle
    expect(decoded.length).toBe(exported.triangleCount);
    expect(decoded.every((f) => f.group === 'back' && f.corners.length === 4)).toBe(true);
    // every decoded face is a padded [a,b,c,c] quad
    for (const f of decoded) expect(sameCorner(f.corners[2], f.corners[3])).toBe(true);

    // each source quad splits [c0,c1,c2] + [c0,c2,c3] (face-mesh TRIS) — find both
    const findTri = (tri) => decoded.find((f) => tri.every((c, i) => sameCorner(f.corners[i], c)));
    for (const q of [QUAD_A, QUAD_B]) {
      const [c0, c1, c2, c3] = q.corners;
      expect(findTri([c0, c1, c2]), 'first split tri').toBeTruthy();
      expect(findTri([c0, c2, c3]), 'second split tri').toBeTruthy();
    }

    // flat colour round-trips to the exact hex (sRGB → linear f32 → sRGB)
    const a = findTri(QUAD_A.corners.slice(0, 3));
    expect(a.fill).toBe('#88aacc');
    expect(a.cornerFills).toBeUndefined();

    // per-corner colours round-trip as cornerFills
    const [b0, b1, b2, b3] = QUAD_B.corners;
    const t1 = findTri([b0, b1, b2]);
    expect(t1.cornerFills).toEqual(['#802010', '#207040', '#103080', '#103080']);
    const t2 = findTri([b0, b2, b3]);
    expect(t2.cornerFills).toEqual(['#802010', '#103080', '#c0a020', '#c0a020']);
  });

  it('round-trips TWICE without drift (decode → re-export → decode)', () => {
    const first = facesToGlb({ faces: [QUAD_A, QUAD_B] }, { generator: 'test' });
    const decoded = glbToFaces(first.bytes);
    // re-export the REAL triangles (each padded quad writes a degenerate second
    // split tri — zero-area geometry the writer's decollide pass may nudge)
    const realDecoded = decoded.filter((f) => !sameCorner(f.corners[1], f.corners[2]));
    const second = facesToGlb({ faces: realDecoded }, { generator: 'test' });
    const again = glbToFaces(second.bytes);
    expect(again.length).toBe(second.triangleCount);
    const real = again.filter((f) => !sameCorner(f.corners[1], f.corners[2]));
    expect(real.length).toBe(realDecoded.length);
    // positions hold to within the writer's own z-fight stagger (decollideFaces
    // lifts the quad's two coplanar split tris apart by ~1.5e-3 — intended)
    const closeEnough = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 2e-3);
    for (const f of real) {
      expect(realDecoded.some((d) => f.corners.slice(0, 3).every((c, i) => closeEnough(c, d.corners[i])))).toBe(true);
    }
  });
});

// ── hand-built GLB: indexed geometry, node TRS, normalized colours, fallback ─

function buildGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length + binPad;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20);
  for (let i = 0; i < jsonPad; i++) out[20 + jsonBuf.length + i] = 0x20;
  const binOff = 20 + jsonBuf.length + jsonPad;
  out.writeUInt32LE(bin.length + binPad, binOff);
  out.writeUInt32LE(0x004e4942, binOff + 4);
  bin.copy(out, binOff + 8);
  return out;
}

// One indexed triangle (unit right triangle) with normalized-ubyte VEC4 COLOR_0,
// under parent T(1,2,3) · child R(90° about +Z, y-up) then child matrix-scale 2.
function indexedFixture({ withColor = true, baseColorFactor = null } = {}) {
  const pos = Buffer.alloc(9 * 4);
  [[0, 0, 0], [1, 0, 0], [0, 1, 0]].flat().forEach((v, i) => pos.writeFloatLE(v, i * 4));
  const idx = Buffer.alloc(6); // u16 ×3
  [0, 1, 2].forEach((v, i) => idx.writeUInt16LE(v, i * 2));
  const col = Buffer.alloc(12);
  for (let v = 0; v < 3; v++) { col[v * 4] = 255; col[v * 4 + 1] = 0; col[v * 4 + 2] = 0; col[v * 4 + 3] = 255; }
  const bin = withColor ? Buffer.concat([pos, idx, col]) : Buffer.concat([pos, idx]);
  const bufferViews = [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 6 },
    ...(withColor ? [{ buffer: 0, byteOffset: 42, byteLength: 12 }] : []),
  ];
  const accessors = [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ...(withColor ? [{ bufferView: 2, componentType: 5121, normalized: true, count: 3, type: 'VEC4' }] : []),
  ];
  const attributes = { POSITION: 0, ...(withColor ? { COLOR_0: 2 } : {}) };
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { children: [1], translation: [1, 2, 3], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] }, // +90° about Z
      { mesh: 0, matrix: [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1] }, // uniform scale 2
    ],
    meshes: [{ primitives: [{ attributes, indices: 1, mode: 4, ...(baseColorFactor ? { material: 0 } : {}) }] }],
    ...(baseColorFactor ? { materials: [{ pbrMetallicRoughness: { baseColorFactor } }] } : {}),
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  return buildGlb(json, bin);
}

describe('foreign-GLB decode — indexed primitives, node TRS/matrix, colour sources', () => {
  it('applies matrix scale, quaternion rotation, and translation, then y-up→z-up', () => {
    const faces = glbToFaces(indexedFixture());
    expect(faces.length).toBe(1);
    // y-up world: v0 (0,0,0)→T=(1,2,3); v1 (1,0,0)→scale(2,0,0)→rotZ90(0,2,0)→(1,4,3);
    // v2 (0,1,0)→(0,2,0)→(-2,0,0)→(-1,2,3). z-up: (x,y,z)→(x,-z,y).
    expect(sameCorner(faces[0].corners[0], [1, -3, 2])).toBe(true);
    expect(sameCorner(faces[0].corners[1], [1, -3, 4])).toBe(true);
    expect(sameCorner(faces[0].corners[2], [-1, -3, 2])).toBe(true);
    expect(sameCorner(faces[0].corners[3], faces[0].corners[2])).toBe(true); // padded
  });

  it('normalized ubyte COLOR_0 decodes to the vertex-colour fill', () => {
    const faces = glbToFaces(indexedFixture());
    expect(faces[0].fill).toBe('#ff0000');
  });

  it('no COLOR_0 → the material baseColorFactor colours the face (linear → sRGB)', () => {
    const faces = glbToFaces(indexedFixture({ withColor: false, baseColorFactor: [0.5, 0.25, 1, 1] }));
    const s = (c) => Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
    const hex = `#${[0.5, 0.25, 1].map((c) => s(c).toString(16).padStart(2, '0')).join('')}`;
    expect(faces[0].fill).toBe(hex);
    expect(faces[0].cornerFills).toBeUndefined();
  });
});

describe('structural validation — non-GLB rejected loudly', () => {
  it('rejects non-glTF bytes, bad length headers, and unparseable JSON chunks', () => {
    expect(() => parseGlb(Buffer.from('this is not a mesh at all, sorry'))).toThrow(/not a GLB/);
    const good = indexedFixture();
    const shortHeader = Buffer.from(good);
    shortHeader.writeUInt32LE(good.length + 8, 8);
    expect(() => parseGlb(shortHeader)).toThrow(/header declares/);
    const garbage = buildGlb({}, Buffer.alloc(0)); // rebuild with a broken JSON chunk
    Buffer.from('{oops').copy(garbage, 20);
    expect(() => parseGlb(garbage)).toThrow(/JSON chunk does not parse|no JSON chunk|corrupt GLB/);
    expect(() => parseGlb(good.subarray(0, 16))).toThrow(/corrupt GLB|not a GLB/);
  });

  it('refuses compressed geometry by name', () => {
    const glb = indexedFixture();
    const { json } = parseGlb(glb);
    json.meshes[0].primitives[0].extensions = { KHR_draco_mesh_compression: {} };
    const rebuilt = buildGlb(json, Buffer.alloc(48));
    expect(() => glbToFaces(rebuilt)).toThrow(/Draco/);
  });
});

describe('readBoundMeshFaces — file read, LRU, placement transform', () => {
  it('bakes { pos, rotZ, scale } into the corners and isolates cached templates', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-gltf-read-'));
    const file = path.join(dir, 'mesh-1.glb');
    writeFileSync(file, facesToGlb({ faces: [QUAD_A] }, { generator: 'test' }).bytes);
    const placed = readBoundMeshFaces(file, {
      transform: { pos: [10, 20, 5], rotZ: Math.PI / 2, scale: 2 },
      group: 'mesh:prop',
    });
    expect(placed.length).toBe(2);
    expect(placed.every((f) => f.group === 'mesh:prop')).toBe(true);
    // corner (4,0,0) → scale (8,0,0) → rotZ90 (0,8,0) → +pos (10,28,5)
    expect(placed.some((f) => f.corners.some((c) => sameCorner(c, [10, 28, 5])))).toBe(true);
    // mutation isolation: scribbling on one read must not poison the cache
    placed[0].corners[0][0] = 999;
    const again = readBoundMeshFaces(file, { transform: { pos: [10, 20, 5], rotZ: Math.PI / 2, scale: 2 }, group: 'mesh:prop' });
    expect(again[0].corners[0][0]).not.toBe(999);
  });
});
