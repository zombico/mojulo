// head: the neck's turn and tilt. The head keeps its carriage, follows only the larger looks (late and slower than the
// eyes, which turn back to keep the gaze), loops whole, and on the body turns the right way about the neck.
import { describe, it, expect } from 'vitest';
import { HEAD, headTake, headBones } from './head.js';
import { emoteTake, FACE_EMOTES, FACE_EMOTE_NAMES } from './emotes.js';
import { perform } from './perform.js';

const fps = 60, n = 3 * fps + 1;
const steady = (yaw, pitch = 0) => ({ yaw: new Array(n).fill(yaw), pitch: new Array(n).fill(pitch) });
const jump = (at, yaw) => ({ yaw: Array.from({ length: n }, (_, i) => (i / fps >= at ? yaw : 0)), pitch: new Array(n).fill(0) });

describe('head: the neck turns and tilts, the eyes keep the gaze', () => {
  it('leaves a small look to the eyes and follows a large one with a share of what is past the eyes\' own', () => {
    const small = headTake({ gaze: steady(HEAD.follow.from * 0.8), pose: () => ({}), n, fps });
    expect(Math.abs(small.yaw.at(-1))).toBeLessThan(0.01);
    const big = headTake({ gaze: steady(30), pose: () => ({}), n, fps });
    expect(big.yaw.at(-1)).toBeCloseTo(HEAD.follow.share * (30 - HEAD.follow.from), 1);
    // (the eyes keep the gaze: their turn in the head is the gaze less the head)
    expect(big.eyes.yaw.at(-1) + big.yaw.at(-1)).toBeCloseTo(30, 6);
    // (and however little it follows, never leaving the eyes past their comfortable reach)
    const far = headTake({ gaze: steady(40), pose: () => ({ follow: 0.1 }), n, fps });
    expect(far.eyes.yaw.at(-1)).toBeCloseTo(HEAD.follow.eyes, 1);
  });

  it('follows late and slower than the eyes, without overshooting, and holds its carriage', () => {
    const T = headTake({ gaze: jump(1, 30), pose: () => ({ roll: 6 }), n, fps }), aim = HEAD.follow.share * 20;
    const i0 = T.yaw.findIndex((v) => v > 0.05), i1 = T.yaw.findIndex((v) => v > aim * 0.9);
    expect(i0 / fps).toBeGreaterThanOrEqual(1 + HEAD.lag - 1 / fps);
    expect((i1 - i0) / fps).toBeGreaterThan(0.15);
    expect(Math.max(...T.yaw)).toBeLessThan(aim * 1.01);
    expect(T.roll.at(-1)).toBeCloseTo(6, 1);
  });

  it('loops whole in an emote, its carriage the card\'s, mirrored to the other side', () => {
    const TILT = FACE_EMOTE_NAMES.find((k) => Math.abs(FACE_EMOTES[k].head?.roll ?? 0) > 4), C = FACE_EMOTES[TILT];
    const A = emoteTake(TILT), B = emoteTake({ emote: TILT, mirror: true });
    for (const ax of ['yaw', 'pitch', 'roll']) expect(A.head[ax].at(-1)).toBe(A.head[ax][0]);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(A.head.roll)).toBeCloseTo(C.head.roll, 0);
    expect(Math.sign(mean(B.head.roll))).toBe(-Math.sign(C.head.roll));
  });

  it('nods on an emphasized word, and takes a beat\'s own carriage', () => {
    const T = perform({ seed: 2, seconds: 4, beats: [{ at: 0, face: 'neutral', say: 'I said *never*.' }, { at: 2.5, face: 'neutral', head: { roll: 8 } }] });
    const [b] = T.events.batons, i = Math.round((b.t + HEAD.baton.down + 0.05) * T.fps);
    expect(T.head.pitch[i]).toBeLessThan(T.head.pitch[Math.round((b.t - 0.3) * T.fps)] - 1);
    expect(T.head.roll.at(-1)).toBeCloseTo(8, 0);
  });

  it('turns the right way on the body: about the neck, the head and the jaw carried round it', () => {
    // (a small rig in the native frame: +z up, +y forward, +x the figure's right)
    const heads = { neck: [0, 0, 1.33], head: [0, 0, 1.46], jaw: [0, 0.02, 1.51], footL: [-0.07, 0, 0.05], toesL: [-0.07, 0.12, 0.02] };
    const at = (yaw, pitch, roll) => headBones(heads, { yaw: [yaw], pitch: [pitch], roll: [roll] });
    // (a turn to the right swings the jaw, ahead of the head, toward +x; a nod up lifts it; a tilt right moves the head's top to +x)
    expect(at(30, 0, 0).jaw.d[0]).toBeGreaterThan(0);
    expect(at(0, 20, 0).jaw.d[2]).toBeGreaterThan(0);
    expect(at(0, 0, 15).head.d[0]).toBeGreaterThan(0);
    // (the neck turns by its share; the head joint by the whole)
    const B = at(30, 0, 0), angle = (q) => (2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180) / Math.PI;
    expect(angle(B.neck.r)).toBeCloseTo(30 * HEAD.neck, 3);
    expect(angle(B.head.r)).toBeCloseTo(30, 3);
    expect(headBones({ neck: [0, 0, 1] }, { yaw: [1], pitch: [0], roll: [0] })).toEqual({});
  });
});
