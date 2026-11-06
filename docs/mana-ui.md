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

## Controls: mana-ui is a view, the controls layer drives it

A page has one input paradigm, and it is not mana-ui's. The controls layer (`control/lib/graph/controls/`) owns the
devices:

- the schemes (intents, never keys)
- the device families and their drivers (keyboard codes, the W3C standard gamepad in three printed layouts, WebXR, the
  virtual touch pad `controllable/touch.js`)
- the seats kernel, which says which controller is which player

mana-ui names no key, polls no pad and seats no player; `boundary.test.js` holds the kernel to that. Its runtime takes
intents:

- `rt.press(action, seat)`: what to do, and for which seat
- `rt.input(mode, layout)`: the device in hand, for the focus style and the glyphs
- `rt.glyphs(table)`: what each control is called

Its mount is a view: it draws, holds the page while a screen is up (`window.__mojMenuOpen`), and hit-tests its own
widgets under a pointer (only the view knows where they are).

- **The host.** `controls/mana-host.js connect(rt, view, { ...manaControls(), seatOf })` is the page's input owner
  driving the UI:
  - While a screen is up, it takes the keys the menu scheme knows in the capture phase (play never sees them).
  - It reads every pad once a frame on its press edges, in its own printed layout, the seat from `seatOf` (the seats
    kernel's answer on a couch page).
  - It reads any other device through a driver.
  - With no screen up, it takes nothing; it only tells the runtime which device is in hand, so the HUD's prompts follow.
- **The schemes in.** `controls/mana-controls.js manaControls()` resolves the menu scheme (the pilot's interact
  accepting too) onto the keyboard and each pad layout, in the shape the playscape menus read. A remap is the kernel's
  override.
- **The keyboard's sane defaults.** Each menu action has two remappable slots (arrows or W A S D, Enter or Space, Esc or
  Backspace, `[` `]`). Past them, the scheme's `also` carries the keys a player reaches for anyway: the keypad (8 4 6 2
  move, 5 and its Enter accept, 0 backs out, + and − turn the tabs), Tab and Shift+Tab to move down and up, and Page
  Down and Page Up to turn the tabs. They are never remapped or listed, and a slot's binding on the same key wins. The
  host repeats a held key only for a move (never a pick or a back) and leaves a chord (Ctrl, Alt, Meta) to the browser.
- **Typing.** With a text entry in the keyboard's focus, the host types into it: a letter types (W does not move),
  Backspace and Delete erase, Enter is done, and the arrows, Esc and Tab still move and back out. A pad still types
  from the grid. The runtime takes text, never keys: `rt.typing(seat)`, `rt.type(text, seat)` (the entry's charset and
  max kept, lower case read as capitals), `rt.erase(seat)`, `rt.submit(seat)`.
- **The glyphs out.**
  - `manaGlyphs()` gives each action's control per family and layout. A `prompt` and a `legend` print the one in hand
    ("Enter", "A", "✕"), switching as the player picks up another device; a touch screen draws no legend.
  - `controlsRows(scheme)` lists a scheme on the controls screen as the kernel labels it, a clash marked.
  - `remap()` returns the conflicts it makes (advised, never refused).
- **The drawn touch pad** is a look only: its buttons are named by the gamepad controls they are (`data-control`). The
  virtual pad's driver is the controls layer's.
- **Previews** (the board, `manaUiPage`) take the host as `host: { source: manaHostSource(), controls }`. Without one,
  they drive their frames with `PREVIEW_KEYS` and `previewKey`, a stand-in in the preview's own script (the same keys,
  held to the scheme by a test, and the same typing), never in the kernel.

## The components, by group

`COMPONENTS` is the list; this table only says what each group is for.

| group | for |
|---|---|
| layout | screens on the stack (`seats` > 1 gives each couch seat a cursor), windows, stacks, splits, tabs (fixed, or pages from data), `each` (a row per item that does not itself take focus), dividers |
| value | text in a type role, stats, bars (phase segments, the hatched chip of the last hit, filling from the right for a second fighter, or without their numbers), pips, counters, timers, compares (better or worse as ▲ ▼), tables (your row marked), dials, action and hotbar slots (key, cooldown, count, the one in hand), and placeholders for icons, portraits and images, badges, button prompts |
| input | lists (a long one scrolls), grids (two directions), trees (tiers by what each node requires), carousels, buttons, toggles, cyclers, sliders, keybinds, a `field` that picks its input from data, an allocator (points spent as a draft), a text entry (typed from a grid, so a pad can type) |
| hud | the in-game layer: a `hud` of regions (the nine screen places, a place that may be bound) and layers: anchors (a part over each thing in the world at the screen x and y the game projects; a row with an id is its own element, and `pass` rows rise and fade once: damage numbers), edges (what is off screen, held at the edge with an arrow), a threat ring (where harm came from), the cinema bars; reticle, minimap, compass, feed, toast, banner, a phone's touch controls. A screen lays its own parts out in regions too, over the held game |
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

