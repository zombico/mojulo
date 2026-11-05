# mana-ui: the game UI library and runtime

mana-ui is an internal name. The agent and the person read plain words: `use`, `props`, `on`, an idiom's name.
The code lives in [control/lib/mana-ui/](../control/lib/mana-ui/), and it is the interface department's work
(`interface` in `gameworld/chapters.js`).

## Why it exists

Playscape (`control/lib/graph/playscape/ui/`) says what a game's UI is: the guide and its register, the parts, the
menus, the cues and the laws they are held to. Until now, each surface drew that UI its own way. The HUD, the
playscape menus, the RPG's battle and party menu, both game shells, versus, the hangar and the board games each had
their own sheet, colours, markup and keyboard and gamepad focus handling. mana-ui is the library and the one runtime
they move onto, so a screen is implemented once and not game by game.

It is built in two layers, in this order:

1. **The greybox:** every component and idiom working, in values only. The structure, the data each one reads and
   the effects it emits are settled first.
2. **The styles:** a theme laid over the greybox as a separate layer (`theme.js`, below). It sets the sheet's
   variables and adds a few rules of its own; it never reaches into the structure.

## The model: state, form and function, props passed down

This follows React's principles but uses none of its code.

- **A node** is data, the thing a recipe writes:
  `{ use: '<component | def>', id?, props?, on?: { <verb>: effect(s) }, children?, when?, unless? }`.
  `when` and `unless` draw a node only while a value or a binding is truthy or falsy.
