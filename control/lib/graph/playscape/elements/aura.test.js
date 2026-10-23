// Spirit onions: an aura's shells rise from round bulbs to a point and spin their own ways at their own rates, its rings
// of spikes turn at their own intervals; it grows from nothing and scales whole; a look wears one only when given, and
// the page draws one only where a look or a blast carries it.
import { describe, expect, it } from 'vitest';
import { readAura, scaleAura, onionPetals, spikeTips, auraBands, auraSignature, AURAS, AURA_NAMES } from './aura.js';
import { readLook, LOOKS, valueSignature } from './elements.js';
import { statusScript } from '../../scene/channels/status-channel.js';

const C = [0, 0, 0];
const at = (p) => Math.hypot(p[0], p[1]);
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

describe('spirit onions', () => {
  it('reads a preset or its onions and spikes, and teaches on a bad one', () => {
    expect(readAura('power-up')).toBe(AURAS['power-up']);
    const A = readAura({ onions: { r: 0.5 }, spikes: [{ count: 4 }] });
    expect(A.onions[0]).toMatchObject({ r: 0.5, h: 2.2, petals: 7 });
    expect(A.spikes[0]).toMatchObject({ count: 4, tilt: 35 });
    expect(() => readAura('halo')).toThrow(/not an aura: power-up/);
    expect(() => readAura({ onions: { petals: 1 } })).toThrow(/petals is petals round the shell, 2 to 24/);
    expect(() => readAura({ glow: 1 })).toThrow(/has no glow/);
    expect(() => readAura({})).toThrow(/neither onions nor spikes/);
    expect(new Set(AURA_NAMES.map((n) => auraSignature(AURAS[n]))).size).toBe(AURA_NAMES.length);
  });

  it('rises each petal from a round bulb to a point, widest below its middle', () => {
    const O = AURAS['power-up'].onions[1], P = onionPetals(O, C, 0, 1)[0], mid = P.L.map((p, i) => (at(p) + at(P.R[i])) / 2);
    expect(mid[0]).toBeLessThan(0.02 * O.r);
    expect(mid.at(-1)).toBeLessThan(0.02 * O.r);   // the tip: a point on the axis
    const widest = mid.indexOf(Math.max(...mid));
    expect(widest).toBeGreaterThan(0);
    expect(widest).toBeLessThan(mid.length / 2);
    expect(Math.max(...mid)).toBeCloseTo(O.r * (1 + O.pulse * Math.sin(2 * Math.PI * O.phase)), 1);
    expect(P.L.at(-1)[2]).toBeCloseTo(O.z + O.h * (1 + O.pulse * Math.sin(2 * Math.PI * O.phase)), 5);
  });

  it('spins its shells their own ways at their own rates, and turns its rings at their own intervals', () => {
    const A = AURAS['power-up'];
    expect(new Set(A.onions.map((o) => Math.sign(o.turn))).size).toBe(2);
    expect(new Set(A.onions.map((o) => o.turn)).size).toBe(A.onions.length);
    expect(new Set(A.spikes.map((s) => s.turn)).size).toBe(A.spikes.length);
    for (const O of A.onions) {
      const dt = 0.05, a0 = onionPetals(O, C, 1, 1)[0].a, a1 = onionPetals(O, C, 1 + dt, 1)[0].a;
      expect(a1 - a0).toBeCloseTo(2 * Math.PI * O.turn * dt, 9);
    }
    for (const S of A.spikes) {
      const dt = 0.05, s0 = spikeTips(S, C, 1, 1)[0], s1 = spikeTips(S, C, 1 + dt, 1)[0];
      expect(s1.a - s0.a).toBeCloseTo(2 * Math.PI * S.turn * dt, 9);
      // pointed out and up by its tilt, its length flickering inside its share
      const d = [s0.tip[0] - s0.b[0], s0.tip[1] - s0.b[1], s0.tip[2] - s0.b[2]], len = Math.hypot(...d);
      expect(len).toBeGreaterThanOrEqual(S.len * (1 - S.flick) - 1e-9);
      expect(len).toBeLessThanOrEqual(S.len * (1 + S.flick) + 1e-9);
      expect(Math.asin(d[2] / len) * 180 / Math.PI).toBeCloseTo(S.tilt, 6);
    }
  });

  it('grows from nothing, scales whole, and is the same at the same time', () => {
    const O = AURAS.burst.onions[0];
    expect(onionPetals(O, C, 0.3, 0).every((P) => P.L.every((p) => at(p) < 1e-12))).toBe(true);
    const big = scaleAura(AURAS.burst, 2);
    expect(big.onions[0].r).toBeCloseTo(2 * O.r, 4);
    expect(big.spikes[0].len).toBeCloseTo(2 * AURAS.burst.spikes[0].len, 4);
    expect(big.onions[0].turn).toBe(O.turn);
    expect(JSON.stringify(onionPetals(O, [1, 2, 3], 0.7, 1))).toBe(JSON.stringify(onionPetals(O, [1, 2, 3], 0.7, 1)));
  });

  it('draws in three flat bands, light over the colour over a shade', () => {
    const [l, m, s] = auraBands([1, 0.84, 0.28]);
    expect(luma(l)).toBeGreaterThan(luma(m));
    expect(luma(m)).toBeGreaterThan(luma(s));
  });

  it('is a look\'s layer only when given, and the page draws it only where a look carries one', () => {
    expect(LOOKS['power-up'].aura).toBe(AURAS['power-up']);
    expect('aura' in LOOKS.glow).toBe(false);
    expect(valueSignature(LOOKS['power-up'])).toMatch(/aura 3 onions/);
    expect(readLook({ aura: { spikes: { count: 5 } } }, 'x').aura.spikes[0].count).toBe(5);
    expect(statusScript({ glow: LOOKS.glow })).not.toContain('__mojAura');
    const page = statusScript({ 'power-up': LOOKS['power-up'] });
    expect(page).toContain('__elAU');
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', 'location', `${page}; return 1;`)).not.toThrow();
  });
});