## Motion that means something

Motion here says what changed, once. It is taken from the broadcast, where a score that rises pops and a results
board enters row by row.

- **A value that changed** (a stat, a counter, a bar's number, a badge, a table's cell, a numeral) is marked `data-ch`
  up, down or new, with a new `data-key` each time. It flashes in the second accent (up) or the harm (down) and pops;
  a stat, a counter and a badge float their gain off ("+3"). Nothing is marked on the first draw: what was there when
  a screen opened is not news.
- **A row** of a list, a grid or a table whose `id` was not there before is `data-fresh`, and a ring opens on it once.
  A row the game marks `last: true` (the last move, the tile just laid) rings once and keeps a dotted edge. A row or a
  badge marked `turn: true` is the side whose turn it is: a thick bar at its edge in its side's colour, breathing.
- **Entrances:** a screen fades in, its windows and rows rise staggered, a moment's banner slams with a sheen, a toast
  slides in.
- **One moment at a time** (`moments`, the broadcast's rule): rows `{ id, text, sub?, weight }` the game appends; a
  weightier one takes the screen at once, an equal one once the one up has been read (`read` seconds), a lighter one
  waits its turn, and each stays `hold` seconds. It runs on the game's clock (`host.now`), so a pause holds it. With
  no clock it shows the weightiest the game still lists. `moment-banner` and `quest-toasts` are built on it.
- **How it moves is the theme's** `motion` word (`MOTIONS` in `theme.js`): none fades and travels nowhere (the
  greybox), ease glides, snap overshoots, stepped moves in frames. Every distance, scale and delay is a variable.
- **Less motion:** `prefers-reduced-motion`, or `rt.reduceMotion(true)` from the game's options, zeroes the travel and
  keeps the fades; the turn's bar stays and stops breathing. `rt.hold(true)` (a hit-stop, the game's clock held) holds
  the HUD's motion while a menu keeps its own.
- **The view patches, never replaces.** `mount` patches the DOM by position: an element lives on while its tag and its
  `data-key` hold, so a bar's width glides and an entrance plays once. A new `data-key` is a new element.
