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
  took a grunt from 20 to 8. A game with no later power emits as before, byte for byte. The level contract takes
  `game.powers` without a slice beside `bought` (`game/level-contract.js`), so a level whose map keys no door renders.
- **A level's powers read back as data** (`gameworld/power-record.js` `powerRecord`): each power's key, its holder, when
  it is gained (the start, or its node in the stats), its spend, the toast it refuses with, its look, its attack (a beam
  at the nearest foe in front, its reach and hurt) and its move with what grants it (the held slice, a pickup, the
  stats), read from the level's own keys, cues and `game.powers`. It is for a reader that does not run the page's cues,
  the engine handoff's level record first, and it imports nothing.
- **One HP: where the stats bind the hero's body, its bar is the hp that ends the level** (`runner.js`, `foes.js`
  `onBody`, `game/mechanics.js`, `worlds/controllable/foe.js`). A fighting level of a world with systems kept two hp:
  - the stats' bar on the hero's body (its hp stat, 100 and rising each level);
  - a level hp of 20 beside it, which a foe's touch took 2 from and which alone lost the level, so the bar the player
    watched was not the one that ended the run.
  Now such a level is lost when the body is down, and every hurt takes from the body: a blow, a beam, a foe's touch and
  a hazard. A touch and a hazard cost the same share of the body's hp they cost of the level's (a tenth, a quarter), and
  there is one HP readout.
  - `fail-on-death` and `hazard-damage` take `of: 'body'`: no hp var, the level lost on the body's `down`, a hazard
    through the cast's `hurt`, a lethal fall through its `kill`.
  - A foe's touch takes the pilot's `rule.stomp.hurt` off a body with its own hp, downing it at none.
  - A level a battle plays on (a boss, the party's fights) keeps the level hp its battle reads, and a world without
    systems plays as before.
  - Seen in an exported page: ten touches of a grunt took the one HP bar from 100 to 0, and the level ended in a fail,
    with no level hp beside it.
- **A short foe is touched, not stood on** (`worlds/controllable/foe.js`). A pilot stomped a foe whenever its feet were
  within 0.3 m of the foe's top, standing or falling. A foe shorter than that (a grunt of a quarter of a metre) was
  stomped by a hero walking into it on the same ground, so its touch never hurt. The reach is now half the foe's height
  (0.3 m still on a foe taller than 0.6 m): a hero beside a short foe takes its touch, and one landing on it stomps it.
  Seen in an exported page: the example hero's own 0.24 m grunt took the HP bar from 100 to 0 in ten touches.
- **A world with no systems makes its gear** (`gameworld/character-review.js` `characterReady`). The equipment step
  waited on the stats (`mechanics:stats`), and a world with no systems page (a sentence's hero, which has no powers)
  never lays them. So the sword a crawler's hero carries for its strike was never made as gear, and the run's readout
  waited on it for good. The equipment now waits on the stats only where the world has a systems page; without one it
  is made once the hero is settled. The character book says why. Seen in a composed crawler's run: its sword made as
  `gear-sword`, every step ready, nothing left waiting.
