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

## The frame: a game's screen, never a page

A game's screen is one fixed frame over a moving scene, read from a desk or a sofa, so it is not laid out like a scrolling
document. The research behind this, set against the app and SaaS look, is [game-ui-research.md](game-ui-research.md).

- **One unit, the stage's.** The root is the stage (a size container). Every length is in units of 1px at a 1080p
  reference (`--mana-u`, the stage's height over 1080), so a screen keeps its proportions at any resolution and does not
  reflow. A phone (`distance: hand`) sizes in CSS px instead.
- **How far the player sits.** The theme's `distance` word (`DISTANCES` in `theme.js`): `desk` (the default), `couch`
  (everything ×26/18, the ratio of XAG 101's console and PC minimums at 1080p) or `hand`. Text never goes under a floor
  in CSS px, and the player's text size (`rt.textScale`, up to 2×) multiplies it.
- **Few type levels, big jumps** (`TYPE` in `css.js`): the floor (caption and label), the body a step over it, a title
  twice the body, a display near four times. A heading is the ink, never a small grey eyebrow; an input's own name is the
  body.
- **The title-safe frame.** A screen and the HUD's places sit 5% in from each side (`--mana-safe`, 90% title-safe), or
  the device's own inset when larger. A part over the world (a nameplate, a damage number) still sits where the game
  projects it.
- **Nothing over the world goes bare.** Text with no window behind it (a ghost window, a screen's own title, a stack laid
  straight on a screen, a banner) keeps a halo in the panel's colour, the theme's `halo` word (an outline by default; a
  glow, a hard shadow, a plate behind it, or none). The subtitles sit on their own plate, its opacity the player's
  (`rt.subtitlePlate`).
- **The legend is a bar.** What the buttons do here is pinned to the foot of the safe frame, right-aligned. A screen that
  names no `legend` gets one drawn from what it holds: select, change, tabs, and back where back leaves something (a
  modal, a screen over another, a back of its own). `legend: 'none'` draws none, and a finger needs none.
- **Key art behind.** An `image` with `ratio: 'backdrop'` fills the screen under everything it holds.

## Selection: keys, pads and touch

How the focus shows depends on what the player is using (`rt.input(mode)`; `mount` sets it from the last key or
pointer, and the root carries it as `data-input`).

- **Keys or a pad** move a cursor. The focus is the classic ▶ at the item's left by default (a shape, never a colour
  alone), with a small pop as it lands. A theme's `focus` word can make it a ring just inside the item's edge, a lift
  off the page, a fill, a glow, corner brackets, or a highlight bar.
- **Press start.** A screen with `press: 'any'` (the attract screen) takes any face or shoulder button as accept, and
  the effect carries the seat that pressed, so the player who binds is known. The d-pad still moves and back still
  leaves.
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
    kernel's answer on a couch page). A direction held repeats after a delay at a rate (`repeat: { delay, rate }`,
    estimates to tune by hand; `false` for none), as a held key does.
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
- **A held stick or d-pad repeats too.** A pad's move (and a driver's: a headset's sticks) repeats while held, after
  0.4 s and then every 0.1 s (`connect`'s `repeat: { delay, every }` in ms, or `false`), a pick or a back never. What
  was held as a screen opened neither acts nor repeats in it.
- **Typing.** With a text entry in the keyboard's focus, the host types into it: a letter types (W does not move),
  Backspace and Delete erase, Enter is done, and the arrows, Esc and Tab still move and back out. A pad still types
  from the grid. The runtime takes text, never keys: `rt.typing(seat)`, `rt.type(text, seat)` (the entry's charset and
  max kept, lower case read as capitals), `rt.erase(seat)`, `rt.submit(seat)`.
- **The keyboard on the screen.** A text entry with `charset: 'name'` is a name's whole keyboard, for a pad first: three
  pages of one size (capitals, small letters, marks and digits) under tabs, the shoulders turning them with the cursor
  kept on its key; Space, Delete, Done and, when the entry answers `cancel`, Cancel under the grid. On a pad, back erases
  what this visit typed (with nothing typed it backs out as ever); a keyboard keeps Esc for leaving and types any page's
  character in its own case. `min` holds Done back (a denied press) until the name is that long. The legend says the
  pages and the erase. The RPG's party menu names a member with it (Status, Rename: `rpg-name`), and the store's
  `rename` event carries the name to the next level. A game's own name screen, asked as a new game begins, is the play
  shell's (`naming`, docs/game-flow.md).
- **The glyphs out.**
  - `manaGlyphs()` gives each action's control per family and layout. A `prompt` and a `legend` print the one in hand
    ("Enter", "A", "✕"), switching as the player picks up another device; a touch screen draws no legend.
  - `controlsRows(scheme)` lists a scheme on the controls screen as the kernel labels it, a clash marked.
  - `remap()` returns the conflicts it makes (advised, never refused).
- **The drawn touch pad** is a look only: its buttons are named by the gamepad controls they are (`data-control`). The
  virtual pad's driver is the controls layer's (`scene/channels/controllable/touch.js`). On a level made for a screen
  whose HUD is mana-ui's, the HUD carries the pad at its foot and the driver draws nothing: it reads the thumbs, finds
  which pad a touch landed on from the view's own elements, and says what it knows each frame (`touch.on`, `lane`,
  `held`, `down`, `buttons`). The `touchpad` draws that: a stick risen where the thumb landed with its nub under it,
  a lane's stick as a bar, a pad pressed filled, `use` only while the figure stands where it is used. A game that
  moves on W A S D needs nothing of its own: the stick is the pad's left stick, read through the pilot scheme. A
  level with no mana-ui HUD, and a runner's or a course's swipes, keep the driver as it was.
  - A pad named for what it does (jump, fire, use) wears its pictogram inside its round, where the theme draws icons.
  - The pads fill from the screen's edge inward and from its foot up, so one pad is under the thumb.
  - The HUD's bottom corners stand over the pad while it is drawn; a region whose every part is gated off draws no
    empty plate.
  - A level's hint line says what the thumbs do while the pad is up, and its keys otherwise.
  - A game's own extra button is a level's HUD row, `events.hud: [{ press: '<event>', label, slot? }]` (bottom right
    unless it says). Tapped or clicked, it raises that event on the level's bus as a key bound to it would
    (`events.input` is its keyboard half); a cue or a rule that listens does the rest. The level's mana-ui HUD draws
    it as a `button` and its host carries the press to the bus; a level with the page's own HUD draws it there. A
    level with no such row carries none of it.
  - **A level made for a screen never asks for a key a thumb cannot press** (`game/screen-keys.js`). Every key it
    listens for that the pad has no control for gets a HUD button by itself, drawn only on a touch screen: the
    level's own key inputs (`events.inputs`), the journal (J), the library (L), the party menu (P). Pressed, the
    button is that key pressed (the same keydown), so no channel learns about touch. A key the level's HUD already
    has a button for is left to it; a level with no screen, or no such key, is as it was.
- **Previews** (the board, `manaUiPage`) take the host as `host: { source: manaHostSource(), controls }`. Without one,
  they drive their frames with `PREVIEW_KEYS` and `previewKey`, a stand-in in the preview's own script (the same keys,
  held to the scheme by a test, and the same typing), never in the kernel.

## The components, by group

`COMPONENTS` is the list; this table only says what each group is for.

| group | for |
|---|---|
| layout | screens on the stack (`seats` > 1 gives each couch seat a cursor), windows, stacks, splits, tabs (fixed, or pages from data), `each` (a row per item that does not itself take focus), dividers |
| value | text in a type role, stats, bars (phase segments, the hatched chip of the last hit, filling from the right for a second fighter, or without their numbers), pips, counters, timers, compares (better or worse as ▲ ▼), tables (your row marked), dials, action and hotbar slots (key, cooldown, count, the one in hand), and placeholders for icons, portraits and images, badges, button prompts; a card (its face, its state as a shape, its back), a log (kept whole, shown from its end), a small series as bars, a magazine (the gun's wireframe over it, the rounds as the figure, the reserve its caption, a belt of the cartridges it feeds; low, empty and reloading said) |
| input | lists (a long one scrolls), grids (two directions), trees (tiers by what each node requires), carousels, buttons, toggles, cyclers, sliders, keybinds, a `field` that picks its input from data, an allocator (points spent as a draft), a text entry (typed from a grid, so a pad can type; `charset: 'name'` a paged keyboard with cancel and a minimum). A disabled button, slot, row or cell may say `why`: its reason shows under it while it has the focus or the pointer, and as it is pressed |
| hud | the in-game layer: a `hud` of regions (the nine screen places, a place that may be bound; a region bare, on a scrim, or at rest) and layers: anchors (a part over each thing in the world at the screen x and y the game projects; a row with an id is its own element, and `pass` rows rise and fade once: damage numbers), edges (what is off screen, held at the edge with an arrow), a threat ring (arcs where harm came from, fading), the peril (the screen's edge closing in as danger rises), the cinema bars; reticle, minimap (or a scope: a bezel, the wedge ahead, north), compass, feed, toast, banner, a phone's touch controls. A screen lays its own parts out in regions too, over the held game |
| enemy | an enemy's awareness as a shape (unaware –, suspicious ?, searching ??, alert !, combat !!, fleeing », down ✕) and its statuses |

Left and right cross between the panes of a split (a list and its detail), landing on the row the list has active.

## Themes: the style layer

A theme is closed words and colours, read and checked like a node, and written as CSS laid after the sheet. A node
still carries no look; the theme is context, set once for a game.

```js
theme: '<preset>' | { from?, tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?, scale?, case?, distance?, halo?, cues?, slant?, transition?, backdrop?, material?, backing?, crest?, breakout?, overlay?, stage?, sounds?, ornaments? }
```

- **Tokens** are colours: `ink`, `panel`, `line` and `accent` are the ones a theme needs. The rest (mid, soft, paper,
  wash, accent2, harm and the bar fills) are derived from them when left out.
- **Fonts you own:** `faces` are `{ family, src }` with the font's bytes as a `data:` URL, inlined as `@font-face`, so
  the page loads nothing. `type.body`, `type.display` and `type.mono` name a stack or one of those families.
- **The look in words:** `frame`, `corner`, `plate`, `focus` (marker, ring, lift, fill, glow, bracket, bar), `motion`,
  `fills` (pattern or solid), `scale`, `case`, `distance` (desk, couch, hand), `halo` (outline, glow, shadow, plate,
  none), `cues` (silent, ticks, full: the UI's sounds, below), `slant` (none, light, hard: tabs, bars, banners, keys
  and buttons lean, a window never does), `transition` (none, fade, blur, wipe, slam, iris, shutter, stepped: the cover
  between screens, below), `backdrop` (none, dim, blur, frost: what a pause does to what it covers), and `ornaments` drawn on the windows that have a plate (brackets, ticks, scanlines, dotgrid,
  stitch, hazard, glow). `THEME_WORDS` lists each set. A frame's weight reaches the inner parts too (a heavy frame's
  cells, keys and tracks are heavier), and a window inside a window is a sub-panel, lighter and less rounded.
- **Layers: a game's UI sits on a thing that sits on a thing.** Five words (`LAYER_WORDS`) build a window up in depth:
  - `material` (parchment, paper, grid, crt, halftone, metal, glass): the plate's surface, wherever a plate is (a
    window, a toast, a HUD part). Fibre and mottling are SVG noise drawn in the page from a fixed seed, so the same
    theme draws the same page; glass blurs the scene behind it.
  - `backing` (offset, stack, torn, plinth): what a window sits on. A slab offset in the accent; two slabs at an angle,
    the accent on the shade; a torn darker sheet; a riveted plinth.
  - `crest` (victorian, tech, ribbon): an ornament riding over a window's top edge; the window keeps room above it.
  - `breakout` (tab, echo, full): words breaking out of the box. A window's heading becomes a tab across its edge; a
    screen's title and a display's words are drawn again behind themselves, huge and hollow.
  - `overlay` (scanlines, crt, grid, vignette, grain): a filter over the whole stage while the UI is up, still (it never
    flickers).
  - `stage` (band, burst, shards, stripes, rings): one more layer, a shape behind everything a screen holds (over its
    scrim and its key art), sweeping in as the screen opens. The legend bar sits on its own band over it.

  Each window draws its layers under what it holds (`.mana-layers`: the plate, the backing, the crest; a ghost window has
  none). A theme with a backing or a crest moves the plate into them. A window sized by what it holds lets them past its
  box; one filling a pane keeps its clip, its layers past it only where the browser takes a clip margin (not Safari's).
  A sub-panel has no backing or crest of its own. Parchment's words are measured on the sheet it lays.
- **Presets:** the greybox (no layers), and `modern` (clean glass: a cool translucent plate, a light lean, a highlight
  bar, rings behind), `console` (brushed metal on a riveted plinth, a heading tab), `terminal` (a grid plate, a tech
  tab, a CRT over the stage), `storybook` (parchment on a torn sheet, a Victorian cresting, a vignette), `tactician` (a
  serious game's paper and ink, an offset sheet, hardwood sounds), `grim` (a dark fantasy's restraint: aged gold on
  black, a serif, nothing leans or slams, a vignette; its weight is the crypt's sounds), and the party family below. `THEME_FAMILIES` groups the presets by the language they share.
- **Room to read.** A screen's own window takes the room a game gives it (at least about a third of the stage's width),
  its rows are tall, a pause menu's rows are set at a title's size, and the body is a step over the floor.

### Restraint where the words are

A look has many ways to show itself, and all of them happen around the words, never under them. Readability comes first
wherever there is text to read. Every theme keeps these rules on its own; no word turns them off:

- **A loud frame and a quiet field.** A material's texture (a grid, halftone, CRT lines, parchment's fibre, brushed
  metal) shows whole at a window's rim and fades out before the words begin (`RIM`, a mask of the four edges). Under
  the words, and on every small plate that is all words (a toast, a HUD part, a prompt), the same texture runs at the
  reading amplitude (`FIELD`). Ornaments that pattern a window (scanlines, a dot grid) live at the rim too, and a
  sub-panel wears the quiet plate alone.
