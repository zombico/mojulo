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
- **The practice room from the recipe, before any level** (`gameworld/practice-room.js`, its page
  `practice-room-page.js`): a world that writes a feel that fights hand to hand (or any feel with an arsenal) has a
  room. It is built from the world alone:
  - the feel template's own stage, greyboxed (the floor the stick view plays on), or the ring;
  - the hero: the run's own (its sketch and its sheathed twin) where made, else a stand-in on the template's body with
    the world's blade, sheathed out of a fight;
  - the foe: the bestiary's first, its sketch or a person of its class standing in, two metres ahead;
  - the arsenal: the world's, else the template's kit, else the basic one.
  
  The page measures the foe's health on the resolved bodies and lays the HUD (frame data beside the card, the combos,
  every press taken or dropped and why). It is served on read as `bible?book=practice` (`cast=female` for the stand-in)
  and linked from design_game's readout (`practiceRoom`) and the rail. `room.mjs` is its CLI (`--kit`, `--combos`,
  `--art`, `--hero`, `--cast` over the game's). Checked in headless Chrome: a template's room comes up with no error,
  and three clicks play its L L L string, each press taken and all three blows landing.
