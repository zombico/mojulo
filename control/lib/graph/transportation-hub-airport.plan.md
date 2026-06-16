# Airport scene-builder: generative manji concourses + a primary shape

Goal: make the **airport** mode of [transportation-hub.js](./transportation-hub.js) read like a real
airport instead of a snowflake. Keep full seed-determinism; widen the *shape grammar*.
Train-station and bus-terminal modes are out of scope.

## Why today's airport reads as too-regular

`planAirport` ([transportation-hub.js:275](./transportation-hub.js)) has two glyphs:

- **radial** (`glyphRadial`, ~L319): central N-fold polygon headhouse, then N concourses at
  perfectly even angles `(i+0.5)/N·2π`, **every arm identical** (length `8.5`, same depth, same
  fork). Output is a mandala, not an apron.
- **linear** (`glyphLinear`, ~L341): a spine with exactly 5 evenly-spaced fingers, mirrored on
  both sides.
- branching (`concourse`, ~L361) is a **symmetric Y-fork**: split into two children at `±0.46 rad`,
  length `×0.6`. A dendrite/plant topology, not a pier.

Three root issues: (1) perfect rotational/mirror symmetry; (2) the Y-fork is the wrong topology —
real concourses are **piers that hook at right angles** to grow gate frontage; (3) no **primary
shape** — every arm is a peer, so nothing dominates.

The repo already names this shape: [manji.js](./polygonizer/manji.js) `cardinalManji` is crossed
bars whose arm-tips carry perpendicular **tails (hooks)** — a 卍. That is exactly how bays pack an
apron: a corridor runs, then hooks 90° (consistent chirality = pinwheel) so gates line the new
frontage.

## Decisions (locked with operator)

- **Inline hook grammar** — rewrite `concourse()` to emit perpendicular hooks itself; do NOT couple
  into the polygonizer manji-program tree. Borrow the *concept* (chirality + perpendicular tails),
  not the dependency.
- **Strong primary + asymmetric** — one clearly dominant terminal/spine; secondary arms vary in
  length & count; break the perfect symmetry.
- This plan first; implement after review.

## Design

### 1. Manji branching replaces the symmetric Y-fork

Rewrite `concourse(ctx, A, angle, length, depth, vertical, opts)`. At each branch point, instead of
the symmetric `±branchAngle` fork, pick from a small set of **manji moves**, biased by a per-run
`chirality ∈ {+1,-1}` (pinwheel sense, chosen from `rng`):

- **hook** — one perpendicular child at `angle + chirality·90°` (the dominant move; makes the 卍 arm).
- **cross / T** — perpendicular children on *both* sides (`±90°`), occasionally — a hammerhead pier.
- **continue + side-fingers** — corridor runs straight on, with short gate stubs hung perpendicular
  along its length (a classic pier).
- **terminate** — no child (so not every arm branches to the same depth).

Selection is `rng`-driven and weighted; `depth` still bounds recursion and child length still decays
(`×~0.55–0.65`, jittered). Each child keeps lining its sides with gates via `placeGates` (unchanged
contract). Net effect: arms pinwheel and hook like real concourses, and depth still grows the
network (keeps the existing `depth` test passing).

### 2. A primary shape

Before laying secondary arms, choose a **primary** per seed and build it visibly larger:

- `primary: 'spine'` — one long dominant concourse (wider `corW`, taller `deckZ1`, more gates),
  with secondary manji arms hanging off it at varied offsets/lengths.
