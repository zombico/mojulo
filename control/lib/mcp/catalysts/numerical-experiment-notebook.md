---
{
  "id": "numerical-experiment-notebook",
  "name": "Numerical experiment notebook",
  "summary": "Run a quantitative physics question as a parameter sweep over the SI-honest science views, bind every run into a research book as a provenance-carrying experiment, and synthesize a reviewed, reproducible finding.",
  "valueHook": "Turn 'what happens to X as I vary Y?' into a lab notebook: every run reproducible from its recipe, every number in real units, the whole book deterministically re-verifiable at synthesis.",
  "version": 1,
  "category": "research-science",
  "tier": "design",
  "parameters": [
    {
      "name": "question",
      "prompt": "The quantitative question, with the varied parameter and its range (e.g. 'how does projectile range change from Moon to Jupiter gravity, v0=18 m/s, 45°?')"
    },
    {
      "name": "sweepPoints",
      "prompt": "How many points across the range? (each is one minted view + one bound experiment)",
      "default": 5
    }
  ],
  "mcpTools": {
    "mojulo": ["start_research", "run_experiment_sweep", "create_view", "bind_research_item", "measure_view", "synthesize_abstract", "get_research"]
  }
}
---

# Numerical experiment notebook

The mapping insight this catalyst earns its shelf spot with: **a research book is a lab
notebook, and a parameter sweep is just repeated mints.** The science views are not
illustrations — each one is a deterministic simulation whose stored recipe IS the exact
initial conditions (same recipe → byte-identical world) and whose `stats` digest is the
measured outcome. Bound into a research book with its provenance, a view becomes a citable,
re-runnable experiment. Nobody designed research mode as a lab bench; the primitives
compose that way, and this catalyst is the composition written down.

## The honesty boundary (read before promising anything)

The instruments are the **science worlds** composed from laws: `classical`, `microscopic`, `quantum` and
`relativistic` (`get_view_vocab({ id: 'classical' })` and its siblings). Every model is in SI with its units checked,
every run carries its gates (conservation, the textbook answer, the regime it holds in), and `measure_view` reads each
at tier `si`. A projectile, a pendulum, an orbit, a wave packet, the double slit, a liquid setting, a protein
assembling: each is a model there, its starting conditions written into its recipe. The older `mechanics-view`
dynamics scenarios are instruments too, and the one-call experiment form below still sweeps them. The ready-made
depictors (a ripple tank, gravity waves, machines and engines, a spinning black hole) are pictures, not instruments:
`measure_view` refuses them by design. If the question needs one of them for a *quantitative* answer, say so and
stop — do not dress a depictor up as an instrument.

Also scope-check the question itself: a law the table lacks comes back as a **gap** naming the scale that owns it,
and a regime gate says when the model has left its ground. A question outside the posable surface is a finding too —
report it rather than approximating.

## The workflow

1. **Pose.** `start_research({ title: <the question> })`. Bind the question and the sweep
   design (varied parameter, range, held-constant values) as a `note` — the book's first
   item is the hypothesis, so the notebook records what was asked before what was found.

2. **Sweep.** Mint the science world once (`create_view` with kind `classical`, …), then vary
   it: `run_experiment_sweep({ ref, path, values })` mints one variant per value at a JSON Pointer
   into its recipe (`/model/frame/g`, `/model/bodies/0/v/0`), varying ONLY the swept parameter,
   all in one folder. Bind each variant as its own experiment item, provenance verbatim (for the
   older mechanics-view dynamics, the one-call `run_experiment_sweep({ research_ref, base, param,
   values, outcome })` mints, binds and plots in one step):

   ```
   bind_research_item({
     research_ref, kind: 'experiment',
     title: '<scenario>, <param>=<value>',
     media_ref: <ref from the mint response>,
     metadata: { recipe: <recipe from the response>, stats: <stats from the response> }
   })
   ```

   The gate rejects an experiment without its recipe — that is the point, not a hurdle.

3. **Measure.** Where the stats digest is too coarse for the question (you need the
   trajectory, the speed profile, energy exchange), call `measure_view({ ref })` and use
   the returned time-series — every value in declared real units. Cite the numbers you
   actually use in the next step's summary so the book holds them.

4. **Analyze.** Bind the comparative analysis as a `summary` item: the trend across the
   sweep, the numbers behind it, and any closed-form check you can make (e.g. range
   ∝ 1/g at fixed v₀ and angle). Summaries are items too — the book remembers what it
   concluded, not just what it collected.

5. **Synthesize, reviewed.** `synthesize_abstract({ research_ref, abstract, review: true })`.
   The deterministic reviewer recomputes every experiment from its stored artifact and
   flags `artifact_missing` / `recipe_drift` / `stats_mismatch`; the result is recorded
   with the abstract snapshot. A clean review means every number in the thesis traces to
   a recipe that still reproduces it. A discrepancy is not a failure — it is the notebook
   telling you which citation went stale; re-run that point and re-synthesize.

6. **Hand off, only if warranted.** Add `evaluate: true` with your `suggested_lens` +
   `recommendation` ONLY if the finding suggests tractable substrate work. Most
   experiments end at the reviewed abstract — that is a complete outcome, not an
   unfinished one. Never force convergence; that is plan mode's job.

## Worked example — range vs gravity

Question: how does projectile range fall as g rises, at v₀ = 18 m/s, angle = 45°?

- Mint the projectile once as a classical world: `frame: { g: 9.8 }`, a body at the origin with
  `v: [12.73, 0, 12.73]` (18 m/s at 45°), `gravity-uniform`, `observe: [{ quantity: 'range', of: 'ball' }]`, and a duration long enough to land. Then
  sweep g ∈ {1.62 (Moon), 3.71 (Mars), 9.8 (Earth), 24.79 (Jupiter)}:
  `run_experiment_sweep({ ref, path: '/model/frame/g', values: [1.62, 3.71, 9.8, 24.79] })`, each variant bound as
  an experiment.
- The closed form predicts range = v₀²·sin(2θ)/g, and each run already checks it (its `closed-form:ballistic` gate):
  bind a `summary` comparing the measured ranges (each mint's `observed`, or `measure_view`) to the prediction; the
  ratio test (range × g = const) is the analysis.
- Synthesize with `review: true`: "range is inversely proportional to g across two orders
  of magnitude of surface gravity; measured ranges match v₀²sin2θ/g to within sampling
  tolerance" — with all four recipes reproducibly behind it.
