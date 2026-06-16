# transportation-hub — a CSS-3D scene primitive

A new illustration scene primitive, sibling to `fractal-city`. Same rails: a tiny
recipe is stored (`manifest.kind === 'transportation-hub'`), the full scene is
regenerated **deterministically** on render at `/api/sketches/<ref>/scene` as a
dependency-free CSS `preserve-3d` HTML page. Thousands of faces from ~6 numbers.

## The "specific concern" that makes it NOT a city

A city fractally subdivides into a **uniform quadrant grid of building blocks**.
A transportation hub has a different organizing logic:

> **anchor terminal (head-house / concourse) + fractal _fingers_ (piers /
> platforms / bays) + modal apron fields + transit ribbons (runways / rails /
> busways) + modal vehicles.**

The fractal recursion is **linear repetition along a spine**, not quadrants: the
terminal sprouts concourse fingers, and each finger fractally fills with its
mode's repeated unit (a gate module / a platform+track pair / a sawtooth bus bay).
That linear filler is the analog of fractal-city's `fillBlock` building rule.

## Decisions (locked with operator)

- **One mode per hub** via `mode: 'airport' | 'train-station' | 'bus-terminal'`.
  No multi-modal interchange in v1 (left as a future composer that places several
  single-mode hubs + connecting concourse ribbons).
- **Aircraft reuse the existing generator.** `vehicle-fuselage-net.js` already
  ships a `jet` (narrowbody) model with `buildFuselageNetSceneShapes` returning
  depth-sorted 3D shapes — the curved-fuselage sibling of the swept car builder.
  We adapt it to CSS-3D faces (identity projector, local→world transform) exactly
  like `vehicles-swept.js` does for cars, and register an `airliner` vehicle with
  `contexts:['airfield']` — fulfilling the existing TODO comment in
  `vehicles-css3d.js`.

## Substrate already anticipated this

- `GROUND_TINT` in `scene-css3d.js` already defines `transportApron`,
  `railPlatform`, `dock` (unused today).
- The vehicle registry comment names a future `contexts:['airfield']` type.

## Files

1. `control/lib/graph/transportation-hub.js` — generator (`planTransportationHub`)
   + `renderTransportationHubToHtml`. Emits world `{boxes, grounds, ribbons,
   faces, sources}` → `renderBoxCityToHtml` (same emitter as the city).
2. `control/lib/graph/vehicles-swept.js` — add `fuselageFaces()` (aircraft → CSS-3D
   faces) + a `heading` (arbitrary-angle) option on `sweptFaces` (angled sawtooth
   buses, angled taxiing planes).
3. `control/lib/graph/vehicles-css3d.js` — register `airliner` (family `plane`,
   `contexts:['airfield']`); route `family === 'plane'` to `fuselageFaces`; thread
   `heading` / `camHint`.
4. `control/lib/mcp/tools/scene-transport-hub.js` — `create_transportation_hub`
   MCP tool (stores the recipe, validates by expanding once).
5. Wiring: `route.js` dispatch, `sketch-manifest.js` ILLUSTRATION_KINDS,
   `server.js` registration.
6. `control/lib/graph/transportation-hub.spike.gen.test.js` — stat asserts + spike
   HTML to `lite-template/integration/0614/spike-output/transportation-hub/`.

## Layout per mode (camera at +y looking −y: near = high y, far = low y)

