# Diagram patterns spike — first-class support for the standard patterns the kernel surface is missing

Status: PROPOSED handoff (2026-08-21). A PARALLEL track to
[kernel-diagram-surface.plan.md](kernel-diagram-surface.plan.md) — safe to work independently; it only
extends the diagram vocab/renderer, touching none of the install-split code. This doc is a self-
contained briefing for the implementing agent: the context, the gap, a per-pattern spike design, the
methodology, and the done-criteria. Everything here is a spike (throwaway, eyes-gate) — the OUTPUT is
reference renders + a per-pattern vocab proposal + a build/defer recommendation, NOT shipped features.

## Context (self-contained)

The kernel diagram surface is now isolated and pure-SVG, kernel-clean (no `lib/graph` render stack, no
`sharp`):
- **Validator/vocab:** `lib/diagram-core.js` (pure — `validateDiagramManifest`, `expandGridLayout`, the
  mark/station/edge validators + `MARK_KINDS`/`STATION_KINDS`).
- **Renderer:** `lib/sketch-svg.js` (`renderSketchToSvg`, React SSR) → `components/graph/CreationMap`
  (the actual SVG drawing; imports only `@/lib/signage-chrome`, itself kernel).
- **Mint:** `mint_diagram` (SPINE, kernel) + `create_sketch` (creative superset); both bind to
  `diagram-core`.

**Current vocab.** Stations: 4 kinds (`input`/`mcp_tool`/`filesystem`/`db_row`) + `x/y/w/h`/`label`/
`cell`. Edges: `{from,to,label,via,curvature,pulse}`. Marks: `rect`/`circle`/`wedge`/`line`/`polyline`/
`polygon`/`text` + ~24 composites. Plus `grid`, `signage`, `geo`.

**The gap (from a 2026-08-21 visual review).** The surface is strong on **flow + charts**, weak on
**interaction, containment, and data-modeling** diagrams. Standard patterns with NO structural primitive:
sequence, swimlane, ERD/UML-class, nested containment (C4), timeline/Gantt — plus the edge-notation
(arrowhead styles, multiplicities, self-loops) that several of those depend on.

## Goal

Spike the **minimal vocabulary + render approach** for each missing standard pattern, so we can decide
which to FORMALIZE into `diagram-core` + `CreationMap`. Stay pure-SVG and kernel-clean; preserve the
bind discipline (one validator/vocab home, a binding test if formalized). The real value-add — and the
real risk — is **auto-layout** (evenly-spaced lifelines, order-stacked messages, lane flow, date scale);
spike layout explicitly, separately from the marks.

## Methodology — mirror the repo's spike pattern

