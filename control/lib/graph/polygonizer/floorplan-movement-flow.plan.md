# floorplan-movement-flow — the movement field over the placement field

Status: BUILT (rooms) — this is now the ROOM CHAPTER of the scene-wide master plan
`../movement-flow.plan.md`, which extracts a shared field every placement kernel
(furniture, building, restaurant, dungeon, city) consults. Read that for the rollout.

A second constraint layer over `generateProgramPlan`
(floorplan-glyphs.js), a sibling to floorplan-livability.plan.md. Where livability
constrains **where materials sit**, this constrains **how a body moves through them** —
and reports the result as **movement-flow impairment**: a diagnostic penalty on a draw,
not a positive style score. (These are well-known spatial circulation heuristics; the
layer is deliberately named for the mechanical fault it detects, not any tradition.)

Scope of this first pass (operator-set): the movement-flow impairment set below, as an
evaluate-and-rewrite stage over the generator's output. Anchor-furniture ORIENTATION
(bed/stove/desk/seat facing the door, back to a wall) is named for completeness but
DEFERRED — it reaches into floorplan-structure.js furnishing and is a separate pass.

## Premise

The livability layer (`RELATIONSHIPS` in floorplan-glyphs.js:153) is a **placement
field**: `mustTouch`/`mustNotTouch` (who-abuts-whom), `needsWindow`/`canBeInterior`
(who-faces-the-street), `privacyDepth` (front→back order), `minDim`/`maxAspect`
(don't-make-a-slab). Every concern answers *where does this thing go*. Circulation is
only ever a **byproduct** — the bedroom-hall pocket (floorplan-glyphs.js:737) and the
stair bay (`:798`) are reactions that fall out of placement rules, not goals.

fractal-city.js already treats movement as **first-class** and gives us the vocabulary:
streets *are* the subdivision gesture; the occupancy grid is a movement-aware budget;
`shiftLineOut` (fractal-city.js:430) refuses to run a street straight through a mass;
`sinePath` meanders; junction lanes carry directional flow; landmarks are navigated
*around*, never *through*. That is the half the house generator is missing: a model of
how a body travels from the front door through the home without rushing straight out,
colliding head-on, or stagnating. This layer ports that thinking into the house and
scores the **impairments** to it.

The mechanism mirrors `archetypeArea`/`RELATIONSHIPS`: a declarative table + a pass that
reads it. The new control-flow piece (the one floorplan-livability.plan.md:163 deferred
as "re-seed/repair") finally earns its keep here, because flow impairments — unlike
placement rules — are NOT all satisfiable by construction; some need a cheap repair, some
only a better draw.

## The movement model

Three primitives, all derivable from the existing `generateProgramPlan` output
(`{ rooms, halls, doors, stairZone, terraceZone, width, height }`) — no new geometry:

- **Entry axis** — the ray from the entry door (`doors.find(d => d.entry)`) shooting
  perpendicular into the footprint (along the depth axis `DE`). The reference for
  everything flow-related.
- **Circulation spine** — the hall/landing cells (`halls[]`) plus the open-core mouth:
  the graph a body actually walks (entry → core → mouth → hall → room doors).
- **Rest field** — per room, the cell diagonally opposite its door (the natural rest
  point); and the home's far-diagonal corner from the entry (the deepest rest point).

## The impairment set

Each rule names a movement FAULT and a penalty when present. Two classes:

- **NECESSARY** — impairments normally cleared (by repair or seed selection) before a
  draw ships. Cheap to fix, and disruptive enough that a random draw should not keep
  them. The operator can FORCE-accept them (see policy); they are never hard-rejected.
- **PREFERENTIAL** — impairments minimized when possible but tolerated; they bias seed
  selection, never gate, and degrade first under a tight footprint.

| impairment | class | the fault | reads | how it's cleared |
|---|---|---|---|---|
| **axial through-shot** | NECESSARY | entry aligned with a far opening → a body/draught runs straight in and out | entry axis vs far doors | offset entry / rear door (repair) |
| **opposing-door confrontation** | NECESSARY | two room doors open head-on across a hall | door midpoints on a shared hall | stagger one door (repair) |
| **entry choke** | PREFERENTIAL | a wall/door in your face on entry, no breath of space | clear depth ahead of the entry | better seed (selection) |
| **straight-run corridor** | PREFERENTIAL | a long dead-straight circulation run, no turn | spine straightness | slide the mouth / better seed |
| **occluded center** | PREFERENTIAL | dead mass (stair, bathroom) sits on the home's centroid | stair/`W` rects vs centroid | better seed (selection) |
| **wet-room in rest corner** | PREFERENTIAL | a `W`/`Y` squats the far-diagonal rest corner | wet rooms vs entry-diagonal corner | better seed (selection) |

### Fault semantics

- **axial through-shot.** Entry axis collinear (within ~a door-width band) with a far
  exterior door/large window on the opposite wall. Today `entryA` is a free random in
  `[0.3, 0.7]·AL` (floorplan-glyphs.js:746) and the terrace door is seated to one side of
  it (`:824`), so dead-alignment is possible but unbiased. Repair: nudge `entryA` or the
  rear opening off collinear — a literal `shiftLineOut`.
- **opposing-door confrontation.** Doors land at each room's segment midpoint (`:788`,
  `:663`) with no cross-hall stagger awareness, so two equal-width rooms face off exactly.
  Repair: nudge one midpoint within its segment by ≥ a threshold (~1.5 ft).
