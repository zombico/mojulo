import { describe, expect, it } from 'vitest';

import { planHeatSphereScene, assembleHeatSphereScene, HEAT_SPHERE_SCENARIOS } from './heat-sphere-view.js';

describe('planHeatSphereScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planHeatSphereScene({ scenario: 'poles' }))).toBe(JSON.stringify(planHeatSphereScene({ scenario: 'poles' })));
  });

  it('falls back to poles on an unknown scenario', () => {
    expect(planHeatSphereScene({ scenario: 'wormhole' }).stats.scenario).toBe('poles');
  });

  it('exposes the four scenarios', () => {
    expect(HEAT_SPHERE_SCENARIOS).toEqual(['poles', 'cap', 'dipole', 'banded']);
  });

  it('emits one heat-sphere spec with a full Legendre coeff array + colormap + geometry', () => {
    const hs = planHeatSphereScene({ scenario: 'poles' }).heatSpheres[0];
    expect(hs.radius).toBeGreaterThan(0);
    expect(hs.nlat).toBeGreaterThan(8);
    expect(hs.coeffs.length).toBe(27);            // l = 0..26
    expect(hs.cold).toHaveLength(3);
    expect(hs.hot).toHaveLength(3);
  });
});

describe('the exact math — Legendre projection of sign(cosθ)', () => {
  // sign(x) is odd, so all even coefficients vanish and the odd ones are the known analytic values:
  // a1 = 3/2, a3 = −7/8, a5 = 11/16. This is the whole physical claim of the view.
  it('bakes the analytic coefficients for the poles profile', () => {
    const a = planHeatSphereScene({ scenario: 'poles' }).heatSpheres[0].coeffs;
    expect(a[0]).toBe(0);
    expect(a[1]).toBeCloseTo(1.5, 4);
    expect(a[2]).toBeCloseTo(0, 4);
    expect(a[3]).toBeCloseTo(-0.875, 4);
    expect(a[5]).toBeCloseTo(0.6875, 4);
  });

  it('equilibrium (a0) is zero for the symmetric poles/dipole/banded profiles, nonzero for the lone hot cap', () => {
    expect(planHeatSphereScene({ scenario: 'poles' }).stats.a0).toBe(0);
    expect(planHeatSphereScene({ scenario: 'dipole' }).stats.a0).toBeCloseTo(0, 3);
    expect(planHeatSphereScene({ scenario: 'banded' }).stats.a0).toBeCloseTo(0, 3);
    expect(planHeatSphereScene({ scenario: 'cap' }).stats.a0).not.toBe(0);   // a hot cap warms the whole ball on average
  });

  it('higher diffusivity shortens the loop end-time (faster diffusion)', () => {
    const slow = planHeatSphereScene({ scenario: 'poles', kappa: 0.5 }).heatSpheres[0];
    const fast = planHeatSphereScene({ scenario: 'poles', kappa: 2 }).heatSpheres[0];
    expect(fast.tSpan).toBeLessThan(slow.tSpan);
  });
});

describe('assembleHeatSphereScene — render payload', () => {
  it('returns the heatSpheres channel + orbit cameras and scales geometry', () => {
    const p = assembleHeatSphereScene({ scenario: 'poles', scale: 2 });
    expect(p.heatSpheres).toHaveLength(1);
    expect(p.faces).toEqual([]);
    expect(p.cameras.length).toBeGreaterThanOrEqual(1);
    const base = planHeatSphereScene({ scenario: 'poles' }).heatSpheres[0].radius;
    expect(p.heatSpheres[0].radius).toBeCloseTo(base * 2, 5);
  });

  it('honors a custom background', () => {
    expect(assembleHeatSphereScene({ scene: { bg: '#123456' } }).bg).toBe('#123456');
  });
});