- **The filter covers the picture, never the words.** An overlay (scanlines, CRT, a grid, grain, a vignette) lies over
  the world, and over a screen's scrim, key art and stage, under everything the screen holds.
- **Words on a fill take the ink that reads.** On a filled focus, a heading tab, a learned node or the highlight bar's
  blend, the words take whichever of the ink and the panel reads on it. The advice measures what remains
  (`focus-reads`, `tab-reads`).
- **Words lean no further than an italic.** A hard slant leans the bars and a banner's display words all the way; tabs,
  keys, buttons and badges lean only as far as a light slant (`--mana-slant-words`).
- **The stage performs around the words, not under them.** Over a theme's stage, words with no window of their own (a
  ghost window such as a title's menu, a screen's own stack of rows, a bar and a caption such as a loading screen's)
  sit on a band of the panel that fades out past them, and a button standing on the screen itself is filled with the
  panel.
- **A picture gives way to the words.** In a pane that fills the screen, a picture shrinks to the room its words leave
  (never under a strip), so the words beside it are never pushed past the pane.
- **A plate thick enough to read through.** Glass is translucent, but thick enough under its words that a bright scene
  does not wash them out; a window with no plate (`plate: 'clear'`) keeps its words' halo.

Display words may still perform: a title can echo huge and hollow behind itself, break out of its box, lean all the way
and slam in. A menu's rows, labels, values and buttons stay plain.

**A title that enters letter by letter.** A text's `letters` (`rise`, `slam`, `wipe`, `track`; `none` the default)
draws its words a span a letter, each numbered so it enters after the one before, the whole read aloud as one word
(`aria-label`). The entrance runs on the theme's motion (its stagger, travel, pop, duration and ease), so a look with no
motion shows the words at once, and a calm reader (reduced motion, `data-motion=reduced`) sees them fade. Its sheet is
`lettersCss`, kept apart from the main sheet: only a surface that draws letters lays it (the play shell's title and
attract screens, the board), so no other page changes. A look says how its title enters with the theme word `title`
(`still | rise | slam | wipe | track`); a look that says none is read without it and its title rises (`titleLetters`).
The title screen's `bare` draws its menu as words with no window behind, for a start screen whose picture is its own
stage (the play shell's front stage, `game/front-stage-page.js`, where the stage draws the name behind its subjects and
mana-ui draws the menu).

### Theme cards: a look is data

A new look is a card, not code: one JSON file on the shelf (`control/lib/graph/playscape/ui/theme-cards/`), the way a
WordPress theme is a `theme.json`. A card is a **child theme**: `from` names a preset, another card or `world` (the
look the art director and the colour theorist give a game, below), and the card says only what it changes over it.
Its other keys are the theme's own words, its tokens, type and faces, plus `id` (the file's name), `name`, `about`,
`family`, `tags` and `author`. Every card is read when the shelf loads, its `from` chain followed and its words checked
by `readTheme`, so a card that loads is a theme that draws, and a bad one is refused with the words that exist.

`readTheme` takes a theme as a `from` too, so a child theme can stand on a card that stands on a preset. A game uses a
card by name (`ui: { theme: '<card>' }`), or writes the same words inline over it (`ui: { theme: { from: '<card>',
stage: 'band' } }`). The shelf's README is the authoring guide; `scripts/mana-board.mjs <out.html> --theme <card>`
draws every screen in it and `--cards` adds the shelf to the board's switcher.

### The interface's look in the studio

Styling a game's UI is the interface department's work (the interface chapter, `gameworld/chapters.js`), done with
the art director and the colour theorist. A gameworld's `ui` key (`playscape/ui/interface-look.js`) says it:

```js
ui: { theme?: 'world' | '<preset>' | '<card>' | { from?, …words }, colour?: 'world' | 'theme', languages?, language? }
```

- **The art director** starts the look from the register the game's intent sets (`INTENT_LOOKS`: a souls-like is
  grim, a tactics game the tactician's paper, a fighter arcade; console when none) and moves it as the juice register
  moves (an anime game's lively look snaps; a calm look keeps still). That is `theme: 'world'`, the default.
- **The colour theorist** colours it from the world's palette, solved (`style.palette`'s `ui`: ink, panel, line,
  accent, accent2). That is `colour: 'world'`, the default when the world has a palette; `theme` keeps the look's own
  colours (a casino, a broadcast).
- **The review** (`design_game`) shows a world with a `ui` the part `interface:look`: where the look and its colours
  came from, its words, its tokens, its languages and its advice (contrast measured, never refused). A world with no
  `ui` gains no part and changes nothing.
- The manual card `gameworld-interface` teaches the order of work, the registers, the families, the shelf's cards and
  the closed words.

The play shell's screens, the RPG's menus, the board-game pages, the strategy boards and the holo arena draw a game's
`ui` (the surfaces, below); the board is where a person looks at every part of it.

### The party language

The arcade preset's look, distilled so it can vary without losing itself. Its principles:

1. **Everything leans**, at one angle the whole screen shares (`slant`), never a window's contents.
2. **Planes stack.** A plate sits on a slab that sits on another, each a little off in place and angle (`backing:
   stack | offset | plinth`); depth comes from offset planes, never from a blur.
3. **Words break out of their boxes.** A heading is a tab across its window's edge; a title is echoed huge and hollow
   behind itself (`breakout`).
4. **Two colours punch against one neutral,** in flat blocks: the accent, the shade, the ink.
5. **Print texture, not soft light:** halftone, metal, scanlines (`material`, `overlay`).
6. **Hard edges:** cut corners, hard offset shadows.
7. **Motion slams:** an overshoot (`snap`) or frames (`stepped`), a cover that slams or wipes between screens, the
   focus snapping in from the way the cursor went.
8. **A shape behind it all** (`stage`): a band, a burst, shards, stripes.
9. **It sounds like it moves:** a snapped click under every note (`sounds`).

Its variations keep every principle and change the dials (the colours, the face, the angle, the texture, the stage,
the voice): `arcade` (magenta and cyan, halftone, a burst, chip sounds), `rebel` (red, black and white, a huge band
behind, two slabs, the party's sounds), `idol` (pink and cyan, rounded, a ribbon crest, a burst, glass sounds),
`street` (yellow and black, shards and grain, stepped, chip sounds) and `mecha` (orange and teal on metal, a riveted
plinth, a tech tab, stripes and a grid, hydraulic sounds) and `jackpot` (gold on purple, rounded, a ribbon crest, a
sunburst, the jackpot's coins and boom). A test holds every variation to the principles.

- **Presets** (`THEMES`): the greybox (the default) and a few starting looks. `{ from: '<preset>', … }` changes one.
- **Measured, never refused:** `themeAdvice` gives the WCAG contrast of text, labels, the focus, a window's edge and
  harm against a window. Solid fills are advised to keep their labels (they tell bar kinds apart by colour alone).

**The world's guide as a theme.** `playscape/ui/mana-theme.js` (outside the folder; it imports mana-ui, never the
other way) maps a world's UI guide onto a theme:

- the tokens and the face
- the register's dials: frame, plate, motion, sound (its `cues`: a cue on every state change, or none), and the stop's
  corner and case
- a border flavor's elements: ornaments, or the words they mean (a soft corner, a cut one, a double rule, a gradient
  plate, a bracket or glowing focus)
- the font shelf's faces, inlined as the theme's own
- the game's juice register, when the host passes it (`{ juice: 'anime' | 'western' }`): an anime game's menus snap
  where the dial would only ease, lean a little and slam between screens; a western one's wipe

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
  slides in. The focus pops as it lands, and a press-start prompt breathes (0.8 Hz, well under XAG 118's three flashes
  a second; still under the greybox and under less motion).
- **One moment at a time** (`moments`, the broadcast's rule): rows `{ id, text, sub?, weight }` the game appends; a
  weightier one takes the screen at once, an equal one once the one up has been read (`read` seconds), a lighter one
  waits its turn, and each stays `hold` seconds. It runs on the game's clock (`host.now`), so a pause holds it. With
  no clock it shows the weightiest the game still lists. `moment-banner` and `quest-toasts` are built on it.
- **How it moves is the theme's** `motion` word (`MOTIONS` in `theme.js`): none fades and travels nowhere (the
  greybox), ease glides, snap overshoots, stepped moves in frames. Every distance, scale and delay is a variable.
