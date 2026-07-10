import { describe, expect, it } from 'vitest';

import { planReactorScene, assembleReactorScene, REACTOR_SCENARIO_NAMES } from './reactor-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planReactorScene — determinism & control', () => {
  it('is deterministic — same recipe (seed) yields byte-identical output', () => {
    const a = planReactorScene({ kind: 'reactor-view', scenario: 'scram', seed: 4 });
    const b = planReactorScene({ kind: 'reactor-view', scenario: 'scram', seed: 4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to scram on an unknown scenario', () => {
    expect(planReactorScene({ scenario: 'meltdown' }).stats.scenario).toBe('scram');
  });

  it('the SCRAM shuts it down: scram fissions far less of the core than runaway, and absorbs neutrons', () => {
    const scram = planReactorScene({ scenario: 'scram', seed: 4 }).stats;
    const runaway = planReactorScene({ scenario: 'runaway', seed: 4 }).stats;
    expect(scram.fissions).toBeLessThan(runaway.fissions);
    expect(scram.absorbed).toBeGreaterThan(0);          // rods caught neutrons
    expect(runaway.absorbed).toBe(0);                   // no rods → no absorption
  });

  it('runaway consumes most of the core', () => {
    const s = planReactorScene({ scenario: 'runaway', seed: 4 }).stats;
    expect(s.fissions).toBeGreaterThan(s.nuclei * 0.6);
  });

  it('emits control-rod movers in scram and none in runaway', () => {
    const scram = planReactorScene({ scenario: 'scram' });
    const runaway = planReactorScene({ scenario: 'runaway' });
    expect(scram.movers.some((m) => m.kindTag === 'rod')).toBe(true);
    expect(runaway.movers.some((m) => m.kindTag === 'rod')).toBe(false);
  });

  it('the rod count knob is clamped', () => {
    expect(planReactorScene({ scenario: 'scram', rods: 99 }).stats.rods).toBeLessThanOrEqual(5);
    expect(planReactorScene({ scenario: 'scram', rods: 1 }).stats.rods).toBe(1);
  });

  it('emits the meshless cascade HUD carrier first, and timed bodies only', () => {
    const plan = planReactorScene({ scenario: 'scram' });
    expect(plan.movers[0].cascade).toBeTruthy();
    for (const mv of plan.movers.slice(1)) {
      expect(mv.t1 != null || mv.flash).toBeTruthy();
    }
  });

  it('nuclei/neutrons/fragments/flashes are lit spheres in the planets channel, not faces', () => {
    const plan = planReactorScene({ scenario: 'scram', seed: 4 });
    const groups = plan.planets.map((p) => p.group);
    expect(plan.planets.length).toBeGreaterThan(0);
    expect(groups.some((g) => g.startsWith('nuc'))).toBe(true);
    expect(groups.some((g) => g.startsWith('neu'))).toBe(true);
    expect(groups.some((g) => g.startsWith('frag'))).toBe(true);
    // spheres no longer emit body faces; only the control rods (cylinders) remain as faces.
    const faceGroups = new Set(plan.faces.map((f) => f.group));
    for (const fg of faceGroups) expect(fg).toMatch(/^rod\d+$/);
    // every planet has a valid radius + tint triple.
    for (const p of plan.planets) {
      expect(p.radius).toBeGreaterThan(0);
      expect(p.tint).toHaveLength(3);
    }
  });

  it('mover-driven spheres are authored at the origin with mover base [0,0,0]; static nuclei sit at their core position', () => {
    const plan = planReactorScene({ scenario: 'scram', seed: 4 });
    const planetOf = (g) => plan.planets.find((p) => p.group === g);
    // a fissioning nucleus is mover-driven → planet center + mover base both [0,0,0].
    const nucMovers = plan.movers.filter((m) => m.kindTag === 'nucleus');
    expect(nucMovers.length).toBeGreaterThan(0);
    for (const mv of nucMovers) {
      expect(mv.basePos).toEqual([0, 0, 0]);
      expect(planetOf(mv.group).center).toEqual([0, 0, 0]);
    }
    // neutrons + fragments (mover-driven) likewise sit at the origin with base [0,0,0].
    for (const mv of plan.movers.filter((m) => m.kindTag === 'neutron' || m.kindTag === 'fragment')) {
      expect(mv.basePos).toEqual([0, 0, 0]);
      expect(planetOf(mv.group).center).toEqual([0, 0, 0]);
    }
    // an unconsumed (static, no-mover) nucleus keeps its world position as its planet center.
    const moverGroups = new Set(plan.movers.map((m) => m.group));
    const staticNuc = plan.planets.find((p) => p.group.startsWith('nuc') && !moverGroups.has(p.group));
    expect(staticNuc).toBeTruthy();
    expect(staticNuc.center).not.toEqual([0, 0, 0]);
  });
});

describe('reactor-view — emit + registration', () => {
  it('emits a mesh World carrying the population HUD + lifetime machinery', () => {
    const html = emitThreeWorld(assembleReactorScene({ kind: 'reactor-view', scenario: 'scram' }, {}));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('GROUPS =');
    expect(html).toContain('_cascadeHud');
    expect(html).toContain('const _LIFE_T');
    expect(html).toContain('const PLANETS =');   // bodies emitted through the lit-sphere channel
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'reactor-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the two scenarios', () => {
    expect(REACTOR_SCENARIO_NAMES).toEqual(['scram', 'runaway']);
  });
});
