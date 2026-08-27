import { describe, expect, it } from 'vitest';

import { planBeachScene, assembleBeachScene, BEACH_SCENARIOS } from './beach-view.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

const TAU = Math.PI * 2;

describe('planBeachScene — determinism & spectrum', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planBeachScene({ kind: 'beach-view', scenario: 'swell' });
    const b = planBeachScene({ kind: 'beach-view', scenario: 'swell' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to calm on an unknown sea state', () => {
    expect(planBeachScene({ kind: 'beach-view', scenario: 'tsunami' }).stats.scenario).toBe('calm');
  });

  it('emits one surface carrying a shore descriptor and a buoy floater', () => {
    const plan = planBeachScene({ kind: 'beach-view', scenario: 'swell' });
    expect(plan.surfaces.length).toBe(1);
    const sf = plan.surfaces[0];
    expect(sf.waves.length).toBeGreaterThanOrEqual(3);
    expect(sf.shore).toBeTruthy();
    expect(sf.shore.edgeY).toBeGreaterThan(0);
    expect(sf.shore.surfW).toBeGreaterThan(0);
    expect(sf.floaters.length).toBeGreaterThan(0);
  });

  it('every wave train travels ONSHORE (a unit direction with a positive y component)', () => {
    for (const s of BEACH_SCENARIOS) {
      for (const w of planBeachScene({ kind: 'beach-view', scenario: s }).surfaces[0].waves) {
        expect(Math.hypot(w.dx, w.dy)).toBeCloseTo(1, 9);
        expect(w.dy).toBeGreaterThan(0);
      }
    }
  });

  it('builds a sand wedge: submerged toe below z=0 and a dry berm above it', () => {
    const faces = planBeachScene({ kind: 'beach-view', scenario: 'calm' }).faces;
    expect(faces.length).toBeGreaterThan(50);
    const zs = faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeLessThan(0);   // submerged toe
    expect(Math.max(...zs)).toBeGreaterThan(0); // dry dune
    for (const f of faces) expect(f.fill).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('beach-view — accurate physics', () => {
  it('deep-water dispersion: ω = √(g·k) for every component', () => {
    const waves = planBeachScene({ kind: 'beach-view', scenario: 'surf' }).surfaces[0].waves;
    // k is stored divided by scale (=1 here); ω was computed from the unscaled k, so re-derive g·k via ω.
    for (const w of waves) expect(w.om).toBeCloseTo(Math.sqrt(2.4 * w.k), 6);
  });

  it('longer waves travel FASTER (phase speed ω/k rises with wavelength)', () => {
    const waves = planBeachScene({ kind: 'beach-view', scenario: 'surf' }).surfaces[0].waves;
    const byLambda = waves.map((w) => ({ lam: TAU / w.k, c: w.om / w.k })).sort((a, b) => a.lam - b.lam);
    for (let i = 1; i < byLambda.length; i++) expect(byLambda[i].c).toBeGreaterThan(byLambda[i - 1].c);
  });

  it('Gerstner stays non-looping: Σ Q·k·A < 1', () => {
    for (const s of BEACH_SCENARIOS) {
      const waves = planBeachScene({ kind: 'beach-view', scenario: s }).surfaces[0].waves;
      const sum = waves.reduce((a, w) => a + w.Q * w.k * w.A, 0);
      expect(sum).toBeLessThan(1);
    }
  });

  it('the amplitude knob scales the sea height', () => {
    const calm = planBeachScene({ kind: 'beach-view', scenario: 'swell', amplitude: 0.5 }).stats.maxAmp;
    const rough = planBeachScene({ kind: 'beach-view', scenario: 'swell', amplitude: 2 }).stats.maxAmp;
    expect(rough).toBeGreaterThan(calm * 3);
  });

  it('the still waterline sits at the far edge of the water grid (edgeY = d/2)', () => {
    const plan = planBeachScene({ kind: 'beach-view' });
    const sf = plan.surfaces[0];
    expect(sf.shore.edgeY).toBeCloseTo(sf.grid.d / 2, 6);
  });
});

describe('beach-view registration', () => {
  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'beach-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('assemble threads the surface channel + sand faces with a shore-facing camera', () => {
    const scene = assembleBeachScene({ kind: 'beach-view' }, {});
    expect(scene.surfaces.length).toBe(1);
    expect(scene.faces.length).toBeGreaterThan(50);
    expect(scene.cameras[0].name).toBe('shore');
  });

  it('exposes the three sea states', () => {
    expect(BEACH_SCENARIOS).toEqual(['calm', 'swell', 'surf']);
  });
});
