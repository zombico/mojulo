import { describe, expect, it } from 'vitest';

import { planOrbitScene, assembleOrbitScene, ORBIT_SCENARIOS } from './orbit-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

const SYSTEM = { kind: 'orbit-view', scenario: 'system' };

describe('planOrbitScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical faces and mover paths', () => {
    const a = planOrbitScene(SYSTEM), b = planOrbitScene(SYSTEM);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
    expect(JSON.stringify(a.movers.map((m) => m.path))).toBe(JSON.stringify(b.movers.map((m) => m.path)));
  });

  it('emits a central mass + one mover per body, every body on a track, vectors only on the featured', () => {
    const plan = planOrbitScene(SYSTEM);
    const groups = new Set(plan.faces.map((f) => f.group));
    expect(groups.has('central')).toBe(true);
    expect(plan.movers.length).toBe(4);
    expect(plan.movers.every((m) => m.track)).toBe(true);
    expect(plan.movers.filter((m) => m.vectors).length).toBe(1);   // featured only
    // central + four bodies are all pickable
    expect(plan.picks.map((p) => p.name).sort()).toEqual(['body:earth', 'body:mars', 'body:mercury', 'body:venus', 'central']);
  });

  it('falls back to system on an unknown scenario', () => {
    expect(planOrbitScene({ kind: 'orbit-view', scenario: 'nibiru' }).stats.scenario).toBe('system');
  });

  it('assemble frames 3/4-first with glow off and threads the mover channel', () => {
    const scene = assembleOrbitScene(SYSTEM, {});
    expect(scene.glow).toBe(false);
    expect(scene.cameras[0].name).toBe('3/4');
    expect(scene.movers.length).toBe(4);
  });
});

describe('planOrbitScene — accurate motion', () => {
  it("Kepler's 2nd law — an eccentric orbit is fastest at perihelion (min r), slowest at aphelion", () => {
    const mv = planOrbitScene({ kind: 'orbit-view', scenario: 'ellipse' }).movers[0];
    const iMin = mv.dist.indexOf(Math.min(...mv.dist));   // perihelion sample
    const iMax = mv.dist.indexOf(Math.max(...mv.dist));   // aphelion sample
    expect(mv.speed[iMin]).toBeGreaterThan(mv.speed[iMax] * 1.5);
  });

  it("Kepler's 3rd law — system playback periods scale as a^1.5 (ratios preserved under compression)", () => {
    const plan = planOrbitScene(SYSTEM);
    // mercury a=0.387 AU, mars a=1.524 AU → period ratio ≈ (1.524/0.387)^1.5 ≈ 7.8
    const [mercury, , , mars] = plan.movers;
    const ratio = mars.period / mercury.period;
    const expected = Math.pow(1.5237 / 0.3871, 1.5);
    expect(Math.abs(ratio - expected)).toBeLessThan(expected * 0.02);
  });

  it('vis-viva — real speeds are physical: Earth ≈ 29.8 km/s, Moon ≈ 1.0 km/s', () => {
    const earth = planOrbitScene(SYSTEM).movers.find((m) => m.label === 'Earth');
    const mean = earth.speed.reduce((s, v) => s + v, 0) / earth.speed.length;
    expect(Math.abs(mean - 29.8)).toBeLessThan(1.5);
    const moon = planOrbitScene({ kind: 'orbit-view', scenario: 'moon' }).movers[0];
    const mmean = moon.speed.reduce((s, v) => s + v, 0) / moon.speed.length;
    expect(Math.abs(mmean - 1.02)).toBeLessThan(0.15);
  });

  it('artistic scale — render radii are compressed vs true a, but ordering is preserved', () => {
    const plan = planOrbitScene(SYSTEM);
    const rOf = (m) => Math.max(...m.path.map((p) => Math.hypot(p[0], p[1])));
    const [me, ve, ea, ma] = plan.movers.map(rOf);
    expect(me).toBeLessThan(ve); expect(ve).toBeLessThan(ea); expect(ea).toBeLessThan(ma);   // ordering kept
    const trueRatio = 1.5237 / 0.3871;       // ~3.94
    expect(ma / me).toBeLessThan(trueRatio);  // render ratio is COMPRESSED below the true ratio
  });

  it('orbit path is a closed loop (seamless period — first ≈ last sample)', () => {
    const mv = planOrbitScene({ kind: 'orbit-view', scenario: 'circular' }).movers[0];
    const a = mv.path[0], b = mv.path[mv.path.length - 1];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-9);
  });
});

describe('orbit-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'orbit-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the four orbit primitives', () => {
    expect(ORBIT_SCENARIOS).toEqual(['circular', 'ellipse', 'system', 'moon']);
  });
});
