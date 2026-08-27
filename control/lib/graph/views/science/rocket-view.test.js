/**
 * rocket-view planner gate — the scene is derived data over physics/rocket.js (whose
 * fidelity has its own gate in physics/rocket.test.js), so these assert the DERIVATION:
 * the pose movers are well-formed and in step with their HUD arrays, the equal-dt resample
 * covers the whole mission, separation splits the two movers, the read-back channel
 * declares real SI units, and the whole thing is deterministic recipe → scene.
 */
import { describe, it, expect } from 'vitest';
import { planRocketScene, sampleRocketPhysics, assembleRocketScene, ROCKET_SCENARIOS } from './rocket-view.js';

const rtls = planRocketScene({ scenario: 'rtls' });
const asds = planRocketScene({ scenario: 'asds' });

describe('planner shape', () => {
  it('exposes both mission profiles and defaults to rtls', () => {
    expect(ROCKET_SCENARIOS).toEqual(['rtls', 'asds']);
    expect(planRocketScene({}).stats.scenario).toBe('rtls');
  });
  it('emits two pose movers — booster (with the HUD) and stage 2 — on one shared cycle', () => {
    expect(rtls.movers).toHaveLength(2);
    const [booster, s2] = rtls.movers;
    expect(booster.group).toBe('booster');
    expect(booster.pose).toBe(true);
    expect(booster.rocket).toBeTruthy();
    expect(s2.group).toBe('stage2');
    expect(s2.pose).toBe(true);
    expect(booster.period + booster.hold).toBeCloseTo(s2.period + s2.hold, 6);
  });
  it('keeps every per-sample channel in step with the path', () => {
    const m = rtls.movers[0];
    expect(m.tilt.angles).toHaveLength(m.path.length);
    for (const key of ['phase', 't', 'alt', 'speed', 'mach', 'mass', 'thrust', 'twr', 'q', 'prop']) {
      expect(m.rocket[key]).toHaveLength(m.path.length);
    }
    expect(rtls.movers[1].tilt.angles).toHaveLength(rtls.movers[1].path.length);
  });
  it('the HUD tells the mission story: clock runs, mass only drains, propellant 1 → ~0', () => {
    const r = rtls.movers[0].rocket;
    expect(r.t[0]).toBe(0);
    expect(r.t[r.t.length - 1]).toBeGreaterThan(400);
    for (let i = 1; i < r.mass.length; i++) expect(r.mass[i]).toBeLessThanOrEqual(r.mass[i - 1] + 1);
    expect(r.prop[0]).toBeGreaterThan(0.95);
    expect(r.prop[r.prop.length - 1]).toBeLessThan(0.05);
    expect(r.phase[0]).toBe('Liftoff');
    expect(r.phase[r.phase.length - 1]).toBe('Touchdown');
    expect(r.phase).toContain('Landing burn');
  });
  it('the booster flies the loop home (rtls) / the arc downrange (asds)', () => {
    const endX = (p) => p.movers[0].path[p.movers[0].path.length - 1][0];
    const maxX = (p) => Math.max(...p.movers[0].path.map((c) => c[0]));
    expect(Math.abs(endX(rtls))).toBeLessThan(maxX(rtls) * 0.05);   // home ≈ x 0
    expect(endX(asds)).toBeGreaterThan(maxX(asds) * 0.9);           // deck ≈ far downrange
  });
  it('the flip is in the pitch program: attitude swings past 90° after MECO', () => {
    const a = rtls.movers[0].tilt.angles;
    expect(Math.min(...a) < -Math.PI / 3 || Math.max(...a) > (2 * Math.PI) / 3).toBe(true);
  });
  it('separation splits the movers: stage 2 rides the stack, then departs', () => {
    const [b, s2] = rtls.movers;
    const gap = (i) => Math.hypot(s2.path[i][0] - b.path[i][0], s2.path[i][2] - b.path[i][2]);
    expect(gap(10)).toBeLessThan(gap(s2.path.length - 1));
  });
  it('deterministic: same recipe → identical scene', () => {
    const again = planRocketScene({ scenario: 'rtls' });
    expect(again.stats).toEqual(rtls.stats);
    expect(again.faces.length).toBe(rtls.faces.length);
    expect(again.movers[0].path).toEqual(rtls.movers[0].path);
  });
  it('draws dressing + picks: pad, booster and stage 2 are clickable', () => {
    expect(rtls.picks.map((p) => p.name)).toEqual(expect.arrayContaining(['booster', 'stage2', 'pad']));
    expect(rtls.faces.length).toBeGreaterThan(100);
    expect(rtls.stats.touchdownV).toBeLessThan(4);
  });
});

describe('read-back channel (measure_view)', () => {
  const m = sampleRocketPhysics({ scenario: 'rtls' }, { every: 10 });
  it('declares real SI units for every column', () => {
    expect(m.units).toEqual({ t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', mass: 'kg', thrust: 'N', drag: 'N', q: 'Pa' });
  });
  it('samples the UNSCALED mission — apogee in real metres, mass in real kg', () => {
    const zMax = Math.max(...m.samples.map((s) => s.pos[2]));
    expect(zMax).toBeGreaterThan(120000);
    expect(m.samples[0].mass).toBeGreaterThan(400000);
    expect(m.samples[0].phase).toBe('liftoff');
  });
  it('carries the event table in the facts', () => {
    const keys = m.facts.map((f) => f[0]);
    expect(keys).toEqual(expect.arrayContaining(['max-Q', 'MECO', 'apogee', 'touchdown', 'honesty']));
  });
  it('`every` downsamples', () => {
    expect(m.count).toBeLessThan(sampleRocketPhysics({ scenario: 'rtls' }).count);
  });
});

describe('assembler', () => {
  const scene = assembleRocketScene({ scenario: 'rtls' }, { title: 'test rocket' });
  it('leads side-on with an angled alternate, glow off, recipe viewBox honored', () => {
    expect(scene.cameras.map((c) => c.name)).toEqual(['side', 'angle']);
    expect(scene.glow).toBe(false);
    expect(scene.title).toBe('test rocket');
    expect(scene.viewBox).toEqual({ width: 1120, height: 780 });
    expect(scene.movers).toHaveLength(2);
  });
});
