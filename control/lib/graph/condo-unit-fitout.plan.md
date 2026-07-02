# condo-unit-fitout — fractally populate the condo shells with varied apartments

Status: BUILT (first pass). Module `condo-unit-fitout.js`; consumed by `condo-entrance.js`
`unitFaces` (called once per unit shell it lines the hallways with). Turns the empty
glass-front bachelor shells into furnished, per-unit-varied apartments.

## The ask

"A means to fractally populate the condo units with variety." The units were unfinished
concrete shells (a slab + walls + a corner washroom + a storefront). This fills them with
an apartment fit-out that (a) is DETERMINISTIC (a unit is a pure function of its world
position + the scene seed — the concourse is stable, screenshots reproduce), (b) VARIES
unit-to-unit (neighbours differ), and (c) is FRACTAL (the interior is recursively
subdivided into program zones, mirroring the city's `splitRect` BSP).

Chosen direction: **all residential** (studio / one-bed / loft variants), per the operator.
Not mixed-use — every unit is an apartment.

## Model

```
furnishUnit({ axis, alongCenter, a0, a1, cInner, cOuter, wcSide, wcFront, baseZ, height, seed }, opts)
  → { faces, archetype }
```

1. **Position seed.** `posSeed(alongCenter, cInner, seed)` hashes the unit's world anchor
   (+ scene seed) → a stable 32-bit seed → `mulberry32`. Every draw below reads this one rng.
2. **Archetype.** `drawArchetype(rng)` picks `studio` (bedsit + kitchen), `one-bed`
   (living + bedroom + kitchen), or `loft` (living + work + sleep), weighted. Sets the zone
   program + a floor-finish tint.
3. **Fractal subdivision.** `fractalLeaves(interior, n, rng)` recursively bisects the long
   side of the interior rect (seeded split ratio ∈ [0.34, 0.66]) until there are `n` leaves
   (n = the archetype's zone count). Same idiom as `fractal-city.js` `splitRect`.
4. **Zone→leaf match.** Leaves sorted by area desc; zones sorted by `ZONE_PREF` (living/bedsit
   want the most floor, kitchen the least); zipped. So the biggest room becomes the living
   space, the smallest a galley — but WHICH rectangle that is varies with the seed.
5. **Furnish.** Each zone's furnisher backs its anchor against the deep wall and faces the
   hall glass, composing the feet-based asset builders: `buildBed` (new), `buildLobbySofa`,
   `buildFeatureTable` (coffee/side table), `buildBarCounter` + `buildBarStool` (galley),
   `buildOfficeDesk`/`buildOfficeChair` (loft work), `buildHousePlant`, `buildWallArt`, plus a
   thin `rugFaces` slab (a seeded rug colour per zone) to ground each area.
6. **Washroom dodge.** The corner WC `unitFaces` already carves is passed as a reserved box;
   `subtractBox` clips each leaf to its larger free remainder so no furniture lands in the WC.
7. **One-bed privacy.** The `bedroom` zone in a one-bed draws a full-height `partitionWall`
   on its hall-facing edge with a centred door gap (the only zone that gets a real wall; the
   rest are open-plan).

### The (al, depth) → world frame

All fit-out geometry is authored in UNIT-LOCAL coordinates — `al` runs ALONG the hall,
`depth` runs from the storefront glass (0) into the unit toward the back wall (D). `makeFrame`
is the ONLY place the world axis (`x`|`y`) and the inward direction (`dir = sign(cOuter −
cInner)`) are resolved: it exposes `toWorld(al, depth)` and the world facing strings
(`faceHall`/`faceBack`/`backSign`). So one fit-out body works for every hall orientation; the
axis bookkeeping never leaks into the furnishers (the same trap `movement-flow.js` avoids).

## Acceptance

- `condo-unit-fitout.test.js` (5): well-formed shaded faces + a valid archetype; deterministic
  (same position+seed ⇒ byte-identical); fractal variety (≥2 archetypes across a run, ≥15/19
  neighbours differ); scene seed re-rolls the concourse; a too-small unit returns `[]` (no throw).
- Render spike `condo-units-plan` (top-down, tight on the west hall) shows the varied plans;
  `condo-units` (raised 3/4 bird's-eye over the open tops) shows beds/counters/washrooms in 3D.
  The storefront glass is opaque (single vertex-coloured world mesh — no per-face alpha), so
  the fit-out reads from ABOVE, not through the glass.

## Floor-2 apartments (`furnishApartment`)

A second, non-fractal fit-out for the 2nd-storey plan (condo-entrance.js `buildingFloorTwo`): a
proper **1BR / 2BR** flat laid off a corridor rather than a glass-front shell. Given a world rect
+ `axis` + `entryCoord` (corridor side) + `windowCoord` (exterior facade) + `bedrooms`, it builds
demising + partition walls and furnishes: an enclosed **bath** (toilet + vanity) and a **galley
kitchen** against the entry wall, **living + N bedrooms** facing the window. It REUSES the same
room furnishers (`furnishLiving`/`furnishBedroom`/`furnishKitchen`) via a `makeFrame(axis,
entryCoord, windowCoord)` — the (al, depth) frame is the shared abstraction between the two
fit-outs. Deterministic (position+bedroom seed). Empty (no throw) for a rect too small to lay out.

## Deferrals / open

- Furniture is placed at zone centroids/edges with heuristics, not a movement-flow command-
  position solve. Could route anchors through `movement-flow.commandCell` for door-aware facing.
- No per-face transparency in the world renderer, so units don't read through the storefront at
  eye level; the concourse walk still sees opaque glass. A translucent-glass channel in
  `face-mesh.js`/`scene-three.js` would unlock the eye-level read (separate, cross-cutting change).
- Bathrooms are a single WC (from `unitFaces`); no basin/shower inside the enclosure yet.
- Archetypes are three; a mixed-use set (café / boutique / office shells) is the other branch
  the operator declined — the `ARCHETYPES` table + `FURNISH` registry are structured to accept it.
