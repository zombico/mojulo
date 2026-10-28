### Circulation laws: one set of rules, a livable profile and a game profile

The concerns a building's paths keep, named once, with two kinds of numbers: a house keeps a body's and its furniture's
minima, as a tradition's codes do; a game keeps its walker's and its camera's. Games and houses stay two flows.

- **The laws** (`construction/circulation.js`): `CIRCULATION` names them (passage, door, door approach, a stair's
  width, riser, going, landing, the clear floor at its foot and head, how far a doorway keeps from either, headroom,
  guard, well). `DESIGN_RULES`, the four traditions' livable numbers the house flow reads, moved here unchanged
  (`floorplan-design.js` imports and re-exports it). `STAIR_PROFILES`: `keep` (a keep's or a tower's steep straight
  flight, the stage's stair since its first storeys, its numbers and its output exactly as they were) and `game` (a
  building's: a 0.2 m riser on a 0.3 m going, about 34°, a flight 2 m wide, a switchback with a half landing 2 m deep
  and a 0.4 m well, 2 m of clear floor at its foot and its head, 2.7 m of every doorway's own floor kept clear of it,
  1.1 m guards).
- **The game stair** (`era/storeys.js`): a stage's `stair: 'game'` lays switchbacks. Two flights side by side split a
  storey's steps evenly, so the second ends where the first began and the upper floor is met square; solid under from
  the ground, balustraded both sides and round the landing; the hole in the upper floor its whole footprint, railed but
  where it is climbed out of. A stair climbing out of a room another climbed into stacks on it in the one shaft (the same
  footprint, its flights slabs over the flights below, the hole under it left open over its first flight). A stair
  record carries its `flights`, `landing`, `route` and `exit`; a keep's carries none of them, and every face, collider
  and rail reads a straight flight's numbers as before. A building's use (`program: { use: 'office' }` and the rest)
  takes the game stair; the core packer's 10 × 12 m core holds it.
- **Routes**: `structure/level.js` `stageLevel` climbs a switchback by its route; the walk spike
  (`building-walk.mjs`) does too, then goes round the railed hole. Every building use walks to its top floor on it.
