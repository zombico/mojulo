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
import { planRocketScene, sampleRocketPhysics } from '@/lib/graph/views/science/rocket-view';
import { planAirplaneScene, sampleAirplanePhysics } from '@/lib/graph/views/science/airplane-view';
import { planOrbitScene, sampleOrbitPhysics } from '@/lib/graph/views/science/orbit-view';
import { planDerivativeScene, sampleDerivativeExact } from '@/lib/graph/views/math/derivative-view';
import { planSeriesScene, sampleSeriesExact } from '@/lib/graph/views/math/series-view';
import { solveClassical, classicalStats } from '@/lib/graph/science-worlds/classical/solve';
import { solveMicroscopic, microscopicStats } from '@/lib/graph/science-worlds/microscopic/solve';
import { solveQuantum, quantumStats } from '@/lib/graph/science-worlds/quantum/solve';
import { solveRelativistic, relativisticStats } from '@/lib/graph/science-worlds/relativistic/solve';

// kinds with an honest sampler, in two tiers: 'si' (real physical units — mechanics
// dynamics, orbits) and 'exact' (pure mathematics — no unit problem at all, every value
// the true value of the implemented expression). Growing this set means writing a sampler
// beside the kind's planner (pure, honest numbers) and dispatching it here.
export const MEASURABLE_VIEW_KINDS = new Set(['mechanics-view', 'rocket-view', 'airplane-view', 'orbit-view', 'derivative-view', 'series-view', 'classical-view', 'microscopic-view', 'quantum-view', 'relativistic-view']);

