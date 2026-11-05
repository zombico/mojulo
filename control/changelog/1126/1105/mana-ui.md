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
  not use it. Nothing emits it yet: the surfaces move onto it one at a time, the RPG's party menu first.
