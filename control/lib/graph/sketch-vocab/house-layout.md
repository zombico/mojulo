---
{ "id": "house-layout", "name": "House layout — the plan from a seed or your rooms", "summary": "step 1 of a house: a coherent multi-room plan (rooms + aligned hallways + doors) from a seed and a footprint, or an explicit rooms[] plan; one furnished room is a one-cell plan", "when": "minting a house, apartment, office floor or one room with mint_building; choosing a seed, a footprint, explicit rooms and glyphs, or the exterior / cutaway / interior view", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

A house turns a **seed + footprint** into a coherent multi-room building, so you declare
intent and the substrate fills the detail. Three properties hold by construction:

- **fractal** — recursive binary space partition; every split inserts a hallway gap spanning
  the region, so corridors form a connected tree and **line up**.
- **inferrable** — the plan is a plain `{ rooms, halls, doors }` map; doors sit on corridor
  edges, so connectivity reads straight off the top-down plan.
- **reproducible** — a seeded PRNG drives splits, archetypes and furniture jitter. Same seed →
  same building; new seed → new building. You change the *seed*, not every element.

## Minting

`mint_building({ title, manifest })` — `kind: 'floorplan'` and the manifest's own `title` may be
left out. The reply is
`{ ok, ref, url, design, inferred, next }`: `next` names what is open by outcome (concept,
layout, drawings, build), the field or export for each, and its outcome card (`house-concept`,
`house-livability`, `house-drawings`, `house-build`); read that card before adding the step. The recipe is a STARTER: iterate in place with
`update_sketch({ ref, patch })`, re-mint only for a side-by-side variant. Every JSON block below
is a `manifest`.

```json
{ "seed": 7, "width": 40, "height": 30, "view": "exterior" }
```

- `seed` (integer) and `width` / `height` (the footprint, feet) generate the plan. Leave `seed` out and the mint
  draws one and stores it, so every new house is a different draw and still re-renders the same; name one to
  reproduce a house. A new house is also stamped `style: 'auto'`, `layout: 'varied'` and `furnishing: 'composed'`
  (house-dwelling); `null` opts out of each.
- **A house left to the generator is drawn.** With no `rooms`, `levels` or `storeys`, the mint draws from the seed
  a program, `tier: { base: 'cottage' | 'house' | 'villa', beds, study, core: ['L','K'] | ['L','K','D'] }`, one or
  two storeys (`levels`, `stairs: true`), a `width` / `height` that holds it (checked against the generator, so the
  bedrooms drawn are the bedrooms built), `windows`, `entryDoor` and a `porch` or `stoop` by style. Each is a plain
  knob in the stored recipe: "add a bedroom" is `tier.beds`, "make it one floor" is `levels: [{ role: 'ground' }]`.
  Anything given wins; `program: false` keeps the single-floor generator below.
- `purpose` — what the house is for, stamped at mint: `'show'` (a house: every piece as drawn, every table set) or
  `'game'` (a `level`: each piece at a coarser grain, nothing on a table, a room's pieces laid in rank within
  `allowance: { room }` faces, what the room is for always standing). A game's World reads its spend as `rails`.
- `view` — `exterior` (default), `cutaway` (open-topped, and implies `furnish`), `interior`.
- Openings: a new house is minted with `windows: true` (every bedroom needs one for egress; `false` for none);
  `entryDoor` and `ceilings` are opt-in on a plan you give.
- Walkable in its World (the book's Walk tab, `/api/sketches/<ref>/world`): the **walk** button
  walks it at eye height.

## Your own rooms

An explicit `rooms: [{ x, y, w, h, glyph }]` (feet) replaces the generated plan; `doors:
[{ x, y, room, edge }]` places doors (a room your doors leave sealed gets one cut on its widest
shared wall with a hall, else with a reachable room). A room without a `glyph` is `S`, so name
the glyph you mean. Each glyph carries a furniture recipe (furnishing: `house-dwelling`):

| glyph | room    | fills with |
| ----- | ------- | ---------- |
| `E`   | entry   | bench, picture, sconce |
| `L`   | lounge  | sofa, armchair, coffee table, rug, bookshelf, window |
| `D`   | dining  | table + 4 chairs, sideboard, window |
| `K`   | kitchen | cabinet, sideboard, window |
| `B`   | bedroom | bed, nightstand, dresser, window, picture |
| `O`   | office  | standing-desk, computer-chair, rack-shelf, bookshelf |
| `S`   | storage | dresser, cabinet, rack-shelf |
| `W`   | bathroom | toilet, vanity and sink |
| `H`   | hallway | corridor (connective) |

**One room** is a ONE-CELL plan through this same kind. A room is not a house: its book is a
Room book and its readout says `subject: 'room'`. It is furnished, walked and drawn, and never
judged as a home (no livability verdict, no site, stair or frame steps). Use it for a showroom or a
set:

```json
{ "width": 24, "height": 28, "rooms": [{ "x": 2, "y": 2, "w": 20, "h": 24, "glyph": "L" }], "furnish": true, "view": "cutaway", "seed": 7 }
```

A furnished one-cell plan turns on what a lone room needs (windows, a front door, a floor
finish, sized furniture); the list is in `house-dwelling`.

Under the hood: `generatePlan(seed, { width?, height?, maxDepth? })` → `{ seed, width, height,
rooms, halls, doors }`; `fillRoom(room, seed)` expands a room's glyph into box-net elements.

## Rendering

- **Top-down map** — `rooms` tinted by glyph, `halls`, and `doors` as dots on corridor edges.
- **3D dollhouse** — every room under one high camera; the camera-facing front wall skipped for
  an open cutaway, each room's furniture through `box-net`.
- **The World** — walk it from the book's Walk tab; `export_model` ships it (`house-bim`).

Next steps: furnishing and finishes `house-dwelling` · more floors `house-storeys` · the
structure `house-construction` · BIM and export `house-bim`.
