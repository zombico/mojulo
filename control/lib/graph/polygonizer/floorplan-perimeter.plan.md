# floorplan-perimeter — the lot the house sits on

Status: IMPLEMENTED (spike). `floorplan-perimeter.js` + `floorplan-perimeter.test.js`
(14 tests) + `floorplan-perimeter.spike.gen.test.js` (site-plan SVGs + exterior HTML,
visually reviewed). Wired into `structurizeFloorplan` + `structurizeHouse` as the
opt-in `perimeter` option (exterior view only); lot-aware exterior cameras.
Remaining: front/back yard zoning + the deferrals below; MCP exposure rides the
shared `create_house` tool (floorplan-structure.plan.md).

### Variations (landed)

- **Garage** (`garage:true`) — `buildGarage` swaps the open carport for an enclosed
  bay: solid walls + gable roof + a roll-up door panel on the street-facing side.
- **Lot styles** (`lotStyle:'suburban'|'compact'|'skinny'`) — `LOT_STYLES` presets +
  `resolvePerimeterOpts` (DEFAULTS < preset < explicit). `compact` is the same side
  layout on a tighter parcel (less yard); `skinny` feeds the split-mirror units.
- **Split-mirror duplex** (`structurizeSplitMirror` in floorplan-structure.js) — the
  modern "split a wide lot at xa|xb, build two LONG MIRROR houses" pattern. One
  skinny-deep plan is generated, placed on parcel A, then REFLECTED about the split
  line for parcel B (re-structurized fresh, so each is lit by the real sun, not a
  mirrored one). `buildSplitMirrorPerimeter` gives the pair one shared lot with
  front-loaded garages on the OUTER sides, driveway aprons to the street, inner
  front paths, a perimeter fence (front gaps at the aprons/paths) and a party-line
  fence dividing the rear yards. Renders via `renderSplitMirrorToHtml` /
  `renderSplitSitePlanSvg`.
  - **Storeys** via `input.storeys` (default 1). Each unit's floor plate stacks N high
    (the skinny-townhouse repeat): every level is ceilinged + windowed, the roof caps
    only the top (intermediate levels pass `_envelope:false`). No interior stair is drawn
    — invisible in this exterior lot view. (A standalone multi-storey house with real
    stairs already comes from `structurizeHouse({ levels, stairs }, { perimeter })`.)
  - **Styled** via `opts.facadeStyle`: `'siding'` (default → gable roofs, gabled
    garages, clapboard) or `'tofu'` (modern block → `tofu-deck` FLAT occupiable
    roofs, 12.5 ft storeys, flat-capped garages, clean stucco facade). `buildGarage`
    gained a `roof:'flat'|'gable'` option for this. NOTE: style choices read from the
    raw `opts` (the merged defaults carry `roof:false`/`facadeDecor:false`, and
    `false ?? x` keeps the false). 3D stills baked to PNG via `renderSceneToPng`
    (headless Chromium) for review — see spike-output `split-mirror-tofu.png`.

The fifth floorplan layer, OUTSIDE the envelope: property line, yards, fence,
driveway, carport, shed, front path, back patio. Lot-scale siblings of
`exteriorAdjacents` (porch/deck/balcony), which already hangs built structures off
the house's doors — perimeter hangs them off the house's *footprint* and the
*street*.

Sits beside:
  - structure  (the house mass)            — floorplan-structure.plan.md
  - program    (open-space room layout)    — floorplan-program.plan.md
  - livability (room relationships)         — floorplan-livability.plan.md
  - facade     (exterior wall style)        — floorplan-facade.plan.md
  - **perimeter (the lot)** ← this plan

## Interior + exterior together (it's a house, not a town)

The LOT is a ground-level concern, INDEPENDENT of the roof — so it renders in ANY
view, not just exterior. `structurizeFloorplan` / `structurizeHouse` build the
perimeter whenever `o.perimeter` is set, regardless of `view`. That lets a CUTAWAY,
FURNISHED house (open roof → you see the fractal room program + furniture inside)
sit on the same landscaped lot as the exterior massing. A town/city view only ever
shows exterior shells; a house shows both.

