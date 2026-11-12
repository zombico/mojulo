---
{
  "id": "numerical-experiment-notebook",
  "name": "Numerical experiment notebook",
  "summary": "Run a quantitative physics question as a parameter sweep over the SI-honest science views, keep every run in a stash as a reproducible experiment, and cook a finding whose every number is read back from a recipe.",
  "valueHook": "Turn 'what happens to X as I vary Y?' into a lab notebook: every run reproducible from its recipe, every number in real units, read back from the recipe before it is written down.",
  "version": 2,
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
    "mojulo": ["mint_stash", "run_experiment_sweep", "create_exhibit", "gather", "get_exhibit", "get_stash", "cook"]
  }
}
---

# Numerical experiment notebook

The mapping insight this catalyst earns its shelf spot with: **a stash is a lab notebook, and a
parameter sweep is just repeated mints.** The science views are not illustrations — each one is a
deterministic simulation whose stored recipe IS the exact initial conditions (same recipe →
byte-identical world) and whose read-back is the measured outcome. Gathered into a stash by its
ref, a view becomes a citable, re-runnable experiment: the notebook holds the pointer, the recipe
holds the conditions, and the numbers are recomputed from it on every read. Nobody designed the
stash as a lab bench; the primitives compose that way, and this catalyst is the composition
written down.

## The honesty boundary (read before promising anything)

The instruments are the **science worlds** composed from laws: `classical`, `microscopic`, `quantum` and
`relativistic` (`get_exhibit({ id: 'science/classical' })` and its siblings). Every model is in SI with its units checked,
every run carries its gates (conservation, the textbook answer, the regime it holds in), and `get_exhibit({ ref })` reads each
at tier `si`. A projectile, a pendulum, an orbit, a wave packet, the double slit, a liquid setting, a protein
assembling: each is a model there, its starting conditions written into its recipe. The older `mechanics-view`
dynamics scenarios are instruments too, and the one-call experiment form below still sweeps them. The ready-made
depictors (a ripple tank, gravity waves, machines and engines, a spinning black hole) are pictures, not instruments:
`get_exhibit({ ref })` refuses them by design. If the question needs one of them for a *quantitative* answer, say so and
stop — do not dress a depictor up as an instrument.

Also scope-check the question itself: a law the table lacks comes back as a **gap** naming the scale that owns it,
and a regime gate says when the model has left its ground. A question outside the posable surface is a finding too —
report it rather than approximating.

## The workflow

1. **Pose.** `mint_stash({ title: <the question> })`. Gather the question and the sweep design
   (varied parameter, range, held-constant values) as a `markdown` item — the notebook's first
   item is the hypothesis, so it records what was asked before what was found.

2. **Sweep.** Mint the science world once (`create_exhibit` with `science/classical`, …), then vary
   it: `run_experiment_sweep({ ref, path, values })` mints one variant per value at a JSON Pointer
   into its recipe (`/model/frame/g`, `/model/bodies/0/v/0`), varying ONLY the swept parameter,
   all in one folder (for the older mechanics-view dynamics, the one-call
   `run_experiment_sweep({ base, param, values, outcome })` mints the runs, derives their SI
   outcomes and plots them in one step). Gather each variant as its own experiment:

   ```
   gather({
     stash_ref, type: 'sketch',
     title: '<scenario>, <param>=<value>',
     metadata: { sketch_ref: <the variant's ref>, label: '<param>=<value>' }
   })
   ```

   The item is a pointer, not a copy: the variant's recipe stays the one source of its
   conditions, so the notebook cannot drift from the run it cites. Do not `update_sketch` a
   variant after gathering it; a changed question is a new variant.

3. **Measure.** Call `get_exhibit({ ref })` on each variant and use the returned time-series —
   every value in declared real units, recomputed from the stored recipe on this read. Take the
   numbers for the next step from this read-back, never from memory of the mint.

4. **Analyze.** Gather the comparative analysis as a `markdown` item: the trend across the
   sweep, the numbers behind it (with the ref each came from), and any closed-form check you can
   make (e.g. range ∝ 1/g at fixed v₀ and angle). The analysis is an item too — the notebook
   remembers what it concluded, not just what it collected.

5. **Verify, then publish.** Before writing the finding, re-read every cited run with
   `get_exhibit({ ref })` and compare it with the number in your analysis: a run whose ref no
   longer resolves, or whose read-back differs from what the analysis says, is a stale citation —
   re-run that point and correct the analysis item (`get_stash` lists what the notebook holds).
   Then `cook({ slices: [{ stash_ref }], aim: <the question>, report_md })`: the finding as one
   outcome, each number traceable to a recipe that reproduces it. Say in the report that the
   check was this re-read; it is yours to run, nothing runs it for you.

6. **Stop at the finding.** Most experiments end at the cooked report — that is a complete
   outcome, not an unfinished one. If the finding suggests work worth doing, say so to the
   operator; a plan is theirs to ask for.

## Worked example — range vs gravity

Question: how does projectile range fall as g rises, at v₀ = 18 m/s, angle = 45°?

- Mint the projectile once as a classical world: `frame: { g: 9.8 }`, a body at the origin with
  `v: [12.73, 0, 12.73]` (18 m/s at 45°), `gravity-uniform`, `observe: [{ quantity: 'range', of: 'ball' }]`, and a duration long enough to land. Then
  sweep g ∈ {1.62 (Moon), 3.71 (Mars), 9.8 (Earth), 24.79 (Jupiter)}:
  `run_experiment_sweep({ ref, path: '/model/frame/g', values: [1.62, 3.71, 9.8, 24.79] })`, each variant gathered
  as an experiment.
- The closed form predicts range = v₀²·sin(2θ)/g, and each run already checks it (its `closed-form:ballistic` gate):
  gather a `markdown` analysis comparing the measured ranges (each mint's `observed`, or `get_exhibit({ ref })`) to the prediction; the
  ratio test (range × g = const) is the analysis.
- Re-read the four runs, then cook: "range is inversely proportional to g across two orders
  of magnitude of surface gravity; measured ranges match v₀²sin2θ/g to within sampling
  tolerance" — with all four recipes reproducibly behind it.
