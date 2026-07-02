# floorplan-bim — a retained element model over the house generator

## Why

[floorplan-structure.js](./floorplan-structure.js) is a **generate-once → bake faces → discard** pipeline.
`structurizeHouse()` computes a full classified wall graph, opening set, storey stack, slab voids,
and a room-to-room door graph — then consumes all of it into `faces` and returns the geometry only.
Everything a rudimentary BIM needs is computed; nothing is *retained with identity*.

This plan promotes the existing transient structures into an addressable **element store**, and adds a
pure **derivation reader** (schedules / quantities / a code-style egress check) over it. No new geometry,
no new solver — `faces` becomes one projection of the store; schedules become other projections.

We are ~2 abstractions from a basic BIM:
1. **This file** — retained, typed, ID'd elements + relationship edges (the "I" in BIM).
2. **The reader** — schedules / quantity takeoffs / egress check (cheap once #1 exists).
3. *(Out of scope — real BIM)* editability / round-trip: dragging an element and reconciling IDs
   instead of re-seeding. That is the boundary where content-addressed IDs must become persistent ones.

## What gets promoted (every entity is a rename of something the generator already builds)

| Element | Source today | Source location |
| --- | --- | --- |
| `Building` | the `structurizeHouse` return root | [floorplan-structure.js:1863](./floorplan-structure.js#L1863) |
| `Storey`  | `levels[]` row `{index, role, baseZ, height}` | [:1831](./floorplan-structure.js#L1831) |
| `Space`   | `wallGraph.cells` / `plan.rooms` `{x,y,w,h,kind,glyph}` | [:1055](./floorplan-structure.js#L1055) |
| `WallRun` | `wallGraph.runs[]` `{orientation,at,along,interior,exteriorSide}` | [buildWallGraph:220](./floorplan-structure.js#L220) |
| `Opening` | `run.openings[]` `{a,b,sill,top,...}` — **door iff `sill===0`, window iff `sill>0`** | [isWindow:576](./floorplan-structure.js#L576) |
| `Slab`    | the floor plane + `structure.slabHoles` | [:1065](./floorplan-structure.js#L1065) |
| `Stair`   | `stairs[]` `{fromIndex,toIndex,upperIndex,slot}` | [:1771](./floorplan-structure.js#L1771) |

## Relationship edges (already computed at generation time — just written down)

| Edge | Derived from |
| --- | --- |
| `Space —bounded-by→ WallRun` | a run's `(orientation, at)` line lies on a cell edge — the plus/minus sweep already pairs them ([:186](./floorplan-structure.js#L186)) |
| `WallRun —hosts→ Opening` | already containment: `run.openings[]` |
| `Opening —connects→ Space,Space` | the door's two sides; the room-index door graph in [movement-flow.js](../movement-flow.js) |
| `Space/WallRun —on→ Storey` | the `for (const r of resolved)` level loop ([:1811](./floorplan-structure.js#L1811)) |
| `Storey —above→ Storey` | `index` ordering from `meru.resolveStack` |
| `Stair —serves→ Storey,Storey` | `fromIndex` / `toIndex` |

## Identity decision

For "rudimentary", **content-address** elements from quantized geometry —
`wall:L{idx}:{h|v}:{at}:{s0}-{s1}`, `space:L{idx}:{x},{y}`, `open:{wallId}:{a}`. Free, deterministic,
stable across re-bakes of the same seed. Upgrade to minted+reconciled UUIDs only when adding editing (#3);
content addresses break the instant you *move* a wall — which is exactly the generated/edited BIM boundary.

## Reader outputs (pure functions over the store)

- **Space schedule** — id, name (glyph→ARCHETYPES.name), storey, area = w·h.
- **Opening schedule** — id, door|window, width = b−a, height = top−sill, host wall, connects.
- **Wall quantities** — length, thickness (interior 0.42 / exterior 0.67), face area = length·storey height; totalled by interior/exterior.
- **Egress check** — every `Space` whose glyph rule `needsWindow:'egress'` (bedrooms) must host ≥1 window;
  reachability from the entry `Space` over the `connects` edges. The rule table already exists in
  [floorplan-glyphs.js](./floorplan-glyphs.js) `RELATIONSHIPS`.

## Reframe: BIM is the formal projection of a principles engine

The operator's framing (2026-06): mojulo already *has* the substance — **livability** (`assessLivability` over `RELATIONSHIPS`), **flow** (`assessFlow` — desire lines), and **feng shui** (`assessFlow`'s `axial-through-shot`/sha-chi, door confrontations, occluded centre, wet rest-corner, entry choke; plus the commanding-position placement in houses/offices/lobbies). "BIM" is not the destination — it is the **formalization** that makes those principles legible to a broad audience (builder, architect, client). Element model + schedules = the formal *projection*; livability/flow/feng-shui = the *meaning*. Same retain-what's-discarded move as geometry→faces, one level up: principles are applied at draw-time then thrown away → retain + evaluate them on the built result → project as legible findings.

- [x] **Universal principle layer** — [floorplan-principles.js](./floorplan-principles.js) `evaluateBuilding(input, { program })`: one surface that *reuses* `assessLivability` + `assessFlow` (not reinvents) and adds the structural/code principles the element model exposes, each tagged by **register** (`code`/`livability`/`flow`/`fengshui`) and **severity** (invariant/preferential). Proven cross-typology: the same call scored a residential house (caught `min-bath`) and a commercial restaurant plan (flow + feng-shui ran clean; only the residential proportion caps misfired — motivating program tables). These principles are already cross-typology in the codebase, so they belong in the universal bed; programs sit on top.
- [x] **Promote `role` onto cells** — `role` (true space-type) now rides alongside `glyph` (furniture/finish costume) through the whole pipeline: stamped by the commercial generators ([floorplan-restaurant.js](./floorplan-restaurant.js): dining/kitchenBOH/restroom; [floorplan-office.js](./floorplan-office.js): openOffice/meetingRoom/breakout/kitchenette/restroom), carried through `structurizeFloorplan`'s cell reconstruction, and surfaced on `space.role` by `buildElementModel` (defaults from glyph when absent, so houses are unchanged). The conference-room-as-`D` costume is now backed by `role: 'meetingRoom'`.
- [x] **Program rule tables** ([floorplan-principles.js](./floorplan-principles.js) `PROGRAMS`) — thin, type-specific rules reading `space.role` over the walkable graph, layered on the universal bed; `evaluateBuilding(input, { program })` runs them tagged `universality:'program'`. Shipped: restaurant (front-of-house/back-of-house separation — restroom reachable from dining *without crossing the kitchen*; kitchen service exit) and office (meeting rooms open onto circulation). Proven: a restroom-only-via-kitchen layout drops to 0.72 / `ok=false` with the FOH/BOH invariant; a sound restaurant passes.
- [ ] **More programs / richer tables** (lobby; restaurant ≥2-exit occupancy; retail) — the pattern is set, these are now small additions.
- [ ] **Universal commercial principles** (pay off across all types): egress/exit count + travel distance, accessible route (clear widths), front-of-house/back-of-house path separation.
- [ ] **Feng-shui commanding-position as an evaluable principle** — currently generation-applied (furnishRoom) but NOT retained, because furniture isn't in the element model yet. Promote furniture → then the command position can be *checked*, not just placed.

## Status

- [x] `buildElementModel(house)` — walks `levels[].structure.wallGraph` + `stairs` → `{building, storeys, spaces, walls, openings, slabs, stairs, edges}`. See [floorplan-bim.js](./floorplan-bim.js).
- [x] `deriveSchedules(model)` — space / opening / wall-quantity / egress / adjacency / reachability projections.
- [x] `floorplan-bim.test.js` — runs both against a real `structurizeHouse` 2-storey program house and prints the schedules.
- [x] **Precise `Space —bounded-by→ WallRun` edges** — wall-on-cell-edge with span overlap; reciprocal; windows verified to land only on exterior walls (no egress double-count).
- [x] **`Opening —connects→ Space,Space` edges** — side-of-line resolution at the opening midpoint; handles merged runs; 2 sides = interior, 1 side = exterior. Doors populate `space.connects` (the walkable graph).
- [x] Adjacency (`mustTouch`/`mustNotTouch`) + per-storey reachability (connected components) checks over the edges.
  - Finding: `mustTouch:'circulation'` must treat the **open core** (public room, `privacyDepth ≤ 1`) as circulation, not only an `H`-glyph hall — else open-plan program houses false-fail. Encoded in `isCirculation`.
- [x] **Quality loop: `scoreHouse(model)` + `generateBestHouse(input, opts, {samples})`** — grades a finished plan 0..1 (reachability / egress / proportion / adjacency / daylight) from the element model alone; best-of-N generates, grades, keeps the winner. Grader proven to discriminate (a window-stripped house scores strictly lower; an isolated room tanks reachability).
  - **Finding (important): the program generator is near-uniform.** Every seed scores 0.96–0.98, dinged only by the *same* quirk each time, so best-of-N has little to select between. On *this* generator the grader's value is **measurement/visibility + a regression guard**, and the higher-value quality lever is **repair** (fix the flagged weakness), not selection.
  - **Finding: `mustTouch`/aspect rules need an open-core notion.** The lone recurring ding is "lounge too long & thin (aspect 2.2 > 1.8)" — the open core bundles living+dining+kitchen, so the single-room `L` aspect cap is too strict (same flavour as the circulation refinement). A real refinement, not a house defect.
  - **Bug found (separate): `bsp` + multi-level mode throws `null 'x0'`** in the generator path (not the BIM layer). Out of scope here; worth a standalone fix.
- [x] **Repair pass** — `repairFloorplan(plan)`: any room with no walkable door gets one cut into its widest shared wall with an already-reachable room; loops until reachable or genuinely detached. Proven: a doors-stripped plan goes reachability 0.17 → 1.00 in 5 fixes.
- [x] **Wired into the product at authoring time** — `improveFloorplanManifest(manifest)` grades every floorplan, best-of-N reseeds (or repairs) only houses with a *hard* defect (stranded room / no-egress bedroom), and stamps a `quality:{score,breakdown,violations}` field onto the stored manifest. Called from `mintSketch` (the shared create **and** update path) in [control/lib/mcp/tools/sketches.js](../../mcp/tools/sketches.js) — guarded so grading can never block minting; a strict no-op for non-floorplan kinds. The render path stays pure (it just regenerates the stored manifest). `gradeFloorplanManifest` doubles as the read surface.
  - Side fix: cleared a pre-existing `up/**` typo at the top of [saturn-view.js](../../mcp/tools/saturn-view.js) that was crashing *all* MCP tool registration (32 → 1 unrelated test failures).
- [ ] MCP `describe_house` *tool* (agent-facing) — the data now exists via `gradeFloorplanManifest`/`deriveSchedules`; a thin tool wrapper is still unbuilt.
- [ ] Open-core aspect rule refinement (don't hold a living+dining+kitchen core to the single-room `L` aspect cap) — the one recurring proportion nit.
- [ ] Cross-storey reachability via stairs (today reachability is per-storey; stairs connect storeys but aren't yet spliced into the walkable graph).
- [ ] Separate generator bug: `bsp` + multi-level mode throws `null 'x0'`.
