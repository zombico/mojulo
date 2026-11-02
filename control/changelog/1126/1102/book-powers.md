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
- **A power fires only once it is the hero's, and only when its spend is there** (`mechanics.js`, the systems page). A
  power gained at a later stage waits on its node in the stats (`hero.<power>` at rank 1 at least, bought on the stats
  page or carried in); a power that spends a resource waits on it. Refused, the key says why in a toast ("wind-orb: not
  gained yet", "not enough <resource>") and nothing fires or is spent. The starting stage's powers are the hero's kit. It used
  to fire whether gained or not, the limit the systems page said.
- **A later power's move is granted when its node is gained** (`levels.js` `laterGrants`, the game channel's
  `powers.bought`). The page hears the stats: the moment the bus holds the power's node, its move (a double jump, a high
  jump…) is the hero's, on a level whose map keys no door as much as on one that does. Seen in an exported page: before
  its node, the example hero's `wind-orb` said "not gained yet" and fired nothing; with `hero.wind-orb` at 1 its orb
  took a grunt from 20 to 8. A game with no later power emits as before, byte for byte.
