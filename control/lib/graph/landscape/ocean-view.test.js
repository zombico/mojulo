import { describe, expect, it } from 'vitest';

import { planOceanScene, assembleOceanScene, OCEAN_SCENARIOS } from './ocean-view.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

const TAU = Math.PI * 2;

describe('planOceanScene — determinism & spectrum', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planOceanScene({ kind: 'ocean-view', scenario: 'storm' });
    const b = planOceanScene({ kind: 'ocean-view', scenario: 'storm' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to swell on an unknown sea state', () => {
    expect(planOceanScene({ kind: 'ocean-view', scenario: 'tsunami' }).stats.scenario).toBe('swell');
  });

  it('emits one surface with a waveform sequence and buoy floaters', () => {
    const plan = planOceanScene({ kind: 'ocean-view', scenario: 'swell' });
    expect(plan.surfaces.length).toBe(1);
    const sf = plan.surfaces[0];
    expect(sf.waves.length).toBeGreaterThanOrEqual(4);
    expect(sf.floaters.length).toBeGreaterThan(0);
    expect(sf.grid.nx).toBeGreaterThan(8);
  });

  it('each wave has a unit direction', () => {
    for (const w of planOceanScene({ kind: 'ocean-view', scenario: 'chop' }).surfaces[0].waves) {
      expect(Math.hypot(w.dx, w.dy)).toBeCloseTo(1, 9);
    }
  });
});

describe('ocean-view — accurate physics', () => {
  it('deep-water dispersion: ω = √(g·k) for every component', () => {
    const waves = planOceanScene({ kind: 'ocean-view', scenario: 'storm' }).surfaces[0].waves;
    for (const w of waves) expect(w.om).toBeCloseTo(Math.sqrt(2.2 * w.k), 6);
  });

  it('longer waves travel FASTER (phase speed ω/k rises with wavelength)', () => {
    const waves = planOceanScene({ kind: 'ocean-view', scenario: 'storm' }).surfaces[0].waves;
    const byLambda = waves.map((w) => ({ lam: TAU / w.k, c: w.om / w.k })).sort((a, b) => a.lam - b.lam);
    for (let i = 1; i < byLambda.length; i++) expect(byLambda[i].c).toBeGreaterThan(byLambda[i - 1].c);
  });

  it('Gerstner stays non-looping: Σ Q·k·A < 1', () => {
    for (const s of OCEAN_SCENARIOS) {
      const waves = planOceanScene({ kind: 'ocean-view', scenario: s }).surfaces[0].waves;
      const sum = waves.reduce((a, w) => a + w.Q * w.k * w.A, 0);
      expect(sum).toBeLessThan(1);
    }
  });

  it('the amplitude knob scales the sea height', () => {
    const calm = planOceanScene({ kind: 'ocean-view', scenario: 'swell', amplitude: 0.5 }).stats.maxAmp;
    const rough = planOceanScene({ kind: 'ocean-view', scenario: 'swell', amplitude: 2 }).stats.maxAmp;
    expect(rough).toBeGreaterThan(calm * 3);
  });
});

describe('ocean-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'ocean-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('assemble threads the surface channel with an across-the-water camera', () => {
    const scene = assembleOceanScene({ kind: 'ocean-view' }, {});
    expect(scene.surfaces.length).toBe(1);
    expect(scene.cameras[0].name).toBe('across');
  });

  it('exposes the three sea states', () => {
    expect(OCEAN_SCENARIOS).toEqual(['swell', 'chop', 'storm']);
  });
});