- `view:'exterior'` — roofed solid massing on the lot (the town-style read).
- `view:'cutaway'` — open-top FURNISHED interior on the lot (the house read).

`structurizeSplitMirror(input, { view, furnish, ... })` honours this: cutaway
furnishes by default and drops the roof; both views render the shared split lot +
landscaping. See `split-mirror-tofu-cutaway.{png,html,world.html}`.

Opt-in: `perimeter:true` (or an options object). Off by default, like `roof`.

## Frame

Inherited from structure: **1 world unit = 1 foot, z up, z=0 = grade.** The house
footprint is `{x0,x1,y0,y1}` (envelope bbox). The exterior camera already looks
from `-y` (`floorplanExteriorCameras` sits at `fp.y0 - 1.15·d`), so **the street is
the `-y` side** — the front. Deterministic orientation, no seed needed:

```
            +y  (back yard, deepest)
   shed ◳            patio
        ┌───────────────┐
 side   │     HOUSE      │  side   driveway →  carport (│+x side)
 yard   └───────────────┘  yard
            front yard
   ─────────── street ───────────   -y
                path ↑ (to entry)
```

## The lot

`computeLot(footprint, o)` → `{ x0,x1,y0,y1, street:'-y' }`, from setbacks (feet):

- `frontSetback` 24 — house front (`fp.y0`) to street (`lot.y0`)
- `backYard`     40 — `fp.y1` to `lot.y1` (the deep rear yard)
- `sideYard`     14 — each side (`fp.x0/x1` to `lot.x0/x1`)

The lot rect drives (1) the ground plane extent and (2) the exterior camera
framing (so the whole parcel is in shot, not just the house).

## Features (each a small face-emitter, all on grade)

All built from the structure module's existing `boxFaces` / `slabFaces` vocabulary
— no new geometry engine. Each is an independent opt-out under `perimeter`.

1. **Ground / yards** — one lot-sized grass quad (replaces `groundPlaneFaces`).
   Optional front/back tint split is a later refinement; spike ships one tint.
2. **Property-line fence** — `fenceRun(p0,p1,height)` = a thin rail box + posts
   every `fencePost` ft. Side + back lines at `fenceHeight` (4 ft). Front line
   lower (3 ft) with GAPS for the driveway and the front path (a real yard reads
   open at the street, fenced at the sides/rear).
3. **Driveway** — a paved slab from the street (`lot.y0`) up the `+x` side to the
   carport, `driveWidth` (10 ft) wide, tucked between the house's `+x` wall and the
   side fence.
4. **Carport** — 4 corner posts + a flat roof slab over the driveway head, beside
   the house front; open on all sides (one-car, ~11×19 ft, 9 ft clear).
5. **Front path** — a narrow slab from the street to the house front, centred on
   the footprint (entry-door coupling is a later refinement).
6. **Back patio** — a paved slab off the rear wall, centred, ~14×10 ft.
7. **Shed** — a small gabled box in a back corner (`-x,+y`), ~8×10 ft, 7 ft walls,
   low gable roof. Built from boxFaces walls + two slanted roof quads.

## API (new module `floorplan-perimeter.js`)

```
buildPerimeter(footprint, baseZ, opts) → { faces, lot, textureKeys }
computeLot(footprint, opts)            → { x0,x1,y0,y1, street }
fenceRun / buildDriveway / buildCarport / buildShed / buildPath / buildPatio
renderSitePlanSvg(struct, opts)        → top-down lot-scale review SVG
```

`buildPerimeter` composes the features (each toggleable), returns the lot for
camera framing and any roof/shed `textureKeys`.

## Wiring (this slice)

