/**
 * ball-flight fidelity gate — the trajectory is pure numbers, so faithfulness is
 * checkable without rendering. These assert physical ground truth, not just "it runs":
 * integrator correctness vs the vacuum closed form, then the signatures that separate a
 * faithful kick from a parabola (carry/dip/curl, the drag crisis). See ball-flight.plan.md.
 */
import { describe, it, expect } from 'vitest';
import { kickBall, dragCoeff, liftCoeff, reynolds, rps, G } from './ball-flight.js';

const back = (w) => ({ x: 0, y: -w, z: 0 });   // backspin (travel +x) → lift
const top = (w) => ({ x: 0, y: w, z: 0 });    // topspin  → dip
const side = (w) => ({ x: 0, y: 0, z: w });    // sidespin → curl toward +y

describe('integrator correctness (no air → vacuum closed form)', () => {
  const speed = 30, elevationDeg = 40;
  const { summary } = kickBall({ speed, elevationDeg }, { drag: false, spin: false, dt: 0.001 });
  const el = elevationDeg * Math.PI / 180;
  it('range matches v²·sin2θ/g', () => {
    expect(summary.range).toBeCloseTo((speed * speed * Math.sin(2 * el)) / G, 1);
  });
  it('apex matches v²·sin²θ/2g', () => {
    expect(summary.apex).toBeCloseTo((speed * speed * Math.sin(el) ** 2) / (2 * G), 1);
  });
  it('flight time matches 2·v·sinθ/g', () => {
    expect(summary.flightTime).toBeCloseTo((2 * speed * Math.sin(el)) / G, 2);
  });
});

describe('drag', () => {
  it('shortens range vs vacuum', () => {
    const launch = { speed: 30, elevationDeg: 40 };
    const drag = kickBall(launch).summary.range;
    const vac = kickBall(launch, { drag: false, spin: false }).summary.range;
    expect(drag).toBeLessThan(vac);
  });
  it('keeps a hard 45° strike airborne a believable few seconds', () => {
    const { summary } = kickBall({ speed: 30, elevationDeg: 45 });
    expect(summary.flightTime).toBeGreaterThan(2.5);
    expect(summary.flightTime).toBeLessThan(5);
  });
});

describe('drag crisis', () => {
  it('C_d is supercritical when fast, subcritical when slow', () => {
    expect(reynolds(30)).toBeGreaterThan(2e5);     // sanity: launch is in the supercritical regime
    expect(dragCoeff(30)).toBeLessThan(0.25);
    expect(dragCoeff(8)).toBeGreaterThan(0.45);
  });
  it('bites: a strike under the crisis lands shorter + steeper than under constant low drag', () => {
    const launch = { speed: 30, elevationDeg: 14 };          // a flat, hard, low-spin drive
    const crisis = kickBall(launch).summary;
    const constLow = kickBall(launch, { crisis: false }).summary;
    expect(crisis.range).toBeLessThan(constLow.range);       // late drag rise robs carry
    expect(crisis.descentDeg).toBeGreaterThan(constLow.descentDeg);  // and drops it steeper
  });
});

describe('Magnus — spin shapes the flight', () => {
  const base = { speed: 26, elevationDeg: 16 };
  it('backspin carries farther than topspin', () => {
    const b = kickBall({ ...base, spin: back(rps(8)) }).summary;
    const t = kickBall({ ...base, spin: top(rps(8)) }).summary;
    expect(b.range).toBeGreaterThan(t.range);
  });
  it('backspin reaches a higher apex than topspin', () => {
    const b = kickBall({ ...base, spin: back(rps(8)) }).summary;
    const t = kickBall({ ...base, spin: top(rps(8)) }).summary;
    expect(b.apex).toBeGreaterThan(t.apex);
  });
  it('sidespin curls toward +y with a believable magnitude', () => {
    // a strong free-kick spin over ~30 m → a few metres of curl (Goff & Carré free-kick band)
    const { summary } = kickBall({ ...base, spin: side(rps(8)) });
    expect(summary.peakLateral).toBeGreaterThan(0.5);   // it bends...
    expect(summary.peakLateral).toBeLessThan(4.5);      // ...within the real envelope, not absurdly
  });
  it('no spin → no lateral deflection', () => {
    const { summary } = kickBall(base);
    expect(Math.abs(summary.peakLateral)).toBeLessThan(1e-6);
  });
  it('C_l rises with spin and saturates', () => {
    expect(liftCoeff(0)).toBe(0);
    expect(liftCoeff(0.2)).toBeGreaterThan(liftCoeff(0.1));
    expect(liftCoeff(2) - liftCoeff(1)).toBeLessThan(liftCoeff(1) - liftCoeff(0.5)); // diminishing
  });
});
