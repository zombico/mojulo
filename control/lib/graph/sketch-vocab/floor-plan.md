---
{ "id": "floor-plan", "name": "floorPlan — fractal multi-room building from a seed", "summary": "generate a coherent furnished floor plan (rooms + aligned hallways + per-room furniture) from a seed, instead of placing each room by hand", "when": "generating a whole multi-room building, house, apartment, or office floor plan — furnished, as a top-down map or a 3D dollhouse — when you want a coherent layout from a seed + footprint rather than authoring every room and element yourself", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

`floorPlan` turns a **seed + footprint** into a coherent, furnished multi-room
building, so you declare intent and the substrate fills the detail. It is the
fractal layer above `box-net`: each generated room is furnished with boxNet
forms, and the building can render as a top-down map or a 3D dollhouse.

Three properties hold by construction:

- **fractal** — recursive binary space partition; every split inserts a hallway
  gap spanning the region, so corridors form a connected tree and **line up**.
- **inferrable** — the plan is a plain `{ rooms, halls, doors }` map; doors sit
  on corridor edges, so connectivity reads straight off the top-down plan.
- **nondeterministic but reproducible** — a seeded PRNG drives splits, archetype
  assignment, and furniture jitter. Same seed → same building; new seed → new
  building. You change the *seed*, not every element.

## Minting — the manifest fields

A floor plan is a WORLD kind minted through `create_sketch`. The kind rides INSIDE
`manifest` — the flat `{ kind, title, seed }` form is the recipe, not the call:

```
create_sketch({
  "title": "…",
  "manifest": {
    "kind": "floorplan", "title": "…", "seed": 7,
    "furnish": true,          // OPT-IN — default false ⇒ every room renders EMPTY
    "windows": true, "ceilings": false, "wallDecor": true, "entryDoor": true,
    "view": "cutaway",        // 'exterior' (default) | 'cutaway' (implies furnish) | 'interior'
    "storeys": 2              // OPT-IN — stack the plate N high (see Storeys); absent = one floor
  }
})
```

The reply is `{ ok, ref, url }`; the recipe is a STARTER — iterate it in place with
`update_sketch({ ref, patch })` or a full `manifest` replace, and re-mint only for a
side-by-side variant. Every JSON block below is a `manifest` for that call.

## Storeys — stacking the plate

Two ways to say "a two-storey house"; absent, the plan is the single floor it always was.

- `storeys: N` (alias `floors`) — the one-field shorthand. The plate stacks N high on one
  meru (ground, second, third, upper…), each level's rooms generated from `seed + index`,
  a stair between consecutive floors through the slabs; `exterior` roofs the top,
  `cutaway` leaves every storey open. Pass `stairs` to place the flights yourself
  (`stairs: false` for none). A non-integer or `0` refuses at mint.
- `levels: [{ role | index, seed?, rooms?, halls?, doors?, height? }, …]` — the authored
  stack, when floors differ: roles `basement` (-1) / `ground` (0) / `second` / `third` /
  `upper`, per-level plan or seed, per-level ceiling height. `stairs: true` runs one flight
  from the ground; `stairs: [{ from, to, switchback? }]` places each. `tier: 'cottage' |
  'house' | 'villa'` bounds the room program and supplies a default footprint;
  `terrace: true` cuts the deck door; `explode: <feet>` pulls a cutaway's levels apart so
  each reads (exterior is never exploded). `levels[]` wins over `storeys` when both are set.

Every furnishing knob defaults OFF: `furnish`, `windows`, `ceilings`, `wallDecor`,
`facadeDecor`, `entryDoor`, `porch` / `stoop`. Set `furnish: true` (or `view:
'cutaway'`, which implies it) to populate each room from its archetype. The one
exception is a furnished ONE-CELL plan (below), which defaults windows, an entry
door and a floor finish on — a single room has no house to place them for it. An explicit
`rooms: [{ x, y, w, h, glyph }]` plan replaces the seed; a room WITHOUT a `glyph`
defaults to `S` (storage — dresser / cabinet / rack), so name the glyph you mean
(`L` for the lounge). Walkable at `/api/sketches/<ref>/world`. Under the hood:

```
generatePlan(seed, { width?, height?, maxDepth? })
  → { seed, width, height, rooms:[{x,y,w,h,glyph}], halls:[{x,y,w,h}], doors:[{x,y,room,edge}] }
```

Archetype glyphs (each carries a furniture fill recipe):

| glyph | room    | fills with |
| ----- | ------- | ---------- |
| `E`   | entry   | bench, picture, sconce |
| `L`   | lounge  | sofa, armchair, coffee table, rug, bookshelf, window |
| `D`   | dining  | table + 4 chairs, sideboard, window |
| `K`   | kitchen | cabinet, sideboard, window |
| `B`   | bedroom | bed, nightstand, dresser, window, picture |
| `O`   | office  | standing-desk, computer-chair, rack-shelf, bookshelf |
| `S`   | storage | dresser, cabinet, rack-shelf |
| `H`   | hallway | corridor (connective) |

`fillRoom(room, seed)` expands a room's archetype into boxNet
`roomConcept.elements`, so any room renders through the normal box-net pipeline.

## Design — walkways and stairs, checked

A house with storeys is checked the way you would walk it, and `create_sketch` / `update_sketch` return what they
found as `design` (advisory: the house is minted either way). On each storey the free floor between the walls, the
stair's well and its flight is measured, and every door and both ends of each stair must connect through a passage at
least the tradition's width; a finding says how wide the narrowest point is, where, what it lies between, and which
doors lie beyond it. Doors are measured against a clear width, stairs against a width, riser and going.

- `design: { tradition?, passage?, door?, stair?: { width?, riser?, going? }, repair? }` — the rules, in feet. The
  tradition defaults from the framing, else `north-american` (passage 36 in, door 30 in, stair 36 in with 7¾ in
  risers and 10 in goings); `british` (900 mm, Part K-like), `japanese` (780 mm), `metric` (900 mm).
- `repair: true` builds the plan to keep the passage: the upstairs hall takes the stair's zone and a walkway past it,
  doors on the well's side step off its span, the ground floor keeps the passage round the flight, and where a U-return
  and its walkway would cost the upper floor a row of rooms the stair becomes a straight flight climbing toward the
  middle of the house. Without it the house is exactly as it was.

```json
{ "storeys": 2, "seed": 4, "design": { "repair": true } }
```

## Framing — the structure under the skin

`framing` (a stack: `storeys` or `levels`) builds what stands under the finished house, read from its own plan: the
wall runs, openings, storey heights, stair voids and roof style. Absent, the house is exactly what it was.

```json
{ "storeys": 2, "roof": "mission", "windows": true, "framing": { "system": "platform", "view": "cutaway" } }
```

- `system` — `platform` (default: 2×6 outer and 2×4 inner studs at 16 in, doubled top plates, kings, jacks and headers
  at each opening, joists and 4×8 subfloor, a stem wall and reinforced footing), `masonry` (outer walls of brick in
  English bond from the footing to the eaves, soldier courses over openings, timber floors and roof), `post-and-beam`
  (8×8 posts on a 16 ft grid, plates, tie beams and knee braces, cut mortise and tenon), `kigumi` (dodai, 4-sun hinoki
  posts at a ken and beside each opening, nuki through them at three heights, hozo, a wagoya roof), `steel` (HEA
  columns on base plates, IPE beams bolted to them, steel joists under a meshed slab, a steel roof), `concrete` (a
  reinforced frame of columns, beams and slabs, a timber roof on the ring beam).
- `view` — `framed` (default: the structure alone, where the walls, slabs and roof would be) or `cutaway` (the
  finished house past a section at `cut`, a fraction of the width, default 0.5; the frame whole).
- `species`, `finish`, `figure` (`flat` by default; `coarse` / `full` bake grain), `joints: false` (draw the timber
  and steel frames uncut, and skip the kernel).
- The roof frames as its family: gable, gambrel and saltbox as a gable; hip, pyramid and mansard as a hip (commons,
  hips and jacks); shed and butterfly as mono-pitches; flat forms as joists. No roof, and the top storey gets ceiling
  joists.
- `stage` — the house at a moment of its building: `frame` (default), `rough-in` (+ wiring, and what dries the frame
  in: sheathing, block infill, SIPs, komai lath), `insulated` (+ batts, arakabe clay), `lined` (+ gypsum or plaster,
  ceilings (hung under a steel floor in lay-in tiles, under concrete in plasterboard), shinkabe with fusuma and shoji, cover plates). `tradition` — `north-american` | `british` | `japanese` |
  `metric`, defaulting from the system (platform, post-and-beam, steel → north-american; masonry → british;
  kigumi → japanese; concrete → metric) — picks the assemblies and the wiring rules: NEC-like receptacle spacing and
  NM-B bored through studs; a British ring in 2.5 mm² chased in the brick; VVF dropped down the posts in moulding
  (never bored through a hashira); conduit in chases. Past `frame` the house carries `construction`: every member,
  sheet, box and cable run with a stable IFC GlobalId, class, catalog material and quantities, a cut list, the sheets
  to buy, the panel schedule, a takeoff and the checks (advisory).
- `detail` — `auto` (default: each frame and wall at the level the house's cameras earn), `full` (joints cut, every
  brick), `boxes` (members as plain boxes, walls as a bond texture), `sparse` (boxes less sub-pixel members, walls
  in their far colour). Identical members and bricks are drawn once and stamped (`instance: false` draws each), so
  a two-storey masonry house is about a thousand faces at `auto`, and still under 5k with every brick at `full`.

## Roofs — the covering, as tiles

`roof: { style, covering }` lays the roof as a roofer would: courses up from the eave at the gauge, each unit lapping
the one below, ridges and hips capped. `covering: true` lays the style's own material (shingle styles as asphalt
shingle, clay styles as barrel tile, `manor` as slate, the metal styles as standing seam), or name one:
`asphalt-shingle`, `cedar-shake`, `slate`, `plain-tile`, `pantile`, `barrel` (mission and Spanish, cover and pan),
`kawara` (with a noshi ridge), `standing-seam`; `{ type, material?, color?, detail? }` picks a `roofing:` material
from the catalog or a colour. Near the cameras every tile is drawn (stamped, each with its own tint), further off the
covering's map, far its colour (`detail` forces one). Absent, the roof is exactly what it was.

