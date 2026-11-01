// parts: the face's brows, lids, cheeks and mouth each on their own timing, pulled by each other where the anatomy
// pulls, and the upper face's gestures (tells). Concepts on the smallest takes: the cheek lags the smile, the brows lead
// the mouth, a coupling is a floor by side, a tell lays its units over the face from its beat, mirrored by its sides.
import { describe, it, expect } from 'vitest';
import { PARTS, PART_NAMES, partOf, couple, COUPLINGS, UPPER_GESTURES, UPPER_GESTURE_NAMES, tellOf, tellErrors } from './parts.js';
import { FACS_UNITS, auOf } from './facs.js';
import { perform, performanceErrors } from './perform.js';

// (the moment a unit's curve first reaches half its height)
const half = (T, k) => { const c = T.curves[k], top = Math.max(...c); return c.findIndex((v) => v >= top / 2) / T.fps; };

describe('parts: the face moves as parts', () => {
  it('names every unit\'s part, each part\'s units FACS\'s own, the rest the mouth', () => {
    for (const p of PART_NAMES) for (const u of PARTS[p].units ?? []) expect(FACS_UNITS[u]).toBeDefined();
    expect(partOf('AU4L')).toBe('brows');
    expect(partOf('AU7R')).toBe('lids');
    expect(partOf('AU6')).toBe('cheeks');
    expect(partOf('AU12R')).toBe('mouth');
    expect(PARTS.cheeks.lead).toBeLessThan(0);
    expect(PARTS.lids.pace).toBeLessThan(PARTS.cheeks.pace);
  });

  it('times each part its own way: the cheek lags the smile, the brows lead the mouth', () => {
    const smile = perform({ seed: 2, seconds: 3, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'happiness' }] });
    expect(half(smile, 'AU6')).toBeGreaterThan(half(smile, 'AU12') + 0.05);
    const sad = perform({ seed: 2, seconds: 3, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'sadness' }] });
    expect(half(sad, 'AU1')).toBeLessThan(half(sad, 'AU15'));
  });

  it('couples by side, a floor not a sum: the cheek raised pushes its own lower lid up', () => {
    const C = COUPLINGS.find((c) => partOf(c.from) === 'cheeks' && partOf(c.to) === 'lids'), n = 4;
    const curves = { [`${C.from}L`]: [0, 0.4, 0.8, 0.8], [`${C.to}L`]: [0, 0, 0, 0.9] };
    couple(curves, n);
    expect(curves[`${C.to}L`][2]).toBeCloseTo(C.gain * 0.8, 9);
    expect(curves[`${C.to}L`][3]).toBe(0.9);
    expect(curves[`${C.to}R`]).toBeUndefined();
    // (a whole unit held already counts toward the floor)
    const held = { [C.from]: [1], [C.to]: [C.gain] };
    couple(held, 1);
    expect(held[`${C.to}L`]).toBeUndefined();
    // (a face with no cause is untouched)
    const none = { AU12: [0.5] };
    expect(couple(none, 1)).toEqual({ AU12: [0.5] });
  });

  it('lays a tell over the face from its beat, its sides mirrored on asking; refused by name', () => {
    const name = UPPER_GESTURE_NAMES.find((g) => Object.keys(UPPER_GESTURES[g].units).some((k) => auOf(k)[1])), G = UPPER_GESTURES[name];
    const [key, peak] = Object.entries(G.units).find(([k]) => auOf(k)[1]), [au, side] = auOf(key), other = `${au}${side === 'L' ? 'R' : 'L'}`;
    const T = perform({ seed: 1, seconds: 3, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'neutral', tell: name }] });
    expect(T.events.tells).toEqual([{ t: 1, gesture: name, dur: G.up + G.hold + G.down }]);
    expect(T.curves[key][Math.round((1 + G.up + G.hold / 2) * T.fps)]).toBeCloseTo(peak, 1);
    expect(Math.max(...(T.curves[other] ?? [0]))).toBeLessThan(peak / 2);
    expect(tellOf({ gesture: name, mirror: true }).units[other]).toBe(peak);
    expect(perform({ seed: 1, beats: [{ at: 0, face: 'neutral' }] }).events.tells).toBeUndefined();
    expect(tellErrors('smirk')[0]).toMatch(/not an upper-face gesture/);
    expect(performanceErrors({ beats: [{ at: 0, tell: [name, 'smirk'] }] })[0]).toMatch(/^beats\[0\]\.tell: 'smirk'/);
  });
});
