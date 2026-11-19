### Galaxy Boy's screens: energy, game over, the intro card, the start menu, the star chart

The side map gets its own screens, drawn in the galaxy look over the held level, and a hit now costs energy, not a
life.

- **Energy** (the lives mechanic's `energy`, opt-in): a hit takes `hit` ticks of `max`, and a life goes when they run
  out. With `down`, the hero is dropped to fall out of the frame, and the fall takes the life and brings them back.
  A side map's hero has 28 ticks and a hit takes 4 (`SIDE_ENERGY`, `SIDE_DOWN`). The mascot platformer keeps a life per
  hit.
- **Continues** (the lives mechanic's `continues`, opt-in): none left waits on the player. `continue` on the bus gives
  the lives back, and `giveup` fails the level. A side map level of a game with a `ui` turns it on.
- **The HUD:** the hero's column is the energy, and the lives show under READY when they change.
- **The intro card:** as a level with a boss starts, a band with the boss's name in its hue, its world, its tell and
  what it gives. Any button or three seconds, then READY.
- **The start menu** (Enter): the weapons in the order earned, the buster first and the slots not yet won locked, the
  energy columns and the lives. Accept equips a loadout's weapon.
- **GAME OVER:** the gate reached, then Continue (from that gate, the lives back, weapons kept) or Give up.
- **The HUD host** (`scene/channels/mana-hud.js`) opens a side map HUD's screens over the held level, drives them with
  the keys and the pad, and raises their choices on the level's bus.
- **The star chart** (a front idiom, `star-chart`): the levels screen drawn as worlds round a heart, laid on a 3 × 3
  grid so the stick goes where the eye does, and put on an orbit over a starfield by the shell's sheet. Places with no
  level are uncharted, and the core at the heart stays locked until every boss falls. A game's `ui.screens`
  (`SHELL_SCREENS`, read by the gameworld's `ui`, the runner and the game file) names a shell screen drawn another way.
- **A side map game's flow** (`sideMapFlow`): title, star chart, a world, its result, the chart again. Galaxy Boy's
  title sits on the same night.
