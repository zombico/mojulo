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

## Generating

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

For a single furnished room, use `room-concept-interior` + `box-net` directly.
For the camera, see `camera-two-point`. New room archetypes are added as fill
recipes (data), not new mark kinds.
