# movement-flow — one shared field, every placement kernel consults it

Status: BUILT (first pass across all five kernels). The shared primitive is
`graph/movement-flow.js`; each kernel adapter landed and is regression-clean (52 tests).
The room+door slice is `polygonizer/floorplan-flow.js`, specced in
`polygonizer/floorplan-movement-flow.plan.md` — the ROOM CHAPTER of this one. This
document is the scene-wide unification: the movement field as a first-class concern in
EVERY placement kernel, via one primitive each kernel adapts.

Built so far (each a small, reviewable diff with a smoke/demo):
  - Phase 0 — `graph/movement-flow.js` primitive; `floorplan-flow.js` re-pointed at it
    (no behavior change; room demo byte-identical).
  - Phase 1 — furniture COMMAND POSITION: `orientElementsToDoor` rotates the canonical
    layout to the room's real door (anchor backs a solid wall, faces the door). Demo:
    `integration/0628/spike-output/movement-flow-furniture/`.
  - Phase 2 — dungeon: fire seated AWAY from the primary exit + thrown TOWARD it (reads
    `plan.mouths`); `assessDungeonFlow`.
  - Phase 3 — building + restaurant: the entry→pass DESIRE LANE added to the existing
    `clearances`, so the table scatter can't wall off the walked spine.
  - Phase 4 — city: park benches FACE the pocket's gathering centroid (`parkBench(…, face)`)
    — the field's "face the attractor", applied locally. Full region-wide `flowField`
    wiring (street sources + civic sinks) remains the documented next step.

## The principle (and the trap it avoids)

"Touch all the kernels" must NOT mean each kernel grows its own copy of through-shot /
command-position / desire-line logic. That gives N implementations that drift. Instead:
**one movement-flow primitive** models the field; **each kernel supplies its own graph
and queries the field** for the placement choices it already makes freely. The kernels
stay different (a room is not a city); the field model is shared.

The recurring shape across all kernels, found by inventory:
- an **entry/spawn anchor** + an axis it shoots along (front door, restaurant entry,
  lobby throat, dungeon spawn, street frontage);
- a **circulation graph** (doors, the wing-mouth, kitchen pass, tunnel mouths, streets);
- **placeable things with a free position/orientation** that today ignore both (furniture
  `facing`, driveway side, bench axis, bar/counter/desk orientation, prop scatter).

Each kernel already HAS the first two — they just aren't represented the same way, and the
third never reads them. The work is to (a) normalize each kernel's graph into the shared
field, and (b) route its free choices through the field.

## The shared primitive — `graph/movement-flow.js`

A pure, dependency-free geometry kernel (no kernel-specific knowledge). Two layers:

### Core (serves rooms, furniture, building, restaurant, dungeon)

Geometry over `(region, entry, openings, barriers)`:

- `entryAxis(entry)` → the ray a body shoots from an entry/spawn. Edge-aware
  (N/S → vertical axis, E/W → horizontal), the move `floorplan-flow.js` already makes.
- `onAxis(point, axis, band)` → through-shot test (a far opening collinear with entry).
- `commandCell(rect, opening)` → the rest cell diagonally opposite the opening: where an
  anchor object wants to sit (back to a solid wall, facing the opening, off its axis).
- `facingToward(cell, opening)` → `'N'|'S'|'E'|'W'`, so an object's existing `facing`
  field can be computed to front the door instead of a wall.
- `restCorner(region, entry)` → the far-diagonal still point (drains/wet rooms yield it).
- `desireLine(a, b)` + `blocks(rect, line, slack)` → does an object sit in a walked path.

### Field layer (serves the city; optional for the rest)

For kernels where flow is diffuse rather than a few doors:

- `flowField({ region, sources, sinks, barriers, cell })` → a coarse raster of
  `{ flow:[dx,dy], intensity }` per cell. Sources = entries/street centerlines (weighted
  by road class), barriers = masses, sinks = attractors (plazas, civic). This is the
  per-cell vector field the city occupancy grid lacks (it stamps *what*, not *flow*).
- `attractorOf(point, field)` / `edgeIntensity(point, field)` → so a bench faces the
  nearest attractor, a tree thins on a high-flow edge, a driveway turns toward access.

### Impairment vocabulary (shared, scale-translated)

The same fault names `floorplan-flow.js` defined, lifted to the primitive so every adapter
reports in one language: `axial-through-shot`, `opposing-confrontation`, `occluded-center`,
`rest-corner-drain`, `entry-choke`, and the object-scale `command-displacement`
(anchor not in command position) and `desire-line-blockage` (object in a walked path).
Each adapter exposes `assess<Scale>(…)` → `{ impairment, necessary[], preferential[], ok }`
and, where the fault is cheap to fix, a `repair`. Policy is uniform and already set in the
room chapter: **best-effort, operator can force, never a hard gate.**

## Per-kernel adapters

Each row: what it places blind today · the graph it already has · where the adapter hooks ·
what the field decides.

### 1. Rooms — `polygonizer/floorplan-flow.js`  [BUILT]

Door positions, blind to the entry pierce · graph = `plan.doors` · hook = plan→plan rewrite
downstream of `generateProgramPlan` (kernel sealed) · field clears through-shot
(slide the wing-mouth) and confrontation (stagger a door); select-best for the
geometry-bound rest-corner / occluded-center. Done; before/after demo in
`integration/0628/spike-output/floorplan-flow/`.

