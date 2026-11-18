// ONE SKIN A HERO (world-scene.js heroFigure `skinParts`, realistic laws 17; controllable/index.js): a hero drawn as rigid
// parts, one bone a part, had its layers step past each other at every joint (the cloth's sawtooth); a figure that says
// `skinParts` keeps each corner's bones and weights in the page's bank (welded with the corner where its part is welded) and
// is drawn as skinned parts on one skeleton. A figure that does not say it, and every page with none, as it was.
import { describe, it, expect } from 'vitest';
import { pageFigures, controllableChannelScript } from './index.js';

const b64 = (t) => Buffer.from(t.buffer, t.byteOffset, t.byteLength).toString('base64');
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
// a part of three triangles' corners: the first two corners at one place with one weighing, the third at it weighed apart
function part() {
  const P = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];
  const N = Array.from({ length: 9 }, () => [0, 0, 1]).flat(), C = Array(27).fill(200);
  const J = Array.from({ length: 9 }, (_, i) => (i === 2 ? [0, 1, 0, 0] : [0, 0, 0, 0])).flat();
  const W = Array.from({ length: 9 }, (_, i) => (i === 2 ? [0.5, 0.5, 0, 0] : [1, 0, 0, 0])).flat();
  return { pos: b64(Float32Array.from(P)), col: b64(Uint8Array.from(C)), nrm: b64(Float32Array.from(N)), faces: 3, jnt: b64(Uint8Array.from(J)), wgt: b64(Float32Array.from(W)) };
}
const fig = (more) => ({ rig: true, bones: [{ id: 'pelvis', head: [0, 0, 0] }, { id: 'torso', head: [0, 0, 1] }], parts: [part(), null], clips: {}, ...more });

describe('one skin a hero', () => {
  it('the bank keeps a one-skin figure\'s bones and weights, welded: corners one only where they also ride alike', () => {
    const { figs } = pageFigures({ a: fig({ skinParts: true }) }), p = figs.a.parts[0];
    expect(p.full).toBe(1);
    const J = dec(p.jq, Uint8Array), W = dec(p.wq, Uint8Array);
    expect(J.length).toBe(p.n * 4);
    expect(W.length).toBe(p.n * 4);
    // (the first two corners one vertex; the third, at the same place but weighed apart, its own)
    const I = dec(p.idx, Uint16Array);
    expect(I[0]).toBe(I[1]);
    expect(I[2]).not.toBe(I[0]);
    expect([W[I[2] * 4], W[I[2] * 4 + 1]]).toEqual([128, 128]);
    expect(p.jnt).toBeUndefined();
  });
  it('a part the bank does not weld keeps its corners, its bones and its weights a byte each', () => {
    const raw = { ...part(), corrective: 'AAAA' }, { figs } = pageFigures({ a: fig({ skinParts: true, parts: [raw, null] }) }), p = figs.a.parts[0];
    expect(p.full).toBeUndefined();
    expect(p.jnt).toBe(raw.jnt);
    expect(Array.from(dec(p.wq, Uint8Array).slice(8, 12))).toEqual([128, 128, 0, 0]);
    expect(p.wgt).toBeUndefined();
  });
  it('a part marked by what it is (the halo\'s hair and skin) keeps its marks, welded with its corners', () => {
    const marked = { ...part(), hc: b64(Uint8Array.from([1, 1, 2, 0, 0, 0, 0, 0, 0])) }, p = pageFigures({ a: fig({ skinParts: true, parts: [marked, null] }) }).figs.a.parts[0];
    const I = dec(p.idx, Uint16Array), H = dec(p.hc, Uint8Array);
    expect(H.length).toBe(p.n);
    expect([H[I[0]], H[I[2]], H[I[3]]]).toEqual([1, 2, 0]);
  });
  it('a figure that does not say it drops them, as before', () => {
    const p = pageFigures({ a: fig() }).figs.a.parts[0];
    expect(p.jq).toBeUndefined();
    expect(p.jnt).toBeUndefined();
  });
  it('the page draws skinned parts only where a figure says it; none ⇒ not a byte', () => {
    const ent = [{ id: 'hero', pilotable: true, rule: { type: 'platform' }, transform: { pos: [0, 0, 0] }, body: { type: 'figure-rig', figure: 'a' } }];
    const one = controllableChannelScript(ent, null, { a: fig({ skinParts: true }) }), plain = controllableChannelScript(ent, null, { a: fig() });
    expect(one).toContain('(SK ? THREE.SkinnedMesh : THREE.Mesh)');
    expect(one).toContain('new THREE.Skeleton(boneMeshes,');
    expect(one).toContain('(rig.meshes || rig.boneMeshes)');
    for (const no of ['SkinnedMesh : THREE.Mesh', '__skinned', 'rig.meshes']) expect(plain).not.toContain(no);
    expect(() => new Function(one)).not.toThrow();
  });
});