- **entry choke.** Penalty = inverse of the clear depth along the entry axis before the
  first obstruction. The single-floor open core usually gives this; the penalty protects
  it from a stair or mouth crowding the threshold. (The restaurant view already reserves
  an entry throat — same instinct.)
- **straight-run corridor.** Penalty grows with how dead-straight the entry→mouth→room
  path is. The wing mouth, hardcoded to `doorAt(AL/2, …)` (floorplan-glyphs.js:740), is
  the cheapest lever: off-center, it bends the path (the `sinePath` move on a hall).
- **occluded center.** Penalty when a `W` or `stairZone` overlaps the footprint centroid;
  reward for circulation/open core through the middle. Reads `stairZone`/`W` vs centroid.
- **wet-room in rest corner.** Penalty when a `W`/`Y` lands in the far-diagonal corner
  from the entry. Couples to `privacyDepth` (which groups wet rooms) but adds a positional
  preference the depth sort is blind to. Reads wet-room rects vs the entry-diagonal corner.

## Policy — best effort, operator override (no gate)

The default is **best if possible**: minimize total movement-flow impairment, clearing
the NECESSARY class. The operator can **force** a draw that still carries impairment. No
configuration is ever hard-rejected — consistent with the repo posture (CLAUDE.md golden
rule: assessments surface to the operator; mojulo composes, the operator owns the
consequence). Concretely:

- **Default (`flow: 'best-effort'`).** Run select-best-of-N (below); apply `repairFlow`
  to clear NECESSARY impairments on the chosen draw; minimize PREFERENTIAL impairment
  across the N. Ship the result with its residual impairment recorded.
- **Force (`flow: { force: seed }` or `flow: 'off'`).** Use exactly this seed/draw (or
  skip the flow stage entirely). Any residual impairment is recorded as
  **operator-accepted** — surfaced in the assessment, not removed, not blocked.
- **Always recorded.** `assessFlow(plan)` returns the impairment list either way, so a
  forced draw is transparent about what it carries; the dashboard/world caller can show
  it. The flow stage never silently drops a draw.

## Where it wires in — at the orchestration altitude, NOT the kernel

The decisive realization: **every lever these rules need is already a field in the plan
object `generateProgramPlan` emits** (`{ rooms, halls, doors, stairZone, … }`). The
"free placement choices" — the wing-mouth, the entry door, room door midpoints — are not
generator internals; they are entries in the returned `doors` array. So the whole layer
lives **downstream of the generator as a stage over its output**, and
`generateProgramPlan` is sealed (zero edits; existing callers/tests unperturbed by
construction). One new module + a thin wrapper; the kernel is a black box.

```
generateProgramPlan(seed) ─► plan ─┐
                                   │  Tier A — select best of N seeds
   assessFlow(plan) + assessLivability(plan) ─► impairment
                                   │
                                   ▼
   repairFlow(plan) ─► plan'        Tier B — pure plan→plan rewrite
                                   │
                                   ▼
   structurizeFloorplan(plan') ─► geometry   (unchanged; re-clamps doors)
```

**Tier A — evaluator + selector (truly zero implementation change).**
- New impairment table + a pure `assessFlow(plan)` in a sibling `floorplan-flow.js`,
  returning `{ impairment, necessary:[{rule,detail}], preferential:[{rule,detail}], ok }`
  (`ok` = no NECESSARY impairment remains). Same shape discipline as `assessLivability`,
  so tests and the spike harness consume both identically.