- **Keylines:** a side whose kit would sink into the panel (under 3:1, WCAG's bar for a part of the UI) is keylined
  in the ink, so a black team's chip still shows on dark glass.

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

- arrows, WASD or the keypad, Enter, Escape, and `[` `]` (or Page Up and Down) to turn tabs; letters type into a name
- a second seat on I J K L, with U to pick and O for back

It is one self-contained page, and it is the eyes gate's view of the library.

## The host contract

```js
const rt = manaUi.runtime({ screens: { pause: node, … }, hud?, defs?, start? }, {
  read: (path) => value,        // the game's state: bus vars, store slices, a kernel's query
  act: (effect, from) => {},    // every effect but open / close / back
  now: () => seconds,           // optional: the game's clock (moments are timed on it; held when the game is)
});
rt.hold(on); rt.reduceMotion(on);       // the game's clock held (the HUD's motion holds); the player's less-motion option
rt.press('down' | 'up' | 'left' | 'right' | 'accept' | 'back' | 'tabNext' | 'tabPrev', seat?);
rt.typing(seat?); rt.type(text, seat?); rt.erase(seat?); rt.submit(seat?);   // a text entry in focus, typed into
rt.open(id); rt.tick(); rt.view(); rt.state();   // state: the stack, the screen up, each seat's focus, the open tabs
manaUi.mount(el, rt, { auto: true });   // the DOM backend, a view: it patches what it drew, hit-tests a pointer, a frame loop
```

The actions are the controls kernel's `menu` scheme. `window.__manaUi` is the runtime on a page, for tests and the
audit. `manaUiPage(spec, { state })` is a self-contained page over a plain state object.

## Disciplines

- **Self-contained.** `buildManaUi()` references nothing outside itself, so a page runs `manaUiSource()`, as it does
  the controls and RPG kernels. A page that uses no mana-ui carries no byte of it.
- **Bounded.** The folder imports nothing outside itself (`boundary.test.js`). This lets an engine backend read the
  same spec, and lets the folder become a package of its own once a second consumer exists.
- **Deterministic.** There is no clock of its own, no dice and no DOM until `mount`. The same spec over the same states,
  in the same order, gives the same HTML (what changed is marked against what was drawn before; time is the host's).
- **Values first.** The greybox has no colour. Focus is a shape (a ring, or the theme's lift, brackets or ▶) and the
  active row a tint with a bar at its edge. Bar variants differ by pattern, and a low bar on what can run out is cross-hatched. Placeholders are crossed
  boxes.
- **Tests.** Each concept is tested once (`kernel.test.js`). The sweep over every idiom (`idioms.deep.test.js`) checks
  that each draws on the sample state, a screen can be moved through and left (one that waits, a loading screen, has
  nothing to press until it is ready), and a HUD part takes no focus.

## The surfaces on it

### The RPG's battles, party menu and shops

The first surface moved onto mana-ui. Its spec is `playscape/rpg/rpg-ui.js` (screens and a HUD of components, data
only), and the page's RPG channel (`scene/channels/rpg-channel.js`) is its host:

- **`read`** is a view model of the battle kernel's state, built once a frame (and again after a change the host made,
  or a screen mana-ui opened or left): `battle.*` (the heads, the numbers, the foes, the turn order, the message, the
  member's lists, the corners its boxes take), `party.*` and `shop.*`. Nothing in it is copied back: a row's id is all
  an effect carries.
- **`act`** answers the spec's effects (`{ emit: command | skill | item | target | undo | next | class | slot | equip |
  learn | deal }`) with the kernel's own calls, and says on the bus what came of them. The kernel still says yes or no.
- **The stack is the menu's depth:** `rpg-cmd`, then `rpg-skill` or `rpg-item`, then `rpg-target`, each one back from
  the last; `rpg-watch` while a round plays (accept skips ahead); `rpg-party` and `rpg-equip`; `rpg-shop`. The host
  opens the one the fight's phase calls for over nothing, so a new member starts at the top of its commands.
- **The target in focus is derived, never told:** each target row names the rows it marks (`aim: { <id>: true }`: its
  own, and the figure it stands on), and a head or a foe's row draws its marker
  `when: { pick: { format: 'targets.aim.{id}' } }`.
- **The look** is `rpgUiTheme(cfg)`: the world's UI guide lowered with the battles (`cfg.theme`, by `mana-theme.js`),
  the greybox until the guide is settled, the `console` preset without one. The channel's own CSS is the screen's
  flash, the window's jolt and the level's HUD stepping aside during a fight.
- **Input** is mana-host's (`connect(rt, view, manaControls())`, polled on the page's frame). The channel keeps P and a
  pad's select, which are play's bindings, not the menu's.

## In a headset

A WebXR session shows no DOM, so mana-ui reaches a headset as a picture of itself, never a second drawing of it:

- **The snapshot** (`snapshot.js`, page source like the kernel) copies a mounted view's elements and the sheet they were
  drawn under into an SVG image the browser renders (a `data:` URL: Chromium, the Quest's browser, lets a WebGL texture
  take it; Safari taints it, so a headset on Safari draws none of it). Whatever is moving is baked at the value it holds
  this instant (the Web Animations API names the animations, their keyframes the properties), so a snapshot each frame
  plays the screen's motion. Layout, theme, focus words, ornaments and pseudo-elements carry over because they are the
  same CSS drawn by the same engine.
- **The transfer gate** (`snapshot.chrome.test.js`, the e2e tier) holds a view's screenshot and its snapshot together,
  pixel by pixel: a settled screen in a theme that uses every feature of the sheet, a frame mid-motion, one box alone.
  They agree to within the half pixel a centred box is anti-aliased across; the view snapped without its theme fails it.
- **The panel** (`scene/channels/xr.js`, on a page with a headset and a mana-ui surface): every mounted view registers on
  the page (`window.__manaViews`: `{ root, rt, css, host }`); while one has a screen up, its snapshot is drawn on a panel
  at eye height ahead of the player, placed where they look as the screen opens and left there. It is drawn again when
  the view changes and at most thirty times a second while something on it moves.
- **The controllers are the view's game controllers**: the menu scheme's `xr` rows (either stick moves, A or the
  trigger accepts, B backs out, the grips turn the tabs) are read as a driver of the view's own input owner (mana-host
  `drive()`), so the presses, the seats and the legends are mana-ui's as with a pad, and `rt.input('xr')` makes the
  legends print the controller's buttons. While a screen is up the world, the walk and the turn hold. No laser pointer:
  a headset's menu is worked as a console's is.
- **The marks in the world**: an anchor row may say its point in the game's world (`world: [x, y, z]`, written as
  `data-world`). In a headset such anchors leave the panel and stand over their points instead: the view's anchors are
  laid out apart on one more snapshot (an atlas, the same sheet and motion), each a card square to the eye, as large to
  the eye as on the screen. The RPG's bars over the fighters and its damage numbers are drawn this way.

## What is next

1. The integration, one surface at a time, each step either drawing the same bytes or naming the change it makes to
   what a page emits: playscape's menu kinds, both shells' fronts, the versus pause.
2. The engine handoff: the same spec as Unity UI Toolkit (UXML and USS), then a Godot theme and scenes.
