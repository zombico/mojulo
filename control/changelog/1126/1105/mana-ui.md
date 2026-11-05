### The interface department, and the game UI runtime every game will share

- **The studio has a seventh department: interface and UX.** A game's menus, its front (the title, the menu, the
  options, the credits) and its screen were the build's, so nothing owned how a game is worked by hand. The
  `interface` chapter now owns the recipe's `/front` and `/screen`, reads the intent, the world, the systems, the
  battles and the cast, and the build reads it. Its first work is the runtime below.
- **One runtime for game UI (internal name mana-ui), so a screen is built once and not game by game.** The UI was drawn
  by a dozen surfaces, each with its own sheet, colours and focus handling (the HUD, the menus, the RPG's battle and
  party menu, both game shells, versus, the hangar, the board games). `control/lib/mana-ui/` is the implementation
  playscape's words will run on: components with props passed down, three owners of state (the game's, read through
  bindings and never copied; the screen's own focus, tabs and stack; and the appearance drawn from both), a form that
  is a tree of data, and a function that is the cue effects playscape already speaks, emitted and never a callback. It
  ships as one closure through `toString()`, imports nothing outside its folder, and adds no byte to a page that does
  not use it. Nothing emits it yet: the library is built out in greybox first, then styled, and then the surfaces move
  onto it one at a time.
- **The library, in greybox: the components games are built from, and the screens they share.** Before any style and
  before any game runs on it, every part works and reads in values only (focus a shape, bar kinds told by their
  pattern, placeholders crossed boxes), so its structure, the data it reads and the effects it emits are settled
  first.
  - The components: layout (screens with a cursor per couch seat, splits, tabs fixed or from data, a row per item),
    values (bars with phase ticks, pips, counters, timers, compares as ▲ ▼), inputs (long lists that scroll, grids moved
    in two directions, skill trees laid in tiers by what each node requires, carousels, sliders, keybinds, a field
    chosen by data, points spent as a draft, a name typed from a grid), the in-game layer (the nine screen regions, and
    parts placed over things in the world), and the enemies' states (what one knows of you as a shape, its statuses).
  - The screens as compositions, each saying what it reads and emits: attract, title, loading, mode, character and
    arena select, pause, options, controls, confirm, results, save; the party, a skill tree, a level up, a loadout, the
    inventory, a shop, the quest log, a talk; and in game the vitals, objective, compass, minimap, ammo, score, a
    prompt, the feed, the crosshair, a moment, the party strip, plates over the enemies, a boss bar with its phases, a
    target frame and damage numbers.
  - A wireframe board draws every one of them live on one sample game, each a 1280×720 screen in its frame, driven by
    keys (a second seat beside the first) with the effects it emits written under it.