- **Appearing, leaving and shuffling** follow principles of their own (below).
- **The snap.** The item the cursor lands on snaps in from the way it went (the root's `data-nav`: from above when it
  moved down, from the left when it moved right), with the motion's overshoot, and the focus stands out by a nudge
  (`snap` and `nudge` in the motion words; nothing under the greybox or less motion). The cursor's sound says the way it
  went and a stepper's the step it took, so a sound set pitches them.
- **A press is seen.** Confirm squashes what was pressed, flashes it in the accent and throws a ring off it; pressing a
  disabled row shakes it on a harm edge (`data-press`: two names each, alternated, so a second press plays again; moving
  away clears it). A confirm that opens or closes a screen is still seen: the view marks the item on the screen as it
  leaves. Less flash keeps the ring and the shake, never the fill.
- **A pause veils what it covers.** A modal screen dims, blurs or frosts the world and the HUD behind it (the theme's
  `backdrop`), under its scrim, easing in with the screen: the world, its blur, the scrim, the stage, the window.
- **A cover between screens.** As a screen opens or leaves, a cover is drawn over the stage with a new key, and the
  theme's `transition` animates it across (a fade, a dip to black and back; a blur, the stage blurred through and back;
  a wipe, a diagonal slam, an iris, a shutter, a stepped wipe); leaving mirrors it. The greybox draws none, and less
  motion or less flash draws none.
