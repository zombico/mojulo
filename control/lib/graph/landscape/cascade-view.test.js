import { describe, expect, it } from 'vitest';

import { planCascadeScene, assembleCascadeScene, CASCADE_REGIME_NAMES } from './cascade-view.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

describe('planCascadeScene — determinism & branching', () => {
  it('is deterministic — same recipe (seed) yields byte-identical output', () => {
    const a = planCascadeScene({ kind: 'cascade-view', regime: 'supercritical', seed: 7 });
    const b = planCascadeScene({ kind: 'cascade-view', regime: 'supercritical', seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a different seed produces a different cascade', () => {
    const a = planCascadeScene({ regime: 'supercritical', seed: 1 });
    const b = planCascadeScene({ regime: 'supercritical', seed: 2 });
    expect(JSON.stringify(a.stats)).not.toBe(JSON.stringify(b.stats));
  });

  it('ignites — the seed always causes at least one fission', () => {
    for (const regime of CASCADE_REGIME_NAMES) {
      expect(planCascadeScene({ regime, seed: 3 }).stats.fissions).toBeGreaterThan(0);
    }
  });

  it('regime orders the reach: supercritical fissions more of the assembly than subcritical', () => {
    const sup = planCascadeScene({ regime: 'supercritical', seed: 5 }).stats;
    const sub = planCascadeScene({ regime: 'subcritical', seed: 5 }).stats;
    expect(sup.fissions).toBeGreaterThan(sub.fissions);
  });

  it('emits the meshless cascade carrier first (drives the population HUD)', () => {
    const plan = planCascadeScene({ regime: 'critical' });
    expect(plan.movers[0].cascade).toBeTruthy();
    expect(plan.movers[0].cascade).toHaveProperty('peak');
    expect(plan.movers[0].cascade.nuclei).toBe(plan.stats.nuclei);
  });

  it('every body carries a shared-clock lifetime or a flash (no period/loop movers)', () => {
    const plan = planCascadeScene({ regime: 'supercritical', seed: 9 });
    for (const mv of plan.movers.slice(1)) {        // [0] is the carrier
      const timed = mv.t1 != null || mv.flash;
      expect(timed).toBeTruthy();
    }
  });

  it('tags neutrons and fissions so the HUD can count them', () => {
    const plan = planCascadeScene({ regime: 'supercritical', seed: 4 });
    expect(plan.movers.some((m) => m.kindTag === 'neutron')).toBe(true);
    expect(plan.movers.some((m) => m.kindTag === 'fission')).toBe(true);
    expect(plan.movers.some((m) => m.kindTag === 'fragment')).toBe(true);
  });

  it('clamps the nuclei count knob', () => {
    expect(planCascadeScene({ nuclei: 999 }).stats.nuclei).toBeLessThanOrEqual(80);
    expect(planCascadeScene({ nuclei: 1 }).stats.nuclei).toBeGreaterThanOrEqual(12);
  });

  it('every body is a lit sphere on the planets channel (no lathe faces left)', () => {
    const plan = planCascadeScene({ regime: 'supercritical', seed: 9 });
    // all bodies converted → faces is now empty; each body is one non-star lit sphere.
    expect(plan.faces).toEqual([]);
    expect(plan.planets.length).toBeGreaterThan(0);
    // one planet per nucleus + fission flash + fragment + neutron.
    const expected = plan.stats.nuclei + plan.stats.fissions + plan.stats.fissions * 2 + plan.stats.neutrons;
    expect(plan.planets.length).toBe(expected);
    for (const p of plan.planets) {
      expect(p.radius).toBeGreaterThan(0);
      expect(Array.isArray(p.tint)).toBe(true);
      expect(p.star).toBeFalsy();       // lab frame — no sun, neutral studio rig
    }
  });

  it('mover-driven bodies author geometry at the origin (center + basePos both [0,0,0])', () => {
    const plan = planCascadeScene({ regime: 'supercritical', seed: 9 });
    const byGroup = new Map(plan.planets.map((p) => [p.group, p]));
    for (const mv of plan.movers.slice(1)) {          // [0] is the meshless carrier
      if (!mv.group) continue;
      expect(mv.basePos).toEqual([0, 0, 0]);
      expect(byGroup.get(mv.group).center).toEqual([0, 0, 0]);
    }
  });
});

describe('cascade-view — emit + registration', () => {
  it('emits a mesh World carrying the cascade HUD + lifetime machinery', () => {
    const html = emitThreeWorld(assembleCascadeScene({ kind: 'cascade-view', regime: 'supercritical' }, {}));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('GROUPS =');             // the mesh pipeline (NOT raymarch)
    expect(html).toContain('const PLANETS =');      // bodies are lit spheres on the planets channel
    expect(html).toContain('_cascadeHud');          // the population readout
    expect(html).toContain('const _LIFE_T');        // shared-clock lifetimes
    expect(html).toContain('OrbitControls');
  });

  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'cascade-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('exposes the three regimes', () => {
    expect(CASCADE_REGIME_NAMES).toEqual(['subcritical', 'critical', 'supercritical']);
  });
});
