// emotions: words an actor plays as FACS states, and a face composed from them (intensity, a blend by region, a mask
// that leaks, a lean to a side, an eye look for the upper face). One case per way of composing.
import { describe, expect, it } from 'vitest';
import { EMOTIONS, EMOTION_NUANCES, composeFace, eyeLookFacs, emotionFacs } from './emotions.js';
import { FACS_UNITS, auOf } from './facs.js';
import { EYE_LOOKS } from '../polygonizer/humanoid-head.js';

const region = (k) => FACS_UNITS[auOf(k)[0]].region;
const upper = (st) => Object.keys(st).filter((k) => ['upper', 'eyes'].includes(region(k)));
const lower = (st) => Object.keys(st).filter((k) => !['upper', 'eyes'].includes(region(k)));
// (an emotion with both an upper and a lower face, and one with a sided unit given whole: chosen from the library)
const both = Object.keys(EMOTIONS).filter((w) => upper(EMOTIONS[w]).length && lower(EMOTIONS[w]).length);
const sidedWhole = Object.keys(EMOTIONS).find((w) => Object.keys(EMOTIONS[w]).some((k) => { const [au, s] = auOf(k); return FACS_UNITS[au].sided && !s; }));

describe('the emotions', () => {
  it('names only action units, in range, a nuance one-sided by its own sides', () => {
    for (const w of [both[0], Object.keys(EMOTION_NUANCES)[0]]) for (const [k, v] of Object.entries(EMOTIONS[w])) { expect(auOf(k)).not.toBeNull(); expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); }
    expect(() => emotionFacs('joy')).toThrow(/not an emotion/);
  });
  it('scales a word by its intensity, each unit clamped', () => {
    const w = both[0], st = composeFace({ emotion: w, intensity: 0.5 });
    for (const [k, v] of Object.entries(EMOTIONS[w])) expect(st[k]).toBeCloseTo(v * 0.5, 6);
    for (const v of Object.values(composeFace({ emotion: w, intensity: 9 }))) expect(v).toBeLessThanOrEqual(1);
  });
  it('blends two by the face\'s regions: the upper from one, the lower from the other', () => {
    const [a, b] = both, st = composeFace({ blend: { upper: a, lower: b } });
    expect(upper(st).sort()).toEqual(upper(EMOTIONS[a]).sort());
    expect(lower(st).sort()).toEqual(lower(EMOTIONS[b]).sort());
  });
  it('masks a felt emotion with a shown one: the shown mouth, the felt brows and eyes leaking at a share', () => {
    const [felt, shown] = both, st = composeFace({ mask: { felt, shown, leak: 0.25 } });
    for (const k of lower(EMOTIONS[shown])) expect(st[k]).toBeCloseTo(EMOTIONS[shown][k], 6);
    for (const k of upper(EMOTIONS[felt])) expect(st[k]).toBeCloseTo(Math.min(1, EMOTIONS[felt][k] * 0.25 + (lower(EMOTIONS[shown]).includes(k) ? EMOTIONS[shown][k] : 0)), 6);
    // (no upper face of the shown one: a social expression's eyes do not join it)
    for (const k of upper(EMOTIONS[shown])) if (!upper(EMOTIONS[felt]).includes(k)) expect(st[k]).toBeUndefined();
    expect(() => composeFace({ emotion: felt, mask: { felt, shown } })).toThrow(/one of/);
  });
  it('leans a sided unit to a side, the far side eased; one-sided words keep their sides', () => {
    const st = composeFace({ emotion: sidedWhole, lean: 0.5 });
    const [k] = Object.keys(EMOTIONS[sidedWhole]).filter((x) => { const [au, s] = auOf(x); return FACS_UNITS[au].sided && !s; });
    expect(st[`${k}R`]).toBeCloseTo(EMOTIONS[sidedWhole][k], 6);
    expect(st[`${k}L`]).toBeCloseTo(EMOTIONS[sidedWhole][k] * 0.5, 6);
    expect(composeFace({ emotion: sidedWhole, lean: 0 })).toEqual(composeFace(sidedWhole));
  });
  it('takes an eye look as the upper face', () => {
    const look = Object.keys(EYE_LOOKS).find((w) => EYE_LOOKS[w].browTilt < 0 && EYE_LOOKS[w].aperture > 1);
    const [w] = both, st = composeFace({ emotion: w, eyes: look }), L = eyeLookFacs(look);
    expect(upper(st).sort()).toEqual(Object.keys(L).sort());
    expect(lower(st).sort()).toEqual(lower(EMOTIONS[w]).sort());
    expect(L.AU1).toBeGreaterThan(0); expect(L.AU5).toBeGreaterThan(0);
    expect(() => eyeLookFacs('grin')).toThrow(/not an eye look/);
  });
});
