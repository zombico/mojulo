// breath: the mind-body loop. The state sets the breath (calm low and slow, wary high and quick, through the mouth), the
// breath moves the face (a held breath's pressed lips, a sigh's parted lips), a startle's wariness settles with a sigh,
// and the breath lifts the body (the torso tipped back, the clavicles lifted, the arms carried), on the smallest inputs.
import { describe, it, expect } from 'vitest';
import { BREATH, BODY_BREATH, breathOf, breathTake, breathFace, breathBones, settle, reliefAt, SIGH_SECONDS } from './breath.js';
import { emotionFacs } from './emotions.js';
import { perform } from './perform.js';
import { emoteTake, FACE_EMOTE_NAMES, FACE_EMOTES } from './emotes.js';

const breathsPerMinute = (v, fps) => { let c = 0; for (let i = 1; i < v.length; i++) if (v[i - 1] < 0.15 && v[i] >= 0.15) c++; return (c * 60 * fps) / (v.length - 1); };

describe('breath: the state breathes, the face and the body follow', () => {
  it('breathes the state: calm low and slow, wary high, quick and through the mouth, sadness given to sighs', () => {
    const calm = breathOf({}, 0), wary = breathOf({}, 1), sad = breathOf(emotionFacs('sadness'), 0);
    expect(wary.rate).toBeGreaterThan(calm.rate);
    expect(wary.high).toBeGreaterThan(calm.high + 0.5);
    expect(calm.mouth).toBe(0);
    expect(wary.mouth).toBe(1);
    expect(sad.rate).toBeLessThan(calm.rate);
    expect(sad.sigh).toEqual(BREATH.sad.sigh);
    expect(breathOf({}, 0, { rate: 9 }).rate).toBe(9);
  });

  it('takes breaths at its rate, holds a held breath still, and fills a sigh near full; a loop breathes whole breaths', () => {
    const fps = 30, n = 60 * fps + 1, s = breathOf({}, 0);
    const T = breathTake({ n, fps, at: () => s, holds: [{ t: 10, dur: 1.2 }], sighs: [20] });
    expect(breathsPerMinute(T.v, fps)).toBeGreaterThan(s.rate - 2);
    expect(breathsPerMinute(T.v, fps)).toBeLessThan(s.rate + 2);
    expect(T.v[Math.round(10.5 * fps)]).toBe(T.v[Math.round(11 * fps)]);
    expect(Math.max(...T.v.slice(20 * fps, (20 + SIGH_SECONDS) * fps))).toBeGreaterThan(0.95);
    const L = breathTake({ n: 8 * fps + 1, fps, at: () => s, loop: true });
    expect(L.v.at(-1)).toBe(L.v[0]);
  });

  it('moves the face: through the mouth the lips apart, a held breath\'s lips pressed and its parting held off, a sigh\'s out parted', () => {
    const fps = 30, n = 6 * fps + 1, wary = breathOf({}, 1);
    const B = breathTake({ n, fps, at: () => wary, holds: [{ t: 1, dur: 1 }], sighs: [3] });
    const C = breathFace({ AU25: new Array(n).fill(0.4) }, B, { n, fps });
    expect(C.AU25[Math.round(0.5 * fps)]).toBeGreaterThanOrEqual(BREATH.mouth.lips);
    expect(C.AU24[Math.round(1.5 * fps)]).toBeCloseTo(BREATH.hold.press, 2);
    expect(C.AU25[Math.round(1.5 * fps)]).toBe(0);
    expect(C.AU25[Math.round((3 + BREATH.sigh.inhale + BREATH.sigh.exhale / 2) * fps)]).toBeGreaterThanOrEqual(BREATH.sigh.lips * 0.95);
    const calm = breathFace({}, breathTake({ n, fps, at: () => breathOf({}, 0) }), { n, fps });
    expect(calm.AU25).toBeUndefined();
  });

  it('closes the loop: a startle holds the breath, its wariness settles, and it lets go with a sigh', () => {
    const T = perform({ seed: 3, seconds: 12, beats: [{ at: 0, face: 'neutral' }, { at: 2, face: 'neutral', startle: true }] });
    const [H] = T.events.holds;
    expect(H.t).toBeCloseTo(2.05, 2);
    expect(T.events.sighs).toEqual([+(2 + reliefAt(H.dur)).toFixed(4)]);
    expect(settle(reliefAt(H.dur), H.dur)).toBeCloseTo(BREATH.relief, 6);
    const hi = (s) => T.breath.high[Math.round(s * T.fps)];
    expect(hi(4)).toBeGreaterThan(hi(1) + 0.3);
    expect(hi(11.5)).toBeLessThan(hi(4));
    const lid = (s) => Math.max(T.curves.AU5L?.[Math.round(s * T.fps)] ?? 0, T.curves.AU5?.[Math.round(s * T.fps)] ?? 0);
    expect(lid(11)).toBeLessThan(lid(4));
    // (a take with no startle holds no breath; every take breathes)
    const calm = perform({ seed: 3, beats: [{ at: 0, face: 'neutral' }] });
    expect(calm.events.holds).toBeUndefined();
    expect(calm.breath.v.length).toBe(calm.frames);
  });

  it('breathes in an emote\'s loop: whole breaths round it, its card\'s sighs', () => {
    const SIGHS = FACE_EMOTE_NAMES.find((k) => FACE_EMOTES[k].breath?.sigh), T = emoteTake({ emote: SIGHS, seconds: 20 });
    expect(T.breath.v.at(-1)).toBe(T.breath.v[0]);
    expect(T.events.sighs.length).toBeGreaterThan(0);
  });

  it('lifts the body: the torso tips back, each clavicle lifts and carries its arm, the legs stay', () => {
    // (a small rig in the native frame: +z up, +y forward, the figure's left at −x)
    const heads = { torso: [0, 0, 1.1], neck: [0, 0, 1.35], head: [0, 0, 1.45], clavicleL: [-0.04, 0, 1.3], upperArmL: [-0.16, 0, 1.3], handL: [-0.2, 0, 0.8],
      clavicleR: [0.04, 0, 1.3], upperArmR: [0.16, 0, 1.3], thighL: [-0.1, 0, 0.9], footL: [-0.07, 0, 0.05], toesL: [-0.07, 0.12, 0.02] };
    const B = breathBones(heads, { v: [0, 1], high: [1, 1] });
    const rot = ([x, y, z, w], p) => { const u = [x, y, z], c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const t = c(u, p).map((q) => 2 * q), c2 = c(u, t); return p.map((q, i) => q + w * t[i] + c2[i]); };
    const q = (id) => B[id].r.slice(4, 8);
    expect(B.torso.r.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(rot(q('torso'), [0, 0, 1])[1]).toBeLessThan(0);                          // the chest's top goes back
    for (const s of ['L', 'R']) {
      const tip = rot(q(`clavicle${s}`), [heads[`upperArm${s}`][0] - heads[`clavicle${s}`][0], 0, 0]);
      expect(tip[2]).toBeGreaterThan(0.12 * Math.sin((BODY_BREATH.clavicle * 0.9 * Math.PI) / 180));   // its tip up
      expect(B[`upperArm${s}`].d[5]).toBeGreaterThan(tip[2] * 0.9);                  // the arm carried up with it
    }
    expect(B.handL.d[5]).toBeCloseTo(B.upperArmL.d[5], 6);
    expect(B.thighL).toBeUndefined();
    expect(breathBones({ torso: [0, 0, 1] }, { v: [1], high: [1] })).toEqual({});
  });
});
