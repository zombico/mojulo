---
{ "id": "building-level", "name": "A building as a game level — at game depth, not BIM", "summary": "any building mint_building makes (a house, store, restaurant, mall, office or school), or a room-kit stage (a crypt, a nave, a lab), as a playable level: `level: { goal }` on its recipe gives a first-person walker at the way in, a goal room, walls that stop it and an audit route round the walls and up the stairs, then create_game promotes it", "when": "someone wants a building as a game level: an office tower to climb, a house to explore, a store or school to walk to a room in; or a stage of connected rooms (a dungeon, crypt or lab) to walk through to a room", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A building on the rail is already a level, in all but its goal. Add one field to its recipe and promote it.

## From zero, ask

1. **Which building?** Any `mint_building` kind: a house (`floorplan`), `store`, `restaurant`, `mall`,
   `school-complex` or `office` (a lobby and office floors over one lift-and-stair core: `{ "kind": "office",
   "storeys": 3 }`, or `floors: [{ "use": "lobby" | "office" | "cafe" }]`).
2. **Where is the goal?** `level: { goal }`: `'top'` (the default) is the deepest room on the highest storey a stair
   reaches; a room tag from the book (`'301'`); or a role (`'openOffice'`, `'kitchen'`, `'library'`).
   `radius` (ft, default 3) sizes the goal zone.
3. **Or a room-kit stage** (`kind: 'stage'`, a room kit, `rooms` and `links`: card `stage`): the same `level`, in
   metres. `goal` is `'deepest'` (the default: the room most doorways from the start, the larger on a tie) or a room
   id; `from` a room id to start in (the first room by default); `radius` (m, default 1.5).

```json
{ "kind": "office", "title": "Tower", "storeys": 3, "level": { "goal": "top" } }
{ "title": "Home", "seed": 21, "storeys": 2, "furnish": true, "windows": true, "level": { "goal": "201" } }
{ "kind": "stage", "kit": "gothic-stone", "rooms": [ … ], "links": [ … ], "level": { "goal": "sepulchre" } }
```

Then `create_game({ title, store: { slices: [...] }, levels: [{ ref }], auto_audit: true })`: the audit walks in at
the door, up the stairs, into the goal room, and the level is promoted.

## What it lowers to (never stored: it regenerates from the building)

- A first-person walker just inside the entry door, facing in (eye 5.3 ft; on a stage, in its first room at 1.7 m),
  and its camera; the walls stop it. Controls: W / S walk,
  A / D or the arrow keys turn, Q / E strafe; click the view to capture the mouse, then the mouse looks.
- A `reach-exit` goal in the goal room at eye height, with the route the audit walks (`via`): round the walls on
  each floor (the walkers' own pathfinder), up each stair's flights; on a stage, through each doorway on the way.
- Box colliders on every wall run, its doors left open (a stage keeps its own: its walls, pilasters and set pieces).

## Laws

- Game depth, not BIM: no frame, trades or IFC is asked of a level; the book, sheets and schedules still read the
  same building.
- A recipe that writes its own `game` channel keeps it; `level` only lowers when there is none.
- A goal no stair reaches is refused with the reason (a school's upper floors are shells; an escalator is not walked).
