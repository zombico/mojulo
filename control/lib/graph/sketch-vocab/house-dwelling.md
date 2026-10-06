---
{ "id": "house-dwelling", "name": "House dwelling — furnishing, your own items, finishes and styles", "summary": "a house's rooms as lived in: furnish by glyph, furniture sized to the room or built on the workbench, items you place, wall and floor finishes, pot lights, and house styles", "when": "furnishing a house or one room, sizing or building its furniture, placing your own pieces or minted objects in a room, a condo unit's items, wall / floor finishes, recessed lights, baking light, or choosing a house style (cottage, brick, modern, tofu, mission, metal cladding)", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

Every furnishing knob defaults OFF on a generated plan: `furnish`, `windows`, `ceilings`,
`wallDecor`, `facadeDecor`, `entryDoor`, `porch` / `stoop`. Set `furnish: true` (or `view:
'cutaway'`, which implies it) to fill each room from its glyph (the glyph table is in
`house-layout`). New room archetypes are fill recipes (data), not new mark kinds.

```json
{ "seed": 7, "width": 40, "height": 30, "furnish": true, "furnishScale": "share", "windows": true, "entryDoor": true, "view": "cutaway" }
```

## Furniture

- `furnishScale: 'share'` — each piece sized from its share of THIS floor within a real-world
  band (a 12×12 lounge gets a loveseat, a 20×24 one a nine-foot sofa and club chairs; a room too
  tight drops the bookshelf before a chair, never the sofa), and the pieces are real meshes:
  club armchairs, a coffee table, a media console with its TV, a bookcase with books, a made bed,
  a nightstand with a lamp, a dresser, a sideboard, a plank dining table with chairs, a rug.
  The default is `'feet'`, the fixed-feet arrangers with box-nets (the kitchen run stays in feet).
- `furnishing: 'constructed'` — the sofa, armchairs, coffee table, media console, bookcase,
  sideboard, dining table and chairs, dresser and nightstand become pieces built joint by joint
  on the workbench (upholstery, woven cloth, boards, legs, pulls), sized to the same footprints;
  a house style's finish colours their cloth and wood. Any item can name one: `asset:
  'constructed-sofa'` (`-armchair`, `-chesterfield`, `-coffee-table`, `-dining-table`, `-chair`,
  `-bookcase`, `-media-console`, `-sideboard`, `-chest`, `-nightstand`).
- In share mode the entry gets a bench under a picture, the storage room shelving and a cabinet,
  tables and desks their tabletop pieces; chairs are never dropped for a door approach, and a
  wall piece in a door's way (or tall storage on a windowed wall) moves to a clear wall. Interior
  doors stand open flat against the wall beside the jamb.

## One room's defaults

A furnished ONE-CELL plan flips the defaults a lone room needs, because every wall is envelope:
`windows: true`, `floorStyle: 'auto'` (floorboards; `'plain'` opts out), its authored `doors`
entry cut as the front door (with no `doors`, one is auto-cut on the south wall),
`furnishScale: 'share'`, `contactShadows: true` (a soft occlusion decal under each piece;
`contactStrength` tunes it), `wallDecor: true` with `interiorWallStyle: 'paint'` (a baseboard
and a painted swath per wall), `wallMaterial: 'plaster'` (`null` keeps flat paint), a ceiling in
the walk tier only (`ceilings: false` removes it), and `floorTexture: 'auto'` (oak grain on
boards, carrara on marble; `null` keeps the flat finish). Explicit `windows` / `floorStyle` /
`entryDoor` / `furnishScale` / door `entry: false` still win; multi-cell and generated plans keep
the opt-in posture.

## Light

`potLights: true` (or `{ spacing: 6, inset: 2.5, candela: 400, color, innerCone, outerCone, pool,
k }`) lays recessed cans per room: pools on the floor in the World (baked, unlit) and a real
`KHR_lights_punctual` spot per can in the GLB, so Blender, Godot and Unreal light the room
themselves. The plan is in FEET; the GLB root and engine score scale by `metersPerUnit` 0.3048.
For baked light: `node scripts/bake-world-gi.mjs --ref <ref> --preset interior-day --write`
mints a `<ref>_gi` variant with Cycles GI (needs a local Blender), or `node
scripts/blender-bake.mjs --ref <ref> --render --camera x,y,z --look x,y,z` renders the frame
(`--open` for the dollhouse light). From an installed mojulo: `mojulo script bake-world-gi …` /
`mojulo script blender-bake …`. For an engine that lights it: `export_model({ lit: true })`.

## Placing your own items

Any explicit room (top-level `rooms`, or a level's) takes `items`, placed relative to the room so
they survive a re-plan:

```json
{ "width": 24, "height": 20, "seed": 3, "rooms": [{ "x": 0, "y": 0, "w": 18, "h": 16, "glyph": "L", "items": [
  { "type": "bookcase", "wall": "N", "at": 0.2 },
  { "type": "piano", "at": [0.6, 0.6], "size": [5, 2.5], "height": 4, "facing": "E" } ] }] }
```

- `at: [u, v]` — a fraction of the room inside its walls (`[0, 0]` the N-W corner; default the
  centre). `wall: 'N'|'S'|'E'|'W'` backs the piece onto that wall facing into the room; `at` may
  then be one number, the fraction along the wall. N is the y0 wall.
- `facing` — the compass way the front points. `size: [w, d]` is width and depth in feet;
  `height` is feet. Items stay inside the walls.
- `type` — an arranger type (`sofa`, `bookshelf`, `dining-table`, `armchair`, …) or a room-asset
  id (`bookcase`, `platform-bed`, `club-armchair`, …). An unknown name renders as a plain box.
- `ref` — any stored sketch (a `mint_solid` object, a workbench piece, a sketch with a bound
  mesh), fitted uniformly into `size` × `height` on the floor, its +y side its front (`turn:
  <degrees>` corrects it). An unknown ref, or one that places itself, refuses.
- Items render whether or not the room is furnished; generated furniture yields their footprint.
  An item is never dropped, not even from a door approach, so keep doorways clear yourself.
  Faces group as `item:<name>` (a mesh asset keeps `asset:<id>:<name>`).

A `condo-complex` takes the same items per unit: `unitItems: { "<unit id>": [items] }`, ids
`<hall id>:u<n>` (`hall-s:u0`, …; an unknown id refuses and lists the real ones). A unit speaks
its own words: `at: [u, v]` runs u from the washroom side (0) to the entry side (1) and v from
the hall glass (0) to the back window (1); `wall` / `facing` take `back`, `front`, `washroom`,
`entry`, or a compass letter; a piece with neither faces the hall. Keep items out of the
washroom and entry corners. `furnishing: 'constructed'` furnishes its units with built pieces.

## House styles

A new house is minted with `style: 'auto'`: the seed picks a family and its variant. Name one, or
`style: null` for the plain house:

| style | outside | inside |
| --- | --- | --- |
| `cottage` | clapboard siding (sage, blue, cream, rose, olive), white trim; bungalow, colonial or farmhouse roof; double-hung or colonial windows | paint, wainscot and wallpaper mix; warm floorboards; warm wood, soft fabrics |
| `brick` | running-bond brick (red, brown, buff); manor, colonial or bungalow roof | greige paint mix; dark floorboards; walnut, oxblood or forest fabrics |
| `modern` | charcoal or grey siding; shed or butterfly roof; picture or casement windows | white and grey paint; pale oak; ash or ink furniture |
| `tofu` | pale block, crisp reveals, high ceilings; flat deck or stacked-room roof | white paint; pale boards; oat and sand furniture |
| `mission` | warm stucco; clay mission or pavilion roof; casement or french windows | warm paint; terracotta tile in wet rooms; dark wood, rust or indigo fabric |

A style only sets defaults: any knob on the manifest wins (`style: 'brick', brickBodyTint: '#…'`).
It turns on `facadeDecor`, `wallDecor`, `floorStyle: 'auto'` and `furnishScale: 'share'`. Its
roof shows in the `exterior` view only. An unknown style refuses and names the families.

**Metal cladding and roofs.** `facadeStyle: 'metal'` clads the exterior in sheet metal:
`cladding` `'standing-seam'` (default), `'corrugated'` or `'panel'`; `facadeMetal: { metal,
finish?, along?, film? }` swaps the metal. `roof: { style: 'standing-seam' }` is a zinc gable, and
`roofMetal: { metal, … }` (or `roof: { style, metal }`) puts any pitched roof in sheet metal (the
metal vocabulary is on the workbench card). A bad spec, or a roof metal with no pitched roof,
refuses at mint.

Next steps: more floors `house-storeys` · the structure `house-construction` · BIM and export
`house-bim`.
