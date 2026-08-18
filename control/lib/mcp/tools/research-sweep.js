/**
 * run_experiment_sweep — the parameter sweep as a first-class research object (Ring 9).
 *
 * A parameter sweep is what every quantitative question actually is ("what happens to X as
 * I vary Y?"), and before this verb it lived as N manual mints + N manual binds with the
 * discipline documented only in the numerical-experiment-notebook catalyst. This tool
 * formalizes that loop in one deterministic call: per swept value it mints the science
 * view, derives SI outcomes from the measure channel, and binds one provenance-carrying
 * `experiment` item; then it auto-plots param-vs-outcome (experimentsToChartManifest — a
 * pure derive, sibling of the research hub-spoke) and binds the figure as a `sketch` item.
 * The book ends the call holding the whole experiment: hypothesis-ready inputs, N
 * reproducible runs, one comparative figure.
 *
 * v0 sweeps mechanics-view DYNAMICS recipes only — the SI-honest, single-body scenarios
 * the sampler accepts. Orbit scenarios are presets with nothing numeric to sweep; the
 * non-SI views are excluded by the same honesty boundary measure_view enforces. Gates run
 * up front (session, param allowlist, scenario measurable via a dry sample of the base
 * recipe) so a sweep never half-binds into the book on a bad recipe.
 *
 * Coupling: imports research-mode's bind handler (same ring, same gate the agent would
 * hit), the mechanics mint, and the graph-side sampler/derive. Nothing here is imported
 * by plan mode or the views — the one-way discipline holds. See research-science.plan.md
 * (Phase 5).
 */

import { registerTool } from '@/lib/mcp/server';
import { ResearchRepository } from '@/lib/db/repositories/research';
import { bindResearchItemHandler } from '@/lib/mcp/tools/research-mode';
import { mintMechanicsView } from '@/lib/mcp/tools/mechanics-view';
import { mintSketch } from '@/lib/mcp/tools/sketches';
import { sampleMechanicsPhysics, MEASURABLE_MECHANICS_SCENARIOS } from '@/lib/graph/views/science/mechanics-view';
import { experimentsToChartManifest } from '@/lib/graph/sketch/sketch-derive';

// the sweepable knobs — the numeric params the dynamics rules actually read (mirrors
// sampleMechanicsPhysics's P). Sweeping anything else would mint N identical worlds.
const SWEEPABLE_PARAMS = new Set(['v0', 'angle', 'g', 'mu', 'length', 'height', 'mass', 'k', 'amplitude', 'radius', 'curl', 'spin', 'diameter', 'density']);

const MIN_POINTS = 2;
const MAX_POINTS = 12;

// per-run outcomes, all derived from the SI series (never the render path). flightTime is
// the rule's T (period for looping scenarios); range is horizontal displacement.
const OUTCOMES = {
  flightTime: (m) => +m.T.toFixed(6),
  range: (m) => {
    const first = m.samples[0].pos, last = m.samples[m.samples.length - 1].pos;
    return +Math.hypot(last[0] - first[0], last[1] - first[1]).toFixed(6);
  },
  maxHeight: (m) => +Math.max(...m.samples.map((s) => s.pos[2])).toFixed(6),
  maxSpeed: (m) => +Math.max(...m.samples.map((s) => s.speed)).toFixed(6),
  // lateral bend off the aim line (flight: the Magnus curl; planar scenarios read 0).
  curl: (m) => +Math.max(...m.samples.map((s) => Math.abs(s.pos[1]))).toFixed(6),
};
const OUTCOME_UNITS = { flightTime: 's', range: 'm', maxHeight: 'm', maxSpeed: 'm/s', curl: 'm' };

