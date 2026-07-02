# floorplan-mall — a shopping-mall floor type

A new commercial floorplan, built the way the restaurant/office programs were: an explicit cell
plan through `structurizeFloorplan` (envelope, walls, storefront openings) → `buildElementModel`
→ the universal **principle** bed + a new **`mall`** program table. The surfaces and fixtures lift
the subway-station spike's tiling and the **workbench assembler** rather than inventing new ones.

Status: **plan only.** Phase 1 = one floor. Phase 2 = atrium void + escalators to a second level.

## Why a mall is the easy case

A mall is the cleanest possible test of everything we've built: it's a **circulation spine
(concourse) lined with tenant units** — i.e. role + the walkable `connects` graph *is* the design.
"Every shop must open onto the concourse", "the restroom must be reachable without walking through
a shop", "anchors at the ends" are exactly `role`-over-`connects` rules, same shape as the
restaurant's front-of-house/back-of-house separation.

## Reuse map (almost nothing is new geometry)

| Need | Lift from | Ref |
| --- | --- | --- |
| Long-hall floor tiling, joint bays | `tileCss`, segment-line bay loop | subway-station.js (`tileCss`:96; segment lines ~196) |
| Storefront pilaster colonnade | `tiledColumn` + `columnExclude` bay loop | subway-station.js (`tiledColumn`:143; colonnade ~217) |
| Tiled concourse walls / storefront returns | `tiledWall` | subway-building.js:79 |
| Skylight / coffered ceiling band | transverse-rib + glow-fixture loops | subway-station.js (~236, ~243) |
| Atrium void in the upper slab | `slabWithHole` | subway-building.js:358 |
| Escalator (already exists!) | `buildEscalator({x0,x1,yBot,yTop,zBot,zTop,dir})` | subway-building.js:193 |
| Stair flight (fallback / egress) | `buildStairFlight` | floorplan-structure.js:1549 |
| Directory kiosk, benches, planters, bins, posters | `buildInfoKiosk`/`buildBench`/`buildWasteBin`/`buildPoster` | subway-concourse-assets.js:32–113 |
| Custom fixtures (planter-bench, railing, mullion grid) | `lowerAssemblerFaces` + `repeat` arrays + gravity seating | workbench-assembler.js:181, repeat:113 |
| 2-level stack pattern (platform + mezzanine + void + escalator) | the whole composition | subway-building.js |
| Grade + schedule + rules | `evaluateBuilding(plan, { program:'mall' })` | floorplan-principles.js |

The subway *is* a long tiled hall with a colonnade, a skylit ceiling rhythm, fixtures, and a
2-level void+escalator stack. A mall concourse is the same primitive with shops instead of tracks.

## Data model — the mall plan

Authored explicitly (like restaurant/office), not BSP-generated. Coordinates follow the floorplan
convention (x = width, y = depth/long axis, z = up). The concourse runs **down the centre in y**;
tenants tile **both sides in x**; anchors cap the **y-extremes**.

```
buildMall({ width=64, height=120, concourseWidth=24, bayDepth=14, anchors=true,
            foodCourt=true, restrooms=2, seed=1, levels=1 }) → { faces, plan, footprint, ... }
```

Cells (each carries `glyph` = furniture/finish costume + `role` = true type the evaluator reads):

| Cell | role | glyph (costume) | placement |
| --- | --- | --- | --- |
| Concourse spine | `concourse` | `H` (circulation) | centre strip, full length |
| Tenant unit | `tenant` | `S`/`L` | bays tiling each side, `bayDepth` tall |
| Anchor store | `anchor` | `L` | large cell at each y-terminus, full width |
| Food court | `foodCourt` | `D` | a designated run of bays + open seating onto concourse |
| Restroom cluster | `restroom` | `W` | 1–2 bays, doored off the concourse |

Openings: each tenant/anchor/foodCourt/restroom gets a **storefront** door cut into its
concourse-facing wall (the `x = concourse edge` line). Mall entries are exterior doors at the
anchor ends. Same `placeOpenings` door spec we already use (`{x,y,edge,width,kind}`).

This is the office "back-band of rooms doored onto the open floor" pattern, mirrored on both
sides and scaled — so it leans on code paths that already work.

## Phase 1 — one floor

1. **`floorplan-mall.js` `buildMall(input)`** — tile the footprint into concourse + tenant bays +
   anchors + amenities; emit cells with `role`; place storefront + entry doors; call
   `structurizeFloorplan({ rooms, halls:[concourse], doors, width, height })` for envelope, slab,
   partitions, and storefront openings (gives us the wall graph + element model for free).
2. **Surfaces** — tiled concourse floor (bay joints every ~`bayDepth`), a storefront pilaster
   colonnade down each concourse edge (`tiledColumn` + exclude where an entrance/atrium sits),
   a skylit ceiling band (transverse ribs + glow strip) over the concourse.
