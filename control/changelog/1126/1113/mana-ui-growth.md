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
