// The play grade held (figure-lod.js): a figure over its budget is simplified part by part, its skeleton and its corners'
// joints and weights kept, a seam kept a seam; a face's morphs are kept with the face or dropped with it.
import { describe, it, expect } from 'vitest';
import { lodFigure } from './figure-lod.js';

const enc = (a) => Buffer.from(a.buffer).toString('base64'), dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
// a part: a grid of n x n quads on a gently bent sheet, as a triangle soup, its corners weighted to one joint or another
function sheet(n, { joint = 1, morph = false, x0 = 0 } = {}) {
  const P = [], C = [], J = [], W = [], U = [];
  const at = (i, j) => [x0 + i / n, j / n, 0.05 * Math.sin(i / n * 3) * Math.cos(j / n * 2)];
  const corner = (i, j) => { P.push(...at(i, j)); C.push(200, 120, 90); J.push(joint, 0, 0, 0); W.push(1, 0, 0, 0); U.push(i / n, j / n); };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { corner(i, j); corner(i + 1, j); corner(i + 1, j + 1); corner(i, j); corner(i + 1, j + 1); corner(i, j + 1); }
  return { pos: enc(Float32Array.from(P)), col: enc(Uint8Array.from(C)), jnt: enc(Uint8Array.from(J)), wgt: enc(Float32Array.from(W)), uv: enc(Float32Array.from(U)), faces: 2 * n * n, ...(morph ? { morph: { i: 'AAAAAA==', s: 1, z: {} } } : {}) };
}
const fig = () => ({ rig: true, bones: [{ id: 'a' }, { id: 'b' }], clips: { idle: [] }, figH: 1.8, face: { targets: ['blink'] }, parts: [sheet(30, { joint: 0, morph: true }), null, sheet(30, { joint: 1, x0: 2 })] });

describe('the play grade held', () => {
  it('under its budget, the figure is the same object', () => {
    const f = fig(), r = lodFigure(f, 1e6);
    expect(r.fig).toBe(f);
    expect(r.after).toBe(r.before);
  });
  it('over it, each part is simplified toward its share; the skeleton, the clips and the height are kept', () => {
    const f = fig(), r = lodFigure(f, 1200, { face: false });
    expect(r.before).toBe(3600);
    expect(r.after).toBeLessThan(1700);
    expect(r.fig.bones).toBe(f.bones); expect(r.fig.clips).toBe(f.clips); expect(r.fig.figH).toBe(1.8);
    expect(r.fig.parts[1]).toBeNull();
    // every corner still carries its part's joint and full weight, and the soup's arrays agree in length
    for (const [k, joint] of [[0, 0], [2, 1]]) {
      const p = r.fig.parts[k], J = dec(p.jnt, Uint8Array), W = dec(p.wgt, Float32Array), P = dec(p.pos, Float32Array);
      expect(P.length).toBe(p.faces * 9); expect(J.length).toBe(p.faces * 12);
      for (let c = 0; c < p.faces * 3; c++) { expect(J[c * 4]).toBe(joint); expect(W[c * 4]).toBe(1); }
    }
  });
  it('the edge of a part stays where it was: its open border is locked', () => {
    const r = lodFigure(fig(), 1200, { face: false }), P = dec(r.fig.parts[2].pos, Float32Array);
    const xs = [], ys = []; for (let c = 0; c < P.length / 3; c++) { xs.push(P[c * 3]); ys.push(P[c * 3 + 1]); }
    expect(Math.min(...xs)).toBeCloseTo(2, 5); expect(Math.max(...xs)).toBeCloseTo(3, 5);
    expect(Math.min(...ys)).toBeCloseTo(0, 5); expect(Math.max(...ys)).toBeCloseTo(1, 5);
  });
  it('loose (a figure seen far off): no edge locked, welded by position, so it goes further toward a small budget', () => {
    const strict = lodFigure(fig(), 120, { face: false, floor: 0.05 }), loose = lodFigure(fig(), 120, { face: false, floor: 0.05, loose: true });
    expect(loose.after).toBeLessThan(strict.after);
    expect(loose.after).toBeLessThan(120 * 1.6);                         // (near its budget; a border held, the strict one is not)
    expect(loose.fig.bones).toEqual(fig().bones);
    const J = dec(loose.fig.parts[2].jnt, Uint8Array);
    for (let c = 0; c < J.length / 4; c++) expect(J[c * 4]).toBe(1);   // (each corner still its own joint's)
  });
  it('with the face kept, the part that carries its morphs is left whole; without it, the face and its morphs go', () => {
    const kept = lodFigure(fig(), 2000, { face: true });
    expect(kept.fig.parts[0].faces).toBe(1800);
    expect(kept.fig.parts[0].morph).toBeTruthy();
    expect(kept.fig.face).toBeTruthy();
    const gone = lodFigure(fig(), 1200, { face: false });
    expect(gone.fig.parts[0].morph).toBeUndefined();
    expect(gone.fig.face).toBeUndefined();
  });
  it("a buffer it does not know is carried a corner's share at a time; one that is not a corner's each leaves the part whole", () => {
    const f = fig(), n = f.parts[2].faces * 3;
    f.parts[2].nrm = enc(Int8Array.from({ length: n * 3 }, (_, i) => (i % 3 === 2 ? 127 : 0)));
    f.parts[0].perFace = enc(Uint8Array.from({ length: f.parts[0].faces }, () => 1));
    const r = lodFigure(f, 1200, { face: false }), q = r.fig.parts[2];
    expect(dec(q.nrm, Int8Array).length).toBe(q.faces * 9);
    expect(r.fig.parts[0]).toBe(f.parts[0]);
  });
  it('is the same every time', () => {
    expect(JSON.stringify(lodFigure(fig(), 1200, { face: false }).fig)).toBe(JSON.stringify(lodFigure(fig(), 1200, { face: false }).fig));
  });
});
