# floorplan-livability — the relationship spec that makes random draws livable

Status: PARTIALLY IMPLEMENTED (steps 1–3 landed in floorplan-glyphs.js).
Planner-authored constraint layer over `generateProgramPlan` (floorplan-glyphs.js)
and `structurizeFloorplan` (floorplan-structure.js).

Landed:
  - STEP 1 — `W` bathroom + `Y` laundry archetypes; the `RELATIONSHIPS` table
    (all 10 glyphs); `PACKING`/`archetypeArea` budgets for the wet rooms.
  - STEP 2 — bath woven into the program: every house has ≥1 bath, seated on the
    bedroom floor (upstairs when multi-floor); a villa earns a second. Eviction
    keeps the bath over a bedroom under the `maxPerRow` cap.
  - STEP 3 — the BEDROOM-HALL POCKET: a single-floor open-core house now inserts a
    circulation hall between the core and the private row, so baths/bedrooms door
    onto the hall, not the living core (the W↔L/K/D no-shared-door rule). Per-room
    `minDim` clamps via an extended `partitionWeighted`. `privacyDepth` groups the
    row. `assessLivability(house)` is a pure invariant CHECK (min-bath aggregated
    across floors; no bath-onto-public). Verified: tiling exact + livable across
    150 seeds × all tiers, single- and multi-floor.

  - STAIR + KITCHEN refinements (operator feedback):
    * Kitchen-along-the-edge — open-core zones reordered `[L,D,K]` so the kitchen sits at a
      core END against an exterior wall; `arrangeKitchen` takes a `wall` hint and runs the
      counter along it (verified: counter hugs the perimeter wall, not the interior seam).
    * Stair orientation — `stairDir` resolved at seating time so the flight's open end faces
      the entry/core, never the end wall (low-side seats run `−`, high-side `+`).
    * Stair BAY (wired into the area budget) — the private row tiles AROUND a circulation
      column at the flight's along-span (+ clearance), reserved as a hall. No room sits in
      front of/behind the stair (0/80 room doors within the stair x-span), and the stair
      COSTS floor area the rooms yield (rooms drop if squeezed). The reserved run is sized to
      the real switchback footprint (~14 ft) so the bay matches the flight, not dead space.

