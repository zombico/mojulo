### The game view: a light view layer, verification on every level (spike)

A first, low-fidelity view of mojulo's work, built from plain HTML with no framework: games first, then levels, then
characters, then objects, and on every level what proved it, by which gate, and what is still the person's to play.

- **The view** (`control/lib/view/`, `node scripts/view.mjs`): pure renderers over the store, one stylesheet, a
  `node:http` server with no dependency. A game shows its path to a first level and each level's gates; a level plays in
  the page and carries its gates and the person's stamp.
- **The still check** (a new machine gate, spiked): a level stood still for three seconds in the headless simulator
  (game/level-sim.js); one that ends without a press is reported with the event and its second. On a designed stealth
  game it found four of eight levels lost at their spawn, each stamped `pass` by the first-frame check.
- **The eyes stamp** (spike): the person's verdict on a level they played, kept against the level as it stands, so a
  changed level is unstamped.
