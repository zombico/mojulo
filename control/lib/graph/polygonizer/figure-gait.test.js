import { describe, it, expect } from 'vitest';
import { gait, WALK_DEFAULTS } from './figure-posing.js';
import { articulate } from './figure-vajra.js';

const SAMPLES = 60;
const sample = (move, fn) => Array.from({ length: SAMPLES }, (_, i) => fn(move(i / SAMPLES), i / SAMPLES));

describe('figure-posing — gait (formalized walk)', () => {
  const walk = gait();

  it('balances on both feet every frame — no single-foot commit that would warp the stance', () => {
    const supports = new Set(sample(walk, (d) => d.support));
    expect([...supports]).toEqual(['both']);          // both feet anchor the balance solve throughout
  });

  it('lists weight gently toward the bearing leg, bounded by weightShift (no over-commit past the foot)', () => {
    expect(walk(0.25).weight).toBeLessThan(-0.1);                 // over the left leg at its mid-stance
    expect(walk(0.75).weight).toBeGreaterThan(0.1);              // over the right leg at its mid-stance
    const peak = Math.max(...sample(walk, (d) => Math.abs(d.weight)));
    expect(peak).toBeLessThanOrEqual(WALK_DEFAULTS.weightShift + 1e-9);   // never beyond the dial → no lurch
  });

  it('swings the legs in antiphase (left forward ⇒ right back) with the arms counter-swinging', () => {
    const d = walk(0);                                 // left leg fully forward
    expect(d.hipL.pitch).toBeGreaterThan(0);           // left thigh forward
    expect(d.hipR.pitch).toBeLessThan(0);              // right thigh back
    expect(Math.sign(d.shL.pitch)).toBe(-Math.sign(d.hipL.pitch));   // left arm opposes the left leg
  });

  it('lifts the swing foot clear of the planted foot (each leg swings in turn)', () => {
    const r = articulate(walk(0.25));                  // right leg swinging → right foot up
    expect(r.ankleR.z).toBeGreaterThan(r.ankleL.z + 0.01);
    const l = articulate(walk(0.75));                  // left leg swinging → left foot up
    expect(l.ankleL.z).toBeGreaterThan(l.ankleR.z + 0.01);
  });

  it('stride scales the hip swing amplitude', () => {
    const small = gait({ strideLength: 0.2 });
    const big = gait({ strideLength: 0.5 });
    const amp = (m) => Math.max(...sample(m, (d) => Math.abs(d.hipL.pitch)));
    expect(amp(big)).toBeGreaterThan(amp(small));
  });

  it('is cyclic — phase 0 and phase 1 coincide so the GIF tiles seamlessly', () => {
    const a = walk(0), b = walk(1);
    expect(b.hipL.pitch).toBeCloseTo(a.hipL.pitch, 6);
    expect(b.kneeR).toBeCloseTo(a.kneeR, 6);
    expect(b.spine.axial).toBeCloseTo(a.spine.axial, 6);
  });

  it('cadence packs multiple strides into one loop', () => {
    const two = gait({ cadence: 2 });
    // two strides per loop ⇒ the half-loop point matches the full single-stride loop point
    expect(two(0.5).hipL.pitch).toBeCloseTo(gait()(1).hipL.pitch, 6);
  });

  it('drives a swing amplitude set by the stride, with the knee reproducing the canonical lift', () => {
    const d = walk(0);
    const theta = Math.asin(WALK_DEFAULTS.strideLength / (2 * 0.45)) * 180 / Math.PI;   // legLen ≈ 0.45
    expect(Math.abs(d.hipL.pitch)).toBeCloseTo(theta, 0);    // hip swing follows strideLength
    expect(d.kneeL).toBeCloseTo(WALK_DEFAULTS.stanceKnee, 6);
    expect(Math.max(...sample(walk, (x) => x.kneeL))).toBeCloseTo(WALK_DEFAULTS.stanceKnee + WALK_DEFAULTS.swingLift, 0);
  });

  it('plants the stance foot (vault) and rolls the ankle heel-strike → toe-off', () => {
    const ok = sample(walk, (d) => d.plant).every((p) => p && p.L >= 0 && p.L <= 1 && p.R >= 0 && p.R <= 1);
    expect(ok).toBe(true);                                    // emits per-foot plantedness for the vault
    expect(walk(0.25).plant.L).toBeCloseTo(1, 2);            // left foot fully planted at its mid-stance
    expect(walk(0.75).plant.L).toBeLessThan(0.2);            // …and lifted (swinging) half a cycle later
    expect(walk(0).ankleL).toBeGreaterThan(0);               // dorsiflexed at heel-strike (toe up)
    expect(walk(0.5).ankleL).toBeLessThan(0);                // plantarflexed at toe-off (toe down)
    expect(gait({ vault: false })(0.25).plant).toBeUndefined();   // opt-out → no plant channel
  });

  it('rolls the toes (MTP) up over the ball at toe-off, relaxed elsewhere', () => {
    expect(walk(0.5).toeL).toBeGreaterThan(10);              // left toe-off (late stance) → toes break up
    expect(walk(0).toeL).toBeLessThan(1);                   // heel-strike → toes flat
    expect(walk(0.25).toeL).toBeLessThan(1);                // mid-stance → toes flat
  });
});
