/**
 * airplane-view planner gate — physics fidelity lives in physics/airplane.test.js; these
 * assert the DERIVATION: the airport-primitive plane body is lowered and recentred, the
 * pose mover and HUD arrays stay in step, the flight path tells the mission story, the
 * read-back channel declares real SI units, and recipe → scene is deterministic.
 */
import { describe, it, expect } from 'vitest';
import { planAirplaneScene, sampleAirplanePhysics, assembleAirplaneScene, AIRPLANE_MISSIONS, AIRPLANE_BODIES } from './airplane-view.js';

const hop = planAirplaneScene({ mission: 'hop' });
const glide = planAirplaneScene({ mission: 'glide' });

describe('planner shape', () => {
  it('exposes both missions and the four airport bodies, defaulting hop/airliner', () => {
    expect(AIRPLANE_MISSIONS).toEqual(['hop', 'glide']);
    expect(AIRPLANE_BODIES).toEqual(['airliner', 'widebody', 'regional', 'bizjet']);
    expect(planAirplaneScene({}).stats.mission).toBe('hop');
    expect(planAirplaneScene({}).stats.plane).toBe('airliner');
  });
  it('lowers the airport plane net into a recentred `plane` group', () => {
    const planeFaces = hop.faces.filter((f) => f.group === 'plane');
    expect(planeFaces.length).toBeGreaterThan(500);   // the 940-face fixed-wing net
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const f of planeFaces) for (const c of f.corners) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], c[i]); mx[i] = Math.max(mx[i], c[i]); }
    for (let i = 0; i < 3; i++) expect(Math.abs(mn[i] + mx[i])).toBeLessThan(1);   // centred at origin
  });
  it('one pose mover carrying the flight-deck HUD, every channel in step with the path', () => {
    expect(hop.movers).toHaveLength(1);
    const m = hop.movers[0];
    expect(m.pose).toBe(true);
    expect(m.group).toBe('plane');
    expect(m.tilt.angles).toHaveLength(m.path.length);
    for (const key of ['phase', 't', 'alt', 'speed', 'aoa', 'cl', 'ld', 'thrust', 'cfg']) {
      expect(m.plane[key]).toHaveLength(m.path.length);
    }
  });
  it('the HUD tells the flight story: roll → climb → cruise → approach → stop', () => {
    const ph = hop.movers[0].plane.phase;
    expect(ph[0]).toBe('Takeoff roll');
    expect(ph[ph.length - 1]).toBe('Stopped');
    for (const label of ['Climb', 'Cruise', 'Final approach', 'Flare']) expect(ph).toContain(label);
    const alt = hop.movers[0].plane.alt;
    expect(Math.max(...alt)).toBeGreaterThan(2000);
    expect(alt[0]).toBe(0);
  });
  it('the glide narrates the engines quitting', () => {
    expect(glide.movers[0].plane.phase).toContain('Glide — engines out');
    expect(glide.stats.glideRatio).toBeGreaterThan(14);
  });
  it('the path stays on or above the runway and lands downrange', () => {
    const p = hop.movers[0].path;
    expect(Math.min(...p.map((c) => c[2]))).toBeGreaterThanOrEqual(0);
    expect(p[p.length - 1][0]).toBeGreaterThan(p[0][0] + 200);
  });
  it('draws both runways as clickable sites', () => {
    expect(hop.picks.map((k) => k.name)).toEqual(expect.arrayContaining(['plane', 'runwayA', 'runwayB']));
  });
  it('deterministic: same recipe → identical scene', () => {
    const again = planAirplaneScene({ mission: 'hop' });
    expect(again.stats).toEqual(hop.stats);
    expect(again.movers[0].path).toEqual(hop.movers[0].path);
  });
});

describe('read-back channel (measure_view)', () => {
  const m = sampleAirplanePhysics({ mission: 'glide' }, { every: 10 });
  it('declares real SI units for every column', () => {
    expect(m.units).toEqual({ t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', alpha: 'deg', cl: '1', lift: 'N', drag: 'N', thrust: 'N' });
  });
  it('samples the UNSCALED flight and carries the event table', () => {
    expect(Math.max(...m.samples.map((s) => s.pos[2]))).toBeGreaterThan(2500);
    const keys = m.facts.map((f) => f[0]);
    expect(keys).toEqual(expect.arrayContaining(['rotate', 'liftoff', 'engines out', 'touchdown', 'glide ratio', 'honesty']));
  });
});

describe('assembler', () => {
  const scene = assembleAirplaneScene({ mission: 'hop' }, { title: 'test flight' });
  it('leads side-on, glow off, single pose mover with the plane HUD', () => {
    expect(scene.cameras.map((c) => c.name)).toEqual(['side', 'angle']);
    expect(scene.glow).toBe(false);
    expect(scene.title).toBe('test flight');
    expect(scene.movers[0].plane).toBeTruthy();
  });
});
