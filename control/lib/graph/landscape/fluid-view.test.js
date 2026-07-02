import { describe, expect, it } from 'vitest';

import { planFluidScene, assembleFluidScene, FLUID_SCENARIOS } from './fluid-view.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

const AIR = (angle) => ({ kind: 'fluid-view', scenario: 'airfoil', angle });

describe('planFluidScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planFluidScene(AIR(6)))).toBe(JSON.stringify(planFluidScene(AIR(6))));
  });

  it('falls back to airfoil on an unknown scenario', () => {
    expect(planFluidScene({ kind: 'fluid-view', scenario: 'plasma' }).stats.scenario).toBe('airfoil');
  });

  it('emits an airfoil pick, velocity arrows, streamline lines and flow-particle tracers', () => {
    const plan = planFluidScene(AIR(6));
    expect(plan.picks.map((p) => p.name)).toEqual(['airfoil']);
    expect(plan.faces.some((f) => f.group === 'airfoil')).toBe(true);
    expect(plan.fields[0].sets[0].samples.length).toBeGreaterThan(20);   // velocity grid
    expect(plan.fields[0].lines.length).toBeGreaterThan(5);              // streamlines
    expect(plan.tracers.length).toBeGreaterThan(5);                      // flow particles
    expect(plan.tracers[0].path.length).toBeGreaterThan(8);
  });

  it('assemble frames side-first, glow off, threading BOTH the field and tracer channels', () => {
    const scene = assembleFluidScene(AIR(6), {});
    expect(scene.glow).toBe(false);
    expect(scene.cameras[0].name).toBe('side');
    expect(scene.fields.length).toBe(1);
    expect(scene.tracers.length).toBeGreaterThan(0);
  });
});

describe('fluid-view — lift emerges from the flow', () => {
  it('Kutta condition: Γ = 4π·R·U·sin(α + β₀)', () => {
    const s = planFluidScene(AIR(6)).stats;
    const expected = 4 * Math.PI * s.R * 1 * Math.sin((6 * Math.PI / 180) + s.beta0);
    expect(Math.abs(s.Gamma - expected)).toBeLessThan(1e-9);
  });

  it('circulation (and thus lift) rises monotonically with angle of attack', () => {
    const g0 = planFluidScene(AIR(0)).stats.Gamma;
    const g6 = planFluidScene(AIR(6)).stats.Gamma;
    const g12 = planFluidScene(AIR(12)).stats.Gamma;
    expect(g6).toBeGreaterThan(g0);
    expect(g12).toBeGreaterThan(g6);
  });

  it('a cambered airfoil produces lift even at zero angle of attack (Γ > 0)', () => {
    expect(planFluidScene(AIR(0)).stats.Gamma).toBeGreaterThan(0);
  });

  it('the flow runs FASTER over the top than the freestream', () => {
    expect(planFluidScene(AIR(6)).stats.topRatio).toBeGreaterThan(1.1);
  });

  it('velocity arrows are coloured per-sample by speed (a pressure read)', () => {
    const arrows = planFluidScene(AIR(6)).fields[0].sets[0].samples;
    const colors = new Set(arrows.map((a) => a.color));
    expect(colors.size).toBeGreaterThan(3);   // not a single flat colour
  });
});

describe('fluid-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'fluid-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the aerodynamic, hydrostatic and viscosity scenarios', () => {
    expect(FLUID_SCENARIOS).toEqual(['airfoil', 'sail', 'spin-sail', 'rotor-sail', 'buoyancy', 'water-pressure', 'falling-sphere', 'shear']);
  });
});

