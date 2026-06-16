# Airport ground-support equipment (GSE)

Add ground-support vehicles to `airport`-mode transportation hubs so parked aircraft
read as *serviced* — boarding stairs, belt loader, catering truck, ops wagon nuzzled
up to each gate.

## How airport scenes are built (orientation)

- Recipe-only sketch (`kind: 'transportation-hub'`); geometry regenerated on render.
  Tool: [scene-transport-hub.js](mcp/tools/scene-transport-hub.js) → planner
  [transportation-hub.js](transportation-hub.js).
- `planAirport()` grows manji-arm concourses, then `placeGates()`
  ([transportation-hub.js:446](transportation-hub.js#L446)) spends an aircraft budget
  gate-by-gate. For each occupied gate it knows the plane's pose:
  - `C` = stand center, `u` = unit axis along the fuselage (parallel to concourse),
    `nOut` = unit normal pointing to the concourse/jet-bridge side,
  - `ac.fuselen`, `ac.wingspan`, `ac.fuseR` (world footprint), `ac.scale` (= `planeScale` 1.8).
  The jet bridge reaches from the concourse along `+nOut`. The **apron side is `-nOut`** —
  that's where GSE belongs (so it never fights the bridge).
- Vehicles are first-class: registry in [vehicles-css3d.js](vehicles-css3d.js)
  (`net`/`family`/`class`/`size`/`weight`/`contexts`), built to CSS3D faces by
  [vehicles-swept.js](vehicles-swept.js) from declarative **nets** in
  [polygonizer/vehicle-swept-net.js](polygonizer/vehicle-swept-net.js).
  - A net is data: `CAR_NETS` (wid/zBot/zTop profiles) and `SMOOTH_BOX_NETS`
    (geo + profile/wid taper). Each references three **cards** (body/front/rear) authored
    in the `parts[]` grammar (band/rect/repeat/circle/poly), plus `axles` and
    `accessories` (currently **axis-aligned `kind:'box'` only** —
    [vehicle-swept-net.js:714](polygonizer/vehicle-swept-net.js#L714)).
  - `GLOBAL_K = 0.35` keeps real relative sizes. Rendering GSE at the same `scale` as the
    plane (1.8) preserves the honest size gap (a 7 m truck beside a 40 m jet).

## The split: two tiers

| Vehicle | Net family | New primitive? |
|---|---|---|
| Ops/utility **station wagon** | `CAR_NETS` (sedan/SUV roofline) | no — pure data |
| **Catering truck** (high box body) | `SMOOTH_BOX_NETS` (like box/delivery truck) | no — pure data |
| **Belt loader** (diagonal conveyor) | box chassis + sloped deck | **yes — angled ramp accessory** |
| **Boarding stairs / "ladder"** (diagonal stair) | box/cart chassis + stepped ramp | **yes — angled ramp accessory** |

The defining feature of the belt loader and boarding stairs is a *tilted* element. The
accessory grammar only does axis-aligned boxes, so those two need a small new primitive.

**Status:** Phase 1 ✅ and Phase 2 ✅ implemented. `station-wagon`, `catering-truck`,
`belt-loader`, `boarding-stairs` nets + the `ramp` accessory primitive are in; the airport
planner places 1–3 GSE units per occupied stand (stairs/belt nose into the fuselage,
catering/wagon park broadside). Live sample: `/sketches/sk_avadi9rltr`.

**Scale gotcha (fixed):** aircraft fuselage nets live in a COMPRESSED unit space (~6 net
units ≈ 38 m jet, so planes read beside multi-storey terminals), but GSE nets are authored
in METRES. Rendering GSE at the plane's own render scale (1.8) made them ~6× too big — a
catering truck came out longer than an airliner. Fix: a `GSE_SCALE = 0.32` constant in
[transportation-hub.js](transportation-hub.js) brings metre nets into aircraft space
(catering ≈ 0.19× airliner length, matching reality). Apron stand-offs were retuned to
the smaller footprints. **Any future scene that places a metre-net vehicle next to an
aircraft must apply this conversion, not the aircraft's render scale.**

## Phase 1 — data vehicles + gate-relative placement (this pass)

1. **`station-wagon` CAR_NET** in `vehicle-swept-net.js`: sedan width, SUV-style high/flat
   roofline dropping to a liftgate at the tail. New `WAGON_BODY` (extended greenhouse) +
   `WAGON_REAR` (liftgate); reuse `SEDAN_FRONT`. Register card ids in `CAR_CARDS`.
2. **`catering-truck` SMOOTH_BOX_NET**: tall box body on a cab chassis (≈ `box-truck` geo,
   taller `halfH`), with a `kind:'box'` accessory for the raised rear service cab.
   New `CATERING_BODY/FRONT/REAR` cards (white body, roll-up rear, lift platform seam);
   register in `SMOOTH_BOX_CARDS`.
3. **Registry entries** in `vehicles-css3d.js`: both with `contexts: ['airfield']` so the
   city sampler never picks them; `class` car/truck, `size` 1.0, modest `weight`.
4. **Placement** in `placeGates()`: after a plane is placed and budget spent, drop 1 GSE
   unit on the apron side, tucked beside the fuselage **inside the reserved wingspan OBB**
   (so it introduces no new collision):
   - center `G = C - nOut*(ac.fuseR + gseHalf) + u*(±along)`, heading facing the fuselage
     (perpendicular to `u`), `scale = ac.scale`.
   - Alternate type by gate index; gate it behind a probability so not every stand is busy.
   - Reuse `vehicleFaces({ type, cx, cy, heading, scale, camHint: APRON_CAM })`.
5. Verify by minting an airport hub via `create_transportation_hub` and viewing the scene.

## Phase 3 — apron placement reanalysis ✅ (gate fit + budget + ant scatter)

A top-down diagnostic (plot placed plane OBBs vs concourse walls) exposed the real issues:
plane↔plane was already clean (SAT/OBB), but **planes sat on top of crossing concourses**
(no plane-vs-building test) and the **budget often went unspent** (a sampled jumbo that
didn't fit just skipped its gate). Live sample of the fix: `/sketches/sk_3ba6h18n9p`.

Restructured `planAirport` placement in [transportation-hub.js](transportation-hub.js):
- **Separate enumeration from filling.** `collectGates` walks the manji tree and records
  gate SLOTS + every concourse as a WALL OBB (`wallObb`); the hub is a wall too. Filling
  runs only after the whole terminal exists, so a plane is tested against *every* concourse.
- **`planeFits`** = clear of every wall + every placed plane (SAT) + inside the apron edge.
  Eliminates plane-on-building superposition and planes hanging off the apron.
- **`fillGates` two passes** so budget is met without wrecking the fleet mix: pass 1 places
  the weighted sampled class with NO downgrade (widebodies/narrowbodies land in roomy bays);
  pass 2 spends leftover budget on empty bays with the largest class that fits. A single
  greedy-downgrade pass collapsed ~everything to bizjets (measured 1% widebody / 42% bizjet);
  two-pass restores ~4/25/34/37 vs the ~17/42/25/17 weight target.
- **Verified over 240 runs** (80 seeds × 3 densities): **0 superposition, ≤1 budget-unmet.**
- **Trucks as ants.** Only the small door-service vehicle (boarding stairs) still docks a
  plane (in `emitPlane`). The larger trucks (catering / belt loader / ops wagon) are staged
  across CLEAR apron by `scatterApronAnts` — rejected if they hit a concourse, plane, hub,
  the runway/taxiway band, or a sibling ant. This is the "ant" scatter the user asked for.
- `out.debug = { region, hub, placed, walls }` exposes the footprints for the top-down
  introspection harness (no extra per-render collection — all functional state).

## Phase 8 — solid aircraft + narrower triangle wings ✅

Live sample: `/sketches/sk_tzx7z72dms`.
- **"Not fully fleshed out" = single-camera cull.** The fuselage tessellation back-face culled
  against one camera, so each plane was a half-shell facing `camHint` — hollow from other orbit
  angles. Added `cull` to `buildFuselageNetSceneShapes`; `fuselageFaces` now passes `cull:false`
  (whole shell, `doubleSided`, shaded by the outward normal), like the swept cars already do.
- **Narrower wings.** Wing `span` cut ~25% across the fleet (e.g. narrowbody 4.6→3.4) so full
  span ≈ 1.1× fuselage length (was ~1.5×), matching real airliner proportions. Tighter footprints
  also pack slightly better.
- **Rounded-triangle wings + tail, more forward area.** Wings and stabilizers taper like a
  swept triangle but to a SMALL blunt tip chord (`tip` is a short edge, not a needle, not the old
  flat tip) — reads as a rounded tip at scene scale. Wing AREA bumped ~25% by pushing each root's
  LEADING edge forward (lower `root[0]`), not by widening the span. (A true geometric curve at the
  tip would need polygon support in `appendageQuads`; the blunt chord is the cheap stand-in.)

## Phase 7 — flat tails + taxiing planes ✅

Live sample: `/sketches/sk_s4piwqs3i2`.
- **Flat empennage.** The bizjet net ([vehicle-fuselage-net.js](polygonizer/vehicle-fuselage-net.js))
  used `drop: -1.15` to fake a T-tail — but the builder tilts the stabilizer diagonally, so it
  read as "pointed up." Set to `drop: 0.05` (flat low-mounted stab, like the other jets). All four
  types now read flat. Vertical fins still point up (correct).
- **Taxiing planes.** `addTaxiingPlanes` drops 1–3 aircraft ON the taxiway (nose along the lane,
  no jet bridge), counted separately (`stats.taxiing`) from the gate budget. Jumbos stay gated
  (wing sweep too wide for the lane). Makes the field read active, not a static gate line.
- **Jumbo:** the `widebody` net IS the 747/777-class jumbo (length 9 vs narrowbody 6). It lacks the
  iconic 747 upper-deck HUMP (fuselage is a clean body of revolution) — an optional follow-up.

## Phase 6 — set the terminal back from the runway (resize the map) ✅

First attempt fought capacity with a budget/clip hack (kept a plane-free buffer by clipping
spokes + lowering budget) — it gave the gap but cratered the plane count (9→6.4) and skewed
the fleet to bizjets (the squeezed terminal had only tight bays). Wrong lever. Live sample of
the clean fix: `/sketches/sk_2sp4edw0gx`.

The right fix is to size the MAP to the terminal, not shrink the terminal to the map:
- **Deeper region** ([transportation-hub.js](transportation-hub.js)): `DEFAULT_REGION.d` 34 → 46.
  Vertical zones: runways+taxiway `0–10`, clear apron gap `10–14` (`apronFloor`), terminal `14–46`.
- **Hubs derived from `apronFloor`**: radial hub at `apronFloor + 13`, linear spine at `+11`, so a
  full-length spoke/finger lands exactly at the gap — no clipping of normal arms (only the rare
  long primary-down spoke still clips, which is correct).
- **Budget restored** to `round(4 + density·6)` and **fewer/wider linear fingers** (4–6 → 3–4) so
  bigger jets fit between them.
- **Cameras retuned** for the taller scene (apron/aerial `lookAt` and positions lifted ~+8).
- Result over 240 runs: **0 superposition, 0 planes on the runway, avg 8.9 planes, budget-unmet
  18/240, mix ~2/21/39/38** (back to the pre-gap baseline) — the gap with none of the regressions.

## Phase 5 — dedicated airport road types + planes off the runway ✅

Live sample: `/sketches/sk_n9gkzf24c5`.
- **Dedicated `airportStrip(a, b, { type })` in [roads.js](roads.js)** — a standalone airfield
  primitive, NOT a branch of the urban `roadRibbons` (that `surface` branch was reverted).
  `type: 'tarmac'` = dark apron asphalt + a continuous yellow taxiway centerline;
  `type: 'runway'` = asphalt + long sparse centerline stripes + aiming-point bars. The airport
  taxiway and both runways now use it; `runwayMarkings` (ad-hoc grounds) was removed.
- **Planes never rest on the runway/taxiway.** The active movement area along the far edge is
  pushed into `ctx.walls` as one no-go band, so `planeFits` rejects any parked aircraft that
  dips into it. Verified over 240 runs: **0 planes touching the band, 0 superposition.** The
  band removing low slots costs a little capacity — budget now unmet on 11/240 runs (gaps of
  1–3 at max density), the correct trade: under-fill rather than park a jet on a runway.

## Phase 4 — tarmac road surface (kill the "urban street" read) ✅

The taxiway reused the urban road primitive and the runway used short frequent centerline
dashes + a dense 6-bar "piano-key" threshold — which scans from above as lane lines + a
zebra crosswalk. Live sample: `/sketches/sk_lwi86z56b8`.
- **Road metadata.** `roadRibbons`/`groundStreet` in [roads.js](roads.js) gained a
  `surface: 'urban' | 'tarmac'` option. `tarmac` = dark apron asphalt + a single CONTINUOUS
  yellow centerline, no lane/edge/bike/crosswalk vocabulary. The airport taxiway now passes
  `surface: 'tarmac'`. (Urban callers — city, bus terminal, streetcar — are untouched.)
- **Runway markings** (`runwayMarkings` in transportation-hub.js): long sparse centerline
  STRIPES + a pair of bold aiming-point bars near each end, replacing the dense piano-key
  threshold. Reads as aviation tarmac, not a crosswalk.

## Phase 2 — angled-ramp accessory + the diagonal GSE (follow-up)

1. Extend accessory grammar in `buildSweptSceneShapes`
   ([vehicle-swept-net.js:714](polygonizer/vehicle-swept-net.js#L714)) with `kind:'ramp'`:
   a sloped wedge from `(uSpan[1], zBase)` low to `(uSpan[0], zBase+rise)` high, emitting
   the wedge's faces (vexar-lit, culled) — optional tread sub-bands for a stair read.
2. **`belt-loader`**: low box chassis + a long `ramp` conveyor deck angled up to a parked
   plane's cargo hold height.
3. **`boarding-stairs`** ("ladder"): small chassis + a stepped `ramp` rising to door height.
4. Placement: belt loader at the rear cargo hold, stairs at the forward door (offsets along
   `u` from `C`), both on `-nOut`.

## Invariants to respect

- Recipe stays tiny; all GSE geometry regenerates deterministically from the seeded rng.
- Same seed → same hub (sample GSE from `ctx.rng`, never `Math.random`).
- GSE only in `airfield`; keep them out of city/street sampling via `contexts`.
- No new collision risk: phase-1 placement stays inside each plane's reserved OBB.