- `structurizeFloorplan` (single-floor, `_envelope !== false`, `exterior`): when
  `o.perimeter`, call `buildPerimeter`, push its faces, and let it OWN the ground
  (skip `groundPlaneFaces`). Return `lot` on the structure.
- `structurizeHouse` (multi-level): same — `buildPerimeter` instead of
  `groundPlaneFaces` in the exterior branch; attach `lot`.
- Cameras: `assembleFloorplanScene` / `assembleFloorWorldScene` / `houseCameras`
  frame `s.lot ?? s.footprint` in exterior view.

## Tests

- `floorplan-perimeter.test.js` (node-test-style, geometry only, no DOM/three):
  - lot encloses the footprint with the right setbacks; street on `-y`.
  - fence runs cover side+back, leave a front gap; post count scales with length.
  - driveway connects street→carport and sits on the `+x` side, clear of the house.
  - carport has 4 posts + a roof above clear height; shed sits inside the lot.
  - every emitted face's corners lie within the lot bounds (nothing escapes).
- `floorplan-perimeter.spike.gen.test.js`: writes a site-plan SVG + an exterior
  scene for visual review under `lite-template/integration/0626/spike-output/`.

### Landscaping (landed)

Opt-in via `perimeter: { landscape, interlock }` (single house) or
`structurizeSplitMirror(..., { landscape, interlock })` (duplex).

- **Interlock** (`interlock:true`) — `interlockSurface` repaves the driveway / apron /
  path / patio as a RUNNING-BOND paver grid (grout base + half-offset paver top-quads,
  inset by the joint). GEOMETRY, not a texture, so it reads in the CSS-3D bake (the
  `brick` surface texture only shows in the WebGL World). Routed through a `paved()`
  dispatcher so every hardscape honours the flag.
- **Shrubbery** — `buildShrub` (a two-ring `foliageDome` mound) + `buildHedge` (clipped
  body + rounded crown). `plantRow` lines foundation shrubs along the front wall,
  skipping the path/drive/garage; entry shrubs flank the path.
- **Gardens** — `buildGardenBed`: soil + a curb border + a deterministic grid of mini
  shrubs and flower domes (seeded, no `Math.random`). Placed in a front-yard corner
  opposite the drive (single house); duplex units get foundation + entry shrubs.

### Navigable World

`renderSplitMirrorToThreeWorld(input, opts)` (+ `assembleSplitMirrorWorld`) emits the
pair as a three.js WORLD (the `/world` sibling of the CSS-3D `renderSplitMirrorToHtml`),
`inline:true` by default so the HTML is self-contained (base64 three.js, opens offline,
orbit the exterior massing). Emitted artifact:
`spike-output/floorplan-perimeter/split-mirror-tofu-2storey.world.html`.

### Roof catalog (reused from the town spike)

The houses pull the full `roof.js` `ROOF_STYLES` catalog (the same one fractal-city/
town uses) straight through `o.roof` → `envelopeRoof` → `buildRoof`: bungalow (hip),
mission (gable/clay), pavilion (pyramid), farmhouse (gambrel), manor (mansard),
colonial (saltbox), modern-shed, butterfly, tofu-deck (flat), tofu-stacked. Each
carries its own material texture (shingle/clay/slate) for the World path; CSS-3D reads
the flat palette tint.

- Standalone solo house: any style — pitched roofs suit the wider footprint
  (`house-roof-*.html`, baked gallery under `spike-output/.../roofs/`).
- Split-mirror duplex: passes `roof` through too, but the SKINNY footprint wants
  flat (`tofu-deck`) or mono-pitch (`modern-shed`) — a tall pitched roof over a 24×46
  plate reads as an oversized attic. Tofu defaults to `tofu-deck`; siding to `gable`.

## Deferrals

- Front/back yard tint zoning, planting, fence styles, garage-vs-carport, gate
  leaf, driveway apron flare, entry-door-aligned path — all later refinements.
- Seeded lot orientation (corner lot, street on a different side) — fixed `-y`
  front for the spike.
