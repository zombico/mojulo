import { describe, expect, it } from 'vitest';

import { planHydroChain, HYDRO_ETA, HYDRO_DEFAULTS, G, RHO_WATER } from './hydro.js';

const TAU = Math.PI * 2;

describe('planHydroChain — the couplings are the real laws', () => {
  it('Torricelli: the jet runs at v = √(2g·H_eff) with the penstock toll applied', () => {
    const c = planHydroChain({ head: 100, flow: 50 });
    expect(c.headEff).toBeCloseTo(100 * HYDRO_ETA.penstock, 9);
    expect(c.jet.v).toBeCloseTo(Math.sqrt(2 * G * c.headEff), 9);
  });

  it('hydrostatics: toe pressure is P = ρgH', () => {
    const c = planHydroChain({ head: 60 });
    expect(c.pressure.base).toBeCloseTo(RHO_WATER * G * 60, 6);
  });

  it('the power chain is ordered and honestly taxed: hydraulic > mech > elec', () => {
    const c = planHydroChain({ head: 80, flow: 40 });
    expect(c.power.hydraulic).toBeCloseTo(RHO_WATER * G * 40 * 80, 3);
    expect(c.power.mech).toBeLessThan(c.power.hydraulic);
    expect(c.power.elec).toBeLessThan(c.power.mech);
    expect(c.power.elec / c.power.hydraulic).toBeCloseTo(HYDRO_ETA.penstock * HYDRO_ETA.turbine * HYDRO_ETA.generator, 9);
  });

  it('power is linear in both head and flow', () => {
    const base = planHydroChain({ head: 50, flow: 20 }).power.elec;
    expect(planHydroChain({ head: 100, flow: 20 }).power.elec).toBeCloseTo(base * 2, 6);
    expect(planHydroChain({ head: 50, flow: 40 }).power.elec).toBeCloseTo(base * 2, 6);
  });

  it('Pelton maximum power transfer: bucket speed u = v/2, ω = u/R, τ = P_mech/ω', () => {
    const c = planHydroChain({ head: 120, flow: 30, runnerRadius: 2 });
    expect(c.runner.u).toBeCloseTo(c.jet.v / 2, 9);
    expect(c.runner.omega).toBeCloseTo(c.runner.u / 2, 9);
    expect(c.runner.rpm).toBeCloseTo(c.runner.omega * 60 / TAU, 9);
    expect(c.runner.torque).toBeCloseTo(c.power.mech / c.runner.omega, 6);
  });

  it('the jet force follows the momentum turn: F = 2ρQ(v−u) at θ ≈ 180°', () => {
    const c = planHydroChain({ head: 60, flow: 40 });
    expect(c.runner.jetForce).toBeCloseTo(2 * RHO_WATER * 40 * (c.jet.v - c.runner.u), 6);
  });

  it('the generator lands NEAR the grid frequency by choosing pole pairs: f = p·n/60', () => {
    for (const head of [20, 60, 150, 300]) {
      const c = planHydroChain({ head });
      expect(c.generator.f).toBeCloseTo(c.generator.polePairs * c.runner.rpm / 60, 9);
      expect(c.generator.poles).toBe(2 * c.generator.polePairs);
      expect(Math.abs(c.generator.f - 60)).toBeLessThan(12);   // rounding p leaves a small residual
    }
  });

  it('a 50 Hz grid is honoured too', () => {
    const c = planHydroChain({ head: 60, gridHz: 50 });
    expect(Math.abs(c.generator.f - 50)).toBeLessThan(10);
  });

  it('clamps garbage into the honest envelope and falls back to defaults', () => {
    const c = planHydroChain({ head: 'tall', flow: -5, runnerRadius: 99 });
    expect(c.spec.head).toBe(HYDRO_DEFAULTS.head);
    expect(c.spec.flow).toBe(1);
    expect(c.spec.runnerRadius).toBe(4);
  });

  it('deterministic — same spec, byte-identical chain', () => {
    const a = JSON.stringify(planHydroChain({ head: 77, flow: 33 }));
    const b = JSON.stringify(planHydroChain({ head: 77, flow: 33 }));
    expect(a).toBe(b);
  });

  it('a real-plant sanity read: 60 m × 40 m³/s is a ~20 MW plant powering ~10⁴ homes', () => {
    const c = planHydroChain({});
    expect(c.power.elec / 1e6).toBeGreaterThan(15);
    expect(c.power.elec / 1e6).toBeLessThan(25);
    expect(c.homes).toBeGreaterThan(5000);
  });
});
