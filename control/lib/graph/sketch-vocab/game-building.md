---
{ "id": "game-building", "name": "A game building — rooms from its use, in a civilization's language and a cube's materials", "summary": "a stage's `program: { use }` lays a building's rooms and doorways from its use (a tavern, keep, crypt, temple, shop, dwelling …) on a room kit, with no livability pass: the civilization's language sets the heights, the cube or kit the materials, and `level: {}` plays it to its goal room", "when": "someone wants a building inside a game: a tavern, keep, temple, crypt, guardhouse, library, lab, shop, workshop, barn, hall, tower or house to walk through; a building with upstairs, storeys and a stair to climb; a dungeon of rooms from a use; the inside of a town's building; buildings a geocube's world would have", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A building in a game is a plan, a language and a look. Name the use; the rest is laid for you.

## From zero, ask

1. **What is it?** `program: { use }`.
   - The town's uses: `dwelling`, `shop`, `workshop`, `barn`, `hall`, `tower`.
   - The game's uses: `tavern`, `keep`, `temple`, `crypt`, `guardhouse`, `library`, `lab`.
   - The buildings: `office`, `lab-building`, `warehouse`, `clinic`. A stair core and wings of corridors off it, rooms
     a bay wide along them, the same floor up every storey, a lobby with the way in; each on its bay kit
     (`bay-everyday`, `bay-science`, `bay-utility`), a warehouse's shed and a lab's instrument bay off a wing's end.
     Their settings are the plan's: `storeys` (1 to 6), `wings` (`I`, `L`, `T`, `U`), `loading` (`single`: rooms on
     one side of a corridor, windows on the other; `double`), `bays` (a wing's length, 1 to 6). For a genre level set
     in a building (a stealth mission, a shooter's floor, a horror crawl); a building asked for as a building is
     `mint_building`'s.

   Each has its rooms by role, which opens off which, and a goal room (the tavern's cellar, the keep's treasury, the
   crypt's tomb). The tower and the keep build upward: the tower three storeys to its lookout, the keep's solar and
   treasury up a stair.
2. **Whose building?** `program.civilization` names its builders' language (an anchor: `timber-hall`, `shell`,
   `tiered`, or an anchor's elements). The language's storey height, lifted for a game, sets every room's height. A
   tall use's main room (a hall, a nave, a work floor) takes the town's taller storey. Left out, the cube's builders
   speak, or else the kit's own.
3. **What is it made of?** `geocube` (a preset or a cube): its room kit, colours, patterns and light dress the rooms.
   Or name a room kit (`kit: 'gothic-stone' | 'catacomb' | 'research-lab' | 'gothic-nave'`).
4. **Your changes.**
   - `program.seed` gives another plan.
   - `program.rooms: { <role or id>: { w?, d?, h?, drop? } }` resizes or drops a room.
   - `program.add: [{ id, of, w?, d? }]` adds a room off another.
   - Writing `rooms` and `links` yourself overrides the plan.

```json
{ "kind": "stage", "geocube": "gothic-night", "program": { "use": "tavern", "seed": 2 }, "level": {} }
{ "kind": "stage", "program": { "use": "office", "storeys": 4, "wings": "L" }, "level": {} }
{ "kind": "stage", "kit": "research-lab", "program": { "use": "lab", "civilization": "shell", "rooms": { "store": { "drop": true } } } }
```

## Storeys

A room's `storey` (0, the ground, by default) stands it over rooms of the storey below. A link between rooms on
neighbouring storeys is a stair.
- **The floors:** a storey's floor is the tallest room it stands over, plus a half-metre slab. A room with a room over
  it gets a flat, beamed ceiling (a vault would rise through the floor).
- **The stair:** a straight, steep flight, its treads 0.3 m, laid in the lower room against a wall, clear of its
  doorways. It climbs through a hole in the upper room's floor, railed on three sides. The flight is balustraded, so
  a walker stays on it.
- **The room it needs:** a 4.5 m rise wants about 7.2 m of floor one way, under both rooms. A program's stair room is
  7 by 8 m, entered by its short end, and holds the flight up and the hole of the one below.
- **Upstairs rooms:** a program's room upstairs is its twin over a room below (`over`), so walls stack.
- **Set pieces:** each storey is dressed by the kit and lit by its own torches. Only the storey the walk ends on
  holds the set piece.
- **The level:** `goal: 'top'` is the deepest room on the highest storey. The route climbs each stair.

```json
{ "kind": "stage", "kit": "gothic-stone", "level": { "goal": "guard" },
  "rooms": [{ "id": "base", "x": 0, "y": 0, "w": 8, "d": 8, "h": 4 }, { "id": "stair", "x": 8, "y": 0, "w": 7, "d": 8, "h": 4 },
    { "id": "landing", "x": 8, "y": 0, "w": 7, "d": 8, "h": 4, "storey": 1 }, { "id": "guard", "x": 0, "y": 0, "w": 8, "d": 8, "h": 4, "storey": 1 }],
  "links": [{ "from": "base", "to": "stair" }, { "from": "stair", "to": "landing" }, { "from": "landing", "to": "guard" }] }
```

`level: {}` makes it a game level (card building-level): you start in the way in, and the goal is the program's goal
room. Then `create_game({ levels: [{ ref }], auto_audit: true })`.
`level.mechanics` adds the level's own mechanics beside the goal (pickups in its rooms, a clock). `level.exit: false`
leaves the goal out.

**In the game designer:**
- A `design_game` level is a building in place of a walk: `levels: { inn: { building: { use: 'tavern' } } }`, laid in
  that level's civilization's language, the hero piloting it when there is one.
- `building: { ref }` plays a building already made.
- A quick game takes one too: `quick: { goal: 'collect', building: { use: 'keep' } }`. The pickups lie in its rooms
  and the end is its goal room.

## In open ground: walked into as terrain

An outdoor stage (a trail on a nature or isekai kit, or a climb) takes `buildings: [{ use, seed?, at?, goal?,
civilization?, kit? }]`.
- **Where it stands:** absent `at`, on the flattest land beside the trail, its door to the trail. `at: 'pocket-1'`
  stands it in that pocket, its door to the pocket's mouth. `at: { x, y, facing: '+x' | '-x' | '+y' | '-y' }`
  places it exactly.
- **What it is:** the inside is the program's rooms on a room kit, with a way out through the entry's front wall.
- **The outside:** the outer walls, a plinth to the land, a roof per room in the language's cap, painted in the
  kit's structure paint. A stoop runs down to the land.
- **Its place on the land:** its floor is level with the land at its door (cut into its slope), and the land, trees,
  rocks and grass in its footprint are cleared.
- **No scene change:** you walk in off the trail.
- **On storeys** (a tower, a keep): its walls rise storey on storey to its top, and you climb its stairs inside.
- **A base's building** (`barracks`, `armoury`, `comms`, `command` and the rest of a military base's uses), or any
  bay building given `look: { construction?, palette? }`, is composed as a building level is: its bay kit, its rooms
  stocked, its `tone`, its plan's `storeys`, `wings`, `loading` and `bays`. It wears its construction outside
  (corrugated sheeting, board-formed concrete, block, panels or a floated coat; a flat roof behind a parapet or a low
  steel one). Its windows open through the shell onto the land, and the land's sun at its hour lays their light on its
  floors. A yard before its front is kept clear. A trail's site is about 44 m across: an outpost's building is
  `wings: 'I', bays: 1, loading: 'single'` (about 18 by 22 m on two storeys); a level's plan stands over its edge, and
  the answer says so.
- **Set into its slope** (`embed: true`, or `{ up: <storey> }`): a building of two storeys or more stands with its
  front, the way in, as a walkout on the low land and a door out of its upper storey's back onto the high land behind.
  It is placed where the land falls most nearly a storey across it, clear of the trail, with room to walk round it, and
  the land is cut and filled to it: level before and behind, a bank along one side. A concrete stair climbs the other
  side, and paths of slabs run from the trail to the walkout, to the stair and on to the upper door. Inside, its own
  stairs join the two. No window is laid under the land. The answer's anchor says its doors, its stair, the way through
  it (`through`) and the way round it (`round`); a finding says how far the land was cut and filled. A trail's site is
  about 44 m across: `trail: { ground: { room: 30 } }` adds open ground past the trail's far side for it.
- **On a level:** in the game designer it is `places: { buildings: [...] }`. `goal: true` ends the level in its goal
  room, and the route runs in at its door.

## Entered by its door: the scene changes

`enter: 'door'` on a building (or a town's household or shop) stands its outside only: walls, roofs and a stoop, its
door shut, solid.
- **The door:** walking into it leaves this level by its `door` mechanic (mechanic card `door`), and the game loads
  its inside.
- **The inside:** a level of its own, the program's rooms with `level: { door: 'out' }`. Its way out is a door in the
  way in's front wall; you arrive a few steps in, facing the room.
- **Walking back out** loads the outside again, standing on the land outside its door.
- **The goal:** the inside's goal room ends that level, as any building level.
- **In the game designer:** `places: { buildings: [{ use, enter: 'door' }] }` makes the inside a level after the walk's
  stages, linked by `create_game`'s `links`, ungated.
- **On a street:** the households and shops among `street.enter` change the scene at their doors, while the hall,
  tower, barn and work floor are walked into (`street.doors: false` walks into all of them).

## A town's street

`town: { houses?, enter?, goal?, anchor?, recipe? }` on an outdoor stage stands the civilization's town along the
trail.
- **Which houses:** the town is designed on the kit in its anchor's language, and its first `houses` lots stand
  (6 by default) in the town's own order: the focus (the hall), then the near ring, a counter before a dwelling.
- **Walked into:** the first `enter` (1 by default) get their use's program inside, and `goal: true` ends the level
  in the first.
- **The rest are shells:** the houses as the town draws them, with shutters, frames, chimneys and roofs, a plinth to
  the land, and a collider round each.
- **Placement:** each on the flattest land beside the trail, its door to the trail. No building stands on a beat of
  the trail or on another building.
- **In the game designer:** `places: { town: true, street: { houses, enter, goal } }`, on the level's first trail.

**Planned before anything grows:** buildings and a street claim their ground first, and the trees, rocks,
arrangements and grass grow on the rest, a crown's reach off every wall.

## What a cube recommends

A geocube names the buildings its world plausibly has (`buildings: { anchor, uses: [{ use, enter }] }`).
- gothic-night: a crypt, temple, keep, guardhouse, tower and dwelling, built in `tiered`.
- island-noon: a dwelling, shop, tavern, hall and temple.
- jungle-haze: a lab, workshop, dwelling and temple.

`enter` is how each is entered: `'door'` changes the scene, `'walk'` is walked into as terrain. A recommendation only:
any use builds on any cube, and the answer says when the cube would not have built it.

## Laws (said as findings in the answer's `program`, never refused)

- Every room joins the way in by doorways; the way in keeps its front wall outside.
- Each doorway has wall enough for the kit's door; a room no wall could take is said, not forced.
- The goal room's doorway is the walk's last, so the kit's set piece (a tomb, an altar) stands where the level ends.
  Goal rooms are 6 m or more across, so it and the walker fit.
- No livability, codes or furniture rules: game plausibility only.
- A stair finds a wall to climb along, or says the floor it needs. Rooms upstairs stand wholly over rooms below.
- The language sets heights today; ceilings by cap, windows by its rhythm and its trim come later.
