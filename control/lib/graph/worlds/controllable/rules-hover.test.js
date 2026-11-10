import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { ROTOR, hoverRule } from '../../skyscape/rotor.js';

// THE HOVER RULE (rules-hover.js, opt-in): a rotorcraft held up by its rotors' thrust along its disc and moved by
// tilting it, at its type's envelope (skyscape/rotor.js). One case per procedure, chosen from the table in code: a
// helicopter's cyclic (an attitude, let go it coasts) and a drone's flight controller (a speed, let go it brakes).
// The concept: it holds its height; full cyclic brings it to its top speed holding its height; the collective climbs it
// at its best rate; a turn at speed is coordinated (it holds its height, keeps its way); it settles on the ground.

const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const HELI = Object.keys(ROTOR).find((k) => !ROTOR[k].hold), DRONE = Object.keys(ROTOR).find((k) => ROTOR[k].hold);
function fly(key, z = 50) {
  const w = E.createWorld({ entities: [{ id: 'h', pilotable: true, rule: hoverRule(key), body: { type: 'none' }, transform: { pos: [0, 0, z], heading: 0, pitch: 0 } }] });
  return { w, h: w.byId.h };
}
const run = (w, s, input = {}) => { for (let i = 0; i < Math.round(s * 60); i++) E.stepWorld(w, input, DT, hooks); };

describe('the hover rule', () => {
  for (const key of [HELI, DRONE]) {
    const R = ROTOR[key];
    it(`${key}: it hovers, and at full cyclic comes to its top speed (${R.max} m/s) holding its height`, () => {
      const { w, h } = fly(key);
      run(w, 3);
      expect(h.transform.pos[2]).toBeCloseTo(50, 2);
      expect(h.airspeed).toBeLessThan(1e-6);
      run(w, 60, { forward: 1 });
      expect(h.airspeed / R.max).toBeGreaterThan(0.95);
      expect(h.airspeed / R.max).toBeLessThan(1.05);
      expect(h.transform.pos[2]).toBeCloseTo(50, 0);
      // (the disc tilted forward: its nose down, by no more than its most)
      expect(h.transform.pitch).toBeLessThan(0);
      expect(-h.transform.pitch).toBeLessThanOrEqual(R.tilt * Math.PI / 180 + 1e-3);
    });
    it(`${key}: the collective climbs it at its best rate (${R.climb} m/s)`, () => {
      const { w, h } = fly(key);
      run(w, 15, { lift: 1 });
      expect(h.climbRate / R.climb).toBeGreaterThan(0.95);
      expect(h.climbRate / R.climb).toBeLessThan(1.02);
    });
    it(`${key}: a turn at speed is coordinated: banked into it, holding its height, keeping most of its way`, () => {
      const { w, h } = fly(key);
      run(w, 40, { forward: 1 });
      run(w, 20, { forward: 1, turn: 1 });
      expect(h.bank).toBeGreaterThan(0.05);
      expect(h.transform.heading).not.toBeCloseTo(0, 1);
      expect(h.transform.pos[2]).toBeCloseTo(50, 0);
      expect(h.airspeed / R.max).toBeGreaterThan(0.7);
    });
  }
  it('let go, a drone brakes to a hover; a helicopter\'s disc levels and it coasts on its drag', () => {
    const d = fly(DRONE), c = fly(HELI);
    for (const x of [d, c]) { run(x.w, 30, { forward: 1 }); run(x.w, 5); }
    expect(d.h.airspeed).toBeLessThan(0.5);
    expect(c.h.airspeed).toBeGreaterThan(0.25 * ROTOR[HELI].max);
    expect(c.h.transform.pitch).toBeCloseTo(0, 3);
  });
  it('it settles on the ground: its touchdown and the speed it met it at', () => {
    const { w, h } = fly(DRONE, 6);
    let td = false, impact = 0;
    for (let i = 0; i < 600; i++) { E.stepWorld(w, { lift: -1 }, DT, hooks); if (h.touchdown) { td = true; impact = h.impact; } }
    expect(td).toBe(true);
    expect(impact).toBeGreaterThan(0);
    expect(impact).toBeLessThanOrEqual(ROTOR[DRONE].descent + 0.5);
    expect(h.transform.pos[2]).toBe(0);
    expect(h.airborne).toBe(false);
  });
  it('out of its bound, it is turned back toward the centre', () => {
    const w = E.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { ...hoverRule(HELI), bound: { hx: 50, hy: 50, warn: 1 } }, body: { type: 'none' }, transform: { pos: [60, 0, 50], heading: 0, pitch: 0 } }] });
    run(w, 6);
    expect(Math.abs(w.byId.h.transform.heading)).toBeGreaterThan(2);
  });
  it('absent, nothing: a page without a rotorcraft is emitted without the rule', () => {
    expect(emissionSource({})).not.toMatch(/buildRulesHover/);
    expect(emissionSource({ hover: true })).toMatch(/buildRulesHover/);
  });
  it('deterministic: the same hands, the same flight', () => {
    const a = fly(HELI), b = fly(HELI), hands = (i) => ({ forward: Math.sin(i / 40), turn: Math.cos(i / 70), lift: Math.sin(i / 90) });
    for (let i = 0; i < 600; i++) { E.stepWorld(a.w, hands(i), DT, hooks); E.stepWorld(b.w, hands(i), DT, hooks); }
    expect(a.h.transform).toEqual(b.h.transform);
    expect(a.h.vel).toEqual(b.h.vel);
  });
});