- **Numbers count.** With a clock and `host.countUp` (seconds), a number that changed counts to its new value, eased
  out, its tick heard; a stat with `count` counts up from zero as it first shows, rows one after another. Accept on a
  screen still counting lands every number at once and does nothing else (a results board's skip). A count moves as
  the page calls `tick()` each frame (`mount`'s `auto`, the board's own loop).
- **The results in sequence:** the outcome slams in as a banner, the figures rise and count, the rank is stamped on.
- **Blows over the world:** damage numbers sit bare with the halo, a display numeral that pops in and rises, toned by
  its kind (`text`'s `tone`: hit, crit, heal, miss, block), a crit larger, the word still beside it.
- **Two tiers of passing words:** a feed merges a line said again (×3); a moment row's `tier: 'rare'` is held longer,
  wears the second accent and a sheen, and has its own sound; a row's `icon` shows beside it.
- **Less motion:** `prefers-reduced-motion`, or `rt.reduceMotion(true)` from the game's options, zeroes the travel and
  keeps the fades; the turn's bar stays and stops breathing. **Less flash** is the player's own, apart from it
  (`rt.reduceFlash(true)`): no cover between screens, no sheen, a change pops without flashing. Every animation that
  repeats breathes under three times a second (XAG 118), and only where the theme moves. `rt.hold(true)` (a hit-stop, the game's clock held) holds
  the HUD's motion while a menu keeps its own.
- **The view patches, never replaces.** `mount` patches the DOM by position: an element lives on while its tag and its
  `data-key` hold, so a bar's width glides and an entrance plays once. A new `data-key` is a new element.
- **Keylines:** a side whose kit would sink into the panel (under 3:1, WCAG's bar for a part of the UI) is keylined
  in the ink, so a black team's chip still shows on dark glass.

### Appearing, leaving and shuffling

Games choreograph what comes and goes; a page swaps it. The principles:

1. **Things arrive in an order: the frame builds, its rows fill it, the cursor lands.** A screen fades in, its windows
   rise, then after the motion's `lead` its rows rise in reading order, a `stagger` apart (capped, so a long list's tail
   lands together), and the focus lands last. The screen's own title slams in first.
2. **Things come from somewhere.** Every part of a screen arrives from the side the screen sits on (`--mana-enter`, set
   by its `place`): a left menu from the left, a right panel from the right, a sheet from below, a centred screen rising.
3. **Leaving is quicker than arriving, and never bounces.** An exit runs at about seven tenths of the entrance on the
   motion's `out` curve, which accelerates away (an overshoot is for arriving). A screen sinks back the way it rose, a
   toast slides out to its edge, a banner shrinks away. The view keeps what leaves (`data-leaving`) until its exit has
   played, out of the way of what is drawn next.
4. **Nothing teleports.** A row with an identity (its `id`, drawn as `data-id`) that changes place is glided from where
   it was to where it is, on the theme's `glide` and curve. A row that moved past others says which way, once
   (`data-moved`: a lift up, a dip down). A row that came in on top moves nothing past anything, so nothing is marked.
5. **Sound lands with the eye, and says the whole move once.** A screen opening is heard as it lands, and the page
   ripples a soft tick down its rows on the same lead and stagger (`open` with its `rows`, the `appear` ladder). Rows
   that came, went or moved are each heard once, however many (`appear`, `vanish`, `shuffle`, with their `count`). What
   leaves is quieter than what arrives, and a ripple is quieter than the cursor.
6. **Less motion keeps the order and drops the travel.** Under the greybox or less motion nothing travels or glides,
   but things still fade in and out in the same order.

## A game in several languages

A designer can ship a game in several languages, and the player picks one. The spec carries them:

```js
{ screens: { … }, languages: { en: { newGame: 'New game' }, ja: { newGame: 'ニューゲーム', back: '戻る' } }, language: 'en' }
rt.language('ja');   // a player's option (an options screen's language cycler): every word is said again in it
rt.languages();      // the codes the game ships
```

- A node names a word with `{ word: '<key>' }`, and a format with `{@key}` (`'{@lv} {level}'`). The key is the
  game's own (`newGame`) or one of the runtime's.
- The runtime's own words (a legend's Select and Back, a list's Nothing here, an idiom's Loading, Rank, Turn order)
  are one table, `WORDS` in `kernel.js`, in English. A game's language can say any of them over the English, and the
  idioms name every word they say this way (a test holds them to it, legends included), so a game's languages reach
  the shared screens too.
- A word the language lacks reads in English (the game's English, then the runtime's); a key no table holds reads as
  itself. A host can still say words over the game's (`host.words`, `manaUiPage(spec, { words })`).
- The game's languages are its own: they are not the dashboard's locale catalogs, and a game ships as many or as few
  as its designer writes.
- **The language picker.** The options screen draws a `language` row (a cycler) when the game ships two languages or
  more, and none when it ships one. It names each language in its own words: the language's `languageName` word, else
  a short table of autonyms (English, 日本語, Español…), else its code. Turning it says every word again in that
  language, plays the change cue and tells the game (`{ emit: 'language', to }`) so the game can keep the choice.

## Loading: the unglamorous rules

Every game relearns these, so the runtime keeps them. The `loader` component carries them, and the `loading-screen`
idiom composes it (the place, its key art, the loader, continue, and retry and the title on a failure). All of it runs on
the game's clock (`host.now`); a host keeps that clock running through a load, since a load is not a pause. Without a
clock, nothing is timed: tips do not turn and an auto load goes on at once.

- **The progress never goes back.** The bar shows the most the load has reported, so a step that starts over at zero
  never pulls it back. A game reports the whole load's progress and says what it is doing in `step`. A retry after a
  failure is a new attempt, and its bar starts again.
- **Progress not known is said, not guessed.** With no `progress` (null), the track runs a sweep and claims no
  number. Ready, the bar is whole whatever the game last reported.
- **Something always moves.** While it loads, an activity mark turns. It is a signal, not an ornament, so it moves in
  every theme, the greybox included. It turns by transform, so it keeps turning while the page's script is busy
  loading. Less motion breathes it instead.
- **A stall is spoken to.** Once nothing has moved for `stall` seconds (10), a line says it is still loading; it goes
  when the progress moves again. The line and the tip keep their room, so nothing jumps when they speak.
- **Tips turn.** One tip shows at a time, the next every `turn` seconds (8), and left and right turn them too (the
  legend says so). A `seed` mixes their order with no dice, each tip shown once before any comes again. A tip is read
  in a load, so keep it to a sentence.
- **A quick load never flashes; a slow one can be read.** With `auto`, a load that is ready within its `grace` (0.3 s)
  goes on at once, and its contents never show (only the cover is seen). One that took longer stays at least `least`
  seconds (1) before it goes on.
- **A press before the prompt is not an answer.** Without `auto`, Continue waits for the player, and a press in the
  first moment after it shows is dropped, so a button held or mashed through the load does not skip the screen.
  Ready is heard (`appear`).
- **A failure says so.** `error` puts the game's words in place of the progress, stops the mark, is heard (`deny`) and
  offers Retry and Quit to title (`retry`, `quit`).
- **Back has nothing to leave.** Back on a load does nothing and makes no sound, unless the game gives the load a way
  out (`cancel`).
- **It covers the stage.** A load's screen is the panel, so nothing half built shows through it. Its loader is a
  `progressbar` (busy while it loads, its percent and its step as values), and its spoken line is a polite live
  region.

## The UI's sounds

Sound is half of how a game's menu feels, and the web's is silent. mana-ui ships no audio and loads nothing: it emits
the sounds as effects, `{ sound: <cue> }` to the host's `act`, and the host plays them.

| cue | when |
|---|---|
| `move` | the cursor moved (or a long list scrolled under it) |
| `accept` | a pick was made |
| `back`, `close` | a screen was left, or the whole stack closed |
| `open` | a screen opened (not the one a runtime starts on) |
| `tab` | a tab turned |
| `change` | a value turned: a toggle, a stepper, a slider, a carousel, a point allocated |
| `deny` | a disabled row was pressed |
| `toast`, `rare` | a moment came up (a rare one) |
| `tick`, `skip` | a number counted (at most twenty a second), and a count was skipped |
| `appear`, `vanish`, `shuffle` | rows came into a list, went out of it, or moved past each other (`count`: how many) |

`host.cues` says which it wants: `silent` (the default) none, `ticks` the cursor's three (move, accept, back), `full`
every one. A theme's `cues` word says it for a game, and `manaUiPage` hands it to its host. A cursor's sound carries
the way it went (`way`), a stepper's the step it took (`step`).

**The sound library** (`control/lib/graph/beats/ui-sounds.js`) is what a page plays: beats-sfx gestures (the beats
tool's own, nothing new in its kernel), in sets (`UI_SOUND_SETS`): `glass`, `console`, `chip`, `terminal`, `paper`,
`party`, `robot` (a cheerful little machine's chirps), and the heavy ones, `hydraulic` (servos, pneumatic hiss, clamps landing), `clack` (hardwood blocks, a clapper's double clack on
confirm, for serious games), `crypt` (stone, iron and a toll, a dungeon door that creaks open and slams shut, for grim
and souls-like games) and `jackpot` (coin clinks counting, a brass stab on confirm, a riser into a boom, a fanfare and a
shower of coins on a rare one). Every set is built from one interval plan over its root, so the sets differ in timbre
and belong together in harmony; a heavy set says some cues in its own gestures, held to the same plan (confirm rises,
cancel falls, the cursor stays quiet):

| cue | the plan |
|---|---|
| `move` | a click and a high pip (an octave over the root); up a step higher |
| `change` | the stepper: a click and the fifth going up, the fourth going down |
| `accept` | confirm: the fifth rising to the octave, the loudest of the everyday sounds |
| `back` | cancel: the fifth falling to the root, softer than confirm |
| `tab`, `open`, `close` | a flick and a breath; the triad up; the triad down |
| `deny` | a low minor second, twice |
| `toast`, `rare` | a chime on the tenth; the octave's arpeggio and a bell over it |
| `tick`, `skip` | a count's quiet pip; a swept breath |
| `appear-1`…`5` | a row landing: a soft tick up a pentatonic ladder, rippled down a screen's rows as it opens |
| `vanish`, `shuffle` | the tick falling, softer; a breath and a run of quick clicks |

The sets are level-matched on confirm (measured on their rendered reels), and within a set what is pressed most is
heard least; a heavy set's big moments are let past confirm on purpose (the crypt's door, the jackpot's jackpot).
Where the recorded sound library is installed, a set's cues it records play the recordings over the set's own
gestures, on every page that plays the set ([sound-library.md](sound-library.md): a card's `ui` cues on its `uiSets`). A game's key transposes the pitched gestures (`tonic`). A theme's `sounds` word picks the set (the presets
each name one); `uiSoundAudio()` hands a page the beats kernel (only the features the sets need), the sets and the cue
picker, as `manaUiPage(spec, { audio })` or `manaUiBoard({ audio })` (this folder imports nothing outside itself, so
it is handed in). Each set is also a beats-sfx recipe (`uiSoundManifest`) that `create_beats` mints and the beats
player fires cue by cue.

**The board with its controls and its sounds:** `node scripts/mana-board.mjs <out.html> [--theme <preset>]` writes the
board driven by the controls layer (keys and pads, their glyphs), heard in the set the chosen look names. Click a
frame to drive it.

## Idioms

The screens and HUD parts games share, as defs. Each one says what it reads, what it emits, and an `example` bound
into the sample state (`samples.js`).

- `idioms-front.js` — the front and the menus: attract (key art behind, a press-start that takes any button), title
  (key art behind, the name and the menu in the left third, the version in a corner), loading, mode select, a choice
  before a level (`pick-screen`: what is asked and how far along, what was chosen before, a list or a grid of faces
  beside the one in focus; the play shell's turn draws its picks with it, [game-flow.md](game-flow.md)), character select (couch seats),
  arena select, pause, options (sections of fields), controls (keybinds; accept asks the host to capture), confirm,
  results (in sequence: the outcome slams in, the figures count, the rank is stamped), save slots.
- `idioms-rpg.js` — the deep menus, each a list or grid beside the detail of what it has picked: party, skill tree,
  level up, loadout (candidates compared with what they replace, under a weight budget), inventory, shop, quest log,
  dialogue.
- `idioms-hud.js` — in game: vitals, objective, compass, minimap, ammo, score and timer, an interact prompt, the event
  feed, the crosshair, a moment banner, the party strip; and for enemies, plates over each one, a boss bar with its
  phases, a target frame, damage numbers.

A game's HUD is a `hud` holding the HUD idioms it uses. A screen idiom is used as a screen of the spec.

- `idioms-table.js` — a board game's own language (below): the seats, the hand, a row of cards, the prompt and its
  actions, the log; one question at a time, an offer across the table; the places at the end.
- `idioms-fight.js` — a fighting game's own language (below): the top frame, the meters, a side's combo and callouts, the
  announcer, training's readouts; the face-off, fighter select, the fight's pause, the command list, training's settings,
  the match's results.
- `idioms-talk.js` — people talking, as presenters a host feeds (below, "A level's scenes"): the talk box, with the
  speaker's nameplate, a place for a face, the line typed on, ▼ once it is whole, the answers numbered with the one in
  hand marked, and the legend.

### The live game

`idioms-live.js` covers what shows during play in each kind of game:

- `idioms-campaign.js` — an action campaign of missions: the place banner (a mission's place widest first: "Kessa
  System | Varn Cluster | Vigil Station | Moon IV"), the flight roster, the briefing told one step at a time over a map
  the game draws behind it (`briefing-steps`), the tour of duty and the debrief. Its first client is the holo briefing
  (`control/lib/graph/campaign/briefing-page.js`).
- a fight: mirrored bars with the chip of the last hit, rounds, the clock; super meters; a combo count
- a race: place, lap and times; a speedometer
- a firefight: where harm came from, what is off screen, lock-on brackets, the ability bar; a shooter's own readouts
  (the weapon, the health, the order, the radar, the peril edge), drawn as below ("A HUD that reads as a game")
- survival: the hotbar, names over things in the world
- strategy: resources, the unit in focus, an attack's forecast, a defence's wave
- a match: the score bug, a lower third
- a cutscene: the cinema bars, subtitles
- stealth: a detection meter
- quests: passing quest words; an achievement unlocked (a rare one held longer)
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

## A HUD that reads as a game

A HUD can track every value a game has and still read as an app: a box per readout, a label beside every number, a
checklist, a map in a square frame. A modern shooter's HUD (the Halo, Call of Duty, Apex, Destiny and Battlefield lines)
shows much the same values, but each one is shaped like what it measures, and it speaks only when something matters.
These principles make a HUD evocative rather than a state tracker. Every theme keeps them; the theme decides the look,
not whether a principle holds.

1. **The shape is the label.** Health is a long bar and needs no "HP"; the magazine is a number by the gun and needs no
   "Ammo". A label is for a value whose shape does not say what it is. Health is read by its length, cut into cells so
   a loss reads as a chunk (`health-strip`: `segments`, `figures: false`).
2. **One figure leads each readout.** The value acted on now is drawn as a display numeral; the value behind it is a
   caption. A magazine's rounds are large and the reserve is small beside them; a clock's seconds are the figure.
   Never two values at one size side by side, as a table would draw them (`magazine`).
3. **Count what can be seen.** A thing the player spends one at a time is drawn one at a time, as the thing it is:
   the rounds in a magazine as a belt of cartridges that empties toward the edge it sits by (a rifle's bottle-necked
   round, a pistol's short one, a shotgun's shell, a rocket; a spent one its empty outline), hearts, grenades, charges.
   Past what the eye can count (a drum of a hundred rounds) it becomes one track.
4. **A picture before a word.** What the player holds is drawn before it is named: the gun in hand as a wireframe of
   its side, so a rifle, a shotgun and a pistol are told apart at a glance and the name is only confirmation
   (`magazine`'s `gun`, else its name; `guns.js`).
5. **No boxes over the world.** A readout over play sits on the world. It is either bare with a halo, or on a scrim: a
   shade behind it that fades out before any edge can show (`region` `variant: 'bare' | 'scrim'`). A plate with a
   border is for a menu, not for a corner of the screen during a fight.
6. **The corners have jobs.** The player is at the bottom left (health), the player's gun is at the bottom right, where
   the player is and what is near is at the top left (the radar), and what to do now is at the top. The centre is the
   aim's, and it stays open except for marks about the aim itself (hits, the damage ring).
7. **It speaks when something changes.** A readout that holds no news (a full magazine, full health) fades back, and
   the moment it changes it comes forward (`region` `rest`, a binding the game sets). Firing is not news: a shot kicks
   the figure and does not flash it. A loss or a low value is news.
8. **Urgency is shown, not reported.** Low ammunition turns the figure and the belt to harm and says so ("Low ammo",
   "Reload", "Reloading"). Low health closes the screen's own edge in, tinted, and near the end the edge beats slowly
   (`peril`; under three times a second, still under less motion or less flash). The player feels it before reading a
   number.
9. **An order, not a checklist.** The objective is one line with a mark: what to do now, which of how many, and how
   far (metres to a place, or the foes still standing). A held place drains its clock under it. The full list of tasks
   belongs to the pause, the map and the briefing (`objective-order`).
10. **The map is an instrument.** A radar is round and centred on the player, with ahead at the top, so it turns as
    the player turns. It has a bezel of ticks, the wedge the player sees, north riding the bezel, and a face that fades
    into the world. It is never a picture in a square frame (`minimap` `scope`, `north`; `radar-scope`). A game may
    ask for its scope square and larger, a tactical espionage radar's, still centred, turning and translucent; and
    for one floor's alone: the plan and the guards of the floor or deck the player stands on, a level of storeys
    read one at a time. The world's `ui.radar: { shape: 'square', size: 'large', floor: true }` (game/hud-mana.js
    `RADAR_LOOK`; the plan of a floor, gameworld/radar.js `floorPlanSvg`).
11. **Harm says where it came from.** A hit marks an arc of a ring round the aim at the attacker's bearing. The arc
    tapers at its ends, fades as it ages, and follows the attacker while it stands (`threat`, a mark's `fade`).
12. **Geometry carries the genre.** Cut corners, a lean shared by bars and belts, tick marks, a mark before an order,
    a fire mode in a small keyed box. These come from the theme's closed words (`slant`, `corner`, `frame`), never from a
    node.
13. **Readable first, still.** Every principle above sits around the words (restraint, above). A figure keeps its halo,
    a harm colour keeps its contrast against the scrim, and nothing that repeats breathes faster than three times a
    second.

How a shooter's parts are drawn now:

| a modern shooter shows | an app-like HUD draws | mana-ui draws |
|---|---|---|
| the gun's silhouette, the magazine's rounds large, the reserve small, a belt of cartridges, "reload" said when empty | "Ammo 23/90" in a box | `weapon-readout`: `magazine` on a scrim (the gun's wireframe, its rounds as the cartridges it feeds), resting while full |
| health as a long bar in cells, no number | "HP ▓▓▓░ 74/100" in a box | `health-strip`: a large bar in cells, `figures: false`, on a scrim |
| low health as a red, beating screen edge | a hatched bar | `peril-edge`: `peril`, its level from the health's share |
| one order with a mark and a distance | a checklist of every step | `objective-order`; the checklist moves to the map screen |
| a round radar that turns with the player, a view wedge, north on the bezel | a square map | `radar-scope`: `minimap` `scope`, `north` |
| tapered arcs round the aim that fade | a triangle on a dashed circle | `threat`, each arc turned to its bearing, `fade` its age |

The first mission draws all of these (below). The idioms are on the `live` shelf, and the board's shooter HUD lays them
out together.

Not yet drawn, and next on this road (the UI only):

- a compass strip with the objective's bearing and distance, beside the radar
- a waypoint over the objective in the world (a mark and its metres; an `anchors` row, the game projecting it)
- the kill confirm at the aim (a skull, a ring) and a kill feed of icons, not lines of words
- the equipment (grenades, a melee charge) as counted slots beside the gun
- a pickup said where it was taken ("+30 rounds" rising off the belt)

### A cinematic action game: its HUD, its item select and its pause

A cinematic action game (the genre's slow motion on a dodge, a hero fighting through set pieces) holds to the same
principles on its three surfaces. Each is drawn by mana-ui in the game's look, in place of what the level page drew on
its own.

- **The HUD** (the level's rows lowered by `game/hud-mana.js`, hosted by `scene/channels/mana-hud.js`):
  - **The pilot, bottom left.** The health is one strip in cells with no label and no number. A level row that is the
    health is folded into it, so the screen shows one health (its max is the highest the row has stood). The sprint is
    a thin bar under it, and the strip rests while the health is full.
  - **The slow motion.** Beside the strip, a charge (`charge`, the `bullet-time` idiom) is a ring round an hourglass.
    It fills while the moment comes back, glows when it is ready with what sets it off said beside it ("Dodge"), and
    drains while the world crawls.
  - **The rest.** The gun in hand sits bottom right (`magazine`: its wireframe, its rounds as cartridges). The page's
    radar becomes a scope at the top right, its damage ring becomes arcs, and the screen's edge closes in under half
    health. Every other row is bare or on a scrim, never boxed.
  - Each part stands only where the page has the thing; the page's own versions are put away.
- **The item select** (`wheel`, the `item-wheel` idiom): held open on RB, what is carried lies round a ring at the face
  button that picks it (Y at the top, B right, A at the foot, X left), as the pad's own diamond. Each slot is drawn as
  its wireframe with its name, its button in the pad's own print and its rounds. The one in hand is lit and named large
  in the middle, over a shade with no box, the world showing through. It takes no focus: the level's own buttons pick,
  and the page says what it shows through `window.__mojWc.view()`.
- **The pause** (`pause-menu`, as every game's pause now is): the world is veiled behind (the theme's backdrop), PAUSED is
  large at the left with where you are under it, and the menu is set at a title's size. What the run stands at sits bare
  at the right: which level of how many, and the time played (the play shell's `pause.where()`). The controls screen
  shows each key as a cap beside what it does.

### The street: the beat 'em up and the run and gun

Both draw one street HUD (`brawl/brawl-street.js` `streetSpec`, its `gun` variant the run and gun's), inside the
street's frame (the HUD's root is the scene's, never the page's margin: every `.mana-root` in a world page's `#wrap` is
placed in it).

- **The seats** are four quarters across the top on one shade, never boxes. A seat taken is its tag and its name, and its
  health as a strip in cells in its own colour (`bar` `side`), read by its length. The run and gun's seat adds the gun
  in its hands as its wireframe, its rounds as the figure over a belt (or a track past sixty), the sidearm endless (`∞`,
  never low: `magazine` `endless`), and its grenades as pips. The arcade guns have their own wireframes (machine gun,
  spread, flame).
- **Danger:** with one player the screen's edge closes in under half health (`peril`); in co-op the low seat's bar
  beats, since one edge cannot say whose.
- **The foe being hit** is named, with a short bar, under the seats for two seconds after the last hit. **The combo** is
  a large figure at the hitter's edge, with a word at each rung.
- **Shapes over words:** the way on is an arrow pulsing at the right edge ("GO ➜"), not a word over the fight. The
  boss's name is a title over its bar, its phases ticks inside it. The stages and the foes left are marks with no label.
- **A scene** (an arrive or leave card) clears the HUD from the screen. The street's own end says no health on a loss,
  and the rank is stamped.
- A choice of gun before the street shows each gun's wireframe beside its name (an option's `gun`).

### Fable of Artesia: the action-adventure's HUD

The action-adventure's HUD grammar (`scene/channels/hud-grammar.js`) holds to the same principles.

- **The hearts empty by quarters** (`pips` takes a fraction: the last heart drawn that far full).
- **What is held** (the weapon, the sidearm, the item and its count) sits small at the top right. What the body does
  (the guard, the sprint, the lock) is not equipment: its keys are the controls screen's.
- **The stamina** is a ring by the hero's shoulder, shown only while it is spent, harm when nearly gone. **The lock**
  is brackets over the locked foe's drawn top with its health thin under them, in place of the runtime's own diamond
  and bar. Both are drawn on `anchors` at points the page's camera projects.
- **The map** is a round scope at the bottom right that turns with the hero, with the foes awake and the way on.
- **Passing words** (an item used up, a pickup) sit at the foot's left, haloed dark, off the aim.

## The fight's language

A fighting game's UI is its own language, not a party game's: quiet so the fight reads, side against side. It is grown
from the shared templates (the live fight's bars, meters and combo; the moments; the selects, the pause and the
results) and drawn by the same components, sheet and themes. It lives in `idioms-fight.js` (shelf `fight`) and holds to
ten principles:

1. **Two sides, one centre.** Everything mirrors across the centre line: the first fighter's parts on the left, the
   second's on the right, its bars filling from the right. Each side is keyed to its kit (the theme's `sides` 0 and 1)
   and to its tag and name, never a colour alone. The second side is the first's reflection, part for part: a row's
   parts reversed (the tag on its own line at the outer end on both), each at the same distance from its edge; over the round a row's
   parts are centred across and figures take even widths, so a 1 and a 2 move nothing. The select too: each seat's
   fighter at its own edge, the roster between them.
2. **Health is the frame.** The two bars own the top edge (`size: large`), meeting at the clock between them, read by
   their length (`figures: false`, never a number). Each side's tag sits on its own line over its bar's outer end, the
   guard is a thin line under each (`size: thin`), the name under it at the outer end, the rounds won are dots by the
   clock, and the chip of the last combo is hatched.
3. **The fight is never covered.** The middle of the screen is the fighters'. A side's combo and callouts sit at its own
   edge, the meters along the foot; the announcer takes the centre only between exchanges.
4. **A callout is a word.** Counter, punish, reversal, parry, a guard crushed, a spark: one display word slammed in at
   its side, weighed (a spark outweighs a counter), held a moment on the fight's clock, its line the damage. Never a
   sentence, and quicker than the round's words, so the fight goes on under it.
5. **The ritual.** The round's words (round n, final round, fight, K.O., time, draw, perfect, a winner) are moments at
   the centre, decisive, one at a time, each read before the next.
6. **Meters in stocks.** The super in segments, a stock a segment; the guard a shield that can be crushed; a burst a
   mark.
7. **The hit-stop holds it.** The game holds the runtime through a hit-stop (`rt.hold`), so a bar's fall and a callout's
   entrance freeze with the blow and land with it.
8. **Quiet.** The fight's parts sit bare over the round (a region's `variant: bare`: no plate across the screen, each
   word on its halo, each bar its own frame). Its looks never lean, stack, break out or slam. The elements do their
   talking: the frame says no word but the names (no round caption, no meter labels, no figures on a bar), training's
   readouts carry no headings, a stock is its numeral.
9. **The bars are lit and move with what happened.** Over the round a bar is not flat: its track sunk, the bar on a
   soft shadow, each fill glossed with a bright leading edge. A hit drops the fill quickly and flashes the slice it
   took once; the chip (`ghost`) holds what the combo took and drains after a beat once the game gives it back as the
   value; a gain glows across what it filled; a super with a stock ready keeps a sheen running along it, its stocks a
   whole numeral beside it. All on the theme's motion: less motion stills the sheen and the glides, less flash dims the
   slice, a hit-stop holds them.
10. **Picked by their look.** The versus screens give each fighter its art at full height (`portrait` `size: xl`) at its
   own side; the select shows a fighter's style and figures only when the game asks (`stats: true`).

Its words are the runtime's (`WORDS`: round, fight, K.O., counter, punish, reversal, parry, spark, guard, burst, the
frame data's) or the game's, so a fight ships in every language its game does.

| shelf `fight` | what |
|---|---|
| `fight-health` | the top frame: the bars and their chip meeting at the clock, the guard under each, tags, names, rounds |
| `fight-meters` | the foot: each side's super stocks and burst, from its corner |
| `fight-combo`, `fight-callouts` | a side's combo and its callouts, at the edge the game names (`at: left \| right`) |
| `fight-announcer` | the round's words at the centre |
| `input-display`, `frame-meter`, `training-stats` | training's readouts over the fight's own (`TRAINING_HUD`) |
| `versus-splash` | the face-off: each fighter's art at full height at its side, the vs, the arena; any button goes on |
| `fighter-select` | side against side: each seat's fighter at full height at its edge, the roster's faces between them; `stats` shows style and figures |
| `fight-pause` | over the held fight: who paused, resume, the command list, training's settings, select, quit |
| `command-list` | a fighter's moves by kind, each its input beside its frame data |
| `training-settings` | the dummy, its guard, counter hits, the boxes, the frame meter, a reset |
| `fight-results` | the winner slams in, their line, the match's figures counting, a rematch |

**Its looks** are theme cards of the family `fight` (`playscape/ui/theme-cards/`), written for the fight and not
borrowed from the party: `fight-clean` (the look a fight wears when its game names none: gold health over a red chip,
white names, the rounds as dots, a hairline where a window needs an edge), and two over it, one a register:
`fight-cel` (the anime register's: inked, flat bright colour, changes stepped on twos) and `fight-lit` (the western
register's: a soft gradient plate, a shadow under the words, warm gold). Each keys its two sides apart, and none
leans, stacks, breaks out, stands a shape behind the fight or slams (`fight-look.test.js`). The board draws the fight
and training HUDs and every fight screen: `node scripts/mana-board.mjs <out.html> --theme fight-clean`.

## The table's language

A board game's UI is what sits round the board while it is played. The board, its cells and its pieces are the game's
world, picked through the controls layer's `board` scheme; the table's parts are drawn over it by the same components,
sheet and themes. It lives in `idioms-table.js` (shelf `table`) and holds to six principles:

1. **The board is never covered.** The seats ride its top edge, the hand its foot, the log a side. A question takes
   the centre only while it is being asked.
2. **Whose turn it is is a shape and a place.** The seat to play is alight with a bar at its edge (`turn: true`), and a
   seat's kit is a chip beside its name, never a colour alone.
3. **One question at a time.** A promotion, a discard, a bid, a target: `choice-prompt`. Back leaves it only where the
   game lets the choice be put off (`cancel`); with none, back does nothing.
4. **The hand is at the foot, in reach.** A `card`'s state is a shape: what can be played now has an edge alight, what
   is picked is lifted, what is spent lies on its side, what is hidden is a back and a count.
5. **History is kept, never in the way.** The `log` holds every row, shows its end and counts the rest.
6. **What cannot be done says why, where it is** (`why` on a disabled button, slot, row or cell).

| shelf `table` | what |
|---|---|
| `seat-plates` | the seats along the top: chip, name, a note, the score, the clock, the seat to play alight; flagged `coverage`, so a table its broadcast covers asks the broadcast for them |
| `card-hand` | your hand along the foot; a tap plays a card |
| `card-row` | cards laid out to be taken or read (a market, a supply's piles, a tableau, another seat's backs), at the place the game names |
| `action-bar` | the prompt and what can be done now, each action on its key, a disabled one saying why |
| `game-log` | the game so far, numbered, each row its seat's chip |
| `choice-prompt` | one question and its answers in a grid |
| `trade-offer` | what you give and what you get, each a count turned, and the offer |
| `table-results` | the outcome and why, the places by points (ties share a place), then what next |

The pause over a table is the front's `pause-menu`. A strategy board's parts are on the `live` shelf: `turn-order` (a
tactics battle's and a turn-based fight's, one part wherever it is drawn), `selection-grid`, `skirmish-lobby` and
`skirmish-results` (its figures side against side, each side's strength over the match as a `spark`), beside
`resource-bar`, `unit-card`, `combat-forecast`, `tactics-menu`, `command-card` and `wave-status`.

**Its looks** are theme cards of the family `table`: `table-wood` (plates of the board's light inlay framed in its
wood, a book face in mixed case) and `table-felt` (card stock on green felt). Neither names its sides: a table's kits
are its players'. The board-game pages are drawn by them, and the strategy boards by the strategy parts (the
surfaces, below). The board
(`scripts/mana-board.mjs <out.html> --theme table-wood`) is where a person looks at every part.

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
  cues: 'silent' | 'ticks' | 'full',   // optional: the UI's sounds it wants, as { sound } effects to act
  countUp: seconds,                    // optional, with now: a changed number counts this long (0: at once)
});
rt.hold(on); rt.reduceMotion(on);       // the game's clock held (the HUD's motion holds); the player's less-motion option
rt.textScale(k); rt.subtitlePlate(a);   // the player's text size (1 to 2) and the subtitles' plate (0..1, null: the theme's)
rt.reduceFlash(on);                     // the player's less-flash option, apart from less motion
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
- **Values first.** The greybox has no colour. Focus is a shape (the ▶, or the theme's ring, lift, brackets or bar) and the
  active row a tint with a bar at its edge. Bar variants differ by pattern, and a low bar on what can run out is cross-hatched. Placeholders are crossed
  boxes.
- **Tests.** Each concept is tested once (`kernel.test.js`). The sweep over every idiom (`idioms.deep.test.js`) checks
  that each draws on the sample state, a screen can be moved through and left (one that waits, a loading screen, has
  nothing to press until it is ready), and a HUD part takes no focus.

## The surfaces on it

### A level's scenes

A level's scenes (`playscape/ui/scenes.js`) speak through the talk box on a page whose level has a mana-ui HUD. The HUD
host (`scene/channels/mana-hud.js`) runs a second runtime on its own kernel and sheet, over a root of its own
(`#moj-mana-talk`), so the box wears the game's theme and the page carries no second kernel.

- **The state** is the scene runner's view, lowered each frame by `playscape/ui/talk-box.js` `talkState`: the speaker's
  name, the words typed so far, whether the line is whole, the answers with the one in hand, and the legend (no skip on a
  flow's stage that cannot be skipped).
- **The input stays the scene channel's** (`scene-channel.js`): a press goes on, holding or Esc skips, a number or the
  arrows pick. A choice's row pressed is that answer.
- **While a scene plays** the page's own box and hint are put away and the HUD steps aside.
- A page with scenes and no mana-ui HUD keeps the scene channel's own box.
- **Whoever speaks is drawn live in the box's face** (`scene/channels/talk-face.js`): their own figure, head and
  shoulders, seen by a second camera in front of them on the page's one renderer. Before each frame's render the
  portrait is rendered into a corner of the canvas and copied into a canvas over the face's place; the frame's render
  then draws over the corner. Nothing is baked: their idle, a walk, a script's take play in the portrait as they do in
  the world. The level's speakers sheet, `play.speakers: { <who>: { portrait: 'live' | 'none' } }`, shows a speaker by
  the box alone (`none`); a speaker with no body on the page, or one hidden (the player's in first person), has no face.
- **A speaker's face says the line** (`playscape/ui/talk-lines.js`): a plain line said by a hero with a talking head
  (the realistic face, or the anime or landmark face, which then plays on the page) is performed at build (`face-acting/perform.js`:
  its expression, its words lip-synced by `speech.js`, the blinks and gaze of a speaking face) into a face track on the
  speaker's figure, and the line gets a face-only take on its own clock (`talk:<scene>:<beat>`). The scene runner plays
  it as it plays a script's take; the page's face plays the track while it runs, in the world and in the portrait. A
  script's lines keep their own takes. The landmark head says it too (`face-acting/western-read.js`): the take
  read as the anime face reads it, its eyes, smile and brows on its targets, its mouth's vowels its jaw bone's degrees
  (`face.jaws`), turned on the page about the head's own x as the rig's jaw chain turns it.
- **Recorded voices, when the creator wants them.** A line's `voice` takes a WAV's path (the voice worker's, a native
  speech engine's, a person's): `create_sketch` / `update_sketch` bind it as a hero's recorded lines are bound
  (`face-acting/recordings.js` `bindSceneVoices`: saved by its content under the outcomes, timed by the engine's
  `.timings.json`, else by its words aligned, else by its loudness). The speaker's face says it on the recording's own
  timeline, a recorded line has a take whoever says it, and the page carries the recording's bytes and plays it as the
  take begins, stopping it as the line goes (`scene-channel.js`, `window.__mojVoice`). A browser plays no sound before a
  press, so a line already under way when the first press comes is taken up where its take has got to.
  `play.speakers.<who>.voice` keeps each speaker's casting with the level. Lines with no recording stay silent.

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

### The board games

The tabletop pages (`tabletop/tabletop-page.js` and its euro, tile, card and round siblings) are drawn by mana-ui by
default; `tabletop: { …, ui: { theme?, languages?, language? } }` names another look or the game's languages, and
`ui: false` keeps a page's own header, side panel and broadcast furniture. One spec and one host serve them all:
`tabletop/table-ui.js`.

- **The spec** is a HUD over the board (a menu button, the `action-bar`, the `game-log`, a row of counters for what is
  held) and four screens: the menu (`pause-menu`), one question (`choice-prompt`), an offer (`trade-offer`) and, for a
  game with no board, the table of cards (a grid for each zone, zones that share a row side by side).
- **`read`** is what the page hands `UI.show(...)` after each move, built from the kernel's state and its legal moves.
  A row that can be done carries a function of the page's; the host keeps it and the row carries its id, so an effect
  is `{ emit: 'run', id }` and the kernel still says yes or no.
- **Input** is the controls layer's, twice: `connect(rt, …)` with the `menu` scheme while a screen is up, and
  `connect(board, …)` with the `board` scheme for the cursor over the board, the board standing where a screen would
  (it has the keys and the pads while no screen is up). A key pressed while a screen is up never also acts on the
  board. An action's own key (a letter the page names, else a digit by its place) does it while no question is up.
- **The cursor** steps to the nearest place in the way pressed, over the cells' places on the screen; a board whose
  targets change (the euro's places) says them again and the cursor moves among those.
- **Coverage: one layer.** The seats, the calls and the result are the table's own parts. A page's client still says
  them in the broadcast's calls (`TV.frame`, `call`, `result`, `table`, `hit`, `colour`, `clear`); with `ui` the object
  that answers is `UI.tv(...)`, not the broadcast's DOM client (`broadcast/broadcast-dom.js`), which such a page no
  longer carries: the seats are `seat-plates` (a running clock said again between moves), the tab a line under them,
  a call a `moments` row there (one at a time by the broadcast's weights, never over the play), the result
  `table-results` a beat after the end's word. The broadcast's data still makes the theme's sides and the pieces' kits.
- **The look** is `tableUiTheme`: the game's, else `table-wood` or `table-felt`, its sides the broadcast's kits.
- A round game played on a board still draws its own panel.

### The practice rooms' menu

The work room and the game room (the practice door's `work` and `room`) put their readout and their choices on
mana-ui, not a page panel of their own: `gameworld/practice-mana.js`, hosted by the page.

- **It is the game shell's pause, kept on the page.** The pilot scheme's `pause` (its keys and its pad button, read
  from `controls/schemes.js`) opens it. The scene is held on the shell's own sidecar (`MSG_PAUSE`: the sim and its
  clocks frozen), and it answers with its live control rows, which the controls screen lists. The foes are woken on the
  shell's AI switch (`MSG_AI`), the path the pilot's own `aiToggle` takes. It opens as the page loads, as the room's
  briefing, over the held room.
- **The screen keeps to the game.** What the page once explained on the screen (the keys, how the work runs, how to
  read the floor) is the menu's How to play, a tutorial in tabs, each key a `prompt` in the glyph of the device in hand.
  In play, the screen shows the counters, the use prompt and one chip in the corner that names the menu's key.
- **The screens:** `pause-menu` (resume, how to play, the room, set up, controls); the room, its readout in tabs; set up, the
  movement, the worker, the dress and the area as cyclers and the foes as a switch, the room reopened with them (the
  studio's query, so a page saved to disk says it cannot); controls.
- **The hint line** at the page's foot names each action by the key the scheme binds it to (`practiceLegend`).
- **Input** is mana-host's while a screen is up; with none up, play has it, and only the pause opens the menu.
- **The look** is the shift family's card for where the room stands (`theme-cards/shift-*.json`: a kitchen, a farm, a
  site, a garden, a hall; `shift` itself for the plane). It is a couch co-op work sim's look: chunky order tickets on
  paper over a slab offset in the accent, rounded faces, a heavy outline, and the floor's own two colours as the accents
  (shovel work warm, bucket work cool), each trade tinting them. It bounces in and never slams. The play around the menu
  takes the same look (`playCss`): the HUD's counters and its hint line as tickets, the use prompt with its key as a cap,
  and the page's margin in the plate's colour. Only the HUD's own hooks are styled (its classes and `--moj-*` tokens).

### A flying lesson's brief

Pilot School's game runs on mana-ui as Rebel Storm's does. Its rail dresses it in the `logbook` theme card (a training
logbook on a sectional chart), so its title, its lessons, its pause and each lesson's graded result are mana-ui's, the
shell remembering each lesson's best medal. Each lesson opens with the instructor's brief over its field as it loads
(`gameworld/lesson-brief.js` its words, `scene/channels/lesson-brief.js` its page: an airspace level's `lesson` key):

- **What it says:** the lesson's place in the syllabus, what it teaches, the sky it is flown in (the hour, the weather,
  the wind in knots, the moon at night), its tasks in the instructor's words in the order they come, and what earns
  gold, silver and bronze by every criterion it is graded on.
- **It holds the lesson** on the shell's pause sidecar (`MSG_PAUSE`) until Start, so the clock its grade reads starts
  with the student. It takes the keyboard as it opens, so Enter starts it from inside the shell. Start takes it away.
- A page without a `lesson` key emits none of it.

### An arcade stage's briefing

Wolf Squadron's game runs on mana-ui too, in the `squadron` theme card (night-blue plates cut at the corner, cyan and
amber, menus that slam in on chevrons), and each of its stages is designed whole the way a Rebel Storm mission is
(`campaign/stage.js`):

- **What a stage's design says:**
  - its place;
  - its route (a canyon on a moon or rocks over it, its speed, how thick its hazards stand);
  - its waves, each at its share of the way, in a line, a vee, an echelon or a swarm;
  - its boss (its guns round a core, light or heavy armour);
  - its medals in points;
  - the steps it is told in.
- **The designer** (`campaign/designer.js`) knows a stage by its `route`: the same `missions` on the world, drafted and
  approved the same way, its laws said in `design_game`'s readout. An approved stage's level is compiled onto the rail
  stage's `plan` (`skyscape/rail-stage.js`): its waves at their marks in their formations, its hazards, its boss.
- **A stage down a planet or a moon is told over its real ground.** The level's land is drawn as terrain on the table
  (`campaign/stage-ground.js`, its heights stretched so a canyon reads), with the way as flown, the waves where they
  are posted, the boss where it waits and a colony's masses. The route is laid in stretches (a canyon, open country, a
  colony): [flight-games.md](flight-games.md#a-route-down-a-moon-a-rail-stage-in-segments).
- **It is told on the same holo table** as a mission, as the level loads. The route is drawn as a ribbon, each wave
  sits at its mark, the boss is past the route's end, and the orders give the points and the medals. It is held until
  Launch and takes the keyboard as it opens, so Enter steps it from inside the game's shell. A stage's table follows
  from its route and its waves, so it is approved from its briefing rather than moved about on the table.
- **Arcade, not a sim:** every fighter, gun and core down scores its points (the `score` mechanic, on the HUD), the boss
  down wins the stage, and its medal is its score's (the `grade` mechanic), the shell remembering the best.

### The first mission

A shooter's first level ([missions.md](missions.md)) is on mana-ui whole, from one spec
(`gameworld/mission-mana.js`): the briefing over the held scene, the HUD while it plays, the pilot's pause and, on a page
played alone, the debrief. It is a level's HUD drawn by the runtime, read each frame off the scene's own probes (the
bus's vars for the level's hp, the task in hand and the yard's clock; the pilot's weapon for the gun, its fire mode, its
magazine and its reserve; the pilot's hits and who dealt the last for the damage ring, a mark on the `damage-direction`
idiom's ring where each hit came from), painted when what it shows changes. It holds to the principles above: the
health a strip in cells and the gun its magazine, both on scrims and resting while they hold no news; the task in hand
as one order, with how far; the radar a scope; the screen's edge closing in as the health runs out. The list of every
task is on the map screen. The page's own readouts and ammo panel are put away where mana-ui
draws the same thing; the reticle stays the gunplay view's.

- **Hosted as a page channel** (`scene/channels/mission.js`), opt-in on a world's `mission`; absent, it adds nothing.
  The kernel, the controls host and the runtime sit in a scope of their own.
- **Input** is the controls layer's (`controls/mana-host.js`), as the practice rooms' menu: the pilot scheme's `pause`
  opens it, the scene is held on the pause sidecar.
- **Its look** is the theme its manifest names: the world's interface where it writes one, else the `field-brief`
  theme card. A look with an overlay across the screen is read without it: the HUD lies over the sights.
- **In a game's shell** its debrief stays shut: the shell's own result screen is the debrief.

### A frame's hangar

An assault frame's operation opens in its hangar (`scene/channels/controllable/frame-garage.js`, the pilot frame's
`rule.garage`, a frame stage's `garage: true`): the frame on its pad in a bay between two gantries (the field put
away behind a render layer of its own), the camera swaying slowly across its front, the operation held behind on the
pause sidecar. The words are the campaign idioms: `garage-slots` down the
left (each slot and its part, then Sortie), a slot opened to `garage-parts` (each part the player has, what fitting it
does to the whole frame told as compares, the fitted one marked), and `machine-sheet` on the right (the frame's numbers,
its load against its legs', its laws). A part fitted is stood at once: the page builds the frame with the frame kernel
(`assault-frame/kernel.js`, the frame's own modules). Sortie keeps the build in the save (the `hangar` slice's flags,
`assault-frame/hangar.js`), takes the bay down and lets the operation go. The parts it offers are its stock's and the
save's `parts`, which each operation's win adds to (its `reward`, the level's `wins`).

### The strategy boards

A board (`board/board-page.js`: a tactics battle, an epoch's map, a tower defence, a skirmish) is drawn by mana-ui by
default, in `tactician` (a level's `board.ui` or the `board` kind's `ui` names another look; a gameworld's `ui` reaches
its battle, map and defence levels; `ui: false` keeps the board's own text panels).
its battle, map and defence levels; `ui: false` keeps the board's own text panels).
Its spec and its page are `board/board-ui.js`, handed to the board page as the tower defence's and the skirmish's
pages are, so a board without `ui` carries none of it.

- **The board page still plays.** Its text panels are written as ever and never shown; `boardManaPage` reads what the
  page stands at (`api.get()`: the mode, the cursor, the readout, the menu's items, the order, the unit, a forecast, a
  defence's hand) and rebuilds what the runtime reads only when that has changed.
- **The parts**: `turn-order`, the unit in focus, an aim's forecast as a `table`, the readout and a `legend` of the
  board scheme's controls in the glyphs of the device in hand, the end's word as a `banner`, `damage-numbers` over a
  blow (each projected from where it landed in the world); for a defence, `wave-status` and its hand as `slot`s.
- **The action menu is a screen** (`act`, an overlay beside the board): it opens while the page is in its menu and is
  opened again when what it lists has changed; a pick runs the page's own function, back is the page's back.
- **Input** is the controls layer's, as the tables': the `menu` scheme while the screen is up, the `board` scheme for
  the board (the board page's `intent(action)`), a key the menu took never also the board's.
- **Scoped.** Its sheet and theme are scoped to its own root (`#mana-board`), so it stands beside another surface's
  runtime on the page. Its theme sets no cover between screens and no veil: the menu opens every turn.
- **A skirmish** hands its figures as data whenever its panel is made (`rtsp.ui.view()`: the purse, the selection, the
  commands with their keys and reasons, the lobby's rows, the results): `resource-bar`, the selection with its tiles,
  the command card as `slot`s, and two screens, `skirmish-lobby` and `skirmish-results`, that follow the match's
  phase. Its orders stay on its own keys and the pointer, so the board scheme is not connected for it; rebinding its
  keys is not offered under the UI yet.

### The holo arena

A board game lifted into its hologram arena (`tabletop/holo-arena.js`) is drawn by mana-ui by default, in `modern`
(`holo: { …, ui }` names another look; a world's `ui` reaches its board game's arena; `ui: false` keeps the arena's
own canvas overlay). Its spec and its page are `tabletop/holo-ui.js`,
given to the arena's block beside its client, which asks whether it was given one.

- The client hands what it drew on its canvas each frame (`UI.show`: the two duelists, the title, the status, the
  duel's word); the page draws again only when that has changed. The duelists are mirrored across the top, each its
  light's chip, its life points and a thin bar, the second filling from the right.
- A promotion or a drop is `choice-prompt`, put off by back.
- The cursor is the `board` scheme's, over the cells projected as the camera shows them now (the camera turns to the
  seat to play), drawn as a ring on the cell.
- Its sheet and theme are scoped to its own root (`#mana-holo`); the theme sets no cover and no veil.

### The side map's HUD

A side map level (`gameworld/side-map/level.js`) of a game with a `ui` is given a HUD of its own
(`gameworld/side-map/hud.js`), hosted by the level page's HUD host on its `sidemap` feed, in the game's look (Galaxy
Boy's is the `galaxy` card: navy plates, a square edge, energy in yellow ticks, a boss's in red, a monospace face in
capitals). It is read as the 8-bit action platformers read, and nothing else is over the play:

- The hero's energy is a column of fine ticks at the top left, filling from the foot (the lives mechanic's `energy`: a
  hit takes ticks, a life goes when they run out). A level with no energy draws its lives there, one block a life.
- A special weapon's energy is a column beside it, in the weapon's tint, while the hero holds a gun with energy of its
  own (`energyMax`). The buster has none, so the column waits for the special weapons.
- The boss's column stands at the opposite corner, top right, once the boss is awake and near, and is gone a moment
  after it falls. Its name is said across the top as it comes in.
- READY flashes in the middle as the level starts and after a life is lost, the lives left under it. The keys are key
  caps along the foot for the first seconds.
- It puts away the level's own rows (the energy, the lives chip, the boss's bar), the radar and the melee ring: a side
  scroller reads its foes on the screen.

Its screens are the HUD's own, opened by its host over the held level: `window.__mojMenuOpen` and `__mojFreeze` set, as
a level's own menus hold it, and a `.moj-menu-hud` marker so the shell's Esc menu is not asked for over them. The keys
and the pad drive them through the controls host (`controls/mana-host.js`), which leaves every key to play while no
screen is up.

- `intro`, a world's intro card as the level starts (`press: any`): the boss's name in its hue (`--sm-hue`), its world,
  its tell and what it gives; any button or three seconds, then READY.
- `menu`, the start menu on the menu key (`MENU_KEY`, Enter): the weapons from the pilot's loadout in order, the slots
  not yet won locked; accept equips. Back resumes.
- `over`, GAME OVER where the level lets the player continue (the lives mechanic's `continues`). Continue and Give up
  raise `continue` and `giveup` on the level's bus; back does not leave it.

### The open city

A played city (an open-world game: errands and jobs, a phone, a map, a bag, a journal) draws every part of its UI on
mana-ui, and reads as a game's, not an app's. It follows the principles a game HUD is drawn by:
- the shape is the label;
- nothing is boxed over the world;
- a part speaks when something changes;
- the map is an instrument.

Its look is the `downtown` theme card (`playscape/ui/theme-cards/downtown.json`, the look a `city-stalker` intent starts
from: `INTENT_LOOKS` may name a card as well as a preset). It is near-black glass with white words, a taxi's yellow for
what matters and a banknote's green for money, with nothing drawn across the screen, so the city shows through every
screen.

- **The radar** (`scene/channels/map-channel.js`) is round, on no plate, with a rim and a shadow under it and its ground
  darkening toward the edge. The opened map shows the ground in the look's own night, with water in a cold blue. Only
  the goal and you are named on it, and the key beside it names the rest.
- **Money** is a coin and a figure that leads, large (`game/hud-mana.js`: a counter of coin, cash, gold or credits is
  drawn as money). The bag says it the same way.
- **The guide** (`scene/channels/guide-mana.js`) gives the objective as an order (a mark, what to do, how far). The keys
  that work now speak when they change (a car in reach, the wheel taken, a call on the phone) and step away after a few
  seconds. As a car is taken its name is said large at the bottom right, leaning, and gone, as an open-world game names
  a ride.
- **The phone** (`scene/channels/phone-channel.js`) is a handset held at the bottom right with the city still there
  round it, not a screen. It has a phone's body, the hour and the signal along its top, its apps as the tabs, and its
  contacts above the open thread.
- Every place of a level's HUD is bare, its words haloed (`game/hud-mana.js`).

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

### Pictograms

`icons.js` holds the pictures a UI says things with in place of words: a coin, a heart, a clock, a lock, a gesture.
Each is one outline on a 24 grid. A theme's `icons` word is the style they are all drawn in (`solid`, `line`,
`chunky`, `badge`, `duo`; `none`, the default, keeps a name's initials), so a look changes its pictograms as it
changes its frames. Nothing is loaded: the theme's sheet carries each as a mask, cut out of the ink of the words
beside it. The runtime only names one (`data-icon` on an `icon`, a counter's `icon`, a prompt's glyph); a game's other
words for it (`coins`, `time`, `hp`) are aliases in the library.

A shooter's guns are a shelf beside them (`guns.js`): each gun a wireframe of its side on a 64 by 20 grid, its
outlines over a faint fill of themselves and its inner lines thinner, and each round it feeds standing tip up, both
masks cut from the ink like the pictograms. A magazine names its gun (`gun`, else its `name`; the words for a gun are
aliases) and the sheet draws its wireframe and its rounds; a name with no wireframe draws none. A new gun is a row.

A theme dresses them further. `icons` has eight styles: `solid`, `line`, `chunky`, `badge`, `duo`, `sketch` (drawn by
hand), `stencil` (cut and sprayed) and `glow` (a lit tube). `iconTone: 'meaning'` colours each by what it means in the
theme's own tokens (a heart the health's, a bolt the stamina's, a skull the harm's, what is won the accent). A badge's
plate takes the theme's corner. `iconSwap` gives a look its own picture for a word (`{ coin: 'ticket' }`).

### Stages: a show, not one pattern

A theme's `stage` is the shape behind everything a screen holds. Beside the calm ones (`band`, `stripes`, `rings`,
`shards`) the lively ones are `burst`, `chevrons`, `dots`, `confetti`, `tunnel`, `streaks` and `zigzag`: each a
different kind of energy. A `stage` written as a list is a show, so a game's screens do not all wear one pattern:
the title takes the first, a screen in the middle (a pause, a menu) the second, a full screen (loading) the third, a
result the fourth, a count over the play the fifth; a short list goes round again and `none` leaves a kind bare.

### A running game's shell and HUD

A game of obstacle courses (`docs/course-dress-principles.md`) has its screens drawn here without asking: its
title with the run's rules and best, its pause (the pause menu, the level's controls), a moment as a map is cleared,
a loading screen that says which map is next, and a result with the map, the seconds, the coins and a rank. In play
its level hosts a HUD of its own (`scene/channels/mana-hud.js`, composed by `gameworld/course-hud.js`). Both wear the
look the course's dress names (`toybox`, the toy family's first card).

### The lens: the screen layer

The HUD sits on the picture. The lens acts on it: a spec's `lens` is a second part of the same runtime, drawn apart
from the HUD's root (`rt.lens()`, mounted with `mount(el, rt, { part: 'lens' })`). The host lays it beside the world's
canvas and under the UI. Its regions filter the world's own pixels, so its root is never its own stacking context:
no z-index, no `contain`, no `container-type`, no opacity, transform or filter on it (`lensCss`). Anything that
isolated it would leave its regions filtering nothing; the reactive layer's spike found it
(`scripts/spikes/reactive-layer/`).

**It is for still figures: a turn-based fight, never an action level.** A region on the screen is drawn where the
figure was when the page last projected it. A figure that stands while the round plays is where its region says; one
that runs and dodges outruns it, and an action level's hits are already answered by the world (the body's flash, its
sparks, the tempo's moments). So its host is the RPG's battle (`playscape/rpg/rpg-ui.js`, `scene/channels/rpg-channel.js`),
and the level HUD carries no lens.

Its first effect is the **strike**: the air round a figure on the screen.
- **What it draws:** a band from the figure's silhouette out, bent and lit (`ring`), lit (`lift`), darkened (`shade`)
  or turned to its negative for a beat (`ink`, a lift under less flash). Each row may name its own kind over the
  strike's: a miss's ring and a cast's lift in the same fight.
- **Where it draws:** each row `{ id, n, x, y, r, power?, kind? }` is the figure's middle and its body's radius on the
  screen. A new `n` plays again.
- **Its cost:** each strike is a region the size of its band (a region filters only its own area), and at most
  `most` play at once.

**In a fight it is a juice step** (`playscape/rpg/juice.js`): `{ lens: ring | lift | shade | ink, at?: target | actor }`
draws round the figure the step names, for the beat. By default a miss bends the air round its target and a cast
lights the air round its caster: the beats the world leaves bare.

**It never overlaps the world's own effects.** The world draws on the figure, so the strike's mask leaves a hole over
the body. And a lens step yields where the beat's world already answers (`lensYields`): a flash over the field, a puff
on the same figure, or a beam landing on its target. The screen's juice never doubles the world's.
`scripts/spikes/reactive-layer/lens-proof.mjs` shows it in Chrome in a party fight: each kind round the struck figure,
and nothing on a hit that flashes the field.

### Screen effects

A moment worth celebrating gets a screen effect: the HUD's `effect` layer, beside its regions. Its kinds are
`confetti`, `streamers`, `sparkles`, `burst`, `petals` and a `flash`. Confetti falls from the top, pops from the centre
or fires up from the bottom (`from`).
- **Trigger:** it plays once each time its `on` takes a new value (a finish, a best lap, a level up: bind it to a count
  the game raises), or holds while `loop`. A new trigger is a new element (its `data-key`), so its animation plays
  again; with no trigger the layer is empty and hidden.
- **Pieces:** thrown by the effect's own dice (`seed` and the trigger: the same moment throws the same pieces), in the
  theme's colours by name (`tones`: accent, accent2, hp, ink by default) or a hex, as many as `count` (at most 160) for
  `seconds`.
- **It never touches play.** It is pure CSS: it catches no pointer, is laid out alone (`contain: strict`), and its
  motions move transform and opacity only, the compositor's, so it asks the game for no frame. It holds with a held
  clock, as every HUD animation does, and under less motion its pieces stay home and only a flash, a fade, plays.

A race lays two: confetti on the finish and sparkles on a lap better than the best (`fx.finish`, `fx.best`).

### A race's HUD

A level raced by laps on a roadway (the `laps` mechanic round a track) hosts a HUD of its own too, composed by
`gameworld/race-hud.js`. A race is read from behind the kart as a course is, so the HUD keeps to the corners and the
right edge: the place, large, in the top left over the field; the lap of the laps, this lap's time and the best lap in
the top right; the track's map on the right edge, the track's own line drawn as a dotted route (the minimap's
`route`) with you and the field on it; the speed on a dial in the bottom-right corner; the final lap and the finish
(with the place) as moments. The start is five lights coming on a beat apart on a plate, then out together for GO:
a screen, so the karts are held, and the world frozen with the race's clock until they go out. A tall frame lays the
place and the lap on one plate at the top, with no map. Its look is its track's: `kart-candy` (the toy family) for a
candy track, `pit-wall` (the clean family: the timing tower) for a circuit; a world that names its own theme wears it.
A race on a track with item boxes (`roads/kart-items.js`) shows its held item as one large `slot` (`size: 'l'`) at the
top's middle, there all race and in no words: dashed while empty, the item's pictogram filling it and its frame the
accent (`active`) while one is held, the key that uses it in its corner; read off the page's `window.__mojItems`. A
slot draws its pictogram where the theme has one (its icon carries `data-icon`), its initials where not. Each item names its pictogram on the icon shelf (`icons.js`: a wrapped sweet with a
bolt through it, a toffee splat, a gumball), and Candy Kart draws its pictograms chunky, toned by what they mean.

### Layout that adapts

The frame a view is drawn in is state. A mount measures its own box, and measures it again when it changes (a phone
turned, a window dragged); a host with no DOM says its own (`host.frame`, `rt.frame({ w, h, hand })`); unsaid, it is a
desk at 1920 by 1080. A spec branches on it with a binding of its own, in any `when` or `unless`:

| `{ frame: … }` | is true when |
|---|---|
| `portrait` / `landscape` | the frame is taller than wide / not |
| `narrow` | it is under 640 wide (where splits already stack) |
| `short` | it is under 420 high |
| `hand` | the pointer is a finger |

So one composition holds its wide and its tall layouts, and the frame says which stands; nothing is decided when
the page is emitted. A row says what it does when it runs out of width with `fit` on its `stack`: `wrap` onto a
second line, or `stack` as a column in a narrow frame (`fixed`, the default, writes nothing). The runner's HUD is
laid this way: its corners in a wide frame, one plate in the top's middle in a tall one. Not yet live: a theme's
`distance` (how large a unit is) is still chosen when the page is emitted.

### One HUD for every level

A world that says a `ui` has its levels' own HUD rows drawn here too. The level keeps writing the widget language it
always wrote (`events.hud`: readouts, bars, counters, clocks, banners, toasts, legends); `game/hud-mana.js` lowers
those rows to one composition, and the page's HUD host (`scene/channels/mana-hud.js`) draws it in the game's look,
reading the level's bus each frame. So a level's readouts, its moments and the game's menus are one look.

| a row | is drawn as |
|---|---|
| readout `text` | `stat` |
| readout `counter` | `counter`, with its label's pictogram where the icon shelf has one |
| readout `bar` | `bar`, its meaning read off its name (hp, mp, xp, stamina, shield, boss) |
| readout `clock` | `timer` |
| banner | a moment: one on screen at a time, by weight |
| toast | a line of its slot's feed, gone after its ttl |
| legend | words in its slot, for its ttl |
| title | the carved letters, as before (`game/title-carve.js`) |

A row's `id` and `when` gate it as they did. The pilot's parts (its health as a strip in cells, with a level's
health row folded in; its sprint; the slow motion's charge; the gun in hand; the radar, the damage ring and the weapon
wheel) are drawn as the cinematic action game's are (above), read off the runtime. The runtime's own gauges, its radar,
weapon panel, wheel and damage ring, and the old widget columns are hidden, not removed. A row's colour is not carried:
the theme owns the look. A corner's rows sit on a scrim and the others bare, never boxed. A level manifest asks for it with `manaHud: { rows: 'events', theme }`
(`levelHud`); a world without a `ui` lays its levels as before, and a course's HUD stays its own composition on the
same host. Not yet on the host: a board, a building or a tabletop level, and the level-complete card.

### The shooter's HUD is the baseline

Every page a gun is fired on wears one HUD: the first mission and its kin (a mission in a building, an industrial
level), a quick shooter's level, a deathmatch and the firing range. It is the mission's page with nothing of a mission
in it where there is none (`mission: { tasks: [], plain: true }`, `shooterHudUi`; `gameworld/mission-mana.js`): the gun
in hand, the health, the screen's edge, the scope (a minimap: the level's plan turning under its marks), the damage
ring, the map and the pause. With no mission it shows no
order, opens no briefing and leaves the end to the level; the level's own counters, lines and clock stay the page's (a
bout's frags and place) and stand at the top right, clear of the scope; the page's own health row and its old radar
give way, since this HUD draws both.

What "A HUD that reads as a game" sets down are the baseline, and they are principles, not a skin. They hold for every
shooter whatever it looks like:

- a readout is read by its shape (a belt of rounds, a bar's length), never by a label beside a number
- nothing is boxed over the world, and a readout with no news rests
- danger is felt at the screen's edge before it is read
- one order at a time, the list on the map
- a hit says where it came from

The look over them is the game's own. A world's `ui` (the interface chapter: `playscape/ui/interface-look.js`) names
its theme, and the same parts are drawn in it: its inks, its accent and harm colours, its type, its corners. A world
that names none wears the field brief. A new look is a theme card; a new part is a part of mana-ui that every theme
then draws. So a game themes its HUD its way and cannot quietly drop a principle: the parts carry them.

Said: the firing range's own buttons and its bout badge still stand at the top left under the scope; a world's `ui`
has been checked to change the sheet, not looked at theme by theme on a shooter.

## What is next

1. The integration, one surface at a time, each step either drawing the same bytes or naming the change it makes to
   what a page emits. Begun: the play shell's screens (title, attract, levels, options, credits, the end card,
   results, loading) are drawn by mana-ui for a game with a `ui` (`game/play-shell-mana.js`; what plays when is the
   shell's flow runner: [game-flow.md](game-flow.md)), and the RPG channel's battles, party menu and shops are too
   (`scene/channels/rpg-channel.js` rpgMana). Next: the play shell's pause, the theme's sounds there, a picture in the
   image component (a cover as key art), playscape's menu kinds, the arena shell's front, the versus pause and the
   fight's HUD (the fight's language above). The board-game pages are on it (`tabletop/table-ui.js`), the strategy boards
   (`board/board-ui.js`) and the holo arena (`tabletop/holo-ui.js`); next: a skirmish's keys as a control scheme (so its remap is the controls layer's), a round
   game played on a board, and the table's broadcast furniture folded into the `table` shelf.
2. The engine handoff: the same spec as Unity UI Toolkit (UXML and USS), then a Godot theme and scenes.
