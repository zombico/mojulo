### The wanted level: the law answers mayhem

- **A world's `law`** (`true`, or `{ police?, stars?, per?, calm?, busted?, fine? }`; `gameworld/law.js`): an open city
  the law watches. Its police are a bestiary entry, the maker's or a patrol in uniform (the new `police` grunt style: a
  uniform shirt and duty belt, a sidearm; a tactical unit). The law is no faction: it gives no work.
- **The `wanted` mechanic** (`game/law-mechanics.js`): mayhem raises a star (a street fight started, a police officer
  downed, a car taken from its driver, a crash into traffic), up to five; each star brings more police, set down near
  the player and out of reach, who chase and strike. Keeping clear of them and of trouble for a while takes a star off
  and sends its police away; taken down by them, the player is **busted**: fined and set down where the level began.
- **Stars on the HUD**: a readout `as: 'stars'` (mana-ui's pips in a new `star` shape).
- **A spawn near a body** (the cast's `spawn` with `near` and `ring`, on one of `among`'s points when given).
- A city level lays its police and the mechanic only when its world has `law`; absent, not one byte.
