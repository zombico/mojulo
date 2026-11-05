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
- **Styles are a layer over the greybox: themes, fonts you own, and the world's guide.** A theme is closed words and
  colours (a frame, a corner, a plate, how the focus shows, motion, ornaments such as brackets, scanlines or a stitch,
  and the four colours it needs, the rest derived from them), written over the greybox without touching what a screen
  holds. A game brings its own fonts as their bytes, inlined, so a page still loads nothing. A theme's colours are
  measured for contrast and advised, never refused. A world's UI guide becomes a theme, its tint, dials, border and
  font shelf faces carried over, so a game's menus wear the look its world was directed in. The board switches between
  the themes over the same live screens.
- **Couch players each get their own detail panel, and a list and its detail are one move apart.** On a select screen,
  each seat's panel shows the fighter that seat is on; left and right cross between a list and its detail; a list's id
  belongs to its screen, so two screens can use the same idiom.
- **The live game in each kind of game, in the one style.** What shows during play is drawn by the same components, sheet
  and theme as the menus: a fight's mirrored bars with the chip of the last hit, rounds and clock, super meters and the
  combo; a race's place, laps, times and speedometer; a firefight's damage direction, off-screen markers, lock-on and
  ability bar; survival's hotbar and names over the world; strategy's resources, unit card, attack forecast and wave;
  a match's score bug and lower third; a cutscene's cinema bars and subtitles; a detection meter; quest words; a phone's
  touch controls. The menus that come up mid-play are screens laid out over the held game: a turn-based battle's
  commands, targets, turn order and party, a unit's actions beside its forecast, the scoreboard, a strategy game's
  orders. A test holds every component to the one style: its rule in the sheet, no colour of its own, and every colour
  it reads set by every theme, so a HUD can never drift into a second look.
- **A sport's menus and its broadcast are one production.** The broadcast covers the play (the bug, the calls, the
  closeups, the board); the menus around it (the title, the pause, the results) now take its look and its kits: a
  package becomes a menu theme, and a row, a table row or a badge with a side wears that side's kit, kept apart by the
  broadcast's own colour science. The screen after the results board reads the match's stats in the contest's own
  words, formats and leads, so it continues what the coverage showed (won or lost, the score by side, the head to head
  with each lead marked), instead of a generic "cleared". The parts the coverage already draws are flagged so a covered
  page never shows two score bugs, and a menu now holds the keyboard while it is up, so Enter on a pause never also
  serves the ball.
- **Selection that follows the player's hands, and screens made for a phone.** With keys or a pad the focus is a modern
  ring (a theme may lift it, fill it, make it glow or keep a console RPG's ▶). With a finger or a mouse there is no
  cursor: nothing shows selected until a tap, a tap does what it lands on (a row with a detail beside it is selected
  first), a slider follows the finger, a stepper's ends are their own targets, a toggle is a switch, a swipe turns a
  carousel or the tabs, and the HUD's pause, map and skills are taps. A touch screen's targets grow to 48 px, its long
  lists scroll whole, screens keep out of the notch and the home bar, a phone-width screen stacks its panes, and a
  phone's menus rise from the foot of the screen in reach of a thumb. The board shows phone-sized frames driven by touch.
- **The UI is driven by the game's control schemes, and says them back.** The screens read the same schemes as play
  (intents, never keys): the keyboard, every connected pad in its own printed layout (a second pad moving the second
  player's cursor), and any other device through a driver. A remap moves them too. Prompts and legends print the
  control in the player's hands ("Enter", "A", "✕", the B on a Nintendo pad's right) and switch as the player picks up
  another device; a touch screen shows none. The controls screen lists a scheme's real bindings with a clash marked,
  and a remap reports the conflicts it makes. The phone's drawn stick and buttons now drive the game as a gamepad's
  controls, so a phone plays through the same schemes as a pad.

