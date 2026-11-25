/**
 * Test figures for the import's tests: plain GLBs built from boxes, in glTF's frame (y up, facing +z). A biped `person`
 * in a T (or with its arms at its sides), its feet pointing forward so the fit reads its facing; `boxGlb` any boxes.
 * Built in code, never fetched: a test never touches the corpus (scripts/import-corpus.mjs does).
 */
import { packGlb } from './to-glb.js';

// a figure of boxes as a plain GLB (glTF's frame: y up, facing +z, its right on −x), each box finely divided so a
// joint has vertices to bend (a box of two triangles a face cannot fold at a knee)
export function boxGlb(list, div = 6) {
  const P = [], I = [];
  for (const [x0, y0, z0, x1, y1, z1] of list) {
    // native (x, y, z) box → glTF (x, z, −y)
    const faces = [
      [[x0, y0, z0], [x1, y0, z0], [x0, y0, z1]], [[x1, y1, z0], [x0, y1, z0], [x1, y1, z1]],
      [[x0, y1, z0], [x0, y0, z0], [x0, y1, z1]], [[x1, y0, z0], [x1, y1, z0], [x1, y0, z1]],
      [[x0, y0, z0], [x0, y1, z0], [x1, y0, z0]], [[x0, y0, z1], [x1, y0, z1], [x0, y1, z1]],
    ];
    for (const [o, a, b] of faces) {
      const u = a.map((v, k) => v - o[k]), w = b.map((v, k) => v - o[k]);
      const base = P.length / 3;
      for (let i = 0; i <= div; i++) for (let j = 0; j <= div; j++) { const q = o.map((v, k) => v + (u[k] * i) / div + (w[k] * j) / div); P.push(q[0], q[2], -q[1]); }
      for (let i = 0; i < div; i++) for (let j = 0; j < div; j++) { const a0 = base + i * (div + 1) + j; I.push(a0, a0 + div + 1, a0 + 1, a0 + 1, a0 + div + 1, a0 + div + 2); }
    }
  }
  const pb = Buffer.alloc(P.length * 4); P.forEach((v, i) => pb.writeFloatLE(v, i * 4));
  const ib = Buffer.alloc(I.length * 4); I.forEach((v, i) => ib.writeUInt32LE(v, i * 4));
  const min = [0, 1, 2].map((k) => Math.min(...P.filter((_, i) => i % 3 === k))), max = [0, 1, 2].map((k) => Math.max(...P.filter((_, i) => i % 3 === k)));
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: P.length / 3, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5125, count: I.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pb.length }, { buffer: 0, byteOffset: pb.length, byteLength: ib.length }],
    buffers: [{ byteLength: pb.length + ib.length }],
  };
  return packGlb(json, Buffer.concat([pb, ib]));
}
// a person in a T (H tall, `heads` heads), its feet pointing forward (native +y is not its face: glTF's +z is, −y)
export function person({ H = 1.8, heads = 7.5, arms = 'T' } = {}) {
  const head = H / heads, chin = H - head, neckBot = chin - head * 0.3, crotch = H * 0.47, w = head * 0.8;
  const armY = neckBot - w * 0.2;
  const armBoxes = arms === 'T' ? [[-w - H * 0.42, -w / 5, armY - w / 3, -w, w / 5, armY], [w, -w / 5, armY - w / 3, w + H * 0.42, w / 5, armY]]
    : [[-w * 1.35, -w / 5, crotch + 0.1, -w, w / 5, armY], [w, -w / 5, crotch + 0.1, w * 1.35, w / 5, armY]];
  return boxGlb([
    [-w * 0.9, -w / 3, H * 0.03, -w * 0.15, w / 3, crotch], [w * 0.15, -w / 3, H * 0.03, w * 0.9, w / 3, crotch],   // legs
    [-w * 0.9, -w * 1.1, 0, -w * 0.15, w / 3, H * 0.03], [w * 0.15, -w * 1.1, 0, w * 0.9, w / 3, H * 0.03],           // feet, toes to −y
    [-w, -w / 2, crotch, w, w / 2, neckBot], [-w / 4, -w / 4, neckBot, w / 4, w / 4, chin], [-w * 0.55, -w * 0.6, chin, w * 0.55, w * 0.6, H],
    ...armBoxes,
  ]);
}
