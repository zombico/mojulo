process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintMechanicsView } from './mechanics-view.js';
import { mintOrbitView } from './orbit-view.js';
import { mintDerivativeView } from './derivative-view.js';
import { mintSeriesView } from './series-view.js';
import { measureViewHandler, measureViewSamples, recomputeViewStats } from './measure-view.js';
import { sampleOrbitPhysics } from '@/lib/graph/views/science/orbit-view';

beforeEach(() => {
  closeDb();
});

const PROJECTILE = { kind: 'mechanics-view', scenario: 'projectile', v0: 18, angle: 55, g: 9.8 };

describe('measureViewSamples — mechanics, physical honesty', () => {
  it('projectile samples match the closed form x = v₀cosθ·t, z = v₀sinθ·t − ½gt²', () => {
    const m = measureViewSamples(PROJECTILE);
    const th = (55 * Math.PI) / 180;
    const vx = 18 * Math.cos(th), vz = 18 * Math.sin(th);
    for (const s of m.series[0].samples) {
      expect(s.pos[0]).toBeCloseTo(vx * s.t, 4);
      expect(s.pos[1]).toBe(0);
      expect(s.pos[2]).toBeCloseTo(Math.max(0, vz * s.t - 0.5 * 9.8 * s.t * s.t), 4);
    }
    // flight time: last sample lands at T = 2v₀sinθ/g
    const last = m.series[0].samples.at(-1);
    expect(last.t).toBeCloseTo((2 * vz) / 9.8, 3);
    expect(last.pos[2]).toBeCloseTo(0, 4);
  });

  it('kinematics are real SI: launch speed ≈ v₀, mid-flight accel ≈ g (central second difference)', () => {
    const m = measureViewSamples(PROJECTILE);
    const samples = m.series[0].samples;
    expect(samples[0].speed).toBeCloseTo(18, 0);          // forward difference: O(dt) error
    const mid = samples[Math.floor(samples.length / 2)];
    expect(mid.accel).toBeCloseTo(9.8, 1);                // exact for a quadratic, modulo 1e-6 rounding
    expect(m.units).toMatchObject({ t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', ke: 'J', pe: 'J' });
  });

  it('spring energy is conserved sample-to-sample (analytic KE/PE arrays)', () => {
    const m = measureViewSamples({ kind: 'mechanics-view', scenario: 'spring', k: 12, mass: 1, amplitude: 6 });
    const samples = m.series[0].samples;
    const total0 = samples[0].ke + samples[0].pe;
    expect(total0).toBeCloseTo(0.5 * 12 * 6 * 6, 3);      // ½kA²
    for (const s of samples) expect(s.ke + s.pe).toBeCloseTo(total0, 3);
  });

  it('circular motion opts out of energy (noEnergy) — no ke/pe fields, no J units', () => {
    const m = measureViewSamples({ kind: 'mechanics-view', scenario: 'circular', radius: 10, v0: 12 });
    expect(m.series[0].samples[0]).not.toHaveProperty('ke');
    expect(m.units).not.toHaveProperty('ke');
    // centripetal accel v²/R holds at every sample
    const mid = m.series[0].samples[Math.floor(m.series[0].samples.length / 2)];
    expect(mid.accel).toBeCloseTo((12 * 12) / 10, 0);
  });

  it('every=10 downsamples without changing the values it keeps', () => {
    const all = measureViewSamples(PROJECTILE);
    const thin = measureViewSamples(PROJECTILE, { every: 10 });
    expect(thin.series[0].count).toBe(Math.ceil(all.series[0].count / 10));
    expect(thin.series[0].samples[1]).toEqual(all.series[0].samples[10]);
  });

  it('is deterministic — same recipe yields byte-identical samples', () => {
    const a = measureViewSamples(PROJECTILE), b = measureViewSamples(PROJECTILE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('measureViewSamples — the honesty boundary', () => {
  it('refuses kinds without an honest sampler', () => {
    expect(() => measureViewSamples({ kind: 'double-slit-view', d: 18 })).toThrow(/no honest read-back channel/);
    expect(() => measureViewSamples({ kind: 'gravity-wave-view' })).toThrow(/no honest read-back channel/);
  });

  it('refuses quasi-static / kinematic mechanics scenarios (machines, engines)', () => {
    expect(() => measureViewSamples({ kind: 'mechanics-view', scenario: 'lever' })).toThrow(/no single-body dynamics rule/);
    expect(() => measureViewSamples({ kind: 'mechanics-view', scenario: 'steam-engine' })).toThrow(/no single-body dynamics rule/);
  });

  it('refuses compare recipes (two movers, no single honest series)', () => {
    expect(() => measureViewSamples({ kind: 'mechanics-view', scenario: 'projectile', compare: 'gravity' })).toThrow(/compare/);
  });
});

describe('sampleOrbitPhysics — real units, not the rendered orrery', () => {
  it('ellipse (e=0.6): r spans a(1−e)…a(1+e) in km, speed peaks at perihelion (vis-viva)', () => {
    const o = sampleOrbitPhysics({ kind: 'orbit-view', scenario: 'ellipse' });
    const AU = 1.495978707e8, MU = 1.32712440018e11, e = 0.6;
    const body = o.series[0];
    const rs = body.samples.map((s) => s.r);
    expect(Math.min(...rs)).toBeCloseTo(AU * (1 - e), -3);
    expect(Math.max(...rs)).toBeCloseTo(AU * (1 + e), -3);
    // vis-viva at perihelion
    const peri = body.samples.reduce((a, b) => (a.r < b.r ? a : b));
    expect(peri.speed).toBeCloseTo(Math.sqrt(MU * (2 / (AU * (1 - e)) - 1 / AU)), 3);
    expect(peri.speed).toBe(Math.max(...body.samples.map((s) => s.speed)));
    expect(o.units).toMatchObject({ r: 'km', speed: 'km/s' });
  });

  it("system scenario: Mercury's period is the real ~88 days (Kepler's 3rd law)", () => {
    const o = sampleOrbitPhysics({ kind: 'orbit-view', scenario: 'system' });
    const mercury = o.series.find((b) => b.name === 'mercury');
    expect(mercury.period_s / 86400).toBeCloseTo(87.97, 0);
  });
});

describe("measureViewSamples — the 'exact' tier (mathematics)", () => {
  it('derivative-view: dfx is the true derivative of fx (central-difference cross-check)', () => {
    const d = measureViewSamples({ kind: 'derivative-view', scenario: 'sine' });
    expect(d.tier).toBe('exact');
    const s = d.series[0].samples;
    for (let i = 5; i < s.length - 5; i += 24) {
      const num = (s[i + 1].fx - s[i - 1].fx) / (s[i + 1].x - s[i - 1].x);
      expect(num).toBeCloseTo(s[i].dfx, 2);
    }
  });

  it('derivative-view parabola: the limit process is exact — secant error equals h (f″/2·h with f″=2)', () => {
    const d = measureViewSamples({ kind: 'derivative-view', scenario: 'parabola', at: 1 });
    expect(d.slope).toBeCloseTo(2, 9);   // f′(1) = 2
    for (const sec of d.secants) {
      expect(Math.abs(sec.slope - d.slope)).toBeCloseTo(sec.h, 6);   // (2a+h) − 2a = h, exactly
    }
    // and the fan converges: error strictly shrinking as h shrinks
    const errs = d.secants.map((sec) => Math.abs(sec.slope - d.slope));
    for (let i = 1; i < errs.length; i++) expect(errs[i]).toBeLessThan(errs[i - 1]);
  });

  it('series-view taylor-exp: convergence rate is measurable — maxAbsError collapses with terms', () => {
    const s = measureViewSamples({ kind: 'series-view', scenario: 'taylor-exp' });
    expect(s.tier).toBe('exact');
    const errs = s.series.map((t) => t.maxAbsError);
    for (let i = 1; i < errs.length; i++) expect(errs[i]).toBeLessThan(errs[i - 1]);
  });

  it('series-view geometric: the divergence control — more terms make max error WORSE outside |x|<1', () => {
    const s = measureViewSamples({ kind: 'series-view', scenario: 'geometric' });
    const errs = s.series.map((t) => t.maxAbsError);
    expect(errs.at(-1)).toBeGreaterThan(errs[0]);
  });

  it('series-view fourier-square: Gibbs — mean error falls but max error refuses to collapse at the jump', () => {
    const s = measureViewSamples({ kind: 'series-view', scenario: 'fourier-square' });
    const t = s.series;
    expect(t.at(-1).meanAbsError).toBeLessThan(t[0].meanAbsError);
    expect(t.at(-1).maxAbsError).toBeGreaterThan(0.15);
  });
});

describe('measure_view handler — the sketch-ref surface', () => {
  it('measures a minted mechanics sketch by ref', async () => {
    const minted = mintMechanicsView({ scenario: 'projectile', v0: 18, angle: 55, g: 9.8 });
    const out = await measureViewHandler({ ref: minted.ref });
    expect(out.ok).toBe(true);
    expect(out.kind).toBe('mechanics-view');
    expect(out.series[0].samples.length).toBeGreaterThan(100);
  });

  it('throws on an unknown ref and on a missing ref', async () => {
    await expect(measureViewHandler({ ref: 'sk_nope' })).rejects.toThrow(/no sketch/);
    await expect(measureViewHandler({})).rejects.toThrow(/requires \{ ref \}/);
  });
});

describe('recomputeViewStats — the deterministic reviewer core', () => {
  it('reproduces the mechanics mint stats mapping exactly', () => {
    const minted = mintMechanicsView({ scenario: 'pendulum', length: 12, angle: 35 });
    const sketch = SketchRepository.getByRef(minted.ref);
    expect(recomputeViewStats(sketch.manifest)).toEqual(minted.stats);
  });

  it('reproduces the orbit mint stats mapping exactly', () => {
    const minted = mintOrbitView({ scenario: 'system' });
    const sketch = SketchRepository.getByRef(minted.ref);
    expect(recomputeViewStats(sketch.manifest)).toEqual(minted.stats);
  });

  it('covers mechanics branches beyond the measurable six (machines are reviewable)', () => {
    const minted = mintMechanicsView({ scenario: 'lever', armEffort: 8, armLoad: 4 });
    const sketch = SketchRepository.getByRef(minted.ref);
    expect(recomputeViewStats(sketch.manifest)).toEqual(minted.stats);
  });

  it('reproduces the math mint stats exactly (plan.stats verbatim)', () => {
    const d = mintDerivativeView({ scenario: 'sine', at: 0.5 });
    expect(recomputeViewStats(SketchRepository.getByRef(d.ref).manifest)).toEqual(d.stats);
    const s = mintSeriesView({ scenario: 'geometric' });
    expect(recomputeViewStats(SketchRepository.getByRef(s.ref).manifest)).toEqual(s.stats);
  });

  it('throws on non-reviewable kinds', () => {
    expect(() => recomputeViewStats({ kind: 'wavepacket-view' })).toThrow(/not reviewable/);
  });
});
