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
// a packed part's corners as triangles' corners, through its index: [[x, y, z], …] and its colours
const ix = (p) => { const b = Buffer.from(p.idx, 'base64'), a = new Uint8Array(b).buffer; return p.n > 65535 ? new Uint32Array(a) : new Uint16Array(a); };
const pts = (p) => { const b = Buffer.from(p.pos, 'base64'), P = new Float32Array(new Uint8Array(b).buffer); return [...ix(p)].map((v) => [P[3 * v], P[3 * v + 1], P[3 * v + 2]]); };
const tris = (F) => F.parts.reduce((a, p) => a + (p ? ix(p).length / 3 : 0), 0);

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
    // (the walkers' format, packed: each corner once with its colour, the triangles an index into them; one `forward` clip)
    for (const p of C.parts.filter(Boolean)) { expect(p.n).toBe(Buffer.from(p.pos, 'base64').length / 12); expect(Buffer.from(p.col, 'base64').length).toBe(p.n * 3); expect(ix(p).length).toBe(p.faces * 3); expect(p.n).toBeLessThan(p.faces * 3); }
    expect(C.clips).toEqual({ forward: FIG.clips.walk });
    // (a part read through its index is read as its triangles)
    expect(crowdFigure(FIG, { budget: 5000 }).parts[3].faces).toBe(2);
  });
  it('keeps a limb a limb: its length and its width within a cell of the figure\'s', () => {
    const C = crowdFigure(FIG, { budget: 600 });
    let z0 = Infinity, z1 = -Infinity, r = 0;
    for (const [x, y, z] of pts(C.parts[0])) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); r = Math.max(r, Math.hypot(x, y)); }
    expect(z1 - z0).toBeGreaterThan(0.4 - 2 * C.cell); expect(z1 - z0).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(r).toBeGreaterThan(0.06 - C.cell); expect(r).toBeLessThanOrEqual(0.06 + 1e-6);
  });
  it('is the same every time, already-light figures are left near whole, and a figure with no walk is refused', () => {
    expect(JSON.stringify(crowdFigure(FIG, { budget: 600 }))).toBe(JSON.stringify(crowdFigure(FIG, { budget: 600 })));
    // (a figure whose shown triangles already fit is kept exactly as made: no grid, every corner where it was)
    const whole = crowdFigure(FIG);
    expect(whole.cell).toBe(0);
    expect(whole.tris).toBe(FIG.parts[0].faces + FIG.parts[1].faces + 2);
    const src = Buffer.from(FIG.parts[0].pos, 'base64'), S = new Float32Array(new Uint8Array(src).buffer);
    expect(pts(whole.parts[0]).flat()).toEqual([...S]);
    // (past it, the grid starts at its first cell)
    expect(crowdFigure(FIG, { budget: 3000 }).cell).toBeGreaterThanOrEqual(Math.round(1.8 * CROWD.cell * 1e4) / 1e4);
    expect(() => crowdFigure({ ...FIG, clips: { idle: clip } })).toThrow(/no walk/);
    expect(() => crowdFigure({ faces: [] })).toThrow(/rig figure/);
  });
  it('stays one skin: two parts that meet still meet, each corner keeps its own colour, and its bones and weights ride with it', () => {
    // (a sleeve and a hand: two tubes end to end, the second offset a hair off the first's end, in two colours, skinned)
    const skin = (part, bone) => { const n = Buffer.from(part.pos, 'base64').length / 12; return { ...part, jnt: b64(new Uint8Array(n * 4).map((_, i) => (i % 4 ? 0 : bone))), wgt: b64(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1))) }; };
    const sleeve = skin(tube(24, 20), 0), hand0 = tube(24, 20), hb = Buffer.from(hand0.pos, 'base64'), hp = new Float32Array(hb.buffer.slice(hb.byteOffset, hb.byteOffset + hb.byteLength));
    for (let k = 2; k < hp.length; k += 3) hp[k] += 0.4 + 0.0004;
    const hand = skin({ ...hand0, pos: b64(hp), col: b64(new Uint8Array(hp.length).map((_, i) => [230, 190, 160][i % 3])) }, 1);
    const C = crowdFigure({ ...FIG, bones: [{ id: 'sleeve' }, { id: 'hand' }], parts: [sleeve, hand] }, { budget: 500 });
    const key = (q) => q.map((v) => v.toFixed(5)).join(',');
    const sleeveEnd = new Set(pts(C.parts[0]).filter((q) => q[2] > 0.38).map(key)), handStart = pts(C.parts[1]).filter((q) => q[2] < 0.42).map(key);
    // (the hand's first ring sits on the sleeve's last: the very same points, no seam)
    expect(handStart.length).toBeGreaterThan(0);
    expect(handStart.every((k) => sleeveEnd.has(k))).toBe(true);
    // (the hand's skin colour is its own, never the sleeve's mixed in)
    expect([...new Set(Buffer.from(C.parts[1].col, 'base64'))].sort((a, b) => a - b)).toEqual([160, 190, 230]);
    // (each corner's bones and weights carried, four a corner)
    // (a byte a weight, `wq: 8`: 255 a whole bone)
    for (const [k, p] of C.parts.entries()) { const J = Buffer.from(p.jnt, 'base64'), W = Buffer.from(p.wgt, 'base64'); expect(p.wq).toBe(8); expect(J.length).toBe(p.n * 4); expect(J[0]).toBe(k); expect(W.length).toBe(p.n * 4); expect(W[0]).toBe(255); }
    // (a rigid figure stays rigid)
    expect(crowdFigure(FIG, { budget: 600 }).parts[0].jnt).toBeUndefined();
  });
  it('keeps the layer a garment\'s edge only half covers: nothing opens where a sleeve ends', () => {
    // (a sleeve over the first half of an arm: the arm under it goes, the arm past its end stays, the ring at its end too)
    const arm = tube(24, 20, 0.06), sleeve = { ...tube(24, 10, 0.07, 0.2), col: b64(new Uint8Array(24 * 10 * 18).fill(30)) };
    const C = crowdFigure({ ...FIG, bones: [{ id: 'arm' }, { id: 'sleeve' }], parts: [arm, sleeve] }, { budget: 5000 });
    const zs = pts(C.parts[0]).map((q) => q[2]);
    expect(Math.min(...zs)).toBeLessThanOrEqual(0.2 + 1e-6); expect(Math.min(...zs)).toBeGreaterThan(0.15);
    expect(C.parts[0].faces).toBeGreaterThanOrEqual(24 * 10 * 2);
  });
  it('samples only what shows: a layer under another a centimetre out is dropped, so it can never show through', () => {
    // (a body and a sleeve over it, 1 cm out: the sleeve stays, the body under it goes; with nothing over it, the body stays)
    const body = tube(24, 20, 0.06), sleeve = { ...tube(24, 20, 0.07), col: b64(new Uint8Array(24 * 20 * 18).fill(30)) };
    const C = crowdFigure({ ...FIG, bones: [{ id: 'body' }, { id: 'sleeve' }], parts: [body, sleeve] }, { budget: 5000 });
    expect(C.parts[0]).toBeNull();
    expect(C.parts[1].faces).toBeGreaterThan(400);
    expect(crowdFigure({ ...FIG, bones: [{ id: 'body' }], parts: [body] }, { budget: 5000 }).parts[0].faces).toBeGreaterThan(400);
  });
});
