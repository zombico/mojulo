# fractal-town — a residential sibling to fractal-city

## Goal

A second city-scale view that reuses the entire fractal-city engine (surface-area budget grid,
radial quadrant subdivision, roads, trees, vehicles, parks, townhouses) but reads as a low-rise
RESIDENTIAL town instead of a downtown: detached houses with **pitched roofs** (the `roof.js`
unlock), row townhouses, a few small walk-up apartment buildings, a civic anchor (school or park),
fences, lawns, driveways, calmer traffic with **no trucks**. Same "just as much expressiveness"
as the city, different rules.

The bet (validated by mapping the city): fractal-city is already ~90% of fractal-town. The grid +
claim "surface-area budget", `subdivide`, `roadRibbons`/`groundStreet`, `cityTree`/`cityShrub`,
`parkBench`/playground doodads, the civic builders (school/park/town-square), and the townhouse
rows are all reusable as-is. The genuinely NEW work is: roofed low-rise building dispatch, a fence
primitive, a civic anchor, a vehicle filter, and a re-weighted budget profile.

## Architecture: `profile: 'town' | 'city'` on one engine + a thin sibling module

Decision (operator): do NOT hard-fork (2000 lines drift) and do NOT pre-extract a substrate
(refactor risk to live city). Instead **parameterize the existing engine with a `profile`** and
ship a thin `fractal-town.js` that calls it with town defaults. Max reuse, ~zero duplication, a
contained set of `if (profile === 'town')` branches in the city generator. If town proves out, the
natural follow-up is to extract `city-substrate.js` and split the two — but not now.

`profile` defaults to `'city'`; `profile: 'city'` must be byte-identical to today (same RNG stream
→ every existing seed reproduces, same guarantee `baseScale` keeps). All town behavior sits behind
the flag.

### What the `town` profile changes (all in `fractal-city.js` unless noted)

1. **Height cap + shape whitelist** — `placeBuilding` (line ~1058). Town disallows the tall/urban
   shapes (`cylinder`, `setback`, `complex`, and the `condo` slab-tower). Height tiers collapse to
   residential: small `[1, 1.6]`, medium `[1.6, 2.6]`, large `[2.6, 3.6]` (≈ 1–3 storeys at the
   one-unit-≈-one-storey city scale). New shapes: `house` (small/medium detached, roofed) and
   `low-apartment` (large, 3–4 storey walk-up, roofed or flat-deck). Tag the box with a `roof`
   spec (a `roof.js` STYLE name or form, e.g. `{ form: 'gable' }`) instead of leaving it flat.

2. **Roofed building dispatch** — `scene-css3d.js` `assembleBoxCityScene` box loop (line ~1913).
   Add a branch: a box carrying `b.roof` draws its walls via `cityBox` (low residential facade —
   fewer floors, no curtainwall) and then calls `buildRoof({ x,y,w,d, z: b.z1 }, roofSpec)` from
   `roof.js`, pushing the returned `faces` and registering `textureKeys` into `sceneTextures` (the
   same path ribbons use for `asphalt`). Pitch/eave land in absolute world units, so they scale
   with `baseScale` for free. This is the single biggest visual differentiator and the reason the
   roof spike mattered.

3. **Civic anchor instead of tower/freeway** — the city's mandala is anchored by `towerAnchor` /
   `freewayAnchor`. Town's anchor is civic: reserve a **school** or **park** footprint at the root
   (reuse the existing `buildSchool` / city-park civic builders), stamp `CLAIM.PLAZA`, and let the
   cross-streets flank it via the existing `shiftLineOut` avoidance. Optional small church /
   community hall as a sub-anchor (religious-place machinery already exists, gated by `locale`).
   Town defaults: `anchorTowers:false`, `elevatedFreeways:false`.

4. **Vehicle filter — no trucks** — `vehicles-css3d.js`. `sampleVehicleType` (line ~79) gains an
   optional `exclude`/`classes` filter; the town pass passes `exclude: ['truck']` so the weighted
   pool is sedans/suv/taxi (+ the occasional bus on a through-street). Lower overall vehicle
   density (calm residential), bias toward PARKED (driveway/lot context) over moving.

5. **Re-weighted budget (the leafy town look)** — town defaults: lower `density`, shallower
   `depth` (bigger blocks → more breathing room), more green. `fillBlock` (line ~1141) gets a town
   branch that prefers detached houses set back behind front lawns + driveways, with row
   townhouses on some block faces and a low-apartment on a corner lot occasionally — rather than
   the city's road-clear-tower / four-small-buildings rolls. More `cityTree`/`cityShrub` scatter
   per block; leftover pockets bias to lawn/pocket-park rather than paved gore.

6. **Fences + lawns + driveways (NEW primitives)** — no fence primitive exists today. Add a small
   `fenceRun(boxes, x0, y0, x1, y1, rng, { style })` to `fractal-city.js` (picket / low-wall /
   hedge — hedge can reuse the `cityShrub`/plant path) emitting a thin line of low boxes along a
   lot edge. A **lawn** is just a `ground` tile (`kind: 'front-lawn'`, green `fill`) in front of a
   set-back house; a **driveway** is a small asphalt `ground` strip from the street to the house —
   both are existing `grounds` payload shapes, no renderer change. The town block-fill places
   these around each house footprint.

7. **Narrower residential roads** — town uses smaller `groundStreet` widths (no major 2-lane
   arterials, no elevated freeway). Mostly a constant/profile tweak at the `pushStreet` call site.