- `primary: 'core'` — a large central headhouse (the radial glyph's polygon, but oversized) with a
  few long primary arms and several short secondaries.
- `primary: 'hammerhead'` — a primary pier ending in a wide perpendicular cross-bar (a single big
  manji), satellites around it.

Default: pick from seed. `glyph` stays as a coarse selector (radial→core-ish, linear→spine-ish) for
back-compat, but the primary system is what creates the dominance.

### 3. Asymmetry knobs

Introduce an `asymmetry ∈ [0,1]` knob (default ~0.6 per the "strong" decision) that scales:

- per-arm **length jitter** (`length · (1 ± asymmetry·k)`),
- per-arm **branch probability** (some arms terminate early),
- **dropped arms** in the radial core (skip an arm when `rng < asymmetry·k`),
- **angle perturbation** off the perfect `(i+0.5)/N` spokes,
- unequal **arm scale** (one or two arms longer = de-facto primary reinforcement).

Plus a `chirality` knob (`+1`/`-1`/seed) for the pinwheel sense.

### 4. Recipe / manifest surface

Extend the manifest in [scene-transport-hub.js](./../mcp/tools/scene-transport-hub.js) (`mintTransportationHub`)
and the airport branch with the new optional fields, all seed-defaulted so existing recipes are
unchanged:

```
primary?:   'spine' | 'core' | 'hammerhead'   // airport only; default seeded
asymmetry?: 0..1                               // airport only; default ~0.6
chirality?: 1 | -1                             // airport only; default seeded
```

Keep `seed`, `density`, `depth`, `glyph` exactly as-is.

## Files to touch

- [transportation-hub.js](./transportation-hub.js) — rewrite `concourse`; add `primary`/`asymmetry`/
  `chirality` plumbing through `planAirport` → `glyphRadial`/`glyphLinear`; add a primary-shape
  pre-pass. `placeGates`, `jetBridgeFaces`, runway/tower/flood kit unchanged.
- [scene-transport-hub.js](./../mcp/tools/scene-transport-hub.js) — accept + persist the new manifest fields.
- [transportation-hub.spike.gen.test.js](./transportation-hub.spike.gen.test.js) — keep existing
  asserts green (determinism, arms≥4, planes≤budget, depth grows gates); add asserts that
  asymmetry/primary actually vary geometry (e.g. two arms differ in length; a primary corridor is
  wider/longer than secondaries; same seed still identical).

## Invariants to preserve

- **Seed-determinism**: same recipe → identical `stats`/`boxes`/`faces` (all new randomness flows
  through the existing `mulberry32(seed)` RNG; no `Math.random`).
- **Space budget**: `planes ≤ budget` (`placeGates` OBB-overlap + budget logic untouched).
- **No geometry stored**: tool persists only the recipe manifest; geometry regenerates on render.
- Back-compat: a recipe without the new knobs renders a sane (now-asymmetric) airport.

## Validation

- `cd control && npx vitest run lib/graph/transportation-hub.spike.gen.test.js`
- Eyeball the spike HTML in `lite-template/integration/0614/spike-output/transportation-hub/`
  (`airport-radial.html`, `airport-linear.html`, `airport-night.html`) — confirm pinwheel hooks,
  one dominant structure, and visible seed-to-seed variation. Use `/view-svg` equivalent / open in
  browser.

## Follow-up (done) — generative liveries + roof color

- **Generative aircraft liveries.** A livery SCHEME is a small palette (skin / belly /
  cheat / tail / wing / fin); `buildAircraftLivery(scheme)` paints the fuselage + wing +
  stab + fin cards from it so each plane stays coherent. 8 schemes (classic, teal,
  crimson, forest, ember, royal, sky, sand) in
  [vehicle-fuselage-net.js](./polygonizer/vehicle-fuselage-net.js); `pickAircraftLiveryScheme(rng)`
  selects one. Threaded as an optional `livery` through
  [vehicles-css3d.js](./vehicles-css3d.js) → [vehicles-swept.js](./vehicles-swept.js) →
  `buildFuselageNetSceneShapes({ scheme })`. `placeGates` picks a scheme per plane via
  `ctx.rng`, so liveries vary generatively yet deterministically. No `livery` → original
  hand-authored cards (default path untouched).
- **Roof color.** `AIRPORT_ROOF` `#b0683f` (copper-orange, read as residential) →
  `#b7bcc2` light brushed-aluminium standing-seam grey — a modern terminal roof, still
  off the bluish glazing and the apron. Recolors terminal/corridor roofs + the dome.

## Follow-up (done) — aircraft classes + sizes

- **Four fuselage nets** in [vehicle-fuselage-net.js](./polygonizer/vehicle-fuselage-net.js):
  `jet` (narrowbody liner, existing), `widebody` (jumbo — long fat body, broad wing,
  tall fin, 26 windows), `regional` (compact hopper, 12 windows), `bizjet` (slim,
  pointed nose, **T-tail** via a negative stab `drop`, 7 portholes). Window count is now
  a `buildAircraftLivery(scheme, { windows, winH })` param read from each net, so the
  livery reads the class. World lengths (`planeScale` 1.8): widebody **5.67** / liner
  **3.78** / regional **2.65** / bizjet **1.83**; tail heights 1.93 / 1.35 / 1.05 / 1.10
  against the 2.5-tall corridor wall — jets now read NEXT TO the multi-storey concourses
  instead of toy-like (the first pass at 1.15 felt small).
- **Size-aware placement.** `aircraftFootprint(type, scale)` (→ `fuselageFootprint`)
  gives each class its world length/wingspan/radius. `placeGates` samples a class per
  occupied gate from a weighted `AIRPORT_FLEET` (liner 5 / regional 3 / jumbo 2 /
  bizjet 2) and sizes that gate's push-out, OBB footprint, stand pad and jet-bridge to
  the actual plane. Gate STEP is sized to the dominant narrowbody (not the longest
  class) so corridors stay densely gated; a sampled jumbo that won't fit its slot is
  rejected by the OBB test, so widebodies settle into the roomier stands. `stats.mix`
  tallies the placed classes.
- Uses the linter-added `size` field on the vehicle registry (baked onto `scale` in
  `vehicleFaces`), so aircraft sizing composes with the same mechanism trams use.

## Open questions / nice-to-haves (not in first pass)

- Satellite (detached island) concourses connected only by an implied tunnel.
- Curved/angled runways instead of the two fixed parallels.
- Reusing the actual `manji.js` evaluator if the inline grammar proves to want its slot math.