```json
{ "storeys": 2, "roof": { "style": "mission", "covering": "barrel" }, "view": "exterior" }
```

A framed house past `frame` wears its roof as built instead: decked in OSB (North American) or sugi boards
(Japanese), or felted and battened (British, metric), at rough-in; covered when `lined`.

## Drainage — gutters, downpipes, drains

`drainage: true | { tradition?, downpipe?, outlet?, below? }` hangs gutters on every eave that sheds water, falling
to outlets; downpipes swan-neck back to the wall, clear of the windows, down to an outlet at grade. Hip roofs drain
round the corners; a butterfly through a box gutter in its valley and scuppers in the gable ends; a flat deck through
scuppers in its parapet. By `tradition` (default: the framing's, else `north-american`): K-style gutters and 3 × 4 in
downspouts onto splash blocks; British half-round into gullies and a drain run through inspection chambers; Japanese
copper nokidoi with kusari-doi rain chains to a stone (`downpipe: 'pipe'` for tatedoi); metric box gutters into gullies.
There are as many outlets as the roof needs at the tradition's design rainfall, and the house's `drainage` report
checks each one's load. Gutters go up last: a house shown at a construction stage has none.

## IFC — the house as a building model

`export_model({ ref, format: 'ifc' })` writes a house (with `storeys` or `levels`) as IFC4 for Bonsai, Revit or
ArchiCAD: storeys, rooms as spaces, walls voided by their openings with the doors and windows in them, slabs and the
roof. A framed house carries every member as its section along its centreline, its linings, boxes, cable and
circuits, and its roof as built. Gutters and drains ride a rainwater system. GlobalIds hold across re-exports.

## Rendering the result

- **Top-down map** — draw `rooms` (tinted by archetype), `halls` (corridors), and
  `doors` (dots on corridor edges). This is the readable plan.
- **3D dollhouse** — lay every room in shared world coords under one high pinhole
  camera; draw archetype-tinted floors + walls (skip each room's camera-facing
  front wall for an open cutaway, no ceiling), then each room's furniture via
  `box-net`. Depth-sort all marks into one image.
- **Single room in 3D** — feed `fillRoom(room)` as `roomConcept.elements` with an
  eye-level `camera-two-point` sized to the room.

## When to reach for it

- "Generate a house / apartment / office layout and furnish it."
- A floor plan where the *building* is the subject, not one room.

For a SINGLE furnished room, author a ONE-CELL plan through this same kind — a room
is a part of a building, not a separate primitive:

```
{ "kind": "floorplan", "width": 24, "height": 28,
  "rooms": [{ "x": 2, "y": 2, "w": 20, "h": 24, "glyph": "L" }],
  "furnish": true, "view": "cutaway", "seed": 7 }
```

`rooms` (explicit cells `{ x, y, w, h, glyph }`, feet) replaces the generated plan;
the cell is furnished by its glyph's arranger, walled at real thickness, walkable at
`/world`. A furnished one-cell plan flips three defaults, because every wall is
envelope and there is no house to place openings for it: `windows: true`,
`floorStyle: 'auto'` (floorboards; `'plain'` opts out), its authored `doors`
entry is cut as the front door (a plain `{ x, y, room, edge }` on the envelope no
longer needs `entry: true`; with no `doors` at all an entry door is auto-cut on the
south wall), and `furnishScale: 'share'` — each piece is sized from its share of THIS
floor within a real-world band (a 12×12 lounge gets a loveseat, a 20×24 one a nine-foot
sofa and club chairs; a room too tight for its set drops the bookshelf before a chair,
never the sofa) — and in share mode the pieces that make a room are real meshes, not
box-nets: club armchairs, a coffee table, a media console with its TV, a bookcase
with books, a made bed with headboard, a nightstand with a lamp, a dresser, a
sideboard, a plank dining table with chairs, a bordered rug. The default elsewhere is
`furnishScale: 'feet'`, the legacy fixed-feet arrangers with their box-nets; set
`'share'` on any furnished plan to opt in (the kitchen run stays in feet either way).
`furnishing: 'constructed'` goes further: the sofa, armchairs, coffee table, media console,
bookcase, sideboard, dining table and chairs, dresser and nightstand become the pieces built
joint by joint on the workbench (upholstered cushions and woven cloth, boards, legs, pulls), as
facades sized to the same footprints; a house style's finish colours their cloth and wood. Any
item can name one: `asset: 'constructed-sofa'` (`-armchair`, `-chesterfield`, `-coffee-table`,
`-dining-table`, `-chair`, `-bookcase`, `-media-console`, `-sideboard`, `-chest`, `-nightstand`).
A one-cell plan also defaults `contactShadows: true` — a soft ambient-occlusion decal on
the floor under each piece (`contactStrength` tunes it; off elsewhere) — and dresses its
surfaces: `wallDecor: true` with `interiorWallStyle: 'paint'` (a baseboard course and a
painted swath per wall; houses keep the geometry-hashed paint / wainscot / wallpaper mix),
`wallMaterial: 'plaster'` (a whisper of top-lit ramp + mottle the World tier adds per
vertex; `null` keeps flat paint), and a ceiling in the WALK tier only (the still stays a
cutaway; `ceilings: false` removes it), plus `floorTexture: 'auto'` (oak grain on the boards,
carrara on marble — in the World and the exports; `null` keeps the flat finish). Recessed
ceiling lights are opt-in: `potLights: true` (or `{ spacing: 6, inset: 2.5, candela: 400, color, innerCone,
outerCone, pool, k }`) lays a grid of cans per room in the ceiling — pools on the floor and furniture
in the World (baked, unlit), and a real `KHR_lights_punctual` spot per can in the GLB, so Blender,
Godot, and Unreal light the room themselves (the Unreal importer spawns them from score.json when
Interchange brings none). The plan is authored in FEET; the GLB root and the engine score scale by
`metersPerUnit` 0.3048 so an engine walker reads the room at life size. For real light,
bake it: `node scripts/bake-world-gi.mjs --ref <ref> --preset interior-day --write`
mints a `<ref>_gi` variant with Cycles GI in its vertex colours (needs a local Blender) — or
render the frame itself: `node scripts/blender-bake.mjs --ref <ref> --render --camera x,y,z
--look x,y,z` (add `--open` for the dollhouse light). Both run from a checkout's `control/`;
on an installed mojulo the same scripts ship in the package and run as `mojulo script
bake-world-gi …` / `mojulo script blender-bake …` with the same flags. For an engine that
lights it, `export_model({ lit: true })` (real pbrMetallicRoughness materials over the
unshaded payload — Blender, Godot, Unity and three.js light it on import) / `--lit` on the
engine packs. Explicit `windows` / `floorStyle` / `entryDoor` / `furnishScale` /
door `entry: false` still win; multi-cell and generated plans keep the opt-in posture. New room
archetypes are added as fill recipes (data), not new mark kinds.

Every room has a way in: a room your `doors` leave sealed gets a door cut on its widest shared
wall with a hall (else with a reachable room) — mid-wall, or near the corner when the wall is
too short for the open leaf. Interior doors stand open flat against the wall beside the jamb.
In share mode the entry gets a bench under a picture, the storage room open shelving and a
cabinet, tables and desks their tabletop pieces; chairs are never dropped for a door approach,
and a wall piece in a door's way (or tall storage on a windowed wall) moves to a clear wall.

## Placing your own items

Any explicit room (top-level `rooms`, or a level's) takes `items`, placed relative to the room
so they survive a re-plan:

```
"rooms": [{ "x": 0, "y": 0, "w": 18, "h": 16, "glyph": "L", "items": [
  { "type": "bookcase", "wall": "N", "at": 0.2 },
  { "type": "piano", "at": [0.6, 0.6], "size": [5, 2.5], "height": 4, "facing": "E" },
  { "ref": "<sketch ref>", "wall": "E", "size": [2, 2], "height": 6, "name": "statue" } ] }]
```

- `at: [u, v]` is a fraction of the room inside its walls (`[0, 0]` the N-W corner; default the
  centre). `wall: 'N'|'S'|'E'|'W'` backs the piece onto that wall and faces it into the room; `at`
  may then be one number, the fraction along the wall. N is the y0 wall.
- `facing` is the compass way the front points (same letters). `size: [w, d]` is width across the
  front and depth, in feet; `height` is feet. Items stay inside the walls.
- `type` is a room piece: an arranger type (`sofa`, `bookshelf`, `dining-table`, `armchair`, …) or a
  room-asset id (`bookcase`, `platform-bed`, `club-armchair`, …). An unknown name renders as a
  plain box, so size it yourself.
- `ref` is any stored sketch: a `mint_solid` object, a workbench piece, a sketch with a bound
  mesh (the bound mesh wins). It is fitted uniformly into `size` × `height`, standing on the floor,
  and its own +y side is its front (`turn: <degrees>` corrects one that isn't). An unknown ref, or
  one that places itself, refuses.
- Items render whether or not the room is furnished. Generated furniture yields an item's
  footprint (rugs stay under it). An item is never dropped, not even from a door approach, so
  keep doorways clear yourself. An item's faces are grouped `item:<name>` (a mesh asset keeps
  `asset:<id>:<name>`).

A `condo-complex` takes the same items per unit: `unitItems: { "<unit id>": [items] }`. Unit ids
are `<hall id>:u<n>` (`hall-s:u0`, …); an unknown id refuses and lists the plan's real ids. A
unit's compass turns with its side of the hall, so a unit speaks its own words: `at: [u, v]` runs
u from the washroom side (0) to the entry side (1) and v from the hall glass (0) to the back
window (1). `wall` / `facing` take `back`, `front`, `washroom`, `entry` (the side walls, named
for what stands at them), or a compass letter. A piece with no `wall` or `facing` faces the hall.
The washroom fills the back corner on its side and the entry is the front corner on the other,
so keep items out of both yourself.
`furnishing: 'constructed'` on a `condo-complex` furnishes its units with the same built pieces
(a sofa and coffee table, a nightstand, a desk chair), each unit's cloth drawn from its seed.

## House styles

A new house is minted with `style: 'auto'`: the seed picks a family and, within it, the
variant, so two houses do not come up the same. Name one to choose it, or `style: null` for the
plain undressed house:

| style | outside | inside |
| --- | --- | --- |
| `cottage` | clapboard siding (sage, blue, cream, rose, olive), white trim; bungalow, colonial or farmhouse roof; double-hung or colonial windows | paint, wainscot and wallpaper mix; warm floorboards; warm wood, soft fabrics |
| `brick` | running-bond brick (red, brown, buff); manor, colonial or bungalow roof | greige paint mix; dark floorboards; walnut, oxblood or forest fabrics |
| `modern` | charcoal or grey siding; shed or butterfly roof; picture or casement windows | white and grey paint; pale oak; ash or ink furniture |
| `tofu` | pale block, crisp reveals, high ceilings; flat deck or stacked-room roof | white paint; pale boards; oat and sand furniture |
| `mission` | warm stucco; clay mission or pavilion roof; casement or french windows | warm paint; terracotta tile in wet rooms; dark wood, rust or indigo fabric |

A style only sets defaults: any knob on the manifest wins (`style: 'brick', brickBodyTint: '#…'`).

**Metal cladding and roofs.** `facadeStyle: 'metal'` clads the exterior in sheet metal: `cladding` is `'standing-seam'` (zinc pans with raised seams, the default), `'corrugated'` (galvanized waves) or `'panel'` (brushed aluminium panels on dark joints); `facadeMetal: { metal, finish?, along?, film? }` swaps the metal. `roof: { style: 'standing-seam' }` is a zinc standing-seam gable, and `roofMetal: { metal, … }` (or `roof: { style, metal }`) puts any pitched roof in sheet metal. The metal-surface vocabulary is on the workbench card; a bad spec is refused at mint.
It turns on `facadeDecor`, `wallDecor`, `floorStyle: 'auto'` and `furnishScale: 'share'` (the
mesh furniture, which wears the style's palette). Its roof shows in the `exterior` view only; the
cutaway stays open. An unknown style refuses and names the families.
