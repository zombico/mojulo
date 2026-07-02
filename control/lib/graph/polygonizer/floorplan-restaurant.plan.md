# floorplan-restaurant — a standalone ground-level café / restaurant

Status: IMPLEMENTED — `floorplan-restaurant.js` + `.test.js` (4 tests) +
`.spike.gen.test.js`. Minted out of the building's café floor as its OWN concern.

## Premise

The building floor (`floorplan-building.js`) is a stackable tower plate whose core is
an ELEVATOR bank. A café/restaurant is a different thing: ONE ground storey whose
"core" is BACK-OF-HOUSE — a walled kitchen + restrooms across the back, a dining room
in front. So it is a standalone sibling, not a building floor: no elevator core, no
stacking, no roof (open-top cutaway), ground level only.

It REUSES, rather than rebuilds:
- the STRUCTURE concern — `structurizeFloorplan` gives the envelope, slab, the
  dining/kitchen/restroom partitions, the cased service pass + doors, storefront
  windows, and the floor finish (`auto`: dining boards, wet rooms tiled);
- the workbench ITEMS — `floorplan-building-assets.js` (bistro table, café chair, bar
  stool, bar die, back bar), baked via `assetFaces`;
- the surface-area BUDGET + door-clearance "mandala" — `allocateAreas` over the dining
  room, with a clear entry throat and clear approaches to the kitchen/restroom doors.

## Layout (the cells)

Three rects tile the footprint:

```
            ┌───────────────┬────────┐
   back     │   KITCHEN  K  │ REST  W │   ← back-of-house strip (kitchenDepth)
            │  cook line +  │ sink +  │
            │  hood + prep  │ divider │
            ├──────┬────────┴─────────┤   ← dining|BOH wall: cased pass + restroom door
            │ BAR  │                  │
   front    │      │   DINING  L      │   ← dining room (front)
            │  host│  tables (varied) │
            └──────┴───[ entry ]──────┘   ← street entry (centred) + storefront windows
```

- **dining** (`L`) front, full width — the budgeted room (bar / host counter / seating).
- **kitchen** (`K`) back, most of the width — reserved BOH; reached by a CASED pass.
- **restroom** (`W`) back corner — its own door off the dining room.

`kitchenDepth` and `restroomWidth` are configurable; a deeper kitchen costs the dining
room its area (tested).

## Fit-out

- **Dining** — `furnishDining`, in three layers:
  - the **bar** (back bar + die + stools) in the LEFT back segment (clear of the kitchen
    pass) + a service counter by the entry;
  - **fixed wall seating** — a `buildBanquette` along each side wall (under the storefront
    windows), with a row of tables (banquette on the wall side, a chair on the room side);
  - **free-standing tables of VARYING size** — `TABLE_KINDS` mixes 2-tops (chairs ±y) and
    4-tops (chairs on all four sides; the chair item now orients '+x'/'-x' too), tiled into
    the centre field with aisles.
  Every piece is kept off the entry throat, the pass/restroom approaches, and the bar zone;
  the seating area budget caps the free-standing count.
- **Kitchen** — `furnishKitchen`: a cook line + vent hood on the back wall, reach-in
  fridges on the partition wall, a prep/sink line on the exterior wall (split around the
  service exit), a central ISLAND with an overhead pot rack, and a pass shelf split around
  the cased opening. A SECONDARY EXIT (staff/delivery door) is cut into the kitchen's
  exterior wall — a second exterior door beside the front entry. Massing boxes for now;
  workbench KITCHEN items (range, prep table, reach-in, hood) are the next one-by-one batch.
- **Washroom** — `furnishWashroom`: a vanity with inset basins along the back wall + a
  run of toilet STALLS (workbench `buildToilet` + partitions) down the side wall, the
  door approach kept clear.

## Atmosphere layer (ceiling + lighting + soft furnishings)

Opt-in (`o.ceiling` / `o.curtains` / `o.wallArt`, all on by default), built with the same
workbench assembler so the room reads as a furnished, lit interior:

- **Ceiling** — `structurizeFloorplan({ ceilings:true })` adds a `shell:ceiling` plane.
  The World auto-fades it for an above camera (the aerial cutaway still sees in) but shows
  it in walk — and it is what lets us hang lighting. The enabler for lighting concepts.
- **Lighting** — `buildPendantLight` (cord + shade + warm bulb) hung from the ceiling in a
  loose grid over the dining floor. (Baked light pools / sconces are the next lighting pass.)
