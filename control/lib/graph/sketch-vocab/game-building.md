---
{ "id": "game-building", "name": "A game building — rooms from its use, in a civilization's language and a cube's materials", "summary": "a stage's `program: { use }` lays a building's rooms and doorways from its use (a tavern, keep, crypt, temple, shop, dwelling …) on a room kit, with no livability pass: the civilization's language sets the heights, the cube or kit the materials, and `level: {}` plays it to its goal room", "when": "someone wants a building inside a game: a tavern, keep, temple, crypt, guardhouse, library, lab, shop, workshop, barn, hall, tower or house to walk through; a dungeon of rooms from a use; the inside of a town's building; buildings a geocube's world would have", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A building in a game is a plan, a language and a look. Name the use; the rest is laid for you.

## From zero, ask

1. **What is it?** `program: { use }`.
   - The town's uses: `dwelling`, `shop`, `workshop`, `barn`, `hall`, `tower`.
   - The game's uses: `tavern`, `keep`, `temple`, `crypt`, `guardhouse`, `library`, `lab`.

   Each has its rooms by role, which opens off which, and a goal room (the tavern's cellar, the keep's treasury, the
   crypt's tomb).
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
{ "kind": "stage", "kit": "research-lab", "program": { "use": "lab", "civilization": "shell", "rooms": { "store": { "drop": true } } } }
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
- **On a level:** in the game designer it is `places: { buildings: [...] }`. `goal: true` ends the level in its goal
  room, and the route runs in at its door.

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
- One storey (stairs and upper floors come later). The language sets heights today; ceilings by cap, windows by its
  rhythm and its trim come later.