3. **Fixtures** (workbench assembler, placed in the concourse centreline) — directory kiosks,
   planter-benches, bins; reuse `subway-concourse-assets.js` directly, author 1–2 mall-specific
   parts (planter-bench, tenant blade-sign) via `lowerAssemblerFaces`.
4. **Wire as `kind: 'mall'`** — `renderMallToHtml` in [scene-html.js](../scene-html.js) and
   `assembleMallWorldScene` in [world-scene.js](../world-scene.js), mirroring the restaurant
   dispatch. Add `'mall'` to `WORLD_RENDER_KINDS` ([sketch-manifest.js](../sketch-manifest.js)).
   It then flows through `mintSketch` and gets graded + a `quality` field for free.

## Phase 2 — second level (confidence: high, as a fast-follow)

Everything needed already exists in subway-building.js, which stacks a platform + mezzanine with a
punched slab void and an escalator. The mall version:

1. **Atrium void** — punch a hole down the concourse centre of the *upper* slab (`slabWithHole`);
   the ground concourse reads up through it.
2. **Escalators** — a criss-cross pair in the void via `buildEscalator` (up + down), landing on
   each level's concourse. A `buildStairFlight` nearby as the egress stair.
3. **Upper ring** — tenant bays around the void on level 2; a **balustrade railing** around the
   void edge (workbench: one baluster lathe + `repeat` along each void edge + a capping handrail
   sweep).
4. **Stacking** — either extend `structurizeHouse`'s level stack, or a small `mall`-specific
   2-level composer mirroring subway-building.js (lift faces by storey height, punch the void).

Recommendation: **land Phase 1 first** (validates the concourse, the `mall` program, and the
render wiring), then Phase 2 — it's mostly composition of existing parts.

## The `mall` program (principle layer)

New roles: `concourse`, `tenant`, `anchor`, `foodCourt`, `restroom`, (`atriumVoid`). New entries in
`DEFAULT_ROLE_BY_GLYPH` are not needed — the mall generator stamps `role` explicitly. Add a
`PROGRAMS.mall` table in [floorplan-principles.js](./floorplan-principles.js):

- **storefront-on-concourse** (invariant, `flow`) — every `tenant`/`anchor`/`foodCourt`/`restroom`
  connects (door) to a `concourse` space. A shop that only opens to another shop is a defect.
- **restroom-off-concourse** (invariant, `flow`) — restroom reachable from the concourse *without
  entering a tenant* (`reachableAvoiding(model,'concourse','restroom','tenant')` — the helper
  already exists).
- **anchors-at-termini** (preferential, `flow`) — anchor cells sit at the y-extremes (draws the
  footfall down the full spine). Geometry check on the footprint.
- **concourse-continuity** (invariant, `code`) — the concourse is one connected circulation
  component (reuse the reachability component logic).
- **vertical-reachability** (invariant, `code`, Phase 2) — each upper concourse is reachable from
  the ground concourse via an escalator/stair. **This forces the deferred cross-storey reachability
  item** (stairs/escalators spliced into the walkable graph) — good synergy; the mall is the
  feature that earns it.

Universal bed still applies unchanged (reachability, proportion, flow, feng shui) — a mall's
"don't spear the entrance straight through" and "keep the centre/atrium open" are literally the
existing `axial-through-shot` and `occluded-center` feng-shui detectors, which is a happy fit.

## Tests (mirror the restaurant program proof)

- A sound mall scores well; **a tenant with no storefront onto the concourse** trips
  `storefront-on-concourse`; **a restroom reachable only through a shop** trips
  `restroom-off-concourse`.
- Phase 2: a level-2 concourse with no escalator/stair trips `vertical-reachability`.
- Snapshot the face count / a render to eyeball the concourse.

## Open questions

- Concourse shape: straight spine first; L / T / cruciform concourses are a later generalisation
  (multiple spines = multiple `concourse` cells, continuity rule already handles the join).
- Tenant subdivision: fixed `bayDepth` tiling first; variable storefront widths later.
- Do anchors get their own interiors, or stay as massing with a storefront? (Massing first.)

## Build order

