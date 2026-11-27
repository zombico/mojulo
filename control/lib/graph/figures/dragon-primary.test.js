// A DRAGON'S PRIMARY FORM's pieces (figures/dragon-primary.js), each on the smallest pack that shows it: a pack grown
// grows its bones, corners and clips' heads (never their turns); swollen, its corners move out from their bone and a
// bone left at 1 is left alone; its wings turned out about the forward axis; tinted, it takes the colour's value and keeps
// its own light and dark; ridged, each spine stands on top of its bone's skin, hung wholly on it, in the ridge's colour.
import { describe, it, expect } from 'vitest';
import { scalePack, girthPack, spreadPack, tintPack, ridgePack, PRIMARY } from './dragon-primary.js';

const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
// (two bones along y: a back and a wing standing up off it; a corner each side of the back, one up the wing)
function pack() {
  const pos = new Float32Array([0.5, 0.5, 0.2, -0.5, 0.5, 0.2, 0, 0.5, 1.5]), col = new Uint8Array([40, 20, 10, 120, 60, 30, 200, 100, 50]);
  const jnt = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]), wgt = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  return { bones: [{ id: 'spine0', head: [0, 0, 0.2], tail: [0, 1, 0.2] }, { id: 'wingBoneR', head: [0, 0.5, 0.5], tail: [0, 0.5, 2] }],
    parts: [{ pos: enc(pos), col: enc(col), jnt: enc(jnt), wgt: enc(wgt), faces: '1' }, null],
    clips: { idle: { k: 1, s: 1, b: [0, 0, 0, 1, 0, 0, 0.2, 0, 0, 0, 1, 0, 0.5, 0.5] } }, figH: 2 };
}
const lumOf = (c, j) => 0.2126 * c[j] + 0.7152 * c[j + 1] + 0.0722 * c[j + 2];

describe('a dragon primary form\'s pieces', () => {
  it('grown: bones, corners and clip heads scale; turns do not', () => {
    const F = scalePack(pack(), 3), V = dec(F.parts[0].pos, Float32Array);
    expect(F.bones[1].tail).toEqual([0, 1.5, 6]);
    expect(V[8]).toBeCloseTo(4.5, 5);
    expect(F.clips.idle.b.slice(0, 7)).toEqual([0, 0, 0, 1, 0, 0, 0.6]);
    expect(F.figH).toBe(6);
  });
  it('swollen: corners move out from their own bone; a bone at 1 is untouched', () => {
    const P = pack(), F = girthPack(P, (id) => (id === 'spine0' ? 2 : undefined)), V = dec(F.parts[0].pos, Float32Array);
    expect(V[0]).toBeCloseTo(1, 6); expect(V[2]).toBeCloseTo(0.2, 6);
    expect(V[3]).toBeCloseTo(-1, 6);
    expect(F.parts[0].pos.slice(-16)).toBe(P.parts[0].pos.slice(-16));
    expect(girthPack(P, () => undefined).parts[0].pos).toBe(P.parts[0].pos);
  });
  it('spread: a wing turned out about the forward axis keeps its y and length, the other bones stay', () => {
    const F = spreadPack(pack(), { wingBoneR: 30 }), w = F.bones[1], V = dec(F.parts[0].pos, Float32Array);
    expect(w.tail[0]).toBeGreaterThan(0.5);
    expect(w.tail[1]).toBe(0.5);
    expect(Math.hypot(w.tail[0] - w.head[0], w.tail[2] - w.head[2])).toBeCloseTo(1.5, 4);
    expect(V[6]).toBeGreaterThan(0.4);
    expect(F.bones[0]).toEqual(pack().bones[0]);
  });
  it('tinted: it takes the colour\'s hue and keeps its own light and dark in order', () => {
    const F = tintPack(pack(), '#2a4a6a', 1), c = dec(F.parts[0].col, Uint8Array);
    for (let j = 0; j < 9; j += 3) expect(c[j + 2]).toBeGreaterThan(c[j]);
    expect(lumOf(c, 0)).toBeLessThan(lumOf(c, 3));
    expect(lumOf(c, 3)).toBeLessThan(lumOf(c, 6));
  });
  it('ridged: spines stand on top of their bone, hung wholly on it, in the ridge colour; absent, it adds nothing', () => {
    const P = pack(), F = ridgePack(P, [['spine0', 0.1]], '#ffffff'), V = dec(F.parts[0].pos, Float32Array), J = dec(F.parts[0].jnt, Uint8Array), W = dec(F.parts[0].wgt, Float32Array), c = dec(F.parts[0].col, Uint8Array);
    expect(V.length).toBeGreaterThan(9);
    expect(Number(F.parts[0].faces)).toBe(1 + (V.length / 3 - 3) / 3);
    let top = -Infinity; for (let v = 3; v < V.length / 3; v++) { top = Math.max(top, V[v * 3 + 2]); expect(J[v * 4]).toBe(0); expect(W[v * 4]).toBe(1); expect(c[v * 3]).toBe(255); }
    expect(top).toBeCloseTo(0.2 + 0.1 * PRIMARY.scale, 4);
    expect(ridgePack(P, [['nope', 0.1]], '#ffffff')).toStrictEqual(P);
  });
});
