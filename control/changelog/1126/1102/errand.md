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
