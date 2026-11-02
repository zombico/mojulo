### Book powers: the hero's pages act in play

The game book's actions, adornment, systems and equipment pages are written and read, but in play a power only spent
its resource, put on a look and showed a toast. This theme makes them act.

- **A power's move is the hero's from the stage that gains it** (`levels.js` `startingGrants`). A power with a `move`
  (double jump, glide, high jump, the wall, the line) that the hero gains at the early stage (or any, where the page lays
  no stages) is granted from the first level on every trail and in every building, over the hero's own rule: a high
  jump is half as high again as its own, a second jump at least one. It used to be granted only where the power keyed
  a map's door; one that keys a door is still found there. A power gained later waits on its stage.
- **An attack power lands on the nearest foe in front** (`mechanics.js`, the systems page). A power with an `attack`
  (a beam: orb, fireball, ray…) fires it from the hero's hand when its key is pressed, at the nearest standing foe in
  front of the hero (within 24 m and 0.7 rad of its heading), and takes the hero's power stat × the power's `per` as it
  lands. With no foe in front it flies on at nothing. It used to spend, glow and say its name, its hurt carried as
  data. Seen in an exported page: the example hero's `wind-orb` (key 2) took a grunt from 20 to 8.
- **The cast's beam aims and hurts** (`worlds/controllable/cast.js`, read by `playscape/ui/cast.js`): a cue's
  `{ beam: { who, to: { nearest: { range?, cone? } }, hurt? } }` fires at the nearest standing foe in front of `who` (a
  mind, not its own team, never a seat) and takes `hurt` as it lands, beside the struck fact, as a blow does (a hit, its
  flash, downed at 0). A beam with neither plays as before. The emission pins of every fixture that embeds the
  controllable runtime moved for it.
