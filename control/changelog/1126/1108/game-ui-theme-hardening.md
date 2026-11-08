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
- **More room, and one more layer behind.** A screen's own window takes more of the screen, rows are taller, a pause
  menu's rows are set at title size, and body text is a step larger. A new `stage` word draws a shape behind everything
  a screen holds (a huge band, a sunburst, shards, stripes or rings) that sweeps in as the screen opens, and the button
  legend sits on its own band over it.
- **The party look is a design language with variations.** The arcade preset's look is written down as principles
  (everything leans; planes stack on planes; words break out; two colours punch against one neutral; print texture; hard
  edges; motion slams; a shape behind; a click under every sound), and four new presets vary it: `rebel` (red, black
  and white with a huge band behind), `idol` (pink and cyan with a ribbon crest and a sunburst), `street` (yellow and
  black with shards and grain) and `mecha` (orange and teal on riveted metal with hazard stripes). A test holds every
  variation to the principles.
- **The focus snaps in from the way you moved.** Moving down, the item you land on snaps in from above with the theme's
  overshoot (from the left when you move right), and the focused item stands out with a small nudge. The cursor's
  sound says which way it went and a stepper's which way it stepped.
- **The UI has a sound library, made with the beats tool.** Six sound sets (glass, console, chip, terminal, paper and
  party) give the cursor click, confirm, cancel, the stepper up and down, tabs, opening and closing, a refusal, toasts,
  counting and skipping. Every set follows one interval plan (confirm rises a fifth to the octave, cancel falls back
  to the root, the stepper goes up a fifth or down a fourth), so the sets belong together, and they are level-matched
  so changing theme does not change loudness. Each theme names its set. Pages and the wireframe board play them through
  the beats engine when handed the library; a page without it stays silent and carries no audio. Each set is also a
  beats sound-effects recipe the beats tool mints and plays cue by cue. A new script, `scripts/mana-board.mjs`, writes
  the board with real controls and sound.
- **Heavy sounds, and bombastic ones.** Four more sound sets join the library. `hydraulic` is servos, pneumatic hiss
  and clamps landing (the mecha preset's). `clack` is hardwood blocks, with a clapper's double clack on confirm, for
  serious games. `crypt` is stone, iron and a tolling bell: a dungeon door that creaks open over grit and slams shut
  with a boom and a falling latch, for grim and souls-like games. `jackpot` counts in coin clinks, confirms with a brass
  stab, and pays out a rare toast with a riser, a boom, a held fanfare chord, bells and a shower of coins. They follow
  the same plan and the same loudness on confirm; the door and the jackpot are allowed to be louder. Three presets wear
  them: `grim` (aged gold on black, a serif, a vignette, nothing that leans), `tactician` (paper and ink with an offset
  sheet) and `jackpot` (a party variation in gold on purple with a sunburst).
- **What appears, leaves and shuffles is choreographed, and heard.** A screen now builds in order: its title slams in,
  its windows rise, then its rows fill in reading order after a short lead, and the cursor lands last. Everything comes
  from the side the screen sits on. Screens, toasts and banners that leave now play an exit instead of vanishing:
  faster than they arrived, accelerating away and never bouncing. Rows that change order glide from their old place to
  the new one instead of jumping, and a row that moved past others shows whether it rose or fell. Opening a screen plays
  its sound plus a soft rising ripple of ticks timed to each row as it lands; rows that come, go or reshuffle are each
  heard once, however many. Every sound set gains these cues. The principles are written down in the game UI runtime's
  design doc.
- **Pressing something is seen, and a pause blurs what it covers.** Confirming squashes the item, flashes it in the
  accent and throws a ring off it; pressing something unavailable shakes it on a red edge. A confirm that opens or
  closes a screen still shows on the screen as it leaves. Two new transitions join the others: a fade (a dip to black
  and back) and a blur-through, and a new `backdrop` theme word makes a pause dim, blur or frost the game and the HUD
  behind it. The grim theme now fades between screens.
- **A game can ship in several languages.** A game's spec can now carry its words in each language it ships, and
  the player can change language as they play. The game UI's own words (a legend's Select and Back, Loading, Rank,
  Turn order, an empty list's Nothing here) come from one table the game's languages can say too, and the shared
  screens and legends use it throughout, so a game's translations reach every screen. A word a language lacks reads in
  English.
- **A language picker, looks as cards, and the game's UI styled in the studio.** The options screen now has a
  language row when a game ships more than one language, naming each in its own words; turning it changes every word
  on the screen. A new look for a game's menus is now a theme card, a small file of words saying only what it changes
  over a look that already exists (the way a WordPress theme is a file), so a model or a person can add one without
  code; three ship to start (Ink and Gold, Blueprint, Neon Rebel). Styling a game's UI joins the studio: a game's
  `ui` takes its look from the register its genre sets and its colours from the world's palette, and the game's
  review says where the look came from and what its colours read like.
- **The words come first.** Wherever a menu has text to read, every look now holds back: a panel's texture (a grid,
  halftone dots, scanlines, parchment fibre) shows at its edges and fades out before the words; screen filters such as
  scanlines and CRT lines cover the picture behind a menu, never its words; words on a coloured highlight or tab take
  whichever colour reads; buttons and tabs lean no further than italic type; glass panels are thick enough to read
  through; words with no panel of their own over a theme's backdrop shapes (a title menu, a loading screen) get a soft
  band behind them; and a preview picture shrinks rather than push a mode's description off its panel. Titles and
  big display words can still perform.
- **Loading screens that behave.** The progress bar never jumps backwards, and when the game cannot say how far along
  it is, the bar sweeps instead of showing a made-up number. Something always moves so the game never looks frozen,
  and a load that stalls says it is still loading. Tips turn on their own or by hand. A quick load never flashes its
  screen; a slow one stays long enough to be read. A button held through the load does not skip the continue prompt.
  A failed load says why and offers retry or a way back to the title. Back does nothing unless the game allows
  cancelling. The screen covers what is half built behind it.