export async function runExperimentSweepHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('run_experiment_sweep requires an object with research_ref, base, param, values');
  }
  const { research_ref, base, param, values, outcome } = input;
  if (!research_ref || typeof research_ref !== 'string') throw new Error('research_ref is required');
  const session = ResearchRepository.getSession(research_ref);
  if (!session) throw new Error(`Research session '${research_ref}' not found.`);
  if (!base || typeof base !== 'object') throw new Error('base is required — a mechanics-view recipe object ({ scenario, … })');
  if (base.kind !== undefined && base.kind !== 'mechanics-view') {
    throw new Error(`run_experiment_sweep v0 sweeps mechanics-view recipes only (got kind '${base.kind}').`);
  }
  if (!SWEEPABLE_PARAMS.has(param)) {
    throw new Error(`param '${param}' is not sweepable. Sweepable params: ${[...SWEEPABLE_PARAMS].join(', ')}.`);
  }
  const vals = Array.isArray(values) ? values.filter((v) => Number.isFinite(+v)).map(Number) : [];
  if (vals.length < MIN_POINTS || vals.length > MAX_POINTS) {
    throw new Error(`values must be ${MIN_POINTS}–${MAX_POINTS} finite numbers (got ${vals.length}).`);
  }
  const plotOutcome = outcome === undefined ? 'flightTime' : outcome;
  if (!OUTCOMES[plotOutcome]) {
    throw new Error(`outcome '${outcome}' is unknown. Outcomes: ${Object.keys(OUTCOMES).join(', ')}.`);
  }

  // dry gate: the base recipe must be measurable BEFORE anything binds (rejects machines /
  // engines / compare here, with the sampler's own message).
  sampleMechanicsPhysics({ ...base, [param]: vals[0] });

  const scenario = MEASURABLE_MECHANICS_SCENARIOS.includes(base.scenario) ? base.scenario : 'projectile';
  const table = [];
  for (let index = 0; index < vals.length; index++) {
    const value = vals[index];
    const minted = mintMechanicsView({ ...base, [param]: value, title: `${scenario} — ${param}=${value}` });
    const measured = sampleMechanicsPhysics(minted.recipe);
    const outcomes = Object.fromEntries(Object.entries(OUTCOMES).map(([k, fn]) => [k, fn(measured)]));
    const bound = await bindResearchItemHandler({
      research_ref,
      kind: 'experiment',
      title: `${scenario} — ${param}=${value}`,
      media_ref: minted.ref,
      metadata: { recipe: minted.recipe, stats: minted.stats, series: { param, value, index }, outcomes },
    });
    table.push({ value, ref: minted.ref, item_id: bound.item_id, outcomes });
  }

  // auto-plot: param vs the chosen outcome, minted and bound as the sweep's figure.
  const chartTitle = `${scenario}: ${plotOutcome} vs ${param}`;
  const manifest = experimentsToChartManifest({
    title: chartTitle,
    param,
    outcome: plotOutcome,
    unitY: OUTCOME_UNITS[plotOutcome],
    points: table.map((row) => ({ x: row.value, y: row.outcomes[plotOutcome] })),
  });
  const { ref: chartRef } = mintSketch({ title: chartTitle, manifest });
  const chartBound = await bindResearchItemHandler({
    research_ref,
    kind: 'sketch',
    title: chartTitle,
    media_ref: chartRef,
    metadata: { series: { param, outcome: plotOutcome, points: table.length } },
  });

  return {
    ok: true,
    research_ref,
    scenario,
    param,
    outcome: plotOutcome,
    table,
    chart: { sketch_ref: chartRef, sketch_url: `/sketches/${encodeURIComponent(chartRef)}`, item_id: chartBound.item_id },
    message: `Swept ${param} over ${vals.length} points — ${vals.length} experiment items + 1 figure bound to '${session.title}'. Bind your comparative analysis as a summary, then synthesize_abstract({ review: true }).`,
  };
}

export function registerResearchSweepTools() {
  registerTool({
    name: 'run_experiment_sweep',
    description:
      "Ring 9 — run a PARAMETER SWEEP as one deterministic call: 'what happens to X as I vary Y?'. "
      + 'Per swept value it mints a mechanics-view world, derives SI outcomes (flightTime s, range m, '
      + 'maxHeight m, maxSpeed m/s, curl m), and binds one provenance-carrying `experiment` item; then '
      + 'auto-plots param-vs-outcome as a chart sketch and binds the figure. Returns the comparative '
      + 'table + all refs. Dynamics scenarios only (projectile / free-fall / inclined-plane / pendulum / '
      + 'spring / circular / flight; params: v0, angle, g, mu, length, height, mass, k, amplitude, '
      + 'radius, curl, spin, diameter, density; 2–12 points) — the SI-honesty boundary measure_view '
      + 'enforces; flight makes aerodynamics sweepable (curl vs curl = Magnus saturation). Gates up '
      + 'front, so a bad recipe never half-binds. Follow with a `summary` item and '
      + 'synthesize_abstract({ review: true }).',
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session (lab notebook) to bind the sweep into.' },
        base: { type: 'object', description: "The mechanics-view recipe held constant, e.g. { scenario: 'projectile', v0: 18, angle: 45 }. The swept param may be omitted here." },
        param: { type: 'string', enum: ['v0', 'angle', 'g', 'mu', 'length', 'height', 'mass', 'k', 'amplitude', 'radius', 'curl', 'spin', 'diameter', 'density'], description: 'The knob to vary.' },
        values: { type: 'array', items: { type: 'number' }, description: 'The 2–12 values to sweep (each mints one world + binds one experiment).' },
        outcome: { type: 'string', enum: ['flightTime', 'range', 'maxHeight', 'maxSpeed', 'curl'], description: "Which outcome the auto-plot charts (default 'flightTime'). The table always carries all five." },
      },
      required: ['research_ref', 'base', 'param', 'values'],
    },
    handler: runExperimentSweepHandler,
  });
}
