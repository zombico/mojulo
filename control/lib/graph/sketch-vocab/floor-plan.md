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

A floor plan is a WORLD kind minted through `create_sketch`:

```
{ "kind": "floorplan", "title": "…", "seed": 7,
  "furnish": true,          // OPT-IN — default false ⇒ every room renders EMPTY
  "windows": true, "ceilings": false, "wallDecor": true, "entryDoor": true,
  "view": "cutaway"         // 'exterior' (default) | 'cutaway' (implies furnish) | 'interior'
}
```

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
--look x,y,z` (add `--open` for the dollhouse light). For an engine that lights it,
`export_model({ lit: true })` / `--lit` on the engine packs. Explicit `windows` / `floorStyle` / `entryDoor` / `furnishScale` /
door `entry: false` still win; multi-cell and generated plans keep the opt-in posture. New room
archetypes are added as fill recipes (data), not new mark kinds.
