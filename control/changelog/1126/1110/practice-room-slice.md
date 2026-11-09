### The practice room's arsenal reaches the game: a world's `arsenal`, laid on every level's hero

- **A world's `arsenal`** (`gameworld/arsenal.js`): the weapons and strings the practice room plays, written once on the
  world. A template's kit by name (`'fallen-angel'`, `'fable-of-artesia'`), the kit with edits over it (`{ from, … }`:
  `art` and `ranged` replaced, `timing`, `mp` and `juggle` merged, weapons and their combos edited by id, `{ id, drop:
  true }` dropping one, a move merged field by field or `null` dropping it), `'auto'` (the kit of the feel's template, the
  nearer one that has a kit; none where neither has one), `false`, or a whole arsenal. Read with the world: a wrong word
  is said, a combo left on a dropped move is the combo manifest's own refusal.
- **Laid on every level** (`levels.js`, `armLevel`): the hero that strikes (a right-hand item serving `strike`), and each
  seat's copy of it, takes the weapons, the first one's moveset and the sidearm; the foes take the juggle's rules where
  they write none of their own. A weapon shown on the sheathed figure (the fist) is laid only on an action hero that
  sheathes its blade. Nothing written, or no hero that strikes: the level as it was, byte for byte.
- **Suggested, never laid** (`design_game`'s readout): an `arsenal` step suggests `'auto'` for a striking hero whose feel's
  template has a kit, with its patch; one written for a hero that strikes with nothing is said. The readout's `arsenal`
  names the kit, the weapons, the combos and the sidearm. The feel card says the key.
- **The room plays the game's arsenal** (`scripts/spikes/practice-room/room.mjs`): the world's `arsenal` when it writes
  one, `--kit` over it.
