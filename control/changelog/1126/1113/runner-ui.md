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
  played), not by an object of its setting. Last train wears the toybox (`playscape/ui/theme-cards/toybox.json`, the
  first card of a toy family for light games with a mascot hero): round glossy blue plates with a pale rim on a
  plinth, white rounded letters, yellow for what matters, sized for the hand. The departure board
  (`departure-board.json`) is on the shelf for a sober railway game.
- On a tall frame the HUD is one plate in the top's middle (the run over the stamina, the progress beside them),
  clear of the shell's menu button in the corner. The metres left are said as words the host writes, so a number that
  falls every frame is not marked as news every frame.
- The HUD begins when the game's channel has started, which on a game's level is some frames after the page: the
  shell's params, the run among them, are in hand by then.
- The HUD counts the coins taken (the level's own, off its bus) and the page's old widget rows stand down beside it.
  On a tall frame the metres and the coins sit under the progress, so the plate stays clear of the menu button.
- The shell's screens on mana-ui for a course game. A world of obstacle courses that says no `ui` still has its
  game's screens drawn by the game UI runtime, in its first course's look (the dress's `ui`); a world's own `ui`
  wins; a course whose dress names no look keeps the shell's own screens.
- A run's title says its rules under the name, how deep the best went in the corner, and "start a run" / "new run".
- The pause is mana-ui's pause menu over the held level (resume, restart, controls, sound, quit; back resumes), with
  the level's own controls on a screen of their own. The shell's panel stays down for such a game.
- A map cleared in a run is a moment over the play, with its seconds, and the loading screen on the way to the next
  says what was cleared and which map is next.
- A run's result says the map it ended on, the seconds played (the shell's own clock: from a level's first frame
  shown, its pauses taken out), and what its maps kept that adds up (coins), and stamps a rank on a run cleared.
- A course level keeps its coins (`score`, counted high) so a result can say them.
- `create_game` carries a game's `ui`, `screen` and `hud` into its manifest. A gameworld's run handed them over and
  they were dropped at the mint, so a world's `ui` never reached its made game; a remake keeps them, its `front` and
  its `run` too.
- The image component's placeholder marks are not shown on a game's screens (a backdrop keeps its ground).
