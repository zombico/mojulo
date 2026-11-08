### A walked world that holds, and a HUD that reads as a game

- **Trees and rocks are solid.** A glyph map asks each of its tiles for its flora solid (`tile.solid`): the meadow kit
  stands a collider on each tree's trunk (about its foot, to 3.5 m) and each boulder (its faces' box drawn in a little;
  a stone the feet step over left out), so the hero walks round them. The map names the groups that are no footing
  (`footless`: a tree's crowns, its leaves and blossom, a stamped tree), and the page takes them out of the ground probe,
  so walking into a crown no longer lifts the hero up through its leaves (the float). A tile not asked is unchanged.
- **The adventure look (mana-ui).** A theme takes a new word, `hud: panel | bare`, and a new preset, `adventure`: an
  action game's HUD on the scene itself, never a card. `gameHudCss(theme)` writes the in-game HUD's sheet for a bare
  look: the HUD's parts with no plate, their words outlined; meters slim and framed in a hairline with cut ends, their
  numbers left to the status page; the pilot's hp up at the top left and its stamina a slim gauge under the hero; banners
  and toasts in the display face.
- **A world names its HUD's look.** `hud: '<mana-ui theme>'` (the interface chapter's `/hud`): its levels' HUD wears it
  (`events.look`), a bare look drops the level badge (the level stays on the status page and in the level-up banner),
  and its game's play shell leaves the menu button off under a mouse (the pause is Esc; a finger keeps the button).
- **The guide, one thing at a time.** The way on, a beat's keys, its line, the intro and a held way's word share one
  place at the top of the screen and never stand together: a line just said, the opening (the pitch, then the arrival's
  keys), a held way, the lesson at hand when the hero nears a beat that teaches (its keys as caps), else the way on. Its
  words sit on the scene, outlined. A meet's way on names who is met; what they say is said on reaching them.
- **Fixed:** the stamina gauge's green and its WINDED read the platform rule's `stamina` again (the 1105-rc merge had
  renamed it, so the bar fell back to the mobile suit's cyan).
