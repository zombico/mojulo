// breast-field.test.js — the breast as a field over the chest coordinate, and the gates measured on it
import { describe, it, expect } from 'vitest';
import { BREAST_FIELD, BREAST_BANDS, breastHeight, breastSpan, breastReach, breastGates } from './breast-field.js';

describe('the breast field', () => {
  it('stands its projection at the apex, nothing past the footprint, and is deterministic', () => {
    expect(breastHeight(0, 0)).toBe(BREAST_FIELD.proj);
    for (let k = 0; k < 16; k++) { const th = (2 * Math.PI * k) / 16, r = breastReach(th) * 1.001; expect(breastHeight(r * Math.cos(th), r * Math.sin(th))).toBe(0); }
    expect(breastHeight(0.3, -0.4)).toBe(breastHeight(0.3, -0.4));
    const sp = breastSpan(0); expect(sp[0]).toBeCloseTo(-BREAST_FIELD.reach.in, 2); expect(sp[1]).toBeCloseTo(BREAST_FIELD.reach.out, 2);
    expect(breastSpan(BREAST_FIELD.reach.up + 0.1)).toBeNull();
  });
  it('the default holds every gate: the poles 45 : 55, the fold a wall, the upper line never a dome, the margins melting, one peak', () => {
    const G = breastGates();
    expect(Object.keys(G).sort()).toEqual(Object.keys(BREAST_BANDS).sort());
    for (const [k, g] of Object.entries(G)) expect(g.pass, `${k} ${g.value}`).toBe(true);
    expect(G.winding.value).toBe(1);
  });
  it('the gates catch what the eye caught: a dome-profiled field reads as a ball (steep margins, a domed upper pole)', () => {
    const ball = { ...BREAST_FIELD, shape: { up: 2, down: 2, out: 2, in: 2 }, profile: { up: 0.6, down: 0.6, out: 0.6, in: 0.6 } };
    const G = breastGates(ball); expect(G.margins.pass).toBe(false); expect(G.upperLine.pass).toBe(false);
    const high = { ...BREAST_FIELD, reach: { ...BREAST_FIELD.reach, up: 1.9, down: 0.7 } }; expect(breastGates(high).poles.pass).toBe(false);
  });
  it('the cleft: the pair meets at the midline in a valley; the margins profile medially falls to the chest before it', () => {
    expect(breastHeight(BREAST_FIELD.cleft, 0)).toBeGreaterThan(0.2 * BREAST_FIELD.proj);
    // the medial side with the margins' profile (q 2.8) and reach: flat chest at the midline, the two-mounds read
    const apart = { ...BREAST_FIELD, reach: { ...BREAST_FIELD.reach, in: 1.15 }, profile: { ...BREAST_FIELD.profile, in: 2.8 } };
    const G = breastGates(apart); expect(G.cleft.value).toBe(0); expect(G.cleft.pass).toBe(false);
  });
});