- **Props flow down.** A prop is a literal or a binding, resolved at render:

  | binding | reads |
  |---|---|
  | `{ bind: '<path>' }` | the game's state, through the host; the path may itself be a binding (a row's var) |
  | `{ item: '<field>' }` | the row a list, grid, tree, anchor or page is drawing |
  | `{ pick: '<id>.<field>' }` | the row the list, grid, tree or carousel with that id has selected (its own screen's first, else the last screen that drew one) |
  | `{ pick: '<id>@<n>.<field>' }` | the row seat n is on (a detail panel per couch player); a pick path may be built from data, `{ pick: { format: 'roster@{seat}.name' } }` |
  | `{ format: 'Lv {level}' }` | the row's fields, as words |
  | `{ input: true }` | the value an input now holds (in a change's or a confirm's effects) |
  | `{ seat: true }` | the seat that pressed (couch play) |

  Props are typed closed words, and a bad one throws an error that names what exists.
- **Style is never a prop.** A node with `style`, `color`, `font`, `border`, `css` and the like throws (the menus'
  rule in playscape). The theme is context. A closed `variant` is all a node may say about its look.
- **State has three owners.**
  - The game's state (the bus, the store, the kernels) is read through bindings and never copied. A bound input asks
    the host to `set` its var and then shows what the host holds.
  - The screen's state belongs to the runtime: each seat's focus, the open tab, a list's selected row and scroll, and
    a draft (an allocation of points, a name being typed) until it is confirmed.
  - Appearance (`shown`, `focus`, `active`, `disabled`) is derived from those two and written as `data-st`.
- **Form is a tree of data:** `[tag, attrs, ...children]`. The DOM backend writes it as HTML, and another backend (a
  canvas, an engine's UI) can draw the same tree.
- **Function is effects, never callbacks**, because a recipe is JSON. These are the cue effects playscape already
  speaks. The runtime handles three itself: `{ open: '<screen>' }`, `{ close: true }` and `{ back: true }`. Every
  other effect goes to the host's `act(effect, from)`, with `from` naming the screen, the node, the verb and the seat.
  When the stack empties, the host hears `{ emit: 'mana:closed' }`.
- **No virtual DOM and no hooks.** A screen records what it read. A frame `tick()` re-renders only when one of those
  values has changed.
- **Components are code; compositions are data.** The components are a closed set (`COMPONENTS` in `kernel.js`, each
  with its group, props and verbs). A composition is a def, `{ params, node }`, with `{ param: '<name>' }` inside.

## Selection: keys, pads and touch

How the focus shows depends on what the player is using (`rt.input(mode)`; `mount` sets it from the last key or
pointer, and the root carries it as `data-input`).

- **Keys or a pad** move a cursor. The focus is a ring just inside the item's edge by default. A theme's `focus` word
  can make it a lift off the page, a fill, a glow, corner brackets, or the classic ▶ of a console RPG (the `console`
  preset keeps that).
- **A finger or a mouse** moves no cursor:
  - Nothing shows selected until the screen has been tapped; then what was tapped is selected (tinted).
  - A tap does what it lands on at once. A row with a detail beside it (a list or grid in a split) is selected on
    the first tap and done on the second.
  - A slider takes the value under the finger and follows a drag. A stepper's ◀ and ▶ ends are their own targets,
    and its middle does it. A toggle is a switch.
  - A swipe turns a carousel under it, or the screen's tabs.
  - A press sinks; a mouse hover lights.
  - A HUD's button or slot with `on.accept` is a tap that takes no focus (`rt.hudTap`): the pause, the map, a skill.
- **A touch screen** grows its targets to 48 px and draws a long list whole (it scrolls under the finger). Screens keep
  out of the notch and the home bar (the safe areas).
- **A narrow screen** (a phone: measured on the root, not the window) stacks its splits and lets its grids reflow.
- **A bottom sheet** (`place: 'sheet'`) is a phone's menu, risen from the foot of the screen in reach of a thumb, with
  its grabber. The `action-sheet` idiom is one; `phone-buttons` puts the pause and the map on taps.

## The components, by group

`COMPONENTS` is the list; this table only says what each group is for.

| group | for |
|---|---|
| layout | screens on the stack (`seats` > 1 gives each couch seat a cursor), windows, stacks, splits, tabs (fixed, or pages from data), `each` (a row per item that does not itself take focus), dividers |
| value | text in a type role, stats, bars (phase segments, the hatched chip of the last hit, filling from the right for a second fighter), pips, counters, timers, compares (better or worse as ▲ ▼), tables (your row marked), dials, action and hotbar slots (key, cooldown, count, the one in hand), and placeholders for icons, portraits and images, badges, button prompts |
| input | lists (a long one scrolls), grids (two directions), trees (tiers by what each node requires), carousels, buttons, toggles, cyclers, sliders, keybinds, a `field` that picks its input from data, an allocator (points spent as a draft), a text entry (typed from a grid, so a pad can type) |
| hud | the in-game layer: a `hud` of regions (the nine screen places) and layers: anchors (a part over each thing in the world at the screen x and y the game projects), edges (what is off screen, held at the edge with an arrow), a threat ring (where harm came from), the cinema bars; reticle, minimap, compass, feed, toast, banner, a phone's touch controls. A screen lays its own parts out in regions too, over the held game |
| enemy | an enemy's awareness as a shape (unaware –, suspicious ?, searching ??, alert !, combat !!, fleeing », down ✕) and its statuses |

Left and right cross between the panes of a split (a list and its detail), landing on the row the list has active.

## Themes: the style layer

A theme is closed words and colours, read and checked like a node, and written as CSS laid after the sheet. A node
still carries no look; the theme is context, set once for a game.

```js
theme: '<preset>' | { from?, tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?, scale?, case?, ornaments? }
```

- **Tokens** are colours: `ink`, `panel`, `line` and `accent` are the ones a theme needs. The rest (mid, soft, paper,
  wash, accent2, harm and the bar fills) are derived from them when left out.
- **Fonts you own:** `faces` are `{ family, src }` with the font's bytes as a `data:` URL, inlined as `@font-face`, so
  the page loads nothing. `type.body`, `type.display` and `type.mono` name a stack or one of those families.
- **The look in words:** `frame`, `corner`, `plate`, `focus` (marker, fill, glow, bracket), `motion`, `fills` (pattern
  or solid), `scale`, `case`, and `ornaments` drawn on the windows (brackets, ticks, scanlines, dotgrid, stitch,
  hazard, glow). `THEME_WORDS` lists each set.
- **Presets** (`THEMES`): the greybox (the default) and a few starting looks. `{ from: '<preset>', … }` changes one.
- **Measured, never refused:** `themeAdvice` gives the WCAG contrast of text, labels, the focus, a window's edge and
  harm against a window. Solid fills are advised to keep their labels (they tell bar kinds apart by colour alone).

**The world's guide as a theme.** `playscape/ui/mana-theme.js` (outside the folder; it imports mana-ui, never the
other way) maps a world's UI guide onto a theme:

- the tokens and the face
- the register's dials: frame, plate, motion, and the stop's corner and case
- a border flavor's elements: ornaments, or the words they mean (a soft corner, a cut one, a double rule, a gradient
  plate, a bracket or glowing focus)
- the font shelf's faces, inlined as the theme's own

So a game's menus wear the look its world was directed in.

## Idioms

The screens and HUD parts games share, as defs. Each one says what it reads, what it emits, and an `example` bound
into the sample state (`samples.js`).

- `idioms-front.js` — the front and the menus: attract, title, loading, mode select, character select (couch seats),
  arena select, pause, options (sections of fields), controls (keybinds; accept asks the host to capture), confirm,
  results, save slots.
- `idioms-rpg.js` — the deep menus, each a list or grid beside the detail of what it has picked: party, skill tree,
  level up, loadout (candidates compared with what they replace, under a weight budget), inventory, shop, quest log,
  dialogue.
- `idioms-hud.js` — in game: vitals, objective, compass, minimap, ammo, score and timer, an interact prompt, the event
  feed, the crosshair, a moment banner, the party strip; and for enemies, plates over each one, a boss bar with its
  phases, a target frame, damage numbers.

A game's HUD is a `hud` holding the HUD idioms it uses. A screen idiom is used as a screen of the spec.

### The live game

`idioms-live.js` covers what shows during play in each kind of game:

- a fight: mirrored bars with the chip of the last hit, rounds, the clock; super meters; a combo count
- a race: place, lap and times; a speedometer
- a firefight: where harm came from, what is off screen, lock-on brackets, the ability bar
- survival: the hotbar, names over things in the world
- strategy: resources, the unit in focus, an attack's forecast, a defence's wave
- a match: the score bug, a lower third
- a cutscene: the cinema bars, subtitles
- stealth: a detection meter
- quests: passing quest words
- a phone: touch controls

