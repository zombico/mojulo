// THE REALISTIC CROWD GRADE: a painted figure (a skin atlas and its parts' uv) simplified part by part for a street, its
// paint baked into each corner kept, what its clothes cover dropped first, the face's skin given its own share and never
// snapped to a grid; a far walker is the grid over the near one. Concept tests on a small figure: a painted head that
// carries the face's morphs, a limb, and a sleeve over half of it.
import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { realCrowdFigure, REAL_CROWD } from './crowd-figure.js';

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
// (a tube of triangles round the z axis, unindexed: its corners' uv along its length and round it)
function tube(n, rings, r, z0, len, rgb, extra = {}) {
  const pos = [], col = [], uv = [];
  for (let j = 0; j < rings; j++) for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, t0 = j / rings, t1 = (j + 1) / rings;
    const P = (a, t) => [Math.cos(a) * r, Math.sin(a) * r, z0 + t * len], U = (a, t) => [a / (Math.PI * 2), t];
    for (const [a, t] of [[a0, t0], [a1, t0], [a1, t1], [a0, t0], [a1, t1], [a0, t1]]) { pos.push(...P(a, t)); col.push(...rgb); uv.push(...U(a, t)); }
  }
  return { pos: b64(new Float32Array(pos)), col: b64(new Uint8Array(col)), uv: b64(new Float32Array(uv)), faces: pos.length / 9, ...extra };
}
// (a 4 × 4 RGBA atlas of one colour, as a data URL)
function png(rgba) {
  const W = 4, H = 4, crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const T = Buffer.concat([Buffer.from(t), d]), C = Buffer.alloc(4); C.writeUInt32BE(crc(T)); return Buffer.concat([L, T, C]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (1 + W * 4)); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) Buffer.from(rgba).copy(raw, y * (1 + W * 4) + 1 + x * 4);
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const clip = { k: 8, b: [0, 0, 0, 1, 0, 0, 0] };
const morph = 'm';
const FIG = {
  rig: true, bones: [{ id: 'head' }, { id: 'arm' }, { id: 'sleeve' }],
  parts: [
    tube(48, 60, 0.09, 1.5, 0.24, [255, 255, 255], { morph }),   // the face's skin, painted, carrying the face's morphs
    tube(24, 80, 0.05, 0.6, 0.6, [255, 255, 255]),                // a limb's skin
    tube(24, 40, 0.065, 0.6, 0.3, [60, 90, 140]),                 // a sleeve over its lower half, 1.5 cm off it
  ],
  clips: { walk: clip }, figH: 1.8, paintTex: { url: png([128, 64, 32, 255]), w: 4, h: 4 },
};
const tris = (C) => C.parts.reduce((n, p) => n + (p ? p.faces : 0), 0);
const cols = (p) => [...Buffer.from(p.col, 'base64')];

describe('the realistic crowd grade', () => {
  it('bakes the skin\'s paint into each corner as the page draws it: the texel, in linear light, × the part\'s colour', () => {
    const C = realCrowdFigure(FIG, { budget: REAL_CROWD.near });
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    expect(cols(C.parts[0]).slice(0, 3)).toEqual([128, 64, 32].map((c) => Math.round(255 * lin(c))));
    // (the sleeve, painted the same, takes the texel over its own colour)
    expect(cols(C.parts[2]).slice(0, 3)).toEqual([60, 90, 140].map((c, i) => Math.round(c * lin([128, 64, 32][i]))));
  });
  it('gives the face its own share, never a grid; drops the skin its clothes cover; and a far walker fits its budget', () => {
    const C = realCrowdFigure(FIG, { budget: 3000 * 2 + 2000 }), near = realCrowdFigure(FIG, { budget: REAL_CROWD.near });
    expect(near.cell).toBe(0);
    // (the limb's skin under the sleeve is gone: none of it lower than the sleeve's top but the bare part above)
    const P = new Float32Array(new Uint8Array(Buffer.from(near.parts[1].pos, 'base64')).buffer);
    let under = 0; for (let k = 2; k < P.length; k += 3) if (P[k] < 0.88) under++;
    expect(under).toBe(0);
    // (the far walker, the grid over the near one, within its budget)
    const far = realCrowdFigure(FIG, { budget: REAL_CROWD.far });
    expect(tris(far)).toBeLessThanOrEqual(REAL_CROWD.far);
    expect(tris(C)).toBeGreaterThan(tris(far));
  });
  it('is the same every time', () => {
    expect(JSON.stringify(realCrowdFigure(FIG, { budget: 2000 }))).toBe(JSON.stringify(realCrowdFigure(FIG, { budget: 2000 })));
  });
});
