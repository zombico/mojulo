### mana-ui grows: pictograms, and four more families of looks

In progress. The game UI runtime had a place for an icon and drew a name's initials there, and its looks were mostly
dark and serious. The plan: pictures and icons, one HUD host for every level, layout that adapts, touch as a device,
the parts every game composes by hand, more motion, a layout law, and a handoff to engines.

- PICTOGRAMS (`mana-ui/icons.js`): fifty of them (what is counted and kept, what a body has and meets, where things
  are, what a menu does, what a hand does), one outline each on a 24 grid, with the other words a game says for one
  (`coins`, `time`, `hp`, `settings`). A theme's `icons` word says the style they are all drawn in: `solid`, `line`,
  `chunky` (filled and fattened), `badge` (on a round plate of the accent), `duo` (the outline over a pale fill of
  itself). Nothing is loaded: an icon is a mask in the theme's sheet, in the ink of the words beside it.
- The runtime names an icon and the sheet draws it: an `icon`, a counter's `icon` and a prompt's glyph carry
  `data-icon`. A name with no pictogram keeps its initials; a theme that says no style (every preset) is as it was.
- FOUR FAMILIES of looks, two cards each (`playscape/ui/theme-cards/`): `broadcast` (matchday, floodlight: read from
  across a room), `cosy` (picnic, knit: made by hand), `clean` (lightdeck, orbit: exact and airy), `dread` (dread,
  static: restraint). Each has its icon style and its stages. The shelf's README names every family and what it
  holds to.
- The toybox draws its pictograms chunky; the runner's HUD counts coins beside a coin.
- The pictograms take more of the theme. Three more styles, each a hand of its own inside the icon's picture:
  `sketch` (a pencil line that wobbles, gone over twice), `stencil` (the silhouette with a bridge left across it),
  `glow` (the line and its light round it). `iconTone: 'meaning'` draws each icon in the theme's colour for what it
  means (a heart the health's, a bolt the stamina's, a skull the harm's, what is won the accent), where `ink` keeps
  the words' colour. A badge's plate is the theme's corner (round, soft, square, cut), its silhouette the ink the
  theme reckons reads on it. `iconSwap: { coin: 'ticket' }` is a look's own picture for a word.
- The cards say theirs: matchday stencil, picnic and dread sketch, orbit glow, knit badge, floodlight and lightdeck
  line, static solid, toybox chunky; matchday, picnic, knit, lightdeck, static and toybox in the colours of meaning.
- One HUD host for every level. A world that says a `ui` has its levels' own HUD rows (`events.hud`) drawn by the game
  UI runtime, in the game's look: `game/hud-mana.js` lowers readouts, bars, counters, clocks, banners, toasts and
  legends to one composition, and the page's host (`scene/channels/mana-hud.js`, the course's, made general) reads the
  level's bus into it each frame, gates a row by its part and its phase as before, and draws the pilot's health and
  sprint beside them. The host is laid over the scene's own frame. A world without a `ui` emits the bytes it did;
  carved titles stay the title channel's. A level whose pages change: one of a world with a `ui`.
- Layout that adapts. The frame a view is drawn in is state the runtime holds (`rt.frame`, measured by a mount from
  its own box and again when it changes), and a spec branches on it: `{ frame: 'portrait' | 'landscape' | 'narrow' |
  'short' | 'hand' }` in a `when` or an `unless`. A `stack` says what it does out of width (`fit: 'wrap' | 'stack'`).
  The runner's HUD is one composition for both frames now, laid again when a phone is turned, where it was two specs
  chosen at emit. A page with a course HUD emits different bytes; a spec that names no frame draws as it did.

