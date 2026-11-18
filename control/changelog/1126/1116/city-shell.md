### The open city as a game: its title, continue, and its end

- **A level's own save** (`level-contract.js` `MSG_SAVE`; the level's game block `save: { vars, on }`, opt-in, the game
  channel's): a level that is one long game (a played city with jobs: `levels.js` `CITY_SAVE`) sends what it keeps (the
  jobs' and factions' flags, the bag, standing, a one-off handed in, a mission passed) to the shell as it is earned (a
  job taken or done, a mission passed, a side joined, a gun's rounds bought, a respray), with "Progress saved". The shell
  (`play-shell.js`) keeps the newest in the browser; CONTINUE goes to it and hands it back, the level setting it again
  and raising `resumed` (a mission taken and not passed picks up); START is a new game, what was kept forgotten.
- **A story city's front** (`runner.js` `STORY_FRONT`, a world with missions and no `front` of its own): the title in
  the lower third, CONTINUE (once there is a save), START, OPTIONS and CREDITS; the last mission's win is the end card,
  GAME COMPLETE · THE END, then the credits.
