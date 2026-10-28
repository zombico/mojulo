### Race of Champions: a duel's two lanes inside a stadium

A stadium race, as the Race of Champions runs one: two cars side by side on mirrored lanes that swap once over a
crossover bridge, so both drive the same distance, head to head, inside a stadium's bowl.

- **The duel** (`roads/course.js` `designDuel`, the `race-of-champions` preset, a course spec's `duel: true`): one closed
  alignment round the stadium twice. Lane one runs from the start to the crossover, cuts across onto lane two, and lane
  two runs back round to the start: the first car's lap, half the alignment. The second car starts a lane over, half the
  alignment on. The base loop's second half is its first turned half a turn about the middle, so each car drives one
  lane-half of each side and one diagonal, and the two laps come out equal (`duel.fair`, millimetres on the preset). The
  crossover is a short S in the middle of the far straight, steep enough that the lanes meet only where the figure of
  eight's bridge has lifted one clear of the other. `twist` dents a chicane into each long side. A lap shorter than the
  corners fit is advised.
- **The stadium class** (`roads/classes.js`, `TRACK_TEMPLATES`): a Race of Champions' lane, 8 m of asphalt between
  concrete walls, no run-off, a crossover steeper than a circuit's. A raised road's side is concrete, not an
  embankment (a template's new `skirt`, earth unless it says).
- **Its stadium** (`scape.venue`, `stadium/stadium.js` `trackVenue`): a stadium preset or a stadium's words. Its bowl,
  masts and skyline wrap the track's whole footprint, drawn in the track's kit on its pole, and stand on the track's
  own ground (`bowlFaces`' new `ground: false`: no infield, apron or plaza). The bowl is the whole dressing: no arena
  plan, surrounds or set pieces. The driver's eye meets its four sides.
- **The contract's duel** (`roads/contract.js`): both starts, the grid lane by lane (lane two's slot first, the rival's;
  lane one's the player's), and each leg's checkpoints, as many in each and none on the crossover; a car's lap is one
  leg and its next the other. Each start line is painted.
- **The race on it** (`gameworld/quick.js`, `game/mechanics.js`): a quick race on a duel puts you in lane one and one
  rival in lane two, on its own checkpoints through the `laps` mechanic's new `rivalCheckpoints` (a rival's own ring, as
  many as the player's: the place is counted in passes; absent, a rival runs the player's, as before). Laps are 1 or an
  even number (two, the default, is the whole loop); more than one rival is refused, teaching.
- **The words** (`trackscape-compose.js`): "race of champions", "stadium race", "stadium track", "head to head" in the
  football ground; "olympic stadium", "colosseum" and "dome" name the venue. A duel's course has no hills, ramps or
  crossing of its own; a point-to-point stage is never a duel.
- **Held** (`roads/duel.test.js`): one crossing over a deck that clears the lower lane, and no near pass anywhere else,
  plain and chicaned; equal laps, the second start a lane over and the same way; the contract's duel; a rival in lane
  two racing the whole loop from the contract alone, its own checkpoints in order, never backing off a wall, the
  player on the grid second; the words; the bowl clear of the footprint and no arena or surrounds. Seen in machine
  screenshots, the track bare and in the football and anime stadiums; the eyes gate is open.
- **Not built, said:** the knockout (heats in a bracket, the winner on to the next: nothing plays heats as levels
  yet), race control and the broadcast on the duel's page (the stopping point below), a wall shared by the two lanes
  (each lane keeps its own, a metre apart), the crowd's cars and a podium.
