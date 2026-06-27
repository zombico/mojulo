import { describe, expect, it } from 'vitest';

import {
  planParallelTransportScene, assembleParallelTransportScene, PARALLEL_TRANSPORT_SCENARIOS,
} from './parallel-transport-view.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

const trOf = (recipe) => planParallelTransportScene(recipe).transports[0];

describe('planParallelTransportScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planParallelTransportScene({ kind: 'parallel-transport-view', scenario: 'foucault' });
    const b = planParallelTransportScene({ kind: 'parallel-transport-view', scenario: 'foucault' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to sphere-triangle on an unknown scenario', () => {
    expect(planParallelTransportScene({ scenario: 'klein-bottle' }).stats.scenario).toBe('sphere-triangle');
  });

  it('emits one transport with a closed loop and a transported vector per loop point', () => {
    const tr = trOf({ scenario: 'sphere-triangle' });
    expect(tr.loop.length).toBeGreaterThan(10);
    expect(tr.vectors.length).toBe(tr.loop.length);
    expect(tr.breadcrumbs.length).toBeGreaterThan(4);
    // loop is closed: first and last render points coincide.
    expect(tr.loop[0].map((v) => +v.toFixed(6))).toEqual(tr.loop[tr.loop.length - 1].map((v) => +v.toFixed(6)));
  });

  it('exposes the four scenarios', () => {
    expect(PARALLEL_TRANSPORT_SCENARIOS).toEqual(['sphere-triangle', 'foucault', 'berry', 'flat-plane']);
  });
});

describe('parallel-transport-view — the holonomy physics', () => {
  it('the carried vector stays a UNIT tangent to the sphere all the way round', () => {
    const tr = trOf({ scenario: 'foucault', latitude: 40 });
    for (let i = 0; i < tr.loop.length; i++) {
      const p = tr.loop[i], v = tr.vectors[i];
      expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 6);                     // unit
      const pn = [p[0] / tr.R, p[1] / tr.R, p[2] / tr.R];
      expect(pn[0] * v[0] + pn[1] * v[1] + pn[2] * v[2]).toBeCloseTo(0, 5);       // tangent (⊥ radius)
    }
  });

  it('Gauss–Bonnet: the holonomy equals the enclosed solid angle (independent computation)', () => {
    for (const scenario of ['sphere-triangle', 'foucault', 'berry']) {
      const tr = trOf({ scenario });
      // holonomy (from transport integration) vs predicted (from the solid-angle formula), in degrees.
      expect(Math.abs(tr.holonomyDeg)).toBeCloseTo(Math.abs(tr.predictedDeg), 0);
    }
  });

  it('the spherical triangle of three right angles has a 90° holonomy', () => {
    expect(Math.abs(trOf({ scenario: 'sphere-triangle' }).holonomyDeg)).toBeCloseTo(90, 0);
  });

  it('the latitude-circle holonomy matches 2π(1 − sin λ) — the Foucault cap solid angle', () => {
    const lat = 30, tr = trOf({ scenario: 'foucault', latitude: lat });
    const expectedDeg = (2 * Math.PI * (1 - Math.sin(lat * Math.PI / 180))) * 180 / Math.PI;
    expect(Math.abs(tr.solidAngleSr) * 180 / Math.PI).toBeCloseTo(expectedDeg, 0);
  });

  it('a FLAT plane has zero holonomy — the arrow returns unchanged', () => {
    const tr = trOf({ scenario: 'flat-plane' });
    expect(tr.holonomyDeg).toBe(0);
    expect(tr.startDir).toEqual(tr.endDir);
  });

  it('higher latitude (smaller enclosed cap toward the pole) gives a larger ground precession framing', () => {
    // sanity: enclosed solid angle SHRINKS as the loop tightens toward the pole.
    const lo = Math.abs(trOf({ scenario: 'foucault', latitude: 20 }).solidAngleSr);
    const hi = Math.abs(trOf({ scenario: 'foucault', latitude: 70 }).solidAngleSr);
    expect(hi).toBeLessThan(lo);
  });
});

describe('parallel-transport-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'parallel-transport-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('assemble threads the transport channel + the surface faces', () => {
    const scene = assembleParallelTransportScene({ kind: 'parallel-transport-view' }, {});
    expect(scene.transports.length).toBe(1);
    expect(scene.faces.length).toBeGreaterThan(0);
    expect(scene.cameras.map((c) => c.name)).toContain('3/4');
  });
});
