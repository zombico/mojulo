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
- **The glyphs out.**
  - `manaGlyphs()` gives each action's control per family and layout. A `prompt` and a `legend` print the one in hand
    ("Enter", "A", "✕"), switching as the player picks up another device; a touch screen draws no legend.
  - `controlsRows(scheme)` lists a scheme on the controls screen as the kernel labels it, a clash marked.
  - `remap()` returns the conflicts it makes (advised, never refused).
- **The drawn touch pad** is a look only: its buttons are named by the gamepad controls they are (`data-control`). The
  virtual pad's driver is the controls layer's.
- **Previews** (the board, `manaUiPage`) take the host as `host: { source: manaHostSource(), controls }`. Without one,
  they drive their frames with `PREVIEW_KEYS`, a stand-in in the preview's own script, never in the kernel.

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

## Words in the game's language

A game's own words (its menu items, its titles, its rows) are its data, passed in as props, so the game translates
them. The few words the runtime says itself (a legend's Select and Back, a list's Nothing here, an idiom's Loading,
Rank, Turn order) are one table, `WORDS` in `kernel.js`, in English. An idiom names one with `{ word: '<key>' }` and a
format with `{@key}` (`'{@lv} {level}'`); a test holds the idioms to it, so none says a word of its own in English.

A host hands its language in as `host.words` (`manaUiPage(spec, { words })`, `manaUiBoard({ words })`,
`node scripts/mana-board.mjs <out.html> --locale ja`). The words live in the dashboard's locale catalogs
(`control/messages/<locale>.json`, the `gameUi` namespace, the same keys as `WORDS`, held equal by a test), so the
game's menus speak every language the dashboard does, and `/sync-locales` carries a new word into all of them.
`playscape/ui/mana-words.js manaWords(locale)` reads them (a word a language lacks reads in English). Nothing in the
dashboard reads `gameUi` through next-intl, so the unused-keys report lists it, as it lists `gameTitles`; both are read
by their bridges.

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
tool's own, nothing new in its kernel), in ten sets: `glass`, `console`, `chip`, `terminal`, `paper`, `party`, and the
heavy ones, `hydraulic` (servos, pneumatic hiss, clamps landing), `clack` (hardwood blocks, a clapper's double clack on
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
heard least; a heavy set's big moments are let past confirm on purpose (the crypt's door, the jackpot's jackpot). A game's key transposes the pitched gestures (`tonic`). A theme's `sounds` word picks the set (the presets
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
  (key art behind, the name and the menu in the left third, the version in a corner), loading, mode select, character select (couch seats),
  arena select, pause, options (sections of fields), controls (keybinds; accept asks the host to capture), confirm,
  results (in sequence: the outcome slams in, the figures count, the rank is stamped), save slots.
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
  now: () => seconds,           // optional: the game's clock (moments are timed on it; held when the game is)
  cues: 'silent' | 'ticks' | 'full',   // optional: the UI's sounds it wants, as { sound } effects to act
  countUp: seconds,                    // optional, with now: a changed number counts this long (0: at once)
});
rt.hold(on); rt.reduceMotion(on);       // the game's clock held (the HUD's motion holds); the player's less-motion option
rt.textScale(k); rt.subtitlePlate(a);   // the player's text size (1 to 2) and the subtitles' plate (0..1, null: the theme's)
rt.reduceFlash(on);                     // the player's less-flash option, apart from less motion
rt.press('down' | 'up' | 'left' | 'right' | 'accept' | 'back' | 'tabNext' | 'tabPrev', seat?);
rt.open(id); rt.tick(); rt.view(); rt.state();
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

## What is next

1. The integration, one surface at a time, each step either drawing the same bytes or naming the change it makes to
   what a page emits: the RPG channel's menus through a bridge from its kernel, playscape's menu kinds, both shells'
   fronts, the versus pause.
2. The engine handoff: the same spec as Unity UI Toolkit (UXML and USS), then a Godot theme and scenes.