1. [x] **`buildMallPlan` / `buildMall`** + `structurizeFloorplan` wiring → element-model sanity (Phase 1.1). [floorplan-mall.js](./floorplan-mall.js): gapless concourse + 2 anchors + tenant bays + restroom/food-court, storefront + entry doors, basic walled render.
5. [x] **`PROGRAMS.mall` + tests** (Phase 1.5, done early — it's the headless-verifiable core). Rules: storefront-on-concourse, restroom-off-concourse, anchors-at-termini, concourse-continuity. Proven: sound mall `ok=true` (0.92); restroom-only-via-a-shop trips both storefront + restroom rules (`ok=false`, 0.52). 1274 polygonizer/sketch tests green.
   - Known noise (documented, not a defect): anchors trip the residential `L` aspect cap (they're legitimately wide) — the commercial-proportion-rule gap we already flagged. Fix = per-program proportion, later.
6. [x] **Phase 2 — cross-storey LOGIC (no styling)**: `buildMallLevels(input)` stacks a ground + upper floor (upper has no street entry — reached only by escalator), shaped as `{ levels, transports }`. `buildElementModel` now splices **vertical transport** into the walkable graph ([floorplan-bim.js](./floorplan-bim.js): `house.transports` → cross-storey `connects` + a `verticals[]` entity). `evaluateBuilding` accepts a multi-level structure. New mall rule **vertical-reachability** (every upper space reachable from the ground concourse) + **concourse-continuity** made per-storey so a 2-level mall isn't falsely flagged. Proven: sound 2-level mall `ok=true`; pull the escalator → all 15 upper spaces stranded, one clean `vertical-reachability` invariant. 1277 tests green.
   - Remaining for Phase 2 = **GEOMETRY only** (styling): atrium void (`slabWithHole`), escalator faces (`buildEscalator`), upper-ring balustrade. The walkable-graph logic is done.
   - **Realism pass (done):** escalators repositioned to LAND on the solid north ring (top deck flush with the upper floor at the void's far edge, facing a storefront — not ending in the void), the balustrade leaves an OPENING at the landing, and a two-cab **glass elevator bank** (`buildGlassElevator`) rises the full atrium height on the south ring (shafts punched through the upper slab). Cabs park at opposite levels.
   - **Escalator kernel (shared, done):** the flat-cleat steps in the shared `buildEscalator` primitive (subway-building.js — used by BOTH the subway and the mall) were upgraded to a real **sawtooth** (tread + riser + nosing lead edge) so steps read from any angle, plus a `balustrade: 'solid' | 'glass'` option (subway keeps solid, mall passes glass). The mall's temporary `buildMallEscalator` fork was removed — one primitive now serves both. Verified in [escalator-kernel.spike.gen.test.js](../escalator-kernel.spike.gen.test.js) (both modes) and the subway kernel test still passes.
2. [x] **Glass-forward styling** (Phase 1.2) — [floorplan-mall.js](./floorplan-mall.js) `dressMallFaces`: storefronts are mostly GLASS (floor-to-transom display walls + slim mullions + coloured sign bulkhead — the display IS the advertisement), a glass SKYLIGHT roof + frame ribs over the concourse, stone pilasters framing each bay. Storefront openings widened to ~0.82× the frontage so the shop reads as glazed, not a doorway. `renderMallToThreeWorld` added; spike renders to the integration folder (`mall-aerial` / `mall-concourse` / `mall-wide`). 21 logic tests still green.
3. [x] **Store layouts + fixtures** (Phase 1.3) — each tenant carries a `storeType` (apparel / electronics / cafe / bookstore / homewares / food / department) that drives both its sign colour and an interior fit-out (`fitOutUnit`): apparel racks, electronics podium grids, café table-and-chair sets, bookstore/homewares gondola rows, food-court seating, department-store rows. A `unitFrame` maps (depth-from-front, lateral) so every fit-out orients toward the concourse. Planters down the spine break the sightline. Visible THROUGH the storefront glass once the glass got a real low-alpha rgba fill (the water pass reads alpha from `rgba()`, not hex — a hex rendered fully opaque). Storefront frame rebuilt as real 3D members (kick/head/jambs/mullions) so there are no coplanar z-fighting lines.
4. [ ] `kind:'mall'` render wiring (`renderMallToHtml` / scene-html + world-scene + `WORLD_RENDER_KINDS`) + mint grading (Phase 1.4). `renderMallToThreeWorld` exists; still needs the CSS-3D path + kind registration so it flows through `mintSketch`.
7. [x] **Phase 2 GEOMETRY — the visible second floor** (`buildMallTwoLevel` / `renderMallTwoLevelToThreeWorld`): ground floor (its ceiling = the upper slab), an upper floor whose concourse is an **atrium void** (a hole punched in its slab via `slabHoles`), an **escalator pair** (`buildEscalator` from subway-building) bridging the void, a **glass balustrade** ringing the upper edge, a **glass skylight** at the very top so daylight pours down the atrium, and a second level of glazed shops with their own fit-outs. `dressMallFaces` made per-floor configurable (skylight/planters); upper dressing built 0-based then `liftFaces(+H)`. Rendered to the integration folder (`mall-2level-atrium`, `mall-2level-upper`). Pairs with the already-verified `buildMallLevels` walkable-graph logic. 21 logic tests green.
