/**
 * measure_view — the physical READ-BACK channel for the science views.
 *
 * A science-view sketch is a reproducible experiment: the stored manifest IS the exact initial
 * conditions, and the planner recomputes the full trajectory on every render — then throws it
 * away. Until now the only measurement surfaces were the operator-facing click-to-pick readout
 * (invisible to the MCP caller) and the thin `stats` digest returned once at mint time. This tool
 * closes that gap: re-plan deterministically from the stored recipe and return the time-series as
 * data — positions, speeds, accelerations (and energies where the scenario carries them), every
 * value in declared real units.
 *
 * The honesty boundary, enforced rather than documented: only kinds whose numbers are real SI are
 * measurable. mechanics-view dynamics run in metres/seconds (RK4 pendulum, analytic SHM, ballistic
 * arcs); orbit-view runs Kepler's equation with the real μ (positions recomputed in km — the
 * RENDERED orbit path is the compressed orrery and is never sampled). The double-slit / gravity-
 * wave / wavepacket views are structurally correct but in render units or exaggerated amplitude —
 * they refuse, because samples with lying units are worse than no samples.
 *
 * Also exports `recomputeViewStats` — the deterministic reviewer used by research mode's
 * synthesize_abstract({ review: true }): recompute a bound experiment's stats digest from its
 * stored manifest and compare against the snapshot captured at bind time (the machina
 * forward+verify posture applied to the research book). See research-science.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planMechanicsScene, sampleMechanicsPhysics } from '@/lib/graph/views/science/mechanics-view';
import { planOrbitScene, sampleOrbitPhysics } from '@/lib/graph/views/science/orbit-view';
import { planDerivativeScene, sampleDerivativeExact } from '@/lib/graph/views/math/derivative-view';
import { planSeriesScene, sampleSeriesExact } from '@/lib/graph/views/math/series-view';

// kinds with an honest sampler, in two tiers: 'si' (real physical units — mechanics
// dynamics, orbits) and 'exact' (pure mathematics — no unit problem at all, every value
// the true value of the implemented expression). Growing this set means writing a sampler
// beside the kind's planner (pure, honest numbers) and dispatching it here.
export const MEASURABLE_VIEW_KINDS = new Set(['mechanics-view', 'orbit-view', 'derivative-view', 'series-view']);

// kinds whose mint-time stats digest can be recomputed byte-deterministically from the manifest.
// Broader than MEASURABLE within mechanics (stats recompute works for machine/engine/collision
// scenarios too, since planMechanicsScene covers every branch).
export const REVIEWABLE_VIEW_KINDS = new Set(['mechanics-view', 'orbit-view', 'derivative-view', 'series-view']);

/**
 * Recompute the stats digest a create_* mint returned, from a stored manifest. Must reproduce the
 * mint tool's stats mapping EXACTLY (same fields, same rounding) — the reviewer compares these
 * against the snapshot bound into a research book, and a mapping drift here would read as a
 * physics drift there.
 */
export function recomputeViewStats(manifest) {
  const kind = manifest && typeof manifest === 'object' ? manifest.kind : undefined;
  if (kind === 'mechanics-view') {
    const plan = planMechanicsScene(manifest);
    return { scenario: plan.stats.scenario, g: plan.stats.g, flightTime: +plan.stats.T.toFixed(3), loop: plan.stats.loop, faces: plan.faces.length };
  }
  if (kind === 'orbit-view') {
    const plan = planOrbitScene(manifest);
    return { scenario: plan.stats.scenario, bodies: plan.stats.bodies, faces: plan.faces.length };
  }
  // the math mints return plan.stats verbatim — recompute is the planner's stats, whole.
  if (kind === 'derivative-view') return planDerivativeScene(manifest).stats;
  if (kind === 'series-view') return planSeriesScene(manifest).stats;
  throw new Error(
    `recomputeViewStats: kind '${kind}' is not reviewable. Reviewable kinds: ${[...REVIEWABLE_VIEW_KINDS].join(', ')}.`,
  );
}

/**
 * Sample the physical time-series for a manifest. Uniform result shape across kinds:
 * { kind, scenario, units, series: [{ name, label, samples, count, … }] } plus per-kind extras.
 */
