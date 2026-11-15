// A COMPACT repeat (emitThreeWorld's `repeats[].compact`): its template's corners as 16-bit steps of its own box and its
// colours as sRGB bytes; the page unpacks them. A page with none carries not one byte of it.
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from './scene-three.js';

const quad = (x, z, fill) => ({ corners: [[x, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1], [x, 0, z + 1]], normal: [0, -1, 0], fill });
const template = [quad(0, 0, '#cc3322'), quad(2.5, 1.25, '#2255aa'), quad(-3, 0.5, '#808080')];
const world = (compact) => ({ faces: [{ corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], normal: [0, 0, 1], fill: '#556655' }], repeats: [{ group: 'thing', template, transforms: [{ pos: [0, 0, 0] }, { pos: [3, 2, 0], rotZ: 1 }], ...(compact ? { compact: true } : {}) }] });
const repeatsOf = (html) => { const i = html.indexOf('const REPEATS = '); return JSON.parse(html.slice(i + 16, html.indexOf('\n', i)).replace(/;\s*$/, '')); };
const f32 = (s) => new Float32Array(Uint8Array.from(Buffer.from(s, 'base64')).buffer);

describe('a compact repeat', () => {
  const plain = emitThreeWorld(world(false)), packed = emitThreeWorld(world(true));
  it('rides as steps and bytes, and a page without one carries none of it', () => {
    const [P] = repeatsOf(plain), [C] = repeatsOf(packed);
    expect(P.pos).toBeTruthy(); expect(P.q).toBeUndefined();
    expect(C.q).toBeTruthy(); expect(C.c8).toBeTruthy(); expect(C.pos).toBeUndefined(); expect(C.col).toBeUndefined();
    expect(plain).not.toContain('__q16'); expect(packed).toContain('function __q16');
    // (three eighths of the bytes: 2 + 1 bytes a number where 4 + 4 were)
    expect(C.q.length + C.c8.length).toBeLessThan((P.pos.length + P.col.length) * 0.4);
  });
  it('unpacks to the same corners within a step and the same colours within an sRGB step', () => {
    const [P] = repeatsOf(plain), [C] = repeatsOf(packed), pos = f32(P.pos), col = f32(P.col);
    const q = new Int16Array(Uint8Array.from(Buffer.from(C.q, 'base64')).buffer), c8 = Buffer.from(C.c8, 'base64');
    expect(q.length).toBe(pos.length); expect(c8.length).toBe(col.length);
    for (let i = 0; i < q.length; i++) { const k = i % 3; expect(Math.abs(C.qb[k] + (q[i] + 32768) * C.qb[3 + k] - pos[i])).toBeLessThan(C.qb[3 + k] + 1e-6); }
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    for (let i = 0; i < c8.length; i++) expect(Math.abs(lin(c8[i] / 255) - Math.min(1, Math.max(0, col[i])))).toBeLessThan(0.012);
  });
});
