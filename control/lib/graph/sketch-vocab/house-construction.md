---
{ "id": "house-construction", "name": "House construction — framing, roof covering, drainage", "summary": "what stands under a finished house: its frame by system (platform, masonry, post-and-beam, kigumi, steel, concrete) at a building stage with wiring and linings, the roof laid as tiles, and gutters and downpipes sized to the roof", "when": "framing a house, showing the structure or a cutaway of it, a building stage (frame, rough-in, insulated, lined), wiring by tradition, a cut list or takeoff, the roof covering (shingle, slate, tile, kawara, standing seam), or gutters, downpipes, rain chains and drains", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

## Framing — the structure under the skin

`framing` (on a stack: `storeys` or `levels`, card `house-storeys`) builds what stands under the
finished house, read from its own plan: the wall runs, openings, storey heights, stair voids and
roof style. Absent, the house is exactly what it was.

```json
{ "seed": 5, "storeys": 2, "roof": "mission", "windows": true, "framing": { "system": "platform", "view": "cutaway" } }
```

- `system` — `platform` (default: 2×6 outer and 2×4 inner studs at 16 in, doubled top plates,
  kings, jacks and headers at each opening, joists and 4×8 subfloor, a stem wall and reinforced
  footing), `masonry` (outer walls of brick in English bond from the footing to the eaves,
  soldier courses over openings, timber floors and roof), `post-and-beam` (8×8 posts on a 16 ft
  grid, plates, tie beams and knee braces, cut mortise and tenon), `kigumi` (dodai, 4-sun hinoki
  posts at a ken and beside each opening, nuki through them at three heights, hozo, a wagoya
  roof), `steel` (HEA columns on base plates, IPE beams bolted to them, steel joists under a
  meshed slab, a steel roof), `concrete` (a reinforced frame of columns, beams and slabs, a
  timber roof on the ring beam).
- `view` — `framed` (default: the structure alone, where the walls, slabs and roof would be) or
  `cutaway` (the finished house past a section at `cut`, a fraction of the width, default 0.5;
  the frame whole).
- `species`, `finish`, `figure` (`flat` by default; `coarse` / `full` bake grain), `joints: false`
  (draw the timber and steel frames uncut, and skip the kernel).
- The roof frames as its family: gable, gambrel and saltbox as a gable; hip, pyramid and mansard
  as a hip (commons, hips and jacks); shed and butterfly as mono-pitches; flat forms as joists.
  No roof, and the top storey gets ceiling joists.
- `stage` — the house at a moment of its building: `frame` (default), `rough-in` (+ wiring, and
  what dries the frame in: sheathing, block infill, SIPs, komai lath), `insulated` (+ batts,
  arakabe clay), `lined` (+ gypsum or plaster, ceilings (hung under a steel floor in lay-in
  tiles, under concrete in plasterboard), shinkabe with fusuma and shoji, cover plates).
- `tradition` — `north-american` | `british` | `japanese` | `metric`, defaulting from the system
  (platform, post-and-beam, steel → north-american; masonry → british; kigumi → japanese;
  concrete → metric) — picks the assemblies and the wiring rules: NEC-like receptacle spacing
  and NM-B bored through studs; a British ring in 2.5 mm² chased in the brick; VVF dropped down
  the posts in moulding (never bored through a hashira); conduit in chases. Past `frame` the
  house carries `construction`: every member, sheet, box and cable run with a stable IFC
  GlobalId, class, catalog material and quantities, a cut list, the sheets to buy, the panel
  schedule, a takeoff and the checks (advisory).
- `detail` — `auto` (default: each frame and wall at the level the house's cameras earn), `full`
  (joints cut, every brick), `boxes` (members as plain boxes, walls as a bond texture), `sparse`
  (boxes less sub-pixel members, walls in their far colour). Identical members and bricks are
  drawn once and stamped (`instance: false` draws each), so a two-storey masonry house is about a
  thousand faces at `auto`, and still under 5k with every brick at `full`.

```json
{ "seed": 5, "storeys": 2, "framing": { "system": "steel", "stage": "rough-in" } }
```

## Roofs — the covering, as tiles

`roof: { style, covering }` lays the roof as a roofer would: courses up from the eave at the
gauge, each unit lapping the one below, ridges and hips capped. `covering: true` lays the style's
own material (shingle styles as asphalt shingle, clay styles as barrel tile, `manor` as slate,
the metal styles as standing seam), or name one: `asphalt-shingle`, `cedar-shake`, `slate`,
`plain-tile`, `pantile`, `barrel` (mission and Spanish, cover and pan), `kawara` (with a noshi
ridge), `standing-seam`; `{ type, material?, color?, detail? }` picks a `roofing:` material from
the catalog or a colour. Near the cameras every tile is drawn (stamped, each with its own tint),
further off the covering's map, far its colour (`detail` forces one). Absent, the roof is exactly
what it was.

```json
{ "seed": 5, "storeys": 2, "roof": { "style": "mission", "covering": "barrel" }, "view": "exterior" }
```

A framed house past `frame` wears its roof as built instead: decked in OSB (North American) or
sugi boards (Japanese), or felted and battened (British, metric), at rough-in; covered when
`lined`.

## Drainage — gutters, downpipes, drains

`drainage: true | { tradition?, downpipe?, outlet?, below? }` hangs gutters on every eave that
sheds water, falling to outlets; downpipes swan-neck back to the wall, clear of the windows, down
to an outlet at grade. Hip roofs drain round the corners; a butterfly through a box gutter in its
valley and scuppers in the gable ends; a flat deck through scuppers in its parapet. By
`tradition` (default: the framing's, else `north-american`): K-style gutters and 3 × 4 in
downspouts onto splash blocks; British half-round into gullies and a drain run through inspection
chambers; Japanese copper nokidoi with kusari-doi rain chains to a stone (`downpipe: 'pipe'` for
tatedoi); metric box gutters into gullies. There are as many outlets as the roof needs at the
tradition's design rainfall, and the house's `drainage` report checks each one's load. Gutters go
up last: a house whose `framing` shows the frame alone (`view: 'framed'`, its default) or stands
at a `stage` past `frame` has none.

```json
{ "seed": 5, "storeys": 2, "roof": "bungalow", "drainage": { "tradition": "japanese" } }
```

Next step: BIM and export `house-bim`.