It also has the menus that come up mid-play: a turn-based battle's commands, targets, turn order and party; a
unit's actions beside its forecast; the scoreboard held open; a strategy game's orders.

### One style for a game

The live game is drawn by the same components, the same sheet and the same theme as the menus. A HUD never gets a
second look of its own. `style-rules.test.js` holds every component to that:

- every component has its rule in the sheet
- the sheet's rules carry no colour of their own (every colour is a variable)
- every variable the sheet reads has its greybox value
- a theme sets every colour the sheet reads (the cinema bars' black is the one fixed value)

A part that is its own frame (the aim, a moment's banner, a phone's controls) sits bare over the world. The aim keeps
a halo in the panel's colour so it reads over any scene.

## Sports and the broadcast

A sport's page is covered by the broadcast (`docs/broadcast.md`): its title card, score bug, call plates, lower
thirds, closeups, stats panels and results board, drawn over the arena. The broadcast owns the coverage; mana-ui owns
the menus around the play (the title, the team select, the pause, the results after the board).

- **No double coverage.** The idioms the broadcast already draws on a covered page (the score bug, the lower third, the
  moment banner) are flagged `coverage`. `coverageOverlap(spec)` names any a spec's HUD asks for, so a host whose page
  the broadcast covers can advise against them.
- **One production.** `broadcast/broadcast-mana.js manaThemeOfBroadcast(data)` makes the package a theme:
  - the glass, the ink, the rim and the accent metal become the tokens
  - the face, caps, radius, slant, ease and grain become the words
  - the coverage's kits, already kept apart by the package's colour science, become the theme's sides
- **Sides.** `theme.sides` are the kits of the sides (`--mana-side-0..7`). A row, a table row or a badge whose data
  carries `side` draws a chip in that kit; its name still says whose it is.
- **The results, handed on by data.** The arena's OUTCOME carries its stats compact. `contest/contest-results.js
  contestResults(envelope, { names })` says them again with the contest's own words, formats and leads, and the
  `match-results` idiom shows them: won or lost, the score by side, the head to head with each row's lead marked ▲.
- **The menu holds the input.** `mount` takes keys in the capture phase while a screen is up and sets
  `window.__mojMenuOpen`, so a game listening on the window (every arena does) never acts on a menu's key.

## The wireframe board

`manaUiBoard()` (`board.js`) draws every idiom live on the sample state. Each one is a 1280×720 screen scaled into a
frame, and the effects each frame emits are logged under it. A switcher lays each theme over the same frames and shows
its advice. Click a frame to drive it:

- arrows or WASD, Enter, Escape, and `[` `]` to turn tabs
- a second seat on I J K L, with U to pick and O for back

It is one self-contained page, and it is the eyes gate's view of the library.

## The host contract

```js
const rt = manaUi.runtime({ screens: { pause: node, … }, hud?, defs?, start? }, {
  read: (path) => value,        // the game's state: bus vars, store slices, a kernel's query
  act: (effect, from) => {},    // every effect but open / close / back
});
rt.press('down' | 'up' | 'left' | 'right' | 'accept' | 'back' | 'tabNext' | 'tabPrev', seat?);
rt.open(id); rt.tick(); rt.view(); rt.state();
manaUi.mount(el, rt, { auto: true });   // the DOM backend: keys, pointer, a frame loop
```

The actions are the controls kernel's `menu` scheme. `window.__manaUi` is the runtime on a page, for tests and the
audit. `manaUiPage(spec, { state })` is a self-contained page over a plain state object.

## Disciplines

- **Self-contained.** `buildManaUi()` references nothing outside itself, so a page runs `manaUiSource()`, as it does
  the controls and RPG kernels. A page that uses no mana-ui carries no byte of it.
- **Bounded.** The folder imports nothing outside itself (`boundary.test.js`). This lets an engine backend read the
  same spec, and lets the folder become a package of its own once a second consumer exists.
- **Deterministic.** There is no clock, no dice and no DOM until `mount`. The same spec and state give the same HTML.
- **Values first.** The greybox has no colour. Focus is a shape (a ring, or the theme's lift, brackets or ▶) and the
  active row a tint with a bar at its edge. Bar variants differ by pattern, and a low bar on what can run out is cross-hatched. Placeholders are crossed
  boxes.
- **Tests.** Each concept is tested once (`kernel.test.js`). The sweep over every idiom (`idioms.deep.test.js`) checks
  that each draws on the sample state, a screen can be moved through and left (one that waits, a loading screen, has
  nothing to press until it is ready), and a HUD part takes no focus.

## What is next

1. The integration, one surface at a time, each step either drawing the same bytes or naming the change it makes to
   what a page emits: the RPG channel's menus through a bridge from its kernel, playscape's menu kinds, both shells'
   fronts, the versus pause.
2. The engine handoff: the same spec as Unity UI Toolkit (UXML and USS), then a Godot theme and scenes.
