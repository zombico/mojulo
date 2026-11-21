### The side map's HUD: Galaxy Boy read as an 8-bit action platformer

Galaxy Boy's side map level gets its own look and a HUD on mana-ui. Before, it showed the level page's generic HUD: a
lives box, the boss's name with its figures, a radar, a melee ring and a strip of key hints.

- **The `galaxy` look** (`playscape/ui/theme-cards/galaxy.json`, from `console`): navy plates with a square edge,
  energy in yellow and cyan, a boss's in red, a monospace face in capitals, stepped motion, screens that shutter. The
  platformer's rail writes it on a side map game (`SIDE_MAP_LOOK`); the mascot platformer keeps Hilltop.
- **The side map's HUD** (`gameworld/side-map/hud.js`, given as a side map level's `manaHud` when the game has a `ui`):
  - the hero's energy is a column of fine ticks at the top left, split into one block a life;
  - a special weapon's energy stands beside it in the weapon's tint, while the hero holds a gun with energy of its own
    (there are none yet: the column is ready for them);
  - the boss's column stands at the top right, opposite, once the boss is awake and near, and its name is said across the top;
  - READY flashes as the level starts and after a life is lost;
  - the keys show as key caps for the first seconds;
  - the radar and the melee ring are put away.
- **The HUD host** (`scene/channels/mana-hud.js`) takes a HUD's own `css` laid over the sheet, and feeds `sm.*` from
  the level's `lives` and `boss_<n>`, the held gun's energy and the boss's waking and distance.
