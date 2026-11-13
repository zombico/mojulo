### A running game's UI on mana-ui: the in-play HUD, themed from the premise

In progress. On a course game nothing shown in play was mana-ui's: the controls as a line of text, a bare gauge, the
shell's own markup. The plan: a HUD host on the level page, a runner HUD as one composition, the shell's screens, the
phone, and a theme that comes from the dress's premise.

- A HUD host on a level page (`scene/channels/mana-hud.js`): one mana-ui runtime over a state the page feeds each
  frame. A level's `manaHud: { spec, theme, feed }`; a level without one carries not a byte of it.
- The runner HUD (`gameworld/course-hud.js`), carried by every course level: how far along the course and how many
  metres are left; which map of the run this is, as pips (the shell hands a level its place in the run,
  `params.__run`); stamina as a themed bar; a start cue that holds the hero (3, 2, 1, then GO); on a run's first map,
  what to do in the device's own glyphs. Laid by the course's thirds: nothing in the bottom band, the character's.
  The text legend and the runtime's own gauge are not shown on such a level.
- A dress names its UI theme (`ui`). A look is chosen by the game's style (who the hero is, its tone, where it is
  played), not by an object of its setting: Last train wears the library's friendly look (`idol`) until a family for
  casual mascot games is drawn. A new card, the departure board (`playscape/ui/theme-cards/departure-board.json`), is
  on the shelf for a sober railway game.