## Wiring a new `fractal-town` kind (checklist, from the city's own wiring)

Town is a SEPARATE sketch kind (so it gets its own MCP tool, gallery card, motion, world walk),
even though it shares the engine. Touch points, in order:

- **`control/lib/graph/fractal-town.js`** (NEW, thin): `planFractalTown`,
  `assembleFractalTownScene`, `renderFractalTownToHtml` — each delegating to the city engine with
  `profile: 'town'` + the town element/anchor/density defaults. Export a `TOWN_ELEMENT_DEFAULTS`.
- **`control/lib/mcp/tools/scene-town.js`** (NEW) or extend `scene-city.js`: `mintFractalTown`,
  `createFractalTownHandler`, register `create_fractal_town`. Input schema mirrors
  `create_fractal_city` minus tower/freeway anchor, plus an `anchor: 'school' | 'park'` and a
  `roofs` style hint. Manifest discriminator `kind: 'fractal-town'`.
- **`control/lib/mcp/server.js`**: import + call the town tool registration (~line 258 / 452).
- **`control/lib/graph/sketch-manifest.js`**: add `'fractal-town'` to `WORLD_RENDER_KINDS`
  (~line 802) so it renders via three.js / gets a world card.
- **`control/lib/graph/scene-html.js`**: add a `kind === 'fractal-town'` →
  `renderFractalTownToHtml` branch (after the fractal-city branch, ~line 62).
- **`control/lib/graph/worlds/world-kinds.js`**: add a `'fractal-town'` registry row
  (descriptor with `resolve` → `assembleFractalTownScene` and `walk: true` — `WALK_KINDS` is
  derived from the flags) so it supports first-person walk like the city.
- **Routes auto-enable**: `/api/sketches/<ref>/{scene,world,png}` need no change — they dispatch
  through `scene-html.js` / `world-scene.js`.
- **Optional**: `modeler-lingo.js` routes ("suburb", "residential", "neighborhood" →
  `create_fractal_town`), `context.js` tool description.

## Files

- `control/lib/graph/fractal-city.js` — add `profile` param threaded through `planFractalCity` →
  `recurse` → `fillBlock` → `placeBuilding`; town branches for height/shape, civic anchor, block
  composition, fences/lawns/driveways, road widths, vehicle exclude. Add `fenceRun` helper.
- `control/lib/graph/scene-css3d.js` — roofed-building branch in the `assembleBoxCityScene` box
  loop (call `buildRoof`, register roof textures); a `front-lawn` / `driveway` ground tint mapping.
- `control/lib/graph/roof.js` — reuse as-is (already exports `buildRoof` + STYLES).
- `control/lib/graph/vehicles-css3d.js` — `sampleVehicleType` gains a class-exclude filter.
- `control/lib/graph/fractal-town.js` — NEW thin sibling.
- `control/lib/mcp/tools/scene-town.js` — NEW MCP tool (or extend scene-city.js).
- registries: `sketch-manifest.js`, `scene-html.js`, `world-scene.js`, `server.js`.
- tests: `fractal-town.test.js`, `fractal-town.spike.gen.test.js`,
  `fractal-town-world.spike.gen.test.js` (mirror the city's spikes; emit to
  `lite-template/integration/<date>/spike-output/fractal-town/`).

## Build order (so each step is visible before the next)

1. **Engine `profile` plumbing + roofed dispatch** — add `profile` to `placeBuilding` (height cap,
   `house`/`low-apartment` shapes, `roof` tag) and the `scene-css3d` roof branch. Spike: a single
   town block of roofed houses, eyeballed via the same PNG bake used for the roof spike.
2. **Civic anchor + re-weighted block fill + fences/lawns/driveways** — town `fillBlock`, civic
   root anchor, fence/lawn/driveway placement. Spike: a full town region.
3. **Vehicle filter + road widths** — no-trucks, calmer density, narrower streets.
4. **Sibling module + MCP tool + kind wiring** — `fractal-town.js`, `scene-town.js`, registries.
5. **Tests + world spike** — determinism, element toggles, `profile:'city'` byte-identical guard.

## Verify

- `profile: 'city'` (no town flags) produces byte-identical `stats` to a current `planFractalCity`
  of the same seed — the city-unchanged guarantee.
- Mint a `fractal-town` at a fixed seed; eyeball `/scene` (CSS-3D) and `/world` (three.js, textured
  roofs): low-rise roofed houses, row townhouses, a school or park anchor, fences/lawns, trees,
  cars but **no trucks**. Compare to a `fractal-city` of the same region/seed to confirm the town
  reads as a distinct, leafier, lower silhouette with the same compositional richness.
- Spike PNGs land in `lite-template/integration/<date>/spike-output/fractal-town/` (CSS-3D +
  World), same bake path as `roof.spike.gen.test.js`.

## Open questions / deferred

- **House orientation** — roofs and front doors/lawns should face the nearest street. The city
  already knows block-face orientation (stoops face inward/outward for townhouses); reuse that to
  orient `house` footprints + their `buildRoof` ridge axis and driveway side.
- **Roof style by locale/climate** — `roof.js` STYLES (bungalow/mission/farmhouse/…) could be
  weighted by the scene `locale`/`climate` the way trees and religious places already are. v1: a
  small per-region weight table; or just seed-random for the first spike.
- **Mixed town↔city edge** — out of scope for v1, but the shared engine makes a future "town
  fades into city" gradient (profile as a per-region field rather than a global) plausible.
