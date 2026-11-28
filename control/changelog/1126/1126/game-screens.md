### The game's screens: an opening that loads the level, a chapter's card, the end said as a screen

- The results (`scene/channels/game-screens.js` resultsScript, the game channel's): every game's level now ends on a
  results screen, not a card: in wireframe (hairlines, corner brackets, a faint grid, spaced capitals),
  the result's word (a level's noun: "Mission complete" on a frame's operation, "Level complete" elsewhere; `complete.text`
  retitles it as before), the level's name, what it kept on dotted leaders, its rank where it has one, and Play again
  when it is played on its own. Painted in the level's own look: the world's interface theme (`ui.theme`, its ink,
  panel, line, accents and harm, carried on the contract as `game.look`), else the page's tokens.
- An objectives list that retries keeps its retries for the results.
- A level's opening (`levels.<id>.opening`: `{ title?, kicker?, chapter?: { label?, name? }, press? }`): played on its
  own, the level opens on its title screen, which loads it: a bar that fills as the world comes up, the land is laid,
  every object in the scene is drawn once (hidden or out of view, so each material's program is built and each mesh is on
  the card: a camera turned after the opening onto what its shots never saw builds nothing then) and frames are drawn,
  then "Press any key". The level waits for it (its start, its scenes and the
  pilot's keys), so nothing after the opening scene waits on the build. Pressed, a chapter's card on black (Chapter 1,
  the level's name unless it says) fades off as the level begins under it. A hosting shell keeps its own front.
- The level's contract names its game and itself (`game.title`, `game.name`) for its screens.
