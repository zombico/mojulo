import { describe, expect, it } from 'vitest';

import { planFieldScene, assembleFieldScene, FIELD_SCENARIOS } from './field-view.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('planFieldScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planFieldScene({ kind: 'field-view', scenario: 'bar-magnet' });
    const b = planFieldScene({ kind: 'field-view', scenario: 'bar-magnet' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to em-wave on an unknown scenario', () => {
    expect(planFieldScene({ kind: 'field-view', scenario: 'tachyon' }).stats.scenario).toBe('em-wave');
  });

  it('every scenario emits a field with a readout', () => {
    for (const s of FIELD_SCENARIOS) {
      const plan = planFieldScene({ kind: 'field-view', scenario: s });
      expect(plan.fields.length).toBe(1);
      expect(Array.isArray(plan.fields[0].readout) && plan.fields[0].readout.length).toBeTruthy();
    }
  });

  it('assemble frames side-first with glow off and threads the field channel', () => {
    const scene = assembleFieldScene({ kind: 'field-view', scenario: 'em-wave' }, {});
    expect(scene.glow).toBe(false);
    expect(scene.cameras[0].name).toBe('side');
    expect(scene.fields.length).toBe(1);
  });
});

describe('em-wave — accurate structure', () => {
  const fd = planFieldScene({ kind: 'field-view', scenario: 'em-wave' }).fields[0];
  const [E, B] = fd.sets;

  it('is animated and carries two moving curve sets (E and B)', () => {
    expect(fd.animate).toBe(true);
    expect(fd.omega).toBeGreaterThan(0);
    expect(E.curve && B.curve).toBe(true);
  });

  it('E ⊥ B and both ⊥ the propagation axis (x)', () => {
    const eDir = E.samples[0].dir, bDir = B.samples[0].dir, prop = [1, 0, 0];
    expect(Math.abs(dot(eDir, bDir))).toBeLessThan(1e-9);     // E ⊥ B
    expect(Math.abs(dot(eDir, prop))).toBeLessThan(1e-9);     // E ⊥ travel
    expect(Math.abs(dot(bDir, prop))).toBeLessThan(1e-9);     // B ⊥ travel
  });

  it('E and B oscillate IN PHASE (same phase0 at every station)', () => {
    for (let i = 0; i < E.samples.length; i++) expect(E.samples[i].phase0).toBeCloseTo(B.samples[i].phase0, 12);
  });
});

describe('magnetism — static fields + analytic direction', () => {
  it('bar-magnet: static needles + dipole field lines + pickable poles', () => {
    const plan = planFieldScene({ kind: 'field-view', scenario: 'bar-magnet' });
    expect(plan.fields[0].animate).toBe(false);
    expect(plan.fields[0].lines.length).toBeGreaterThan(0);
    expect(plan.picks.map((p) => p.name).sort()).toEqual(['magnet:n', 'magnet:s']);
    // a needle on the +z axis (above the N pole) points roughly along +z (out of the pole).
    const needles = plan.fields[0].sets[0].samples;
    const top = needles.reduce((best, s) => (s.pos[2] > best.pos[2] && Math.abs(s.pos[0]) < 1 && Math.abs(s.pos[1]) < 1 ? s : best), needles[0]);
    expect(top.dir[2]).toBeGreaterThan(0.5);
  });

  it('wire: B needles are tangential (perpendicular to the radius) — the right-hand circulation', () => {
    const plan = planFieldScene({ kind: 'field-view', scenario: 'wire' });
    const needle = plan.fields[0].sets[0].samples[0];
    const radial = [needle.pos[0], needle.pos[1], 0];
    expect(Math.abs(dot(needle.dir, radial))).toBeLessThan(1e-6);   // B ⊥ r̂ (azimuthal)
  });

  it('solenoid: interior arrows are uniform along the bore axis (+z), with a pickable coil', () => {
    const plan = planFieldScene({ kind: 'field-view', scenario: 'solenoid' });
    const interior = plan.fields[0].sets[0].samples;
    expect(interior.every((s) => s.dir[2] === 1 && s.dir[0] === 0)).toBe(true);
    expect(plan.picks.some((p) => p.name === 'solenoid')).toBe(true);
  });
});

describe('field-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'field-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the four scenarios', () => {
    expect(FIELD_SCENARIOS).toEqual(['em-wave', 'bar-magnet', 'wire', 'solenoid']);
  });
});
