---
{ "id": "interior", "name": "Interior — a room of a house, furnished, styled and composed", "summary": "the interior designer: one room of a house fitted out as its own design — the room's jobs solved into pieces at true size, skinned in a named style, placed by decorators' and builders' laws, its walls and floor dressed; the house is read, never written", "when": "decorating, furnishing or restyling a room; 'make my living room Japandi', 'a reading corner', 'try three schemes'; a room described in words (its size, windows and doors) to be furnished; moving, resizing or swapping one piece", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

A room is a section of a house, so the floor plan comes first. An interior decorates one room of a
`floorplan` row: it reads the room's walls, doors, windows and height from the house and never draws a wall. The
house row is never written, so several schemes can sit over one house, and an edit to the house reaches every
design over it. Mint with `create_sketch({ title, manifest })`; iterate with `update_sketch` like any recipe.

```json
{ "kind": "interior", "house": "sk_myHouse", "room": "lounge", "style": "japandi" }
```

- `house` is the house's ref (`mint_building` makes one). `room` is its tag on the house's set (`"101"`), its name
  (`"lounge"`, `"bedroom"`), its role (`"living"`) or its glyph (`"L"`). On a stack, `level` picks the storey. A word
  that names no room is refused, and the refusal lists the house's rooms.

## A room from scratch: still the floor plan first

```json
{ "kind": "interior", "style": "soft-modern",
  "house": { "section": { "room": "living", "size": ["14ft", "18ft"], "windows": ["S"],
                          "doors": [{ "wall": "W", "to": "hall", "at": 0.2 }] } } }
```

The mint drafts the smallest honest house round the room, and mints it as a house row of its own:
- the room itself;
- the hall or rooms its doors lead to (`to`: hall, kitchen, bedroom, dining, bath, entry, or `outside`);
- a neighbour past each other inside wall (`neighbours: { E: "bedroom" }` names one);
- outside walls only where `windows` are;
- a front door on the hall's outside wall.

The interior then points at the house and the room. Sizes take `"14ft"`, `"14'6\""`, `"4.2m"` or millimetres.

## What the room is for: the solver

`brief: { uses?, tags?, seats?, bed?, tv? }`.
- `uses` names its functions:
  - seating and media: `converse`, `media`, `read`;
  - storage and show: `display`, `store`;
  - meals and sleep: `dine`, `sleep`, `dress`;
  - work and arrival: `work`, `drop`;
  - finishing touches: `anchor` (a rug), `light-task` (a lamp).
  - Left out, the room's glyph supplies them (a living room: media, converse, read, display).
- `tags` are compact, entertaining, symmetric, kids, pets, wfh and `no-tv`.
- `bed` takes `"queen"`, `"king"` or `"eu-160"`, and `tv` the screen's diagonal in inches.

How the solve runs:
- Each function tries its strategies in order. The first that qualifies and fits wins, and its suggestions join
  (a conversation group brings a rug and a reading light).
- The reply's readout says which strategy won and why the others were refused (`resolved`). A function nothing fills
  is a `gap`; no piece is faked to fill it.
- `focal` names the focal point: `"fireplace"`, a window's mark, a wall letter, or `"view"`. Left out, it is the
  hearth, then the media wall, then the widest window.

## The laws (what is never broken, and what is measured)

Pieces are at true size in millimetres. The placer:
- keeps every piece out of a door's approach, out from in front of glass it is taller than the sill of, and off a
  hearth;
- refuses any group that would narrow a way the room had: 760 mm through, 610 mm to a seat, at least.

It aims at the decorators' numbers:
- a coffee table two thirds the sofa, 14–18 in from it;
- the screen at 1–1.5 times its diagonal;
- the rug under the front legs of every seat;
- art two thirds the width of what it hangs over, its bottom a hand above it;
- 36 in to pull out a dining chair;
- a nightstand each side of the bed.

The readout's `review` measures the narrowest way to every seat, the open floor and the light sources. It advises;
it never refuses.

## The style: a card

`style: "japandi"`, or `{ "name": "japandi", "accent": "mid-century", "palette": { "upholstery": "olive" } }`.
- **The cards:** japandi, scandinavian, mid-century, modern-organic, warm-minimal, wabi-sabi, industrial,
  contemporary, transitional, modern-farmhouse, coastal, mediterranean, boho, maximalism, neodeco, quiet-luxury,
  new-brutalism, grandmillennial, dark-academia, seventies and soft-modern.
- **What a card sets:**
  - a 60-30-10 palette (walls, trim, upholstery, rug, casework, accent);
  - a floor pattern;
  - an accent wall;
  - a timber and its finish, a cloth and an accent cloth;
  - the forms of each furniture kind (arms, back, seat, legs, front).
- **The accent:** `accent` dresses the chairs and the coffee table from a second card, the 80/20 mix.

## One piece at a time: by id

Every piece has an id from its group: `conversation.sofa`, `conversation.coffee-table`, `conversation.chair-1`,
`conversation.rug`, `media.console`, `media.tv`, `reading.chair`, `sleep.bed`, `sleep.nightstand-1`,
`dining.table`, `display.bookcase-1`.

```json
{ "pieces": [
  { "id": "conversation.sofa", "size": ["2400mm", null, null], "like": "tuxedo", "finish": { "fabric": "velvet" } },
  { "id": "conversation.lamp", "omit": true },
  { "id": "conversation.coffee-table", "at": [2100, 1800] },
  { "id": "plant-stand", "piece": "side-table", "wall": "N" } ] }
```

- **Size** is asked before the group is laid, so the group lays round it. A size outside the piece's band is clamped
  and said.
- **Position:** `at` is millimetres from the room's north-west corner (x east, y south), and `facing` a wall letter.
  A moved piece is moved even if it breaks a law, and the readout says which.
- **Look:** `like`, `forms` and `finish` are the furniture grammar's own (`get_solid_vocab({ id: "furniture" })`).
- **Extras:** an unknown id with a `piece` adds one. `omit` leaves a piece out.

## Surfaces and fixed features

```json
{ "surface": {
  "walls": { "paint": "oat" }, "trim": { "paint": "white" },
  "N": { "style": "wallpaper", "pattern": "botanical", "colours": ["cream", "sage", "dusty-rose"] },
  "floor": { "pattern": "herringbone", "colours": ["#b08a5e", "#8a6a48"] },
  "accentWall": false,
  "features": [{ "type": "fireplace", "wall": "N", "at": 0.5 }] } }
```

- **Walls:** a wall's `style` is paint, wallpaper (a `pattern` in `colours`), wainscot, board-and-batten, shiplap,
  picture-frame or beadboard.
- **Floors and papers:** their patterns are the house finishes' (`get_sketch_vocab({ id: "house-finishes" })`).
- **The accent wall:** a card puts its accent wall behind the bed's head or the sofa's back, else on the focal wall.
  `accentWall: false` turns it off, and an object sets your own.
- **Features:** a `fireplace` (its breast, firebox, hearth and mantel), a `chimney-breast` or a `column` stands on a
  wall. The placer keeps clear of it, and a fireplace is the focal point.

## Seeing it

- **Views:** `view: "section"` (the default) shows the room cut out of its house with a step of each neighbour
  through its doors. `view: "house"` shows the whole house.
- **The room's shots:** `dollhouse` (from the corner that hides the least), `corner` and `corner-2` (a standing eye on
  the focal wall), `doorway`, and `plan`.