export function measureViewSamples(manifest, { every = 1 } = {}) {
  const kind = manifest && typeof manifest === 'object' ? manifest.kind : undefined;
  if (kind === 'mechanics-view') {
    const m = sampleMechanicsPhysics(manifest, { every });
    return {
      kind, tier: 'si', scenario: m.scenario, units: m.units, dt: m.dt, T: m.T, loop: m.loop, static: m.static,
      facts: m.facts,
      series: [{ name: 'body', label: m.label, samples: m.samples, count: m.count }],
    };
  }
  if (kind === 'orbit-view') {
    const o = sampleOrbitPhysics(manifest, { every });
    return { kind, tier: 'si', scenario: o.scenario, units: o.units, mu_km3_s2: o.mu_km3_s2, series: o.series };
  }
  if (kind === 'derivative-view') {
    const d = sampleDerivativeExact(manifest, { every });
    return {
      kind, tier: 'exact', scenario: d.scenario, units: d.units, domain: d.domain, rule: d.rule,
      at: d.at, fAt: d.fAt, slope: d.slope, secants: d.secants,
      series: [{ name: 'f', label: d.label, samples: d.samples, count: d.count }],
    };
  }
  if (kind === 'series-view') {
    const s = sampleSeriesExact(manifest, { every });
    return { kind, tier: 'exact', scenario: s.scenario, units: s.units, domain: s.domain, family: s.family, series: s.series };
  }
  throw new Error(
    `measure_view: kind '${kind}' has no honest read-back channel — its numbers are render units `
    + `or presets, so samples would lie. Measurable kinds: ${[...MEASURABLE_VIEW_KINDS].join(', ')}.`,
  );
}

export async function measureViewHandler(input) {
  if (!input || typeof input !== 'object' || !input.ref || typeof input.ref !== 'string') {
    throw new Error('measure_view requires { ref } — the sketch ref of a science-view artifact');
  }
  const sketch = SketchRepository.getByRef(input.ref);
  if (!sketch) throw new Error(`measure_view: no sketch with ref '${input.ref}'`);
  const result = measureViewSamples(sketch.manifest, { every: input.every });
  return { ok: true, ref: sketch.ref, title: sketch.title, ...result };
}

export function registerMeasureViewTools() {
  registerTool({
    name: 'measure_view',
    description:
      'Read the physical TIME-SERIES back out of a science-view sketch — the measurement channel the '
      + 'render never exposes. Re-plans deterministically from the stored recipe (same recipe → same '
      + 'numbers as the in-world readout) and returns per-sample data in DECLARED REAL UNITS: '
      + "mechanics-view dynamics (projectile / free-fall / inclined-plane / pendulum / spring / circular) "
      + 'as { t, pos, speed, accel, ke, pe } in s / m / m·s⁻¹ / m·s⁻² / J; orbit-view bodies as '
      + '{ t, pos, r, speed, accel } in s / km / km·s⁻¹ (vis-viva) with positions recomputed at TRUE '
      + "scale (the rendered orrery is compressed; samples are not). Math views measure at tier 'exact' "
      + '(pure values, no unit problem): derivative-view returns { x, fx, dfx } samples plus the secant '
      + 'slopes converging on f′(a) (the limit process as data); series-view returns per-term-count '
      + '{ x, fx, snx, err } samples with max/mean absolute error (convergence RATES are measurable — '
      + 'Taylor error collapsing, the geometric control diverging, Gibbs refusing to shrink). Only '
      + 'honest kinds are measurable — other views (double-slit, gravity-wave, wavepacket, '
      + 'machines/engines) refuse rather than return render-unit numbers. `every` downsamples '
      + '(default 1 = all samples). Composes with research mode: bind the view as an `experiment` '
      + 'item, cite measure_view samples in your analysis. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The science-view sketch ref (from create_view / create_mechanics_view / create_orbit_view).' },
        every: { type: 'number', description: 'Downsample interval — return every Nth sample (default 1 = all).' },
      },
      required: ['ref'],
    },
    handler: measureViewHandler,
  });
}