- **Ceiling style** — `ceilingTreatment` over the dining room, tagged `shell:ceiling` (inward
  normal) so it FADES for the aerial but reads in walk / interior views:
  - `'woodSlat'` — parallel boards whose tone is derived from the floor boards (`scaleHex`),
  - `'industrial'` — exposed joists + girders + an HVAC trunk duct over a concrete plane.
  `ceilingStyle:'auto'` (default) HARMONIZES with the walls/floor: brick/loft → industrial;
  wood/wainscot → wood slat. Explicit `'woodSlat'|'industrial'|'plain'` wins. So the material
  choice flows through wall → floor → ceiling as one coordinated palette.
- **Curtains** — `buildCurtain` is the **svgile-row** garment move applied to a WALL: the
  cutter/drape system (figure-garments.js) tailors cloth onto a body ROW BY ROW; a flat wall
  is the degenerate figure, so each row is a straight span along the wall tangent, offset off
  the wall plane by a fold field that GATHERS at the heading and RELAXES toward the hem, and
  the rows are lofted into continuous folded cloth (per-quad normals catch light on each fold
  crest — not flat slabs). Hung + a rod on the room side of each DINING window, read straight
  from the wall graph's openings (`sill > 0` on exterior runs), filtered to the dining
  perimeter so the kitchen/back windows stay bare. Curtains default to **open / tied back**
  (`curtainMode:'open'`; `'closed'` covers them, `'mixed'` alternates) — the tieback is the
  same row-loft re-tailored into an hourglass (full heading → pinched tie → flared hem) so
  the centre opens onto the glass, with a sash band cinching each panel.
- **Wall art** — `buildWallArt` framed pieces hung high on the back wall above the bar,
  clear of the back-of-house doorways.

## Wall styling (facade + interior, brick spans both)

- `facade` — exterior skin: `'siding' | 'brick' | 'tofu'` (drives `facadeStyle` +
  `facadeDecor`). Default `'brick'`.
- `interiorWall` — interior finish: `'paint' | 'wainscot' | 'wallpaper' | 'brick'` (drives
  `wallDecor` + a new `interiorWallStyle` override on `interiorWallDecor`). Default `'wainscot'`.
- `material: 'brick'` — shorthand that sets BOTH faces to brick (exposed brick inside, brick
  facade out). The interior brick is a coarser running-bond unit than the facade so the
  inside faces don't explode in count. All resolvable via `input` so a render can pick them
  per-call. The same options + `material:'brick'` shorthand are wired into `stackBuilding`
  (the tower floors).

## API

- `buildRestaurant({ width?, height?, inset?, groundZ?, seed?, kitchenDepth?, restroomWidth? }, opts)`
  → `{ faces, footprint, rooms:{dining,kitchen,restroom}, program, baseZ, height }`.
- `assembleRestaurantWorldScene` / `renderRestaurantToThreeWorld` / `renderRestaurantToHtml`
  — the World + CSS-3D emit seams (mirror the building module). Walkable cutaway.

## Generatable kind (wired in)

`restaurant` is now a formal sibling of the `floorplan` (house) world kind — a generatable
floor plan. The recipe manifest `{ kind:'restaurant', seed, width, height, kitchenDepth?,
restroomWidth?, material?, facade?, interiorWall?, ceilingStyle?, curtainMode? }` is stored
by `create_sketch` and regenerated deterministically on every render. Registration points
(mirror the `floorplan` kind):

- `world-scene.js` — import `assembleRestaurantWorldScene`; `'restaurant'` in `WALK_KINDS`;
  a `kind === 'restaurant'` dispatch case (→ the three.js `/world`).
- `scene-html.js` — import `renderRestaurantToHtml`; a `kind === 'restaurant'` case (→ CSS-3D `/scene`).
- `sketch-manifest.js` — `'restaurant'` in `WORLD_RENDER_KINDS` (so `classifyBucket` → `world`).

The `/api/sketches/[ref]/world` + `/scene` routes dispatch automatically; covered by
`restaurant-world-scene.test.js`.

## Next

- Workbench kitchen items (replace the kitchen massing boxes one by one).
- Wire the building (`stackBuilding`) in as a `building` kind the same way.
- Possible consolidation: lift `furnishDining` + `TABLE_KINDS` into a shared dining
  helper used by both this module and the building café floor.
