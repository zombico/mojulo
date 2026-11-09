import { describe, expect, it } from 'vitest';
import { ROTOR, ROTOR_NAMES, hoverRule } from './rotor.js';

// THE ROTORCRAFT'S ENVELOPES (rotor.js): a type's published figures lowered to the hover rule's numbers. One case per
// procedure, chosen in code: a helicopter (its cyclic an attitude) and a drone (its flight controller a speed).
const G = 9.81, D = Math.PI / 180;
const HELI = ROTOR_NAMES.find((k) => !ROTOR[k].hold), DRONE = ROTOR_NAMES.find((k) => ROTOR[k].hold);

describe('the rotorcraft envelopes', () => {
  for (const key of [HELI, DRONE]) {
    it(`${key}: its thrust holds its height at its most tilt; its drag stops it at its top speed there; its spare thrust climbs it at its best rate`, () => {
      const R = ROTOR[key], r = hoverRule(key), W = R.mass * G;
      expect(r.type).toBe('hover');
      expect(r.thrust * Math.cos(r.tiltMax)).toBeGreaterThanOrEqual(W * 0.999);
      expect(r.drag * R.max ** 2).toBeCloseTo(W * Math.tan(R.tilt * D), -1);
      expect(r.dragZ * R.climb ** 2).toBeCloseTo(r.thrust - W, -1);
      expect(!!r.hold).toBe(!!R.hold);
    });
  }
  it('refuses what is not a rotorcraft', () => {
    expect(() => hoverRule('glider')).toThrow(/one of/);
  });
});
