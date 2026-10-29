// alert: wariness as a dial (0 calm … 1 on guard), raised by the fear a face holds. Concepts on the smallest takes: the
// blinks thin and quicken and ride the checks, the eyes check wider and focused, the look moves the lids, a startle
// blinks hard and widens the eyes, and an emote takes the dial as a performance does.
import { describe, it, expect } from 'vitest';
import { ALERT, STARTLE, fearOf, alertErrors } from './alert.js';
import { LOOK } from './parts.js';
import { EMOTION_PROTOTYPES } from './facs.js';
import { emotionFacs } from './emotions.js';
import { perform, performanceErrors, GAZE } from './perform.js';
import { FACE_EMOTES, FACE_EMOTE_NAMES, emoteTake, emoteState } from './emotes.js';
import { vergence } from './gaze.js';

const spont = (T) => T.events.blinks.filter((b) => b.cause === 'spontaneous');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const calm = (extra = {}) => perform({ seed: 5, seconds: 60, beats: [{ at: 0, face: 'neutral', gaze: 'listener', ...extra }] });

describe('alert: wariness, and fear raising it', () => {
  it('reads fear in a face: fear\'s prototype near one, worry under half, a smile none', () => {
    expect(fearOf(EMOTION_PROTOTYPES.fear)).toBeGreaterThan(0.9);
    expect(fearOf(emotionFacs('worried'))).toBeLessThan(0.5);
    expect(fearOf(emotionFacs('worried'))).toBeGreaterThan(fearOf(EMOTION_PROTOTYPES.happiness));
    expect(fearOf(EMOTION_PROTOTYPES.happiness)).toBe(0);
    expect(alertErrors(1.5)[0]).toMatch(/0 \(calm\)/);
    expect(performanceErrors({ alert: -1, beats: [{ at: 0, alert: 2, startle: 'yes' }] })).toHaveLength(3);
  });

  it('thins and quickens the blinks the warier, by the dial or by the fear in the face', () => {
    const C = calm(), W = calm({ alert: 1 }), F = perform({ seed: 5, seconds: 60, beats: [{ at: 0, face: 'fear', gaze: 'listener' }] });
    for (const T of [W, F]) {
      expect(spont(T).length).toBeLessThan(spont(C).length * (ALERT.blink.rate + 0.3));
      expect(mean(spont(T).map((b) => b.dur))).toBeLessThan(mean(spont(C).map((b) => b.dur)) * (ALERT.blink.length + 0.15));
    }
  });

  it('checks the surroundings the warier: wider glances, focused on what they check', () => {
    const C = calm(), W = calm({ alert: 1 });
    const big = (T) => T.events.saccades.filter((s) => s.amp >= ALERT.eyes.check.reach[0]);
    expect(big(W).length).toBeGreaterThan(big(C).length + 2);
    // (a check's focus: a few metres off, never the far point)
    const s = big(W)[0], i = Math.round((s.t + 0.3) * W.fps);
    expect(W.gaze.vergence[i]).toBeCloseTo(vergence(ALERT.eyes.check.distance), 1);
  });

  it('moves the lids with the look: the upper lid follows the eye down, a glance widens them, more on guard', () => {
    const D = perform({ seed: 1, seconds: 3, beats: [{ at: 0, face: 'neutral', gaze: 'down' }] }), i = Math.round(2 * D.fps);
    expect(Math.min(D.curves.AU45L[i], D.curves.AU45R[i])).toBeGreaterThan(LOOK.down * -GAZE.down.pitch * 0.9);
    const glance = (alert) => perform({ seed: 1, seconds: 3, beats: [{ at: 0, face: 'neutral', gaze: 'listener', alert }, { at: 1, face: 'neutral', gaze: { yaw: 18, pitch: 0 }, alert }] });
    const lift = (T) => Math.max(...(T.curves.AU5L ?? T.curves.AU5).slice(Math.round(0.9 * T.fps), Math.round(1.5 * T.fps)));
    expect(lift(glance(0))).toBeGreaterThanOrEqual(LOOK.pulse.base * 0.9);
    expect(lift(glance(1))).toBeGreaterThan(lift(glance(0)) + LOOK.pulse.alert * 0.8);
  });

  it('startles: the reflex blink on the beat whatever else wanted one, then the eyes wide', () => {
    const T = perform({ seed: 2, seconds: 4, beats: [{ at: 0, face: 'neutral' }, { at: 1.5, face: 'neutral', startle: true }] });
    expect(T.events.blinks.find((b) => b.cause === 'startle')?.t).toBe(1.5);
    expect(T.events.blinks.filter((b) => Math.abs(b.t - 1.5) < 0.6 && b.cause !== 'startle')).toEqual([]);
    const i = Math.round((1.5 + STARTLE.close + STARTLE.shut + STARTLE.open + STARTLE.rise + 0.1) * T.fps);
    expect(T.curves.AU5L?.[i] ?? T.curves.AU5[i]).toBeGreaterThan(STARTLE.widen.AU5 * 0.8);
  });

  it('takes the dial on an emote as a performance does: its card\'s, a spec\'s, or its fear\'s', () => {
    const CALM = FACE_EMOTE_NAMES.find((k) => !FACE_EMOTES[k].alert && !FACE_EMOTES[k].eyes.away), WARY = FACE_EMOTE_NAMES.find((k) => FACE_EMOTES[k].alert);
    expect(emoteState(WARY).alert).toBe(FACE_EMOTES[WARY].alert);
    expect(emoteState({ emote: CALM, face: 'fear' }).alert).toBeGreaterThan(0.9);
    const A = emoteTake({ emote: CALM, seconds: 60 }), B = emoteTake({ emote: CALM, seconds: 60, alert: 1 });
    expect(spont(B).length).toBeLessThan(spont(A).length);
    expect(Math.max(...B.events.saccades.map((s) => s.amp))).toBeGreaterThan(Math.max(0, ...A.events.saccades.map((s) => s.amp)) + 5);
    for (const T of [A, B]) for (const c of Object.values(T.curves)) expect(c.at(-1)).toBe(c[0]);
  });
});
