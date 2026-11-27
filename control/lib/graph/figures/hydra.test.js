// A HYDRA (figures/hydra.js): a serpent's body kept once and its rising front copied into a neck a head, fanned round its
// breast, one skeleton; each turn's clip bringing its own head low through its opening while the others sway.
import { describe, it, expect } from 'vitest';
import { hydraFigure, HYDRA } from './hydra.js';

const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
// a SERPENT: its spine humped behind (a low point at spine3), its front rising from it to a neck and a head
const Z = [0.4, 1.2, 0.8, 0.3, 1.5, 2.8, 3.6];
const B = [...Z.map((z, i) => ({ id: `spine${i}`, head: [0, i - 4, z], tail: [0, i - 3, Z[i + 1] ?? z + 0.4] })), { id: 'neck0', head: [0, 3, 4], tail: [0, 3.3, 4.2] }, { id: 'head', head: [0, 3.3, 4.2], tail: [0, 3.8, 4.2] }];
const part = (bi) => { const h = B[bi].head, pts = [h, [h[0] + 0.1, h[1], h[2]], [h[0], h[1], h[2] + 0.1]]; return { pos: enc(new Float32Array(pts.flat())), col: enc(new Uint8Array(pts.flatMap(() => [100, 100, 100]))), jnt: enc(new Uint8Array(pts.flatMap(() => [bi, 0, 0, 0]))), wgt: enc(new Float32Array(pts.flatMap(() => [1, 0, 0, 0]))), faces: 1 }; };
const serpent = { bones: B, parts: B.map((_, i) => part(i)), clips: {}, figH: 4.2 };
const heads = ['a', 'b', 'c'];

describe('a hydra: a serpent of many necks', () => {
  const F = hydraFigure(serpent, { heads, colours: { c: '#ff0000' } }), id = (n) => F.bones.findIndex((b) => b.id === n), nb = F.bones.length;
  const headAt = (clip, u, h) => { const C = F.clips[clip], f = Math.min(C.k - 1, Math.round(u * C.k)), i = id(`head_${h}`); return C.b.slice((f * nb + i) * 7 + 4, (f * nb + i) * 7 + 7); };
  it('one skeleton: the body once, behind its root; a neck a head from the root up, fanned, the middle ahead', () => {
    expect(F.bones.filter((b) => /^spine[0-2]$/.test(b.id))).toHaveLength(3);
    for (const h of heads) for (const n of ['spine3', 'spine6', 'neck0', 'head']) expect(id(`${n}_${h}`), `${n}_${h}`).toBeGreaterThan(-1);
    expect(F.parts).toHaveLength(nb);
    const [a, b, c] = heads.map((h) => F.bones[id(`head_${h}`)].head);
    expect(b[0]).toBeCloseTo(0, 5);
    expect(a[0]).toBeGreaterThan(0); expect(c[0]).toBeLessThan(0);   // (the first to the right, the last to the left)
    expect(F.figH).toBeCloseTo(HYDRA.height + Math.max(...F.bones.map((x) => x.head[2])) - F.bones[id('head_b')].head[2], 0);
    // (each part's joints its own neck's; its corners carried there; a head's own tinted toward its colour)
    const J = dec(F.parts[id('head_a')].jnt, Uint8Array); expect(J[0]).toBe(id('head_a'));
    expect(dec(F.parts[id('head_c')].col, Uint8Array)[0]).toBeGreaterThan(dec(F.parts[id('head_a')].col, Uint8Array)[0]);
    expect(F.necks.c).toContain('head_c');
  });
  it('a head\'s turn brings it low through its opening, the others swaying where they stood; idle, every head up', () => {
    const up = headAt('idle', 0, 'a'), low = headAt('turn-a', 0.7, 'a'), other = headAt('turn-a', 0.7, 'b');
    expect(low[2]).toBeLessThan(up[2] - 1.5);
    expect(Math.hypot(low[0], low[1])).toBeGreaterThan(Math.hypot(up[0], up[1]));
    expect(other[2]).toBeGreaterThan(up[2] - 0.5);
    expect(headAt('turn-a', 0, 'a')[2]).toBeCloseTo(up[2], 0);
  });
  it('a turn\'s times move its keys: its head low through the opening it is given', () => {
    const G = hydraFigure(serpent, { heads, turns: { a: { seconds: 10, land: 2, open: [3, 4] } } }), j = G.bones.findIndex((b) => b.id === 'head_a'), n = G.bones.length;
    const z = (u) => { const C = G.clips['turn-a'], f = Math.min(C.k - 1, Math.round(u * C.k)); return C.b[(f * n + j) * 7 + 6]; };
    expect(G.clips['turn-a'].s).toBe(10);
    expect(z(0.35)).toBeLessThan(z(0.8) - 1);
    expect(() => hydraFigure(serpent, { heads: ['solo'] })).toThrow(/two heads/);
  });
});
