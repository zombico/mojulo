### A new game fills its window: no phone frame unless one is named

- `design_game` no longer writes `screen: 'phone'` into a gameworld it starts (`game/screen.js` `NEW_GAME_SCREEN` is
  now none). A new game is framed for no screen and fills the window it is given; a game meant for a phone names it
  (`screen: 'phone'`), as a tablet or a monitor game names theirs. A gameworld already stored with a screen keeps it,
  and a genre form that names its own screen (the endless runner's phone) still does.
- The action RPG's row, whose game fills its window (`screen: 'fill'`), writes that as `screen: null`
  (`gameworld/compose.js`), the world's word for no frame, where it used to leave the key out. Left out, the key read
  as "none named" and took the default, so the game from a sentence stood upright in a strip on a desktop with its
  hearts outside the frame.
- The action RPG's land as the meadow card draws it (a genre hero row's `land`, `hero-rows.js`, laid by
  `gameworld/compose.js`). Its rocks and cliff lips are bare: `hats: false` is now a glyph map's word and a region's
  (`level/grid.js`, `gameworld/world.js`), carried to each tile's stage (`era/isekai.js`). Its sky and air are the
  card's own (`land.sky: 'card'`): the card's dome and haze colour written as the cube's `light.sky`, its thin haze as
  `light.outsideFog`, where the cube's solved sky was a dull blue-grey under nearly three times the haze. The sun
  stays the cube's reference's. Any other genre's world, and a map that says no `hats`, is as it was.
- Gates: machine (the screen, row and design_game tests). Eyes: not claimed.
