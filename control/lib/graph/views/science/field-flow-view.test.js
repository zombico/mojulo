import { describe, expect, it } from 'vitest';

import {
  planFieldFlowScene, assembleFieldFlowScene, FIELD_FLOW_SCENARIOS,
} from './field-flow-view.js';

describe('planFieldFlowScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planFieldFlowScene({ scenario: 'spiral' });
    const b = planFieldFlowScene({ scenario: 'spiral' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to spiral on an unknown scenario', () => {
    expect(planFieldFlowScene({ scenario: 'wormhole' }).stats.scenario).toBe('spiral');
  });

  it('exposes the five scenarios', () => {
    expect(FIELD_FLOW_SCENARIOS).toEqual(['source', 'sink', 'vortex', 'saddle', 'spiral']);
  });

  it('emits a static arrow field (animate:false), streamlines, drifting beads, and a fixed-point pick', () => {
    const plan = planFieldFlowScene({ scenario: 'spiral' });
    const fd = plan.fields[0];
    expect(fd.animate).toBe(false);
    expect(fd.sets[0].samples.length).toBeGreaterThan(40);
    expect(fd.lines.length).toBeGreaterThan(4);            // streamlines
    expect(plan.tracers.length).toBeGreaterThan(0);        // drifting particles
    expect(plan.picks.some((p) => p.kind === 'fixed-point')).toBe(true);
    // each arrow sample carries a position + a field direction + a length.
    const s = fd.sets[0].samples[0];
    expect(s.pos).toHaveLength(3); expect(s.dir).toHaveLength(3); expect(typeof s.amp).toBe('number');
  });
});

describe('field-flow-view — divergence/curl & eigenvalue classification (the transform-view tie)', () => {
  const stat = (s) => planFieldFlowScene({ scenario: s }).stats;

  it('source: divergence > 0, curl 0, an unstable node', () => {
    const s = stat('source');
    expect(s.div).toBeCloseTo(2); expect(s.curl).toBeCloseTo(0);
    expect(s.type).toMatch(/source/);
  });

  it('sink: divergence < 0, curl 0 (curl-free ⇒ a gradient field), a stable node', () => {
    const s = stat('sink');
    expect(s.div).toBeCloseTo(-2); expect(s.curl).toBeCloseTo(0);
    expect(s.type).toMatch(/sink/);
  });

  it('vortex: divergence 0, curl > 0, a centre with closed orbits', () => {
    const s = stat('vortex');
    expect(s.div).toBeCloseTo(0); expect(s.curl).toBeCloseTo(2);
    expect(s.type).toMatch(/centre/);
  });

  it('saddle: opposite-sign real eigenvalues — the hyperbolic control', () => {
    const s = stat('saddle');
    expect(s.eigenvalues.map(Number).sort((a, b) => a - b)).toEqual([-1, 1]);
    expect(s.type).toMatch(/saddle/);
  });

  it('spiral: complex eigenvalues with negative real part — a spiral sink', () => {
    const s = stat('spiral');
    expect(s.eigenvalues.every((e) => String(e).includes('i'))).toBe(true);
    expect(s.div).toBeLessThan(0);
    expect(s.type).toMatch(/spiral sink/);
  });

  it('an explicit matrix is auto-classified and overrides the scenario preset', () => {
    const s = planFieldFlowScene({ scenario: 'sink', matrix: [[1, 0], [0, 1]] }).stats;
    expect(s.scenario).toBe('custom');
    expect(s.type).toMatch(/source/);   // [[1,0],[0,1]] is an unstable node
  });
});

describe('assembleFieldFlowScene — payload', () => {
  it('threads faces + fields + tracers, top-down camera, no surfaces', () => {
    const payload = assembleFieldFlowScene({ scenario: 'saddle' });
    expect(payload.fields.length).toBe(1);
    expect(payload.tracers.length).toBeGreaterThan(0);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('top');
  });
});