### 2. Furniture — `furnishRoom`/`furnishCell`/`arrange*`  [FIRST KERNEL EDIT]

The anchor object (bed/stove/desk/main seat) faces a wall/zone, never the door — there is
a `facing` field on every furniture item (floorplan-glyphs.js arrangers + ARCHETYPES;
consumed by `FACING_SPIN` in room-scene-elements.js) but no door context reaches the
furnisher. Graph = `plan.doors`, already in scope at the `structurizeFloorplan` furnish
call (floorplan-structure.js:~1090) but dropped at `furnishRoom`. Hook: thread `plan.doors`
→ `furnishRoom` → `furnishCell` → `furnishElements`, compute `anchorFacing =
facingToward(commandCell(rect, door), door)` and let each arranger apply it to its ANCHOR
piece (the bed in `arrangeBedroom`, the stove in `arrangeKitchen`, the desk in
`arrangeOffice`, the sofa in living). This is the first kernel-touching edit — small (an
extra threaded arg + one `facing` override per arranger), and the natural next before/after
(furniture rotating to face the door, like the door slid off-axis for rooms).

### 3. Building / restaurant — `buildFloor` / `buildRestaurant` fit-out

Circulation is ALREADY modeled here as clearance rects (entry throat, kitchen pass,
restroom approach) — the most flow-aware of the static kernels. What's blind: the RNG table
scatter and the fixed fixtures (bar, counter, security desk, kitchen island) orient to
walls/area-budget, not to the entry axis or the front-of-house desire line. Graph = the
existing `clearances`/`ctx` the fit-out functions already receive. Hook: enrich `ctx` with
the field (entry axis + desire lines from entry→bar, entry→pass) and have `cafeFitOut` /
`officeLobbyFitOut` / `furnishDining` (a) keep the RNG tables off the primary desire line,
(b) orient the anchor fixture to address the entry. Kitchen/restroom furnish are currently
clearance-unaware and would gain the same `ctx`.

### 4. Dungeon — `planDungeon` / `buildDungeonFaces`

Already the richest movement model: a `mouths` map (each chamber's exit azimuths) + an
oriented `spawn` (faces the first tunnel) + first-person camera framing. What's blind:
chamber props and the fire/glow light direction don't use the mouths. Graph = `mouths` +
`spawn` (already returned — no extraction needed). Hook: in `buildDungeonFaces`, read each
chamber's mouths to (a) aim the fire/relief light so the lit gradient points toward the
primary exit (the dungeon's "desire line"), (b) place props off the mouth azimuths so the
path between mouths stays clear. Lowest-risk adapter — the graph is already perfect.

### 5. City — `fractal-city.js` static-prop scatter

The occupancy grid stamps claims (ROAD/VERGE/BUILDING…) but encodes no flow direction or
intensity. Vehicles + pedestrians are already movement-first (railed to lanes, validated
against the grid); the gap is STATIC props: driveway side is a coin flip (line ~1278),
benches run along pocket geometry not facing attractors (line ~1989), trees scatter
uniformly even across a high-flow edge, corner doodads sit at fixed Cartesian offsets. This
is the kernel that needs the FIELD layer: build a coarse `flowField` from the street
centerlines (sources, weighted by road class) + civic attractors (sinks) after grid
stamping, then orient driveways toward street access, face benches at the nearest
attractor, thin trees on high-`intensity` edges, and bias corner doodads to busy corners.
Heaviest adapter (a new field pass) and lowest per-object correctness stakes, so it goes
last.

## Phased rollout (sequenced by risk × leverage)

0. **Extract the primitive.** Lift the geometry helpers `floorplan-flow.js` already
   contains (entry axis, command/rest cell, on-axis, desire line) into
   `graph/movement-flow.js`; re-point `floorplan-flow.js` at it (no behavior change — a
   pure refactor that proves the shared API on the kernel that already works).
1. **Furniture command-position** (kernel #2). The first real kernel edit; ships the next
   before/after demo (anchor furniture turning to face the door).
2. **Dungeon** (kernel #4). Graph already ideal; orient light/props off the mouths.
3. **Building / restaurant** (kernel #3). Enrich the existing `ctx`/clearances with the
   field; desire-line-aware fit-out.
4. **City field layer** (kernel #5). Add `flowField`; orient static props. Last.

Each phase is independently shippable, reviewable as its own diff, and adds an
`assess<Scale>` so the fault is visible before and after. Livability/structural invariants
always outrank flow (the room chapter's relaxation order generalizes: flow biases a draw,
it never breaks a wall or a clearance).

## Why this is the right "touch all kernels"

The alternative — bespoke flow logic per kernel — would mean five places to fix when the
through-shot tolerance changes, five subtly different command-position rules, no shared
vocabulary in diagnostics. The shared primitive makes the field one concept the whole
substrate speaks, mirrored after how the city already shares ONE occupancy grid across all
its placement, and how the floorplan already shares ONE `RELATIONSHIPS` table across rooms.
Movement-flow becomes the third such shared substrate concern, beside occupancy (space)
and relationships (adjacency): **circulation (path).**
