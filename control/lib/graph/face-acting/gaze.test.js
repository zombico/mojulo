// gaze: the eyes' law. Two eyes look at one thing: together, converging no nearer than the near point, never apart
// and never skewed; no distance is the far point, the eyes parallel.
import { describe, it, expect } from 'vitest';
import { EYES, MAX_VERGENCE, vergence, distanceOf, eyeTurns, gazeFaults, seatGaze } from './gaze.js';
import { perform, GAZE } from './perform.js';
import { gazeWeights, eyeWeights, eyesOfWeights, performanceTrack, RELATIONAL_FACE_TARGETS, GAZE_TURN } from '../polygonizer/relational-face-rig.js';

describe('gaze: the eyes look at one thing, never cross-eyed', () => {
  it('looks at the far point when no distance is given: both eyes the gaze itself, parallel', () => {
    expect(eyeTurns(12, -5)).toEqual({ L: { yaw: 12, pitch: -5 }, R: { yaw: 12, pitch: -5 } });
    expect(vergence()).toBe(0);
    expect(gazeWeights(12, -5)).toEqual(gazeWeights(12, -5, Infinity));
  });

  it('converges on a near target, the left eye toward the nose (+yaw) and the right away, no nearer than the near point', () => {
    const E = eyeTurns(0, 0, 0.6);
    expect(E.L.yaw).toBeGreaterThan(0);
    expect(E.R.yaw).toBeCloseTo(-E.L.yaw, 9);
    expect(E.L.yaw - E.R.yaw).toBeCloseTo(vergence(0.6), 9);
    // (nearer than the near point: the near point's, and no more)
    const close = eyeTurns(0, 0, 0.05);
    expect(close.L.yaw - close.R.yaw).toBeCloseTo(MAX_VERGENCE, 9);
    expect(gazeFaults(close)).toEqual([]);
    // (a target off to one side: the eyes both turn its way, the nearer eye the more)
    const side = eyeTurns(20, 0, 0.5);
    expect(side.L.yaw).toBeGreaterThan(20);
    expect(side.R.yaw).toBeLessThan(20);
    expect(side.R.yaw).toBeGreaterThan(0);
  });

  it('names a frame crossed, wall-eyed or skewed, and seats it back on the law', () => {
    const crossed = { L: { yaw: 15, pitch: 0 }, R: { yaw: -15, pitch: 0 } };
    const wall = { L: { yaw: -6, pitch: 0 }, R: { yaw: 6, pitch: 0 } };
    const skew = { L: { yaw: 0, pitch: 8 }, R: { yaw: 0, pitch: -8 } };
    expect(gazeFaults(crossed)).toEqual(['crossed']);
    expect(gazeFaults(wall)).toEqual(['wall-eyed']);
    expect(gazeFaults(skew)).toEqual(['skewed']);
    for (const f of [crossed, wall, skew]) expect(gazeFaults(seatGaze(f))).toEqual([]);
    expect(seatGaze(crossed).L.yaw - seatGaze(crossed).R.yaw).toBeCloseTo(MAX_VERGENCE, 9);
    const ok = eyeTurns(-10, 4, 1.2);
    expect(seatGaze(ok)).toBe(ok);
    expect(EYES.near).toBeGreaterThan(0.2);
  });

  it('reads the look weights back as each eye\'s turn, and both eyes "in" at full as crossed', () => {
    const E = eyeTurns(8, -6, 0.7), back = eyesOfWeights(eyeWeights(E));
    for (const s of ['L', 'R']) for (const a of ['yaw', 'pitch']) expect(back[s][a]).toBeCloseTo(E[s][a], 9);
    expect(gazeFaults(eyesOfWeights({ eyeLookInLeft: 1, eyeLookInRight: 1 }))).toContain('crossed');
    expect(gazeFaults(eyesOfWeights({ eyeLookOutLeft: 0.5, eyeLookOutRight: 0.5 }))).toContain('wall-eyed');
  });

  it('keeps every frame of a take on the law, a thinking look away and a speaker\'s glances among them', () => {
    const T = perform({ seed: 4, seconds: 10, beats: [{ at: 0, face: 'neutral', gaze: 'listener' }, { at: 2, face: 'worried', state: 'thinking' }, { at: 5, face: 'amused', state: 'speaking', gaze: { yaw: -GAZE.away.yaw[1], pitch: 8 } }] });
    const K = performanceTrack(T), look = RELATIONAL_FACE_TARGETS.map((n, j) => [n, j]).filter(([n]) => n.startsWith('eyeLook'));
    for (const row of K.w) expect(gazeFaults(eyesOfWeights(Object.fromEntries(look.map(([n, j]) => [n, row[j]]))))).toEqual([]);
    expect(GAZE_TURN).toBeGreaterThan(GAZE.away.yaw[1]);
  });

  it('focuses: the eyes converge on the listener a conversation away, relax looking away, and change focus slowly', () => {
    expect(distanceOf(vergence(1.1))).toBeCloseTo(1.1, 9);
    expect(distanceOf(0)).toBe(Infinity);
    const T = perform({ seed: 2, seconds: 6, beats: [{ at: 0, face: 'neutral', gaze: 'listener' }, { at: 2, face: 'pensive', state: 'thinking' }, { at: 4, face: 'neutral', gaze: { yaw: 5, pitch: -3, distance: 0.6 } }] });
    const at = (s) => T.gaze.vergence[Math.round(s * T.fps)];
    expect(at(1.5)).toBeCloseTo(vergence(GAZE.listener.distance), 1);
    expect(at(3.5)).toBeLessThan(0.05);
    expect(at(5.5)).toBeCloseTo(vergence(0.6), 1);
    // (the focus takes longer than the saccade: frames between its start and its settling)
    const i0 = T.gaze.vergence.findIndex((v, i) => i > 4 * T.fps - 20 && v > 0.05), i1 = T.gaze.vergence.findIndex((v, i) => i > i0 && v > vergence(0.6) - 0.05);
    expect((i1 - i0) / T.fps).toBeGreaterThan(EYES.verge * 0.5);
    // (and the rig turns each eye by it: converged, never crossed)
    const K = performanceTrack(T), look = RELATIONAL_FACE_TARGETS.map((n, j) => [n, j]).filter(([n]) => n.startsWith('eyeLook'));
    const E = eyesOfWeights(Object.fromEntries(look.map(([n, j]) => [n, K.w[Math.round(1.5 * 30)][j]])));
    expect(E.L.yaw - E.R.yaw).toBeCloseTo(vergence(GAZE.listener.distance), 0);
    expect(gazeFaults(E)).toEqual([]);
  });
});
