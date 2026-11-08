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
