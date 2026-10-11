---
{ "id": "building-commercial", "name": "A store, restaurant or mall as a building — its structure book", "summary": "the structure book for a commercial program: a store (from a concept card), a restaurant or a mall (one or two levels), read as the building it is: its occupancy, rooms named by role, its program's grade, the fit-out as an FF&E schedule, plans, elevations, sections and schedules", "when": "someone wants plans, a drawing set, an FF&E or fixture schedule, or a check of a shop, store, boutique, café, bar, restaurant or shopping mall; or a mint_building `next` names card 'building-commercial'", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A store, a restaurant and a mall are buildings on the same rail as a house. `mint_building` takes the manifest
`create_sketch` takes; the page is the structure book. Each is read as what it is, never as a home: no bedrooms,
no egress windows, no "is it livable".

## From zero, ask

1. **Which building?** A shop from a concept card (`kind: 'store'`, card `store`), a restaurant
   (`kind: 'restaurant'`, with a `seed`), or a mall (`kind: 'mall'`, one level or `levels: 2` around an atrium).
2. **How big?** Feet: a store's `width` × `depth` (default 24 × 40), a restaurant's `width` × `height`
   (default 48 × 64), a mall's `width` × `height` (default 64 × 120).
3. **Fitted out?** A store and each mall bay are fit out from cards (`card`, `cards`; `cards: false` leaves the
   bays bare). The restaurant furnishes its dining room, kitchen and restroom itself.
   - A mall's `cards` takes a store type (`apparel`, `electronics`, `cafe`, `bookstore`, `homewares`, `food`,
     `department`) or a bay index. The book names every room by its bay: the anchors are bays 0 and 1, the shops
     follow. One index sets that bay on both levels.
   - A small bay or lot fits a card by giving fixtures up. Each one given up is a `fit-out` advisory in the grade
     (and the readout's `grade.findings`): grow the `width` / `height`, or set `degrade: false` on a store to see the
     raw card graded.
   - The seeded cards (`bookstore`, `wine-bar`, …) are data the `store` card describes, not vocab cards of their own.

```json
{ "kind": "store", "title": "Pages", "card": "bookstore", "width": 26, "depth": 44 }
{ "kind": "restaurant", "title": "Corner café", "seed": 3, "width": 40, "height": 56 }
{ "kind": "mall", "title": "Arcade", "levels": 2, "cards": { "cafe": "wine-bar" } }
```

## What the book shows

- **Cover**: the occupancy (store and mall: mercantile, M; restaurant: assembly, A-2), levels, rooms, the grade; a
  restaurant's seats as laid and its occupant load (IBC 1004.5), and the lot its walls stand 2 ft in from.
- **Plan**: A-10x per level; the grade is reachability (a door into every space) and the program's rules, in words:
  - restaurant: the restroom is reached without walking through the kitchen; the kitchen has its own service exit;
  - mall: every unit has a storefront on the concourse; the restrooms are reached without walking through a shop;
    the anchors cap the ends; each level's concourse is one walkway; the upper level is reached by escalator or
    lift;
  - store: the card's own assessment (entry decompression, aisles, the cash wrap's sightline, fixture overlap).
- **Rooms**: named by role: sales floor, stock room, fitting room, booth, restroom; dining room, kitchen; concourse,
  tenant bay, anchor store, food court.
- **Elements**: walls by type, doors tagged by the room they serve (a storefront drawn as a cased opening),
  windows, slabs; a two-level mall's atrium (AT), escalators (ES) and lifts (EL), drawn on its plans.
- **Objects**: the fit-out as tagged pieces (gondolas, racks, counters, podiums, tables, chairs, the cook line,
  stalls), each in its room, on the plan sheet and in the FF&E schedule.

## Getting them out

- `export_model({ ref, format: 'sheets' })`: the drawing set as SVG; `format: 'schedules'`: every table as CSV and
  JSON; `format: 'glb'`: the walkable model. No IFC yet: that is a house's.

## Laws

- The book and the World are one building: the read asks the kernel for exactly the building the World builds.
- Every check advises; none refuses.
- The frame, the trades, the site plan and the IFC are a house's for now: a commercial book names them as not yet on
  the rail for its type.