Deferred (need surface that doesn't exist yet, or a separate concern):
  - `canBeInterior` interior-room packing — both topologies still put every room on
    the perimeter; no interior room slot to absorb yet.
  - Wet-wall clustering invariant (bath/kitchen on a shared plumbing wall, baths
    stacked across floors) — a structurizer-level concern.
  - `needsWindow` as a per-room driver — daylight currently comes from the existing
    "window on every perimeter run" pass, which already covers perimeter rooms.
  - Re-seed/repair loop — `assessLivability` only checks; every config passes today,
    so no repair is wired.

## Premise

The house is **composed from rules, not hand-laid**. So the planner's job is not
to draw a good plan — it is to constrain the generator so that the *worst* random
draw is still livable. Every rule below is sorted into one of three buckets:

- **INVARIANT** (hard) — a plan that violates it is rejected or repaired. The
  livability floor.
- **GRADIENT** (soft) — biases the seed/draw; never gates it. Shapes the
  distribution toward good.
- **POLISH** (aesthetic) — raises the ceiling, not the floor. Deferred until the
  invariants hold; a random generator can't be trusted to deploy taste.

The mechanism mirrors the existing `archetypeArea(glyph)` move: each archetype
*declares* what it needs (here: relationships, not furniture), and the placer
reads the declaration. One data table, consumed by the layout pass.

## Archetype set (existing + required additions)

Existing glyphs: `H` hall · `E` entry · `L` lounge · `D` dining · `K` kitchen ·
`B` bedroom · `O` office · `S` storage.

**Required additions (the wet rooms — currently missing):**
- `W` — bathroom / washroom. The single biggest livability gap. Without a
  reachable common bath, no draw is livable.
- `Y` — laundry / utility. Optional per size, but it's a wet room so it belongs to
  the same plumbing logic.

`E` and `H` are **circulation**, not habitable rooms — they anchor the privacy
gradient (depth 0) and carry the reachability invariant rather than the daylight
one.

## The relationship spec

Per archetype, the placer reads these fields. `needsWindow` / `canBeInterior` /
`reachVia` are INVARIANTS; `privacyDepth` / `mustTouch` / `nearTo` are GRADIENTS;
`minDim` / `maxAspect` are INVARIANTS (dimension floor).

| glyph | room | needsWindow | canBeInterior | privacyDepth | minDim (ft) | maxAspect | mustTouch (hard) | nearTo (soft) | mustNotTouch (hard) | reachVia |
|---|---|---|---|---|---|---|---|---|---|---|
| `E` | entry | no | yes | 0 | 5 | 2.5 | front exterior wall | living | — | exterior |
| `H` | hall | no | yes | 0 | 3.5 (clear) | — | ≥2 rooms | — | — | public |
| `L` | lounge | **yes** | no | 1 | 11 | 1.8 | entry/circulation; core (K/D) | — | — | public |
| `D` | dining | preferred | tolerated | 1 | 9 | 2.0 | **kitchen**; living | — | bath door | public |
| `K` | kitchen | preferred | yes | 2 | 8 | 2.2 | dining; **wet wall** | living | bedroom (direct) | public |
| `B` | bedroom | **yes (egress)** | **no** | 3 | 10 | 1.8 | circulation | a bath | entry sightline | circulation |
| `O` | office | preferred | tolerated | 2 | 8 | 2.0 | circulation | — | — | circulation |
| `S` | storage | no | **yes** | 1 | 4 | 3.0 | circulation | kitchen/entry | — | any |
| `W` | bathroom | no (mech vent) | **yes** | 3 | 5 | 2.0 | **wet wall** | bedroom cluster | **kitchen/dining/living door** | circulation |
| `Y` | laundry | no | yes | 2 | 5 | 2.5 | **wet wall** | kitchen | living/dining door | circulation |

Field semantics:

- **needsWindow** — `yes` ⇒ the cell MUST own ≥1 perimeter wall segment, and
  `placeOpenings` MUST cut a window into it (egress-sized for `B`). `preferred` ⇒
  perimeter is a gradient bonus, not required. This is the inversion from the
  current "sprinkle windows on perimeter runs": demand flows from the room, the
  perimeter satisfies it.
- **canBeInterior** — the relief valve. `W`/`S`/`Y`/`K` can sit landlocked, which
  is what lets `B`/`L` always claim the perimeter. A generator that requires
  *everything* on the exterior wall is unsolvable past a few rooms; this field is
  what makes the daylight invariant satisfiable.
- **privacyDepth** — 0 (entry) → 3 (bed/bath). The layout orders rooms front→back
  by depth. This single gradient kills most "weird" draws: bath stops landing off
  the dining room, bedrooms stop fronting the door. Anchors to the existing
  `PUBLIC`/`PRIVATE`/`SERVICE` hint arrays already in floorplan-glyphs.js.
- **mustTouch / nearTo / mustNotTouch** — the adjacency grammar. `mustTouch` is a
  shared-wall or shared-cell requirement; `nearTo` is a same-zone preference;
  `mustNotTouch` forbids a *door* between the two (a bath may share a wall with the
  kitchen — plumbing — but its door may not open onto it).
- **reachVia** — the access-graph invariant: from the entry you must reach this
  room passing only through cells of this class or shallower. `circulation` =
  hall/landing/core; you may NOT route to a bedroom *through* another bedroom.
- **minDim / maxAspect** — dimension floor. Area alone is a lie: a 4×28 room has a
  bedroom's area and is unlivable. Extends the existing `balanceWeights` width
  nudge into a true clamp on the short dimension and the aspect ratio.

## Plan-level invariants (not per-room — checked on the whole draw)

1. **Reachability.** Every habitable room is reachable from `E` through
   circulation/public space only. No room is the sole path to another (no
   walk-through bedrooms). *Reject/repair on violation.*
2. **Common bath.** At least one `W` is reachable from public circulation WITHOUT
   entering a bedroom. Ensuites (`W` off a `B`) are allowed only *in addition* to
   the common bath, never instead of it.
3. **Privacy gradient holds.** Rooms are monotonic-ish in `privacyDepth` from the
   entry: no depth-3 room sits in front of a depth-1 room relative to the door.
   *Gradient — scored, re-seeded if badly violated, not hard-rejected.*
4. **Wet-wall clustering.** All `K`/`W`/`Y` share at least one common plumbing wall
   per floor, and on multi-floor houses upper `W` stacks over a lower wet wall.
   Both a buildability rule and a livability proxy (keeps baths near bedrooms).
5. **Daylight.** Every `needsWindow:yes` room owns a perimeter segment with a cut
   window; every `B` window is egress-sized. *Invariant.*

## Graceful degradation (the relaxation order)

When the footprint can't satisfy everything (small house, dense seed), relax in
THIS order so the floor never drops below livable:

1. Drop POLISH (foyer definition, articulation) — already deferred.
2. Fold rooms per the existing `coreZones` logic (dining into living under
   ~900 sqft) BEFORE shrinking anything below `minDim`.
3. Relax `nearTo` (soft adjacency) and `preferred` windows.
4. Relax `privacyDepth` ordering (gradient) — accept a slightly mixed sequence.
5. NEVER relax: reachability, common bath, bedroom egress window + minDim,
   `mustNotTouch` bath-door. If these can't be met, the footprint is too small for
   the requested program — shed a room (fewer beds) rather than violate them.

## Where it wires in (internals — next session)

- New `RELATIONSHIPS` table beside `ARCHETYPES` in floorplan-glyphs.js (or a sibling
  `room-relationships.js`), keyed by glyph.
- `generateProgramPlan` consumes `privacyDepth` for front→back ordering,
  `canBeInterior` to decide which rooms absorb interior cells, `minDim`/`maxAspect`
  to clamp `partitionWeighted`.
- `W`/`Y` added to the wishlist logic and `archetypeArea` (bath budget ~`toilet`+
  sink+tub footprint; laundry ~washer+dryer).
- `placeOpenings` (floorplan-structure.js) reads `needsWindow` to drive window
  demand from rooms instead of sprinkling.
- A post-generation validator runs the five plan-level invariants and triggers
  re-seed/repair — the only new control-flow piece.

## Resolved decisions (operator)

- **Bath count.** At least ONE bathroom in every house — a common bath is a
  non-negotiable wishlist entry at all sizes (cottage included). A SECOND bath (the
  "primary bath") is added only when the house is big enough AND a primary bedroom
  is large enough to justify it (gate on villa-size footprint + a large `B`). The
  wishlist budget reserves the first `W` unconditionally and the second
  conditionally, before private bedrooms compete for remaining area.
- **No ensuites — both baths on common circulation.** Even the primary bath doors
  onto the hall/landing, NOT through the bedroom. So `W.reachVia = circulation`
  holds for every bath with no exception, and the "common bath reachable without
  entering a bedroom" invariant covers ALL baths, not just the first. The primary
  bath is simply seated `nearTo` the primary bedroom while still doored to
  circulation — proximity, not penetration.
- **Laundry is a wet-wall closet under villa size.** `Y` materializes as a real
  room only at villa+; below that it's a stacked washer/dryer closet absorbed into
  the kitchen/bath wet wall (no separate cell, no door-clearance cost), so it never
  competes with habitable rooms for area on a small footprint.

### Consequences for the wishlist / budget

- `chooseRooms` wishlist gains `W` as a mandatory first entry; the second `W` is
  appended only when `footprint ≥ villa` and a primary `B` clears the size gate.
- `archetypeArea('W')` ≈ toilet + sink + tub/shower footprint ÷ packing (~40 sqft
  min); `archetypeArea('Y')` only consulted at villa+ (closet form is a fixed
  ~3×5 ft strip on the wet wall otherwise).
- The primary-bath gate reads the largest `B`'s post-`partitionWeighted` area, so it
  fires after room sizing, not before — a "big enough master" is decided on the
  actual draw, not the wishlist.