Shared: apron base ground; terminal anchor along the **near** edge; fingers/yards
receding toward **far**; transit ribbons at the far edge; flood-mast lamp heads
re-read as night light sources (like fractal-city's `lampSources`).

- **airport glyph maps** — the apron topology is chosen by a `glyph` recipe param (or
  by seed): **`radial`** (the mandala below) or **`linear`** (a long central concourse
  SPINE with many PERPENDICULAR finger bays branching off both sides — a pier terminal).
  Both share the corridor / space-budget / jet-bridge machinery; only the terminal
  shape + how concourses are spawned differ. New glyphs slot in as another builder.

- **structural variation** — **radar domes** (`radomeFaces`: faceted geodesic
  hemispheres with alternating panel shades) on terminal roofs + beside the tower +
  a standalone `radarStationFaces` (mast + radome) on the field; and **glazing
  variety** — `airportCurtain` now draws clear **vertical mullion lines delineating the
  glass** (count from face width) and has a `vertical` fin-dominant variant, mixed per
  building (clerestory + some fingers use it) so structures read differently.

- **airport** (mandala-glyph redesign, v2) — the `radial` glyph: a regular-polygon **central terminal**
  (N = 4/5/6-fold, the glyph) with a clerestory drum, built as raw curtainwall faces.
  Concourse **boarding corridors radiate from each polygon edge with N-fold symmetry**
  and **fractally Y-branch** toward the apron (`depth` knob). Aircraft come from a
  finite **space budget**: gates are spaced to the jet's wingspan and a global plane
  allowance is spent gate-by-gate (nearest the terminal first) — empty gates keep a
  jet-bridge stub, so the hub fills realistically. Slender control tower with its own
  vertical-mullion glass shaft + flared dark cab. Two parallel runways + a taxiway at
  the far edge; corner flood masts. Stats expose `arms / corridors / gates / planes /
  budget`.

  **Airport facades are NOT city buildings.** Terminal, concourses and tower use
  dedicated raw-face curtainwall language (`airportCurtain` — horizontal ribbon
  glazing + solid spandrel base; `towerGlass` — vertical mullions), never the city's
  residential/office/hotel facade programs.

  **Terminal roof:** glazed walls (the clear-windows-with-breaks pattern) + a flat
  perimeter roof RING (`annulusRoofFaces`, warm copper `AIRPORT_ROOF`, off the bluish
  glass) carrying the rooftop kit (`roofKit`: HVAC/condenser/vents/skylight + an apex
  antenna), a glazed clerestory drum, and a **sine-curved vaulted dome ceiling**
  (`sineDomeFaces` — polygon rings rising on a quarter-sine to the apex).

  **Jet bridges** are dark-grey **telescoping tubes** (`jetBridgeFaces` →
  concentric square segments stepping down in cross-section, the "extendo-spring"
  read), NOT glazed building corridors. Each runs straight out from the concourse
  (perpendicular to it) and stops just shy of the fuselage skin (no overlap).

  **Plane parking:** jets park **broadside** — fuselage parallel to the concourse, so
  each is PERPENDICULAR to its radial bridge — lined up nose-to-tail along the finger
  on both sides. Each plane reserves a footprint **OBB** (fuselage length × wingspan +
  clearance); a gate is filled only if that footprint is clear of every other plane
  (separating-axis test) AND the space budget remains, and a painted **stand pad** is
  drawn on the apron under it (its own surface area). Plane scale 1.26 (~20% larger).

  **Aircraft scaling fix:** the fuselage net authors appendage spans/drops in the
  model's NATURAL proportions (a span-4.6 wing on a length-6 body) and does NOT scale
  them with the body — so `fuselageFaces` must build at natural scale and uniform-scale
  the whole shell afterwards (like `sweptFaces`). Building pre-scaled ballooned the
  wings ~3× and sank them underground (read as "wings switched").
- **train-station** — head-house anchor; parallel raised platforms (`railPlatform`)
  running −y with rail ribbons + ballast between; platform canopies on posts; a flat
  train-shed roof on a column grid; box-composite multi-car trains on some tracks;
  a footbridge ribbon crossing the platforms.
- **bus-terminal** — concourse anchor; **sawtooth** angled bay canopies along the
  front; a `city-bus` parked at each bay at the sawtooth heading; apron + drive
  lanes (ribbons); rows of parked buses; flood masts.

## Recipe (stored manifest)

```
{ kind:'transportation-hub', mode, seed, depth, density,
  region?, viewBox?, time?:'day'|'night', title? }
```

`time` selects the day sun vs night flood-source bake (mirrors fractal-city).
