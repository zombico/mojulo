import { describe, expect, it } from 'vitest';

import { planDoubleSlitScene, assembleDoubleSlitScene, DOUBLE_SLIT_SCENARIOS } from './double-slit-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planDoubleSlitScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'double', separation: 12 });
    const b = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'double', separation: 12 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to double on an unknown scenario', () => {
    expect(planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'wormhole' }).stats.scenario).toBe('double');
  });

  it('double: a wavefield surface from two FINITE slits (sub-sources), a barrier, and a screen', () => {
    const plan = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'double', separation: 14 });
    expect(plan.surfaces.length).toBe(1);
    expect(plan.surfaces[0].sources.length).toBe(12);   // 2 slits × 6 sub-sources (finite-width apertures)
    expect(plan.surfaces[0].barrierY).toBe(0);
    const groups = new Set(plan.faces.map((f) => f.group));
    expect(groups.has('barrier')).toBe(true);
    expect(groups.has('screen')).toBe(true);
  });

  it('wider slit separation spreads the apertures further apart', () => {
    const span = (sep) => { const s = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'double', separation: sep }).surfaces[0].sources; return s[s.length - 1][0] - s[0][0]; };
    expect(span(24)).toBeGreaterThan(span(10));
  });
});

describe('double-slit-view — interference physics', () => {
  // screen-band brightness profile (faces emitted left→right in x), as a [0..1] intensity proxy.
  const profile = (recipe) => {
    const b = planDoubleSlitScene({ kind: 'double-slit-view', ...recipe }).faces
      .filter((f) => f.group === 'screen').map((f) => parseInt(f.fill.slice(1, 3), 16) + parseInt(f.fill.slice(3, 5), 16) + parseInt(f.fill.slice(5, 7), 16) - 64);
    const hi = Math.max(...b) || 1; return b.map((v) => v / hi);
  };
  const peaks = (p, thresh) => { let n = 0; for (let i = 1; i < p.length - 1; i++) if (p[i] > p[i - 1] && p[i] >= p[i + 1] && p[i] > thresh) n++; return n; };

  it('single slit is a single broad central maximum (the diffraction envelope)', () => {
    const p = profile({ scenario: 'single' });
    const mid = Math.floor(p.length / 2);
    expect(peaks(p, 0.5)).toBe(1);                                          // one dominant maximum
    expect(Math.max(...p.slice(mid - 2, mid + 3))).toBeGreaterThan(0.9);    // brightest at the centre
    expect(p.filter((v) => v > 0.5).length).toBeGreaterThan(6);             // and it is BROAD (a wide envelope)
  });

  it('double slit makes multiple fringes — more peaks than the single slit', () => {
    // the strong envelope dims the outer fringes, so count at a low threshold where they register.
    expect(peaks(profile({ scenario: 'double' }), 0.15)).toBeGreaterThan(peaks(profile({ scenario: 'single' }), 0.15));
  });

  it('sinc² ENVELOPE: the double-slit fringes FADE toward the screen edges (outer < central)', () => {
    const p = profile({ scenario: 'double' });
    const mid = Math.floor(p.length / 2), q = Math.floor(p.length / 8);
    const centralMax = Math.max(...p.slice(mid - q, mid + q));
    const edgeMax = Math.max(...p.slice(0, q), ...p.slice(p.length - q));
    expect(edgeMax).toBeLessThan(centralMax * 0.85);   // the envelope attenuates the outer fringes
  });

  it('particles: landings are a progressive BUILDUP point cloud (no live surface, with a readout)', () => {
    const plan = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'particles' });
    expect(plan.surfaces.length).toBe(0);
    expect(plan.buildups.length).toBe(1);
    expect(plan.buildups[0].positions.length / 3).toBeGreaterThan(100);
    expect(plan.tracers.length).toBe(2);   // incoming particles toward the two slits
    expect(plan.fields[0].readout.length).toBeGreaterThan(2);
  });

  it('the buildup hits cluster toward the bright fringes (non-uniform along the screen)', () => {
    const pos = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'particles' }).buildups[0].positions;
    const xs = []; for (let i = 0; i < pos.length; i += 3) xs.push(pos[i]);
    const bins = new Array(14).fill(0); const lo = Math.min(...xs), hi = Math.max(...xs);
    for (const x of xs) bins[Math.min(13, Math.floor((x - lo) / (hi - lo + 1e-9) * 14))]++;
    const mean = xs.length / 14, varc = bins.reduce((a, b) => a + (b - mean) ** 2, 0) / 14;
    expect(varc).toBeGreaterThan(mean);   // clustered, not uniform
  });

  it('the buildup arrival order is scrambled (not a left-to-right sweep)', () => {
    const pos = planDoubleSlitScene({ kind: 'double-slit-view', scenario: 'particles' }).buildups[0].positions;
    // consecutive revealed dots jump around in x (mean |Δx| is a large fraction of the screen width).
    let jump = 0, n = 0; for (let i = 3; i < pos.length; i += 3) { jump += Math.abs(pos[i] - pos[i - 3]); n++; }
    expect(jump / n).toBeGreaterThan(8);
  });
});

describe('double-slit-view registration', () => {
  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'double-slit-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('assemble threads the wavefield surface + a 3/4 camera, glow off', () => {
    const scene = assembleDoubleSlitScene({ kind: 'double-slit-view' }, {});
    expect(scene.glow).toBe(false);
    expect(scene.surfaces.length).toBe(1);
    expect(scene.cameras[0].name).toBe('3/4');
  });

  it('exposes the three scenarios', () => {
    expect(DOUBLE_SLIT_SCENARIOS).toEqual(['double', 'single', 'particles']);
  });
});