- A thin **select-best-of-N-seeds** wrapper keeps the lowest combined impairment (gated
  on `assessLivability().ok`). This is the only mechanism for the **geometry-bound**
  PREFERENTIAL rules — **occluded center** and **wet-room in rest corner** — which can't
  be moved post-hoc (relocating a `W` would re-tile the row); they are reduced by *picking
  a better draw*, not editing one.

**Tier B — `repairFlow(plan) → plan'`, a pure transform on the emitted object.**
- Doors are data; moving a door midpoint is `plan → plan`. Clears the door-lever
  impairments: **axial through-shot** (offset the entry/terrace door off collinear),
  **opposing-door confrontation** (stagger one of two head-on hall doors), and reduces
  **straight-run corridor** (slide the wing-mouth off `AL/2`).
- Sits between `generateProgramPlan` and `structurizeFloorplan`. `placeOpenings`
  (floorplan-structure.js) already re-clamps every door to its wall run, so a relocated
  door flows through the existing pipeline with no special handling. The rewriter keeps a
  moved door on its room's shared edge and clear of the stair clearance — both readable
  from the plan's rects, still no generator change.

### Altitude limits of evaluating on the recipe output (honest trade-offs)

1. **Selection can't shift the distribution.** For the geometry-bound rules, select-best
   only ranks draws the generator *happens* to emit; on a footprint whose distribution
   rarely yields a low-impairment draw it returns "least impaired," not "unimpaired."
   Reaching into the generator is the escape hatch — taken only where selection
   demonstrably can't reach, not preemptively.
2. **Windows are not in the plan output.** They are added downstream by `placeOpenings`
   from `needsWindow`/perimeter runs, so a plan-level `assessFlow` catches axial
   through-shots against *doors* but is blind to a far *window* on the entry axis. If
   window-alignment matters, run a second, finer `assessFlow` on the *structurized*
   geometry. That is the altitude dial: evaluate on the cheap plan for the orchestration
   loop; optionally on the heavier structurized output for window polish.

## Graceful degradation (relaxation order)

When a footprint can't reach zero impairment, relax in THIS order (never below livable —
livability invariants always win over flow):

1. Drop the deferred POLISH (anchor-furniture orientation).
2. Relax PREFERENTIAL impairments in this order: wet-room-in-rest-corner → straight-run
   corridor → occluded center → entry choke (most aesthetic first, clearest threshold
   last).
3. Demote the NECESSARY impairments to recorded-but-tolerated when no door offset fits a
   tight footprint — flagged in `assessFlow`, never gating the draw.
4. NEVER trade away a livability invariant (reachability, common bath, bedroom egress,
   bath-door rule) to buy a flow gain. Flow biases the draw; livability bounds it.

## Resolved / open decisions

- **RESOLVED — policy.** Best-effort by default (select-best + repair), operator can force
  a draw and accept residual impairment; nothing is hard-rejected. (Policy section.)
- **RESOLVED — naming.** Diagnostic, mechanical names ("movement-flow impairment", per-rule
  fault names); no tradition branding.
- **OPEN — select-best default count `N`.** Start ~4–6; cost is N× generation per plan.
  Worth a default the world/dashboard caller can lower for interactive speed.
- **OPEN — tolerance bands.** Through-shot collinearity band (~3 ft / one door-width) and
  the door-confrontation offset (~1.5 ft) are dials — tune against the spike harness
  across seeds × tiers.
- **OPEN — restaurant/building reach.** This pass targets the house
  (`generateProgramPlan`). The restaurant (floorplan-restaurant.js) and commercial floor
  (floorplan-building.js) have their own flow grammar (front-of-house desire lines, the
  kitchen no-cross rule, lobby throat) — a follow-on, not folded in here.

## Relationship to the city substrate

Deliberately the same move fractal-city.js makes, run the other direction: the city draws
**movement first** (streets subdivide, then blocks fill) and lets placement fall out; the
house draws **placement first** (rooms tile, livability binds) and, with this layer, lets
movement-flow impairment bias the result. Same movement-field vocabulary (`shiftLineOut`
≙ axial through-shot repair, `sinePath` ≙ straight-run relief, navigate-around-mass ≙
occluded center), two scales. A later unification could share one impairment kernel.
