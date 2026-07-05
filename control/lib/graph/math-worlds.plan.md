# math worlds — giving mathematical objects bodies

Status: Phases 1–2 LANDED (2026-07-04). Phases 3–6 remain PROPOSED,
independently shippable in any order.

## Landed (Phases 1–2)

The core bet is in and probe-verified. Files under
[structures/](structures/):

- `group-presentation.js` — pure permutation-closure engine; ℤ/n, Dₙ, S₃,
  Q₈ realized as concrete tables with mul/inv/shortest-word + relations.
- `cayley-graph.js` — pure coset-ring layout (ℤ/n → one ring, Dₙ/Q₈/S₃ →
  concentric rings around the highest-order generator) + typed generator
  streets + `spellWalk` (a word → waypoint route; closes iff it's a relation).
- `math-structure.js` — graph→boxes+ribbons→`assembleBoxCityScene` (reuses
  the city's low-level primitives, NOT `planFractalCity`); `mathPlan` sidecar
  carries plaza world-positions for probes.
- `math-rules-kernel.js` — `buildMathRules()` consumable-edge reducer,
  self-contained + `.toString()`-emittable exactly like `buildBus`/`buildSim`.
- `koenigsberg.js` — the Seven Bridges as a walkable bridge world; parity
  theorem (`eulerTrailStatus`) and exhaustive DFS (`searchAllTrails`) agree;
  `{stuck}` → counterexample certificate.

Wiring: two `world-kinds.js` rows (`math-structure`, `koenigsberg`, both
`walk:true`); a `math` `compose_world` base ([scene-math-structure.js](../mcp/tools/scene-math-structure.js),
dispatches Cayley vs Königsberg on `structure.kind`); a `world`-family
view-vocab card (`math`). Evidence + spikes in
`lite-template/integration/0704/spike-output/math-worlds/`
([math-worlds.spike.gen.test.js](structures/math-worlds.spike.gen.test.js)):
D₄ srsr walk returns home to 0.50 world-units; Königsberg strands at 6/7
bridges, Euler variant witnesses a 6-bridge trail.

Known gap left for a follow-on: the retracting-bridge rule is enforced in
the PURE kernel + the proof loop, but is not yet wired into the live browser
world's event bus (bridges don't visibly retract underfoot in `/world` yet
— the `events`-channel binding is the remaining Phase-2 polish).

## Original proposal (sequencing rationale unchanged)

Sequenced; Phases 1–2 are the core bet and should land together as one
demonstrable loop. Phases 3–6 are independently shippable follow-ons in any
order once 1–2 prove out.

## Why (the gap this closes)

Physics is easy to visualize because its objects have bodies — a comet view
looks like a comet. Math reads as esoteric to most people precisely because
its objects have no natural referent: nobody has ever seen a quotient group
or an epsilon neighborhood. That asymmetry is already visible in the
substrate: physics got promoted to the World tier (black-hole, orbit,
mechanics — things you move *through*), while every math view in
[views/math/](views/math/) lives at the Sketch/View tier — things you look
*at*. Per the frontier stance in [docs/STATUS.md](../../../docs/STATUS.md),
a layer deepens when something downstream demands it. Math is the thing
demanding the World tier's second pass.

The bet: the substrate can do for math what no textbook or video can —
because its worlds are walkable, its rules are enforceable (event bus +
physics kernel), its manifests are diffable recipes, and its agent loop can
traverse and verify what it mints. You can't walk through a comet, but you
can absolutely walk through a group. Done right, this makes math *less*
esoteric than physics on this substrate, not more.

## Invariants (unchanged by every phase)

- Recipes, not renders. A math world is a tiny deterministic manifest;
  same recipe → byte-identical world. No baked geometry persists.
- Pure-vector, no pixels. All geometry from mojulo's own generators.
- Lighting stays baked; the World keeps rendering unlit.
- One engine-agnostic face payload out of `resolveWorldScene()`; no
  math-specific renderer fork.
- New kinds hang off the [worlds/world-kinds.js](worlds/world-kinds.js)
  registry descriptor (assembler, title, `walk`/`fogBoxes`/`ao` flags) —
  never a new side table.
- Content-extensible via vocab cards, code-extensible only for new
  families: a new group/structure/theorem should be a card + manifest
  params, not a new module.
- The agent is the inference layer. No server-side LLM anywhere in this
  plan; explanation, metaphor selection, and narration are the host
  agent's job over deterministic artifacts.

## Phase 1 — embodiment: structure as geography (walkable math worlds)

The single highest-leverage move. Reuse the graph→architecture machinery
(fractal-city's surface-area budget grid, roads, blocks;
[city/fractal-city.js](city/fractal-city.js)) to render mathematical
structures as places:

- **Cayley city** — a finite group presented as a town: vertices are
  plazas/buildings, each generator is a street *type* (visually distinct —
  width, tree line, paving), relations are the loops that bring you home.
  Walking `srsr⁻¹` in a dihedral town and arriving back at your plaza is
  the theorem, felt. Small groups first (ℤ/n, D₄, S₃, Q₈) — all
  well within city-scale face budgets.
- **Modular ring town** — ℤ/n as a circular town (the mandala/radial
  machinery is unusually suited to this); walking k blocks per step traces
  the subgroup generated by k as the streets you actually touch.
- **Covering-space building** — a staircase that looks like a loop but
  isn't; the fractal-condo repeated-floor `repeats` channel is most of the
  geometry.

Wiring (same checklist the city kinds follow):

1. A `math-structure` assembler under a new [structures/](structures/)
   folder (sibling of `city/`, `architecture/`), dispatching on
   `manifest.structure` (group presentation / modular params / cover spec).
   The structure→graph step is pure and unit-tested separately from the
   graph→geometry step, which delegates to the city/condo engines.
2. One row in the world-kinds registry with `walk: true`; AO default per
   the interior/exterior convention.
3. Exposed as a `compose_world` base (`base: 'math'` or per-kind), plus a
   view-vocab card per structure family — cards, not `TOOL_INDEX` rows.
4. Evidence: a `.spike.gen.test.js` emitting PNG + probe output into
   `lite-template/integration/<date>/spike-output/math-worlds/`, per the
   renderer-convergence pattern.

Acceptance: mint a D₄ Cayley city → compile a walk spelling a relation
via `__mojCapture.compileWalkTo` waypoints → probe-assert the walk returns
to its start plaza. Deterministic: same seed → identical probes + frames.

## Phase 2 — axioms as physics: playable theorems

The controllable-world stack (event bus, capture-mode probes, waypoint
compiler in [worlds/controllable-world.js](worlds/controllable-world.js) /
`motion/world-frames.js`) currently enforces Newton. This phase makes it
enforce *axioms*: the world's collision/interaction rules ARE the
structure's rules, and the theorem is what you discover by failing to
violate it.

- **Königsberg walk** — a bridge world where crossed bridges visibly
  retract (event-bus state, `nonBakeable`-fenced like physics). The world
  simply won't let you finish; the parity argument becomes the *shape of
  the frustration*. Then mint the Euler-path variant next door where it
  works.
- **Epsilon–delta as an adversary game** — the world (or a rigged
  protoform opponent, reusing [figures/rig-bake.js](figures/rig-bake.js))
  picks ε and shrinks a target band; the player must position δ walls.
  Continuity = you can always win; a jump discontinuity = a level that is
  provably unwinnable, and the probe stream shows why.
- **Proof-as-traversal verify loop** — extend the walkability-audit
  pattern: mint → compile attempted path → probe-assert. `{stuck:true}`
  from the compiler is reinterpreted as a *counterexample certificate*.
  This is the agent's loop: it can check whether a student's (or its own)
  path constitutes a witness, deterministically.

Rules live in kernel modules emitted via `.toString()` exactly like the
physics/event-bus kernels — one small `math-rules-kernel.js`, dice seeded,
no runtime dependency.

## Phase 3 — the becoming: manifest-interpolation films

Most math media shows before/after; understanding lives in the in-between,
and recipes-not-renders makes the in-between nearly free. Because a view's
manifest is small and structural, a concept animation is a *parameter
path*, not a pixel effect:

- Completing the square as literal geometric surgery on the
  [views/math/complete-square-view.js](views/math/complete-square-view.js)
  geometry, one small manifest diff per frame, stitched by `forge_motion`.
- A linear transformation as the whole world shearing around the camera
  (transform-view promoted to a world shot).
- Series convergence as accretion: each frame adds one term's block.

Work item: a `paramPath` shot type for `forge_motion` — an array of
manifest overrides (or an interpolation spec) replayed through the
existing deterministic frame pipeline. No new renderer; this is a motion
front-end over machinery that already exists.

## Phase 4 — one manifest, many senses (sonification via beats)

The [beats/](beats/) kernel is sitting right there, and the `audio`
manifest channel already mirrors `fog`. Bind sound to the *same seeded
manifest* the visual reads from, so eye and ear provably tell one story:

- Partial sums as pitch settling onto a tonic — *hear* the difference
  between conditional and absolute convergence.
- Modular arithmetic on the ring town as an actual 12-tone loop (ℤ/12 is
  literally pitch-class space — the metaphor is exact, not decorative).
- Event-bus `sound:` cues in Phase-2 worlds: a relation closing = cadence;
  a rule violation = the thump gesture.

Doctrine holds: synthesized never sampled; audio is presentation, never
simulation feedback; a recipe without `audio` emits byte-identical HTML.

## Phase 5 — experimental mathematics (the researcher loop)

Reframe math from revealed truth to a thing you poke at — the strongest
antidote to the esoteric reputation, and the research-facing arm:

- `run_experiment_sweep` + `measure_view` over math views: sweep a
  parameter, read back real numbers, notice the pattern, conjecture — then
  the Phase-2 world for that structure confirms or produces the
  counterexample certificate.
- A `conjecture-workbench` catalyst (sibling of
  `numerical-experiment-notebook`): stash the sweep outputs, cook the
  writeup. The agent authors the narrative; mojulo holds the deterministic
  evidence chain.

Mostly wiring, not new machinery: ensure the math views expose
`measure_view`-readable series (several already compute the underlying
sequences to draw them — surface them as read-back channels).

## Phase 6 — metaphor cards (the translation layer)

"Esoteric" is ultimately a translation problem, and the agent is the
translation layer. Extend the view-vocab card schema (see
[views/view-vocab/](views/view-vocab/)) with two optional fields per
concept:

- `entryMetaphors`: multiple doors into the same manifest (money, music,
  maps, motion), each mapping metaphor terms → manifest params, so the
  agent meets a learner at a referent they already own.
- `misconceptionTraps`: the known wrong models (e.g. "multiplication
  always makes bigger") with the parameter setting that *visibly breaks*
  the misconception in the view.

Pure card content — drop a card, no code — matching the closed-vocabulary
signature. Retrieved through the existing
`semantic_search({kinds:['view_vocab']})` + `get_view_vocab` path.

## Sequencing rationale

1–2 first and together: geography without rules is a diorama; rules
without geography is a quiz. The pair is the demonstrable one-shot — mint
a group as a city, walk a relation, have the world refuse an impossible
path — and it reuses the most existing machinery (city generators, event
bus, waypoint compiler, probes) for the least new code. 3 and 4 deepen
presentation on top of whatever 1–2 mint. 5 serves the researcher persona
independently. 6 is cheap and continuous — cards can accrete from the
first phase onward.

## Failure modes to keep legible

- **Dead-end clues**: a Cayley city that doesn't *reward* the question
  "why are the streets different?" is scenery, not embodiment. Every
  structure world must have at least one walk whose outcome surprises and
  then explains.
- **Metaphor drift**: entry metaphors that are merely decorative (unlike
  ℤ/12 ↔ pitch class, which is exact). Cards should state where the
  metaphor breaks.
- **Scale creep**: face budgets cap structure size (a city for S₅ is
  120 plazas). Start at |G| ≤ 12; treat bigger structures as a quotient/
  subgroup navigation story, not a bigger render.
