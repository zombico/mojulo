/**
 * airplane fidelity gate — flight.js/rocket.js doctrine: physical ground truth first (the
 * lift/drag polar, stall shape, four-force balance), then the telemetry envelopes that
 * separate a faithful A320-class flight from a cartoon: rotation speed and ground roll,
 * the held cruise, the 3° approach, a soft touchdown, and the ~15-17:1 deadstick glide.
 * Envelope sources: Airbus/CFM published specs + standard performance references.
 */
import { describe, it, expect } from 'vitest';
import { flyAirplane, resolveAircraft, liftCoeff, dragCoeff, AIRCRAFT } from './airplane.js';

const DEG = Math.PI / 180;
const hop = flyAirplane({ mission: 'hop' });
const glide = flyAirplane({ mission: 'glide' });
const ac = resolveAircraft('a320');
const W = ac.mass * 9.80665;

describe('the polar', () => {
  it('C_L is linear to the stall, peaks in the published clean band (1.4–1.8), then droops', () => {
    const clMax = liftCoeff(ac.alphaStall, ac.configs.clean, ac);
    expect(clMax).toBeGreaterThan(1.4);
    expect(clMax).toBeLessThan(1.8);
    expect(liftCoeff(ac.alphaStall + 5 * DEG, ac.configs.clean, ac)).toBeLessThan(clMax);
  });
  it('flaps shift the curve up and the stall down', () => {
    expect(liftCoeff(8 * DEG, ac.configs.landing, ac)).toBeGreaterThan(liftCoeff(8 * DEG, ac.configs.clean, ac));
    expect(ac.configs.landing.dstall).toBeLessThan(0);
  });
  it('induced drag grows with C_L² and gear/spoilers pay real drag', () => {
    const d0 = dragCoeff(0.3, ac.configs.clean, ac);
    const d1 = dragCoeff(1.2, ac.configs.clean, ac);
    expect(d1 - d0).toBeCloseTo((1.2 * 1.2 - 0.3 * 0.3) / (Math.PI * ac.AR * ac.e), 5);
    expect(dragCoeff(0.3, ac.configs.clean, ac, { gear: true, spoilers: true })).toBeGreaterThan(d1);
  });
});

describe('registry', () => {
  it('refuses unknown aircraft and impossible specs; custom inherits a320 fields', () => {
    expect(() => resolveAircraft('spitfire')).toThrow(/registry/);
    expect(() => resolveAircraft({ mass: -1 })).toThrow(/positive/);
    const c = resolveAircraft({ label: 'heavy', mass: 90000 });
    expect(c.S).toBe(AIRCRAFT.a320.S);
    expect(c.mass).toBe(90000);
  });
});

describe('the hop (takeoff → cruise → landing) telemetry envelope', () => {
  const e = hop.events;
  it('rotates in the published Vr band (70–85 m/s) after a plausible ground roll (1000–2200 m)', () => {
    expect(hop.summary.Vr).toBeGreaterThan(70); expect(hop.summary.Vr).toBeLessThan(85);
    expect(e.liftoff.groundRoll).toBeGreaterThan(1000);
    expect(e.liftoff.groundRoll).toBeLessThan(2200);
  });
  it('holds the cruise: altitude within 150 m of target, lift ≈ weight (the four-force lesson)', () => {
    const cs = hop.samples.filter((s) => s.phase === 'cruise');
    const mid = cs[Math.floor(cs.length / 2)];
    expect(Math.abs(mid.z - 2400)).toBeLessThan(150);
    expect(mid.lift / W).toBeGreaterThan(0.93);
    expect(mid.lift / W).toBeLessThan(1.07);
  });
  it('flies the standard approach: mean path angle −3.6°…−2.5°, gear down, landing flaps', () => {
    const ap = hop.samples.filter((s) => s.phase === 'approach');
    const mean = ap.reduce((a, s) => a + s.gamma, 0) / ap.length / DEG;
    expect(mean).toBeGreaterThan(-3.6); expect(mean).toBeLessThan(-2.5);
    expect(ap.every((s) => s.gear)).toBe(true);
    expect(ap.every((s) => s.config === 'landing')).toBe(true);
  });
  it('touches down softly (< 2.5 m/s sink) and stops on the runway (< 2500 m rollout)', () => {
    expect(e.touchdown.sink).toBeLessThan(2.5);
    expect(e.stop.rolloutLen).toBeLessThan(2500);
  });
  it('never exceeds the stall angle in a nominal flight', () => {
    expect(hop.samples.some((s) => s.alpha > ac.alphaStall)).toBe(false);
  });
});

describe('the glide (engines out at cruise) telemetry envelope', () => {
  const e = glide.events;
  it('the engines actually quit, and everything after is thrustless', () => {
    expect(e.enginesOut).toBeTruthy();
    const after = glide.samples.filter((s) => s.t > e.enginesOut.t + 1);
    expect(after.every((s) => s.thrust === 0)).toBe(true);
  });
  it('glide ratio sits in the published narrowbody band (14–19 : 1)', () => {
    expect(glide.summary.glideRatio).toBeGreaterThan(14);
    expect(glide.summary.glideRatio).toBeLessThan(19);
  });
  it('the deadstick rides a steeper path than the powered approach — it cannot hold 3°', () => {
    const meanG = (r) => { const ap = r.samples.filter((s) => s.phase === 'approach'); return ap.reduce((a, s) => a + s.gamma, 0) / ap.length; };
    expect(meanG(glide)).toBeLessThan(meanG(hop));
  });
  it('the high flare still arrives survivable (< 3 m/s sink) by trading speed for lift', () => {
    expect(e.flare.sink).toBeGreaterThan(5);        // it comes down HARD before the flare…
    expect(e.touchdown.sink).toBeLessThan(3);       // …and the energy trade saves it
    expect(e.flare.v).toBeGreaterThan(glide.events.touchdown.v);
  });
});

describe('identities and dials', () => {
  it('deterministic: same spec → identical flight', () => {
    const again = flyAirplane({ mission: 'hop' });
    expect(again.events.touchdown.t).toBe(hop.events.touchdown.t);
    expect(again.samples.length).toBe(hop.samples.length);
  });
  it('drag:false shortens the takeoff roll — the ablation isolates the air', () => {
    expect(flyAirplane({ mission: 'hop', drag: false }).events.liftoff.groundRoll)
      .toBeLessThan(hop.events.liftoff.groundRoll);
  });
  it('a heavier ship rotates faster and rolls longer (W in the stall speed)', () => {
    const heavy = flyAirplane({ mission: 'hop', aircraft: { mass: 78000 } });
    expect(heavy.summary.Vr).toBeGreaterThan(hop.summary.Vr);
    expect(heavy.events.liftoff.groundRoll).toBeGreaterThan(hop.events.liftoff.groundRoll);
  });
});
