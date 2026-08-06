import { describe, expect, it } from 'vitest';

import { planWindmillScene, assembleWindmillScene, WINDMILL_SCENARIOS } from './windmill-view.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

describe('planWindmillScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine', wind: 10 });
    const b = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine', wind: 10 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to turbine on an unknown type', () => {
    expect(planWindmillScene({ kind: 'windmill-view', scenario: 'jetpack' }).stats.scenario).toBe('turbine');
  });

  it('emits a static tower/ground + a spinning rotor + wind flow', () => {
    const plan = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine' });
    const groups = new Set(plan.faces.map((f) => f.group));
    expect(groups.has('ground')).toBe(true);
    expect(groups.has('tower')).toBe(true);
    expect(groups.has('rotor')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(5);   // wind streamlines
  });
});

describe('windmill-view — the rotor spins about its axis', () => {
  it('the rotor rides a SPIN mover (axis + omega + pivot), not a translation path', () => {
    const mv = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine' }).movers[0];
    expect(mv.group).toBe('rotor');
    expect(mv.spin).toBeTruthy();
    expect(mv.spin.axis).toEqual([0, 1, 0]);
    expect(mv.spin.omega).toBeGreaterThan(0);
    expect(mv.path).toBeUndefined();   // a spinner, not a translator
  });

  it('the rotor geometry is authored centred on the origin (so the spin pivots cleanly)', () => {
    const plan = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine', scale: 1 });
    const rotor = plan.faces.filter((f) => f.group === 'rotor');
    const xs = rotor.flatMap((f) => f.corners.map((c) => c[2]));   // span axis = z, centred on 0
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });

  it('more wind → faster spin (ω rises with wind speed, tip-speed ratio λ = ωR/V)', () => {
    const slow = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine', wind: 4 }).movers[0].spin.omega;
    const fast = planWindmillScene({ kind: 'windmill-view', scenario: 'turbine', wind: 16 }).movers[0].spin.omega;
    expect(fast).toBeGreaterThan(slow);
  });

  it('the classic Dutch mill spins its 4 sails too', () => {
    const plan = planWindmillScene({ kind: 'windmill-view', scenario: 'classic' });
    expect(plan.movers[0].spin).toBeTruthy();
    expect(plan.faces.some((f) => f.group === 'rotor')).toBe(true);
  });
});

describe('windmill-view registration', () => {
  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'windmill-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('assemble threads faces + the spin mover + wind tracers, glow off', () => {
    const scene = assembleWindmillScene({ kind: 'windmill-view' }, {});
    expect(scene.glow).toBe(false);
    expect(scene.movers[0].spin).toBeTruthy();
    expect(scene.tracers.length).toBeGreaterThan(0);
    expect(scene.cameras[0].name).toBe('front');
  });

  it('exposes the turbine + classic types', () => {
    expect(WINDMILL_SCENARIOS).toEqual(['turbine', 'classic']);
  });
});
