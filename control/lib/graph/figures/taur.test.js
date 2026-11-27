// A TAUR (figures/taur.js): an upper body stood on a lower one's withers, one skeleton and one skin.
import { describe, it, expect } from 'vitest';
import { taurFigure, taurFit, LOCO } from './taur.js';

const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const part = (bone, pts) => ({ pos: enc(new Float32Array(pts.flat())), jnt: enc(new Uint8Array(pts.flatMap(() => [bone, 0, 0, 0]))), wgt: enc(new Float32Array(pts.flatMap(() => [1, 0, 0, 0]))), faces: pts.length / 3 });
const I = [0, 0, 0, 1];
// (a clip: per frame, per bone, its rotation and its head)
const clip = (frames, extra = {}) => ({ k: frames.length, s: 1, b: frames.flat(2), ...extra });

// the LOWER: a spine, a neck from its front, a hoof under it; its walk lifts its spine 0.1 m in its second frame
const LB = [{ id: 'spine0', head: [0, -0.5, 1], tail: [0, 0.3, 1.2] }, { id: 'neck0', head: [0, 0.3, 1.2], tail: [0, 0.6, 1.8] }, { id: 'foreHoofR', head: [0.2, 0.3, 0.1], tail: [0.2, 0.32, 0] }];
const restL = LB.map((b) => [...I, ...b.head]);
const lift = LB.map((b, i) => (i === 1 ? [...I, b.head[0], b.head[1], b.head[2] + 0.1] : [...I, b.head[0], b.head[1], b.head[2] + (i === 0 ? 0.1 : 0)]));
const lower = { bones: LB, figH: 1.9, parts: [part(0, [[0, 0, 1], [0, 0.1, 1], [0, 0, 1.1]]), part(1, [[0, 0.4, 1.4], [0, 0.5, 1.5], [0, 0.4, 1.6]]), part(2, [[0.2, 0.3, 0.1], [0.2, 0.3, 0], [0.25, 0.3, 0]])],
  clips: { walk: clip([restL, lift]), idle: clip([restL]) } };
// the UPPER: a pelvis, a torso, a leg; its swing turns its torso, its pelvis bobs 0.05 m (taken off on the withers)
const UB = [{ id: 'pelvis', head: [0, 0, 1], tail: [0, 0, 1.2] }, { id: 'torso', head: [0, 0, 1.2], tail: [0, 0, 1.7] }, { id: 'thighL', head: [-0.1, 0, 1], tail: [-0.1, 0, 0.5] }];
const restU = UB.map((b) => [...I, ...b.head]);
const s = Math.SQRT1_2, swungU = [[...I, 0, 0, 1.05], [0, 0, s, s, 0, 0, 1.25], [...I, -0.1, 0, 1.05]];
const upper = { bones: UB, figH: 1.8, parts: [part(0, [[0, 0, 1], [0.1, 0, 1], [0, 0, 1.1]]), part(1, [[0, 0, 1.3], [0.1, 0, 1.3], [0, 0, 1.6]]), part(2, [[-0.1, 0, 0.9], [-0.1, 0, 0.6], [-0.05, 0, 0.7]])],
  clips: { idle: clip([restU]), swing_neutral: clip([restU, swungU, restU], { once: true }) } };
const fit = { cut: ['neck0'], drop: ['thighL'], waist: 'pelvis', anchor: 'spine0', at: [0, 0.3, 1.2], scale: 1 };

describe('a taur: an upper body on a lower one\'s withers', () => {
  const M = taurFigure(upper, lower, fit), id = (n) => M.bones.findIndex((b) => b.id === n), head = (C, f, n) => C.b.slice((f * M.bones.length + id(n)) * 7 + 4, (f * M.bones.length + id(n)) * 7 + 7);

  it('one skeleton: the lower\'s bones but its neck, the upper\'s but its legs, the upper\'s waist at the withers', () => {
    expect(M.bones.map((b) => b.id)).toEqual(['spine0', 'foreHoofR', 'pelvis', 'torso']);
    expect(M.bones[id('pelvis')].head).toEqual([0, 0.3, 1.2]);
    expect(M.bones[id('torso')].head[2]).toBeCloseTo(1.4, 5);
    expect(M.parts).toHaveLength(M.bones.length);
    // (each part's joints its own bone's, renumbered; the upper's corners carried to the withers)
    const P = M.parts[id('torso')], J = dec(P.jnt, Uint8Array), V = dec(P.pos, Float32Array);
    expect(J[0]).toBe(id('torso'));
    expect(V[1]).toBeCloseTo(0.3, 5);
    expect(V[2]).toBeCloseTo(1.5, 5);
  });

  it('it walks on the lower body\'s gait, the upper carried with the withers; it swings on the upper\'s clock, the hips\' bob taken off', () => {
    expect(LOCO).toContain('walk');
    const W = M.clips.walk;
    expect(W.k).toBe(2);
    expect(head(W, 1, 'torso')[2] - head(W, 0, 'torso')[2]).toBeCloseTo(0.1, 4);
    const S = M.clips.swing_neutral;
    expect(S.k).toBe(3);
    expect(S.once).toBe(true);
    // (the torso turned, its head where the withers carry it: the hips' 0.05 m bob not in it)
    expect(S.b.slice((1 * M.bones.length + id('torso')) * 7, (1 * M.bones.length + id('torso')) * 7 + 4).map((x) => Math.round(x * 1e4) / 1e4)).toEqual([0, 0, 0.7071, 0.7071]);
    expect(head(S, 1, 'torso')[2]).toBeCloseTo(1.4, 4);
    // (a state only one body plays takes the other's rest: the lower's idle under the swing)
    expect(head(S, 1, 'foreHoofR')).toEqual(LB[2].head);
  });

  it('its fit read off the two skeletons: the neck and the spine it hangs from, the legs, the waist grown to the withers', () => {
    const F = taurFit(upper, lower);
    expect(F).toMatchObject({ cut: ['neck0'], drop: ['thighL'], waist: 'pelvis', anchor: 'spine0' });
    expect(F.at[2]).toBeLessThan(1.2);
    expect(F.scale).toBeGreaterThan(0);
    expect(() => taurFigure(upper, lower, { ...fit, anchor: 'neck0' })).toThrow(/anchor/);
  });
});
