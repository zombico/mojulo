### Game UI that reads, moves and sounds like a game, not an app

- **Research behind it: how game UI differs from app UX.** `docs/game-ui-research.md` sets game UI against the SaaS look
  generated UIs default to (a 4 px rhythm, gentle type steps, grey hierarchy, one radius on everything). It covers the
  style schools, how each kind of screen is built, the type, hierarchy, spacing, motion and sound, and what studios
  hold to, then maps it onto the game UI runtime (internal name mana-ui) as a sequence of work. This is the first step
  of that sequence.
- **A screen is a frame, sized by the screen and by how far away the player sits.** Every length in the runtime's sheet
  is now in units of 1px at a 1080p reference, scaled by the stage's height, so a screen keeps its proportions at any
  resolution instead of reflowing like a page. A theme's new `distance` word says where the player sits: `desk` (the
  default), `couch` (everything larger by the ratio of Xbox's console and PC text minimums) or `hand` (a phone, in CSS
  px). Screens and the HUD's places sit inside a title-safe frame, 5% in from each side. The player can set text up to
  twice its size.
- **Fewer type sizes, bigger jumps between them.** Captions and labels sit at the floor, body text a step above it,
  titles at twice the body and the display role near four times. Headings are in the main ink colour instead of small
  grey uppercase labels, and an option's own name is body text.
- **Text over the world keeps a halo.** Text with no window behind it (a title screen's menu, a screen's own title, a
  banner) gets a halo in the panel's colour so it reads over any scene. A theme's new `halo` word picks an outline (the
  default), a glow, a hard shadow, a plate behind it, or none. Subtitles sit on their own plate, and the player sets its
  opacity. A theme's ornaments are no longer drawn on transparent (ghost) windows.
- **What the buttons do is a bar at the foot of every screen.** A screen's legend is pinned to the bottom right of the
  safe frame. A screen that names none gets one drawn from what it holds: select, change, tabs, and back where back
  leaves something.
- **The UI makes sounds, as effects.** The runtime now emits a sound effect when the cursor moves, a pick is made, a
  value turns, a screen opens or closes, a tab turns, or a disabled row is pressed. The host plays them; the runtime
  ships no audio. A theme's new `cues` word says how many: none (the default), the cursor's only, or all. A world's UI
  guide carries its register's sound setting across, and the wireframe board logs each sound.
- **The focus is the console's ▶ by default, and a highlight bar is a new focus.** The default focus (the greybox)
  marks the focused item with a ▶ at its left, a shape rather than a colour, and it pops as it lands under a theme that
  moves. A theme can still choose a ring, or the new `bar`: a solid block at the item's leading edge with the accent
  fading behind the words.
- **Title and attract screens look like a game's.** The title screen puts key art behind, the game's name and a large
  menu in the left third, and the version in a corner. The attract screen puts key art behind and a "press start"
  prompt that breathes slowly; any face or shoulder button starts the game, and the effect says which player pressed.
- **Menus lean, and a cover passes between screens.** A theme's new `slant` word leans tabs, bars, banners, keys and
  buttons (never a window), the diagonal energy most game UI schools share. A new `transition` word draws a cover over
  the screen as one screen gives way to the next: a wipe, a diagonal slam, an iris, a shutter or a stepped wipe, mirrored
  on the way back. The `modern` preset is now clean glass (a cool translucent plate, a light lean, a highlight bar)
  instead of a dark dashboard card. A heavy frame now makes the inner parts heavier too, and a window inside a window is
  drawn lighter.
- **A world's UI and a sport's broadcast carry their energy across.** Passing a game's juice register to the guide
  bridge makes an anime game's menus snap, lean and slam between screens, and a western one's wipe. A broadcast whose
  plates lean now leans its menus and wipes between them.
- **Numbers count up, and a results screen plays in sequence.** With the game's clock, a number that changes counts to
  its new value, with a tick sound. The results screen slams its outcome in, counts each figure up from zero one after
  another, then stamps the rank on; pressing confirm while it counts lands every number at once.
- **Damage numbers, toasts and feeds read like a game's.** Damage numbers sit bare over the world with a halo, pop in
  large and rise, coloured by their kind, a critical hit larger. A rare toast is held longer, gets an accent edge, a
  sheen and its own sound, and a toast can show an icon. A new achievement toast slides in at the bottom right. A feed
  merges a line said again in a row (×3). Fighting games' health bars are thicker.
- **Grey means unavailable.** Labels are now in the main ink colour at a lighter weight; grey is kept for disabled items
  and captions.
- **A held direction on a pad repeats, and flashing is the player's to turn down.** The controls host repeats a held
  direction after a short delay, as a held key does. A new less-flash option (separate from less motion) drops the
  cover between screens, the sheen and a change's flash. Every repeating animation runs under three times a second,
  checked by a test.
- **A window sits on a thing that sits on a thing.** Five new theme words build game UI in depth. `material` lays a
  surface on every plate: parchment with fibre and burnt edges, paper, a blueprint grid, a CRT's phosphor lines,
  halftone, brushed metal, or blurred glass, all drawn in the page with nothing loaded. `backing` puts something under a
  window: a slab offset in the accent, two slabs at an angle, a torn darker sheet, or a riveted plinth. `crest` rides an
  ornament over a window's top edge: a Victorian cresting of scrolls, a hatched tech tab or a ribbon. `breakout` lets
  words out of the box: a window's heading as a tab across its edge, and a title echoed huge and hollow behind itself.
  `overlay` lays a still filter over the whole screen while the UI is up: scanlines, a CRT, a grid, a vignette or grain.
  The presets wear them (storybook on torn parchment under a cresting, arcade on slabs with breaking-out titles, console
  on a riveted plinth, terminal on a grid under a CRT); the greybox stays flat.