// kinds whose mint-time stats digest can be recomputed byte-deterministically from the manifest.
// Broader than MEASURABLE within mechanics (stats recompute works for machine/engine/collision
// scenarios too, since planMechanicsScene covers every branch).
export const REVIEWABLE_VIEW_KINDS = new Set(['mechanics-view', 'rocket-view', 'airplane-view', 'orbit-view', 'derivative-view', 'series-view', 'classical-view', 'microscopic-view', 'quantum-view', 'relativistic-view']);

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
  if (kind === 'rocket-view') {
    const plan = planRocketScene(manifest);
    return {
      scenario: plan.stats.scenario, payload: plan.stats.payload, flightTime: plan.stats.T,
      mecoV: plan.stats.mecoV, apogeeKm: plan.stats.apogeeKm,
      touchdownV: plan.stats.touchdownV, touchdownX: plan.stats.touchdownX,
      faces: plan.faces.length,
    };
  }
  if (kind === 'airplane-view') {
    const plan = planAirplaneScene(manifest);
    return {
      mission: plan.stats.mission, plane: plan.stats.plane, flightTime: plan.stats.T,
      groundRoll: plan.stats.groundRoll, touchdownSink: plan.stats.touchdownSink,
      rangeKm: plan.stats.rangeKm, glideRatio: plan.stats.glideRatio,
      faces: plan.faces.length,
    };
  }
  if (kind === 'orbit-view') {
    const plan = planOrbitScene(manifest);
    return { scenario: plan.stats.scenario, bodies: plan.stats.bodies, faces: plan.faces.length };
  }
  // the math mints return plan.stats verbatim — recompute is the planner's stats, whole.
  if (kind === 'derivative-view') return planDerivativeScene(manifest).stats;
  if (kind === 'series-view') return planSeriesScene(manifest).stats;
  // a classical world: the solver's stats and its gates' verdicts (the model alone; the dress never reaches the solver)
  if (kind === 'classical-view') {
    return classicalStats(solveClassical({ model: manifest.model }));
  }
  if (kind === 'microscopic-view') return microscopicStats(solveMicroscopic({ model: manifest.model }));
  if (kind === 'quantum-view') return quantumStats(solveQuantum({ model: manifest.model }));
  if (kind === 'relativistic-view') return relativisticStats(solveRelativistic({ model: manifest.model }));
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
  if (kind === 'rocket-view') {
    const r = sampleRocketPhysics(manifest, { every });
    return {
      kind, tier: 'si', scenario: r.scenario, units: r.units, dt: r.dt, T: r.T, loop: r.loop, static: r.static,
      facts: r.facts,
      series: [{ name: 'booster', label: r.label, samples: r.samples, count: r.count }],
    };
  }
  if (kind === 'airplane-view') {
    const a = sampleAirplanePhysics(manifest, { every });
    return {
      kind, tier: 'si', scenario: a.scenario, units: a.units, dt: a.dt, T: a.T, loop: a.loop, static: a.static,
      facts: a.facts,
      series: [{ name: 'plane', label: a.label, samples: a.samples, count: a.count }],
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
  if (kind === 'classical-view') return sampleClassical(manifest, every);
  if (kind === 'microscopic-view') return sampleMicroscopic(manifest, every);
  if (kind === 'quantum-view') return sampleQuantum(manifest, every);
  if (kind === 'relativistic-view') return sampleRelativistic(manifest, every);
  throw new Error(
    `measure_view: kind '${kind}' has no honest read-back channel — its numbers are render units `
    + `or presets, so samples would lie. Measurable kinds: ${[...MEASURABLE_VIEW_KINDS].join(', ')}.`,
  );
}

// a classical world's samples: every body's { t, pos, vel, speed } and the system's { t, ke, pe, e, p, L }, in SI,
// straight from the solver's recorded run (the same samples the page plays), with its gates beside them
function sampleClassical(manifest, every) {
  const r = solveClassical({ model: manifest.model });
  const step = Math.max(1, Math.floor(+every) || 1), t = r.tracks.t;
  const keep = t.map((x, k) => k).filter((k) => k % step === 0 || k === t.length - 1);
  return {
    kind: 'classical-view', tier: 'si', scenario: 'composed',
    units: { t: 's', pos: 'm', vel: 'm/s', speed: 'm/s', ke: 'J', pe: 'J', e: 'J', p: 'kg·m/s', L: 'kg·m²/s' },
    T: r.model.duration, dt: r.dt, stepper: r.stepper, held: r.held,
    gates: r.gates.map((g) => ({ id: g.id, ok: g.ok, value: g.value })),
    observed: r.observed,
    series: [
      ...r.model.bodies.map((b) => {
        const tr = r.tracks.bodies[b.id];
        const samples = keep.map((k) => ({ t: t[k], pos: tr.x[k], vel: tr.v[k], speed: +Math.hypot(...tr.v[k]).toPrecision(9) }));
        return { name: b.id, label: b.fixed ? `${b.id} (fixed)` : b.id, samples, count: samples.length };
      }),
      { name: 'system', label: 'the whole system', samples: keep.map((k) => ({ t: t[k], ke: r.series.ke[k], pe: r.series.pe[k], e: r.series.e[k], p: r.series.p[k], L: r.series.L[k] })), count: keep.length },
    ],
  };
}

// a microscopic world's samples: every species' count, its share on the near side of each membrane, and the variance
// of its displacement (6·D·t while it diffuses freely), in SI, from the same seeded run the page plays
function sampleMicroscopic(manifest, every) {
  const r = solveMicroscopic({ model: manifest.model });
  const step = Math.max(1, Math.floor(+every) || 1), t = r.tracks.t;
  const keep = t.map((x, k) => k).filter((k) => k % step === 0 || k === t.length - 1);
  return {
    kind: 'microscopic-view', tier: 'si', scenario: 'composed',
    units: { t: 's', count: 'molecules', near: 'molecules', spread: 'm²', D: 'm²/s' },
    T: r.model.duration, dt: r.dt, seed: r.model.seed, held: r.held,
    gates: r.gates.map((g) => ({ id: g.id, ok: g.ok, value: g.value })),
    observed: r.observed,
    series: r.model.species.map((sp, s) => {
      const samples = keep.map((k) => ({
        t: t[k], count: r.series.counts[sp.id][k], spread: r.series.msd[sp.id][k],
        ...(r.series.sides.length ? { near: r.series.sides.map((m) => m[sp.id][k]) } : {}),
      }));
      return { name: sp.id, label: sp.id, D: r.D[s], samples, count: samples.length };
    }),
  };
}

// a quantum world's samples, per system, from the same run the page plays: a line's ⟨x⟩, spread, ⟨E⟩, total probability
// and the share past its barrier or step (with the allowed levels when it has them); an atom's orbitals, their exact
// energies and mean radii beside what the drawn cloud measures; each magnet's counts beside the odds; the nuclei left
function sampleQuantum(manifest, every) {
  const r = solveQuantum({ model: manifest.model });
  const step = Math.max(1, Math.floor(+every) || 1), m = r.model;
  const thin = (n) => Array.from({ length: n }, (_, k) => k).filter((k) => k % step === 0 || k === n - 1);
  const head = {
    kind: 'quantum-view', tier: 'si', scenario: 'composed', system: r.system, seed: m.seed, held: r.held,
    gates: r.gates.map((g) => ({ id: g.id, ok: g.ok, value: g.value })),
    observed: r.observed, sources: r.sources, reviewed: r.reviewed,
  };
  if (r.system === 'line') {
    const s = r.run.series, keep = thin(s.t.length);
    return {
      ...head, units: { t: 's', x: 'm', spread: 'm', E: 'eV', norm: 'probability', past: 'probability', levels: 'eV' },
      T: m.duration * 1e-15, ...(r.run.levels ? { levels: r.run.levels } : {}),
      series: [{ name: 'particle', label: m.particle, count: keep.length, samples: keep.map((k) => ({
        t: s.t[k] * 1e-15, x: s.x[k] * 1e-9, spread: s.sigma[k] * 1e-9, E: s.E[k], norm: s.norm[k], ...(r.run.cut !== null ? { past: s.right[k] } : {}),
      })) }],
    };
  }
  if (r.system === 'atom') {
    const A0 = 5.29177210903e-11;
    return {
      ...head, units: { energy: 'eV', radius: 'm', pos: 'm' },
      series: r.run.clouds.map((c) => {
        const keep = thin(c.points.length);
        const measured = c.points.reduce((a, p) => a + Math.hypot(...p), 0) / c.points.length;
        return {
          name: c.name, label: c.name, n: c.n, l: c.l, m: c.m, energy: c.energy, meanRadius: c.meanR * A0, measuredMeanRadius: measured * A0,
          radialNodes: c.n - c.l - 1, angularNodes: c.l, count: keep.length,
          samples: keep.map((k) => ({ pos: c.points[k].map((x) => x * A0), sign: c.signs[k] })),
        };
      }),
    };
  }
  if (r.system === 'spin') {
    return {
      ...head, units: { reached: 'atoms', up: 'atoms', down: 'atoms', expected: 'atoms' },
      series: r.run.stages.map((e, k) => ({ name: `magnet ${k + 1}`, label: `magnet ${k + 1} (${m.magnets[k].name})`, axis: m.magnets[k].axis, keep: m.magnets[k].keep,
        count: 1, samples: [{ reached: e.reached, up: e.up, down: e.reached - e.up, expected: e.expected, sd: e.sd }] })),
    };
  }
  const keep = thin(r.run.t.length);
  return {
    ...head, units: { t: 's', left: 'nuclei', decayed: 'nuclei' }, T: m.duration, half_life: m.halfLife,
    series: [{ name: 'nuclei', label: 'the nuclei', count: keep.length, samples: keep.map((k) => ({ t: r.run.t[k], left: r.run.left[k], decayed: m.nuclei - r.run.left[k] })) }],
  };
}

// a relativistic world's samples, in SI: each body's far-clock time, position, radius and own time (orbit); each
// clock's own time against the far clock's (clocks); a light world's quantities (it has no motion to sample)
function sampleRelativistic(manifest, every) {
  const r = solveRelativistic({ model: manifest.model });
  const m = r.model, step = Math.max(1, Math.floor(+every) || 1);
  const thin = (n) => Array.from({ length: n }, (_, k) => k).filter((k) => k % step === 0 || k === n - 1);
  const head = {
    kind: 'relativistic-view', tier: 'si', scenario: 'composed', system: r.system, held: r.held,
    gates: r.gates.map((g) => ({ id: g.id, ok: g.ok, value: g.value })),
    observed: r.observed, sources: r.sources, reviewed: r.reviewed, rs: m.rs,
  };
  if (r.system === 'light') return { ...head, units: {}, series: [] };
  if (r.system === 'orbit') {
    return {
      ...head, units: { t: 's', pos: 'm', r: 'm', tau: 's' }, T: m.duration,
      series: r.run.runs.map((q) => {
        const keep = thin(q.run.t.length);
        return { name: q.id, label: q.id, fate: q.run.fate, count: keep.length, samples: keep.map((k) => ({ t: q.run.t[k] * m.tUnit, pos: q.run.x[k].map((c) => c * m.rs), r: q.run.r[k] * m.rs, tau: q.run.tau[k] * m.tUnit })) };
      }),
    };
  }
  const keep = thin(r.run.t.length);
  return {
    ...head, units: { t: 's', tau: 's', r: 'm' }, T: m.duration,
    series: r.run.clocks.map((c) => ({ name: c.id, label: c.falls ? `falls from ${c.at * m.rs} m` : `at ${c.at * m.rs} m`, falls: c.falls, ...(c.falls ? {} : { rate: c.rate }), count: keep.length,
      samples: keep.map((k) => ({ t: r.run.t[k] * m.tUnit, tau: c.tau[k] * m.tUnit, r: c.r[k] * m.rs })) })),
  };
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
      + 'as { t, pos, speed, accel, ke, pe } in s / m / m·s⁻¹ / m·s⁻² / J; rocket-view missions add '
      + 'mass/thrust/drag/q (kg / N / Pa) with the mission events in the facts; orbit-view bodies as '
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
