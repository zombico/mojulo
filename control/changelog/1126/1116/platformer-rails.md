### The platformer's rail in two dimensions: a 3D Jumping Giuseppe, the side-scroller as it was

- **One rail, two games.** `gameworld/platformer-game.js` lays a mascot platformer from its feel to a game whose first
  level is laid and whose flow is said, each level a turn (set up, load, play, pause, results) the play shell runs:
  `platformerGame({ dimension })` answers the words to write on a gameworld. `2d` is the side-scroller: the side camera,
  the first level as `firstLevel()` lays it (one strip, one page, one turn). `3d` is new and opt-in. What the 3D game
  gained, the side-scroller has too: a flow of its own, a start menu, a screen on its side, the look.
- **The 3D platformer's first level.** `firstLevel({ dimension: '3d' })` lays the same teaching order as courses up a
  hill, each trail its own page and its own turn: the grounds (the yard movement is learned in, no foes), the meadow
  (the first foes), the climb (the advanced moves, each floor a tall step up), the ridge (movement and foes together)
  and, when asked, the summit (the boss). Foes stand thinner than a strip's: in the round a foe is walked round as well
  as jumped, on a walkway three metres wide. Absent the word, `firstLevel` lays what it did.
- **One flow shape.** Both say a flow of their own (`platformerFlow`): the title, a level played, its result (on to the
  next, again, or home); a level quit goes home with no result. The 3D platformer's home is its courses screen (the
  place every course is entered from and left to; each one won opens the next); the side-scroller's is its title (its
  first game is one level, so it has no levels screen yet). The front is the start menu the flow is entered through
  (continue, play, and the 3D game's levels): a plain title offers play alone, so a save could not be continued. Both
  are made for a screen on its side (`screen: 'screen'`).
- **Hilltop, a look for a mascot platformer.** A theme card of the toy family
  (`playscape/ui/theme-cards/hilltop.json`), the rail's `ui.theme`: cream sticker plates in a thick cocoa outline with
  a hard drop shadow, round letters, tomato red for what matters, grass green for what is going well, coin gold for
  what is won; a sunburst on warm yellow behind the title, dots behind a full page, confetti on a result, nothing
  behind a menu laid over play (a pause leaves the level in sight); screens open and close on an iris; chunky
  pictograms in the colour of what they mean. Its contrast advice is empty.
- **The hero is a mascot by default.** The rail's patch writes the mascot's body (`characters.direction.body:
  'mascot'`, chibi-sized: a big head on a small round body) on a character book that names no body; a body the creator
  named is kept, and a world with no book is told the words to write.
- **A course in the round is skinned.** A 3D course's floors and stairs were grey boxes; they are now drawn as part of
  the place (`gameworld/course-skin.js`), as the side strip's are. A floor is the land it stands on lifted up: a turf
  cap over a dirt band over rock, in the stage's own kit colours. The stairs and a floor reached up a wall are masonry,
  a trim cornice over stone, in a geocube's colours. Which cube is read from what the level needs: the level's
  `style.geocube`, else the world's, else the cube made for the kit the stage stands on, else the meadow's valley, so a
  world that names a cube restyles its course's masonry with everything else. Every box keeps its footprint, its top
  and its foot, so the course's laws hold as built. Every 3D course world gains the skin on its next run.
- **A course is sized by what its hero clears.** The course's lift over the ground and a floor's thickness are shares
  of the hero's running jump (`course.js` `liftOf`, `slabOf`), no longer fixed metres: the lift a little over a jump,
  a floor in the round a slab about two thirds of a jump thick where it was a column down to the ground. A floor still
  reaches down past a lower floor beside it, so a step's or a wall's face is whole. A climbing course's floors are
  under half the height they were drawn at; tops, footprints and the course's laws are as built. The side strip draws
  its own columns and is unchanged.
- **A platformer's hero holds nothing.** The rail writes no item, and a book whose hero carries some is told
  (`advise`): a platformer's hero runs, jumps and stomps with empty hands. The items are the creator's to take off.
- **Two geocubes for a mascot platformer.** The existing cubes are places with a history (limestone, red roofs, a
  stone night): none is light in weight and none is active. `sherbet-orchard` is the platformer's own, the rail's
  `style.geocube` in both dimensions: warm pastels solved by the colour theorist (a peach floor, plum blossom, cream
  blocks), one mint accent, the only cool colour on the land, the values in three masses so a platform reads at a
  glance; rounded land with no far cliff, quiet surfaces. `toy-hill` is its sibling: clean greens, cream blocks and a
  bright clear sky, one tomato red. Both palettes hold every law of the theorist. The rail writes the orchard on a
  world whose style names no cube; a cube the creator named is kept.
- **A cube that paints the land colours the course's floors.** Where the level or the world names the cube, a course's
  turf, dirt and rock are read from the cube's own outside, as the side strip reads them, so a floor is the same land
  as the ground round it. A stair is stone alone (a tread is about as tall as a cornice), and the trim is a stop
  lighter than the stone.
- **The side strip's land is dressed.** The land behind a side-scroller's lane was a bare terrace and one row of like
  trees. It is now dressed by principles lifted from a running course's dress and turned on their side
  (`docs/side-strip-principles.md`): the terrace in slices, A a grove (trees of unlike sizes, a bush, a stone) and B
  open ground, ordered by the walls' rule (never three alike, never a pair repeated); the grove at the terrace's back
  and only low things at its front, so the band the hero runs in stays the hero's; tufts on the nearest land, where
  speed is read; clouds set low, since a side camera looks down; a small tower in the cube's accent past the lane's
  end. Three laws join the strip's (`rhythm`, `behind`, `quiet`). Every side strip gains the dress on its next run.
- **Scoops: a shape family for a side strip.** A geocube describes a place to walk round in; a side-scroller shows a
  stack of silhouettes, so a strip may now be drawn in a shape family (`era/geocube-side.js` `SHAPE_FAMILIES`), named
  by its cube or by the strip (`side.shapes`). `scoops`, the sherbet orchard's: every shape a dome or a circle. Hills
  in three rows of domes, each about 1.6 times the one before it and a step further into the air; round crowns; puffed
  clouds; a domed tower; turf that hangs over a floor's edge in scallops; all flat and facing the camera. A shaped strip
  is framed by a camera nearly level and a little over the hero, so the sky and the far rows are in the frame (the
  default looks down and shows mostly ground). A law joins the strip's (`one-family`). A cube with no family is drawn as
  it was.
- **Light as shapes, and a more vivid orchard.** A shaped strip is flat, so the seventh generation's lighting
  principles are drawn as silhouettes: one key every shape agrees on (a lit cap on each dome and each crown toward
  it), air with a colour (a far row goes toward the sky's own hue, not toward white, and mist pools at its foot),
  contact (a soft shadow under each tree and bush, the turf's lip shading the dirt), and a lit line along a floor's
  edge. A law joins the strip's (`one-light`). The sherbet orchard's palette is more active and its blossom is locked
  pink (the solve's own foliage was a dark plum; the lock loses the value-groups law, said on the palette), and the
  rail grades the frame `vivid`.
- **The orchard is drawn in the seventh generation.** `sherbet-orchard` names `era: 'gen-7'`: its levels take the live
  light (what moves casts a shadow each frame, the land its own shadow map at its hour, contact occlusion), in both
  dimensions. A world that wants the lighter render names the cube with `era: 'gen-6'`.
- **A side-scroller's foes stand on the rail.** Every foe of a side strip waited on the land behind the lane and leapt
  in as the hero came near, so a player could not see what a jump was being timed on. A foe now stands on the rail
  from the start, in the hero's plane (a swarm's extra foes are brought onto the lane and spaced along it, no two in
  one spot). An ambush is rare: one foe in six, never one of the first four, still waits off the rail and comes in
  (`foes.js` `RAIL.ambush`, `railAmbush`).
- **Lives and coins are pictures.** The `lives` and `coins` mechanics say their HUD readouts as counters, so a look
  with pictograms draws a heart and a coin beside the numbers.
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
(the long jump, the backflip, the triple jump) and a hub that is a place rather than a screen; the shell's own words
(levels, Modes, Players) are not the game's to rename yet, so the courses screen says "levels".
