// THE CROWD GRADE: a baked rig figure sampled again to a crowd's budget. Its bones, height and walk are the figure's;
// its parts are fewer triangles on a coarser grid, in the walkers' format; the same figure gives the same crowd figure.
import { describe, it, expect } from 'vitest';
import { crowdFigure, CROWD } from './crowd-figure.js';

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
// a limb as a fine tube of triangles round an axis (unindexed), and one read through an index
function tube(n, rings, r = 0.06, len = 0.4) {
  const pos = [], col = [];
  for (let j = 0; j < rings; j++) for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, z0 = (j / rings) * len, z1 = ((j + 1) / rings) * len;
    const P = (a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
    for (const c of [P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z0), P(a1, z1), P(a0, z1)]) { pos.push(...c); col.push(180, 120, 90); }
  }
  return { pos: b64(new Float32Array(pos)), col: b64(new Uint8Array(col)), faces: pos.length / 9 };
}
const indexed = { pos: b64(new Float32Array([0, 0, 0, 0.3, 0, 0, 0.3, 0.3, 0, 0, 0.3, 0])), col: b64(new Uint8Array([10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30])), idx: b64(new Uint16Array([0, 1, 2, 0, 2, 3])), n: 4 };
const clip = { k: 2, b: [0, 0, 0, 1, 0, 0, 0] };
const FIG = { rig: true, bones: [{ id: 'root' }, { id: 'arm' }, { id: 'tip' }, { id: 'flat' }], parts: [tube(24, 40), tube(24, 40), null, indexed], clips: { idle: clip, walk: { ...clip, k: 8 } }, figH: 1.8 };
const tris = (F) => F.parts.reduce((a, p) => a + (p ? Buffer.from(p.pos, 'base64').length / 36 : 0), 0);

describe('the crowd grade', () => {
  it('is the figure sampled to its budget: its bones, height and walk kept, fewer triangles a part', () => {
    const C = crowdFigure(FIG, { budget: 600 });
    expect(FIG.parts[0].faces + FIG.parts[1].faces).toBe(24 * 40 * 2 * 2);
    expect(C.tris).toBeLessThanOrEqual(600); expect(C.tris).toBeGreaterThan(40);
    expect(tris(C)).toBe(C.tris);
    expect(C).toMatchObject({ rig: true, crowd: true, figH: 1.8 });
    expect(C.bones).toBe(FIG.bones);
    expect(C.parts).toHaveLength(FIG.bones.length);
    expect(C.parts[2]).toBeNull();
    // (the walkers' format: unindexed corners and a colour each, one `forward` clip, the figure's walk)
    for (const p of C.parts.filter(Boolean)) { expect(p.idx).toBeUndefined(); expect(Buffer.from(p.col, 'base64').length).toBe(Buffer.from(p.pos, 'base64').length / 4); }
    expect(C.clips).toEqual({ forward: FIG.clips.walk });
    // (a part read through its index is read as its triangles)
    expect(Buffer.from(crowdFigure(FIG, { budget: 5000 }).parts[3].pos, 'base64').length / 36).toBe(2);
  });
  it('keeps a limb a limb: its length and its width within a cell of the figure\'s', () => {
    const C = crowdFigure(FIG, { budget: 600 });
    let z0 = Infinity, z1 = -Infinity, r = 0;
    const b = Buffer.from(C.parts[0].pos, 'base64');
    for (let k = 0; k + 11 < b.length; k += 12) { const x = b.readFloatLE(k), y = b.readFloatLE(k + 4), z = b.readFloatLE(k + 8); z0 = Math.min(z0, z); z1 = Math.max(z1, z); r = Math.max(r, Math.hypot(x, y)); }
    expect(z1 - z0).toBeGreaterThan(0.4 - 2 * C.cell); expect(z1 - z0).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(r).toBeGreaterThan(0.06 - C.cell); expect(r).toBeLessThanOrEqual(0.06 + 1e-6);
  });
  it('is the same every time, already-light figures are left near whole, and a figure with no walk is refused', () => {
    expect(JSON.stringify(crowdFigure(FIG, { budget: 600 }))).toBe(JSON.stringify(crowdFigure(FIG, { budget: 600 })));
    expect(crowdFigure(FIG).cell).toBeCloseTo(1.8 * CROWD.cell, 3);
    expect(() => crowdFigure({ ...FIG, clips: { idle: clip } })).toThrow(/no walk/);
    expect(() => crowdFigure({ faces: [] })).toThrow(/rig figure/);
  });
});
