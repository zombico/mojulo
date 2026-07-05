process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { runExperimentSweepHandler } from './research-sweep.js';
import { startResearchHandler, getResearchHandler, synthesizeAbstractHandler } from './research-mode.js';
import { experimentsToChartManifest } from '@/lib/graph/sketch/sketch-derive';

beforeEach(() => {
  closeDb();
});

async function freshBook(title = 'range vs gravity') {
  const { research_ref } = await startResearchHandler({ title });
  return research_ref;
}

const BASE = { scenario: 'projectile', v0: 18, angle: 45 };
const GRAVITIES = [1.62, 9.8, 24.79];   // Moon, Earth, Jupiter

describe('run_experiment_sweep — the sweep as one call', () => {
  it('binds one experiment per value plus one figure, with provenance and outcomes', async () => {
    const research_ref = await freshBook();
    const out = await runExperimentSweepHandler({ research_ref, base: BASE, param: 'g', values: GRAVITIES, outcome: 'range' });
    expect(out.ok).toBe(true);
    expect(out.table).toHaveLength(3);

    const book = await getResearchHandler({ research_ref });
    const experiments = book.items.filter((it) => it.kind === 'experiment');
    const figures = book.items.filter((it) => it.kind === 'sketch');
    expect(experiments).toHaveLength(3);
    expect(figures).toHaveLength(1);
    // provenance rides every experiment: recipe pins the swept value, series orders the sweep
    experiments.forEach((it, i) => {
      expect(it.metadata.recipe.g).toBe(GRAVITIES[i]);
      expect(it.metadata.series).toMatchObject({ param: 'g', value: GRAVITIES[i], index: i });
      expect(it.metadata.stats.scenario).toBe('projectile');
    });
  });

  it('outcomes are real physics: range·g is constant at fixed v0 and angle', async () => {
    const research_ref = await freshBook();
    const out = await runExperimentSweepHandler({ research_ref, base: BASE, param: 'g', values: GRAVITIES });
    const products = out.table.map((row) => row.outcomes.range * row.value);
    // range = v0²·sin(2θ)/g → range·g = v0²·sin(2θ) = 324 for v0=18, θ=45°
    for (const p of products) expect(p).toBeCloseTo(324, 0);
    // and flight time falls as g rises
    const times = out.table.map((r) => r.outcomes.flightTime);
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
  });

  it('the auto-plot is a real minted chart: axes, polyline through every point, bound into the book', async () => {
    const research_ref = await freshBook();
    const out = await runExperimentSweepHandler({ research_ref, base: BASE, param: 'g', values: GRAVITIES, outcome: 'range' });
    const chart = SketchRepository.getByRef(out.chart.sketch_ref);
    expect(chart).toBeTruthy();
    const polyline = chart.manifest.marks.find((m) => m.kind === 'polyline');
    expect(polyline.points).toHaveLength(3);
    expect(chart.manifest.marks.filter((m) => m.kind === 'circle')).toHaveLength(3);
    expect(chart.title).toBe('projectile: range vs g');
  });

  it('a swept book reviews clean — every sweep point is a verifiable experiment', async () => {
    const research_ref = await freshBook();
    await runExperimentSweepHandler({ research_ref, base: BASE, param: 'g', values: GRAVITIES });
    const out = await synthesizeAbstractHandler({ research_ref, abstract: 'range ∝ 1/g', review: true });
    expect(out.review).toMatchObject({ items_checked: 3, consistent: true });
  });

  it('gates up front — nothing half-binds on a bad sweep', async () => {
    const research_ref = await freshBook();
    await expect(
      runExperimentSweepHandler({ research_ref, base: BASE, param: 'flywheelR', values: [1, 2] }),
    ).rejects.toThrow(/not sweepable/);
    await expect(
      runExperimentSweepHandler({ research_ref, base: { scenario: 'lever' }, param: 'g', values: [1, 2] }),
    ).rejects.toThrow(/no single-body dynamics rule/);
    await expect(
      runExperimentSweepHandler({ research_ref, base: BASE, param: 'g', values: [9.8] }),
    ).rejects.toThrow(/2–12/);
    await expect(
      runExperimentSweepHandler({ research_ref, base: { kind: 'orbit-view', scenario: 'system' }, param: 'g', values: [1, 2] }),
    ).rejects.toThrow(/mechanics-view recipes only/);

    const book = await getResearchHandler({ research_ref });
    expect(book.items).toHaveLength(0);
  });
});

describe('run_experiment_sweep — experimental mathematics, zero new machinery', () => {
  // The pendulum's amplitude-dependence is a real result in classical analysis: the exact
  // period is an elliptic integral, T(θ₀) = 2π√(L/g)·(1 + θ₀²/16 + 11θ₀⁴/3072 + …). The
  // RK4 rule is honest about large angles, so sweeping the release angle materializes that
  // correction as data — a mathematical experiment run entirely through the notebook verb.
  it('pendulum period vs release angle traces the elliptic-integral correction', async () => {
    const research_ref = await freshBook('pendulum isochronism breakdown');
    const L = 12, g = 9.8;
    const ANGLES = [10, 25, 40, 55, 70];   // degrees
    const out = await runExperimentSweepHandler({
      research_ref, base: { scenario: 'pendulum', length: L, g }, param: 'angle', values: ANGLES,
    });

    const T0 = 2 * Math.PI * Math.sqrt(L / g);   // small-angle period
    out.table.forEach((row, i) => {
      const th = (ANGLES[i] * Math.PI) / 180;
      const series = T0 * (1 + (th * th) / 16 + (11 * th ** 4) / 3072);
      expect(row.outcomes.flightTime).toBeCloseTo(series, 1);
      expect(Math.abs(row.outcomes.flightTime - series) / series).toBeLessThan(0.005);
    });
    // and the qualitative shape: period grows monotonically with amplitude (isochronism fails)
    const periods = out.table.map((r) => r.outcomes.flightTime);
    for (let i = 1; i < periods.length; i++) expect(periods[i]).toBeGreaterThan(periods[i - 1]);
    // the measured correction at 70° is ~10% — far beyond sampling noise
    expect(periods.at(-1) / T0).toBeGreaterThan(1.08);
  });

  it('spring isochronism holds — the null result: period is flat across amplitude', async () => {
    const research_ref = await freshBook('spring isochronism');
    const out = await runExperimentSweepHandler({
      research_ref, base: { scenario: 'spring', k: 12, mass: 1 }, param: 'amplitude', values: [2, 6, 12, 24],
    });
    const T = 2 * Math.PI / Math.sqrt(12 / 1);
    for (const row of out.table) expect(row.outcomes.flightTime).toBeCloseTo(T, 6);
  });
});

describe('experimentsToChartManifest — the pure auto-plot derive', () => {
  it('is deterministic and sorts points by x', () => {
    const spec = { title: 't', param: 'g', outcome: 'range', points: [{ x: 9.8, y: 33 }, { x: 1.62, y: 200 }] };
    const a = experimentsToChartManifest(spec), b = experimentsToChartManifest(spec);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const poly = a.marks.find((m) => m.kind === 'polyline');
    expect(poly.points[0][0]).toBeLessThan(poly.points[1][0]);   // left-to-right in x
  });

  it('refuses fewer than 2 points', () => {
    expect(() => experimentsToChartManifest({ param: 'g', outcome: 'range', points: [{ x: 1, y: 2 }] })).toThrow(/>= 2/);
  });
});