describe('fluid-view — rotor-sail (Magnus / Flettner: spin drives into a headwind)', () => {
  const rotor = (over = {}) => planFluidScene({ kind: 'fluid-view', scenario: 'rotor-sail', ...over });

  it('same-sense spinning balls in a headwind produce forward drive (Magnus, off the bow)', () => {
    expect(rotor({ angle: 42 }).stats.drive).toBeGreaterThan(0);
  });

  it('drive scales with the spin (F = ρ·U∞·Γ)', () => {
    expect(rotor({ spin: 12 }).stats.drive).toBeGreaterThan(rotor({ spin: 4 }).stats.drive);
  });

  it('upwind VMG peaks near 45° and collapses toward the dead-upwind no-go zone', () => {
    const vmg = (a) => rotor({ angle: a }).stats.vmg;
    expect(vmg(45)).toBeGreaterThan(vmg(18));
    expect(vmg(45)).toBeGreaterThan(vmg(75));
  });

  it('the flow is faster on the force side than the freestream (Magnus = Bernoulli)', () => {
    const s = rotor({ angle: 42, spin: 8 }).stats;
    expect(s.fastRatio).toBeGreaterThan(1);
    expect(s.fastRatio).toBeGreaterThan(s.slowRatio);
  });

  it('counter-rotating balls cancel — no net drive', () => {
    const s = rotor({ emitters: [{ x: -1.8, y: 1, spin: 6 }, { x: -1.8, y: -1, spin: -6 }] }).stats;
    expect(Math.abs(s.drive)).toBeLessThan(1e-9);
  });

  it('emits the hull, keel, two balls, dust tracers, and the drive arrow', () => {
    const plan = rotor();
    expect(plan.faces.some((f) => f.group === 'hull')).toBe(true);
    expect(plan.faces.some((f) => f.group === 'keel')).toBe(true);
    expect(plan.faces.some((f) => f.group === 'ball:0')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(5);
    expect(plan.fields[0].sets[1].samples.map((s) => s.color)).toContain(0x66dd99);  // drive
  });
});

describe('fluid-view — spin-sail (Gyro Zeppeli: wind conjured from two points)', () => {
  const spinsail = (over = {}) => planFluidScene({ kind: 'fluid-view', scenario: 'spin-sail', ...over });

  it('the default counter-rotating pair flings a jet toward the sail (local wind ≈ along +x)', () => {
    const s = spinsail().stats;
    expect(s.U).toBeGreaterThan(0);             // a real wind reaches the sail
    expect(Math.abs(s.phiDeg)).toBeLessThan(20); // jet points (roughly) downstream at the sail
  });

  it('the sail develops lift from the conjured wind via the Kutta circulation (Γ > 0)', () => {
    expect(spinsail().stats.Gamma).toBeGreaterThan(0);
  });

  it('more spin → a faster conjured jet → more lift', () => {
    expect(spinsail({ spin: 12 }).stats.U).toBeGreaterThan(spinsail({ spin: 4 }).stats.U);
    expect(spinsail({ spin: 12 }).stats.Gamma).toBeGreaterThan(spinsail({ spin: 4 }).stats.Gamma);
  });

  it('emits two steel balls, a sail body, dust tracers, and the lift arrow', () => {
    const plan = spinsail();
    expect(plan.faces.some((f) => f.group === 'ball:0')).toBe(true);
    expect(plan.faces.some((f) => f.group === 'ball:1')).toBe(true);
    expect(plan.faces.some((f) => f.group === 'sail')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(5);
    expect(plan.fields[0].sets[1].samples.map((s) => s.color)).toContain(0xffe066);  // lift
    expect(plan.picks.map((p) => p.name)).toEqual(['sail', 'ball:0', 'ball:1']);
  });

  it('honours arbitrary emitter positions passed in the recipe', () => {
    const s = spinsail({ emitters: [{ x: -2, y: 2, spin: 8 }, { x: -2, y: -2, spin: -8 }] }).stats;
    expect(s.emitters).toEqual([[-2, 2, 8], [-2, -2, -8]]);
  });
});

describe('fluid-view — sail (lift to windward)', () => {
  const sail = (angle) => planFluidScene({ kind: 'fluid-view', scenario: 'sail', angle });

  it('a cambered sail develops circulation (Γ > 0) and the flow runs faster over the lee side', () => {
    const s = sail(42).stats;
    expect(s.Gamma).toBeGreaterThan(0);
    expect(s.topRatio).toBeGreaterThan(1.1);   // lee/suction side faster than the apparent wind
  });

  it('emits a sail pick, a vertical-airfoil sail body, a keel, and flow-particle tracers', () => {
    const plan = sail(42);
    expect(plan.picks.map((p) => p.name)).toEqual(['sail']);
    expect(plan.faces.some((f) => f.group === 'sail')).toBe(true);
    expect(plan.faces.some((f) => f.group === 'keel')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(5);
  });

  it('resolves lift into the four-force diagram (lift / drive / heel / keel reaction)', () => {
    const forces = sail(42).fields[0].sets[1].samples;
    const colors = forces.map((f) => f.color);
    expect(colors).toContain(0xffe066);   // total lift
    expect(colors).toContain(0x66dd99);   // drive (forward)
    expect(colors).toContain(0xff7a4d);   // heel / leeway
    expect(colors).toContain(0x4d8cff);   // keel reaction
  });

  it('drive grows as the boat bears away from the wind (drive ∝ sin β)', () => {
    expect(sail(60).stats.drive).toBeGreaterThan(sail(30).stats.drive);
  });

  it('upwind VMG peaks near 45° (∝ sin 2β) — pinching toward the no-go zone collapses it', () => {
    const vmg = (a) => sail(a).stats.vmg;
    expect(vmg(45)).toBeGreaterThan(vmg(25));   // pinching too high
    expect(vmg(45)).toBeGreaterThan(vmg(75));   // bearing away too far
  });
});

describe('fluid-view — viscosity (Stokes falling-sphere)', () => {
  const plan = planFluidScene({ kind: 'fluid-view', scenario: 'falling-sphere' });

  it('drops one ball per fluid column, each on the mover channel', () => {
    expect(plan.movers.length).toBe(3);
    expect(plan.movers.every((m) => m.group.startsWith('ball:') && m.loop === false)).toBe(true);
    expect(plan.picks.map((p) => p.name).sort()).toEqual(['fluid:honey', 'fluid:oil', 'fluid:water']);
  });

  it('higher viscosity → slower fall: the honey ball takes longer to fall than the water ball', () => {
    const water = plan.movers.find((m) => m.group === 'ball:water');
    const honey = plan.movers.find((m) => m.group === 'ball:honey');
    expect(honey.period).toBeGreaterThan(water.period);
  });

  it('exposes the real (ordered) viscosities', () => {
    expect(plan.stats.viscosities).toEqual([0.001, 0.1, 10]);
  });

  it('fluid columns are translucent so the falling ball shows through', () => {
    expect(plan.faces.some((f) => f.group === 'fluid:honey' && f.alpha < 1)).toBe(true);
  });
});

describe('fluid-view — viscosity (Couette shear)', () => {
  it('builds a LINEAR velocity profile (arrow length ∝ height) + sliding particle layers', () => {
    const plan = planFluidScene({ kind: 'fluid-view', scenario: 'shear' });
    const arrows = plan.fields[0].sets[0].samples;
    // along the same x column, arrow amplitude grows with height z.
    const col = arrows.filter((a) => Math.abs(a.pos[0]) < 1e-6).sort((a, b) => a.pos[2] - b.pos[2]);
    for (let i = 1; i < col.length; i++) expect(col[i].amp).toBeGreaterThan(col[i - 1].amp);
    expect(plan.tracers.length).toBeGreaterThan(2);   // sliding layers
  });

  it('the shear-stress arrow scales with the viscosity knob (τ = μ·dv/dy)', () => {
    const lo = planFluidScene({ kind: 'fluid-view', scenario: 'shear', viscosity: 0.5 });
    const hi = planFluidScene({ kind: 'fluid-view', scenario: 'shear', viscosity: 5 });
    const stressOf = (p) => p.fields[0].sets[1].samples[0].amp;
    expect(stressOf(hi)).toBeGreaterThan(stressOf(lo));
  });
});

describe('fluid-view — buoyancy (Archimedes)', () => {
  const buoy = (density) => planFluidScene({ kind: 'fluid-view', scenario: 'buoyancy', density });

  it('a light body floats with submerged fraction = its relative density', () => {
    const plan = buoy(0.6);
    expect(plan.stats.floats).toBe(true);
    expect(plan.stats.submergedFrac).toBeCloseTo(0.6, 6);
  });

  it('a float is in force balance — buoyancy equals weight', () => {
    const s = buoy(0.6).stats;
    expect(Math.abs(s.Fb - s.W)).toBeLessThan(1e-6);   // F_b = ρ_w·g·V_sub = ρ·g·V = W
  });

  it('a dense body sinks (fully submerged, weight exceeds buoyancy)', () => {
    const s = buoy(2.7).stats;
    expect(s.floats).toBe(false);
    expect(s.submergedFrac).toBe(1);
    expect(s.W).toBeGreaterThan(s.Fb);
  });

  it('emits translucent water, a solid block, and green/red force arrows', () => {
    const plan = buoy(0.6);
    expect(plan.faces.some((f) => f.group === 'water' && f.alpha < 1)).toBe(true);
    expect(plan.faces.some((f) => f.group === 'block')).toBe(true);
    const forceColors = plan.fields[0].sets[1].samples.map((s) => s.color);
    expect(forceColors).toContain(0x66dd99);   // buoyancy (up)
    expect(forceColors).toContain(0xff6b6b);   // weight (down)
  });
});

describe('fluid-view — water pressure (hydrostatic)', () => {
  const plan = planFluidScene({ kind: 'fluid-view', scenario: 'water-pressure' });

  it('emits a translucent tank, wall pick, depth-coloured pressure arrows, and three jets', () => {
    expect(plan.faces.some((f) => f.group === 'water' && f.alpha < 1)).toBe(true);
    expect(plan.picks.map((p) => p.name)).toEqual(['wall']);
    expect(plan.tracers.length).toBe(3);            // one jet per hole
  });

  it('the deeper jet exits faster — its first step covers more horizontal distance (Torricelli)', () => {
    // tracers are ordered shallow → deep; deeper hole = higher v = bigger first horizontal step.
    const dx = plan.tracers.map((t) => t.path[1][0] - t.path[0][0]);
    expect(dx[2]).toBeGreaterThan(dx[0]);
  });
});

describe('fluid-view — Couette shear shows the parcel deform (the deform-channel improvement)', () => {
  const plan = planFluidScene({ kind: 'fluid-view', scenario: 'shear' });

  it('emits a marked fluid parcel + a shear deform on the parcel group', () => {
    expect(plan.faces.some((f) => f.group === 'parcel')).toBe(true);
    expect(plan.deforms).toHaveLength(1);
    const d = plan.deforms[0];
    expect(d.group).toBe('parcel');
    expect(d.mode).toBe('morph');
  });

  it('the deform is a SHEAR (x displaced ∝ height z), pivoted at the floor', () => {
    const M = plan.deforms[0].to;
    expect(M[0][2]).toBeGreaterThan(0);            // row 0 = [1, 0, γ] → x += γ·z
    expect(M[0][0]).toBe(1); expect(M[1][1]).toBe(1);   // no scaling, just shear
    expect(plan.deforms[0].pivot[2]).toBe(0);     // shear measured from the fixed floor
  });

  it('other scenarios emit no deform (the channel is shear-only)', () => {
    expect((planFluidScene({ scenario: 'airfoil' }).deforms || [])).toHaveLength(0);
  });
});
