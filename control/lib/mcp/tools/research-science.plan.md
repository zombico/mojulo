# Research–Science Mode

Compose research mode (Ring 9) with the science-view layer so a research book can function
as a **lab notebook over numerical experiments** — provenance-carrying, deterministically
reviewable, and readable back by the MCP caller.

## Why (and why now)

Anthropic's Claude Science (launched 2026-06-30) is a workflow layer over an unchanged
model whose product is the audit trail: every artifact carries the exact code, environment,
method description, and history that produced it, and a reviewer agent checks that figures
trace back to their code. That meta-principle — *vertical workflow layer, provenance as the
product* — is already mojulo's architecture. Four of its principles land on primitives we
already have, three of them nearly for free:

| Claude Science principle | Mojulo primitive it lands on | Gap |
|---|---|---|
| Auditable artifacts (code + env travel with the figure) | Science-view recipes: same manifest → byte-identical world. `research_items.metadata_json` exists and is unused for this | Provenance doesn't travel into the book — a bound sketch is a bare pointer |
| Reviewer agent ("figures trace back to their code") | `verify_machina` forward+verify pattern; `machina/quantities.js` canonical-SI dimensional ontology; turn-hashing DNA | No consistency pass over a research book at synthesis time |
| Pipelines become inheritable skills | Catalysts | No catalyst encodes the sweep → bind → synthesize workflow |
| Artifact as bidirectional surface | Click-to-pick readouts (operator-only) | The MCP caller can never read the time-series the planner already computes |

Deliberately NOT taken: session forking (two `synthesize_abstract` calls + the plans layer
already cover compare-two-theses), compute orchestration, LLM self-review (we go
deterministic — recompute-from-recipe beats a model checking itself), any intent/gating
layer (TERMS.md posture).

## Invariants (unchanged by this work)

- Research mode stays a low-prominence drawer: **not** woven into `forward_context`, no
  quick-orientation rule, no new ring.
- One-way coupling holds: research may import graph planners (it already imports
  `mintSketch` + `sketch-derive`); plans never import research.
- Recipes stay pure: nothing in this plan persists geometry or adds response-shaping
  flags into sketch manifests.
- The reviewer is a provenance/consistency check, never a truth gate — "agent judges,
  server structures" (same scoping Claude Science gives its reviewer). It soft-fails like
  the posterity sketch: a review hiccup must never block recording a thesis.

---

## Phase 1 — `experiment` items: provenance travels with the artifact

**Change:** add `'experiment'` to `KNOWN_KINDS` in `research-mode.js` (the code comment at
line 43 invites exactly this one-line growth). An experiment item is a bound science-view
artifact whose provenance rides in the existing free-form `metadata` column:

```js
bind_research_item({
  research_ref, kind: 'experiment',
  title: 'projectile, lunar g',
  media_ref: 'sk_…',                     // the science-view sketch, as with kind:'sketch'
  metadata: {                            // captured verbatim from the create_* response
    recipe: { kind: 'mechanics-view', scenario: 'projectile', v0: 18, angle: 55, g: 1.62 },
    stats:  { scenario: 'projectile', g: 1.62, flightTime: 18.399, loop: true },
    world_url: '/api/sketches/sk_…/world',
  },
})
```

**Gate (bind-time validation in `bindResearchItemHandler`):** `kind:'experiment'` requires
`media_ref` (an `sk_…` ref) and `metadata.recipe` (an object with a string `kind`). Same
philosophy as the Gather gate: malformed experiments are rejected at the door, not stored
as junk. `metadata.stats` is recommended but optional — some views return thin stats.

**Prose:** one short subsection in `RESEARCH_BRIEF` ("Numerical experiments") documenting
the pattern: mint the view, bind the response's `recipe` + `stats` into the item so the
book remembers the exact initial conditions and the measured outcome. Update the
`bind_research_item` tool description's kind list. Keep both brief — the brief's lightness
is a feature.

