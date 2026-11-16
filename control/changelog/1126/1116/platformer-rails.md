### The platformer's rail in two dimensions: a 3D Jumping Giuseppe, the side-scroller as it was

- **One rail, two games.** `gameworld/platformer-game.js` lays a mascot platformer from its feel to a game whose first
  level is laid and whose flow is said, each level a turn (set up, load, play, pause, results) the play shell runs:
  `platformerGame({ dimension })` answers the words to write on a gameworld. `2d` is the side-scroller as it was: the
  side camera, the first level as `firstLevel()` lays it (one strip, one page, one turn), no flow of its own, so a
  side-scroller made before the rail and one made by it are the same game. `3d` is new and opt-in.
- **The 3D platformer's first level.** `firstLevel({ dimension: '3d' })` lays the same teaching order as courses up a
  hill, each trail its own page and its own turn: the grounds (the yard movement is learned in, no foes), the meadow
  (the first foes), the climb (the advanced moves, each floor a tall step up), the ridge (movement and foes together)
  and, when asked, the summit (the boss). Foes stand thinner than a strip's: in the round a foe is walked round as well
  as jumped, on a walkway three metres wide. Absent the word, `firstLevel` lays what it did.
- **Its flow.** A 3D platformer says a flow of its own (`platformerFlow('3d')`): the title, the courses screen (the
  place every course is entered from and left to; each one won opens the next), a course played, its result (on to the
  next course, again, or back to the courses). A course quit goes back to the courses with no result. Its front is the
  start menu that flow is entered through (continue, play, levels): a plain title offers play alone. It is made for a
  screen on its side (`screen: 'screen'`).
- **Coins along a 3D course.** `mechanics.coins` laid coins on a side strip only; a trail's course (a 3D platformer's)
  now carries them too (`trailCoins`): a row of three along each floor where the feet pass, an arc of three over each
  gap, on the trail's own line. A world without the word lays none, as before; a 3D course world that already said
  `coins` gains them on its next run.
- **Offered by the design door.** A world that plays a platformer's template (its feel, or what its brief or genre
  points at) and has no course is offered the rail in `design_game`'s readout: `next: first-level`, a ready patch that
  keeps what the world already says (its lives, its camera, its levels) and starts it on the level it lays. 2D unless
  the camera (`orbit`, `follow`) or the brief (3D, Mario 64) says the round, the other dimension beside it as `or`
  (the round is Jumping Giuseppe's; a run-and-gun stays on its lane). A book with no level yet gets the same in the
  start readout, as the words its first write takes. It says what it cannot lay: a platformer watches its hero, and a
  world with no character book is walked first person until it has one; a stored world's upright phone screen is
  advised, never changed. Offered, never laid.
- **A world without a book keeps its flow.** A gameworld with no character book dropped a flow of its own when its
  game was made (only `flow: 'play'` was carried); it now carries it, its levels the refs of their first stages, as a
  world with a book does.
- **The course card** teaches the two dimensions and the step.

Not yet: the machine gate walks no level on lives or coins (a platformer's first level is the creator's to play, in
either dimension); courses are titled `<level> · <node>`; lives start over on each course; the card's context jumps
(the long jump, the backflip, the triple jump) and a hub that is a place rather than a screen.
