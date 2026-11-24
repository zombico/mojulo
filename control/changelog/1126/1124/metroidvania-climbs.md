### The castle's climbs: going up is going across

- A metroidvania's rooms are no longer climbed by a hop straight up a column of ledges. Each climb is a figure laid
  across the screen (`docs/metroidvania-map.md` "Climbs"): a switchback of galleries run their length a storey at a
  time and joined by steps at the walls; flights of treads rising diagonally across the screen, a landing at the wall
  and the next flight back over it; a stair walked up without a jump where one flight fits. Shafts take switchbacks and
  flights in turn, so no two climbed one after another are alike. The zigzag stays where a double jump's sill must
  stand clear and where nothing else fits, and it no longer folds back over itself against a wall.
- Every figure is held to a jump at a time and to nothing over her head before it is laid. Two new box laws say so for
  the whole box: `climbs-across` (a climb spreads over a screen's width) and `headroom`.
- A bot climbs every ungated room of Vampire Sonata's castle, and walks the bell tower's stairs, on the runtime: the
  level's e2e. Once found, the double jump skips a switchback's galleries straight up.
- The fabric builds the new pieces in their room's material: a stair's steps a stone mass, timber galleries hung on rods
  from the one above, steps at the wall on corbels, long stone galleries in many stones. The backdrop shots take
  `--tall` to see a shaft whole.