**No schema change.** `media_ref` and `metadata_json` already exist
(`db/repositories/research.js`); the kind column is freeform by design.

**Tests** (`research-mode.test.js`, colocated per repo convention): experiment bind
happy-path; rejection on missing `media_ref`; rejection on missing/malformed
`metadata.recipe`; `get_research` round-trips the metadata.

## Phase 2 — `measure_view`: the read-back channel

The single highest-leverage change. `planMechanicsScene(manifest)` already computes the
full trajectory at mint time — 140 equal-`dt` samples (`MECHANICS_SAMPLES`,
`motion-vocabulary.js:57`) with per-sample `speed[]`/`accel[]` from `deriveKinematics`
(`motion-vocabulary.js:34`) — then throws it away after returning a 5-field stats digest.
The renderer regenerates it on every page load. Exposing it costs one deterministic
re-plan.

**Change:** one new MCP tool (not a flag on every `create_*` — one surface, serves
existing sketches too, keeps mint responses lean):

```
measure_view({ ref, every? })
  → { ok, ref, kind, scenario, units, dt, samples: [{ t, pos:[x,y,z], speed, accel }…],
      stats, count, truncated? }
```

- Loads the sketch by ref (`SketchRepository`), dispatches on `manifest.kind` through a
  small `MEASURABLE_KINDS` registry: `kind → (manifest) => { dt, path, kinematics, stats, units }`.
- v0 kinds: `mechanics-view` (path from the planner's mover channel — use the *unscaled*
  physical path, i.e. the `rawPath`/`kPhys` magnitudes at `mechanics-view.js:262-263`, so
  samples are real metres and m/s, not render units) and `orbit-view` (Kepler-sampled
  positions + vis-viva speeds, real km/km-s). Registry is the declared extension point;
  compare-mode and multi-mover scenarios return one series per mover, keyed by group.
- `every` (default 1) downsamples; 140 × 5 numbers is small, but orbit paths may be denser.
- `units` block states what the numbers are (`{ pos: 'm', speed: 'm/s', accel: 'm/s²', t: 's' }`)
  — machina's lesson (`quantities.js`): numbers that leave the substrate carry their units.
- Non-measurable kinds get a crisp error naming the supported set (the double-slit /
  GW / wavepacket views are structurally-correct-but-not-SI; excluding them **is** the
  honesty boundary — don't ship samples whose units would lie).

**File:** `control/lib/mcp/tools/measure-view.js`, registered in `server.js` beside the
other view tools. Planner imports only — no research coupling; this tool is useful
standalone.

**Tests:** projectile samples match closed form (`x = v₀cosθ·t`, `z = v₀sinθ·t − ½gt²`)
within finite-difference tolerance; `every` downsampling; unknown ref / non-measurable
kind errors; orbit speeds satisfy vis-viva at perihelion/aphelion.

## Phase 3 — deterministic review at synthesis

Extends the `verify_machina` forward+verify precedent to the research book. Claude
Science's reviewer asks "does the figure trace back to the code that produced it?" — the
mojulo version recomputes instead of re-reading.

**Change:** `synthesize_abstract({ …, review: true })` (opt-in, like `evaluate`). For each
bound `experiment` item:

1. Resolve `media_ref` → sketch. Missing sketch → discrepancy (`artifact_missing`).
2. Compare stored `sketch.manifest` against `metadata.recipe` — inequality means the
   artifact was edited after binding (`recipe_drift`).
3. Re-run the planner (same dispatch registry as Phase 2) and compare recomputed stats
   against the `metadata.stats` snapshot within a small tolerance (`stats_mismatch` —
   catches planner-behavior changes since bind time; this is the "figure ↔ code" check).

Response gains a `review` block:
`{ items_checked, consistent, discrepancies: [{ item_id, code, detail }…] }`, recorded
into the abstract's `assessment_json` alongside the evaluation so the append-only snapshot
carries its own audit. Soft-fail wrapper identical to the posterity-sketch pattern
(`research-mode.js:195-206`).

**Scope, stated plainly in the tool description:** the review checks artifact ↔ recipe ↔
snapshot integrity. It does **not** parse the thesis prose for numeric claims — judging
whether the thesis is *supported* stays the agent's job. This is the line that keeps the
server structural and the agent judgmental.

**Coupling note:** research-mode.js gains imports of `SketchRepository` + the Phase-2
registry. Direction is consistent with its existing graph imports; plans remain untouched.

**Tests:** clean book reviews consistent; each discrepancy code has a fixture; review
failure doesn't block the abstract row; `review` without experiment items returns
`items_checked: 0` (not an error).

## Phase 4 — the lab-notebook catalyst

The workflow is now real but lives in nobody's head. Encode it as a catalyst (JSON
frontmatter, per CLAUDE.md): `control/lib/mcp/catalysts/numerical-experiment-notebook.md`.