The polygonizer spikes (`*.spike.gen.test.js` in `lib/graph/polygonizer/`) write SVGs to
`lite-template/integration/<date>/spike-output/<name>/*.svg`, then you `/view-svg <dir>` to eyeball.
Reuse exactly that:
1. Add `lib/graph/sketch/diagram-patterns.spike.gen.test.js` (excluded from the normal suite by the
   `*.spike.gen.test.js` convention — see `pack-boundary`'s `EXCLUDE`).
2. For each pattern, author a minimal example and render it — two stages:
   - **(a) Feasibility** — can the CURRENT primitives (or hand-written raw SVG) express it well? Author +
     render + eyeball. This answers "is a new primitive needed, or is it just missing sugar/layout?"
   - **(b) Vocab proposal** — the minimal manifest shape + what `validateDiagramManifest` and
     `CreationMap` would each need. Call out the auto-layout math specifically.
3. `/view-svg` the spike-output dir; iterate on the render until it reads at a glance.
4. Write findings inline in this doc (a `## Findings` section per pattern) + a final synthesis.

Kernel discipline for anything later formalized: new vocab lands in `lib/diagram-core.js` (pure), new
drawing in `CreationMap` (SVG only), a fixture through the binding test, and pack-boundary **Check E**
stays green (kernel diagram surface imports zero `lib/graph`).

## The patterns (prioritized) + per-pattern spike design

### P0 — Edge notation (foundation; several patterns depend on it)
**Need:** typed arrowheads + endpoint labels + self-loops. Underpins ERD, UML, and state machines.
**Proposed vocab (edge extension):** `head` / `tail` marker enum — `arrow` (default) | `triangle-open`
(UML inheritance) | `diamond` / `diamond-filled` (aggregation / composition) | `crowsfoot-one` /
`crowsfoot-many` (ERD cardinality) | `dot` | `none`; plus `dashed:true`, endpoint labels
(`fromLabel`/`toLabel` for multiplicity), and self-loop rendering when `from === to`.
**Render:** SVG `<marker>` defs in `CreationMap`; a looped path for self-edges.
**Spike deliverable:** one "edge sampler" render showing every marker/style combo on a small grid.

### P1 — Sequence diagram (HIGHEST value; structurally impossible today)
**Need:** lifelines + time-ordered messages + activation bars. A time axis — cannot be faked with
stations+edges.
**Proposed vocab:** `kind:'sequence'`, `actors:[{id,label}]`, `messages:[{from,to,label,
kind:'sync'|'async'|'return',activate?}]`. **Auto-layout is the point:** actors evenly spaced across the
top (each a header box + a vertical lifeline); messages stacked top→down by array order; activation bars
auto-derived from `activate`; a self-message (`from===to`) draws a loopback. `frames` (alt/loop/opt
boxes) are a later nicety.
**Render approach:** a small layout fn lowers actors+messages → lines/rects/text/arrow-marks, then the
existing renderer draws them (or a dedicated `CreationMap` branch). Spike BOTH: does marks-composition
suffice, or is a dedicated render branch cleaner?
**Spike deliverable:** a real 3–4-actor protocol (e.g. the mojulo request path: Agent → mint_diagram →
diagram-core → SQLite, with a return) — a TRUE depiction, not filler.

### P2 — Swimlanes / cross-functional flowchart
**Need:** a flowchart partitioned into actor lanes.
**Proposed vocab:** `lanes:[{id,label,orientation?:'horizontal'|'vertical'}]` + `station.lane`.
**Auto-layout:** lanes as labeled bands; a station flows within its lane (position by order along the
lane axis, pinned to the lane on the cross axis). Render lane background rects + labels BEHIND stations.
**Spike deliverable:** a 3-lane process (e.g. User | System | Store) with 5–6 stations + edges crossing
lanes.

### P3 — ERD / UML class (needs P0)
**Need:** compartmented boxes + typed relationship ends.
**Proposed vocab:** a station variant `kind:'entity'` (or `record`) with `fields:[{name,type?,key?}]`
rendered as a titled box with a divided header + field rows; relationships use the P0 crow's-foot /
triangle markers.
**Spike deliverable:** 3 entities (User / Order / Item) with 1:N + N:M relationships and cardinality
labels.

### P4 — Containment / C4 (nested boxes)
**Need:** boxes inside boxes — "these services live inside this boundary."
**Proposed vocab:** `boundaries:[{id,label,contains:[stationIds],style?}]` (a labeled, usually dashed
container rect auto-sized to wrap its members, drawn behind them) OR `station.parent`. Prefer the
`boundaries` form — it's additive and doesn't complicate station layout.
**Spike deliverable:** a "control plane" boundary wrapping MCP server + tool registry + SQLite, with an
edge crossing the boundary to an external agent.

### P5 — Timeline / Gantt
**Need:** time as a first-class layout axis.
**Proposed vocab:** `kind:'gantt'`, `tasks:[{label,start,end,lane?}]`, `scale:{start,end,unit}`.
**Auto-layout:** one row per task; x mapped from the date scale; bars = rects; a date axis + gridlines.
**Spike deliverable:** a 5-task schedule over ~6 weeks with a couple of dependencies.

### Bonus — State machine
Falls out of P0 (self-loops + `dot`/ringed-dot markers for initial/final pseudostates) + the existing
station/edge vocab. Cheap once P0 lands; spike a traffic-light or a bot-lifecycle state chart.

## Findings — feasibility sweep (2026-08-21)

Stage-(a) feasibility done for ALL patterns in one throwaway render:
`lib/graph/sketch/diagram-patterns.spike.gen.test.js` → SVGs in
`lite-template/integration/0821/spike-output/diagram-patterns/` (`/view-svg` that dir). Every manifest
uses ONLY the shipped vocab (stations + edges + marks) and passes `validateDiagramManifest` — so the
renders show exactly what the current surface can and can't say. **Headline: the render primitives
(`rect`/`line`/`text`/`polygon`/`circle`) are already sufficient for every pattern. There is exactly ONE
genuinely-missing visual primitive — typed arrowheads + self-loops (P0). Everything else is missing only
LAYOUT MATH, not a primitive.** That splits the work cleanly in two (see synthesis).

A second, load-bearing discovery about *where* the work lands:
- **The auto-router is unusable for these patterns.** The `edge` S-curve/`via` router only connects
  station centers and freely **pierces intervening boxes** — visible in P4 (the Host-agent→MCP edge cut
  straight through Tool registry) and fatal for self-loops (P1/state-machine, `from===to` smears a pill
  across the box). So sequence/ERD/state relationships must be drawn as **`line` marks with heads**, NOT
  as `edges`. This is *good* news: it means these patterns lower to marks and need **zero CreationMap
  change** — only P0 touches the renderer.

### P0 — Edge notation — **✅ DONE (2026-08-21)**
`p0-edge-sampler.svg` (feasibility, hand-faked) → `p0-formalized.svg` (real vocab, no polygons): every
head (filled arrow / open triangle / open+filled diamond / crow's-foot one|many / dot) + a real self-loop
now render through a first-class `head`/`tail` enum. Shipped:
- **Vocab (`diagram-core`):** `EDGE_HEADS = arrow | triangle-open | diamond | diamond-filled |
  crowsfoot-one | crowsfoot-many | dot | none`; `head`/`tail` valid on edges AND on `line`/`polyline`
  marks; `edge.dashed:boolean`. Shared `validateHeads()`.
- **Renderer (`CreationMap`):** `HeadMarker` emits one parametric `<marker>` per distinct (kind, color)
  actually used, applied via `markerStart`/`markerEnd` (`orient="auto-start-reverse"` so one def serves
  head + tail). A self-edge (`from===to`) draws a real loopback off the box top. **Byte-identical for
  legacy manifests:** an edge with no head/tail keeps `creation-map-arrow` verbatim; markers are only
  registered/emitted when notation is present.
- **Tests:** `diagram-core.edge-notation.test.js` (enum + reject cases), a `TYPED`/`TYPED_EDGES` fixture
  in `diagram-core.binding.test.js` (render-identical + byte-identical-stored via both paths), and the
  `p0-formalized` spike render. Full render-consuming suite green; pack-boundary Check E green.
- **Auto-layout:** none — pure marker geometry. **Deferred:** endpoint labels (`fromLabel`/`toLabel`)
  — their only consumer is ERD/P3 multiplicities, itself deferred; add them alongside P3.

### P1 — Sequence — **✅ DONE (2026-08-21)**
`p1-sequence.svg` (feasibility, hand-computed) → `p1-formalized.svg` (real `{actors,messages}` spec, zero
hand coords): the author now writes a compact spec and `expandSequence` lowers it. Renders production-grade
— header boxes + dashed lifelines + auto-derived activation bars + stacked messages + dashed returns.
- **Vocab:** `kind:'sequence'`, `actors:[{id,label}]`, `messages:[{from,to,label?,kind?:'sync'|'async'
  |'return',activate?}]`.
- **Lowering (`diagram-core.expandSequence`, sibling of `expandGridLayout`):** emits ordinary
  `line`(+P0 head)/`rect`/`text` marks — actors evenly spaced (`colX[i]=marginX+headerW/2+i*colStep`),
  messages stacked by order (`msgY[k]=msgTop+k*rowH`), activation bars from `activate` (open on the
  receiver, close at its next outgoing message), self-message (`from===to`) as a loopback polyline. Sets
  `viewBox` from the computed extent. **No CreationMap change** — confirms "marks win over a dedicated
  branch". Keeps `kind:'sequence'`+source spec as inert metadata (render falls through to CreationMap).
- **Bound in BOTH paths:** `mint_diagram` and `create_sketch`/`mintSketch` both call `expandSequence`
  before grid/Rendrant expansion (re-exported through `sketch-manifest`), so they can't drift.
- **Tests:** `diagram-core.sequence.test.js` (lowering shape, activation, self-message, determinism,
  reject cases), a `SEQUENCE` fixture in the binding test (render-identical via both paths — marks-bearing,
  so the Move 2b byte-identical boundary applies), and the `p1-formalized` spike render. Full sketch +
  render-consuming suite green.
- **Follow-up:** `frames` (alt/loop/opt boxes) + a `sketch_vocab` card documenting the sequence kind
  (so the studio surfaces it) are deferred niceties.

### P2 — Swimlanes — **✅ DONE (2026-08-21)**
`p2-swimlanes.svg` (feasibility) → `p2-formalized.svg` (real `lanes[]` + `station.lane`/`col`): the author
declares lanes + assigns each station a lane/col; `expandSwimlanes` pins coordinates + emits bands. Cleaner
than the feasibility render — bands carry `z:-1` so they sit strictly BEHIND stations.
- **Vocab (a MODIFIER, not a kind):** `lanes:[{id,label}]` + `station.lane` (+ optional `station.col`).
- **Lowering (`diagram-core.expandSwimlanes`):** a band `rect`(z:-1)+label per lane; each laned station's
  cross-axis pinned to its lane, along-axis by `col`; sets `viewBox`. Edges left to the router (in-lane +
  short cross-lane hops route fine). Triggers on `lanes[]` presence; no-op otherwise. **No renderer change.**
- **Tests:** `diagram-core.layout-kinds.test.js` (bands, pinned coords, lane-reject) + a `SWIMLANE`
  binding fixture + the `p2-formalized` render.

### P3 — ERD / UML class — **✅ DONE (2026-08-21)**
`p3-erd.svg` (feasibility, faked ends) → `p3-formalized.svg` (real vocab): entity boxes via
`station.items` + a new `station.divider` rule, typed crow's-foot ends from P0, and **endpoint
multiplicity labels** (`edge.fromLabel`/`toLabel`) — a true ERD, no hand-built marks.
- **Vocab:** `station.divider:boolean` (title rule) + `edge.fromLabel`/`toLabel:string` (multiplicities),
  on top of P0's `crowsfoot-one|many` edge heads.
- **`diagram-core`:** validate `divider` on stations + `fromLabel`/`toLabel` on edges. **`CreationMap`:**
  a divider `line` under the station label when `divider`; `edgePath` now also returns its `sx/sy/ex/ey`
  endpoints so `fromLabel`/`toLabel` pin a little inside each end. Byte-identical for edges/stations that
  don't set the fields.
- **Tests:** validation cases in `diagram-core.edge-notation.test.js` + an `ERD` binding fixture
  (stations+edges only → render-identical AND byte-identical-stored) + the `p3-formalized` render.
- **Deferred nicety:** a type/key column inside the entity box (the current bulleted `items` reads fine).

### P4 — Containment / C4 — **✅ DONE (2026-08-21, minus the router follow-up)**
`p4-containment.svg` (feasibility, hand-sized) → `p4-formalized.svg` (real `boundaries[]`): a dashed box
**auto-sizes** to wrap its members + padding, label top-left, drawn behind (`z:-2`).
- **Vocab:** `boundaries:[{label?,contains:[stationIds],style?}]`.
- **Lowering (`diagram-core.expandBoundaries`):** computes the bbox of `contains` + padding → a dashed
  `rect`(z:-2)+label. Runs **after** grid/swimlane expansion (it reads members' RESOLVED coords), as a
  post-grid step in both mint paths. Additive — only appends marks, never moves a station, so it composes
  with lane-pinned and cell-placed members. **No renderer change.**
- **Tests:** `diagram-core.layout-kinds.test.js` (bbox wrap, z:-2, reject unplaced member, composes with
  swimlanes) + a `BOUNDARY` binding fixture + the `p4-formalized` render.
- **STILL DEFERRED — obstacle-avoiding edge routing.** The auto-router still draws a crossing edge near/
  through an intervening box (visible in the render). This is a PRE-EXISTING, general limitation of the
  center-to-center edge router — NOT a boundary concern — and improving it lifts every diagram. It is the
  single genuinely-larger item left and is scoped as its own follow-up.

### P5 — Gantt — **✅ DONE (2026-08-21)**
`p5-gantt.svg` (feasibility) → `p5-formalized.svg` (real `kind:'gantt'` spec): bars on a value→x scale + a
tick axis, generated from `{scale, tasks}`.
- **Vocab:** `kind:'gantt'`, `scale:{start,end,unit?}` (NUMERIC domain — the author maps real dates to
  numbers; date-string parsing is a documented follow-up), `tasks:[{label,start,end,lane?}]` (`lane`
  accepted, not yet used for grouping).
- **Lowering (`diagram-core.expandGantt`):** `wx(v)=x0+((v-start)/(end-start))*(x1-x0)`; one row per task;
  a bar `rect` + left label; integer-ish ticks (coarser as the span grows) as `line`+`text`. Sets
  `viewBox`. **No renderer change.**
- **Tests:** `diagram-core.layout-kinds.test.js` (bar-per-task, monotonic x, determinism, reject cases) +
  a `GANTT` binding fixture + the `p5-formalized` render.

### Bonus — State machine — **FALLS OUT OF P0**
`bonus-state-machine.svg`: states/transitions fit stations+edges; the initial-pseudostate dot is a
one-line `circle` mark. The `deployed→deployed` self-loop renders **wrong today** (confirmed: pill
smeared across the box). Ships free once P0 lands (self-loop path + `dot` head for initial/final).

### Synthesis — what to formalize first

**The build splits into exactly two kinds of work:**

1. **One new primitive (renderer change):** **P0 edge-notation** — typed heads as `<marker>` defs + a
   real self-loop path in `CreationMap`, enum validation in `diagram-core`. Small, and it's the ONLY
   thing that touches the renderer. Unblocks P3 + state machine.
2. **Layout lowering (no renderer change):** P1 / P2 / P4 / P5 / P3-boxes are all `kind`→marks
   expanders — architecturally identical to how the existing chart kinds (stacked-bar/donut) already
   lower to `rect`/`wedge`. They belong beside `expandGridLayout` in `diagram-core` (a pure
   pre-expansion step), emitting ordinary marks. **They must emit `line` marks (with P0 heads), not
   `edges`** — the auto-router pierces boxes and can't self-loop.

**Formalize in this order (all confirmed low-risk by the renders):**
- **① P0 edge-notation** — ✅ DONE (2026-08-21). head/tail enum + dashed + self-loop in `diagram-core` +
  `CreationMap`; parametric marker defs; byte-identical for legacy edges; validator + binding fixtures
  green. See the P0 finding above for the shipped surface.
- **② P1 sequence** — ✅ DONE (2026-08-21). `kind:'sequence'` + `expandSequence` lowering → marks in both
  mint paths; no renderer change; lowering + binding fixtures green. See the P1 finding above.
- **③ P5 gantt + P2 swimlanes** — ✅ DONE (2026-08-21). Both are `expand*` lowerings chained behind
  `lowerDiagramKinds` (run in both mint paths before grid expansion); layout-only, no renderer change;
  lowering + binding fixtures green. See the P5 + P2 findings above.

- **④ P3 ERD + P4 containment** — ✅ DONE (2026-08-21). P3 = `station.divider` + `fromLabel`/`toLabel`
  endpoint labels (on P0's crow's-foot ends); P4 = `expandBoundaries` post-grid bbox lowering. See the
  P3 + P4 findings above.

**All six patterns + the state-machine bonus are formalized.** The ONLY thing still deferred is a general
**obstacle-avoiding edge router** — a standalone router upgrade (not a pattern, not P4-specific) that
would improve every diagram. Everything the spike set out to formalize is shipped.

## Sequencing

**P0 (edge notation) first** — it unblocks P3 and the state-machine bonus and is small. Then **P1
(sequence)** — the highest-value standalone. Then P2 / P3 / P4 / P5 in any order (independent). Do the
feasibility stage for ALL patterns early (cheap) before deep auto-layout work on any — the feasibility
renders alone will tell you which patterns are "just missing layout sugar" vs "need a real new primitive."

_(Feasibility stage complete — see `## Findings` above. It confirmed this exact sequencing: P0 is the
sole primitive gap; P1/P2/P4/P5 are layout-only lowerings that emit marks and never touch the renderer.)_

## Scope guards

- **Kernel-clean.** Everything stays pure-SVG; extends `diagram-core` + `CreationMap` only. No
  `lib/graph` render stack, no `sharp`. Check E must stay green.
- **MVP each.** Not the full UML / BPMN / mermaid spec — the 80% that people actually draw. Frames,
  fancy ER notations, Gantt dependencies-as-arrows are all "later."
- **Bind discipline.** Anything formalized gets ONE vocab home in `diagram-core`, a fixture through
  `diagram-core.binding.test.js`, and stays byte-identical for a full install.
- **Auto-layout is the value AND the risk.** A pattern whose only gap is "compute coordinates" is worth
  a layout helper; a pattern that needs a genuinely new visual primitive is a bigger commit. Separate
  the two in the recommendation.
- **No made-up depictions.** Spike examples should depict something REAL (the mojulo request path, the
  control-plane topology, a real schedule) — the review that spawned this plan flagged filler diagrams as
  a smell.

## Done-criteria (of the spike)

1. A reference render per pattern under `spike-output/` (feasibility stage, minimum).
2. A `## Findings` section per pattern in this doc: the minimal vocab proposal, the `diagram-core` +
   `CreationMap` deltas, the auto-layout math, and a **build-now / defer** recommendation.
3. A final synthesis: the 2–3 patterns worth formalizing first, and for each, a one-paragraph
   formalization plan (vocab → validator → renderer → binding fixture).
4. No change to shipped behavior — spikes are throwaway; formalization is a separate, per-pattern follow-up.
