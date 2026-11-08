### The practice room: an action game's swings, strings and weapons measured on the runtime it ships

- **Fable of Artesia, the Zelda-like template.** A new pole (`gameworld/feel/cards.js`) between Ebon Spirits (the Souls
  knight) and Fallen Angel (the stylish action game): an action-adventure's sword and shield.
- **The measures, headless** (`scripts/spikes/practice-room/measure.mjs`): a game's melee played on the runtime it
  ships (scripted presses at 60 Hz on `stepWorld`, as `feel/reach.js` measures a jump) against a foe that never dies,
  each beside what its feel card asks for, carried, partly or lost: press to contact, the swing to rest, when the next
  press is taken, the string mashed and with its sides alternated, the hitstop, the foe's stun and the advantage, the
  lunge, the reach, the dodge's frames and invincible frames, the guard. A template's rule (`--feel`, with a held
  weapon's class) or a built game's own pilot (`--page`). Machine gate only.
- **What it found** (the sword, normal class): every template swings the held weapon's 0.5 s whatever its card says (a
  card of 23 to 27 frames plays as 33 to 36), so Fallen Angel, Fable of Artesia and Ebon Spirits swing alike; the next
  press is taken only once the swing has ended (frame 34 to 37, where the cards cancel at 11 to 19); a string is the
  opener and one follow-up in another direction, then 2.5 s locked (alternated: hits 36 frames apart, then 186); mashed
  on one direction, an opener every swing and never a string. The hitstop is carried; the lunge, the card's hitstun
  (the world's combo rule is never set) and the guard and parry are lost; the dodge is invincible all through where the
  card opens a window. The foe reels 80 frames a hit, so every hit leaves the hero a second of advantage.
- **The room** (`scripts/spikes/practice-room/room.mjs`): a game's hero and one of its foes (or a pack) in a greybox
  ring, on the runtime the game ships: a `controllable` manifest from the game's first level (its pilot, its figures,
  its orbit camera and lock-on), resolved and emitted as `export_game` emits a level. The foe never dies and stands
  still until P switches its AI on; R sets it back. A HUD reads the live world: the last move's frame data beside the
  card's, and every press, taken or dropped with its reason. Checked headless: real clicks strike, the foe takes them
  and stands, each dropped click says why. Nobody has played it.
- **The combo manifest** (`gameworld/combos.js`): an action game's attacks and the strings that chain them. A move is an
  attack primitive: the swing it plays (the hero's cut, the thrust, the cleave, the rising cuts), its role (opener,
  filler, finisher, launcher), its length and its cancel in frames, how it covers ground (none: in place; step: a step
  into it before the blow; lunge: the swing carries the body through it, stopping at the body it strikes), its damage,
  impact, topple and launch. A combo is its beats, L (light), H (heavy), S (special) and `.` (a pause), one move a
  press; combos sharing their openings are one tree. The timing forgives: a press with a move to chain into is held to
  the live move's cancel however early, any other press is remembered a buffer's frames, a press just after a move ends
  still chains (`late`), a pause beat is a press in its window. Held and mashed beats are named and refused for now.
  The starter: L L L (two cuts and the cleave, which lunges and topples) and H (the thrust). `readCombos` says what is
  wrong in words; `lowerCombos` is the platform rule's `moveset`; `comboList` the director's list.
- **The moveset in the runtime** (`worlds/controllable/combat-melee.js`, opt-in `moveset` on a platform rule with a
  melee strike): each press a beat, each move a swing of its own (its clip, length, travel and blow), chained at the
  cancel, every press saying what became of it (taken, and how; dropped, and why). Absent, the strike as it was.
- **L, H and S.** The pilot scheme's `melee` context: light on the left click and the pad's left face, heavy on the
  right click and the top face, special on the mouse's forward button and the right face; the bottom face jumps. Read
  only on a page where a body carries a moveset.
- **The room plays combos.** All combos unlocked; the HUD lists them, lights the beats of the string being played,
  shows the last move's frames, travel and hits, and logs the runtime's verdict on every press. The room writes the
  manifest it played beside the page (`combos.json`), the list a game's director takes; `--combos <file>` plays your own.
  Checked headless with real clicks: L L L plays the cut, the rising cut and the cleave, each chained at its cancel,
  three hits.
- **Fixed: the dodge rolled the wrong way under the camera's movement.** A hero that runs where the stick points (the
  orbit camera's `move: 'camera'`) faces its run, so S held turned it toward the camera and the dodge read S as a
  backflip, away from the camera. Under world or camera movement the roll goes along the stick, the body turned to face
  it (`beginDodge`'s `moveH`).
