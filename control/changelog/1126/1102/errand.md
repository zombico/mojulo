### Errand: sent out with a list, home with the goods

The escape room's opposite pole: not held in one space until its locks open, but sent out across a map world with a
list (a tree of needs: the eggs need coin, the coin needs a job) and expected back at its giver. What you carry
accumulates in the bag, and the cargo has a state: a fragile one breaks a little at every fall and hit, a perishable one
spoils while carried. Built so far:

- **The verbs** (`game/errand-mechanics.js`, cards `trade`, `cargo`, `deliver`), each on the bag's guarded transfer
  (`playscape/ui/items.js` `lowerMove`), so every change is said for the store and what is carried rides from level to
  level, no runtime of their own:
  - `trade` (emitter): a place an item is had, its `needs` spent for it (with none, a source); short of the price,
    nothing moves and a toast names it; it gives again only once the bag holds none of it (a shelf restocks).
  - `cargo` (emitter): a carried item's condition is its count in the bag. `fragile` loses one to each hit the carrier
    takes and each fall; `perishable` one every N seconds while any is carried; a HUD bar, `cargo:lost:<item>`.
  - `bounty` (emitter): a foe's fall drops its proof into the bag (dead, the default): each fall of a foe matching `who`
    (the cast's `down`), or an hp-pool's `enemy:down`. Alive, the captive carried as cargo, is to come.
  - `deliver` (terminal): the giver's hand-in; holding each asked item at its `min`, those are handed over, its `reward`
    paid into the bag (every errand pays), and the level is won (`errand:done:<id>`); short of any, a toast says what to
    bring and nothing is taken. A bounty board is a giver that wants proofs.
  Names for a handoff: `trade-<item>`, `deliver-<id>`. Sounds, glyphs and engine samples for each.
- **The errand in a world** (`gameworld/errand.js`): a map world's `errands: [{ id, giver, reward?, list: [{ item, at,
  count?, min?, needs?, from?: { foe }, cargo? }] }]`, read and refused by name (a map world only, known levels and
  items, no cycle, one item one errand, a bounty's foe fielded on its level). Its laws advise in the readout: `solvable`
  (an order from the start through the links, a keyed link once its key is found), `varied` (no two legs in a row in one
  level), `survivable` (a cargo carries a margin). Each level's last stage lays its legs beside the bag, each trade and
  the giver's hand-in on a beat of its own past the ways' and the keys'; a bounty for `from: { foe }`; every level the
  cargo; the giver asks for the list's roots. The game's store carries a bag when a world has errands.
- **In the readout and the book**: an errand's laws that advise are `design_game`'s `advice.errands`, each named by its
  errand. The book's errands section (`gameworld/errand-page.js`) draws each as its route (out from the giver through
  its legs in order, home again) with a row a leg: what is had, where, how (a shelf, a shop and its price, a bounty and
  its foe), its cargo's state, what the giver asks; the reward and the laws. The `gameworld-qow` card carries the
  recipe and answers "an errand, a fetch quest, a delivery run, a bounty board"; docs/quest-open-world.md says it.
