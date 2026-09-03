/**
 * skin-baseline characterization net (skin-over-mesh.plan.md phase 0a).
 *
 * Hash-pins the face→mesh bake and the GLB emission for a fixture that
 * exercises every face-level channel the skin phases will walk past:
 * plain fill, cornerFills, vao, spec, outNormal, clip, radius, pbr, water,
 * shadow decal, and the texture channel (lit + unlit + pbr-albedo). The
 * upcoming recipe-emitted-UV work (phase 1) and atlas mode (phase 2) must
 * leave every pin below untouched — absent the new opt-in parameters,
 * output stays byte-identical. Re-pinning is legitimate ONLY when a plan
 * step says emission changes (the emit-channels.char.test.js contract).
 *
 * Companions: emit-channels.char.test.js pins emitThreeWorld;
 * engine-score.test.js pins the unstamped score.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { faceListToMesh } from '../figures/face-mesh.js';
import { facesToGlb } from './scene-gltf.js';

const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const q = (x, y, extra = {}) => ({
  corners: [[x, y, 0], [x + 2, y, 0], [x + 2, y + 2, 0], [x, y + 2, 0]],
  fill: '#8899aa',
  ...extra,
});

// Fixed forever (the fixture discipline): editing this list invalidates the
// pins, which is only legitimate alongside a plan step that says so.
const FACES = [
  q(0, 0),
  q(3, 0, { fill: '#c0ffee' }),
  q(6, 0, { cornerFills: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'] }),
  q(9, 0, { vao: [0.4, 0.7, 1, 0.9] }),
  q(0, 3, { spec: [0.5, 24] }),
  q(3, 3, { outNormal: [0, 0, 1] }),
  q(6, 3, { outNormal: [0, 0, -1] }),          // winding flip on export
  q(9, 3, { clip: 'polygon(50% 0%, 100% 100%, 0% 100%)' }),
  q(0, 6, { radius: '30%' }),
  q(3, 6, { pbr: [0.9, 0.2] }),
  q(6, 6, { water: true, fill: '#3366aa' }),
  q(9, 6, { decal: 'shadow', shadowAlpha: 0.4 }),
  q(0, 9, { texture: 'tile', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }),                     // unlit sticker
  q(3, 9, { texture: 'tile', uv: [[0, 0], [2, 0], [2, 2], [0, 2]], textureLit: true }),   // multiply-lit
  q(6, 9, { texture: 'tile', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], pbr: [0.3, 0.6] }),    // lit albedo
  q(9, 9, { group: 'shell' }),
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const hashMesh = (m) => sha(Buffer.concat([
  Buffer.from(m.positions.buffer, m.positions.byteOffset, m.positions.byteLength),
  Buffer.from(m.colors.buffer, m.colors.byteOffset, m.colors.byteLength),
  m.normals ? Buffer.from(m.normals.buffer, m.normals.byteOffset, m.normals.byteLength) : Buffer.alloc(0),
  m.specs ? Buffer.from(m.specs.buffer, m.specs.byteOffset, m.specs.byteLength) : Buffer.alloc(0),
]));

describe('skin-over-mesh phase 0a — the no-skin baseline pins', () => {
  it('faceListToMesh bakes the fixture byte-identically (world-renderer path)', () => {
    const m = faceListToMesh(FACES);
    expect({
      mesh: hashMesh(m),
      vertexCount: m.vertexCount,
      textureGroups: Object.fromEntries(Object.entries(m.textureGroups).map(([k, g]) => [k, {
        positions: sha(Buffer.from(g.positions.buffer, g.positions.byteOffset, g.positions.byteLength)),
        uvs: sha(Buffer.from(g.uvs.buffer, g.uvs.byteOffset, g.uvs.byteLength)),
        colors: sha(Buffer.from(g.colors.buffer, g.colors.byteOffset, g.colors.byteLength)),
        lit: g.lit,
      }])),
    }).toMatchSnapshot();
  });

  it('faceListToMesh bakes the fixture byte-identically (export path, withNormals)', () => {
    expect(hashMesh(faceListToMesh(FACES, { decollide: false, withNormals: true }))).toMatchSnapshot();
  });

  it('facesToGlb emits the fixture byte-identically (GLB transport)', () => {
    const out = facesToGlb({ faces: FACES, textures: { tile: PNG_URL } });
    expect({
      sha256: sha(out.bytes),
      bytes: out.bytes.length,
      nodes: out.nodeCount,
      triangles: out.triangleCount,
    }).toMatchSnapshot();
  });

  it('facesToGlb without textures still emits deterministically (fallback path)', () => {
    expect(sha(facesToGlb({ faces: FACES }).bytes)).toMatchSnapshot();
  });
});
