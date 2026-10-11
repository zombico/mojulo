---
{ "id": "building-level", "name": "A building as a game level — at game depth, not BIM", "summary": "any building mint_building makes (a house, store, restaurant, mall, office or school) as a playable level: `level: { goal }` on its recipe gives a first-person walker at the entry, a goal room, wall colliders and an audit route up the stairs, then create_game promotes it", "when": "someone wants a building as a game level: an office tower to climb, a house to explore, a store or school to walk to a room in; or a level whose design is a real building rather than a stage kit", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A building on the rail is already a level, in all but its goal. Add one field to its recipe and promote it.

## From zero, ask

1. **Which building?** Any `mint_building` kind: a house (`floorplan`), `store`, `restaurant`, `mall`,
   `school-complex` or `office` (a lobby and office floors over one lift-and-stair core: `{ "kind": "office",
   "storeys": 3 }`, or `floors: [{ "use": "lobby" | "office" | "cafe" }]`).
2. **Where is the goal?** `level: { goal }`: `'top'` (the default) is the deepest room on the highest storey a stair
   reaches; a room tag from the book (`'301'`); or a role (`'openOffice'`, `'kitchen'`, `'library'`).
   `radius` (ft, default 3) sizes the goal zone.

```json
{ "kind": "office", "title": "Tower", "storeys": 3, "level": { "goal": "top" } }
{ "title": "Home", "seed": 21, "storeys": 2, "furnish": true, "windows": true, "level": { "goal": "201" } }
```

Then `create_game({ title, store: { slices: [...] }, levels: [{ ref }], auto_audit: true })`: the audit walks in at
the door, up the stairs, into the goal room, and the level is promoted.

## What it lowers to (never stored: it regenerates from the building)

- A first-person walker just inside the entry door, facing in (eye 5.3 ft), and its camera. Controls: W / S walk,
  A / D or the arrow keys turn, Q / E strafe; click the view to capture the mouse, then the mouse looks.
- A `reach-exit` goal in the goal room at eye height, with the stair route the audit walks (`via`).
- Box colliders on every wall run, its doors left open (the hero's platform rule stops at them; the walker does not
  collide).

## Laws

- Game depth, not BIM: no frame, trades or IFC is asked of a level; the book, sheets and schedules still read the
  same building.
- A recipe that writes its own `game` channel keeps it; `level` only lowers when there is none.
- A goal no stair reaches is refused with the reason (a school's upper floors are shells; an escalator is not walked).
