import { describe, expect, it } from 'vitest';

import {
  planGravityWaveScene, assembleGravityWaveScene, gwState, GRAVITY_WAVE_SCENARIOS,
} from './gravity-wave-view.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

const gwOf = (recipe) => planGravityWaveScene(recipe).surfaces[0].gw;

describe('planGravityWaveScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planGravityWaveScene({ kind: 'gravity-wave-view', scenario: 'merger' });
    const b = planGravityWaveScene({ kind: 'gravity-wave-view', scenario: 'merger' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to inspiral on an unknown scenario', () => {
    expect(planGravityWaveScene({ kind: 'gravity-wave-view', scenario: 'wormhole' }).stats.scenario).toBe('inspiral');
  });

  it('emits one surface in gw mode over a grid (no Gerstner waves / no point sources)', () => {
    const sf = planGravityWaveScene({ kind: 'gravity-wave-view' }).surfaces[0];
    expect(sf.gw && typeof sf.gw === 'object').toBe(true);
    expect(sf.waves).toBeUndefined();
    expect(sf.sources).toBeUndefined();
    expect(sf.grid.nx).toBeGreaterThan(8);
  });

  it('exposes the four membrane scenarios plus the test-mass ring', () => {
    expect(GRAVITY_WAVE_SCENARIOS).toEqual(['inspiral', 'merger', 'neutron-stars', 'extreme-mass-ratio', 'ring']);
  });

  it('the ring scenario renders discrete masses on the deform channel, not a surface', () => {
    const plan = planGravityWaveScene({ kind: 'gravity-wave-view', scenario: 'ring' });
    expect(plan.surfaces).toBeUndefined();
    expect(plan.stats.scenario).toBe('ring');
    expect(plan.faces.some((f) => f.group === 'gwring')).toBe(true);
    // a rotating quadrupole: plus + cross strain in quadrature on the ring group.
    const df = plan.deforms.find((d) => d.group === 'gwring');
    expect(df && df.mode).toBe('wave');
    expect(df.terms).toHaveLength(2);
    expect(Math.abs(df.terms[0].phase - df.terms[1].phase)).toBeCloseTo(Math.PI / 2);
    // assemble threads the deform channel through (and emits no surface).
    const payload = assembleGravityWaveScene({ scenario: 'ring' });
    expect(payload.deforms.length).toBe(1);
    expect(payload.surfaces).toBeUndefined();
  });
});

describe('gravity-wave-view — accurate inspiral physics (gwState)', () => {
  it('chirps: GW frequency RISES monotonically through the inspiral toward merger', () => {
    const g = gwOf({ scenario: 'inspiral' });
    let prev = -Infinity;
    for (let tau = 0; tau < g.tauMerge; tau += 0.02) {
      const fr = gwState(g, tau * g.tLoop).fr;
      expect(fr).toBeGreaterThan(prev);
      prev = fr;
    }
  });

  it('separation SHRINKS as the binary spirals in (a ∝ f^(−2/3))', () => {
    const g = gwOf({ scenario: 'inspiral' });
    const early = gwState(g, 0.1 * g.tLoop).sep;
    const late = gwState(g, 0.7 * g.tLoop).sep;
    expect(late).toBeLessThan(early);
    expect(gwState(g, 0.999 * g.tLoop).sep).toBeLessThan(0.05 * g.sep0); // collapsed to ~0 at the seam
  });

  it('amplitude grows toward merger, peaks, then RINGS DOWN to ~0 at both loop seams', () => {
    const g = gwOf({ scenario: 'merger' });
    const start = gwState(g, 0.001 * g.tLoop).amp;       // fade-in window → ~0
    const mid = gwState(g, 0.5 * g.tLoop).amp;
    const peak = gwState(g, g.tauMerge * g.tLoop).amp;
    const end = gwState(g, 0.999 * g.tLoop).amp;         // ringdown decay → ~0
    expect(mid).toBeGreaterThan(start);
    expect(peak).toBeGreaterThan(mid);
    expect(start).toBeLessThan(peak * 0.15);
    expect(end).toBeLessThan(peak * 0.15);
  });

  it('marks the merger boundary and continues the orbital phase past it', () => {
    const g = gwOf({ scenario: 'inspiral' });
    expect(gwState(g, (g.tauMerge - 0.01) * g.tLoop).merged).toBe(false);
    expect(gwState(g, (g.tauMerge + 0.01) * g.tLoop).merged).toBe(true);
    expect(gwState(g, (g.tauMerge + 0.05) * g.tLoop).phi)
      .toBeGreaterThan(gwState(g, (g.tauMerge + 0.01) * g.tLoop).phi);
  });

  it('loops with period tLoop (state repeats every loop)', () => {
    const g = gwOf({ scenario: 'neutron-stars' });
    const a = gwState(g, 0.3 * g.tLoop);
    const b = gwState(g, 0.3 * g.tLoop + g.tLoop);
    expect(b.phi).toBeCloseTo(a.phi, 9);
    expect(b.sep).toBeCloseTo(a.sep, 9);
  });

  it('chirp mass is heavier for stellar BHs than for neutron stars', () => {
    const bh = gwOf({ scenario: 'inspiral' }).chirpMassMsun;
    const ns = gwOf({ scenario: 'neutron-stars' }).chirpMassMsun;
    expect(bh).toBeGreaterThan(ns);
  });

  it('the extreme-mass-ratio binary keeps the heavy primary near the centre (tiny orbit fraction)', () => {
    const g = gwOf({ scenario: 'extreme-mass-ratio' });
    expect(g.frac1).toBeLessThan(0.001);  // mass1 (heavy) orbit radius fraction → ~0
    expect(g.frac2).toBeGreaterThan(0.99); // mass2 (light) swings the full separation
  });

  it('the amplitude knob scales the strain height', () => {
    const subtle = gwOf({ scenario: 'inspiral', amplitude: 0.5 }).amp0;
    const strong = gwOf({ scenario: 'inspiral', amplitude: 2 }).amp0;
    expect(strong).toBeCloseTo(subtle * 4, 6);
  });
});

describe('gravity-wave-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'gravity-wave-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('assemble threads the surface channel with a top-down spiral camera', () => {
    const scene = assembleGravityWaveScene({ kind: 'gravity-wave-view' }, {});
    expect(scene.surfaces.length).toBe(1);
    expect(scene.surfaces[0].gw).toBeTruthy();
    expect(scene.cameras.map((c) => c.name)).toContain('top');
  });
});
