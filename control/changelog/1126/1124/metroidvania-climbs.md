### The castle's climbs: going up is going across, built into the castle

- A metroidvania's rooms are no longer climbed by a hop straight up a column of ledges, nor by runs of floating steps.
  Each room is climbed by its structure (`docs/metroidvania-map.md` "Climbs"): flights of stairs walked up across the
  screen, the lowest built up from the floor as one stepped mass; flights of great steps leapt; landings built out from
  a wall or a tower's pier on their corbels; a ladder at each turn where the way doubles back above itself; and, in the
  rooms on the castle's bottom row, the rock breaking through the floor. Every piece is solid. Rooms take the stair
  tower and the great stair in turn.
- A structure is laid only where it holds: a jump at a time (a ladder's rise excepted), nothing solid within a jump and a
  body over her head, nothing over a hole she comes up through, and nothing before a doorway, a save, a relic or a key.
  A room none fits, or one left through a double jump's sill, keeps a figure of ledges (a switchback, flights, a stair,
  the zigzag last), which no longer folds back over itself against a wall.
- Towers two screens wide: a ring's `towers: true` makes its legs up and down two screens wide. Vampire Sonata's outer
  wall has them, so the castle is 14 × 8. A tower is closed against the night (the outer wall's new `tower` locale),
  with a pier up its middle and its way woven from one screen to the other through archways in the pier. The camera
  follows across both screens. Doors climbed to stand over the end of a bay, so a climb ends on a landing.
- Ladders join the box's play: each is a climbable the level carries (`W` climbs). Three box laws say the climbs hold:
  `climbs-across` (a climb of more than a storey spreads across its screen), `headroom`, and `no-kick`.
- A bot climbs every ungated room of the castle on the runtime, stairs walked, great steps leapt, ladders held, and out
  through its door: the level's e2e.
- The fabric builds the pieces in the room's stone: a flight one coursed mass, a great step in courses, a landing on its
  corbel, the pier quoined with its archways made as doorways are, a ladder's rails and rungs, the rock in boulders. The
  backdrop shots take `--tall` to see a tower whole.