**Shape:** pose a quantitative question → `start_research` → sweep a science view across
the parameter range (one `create_mechanics_view` / `create_orbit_view` per point) → bind
each as an `experiment` item with recipe+stats → `measure_view` where the digest is too
coarse → bind the comparative analysis as a `summary` item → `synthesize_abstract` with
`review: true`, and `evaluate: true` only if the finding suggests substrate work. Includes
one worked example (range-vs-gravity sweep) and names the honesty boundary from Phase 2
(which views are measurable and why).

Draft via `/write-catalyst` during implementation — the mapping insight ("research book
as lab notebook; sweeps are just repeated mints; the book is the record") is exactly the
shelf-earning kind. This is where Claude Science's "save any pipeline as a reusable skill"
lands without new machinery.

## Phase 5 — sweeps as a first-class object, with auto-plot

A parameter sweep is what every quantitative question actually is, and today it is N manual
mints + N manual binds with the discipline living only in the catalyst. Formalize it:

**`run_experiment_sweep`** (new tool, `control/lib/mcp/tools/research-sweep.js`, Ring 9
sibling registered beside research mode):

```
run_experiment_sweep({
  research_ref, base: { scenario, v0, angle, … },   // a mechanics-view recipe
  param: 'g', values: [1.62, 3.71, 9.8, 24.79],     // the swept knob (2–12 points)
  outcome?: 'flightTime' | 'range' | 'maxHeight' | 'maxSpeed',   // what the chart plots
})
```

Per value: mint the view (`mintMechanicsView`), derive outcomes from
`sampleMechanicsPhysics` (flight time, horizontal range, max height, max speed — all from
the SI series), and bind one `experiment` item whose metadata carries
`series: { param, value, index }` alongside the usual `{ recipe, stats }`. Then derive a
param-vs-outcome chart via **`experimentsToChartManifest`** (new pure derive in
`sketch-derive.js`, sibling of `researchToSketchManifest` — axes/polyline/points/labels
from primitive marks, no LLM, no DB), mint it, and bind it as a `sketch` item. Returns the
comparative table + all refs. v0 sweeps `mechanics-view` dynamics recipes only (the
sweepable-param allowlist mirrors the sampler's knobs); orbit presets have nothing numeric
to sweep. Gates up front: session exists, param in the allowlist, scenario measurable —
so a sweep never half-binds on a bad recipe.

## Phase 6 — quote integrity: the reviewer, generalized past physics

The reviewer only covers experiments; literature items can be checked the same
recompute-don't-trust way:

- **Bind-time article hashing.** `bind_research_item` auto-stamps
  `metadata.content_hash = sha256(body)` on `article` items — the turn-hashing posture
  applied to sources. Costs nothing, makes out-of-band body edits tamper-evident.
- **Anchored quotes.** A `quote` item may carry `metadata.source_item_id` pointing at an
  `article`/`snippet` item in the same book. Anchoring is optional — external quotes with
  only a `source_url` stay un-checked rather than false-flagged.
- **Two new review checks** in `synthesize_abstract({ review: true })`:
  `quote_drift` (the quote's whitespace-normalized text no longer appears verbatim in its
  source's body) and `quote_source_missing` (the anchor points at nothing usable); plus
  `source_hash_mismatch` when a hashed article body no longer matches its bind-time hash
  (deduped per source). The review block gains `quotes_checked`; experiment semantics are
  unchanged.

## Phase 7 — the 'exact' tier: mathematics enters the measure channel

The honesty boundary generalizes: for physics it was SI units; for mathematics it is
exactness — no unit problem at all, only "is this number the true value of the implemented
expression?". Two math views join `MEASURABLE_VIEW_KINDS` / `REVIEWABLE_VIEW_KINDS` at
tier `'exact'` (a `tier` field now distinguishes `'si'` from `'exact'` in every
measure_view response):

- **derivative-view** (`sampleDerivativeExact`): { x, fx, dfx } over the domain plus the
  limit process itself — the secant slopes at the shrinking HSTEPS converging on f′(a).
  The sampled functions are the RENDERED ones (the cubic is frame-fitted 0.34x³), exact
  with respect to the artifact; the identity dfx = d(fx)/dx holds regardless.
- **series-view** (`sampleSeriesExact`): per-term-count { x, fx, snx, err } samples with
  max/mean absolute error over the rendered domain — convergence RATES as data (Taylor
  collapse, the geometric divergence control, the Gibbs overshoot refusing to shrink).

Review recompute for both is trivial: the math mints return `plan.stats` verbatim.
Proven zero-cost before building: the pendulum period-vs-amplitude sweep (existing
machinery, no changes) reproduces the elliptic-integral correction T(θ₀) ≈
2π√(L/g)(1 + θ₀²/16 + 11θ₀⁴/3072) to <0.5% at every amplitude — experimental mathematics
was already live; this phase just widens the posable surface.

## Phase 8 — prediction items: falsification, formalized

The `prediction` kind states expected numeric outcomes and anchors them to an experiment:
`metadata: { experiment_item_id, expected: { <outcome|stat>: value }, tolerance? }`,
formula/reasoning in `body`. Gated at bind (anchor + ≥1 finite expected value required).

Review checks each expected key against the anchored experiment's bound
`outcomes ∪ stats` within the relative tolerance (default 0.01) and reports verdicts in a
separate `review.predictions` block: `{ checked, confirmed, falsified, unmeasurable,
results }`. The load-bearing semantic decision: **a falsified prediction is a scientific
result, not an integrity failure** — it never touches `consistent`. Only a broken anchor
(`prediction_source_missing`) is a discrepancy. This keeps review's two jobs separate:
integrity (did the book's evidence drift?) stays gating-shaped; epistemics (was the
theory right?) stays reporting-shaped, and the judgment of what a falsification *means*
stays the agent's.

Scope note: predictions are checked against the digest values (`outcomes`/`stats`), not
against full sample series; and review can numerically falsify an identity at sampled
points but never prove it — the tool descriptions say so explicitly.

## Sequencing & effort

1 and 2 are independent; 3 needs both (1's metadata convention, 2's registry); 4
documents 1–3. Roughly: Phase 1 small (kind + gate + brief + tests), Phase 2 medium (the
registry and unit-honest sampling are the real work), Phase 3 medium (comparison +
tolerance semantics), Phase 4 small.

Phases 5–6 (added after 1–4 shipped): 5 builds strictly on top of 2's sampler and 1's
experiment convention (no schema change — `series` rides metadata); 6 is research-mode-only
(hashing + two review checks) and touches no view code. Both preserve the invariants above.

Out of scope, deliberately: research-book forking; `measure_view` for non-SI views;
arbitrary orbital elements on `create_orbit_view` (worthwhile, but it's a view-layer
feature — separate plan if wanted); any UI work on the /research pane (the review block
rides `assessment_json`, so the pane can render it later without schema work).
