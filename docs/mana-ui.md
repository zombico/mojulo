# mana-ui: the game UI runtime

mana-ui is an internal name. The agent and the person read plain words (`use`, `props`, `on`, a screen's id), never
"mana". The code lives in [control/lib/mana-ui/](../control/lib/mana-ui/), and it is the interface department's work
(`interface` in `gameworld/chapters.js`).

## Why it exists

Playscape (`control/lib/graph/playscape/ui/`) says what a game's UI is: the guide and its register, the parts, the
menus, the cues, and the laws they are held to. Until now, each surface drew that UI its own way. The HUD, the
playscape menus, the RPG's battle and party menu, both game shells, versus, the hangar and the board games each had
their own sheet, colours, markup and keyboard and gamepad focus handling. mana-ui is the single runtime they move
onto, so a screen is implemented once and not game by game.

## The model: state, form and function, props passed down

This follows React's principles but uses none of its code.

- **A node** is data, the thing a recipe writes:
  `{ use: '<component | def>', id?, props?, on?: { <verb>: effect(s) }, children? }`.
- **Props flow down.** A prop is a literal or a binding, resolved at render:

  | binding | reads |
  |---|---|
  | `{ bind: '<path>' }` | the game's state, through the host |
  | `{ item: '<field>' }` | the row a list is drawing |
  | `{ pick: '<list id>.<field>' }` | the row a list has selected, on any screen of the stack (list → detail) |
  | `{ format: 'Lv {level}' }` | the row's fields, as words |
  | `{ input: true }` | the value an input now holds (in a change's effects) |

  Props are typed closed words, and a bad one throws an error that names what exists.
- **Style is never a prop.** A node with `style`, `color`, `font`, `border`, `css` and the like throws (the menus' rule
  in playscape). The theme is context: the guide's tokens (`--moj-*`) dress every node. A closed `variant` is all a
  node may say about its look.
- **State has three owners.**
  - The game's state (the bus, the store, the kernels such as the RPG's) is read through bindings and never copied.
    A bound toggle asks the host to `set` its var and then shows what the host holds.
  - The screen's state (focus, the open tab, a list's selected row, the screen stack) belongs to the runtime.
  - Appearance (`shown`, `focus`, `active`, `disabled`) is derived from those two and written as `data-st`.
- **Form is a tree of data:** `[tag, attrs, ...children]`. The DOM backend writes it as HTML, and another backend (a
  canvas, an engine's UI) can draw the same tree.
- **Function is effects, never callbacks**, because a recipe is JSON. These are the cue effects playscape already
  speaks. The runtime handles three itself: `{ open: '<screen>' }`, `{ close: true }` and `{ back: true }`. Every
  other effect goes to the host's `act(effect, from)`, with `from` naming the screen, the node and the verb. When the
  stack empties, the host hears `{ emit: 'mana:closed' }`.
- **No virtual DOM and no hooks.** A screen records what it read. A frame `tick()` re-renders only when one of those
  values has changed.
- **Components are code; compositions are data.** The components are a closed set: `COMPONENTS` in `kernel.js` lists
  them, each with its props and verbs. A composition is a def, `{ params, node }`, with `{ param: '<name>' }` inside.
  The agent composes; it never writes a component.

## Idioms

`idioms.js` holds the screens games share, as defs. Each one says what it reads and what it emits: today the pause
menu, the options menu and the RPG party screen. A new idiom is a def first. It becomes a component only when no
composition of the existing components can draw it.

## The host contract

```js
const rt = manaUi.runtime({ screens: { pause: node, … }, defs?, start? }, {
  read: (path) => value,        // the game's state: bus vars, store slices, a kernel's query
  act: (effect, from) => {},    // every effect but open / close / back
});
rt.press('down' | 'up' | 'left' | 'right' | 'accept' | 'back' | 'tabNext' | 'tabPrev');  // the controls kernel's menu scheme
rt.open(id); rt.tick(); rt.view(); rt.state();
manaUi.mount(el, rt, { auto: true });   // the DOM backend: keys, pointer, a frame loop
```

`window.__manaUi` is the runtime on a page, for tests and the audit (the precedent is `__mojRpg`).
`manaUiPage(spec, { state })` is a self-contained preview over a plain state object.

## Disciplines

- **Self-contained.** `buildManaUi()` references nothing outside itself, so a page runs `manaUiSource()`, as it does
  the controls and RPG kernels. A page that uses no mana-ui carries no byte of it.
- **Bounded.** The folder imports nothing outside itself (`boundary.test.js`). What it needs from mojulo comes through
  the host and the page's tokens. This lets an engine backend read the same spec, and lets the folder become a package
  of its own unchanged once a second consumer exists.
- **Deterministic.** There is no clock, no dice and no DOM until `mount`. The same spec and state give the same HTML.
- **Values first.** Focus is a shape (the ▶ marker and an inset rule), a better compare is ▲ and a worse one ▼, and a
  low bar is striped. Colour adds to what already reads in black and white.

## The migration, in order

Each step either draws the same bytes or names the change it makes to what a page emits.

1. The RPG channel's party menu, skill tree and shop, through a bridge from the RPG kernel's `partyOf`, `statsOf`,
   `gearOf` and `treeOf`.
2. Playscape's menu kinds (read, talk, confirm, shop, chest, inventory, save, map, list) drawn by mana-ui components.
3. The front of a game: title, pause and options (a settings store), controls (the controls kernel's legend and
   capture), loading, mode select, character select (one cursor per seat), arena select, results. Both shells and the
   versus pause move onto these screens.
4. The theme made one: the guide, the register's dials, the borders and the inventory dress laid over mana-ui's sheet,
   the font shelf's faces for the HUD, and the broadcast packages' contrast checks as a law.
5. The engine handoff: the same spec as Unity UI Toolkit (UXML and USS), then a Godot theme and scenes.
