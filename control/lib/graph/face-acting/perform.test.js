// perform: a performance in beats → a take's curves, gaze and events, as a capture session records a face. The
// concepts: deterministic per seed; curves in range and continuous; the thought leads; a micro-expression stays under a
// fifth of a second; blinks at the state's rate; saccades on the main sequence; nothing blinks through a shut eye.
import { describe, expect, it } from 'vitest';
import { perform, performanceErrors, captureFrame, BLINK, BROW_FLASH, GAZE, MICRO, SPEAKING } from './perform.js';
import { EMOTIONS } from './emotions.js';
import { FACS_UNITS, auOf } from './facs.js';

const SCENE = { seed: 3, seconds: 8, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'amused', flash: true }, { at: 3, face: 'worried', state: 'thinking' }, { at: 5.5, face: 'determined', state: 'speaking', gaze: 'listener' }] };
const regionOf = (k) => FACS_UNITS[auOf(k)[0]].region;
const start = (c) => c.findIndex((v) => v > 0.02);

describe('the performer', () => {
  it('is deterministic per seed, and another seed plays another take', () => {
    const T = perform(SCENE);
    expect(perform(SCENE)).toEqual(T);
    expect(perform({ ...SCENE, seed: 4 })).not.toEqual(T);
    expect(T.frames).toBe(SCENE.seconds * T.fps + 1);
  });
  it('keeps every curve in range, and continuous but for the blinks (a frame moves a unit a third at most)', () => {
    const T = perform(SCENE);
    for (const [k, c] of Object.entries(T.curves)) {
      for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      if (k !== 'AU45') for (let i = 1; i < c.length; i++) expect(Math.abs(c[i] - c[i - 1])).toBeLessThan(0.34);
    }
    expect(Object.keys(captureFrame(T, Math.round(1.8 * T.fps)))).toEqual(expect.arrayContaining(Object.keys(EMOTIONS.amused)));
  });
  it('lets the thought lead: the upper face moves before the mouth', () => {
    // (an emotion with a brow and a mouth unit, from the library)
    const w = Object.keys(EMOTIONS).find((x) => Object.keys(EMOTIONS[x]).some((k) => regionOf(k) === 'upper') && Object.keys(EMOTIONS[x]).some((k) => regionOf(k) === 'lower'));
    const T = perform({ seed: 1, seconds: 3, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: w }] });
    const ks = Object.keys(EMOTIONS[w]), up = Math.min(...ks.filter((k) => regionOf(k) === 'upper').map((k) => start(T.curves[k])));
    const low = Math.min(...ks.filter((k) => regionOf(k) === 'lower').map((k) => start(T.curves[k])));
    expect(up).toBeLessThanOrEqual(low);
  });
  it('flashes a micro-expression for a fifth of a second at most, over the face', () => {
    // (a one-sided emotion, its units in no other beat: from the library)
    const one = Object.keys(EMOTIONS).find((x) => Object.keys(EMOTIONS[x]).length && Object.keys(EMOTIONS[x]).every((k) => auOf(k)[1]));
    const T = perform({ seed: 1, seconds: 3, beats: [{ at: 0, face: 'neutral', micro: one, microAt: 1 }] });
    const k = Object.keys(EMOTIONS[one])[0], on = T.curves[k].map((v, i) => [v, i]).filter(([v]) => v > 0).map(([, i]) => i);
    expect((on.at(-1) - on[0]) / T.fps).toBeLessThanOrEqual(MICRO.onset + MICRO.hold + MICRO.offset + 1 / T.fps);
    expect(T.events.micro).toEqual([{ t: 1, dur: 0.2 }]);
  });
  it('blinks at the state\'s rate: more speaking than attending, none through a shut eye', () => {
    const rate = (state) => perform({ seed: 2, seconds: 60, beats: [{ at: 0, face: 'neutral', state, gaze: 'listener' }] }).events.blinks.filter((b) => b.cause === 'spontaneous').length;
    const speaking = rate('speaking'), attentive = rate('attentive');
    expect(speaking).toBeGreaterThan(attentive);
    expect(speaking).toBeGreaterThan(BLINK.rate.speaking * 0.6); expect(speaking).toBeLessThan(BLINK.rate.speaking * 1.5);
    // (nor through a brow flash: a beat's own blink waits for the flash to fall)
    for (const seed of [1, 2, 3]) {
      const T = perform({ seed, seconds: 4, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'amused', flash: true }] });
      for (const b of T.events.blinks) expect(b.t < 0.85 || b.t >= 1 + BROW_FLASH.rise + BROW_FLASH.hold + BROW_FLASH.fall - 1e-6).toBe(true);
    }
    const shut = perform({ seed: 2, seconds: 20, beats: [{ at: 0, face: { emotion: 'neutral', eyes: 'shut' } }] });
    expect(shut.events.blinks.filter((b) => b.t > 1)).toEqual([]);
  });
  it('moves the eyes in saccades on the main sequence, away while thinking', () => {
    const T = perform(SCENE);
    expect(T.events.saccades.length).toBeGreaterThan(0);
    for (const s of T.events.saccades) expect(s.dur).toBeCloseTo(GAZE.saccade.base + GAZE.saccade.perDeg * s.amp, 3);
    const thinking = Math.round(4.5 * T.fps);
    expect(Math.abs(T.gaze.yaw[thinking])).toBeGreaterThan(GAZE.away.yaw[0] - GAZE.drift.deg - 0.01);
  });
  it('speaks a line over the face: the speech\'s units laid on, a rounded lip drawing the smile in, the brows kept', () => {
    // (a smiling face from the library, its brows' and its eyes' units kept under the line)
    const w = Object.keys(EMOTIONS).find((x) => EMOTIONS[x].AU12 && Object.keys(EMOTIONS[x]).some((k) => regionOf(k) !== 'lower'));
    const quiet = perform({ seed: 1, seconds: 4, beats: [{ at: 0, face: w }] }), T = perform({ seed: 1, seconds: 4, beats: [{ at: 0, face: w, say: 'Who knew you would come?' }] });
    expect(T.events.lines).toHaveLength(1);
    expect(Math.max(...T.curves.AU26)).toBeGreaterThan(0.1); expect(Math.max(...T.curves.AU18)).toBeGreaterThan(0.4);
    const ou = T.curves.AU18.indexOf(Math.max(...T.curves.AU18));
    expect(T.curves.AU12[ou]).toBeLessThan(quiet.curves.AU12[ou] * (1 - SPEAKING.round * 0.5));
    for (const k of Object.keys(EMOTIONS[w]).filter((x) => regionOf(x) !== 'lower')) expect(T.curves[k][ou]).toBeCloseTo(quiet.curves[k][ou], 6);
    // (the take runs to the line's end; the beat speaks unless it says another state; an emphasized word's baton)
    expect(perform({ seed: 1, beats: [{ at: 1, face: 'neutral', say: 'This is a rather long line, said slowly and with care.' }] }).seconds).toBeGreaterThan(4);
    const E = perform({ seed: 1, beats: [{ at: 0, face: 'neutral', say: 'I said *no*.' }] });
    expect(E.events.batons.map((b) => b.word)).toEqual(['no']); expect(Math.max(...E.curves.AU2)).toBeGreaterThan(0.25);
    expect(performanceErrors({ beats: [{ at: 0, face: 'neutral', say: { text: 'hi', rate: 9 } }] })[0]).toMatch(/beats\[0\]\.say\.rate/);
  });
  it('refuses by name what is not a performance', () => {
    expect(performanceErrors({})[0]).toMatch(/beats/);
    expect(performanceErrors({ beats: [{ at: 0, face: 'joy' }] })[0]).toMatch(/beats\[0\]\.face/);
    expect(performanceErrors({ beats: [{ at: 0, face: 'neutral', state: 'dreaming', gaze: 'sideways' }] })).toHaveLength(2);
    expect(() => perform({ beats: [] })).toThrow(/perform/);
  });
});
