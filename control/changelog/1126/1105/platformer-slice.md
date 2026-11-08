### A platformer's first level, made from its hero's tuned motion

- **The hero plays its own jumps.** A feel written with `takes: true` (`feel: { pole: 'jumping-giuseppe', takes: true }`)
  plays the hero's own jumps on the feel card's flight, in place of the animation library's held leap: its standing jump
  from a stand or a walk, its jump forward out of the run, and its double jump's second push for an air jump. Each clip
  plays its gather over the card's wind-up, its air over the flight (the rise to the apex its first half, the fall its
  second, read off the body's vertical speed, so a jump cut short carries its clip on and never skips), and its landing
  over the card's landing frames; walking off an edge plays the standing jump's fall. The run picks its stride cycle up
  where it left it. The jumps are compiled onto the hero's rig at play, beside its clips, so a hero made by a run and one
  made with `create_character` both play them; the library's run and walk stay.
- **Squash and stretch on a rigged hero.** The card's `look.squash` (Jumping Giuseppe 0.28, Galaxy Boy 0.22) scales the
  hero about its feet with its volume kept: sunk into the gather, stretched by the flight's speed (none at the apex),
  squashed on landing and sprung back over the landing's frames. The readout says the look is partly carried (the
  smears are not).
- **The card's moves, with its takes.** A feel with `takes: true` also plays its card's wall and dash, as the action lab
  tuned them. Falling against a wall with the stick into it slides down at the card's speed; a jump on it (or a few
  frames after leaving it) kicks off it, up and away, the stick locked out for the kick, so a single wall is climbed kick
  after kick with the stick held back to it. A person's F dashes, and a dash is a burst, not a run: the card's frames
  long whatever the button does, it gets up to the card's speed over its first quarter, holds it, and eases back to the
  run's by its end, the hero holding a lunge (the running jump's gather) rather than taking strides. In the air an air
  dash is the same burst, the fall stopped while it is at speed and given back as it eases, once an airtime, given back
  by the ground and the wall; a jump in a ground dash is a dash jump that keeps the burst's speed to the touch-down, and
  a kick with the dash held kicks at the dash's speed. A card's held dash is not carried. Jumping Giuseppe has no dash
  (a mascot platformer runs faster on a held button). The level's legend names F as the dash. The readout says the
  dash is partly carried (its invincible frames and its cancel are not).
- **The reach of a feel.** `feel/reach.js` measures what a feel's hero can cross by playing the rule its game ships
  (the card over the hero's own) in the runtime on scripted presses: the tapped hop, the jump from a stand, the running
  jump, and the air jump at the apex where the card has one. Each move's arc, its height, the widest gap of level ground
  it clears and its air time; `reachAt(move, up)` is the farthest ledge it lands on at a height above or below the
  take-off. Jumping Giuseppe's running jump clears 4.4 m and rises 1.8 m, his air jump 7.7 m and 3.4 m; Galaxy Boy's
  running jump 3.8 m and 1.6 m, with no air jump. With the takes, the dash jump and the air dash join (Galaxy Boy's dash
  jump clears 5.7 m), and the wall's kick and climb (about 1.6 m a kick for Galaxy Boy). The level's segments are sized
  by it.
- **Enemy density, a trail's.** A level's foes take `density`: foes per free beat of a stage (0 to 4, or none, sparse,
  even, dense, swarm), or one per trail node (`{ meet: 'sparse', gauntlet: 'dense' }`), a node it does not name standing
  the even rate. Below one the beats are skipped evenly along the trail; above it the rest stand round the beats, as a
  count's do. A count is a total and a density a rate: a level names one. A level that names neither stands one foe a
  beat, as before.
- **A 3D platformer's cameras.** The world's `camera` takes `follow` and `orbit`, both a chase the hero runs by: W A S D
  move the way the camera looks. `follow` turns by itself, easing behind the hero's run and holding while the hero
  stands, turns fast or runs back at it; `orbit` is the player's to turn (a drag, the right stick, its yaw and its
  pitch), the legend saying the look. Both hold their height through a jump and follow a drop past their band. The
  third-person chase is the one it was.
- **Absent `takes`, nothing moves.** A feel without it lowers to the rule it did, and the page's renderer carries the
  squash only when a rule asks for it; the platform rule's source in the page gained the takes' branch (re-pinned).
- **The course: a platformer's level over a trail.** A level takes `course: { teach, verticality? }` over every trail of
  its walk, or one a trail node: its floors and the gaps between them laid along the trail's own line, each gap sized
  by the hero's reach and tagged with the move it teaches. `basic` widens gaps and steps the running jump clears;
  `meet` is one long flat floor for the first encounter; `advanced` teaches the card's moves in turn, each just past the
  running jump and then tested (the air jump's higher step, the dash jump's wider gap, a face kicked up the wall);
  `gauntlet` lays basic gaps between floors long enough to fight on; `boss` one long floor. Verticality is flat,
  rolling, climbing or towering. The floors are walkway tiles that follow the trail's turns, stairs lead up onto the
  course and down to the exit, and a fall into a gap puts the hero back on the floor it left. The course's floors are
  the stage's beats, so its foes (at their density) stand on them. Its laws join the level's readout (each gap's width,
  rise and what its move reaches), and a card teaches it (`gameworld-course`). It plays from the side or in 3D, on the
  same level, lit and dressed as every game's.
- **A course seen from the side is a side strip.** A side camera's course is no longer laid on a whole trail: the
  geocube's `show: 'side'` (`era/geocube-side.js`) builds what a side-scroller shows. The course is the level, on a
  straight lane the trail's length: its runs drawn as columns down out of the frame in the cube's layers, a terrain run
  a turf cap over a dirt band over the rock's beds and joints (the beds level across the level, so a gap shows the same
  strata on both sides), a built run (the floor up a wall, the stairs) the cube's structure, a trim cornice over ashlar
  in running bond; only the faces the camera sees. Behind it a strip of land a little below the floors, the hills with
  their trees and a far range at their own depths, so the parallax is the perspective's; before it a few low hummocks
  held under the hero's feet line (a law). Front-lit as a side-scroller is, in the cube's key colour, ambient and air;
  the level's `style.geocube`, else the meadow's valley. A trail of Jumping Giuseppe's first level ships about 0.3–0.4 MB
  of geometry where its trail shipped 4.3–6.7 MB, and the level designs in half the time. The ground before the first
  step and after the last is the strip's own (`sidePads`); the course's catch zones and laws hold on it as on a trail.
- **A first level played as one.** A level whose trails are all courses a side camera plays is one side strip: its
  trails the strip's segments end to end along one lane, each at its own length with its own course (what it teaches,
  its verticality), the course coming down its stairs to the ground between segments and up again into the next; one
  page from the first step to the exit. Each segment's floors are beats that name their node, so its foes stand at its
  own density (foes.js `foePlacements` by node); its catch zones and laws name their segment. The level is titled by
  its own name (`stageTitle`). Giuseppe's first level: one 410 m run, the game 3.6 MB where its four trails were 7.1 MB.
- **A side-scroller's pace.** A strip's segments are sized by their courses, not their trails' walks: each the least
  line its gaps and floors fit on and a fifth more, its course standing on the ground (no stairs up to it, `coursePlan`
  `lift: 0`), so the hero is on the first floor at once and a beat comes every couple of seconds. Giuseppe's first level
  runs 157 m where it ran 410. The first level stands more foes: a few on the runs (a stomp to learn from the start, none
  on the floor the hero is set down on), dense to meet, a swarm in the gauntlet.
- **Lives and coins.** Two mechanics (`game/mechanics.js`, their cards): `lives` (a hit through its mercy and each fall
  into a course's pit cost one, a `oneup` gives one back, none left fails) and `coins` (each a coin glyph that pops when
  touched, in the air too, counted on the HUD; every `oneup` coins, 30, says `oneup`). A world's `mechanics.lives` puts
  its levels on lives (no `fail-on-death`, the hero's body binds no hp, no hp bar or level badge on the HUD) and
  `mechanics.coins` lays coins along a strip's course: a row along each floor at the feet's height, an arc over each gap
  where a running jump carries them.
- **The side camera on a course.** Its height is eased while the hero stands and held through a jump (`band`), so a
  stair's risers no longer jolt the frame, and the frame holds in from the lane's ends (`ends`, along the lane's chord),
  turning square to the chord near them. Absent a course, a side world lays and frames as it did.
- **Foes on the rail.** A side strip's foes fight in the hero's plane: each waits off the rail, on the land behind the
  lane, and leaps in on an arc to its place on the floor when the hero comes within its wake; on the rail everything it
  does (its own move, the mind's chase, a blow's knockback) is held to the lane (`rule.rail`, worlds/controllable/foe.js;
  laid by gameworld/foes.js hostileCast). A foe without one moves as it did.
- **The run button.** A feel with its takes whose card runs faster than it runs (`ground.sprint`) and has no dash gets a
  run button: F held while running builds the run up to the sprint over a second (Jumping Giuseppe's 6 to 8 m/s), as
  a mascot platformer's run is earned, and eases back over half a second let go; the air keeps it. Momentum, not a
  move: the dash is the burst. The legend and the pause menu say F as the run.
- **F is the feel's.** A hero with a feel's dash or run button owns F whatever its walk pace: a side lane's hero, laid
  with none, fell through to the mobile suit's boost thrusters, so its dash was a held boost at three and a half
  times the run. The pause menu's rows say the dash and the run where the hero has them.
- **Controls in the menu.** `mechanics.legend: 'menu'` keeps the controls off the play screen (taught only in the pause
  menu, as a game ships); absent, a level shows them for its first seconds as before. A side camera's level has no
  radar: its screen is the lane.
- **A merged foe can be targeted.** The target rim and the i-frame shimmer read a merged figure's one skinned mesh (its
  bone list holds bones, not meshes); the rim was throwing on it and stopping the page the moment a foe was in reach.
- **A platformer's first level.** `gameworld/first-level.js` lays it as the team's output unit and the production's
  slice: four trails in teaching order, basic (rolling, no foes), meet (one flat floor, foes sparse), advanced
  (climbing, no foes) and gauntlet (foes dense), each its course and its foes' density, every gap sized by the hero's
  reach. Laid in a world, every trail's course holds its laws as built, and the foes stand on the floors.
- **A boss when the creator asks.** A fifth trail, its course one long floor, and the level's `goal: { boss: { win } }`:
  the boss's fall is a win of one of three kinds, a jobber (thrown away), a rival or a boss (each a story hook). The kind
  changes nothing in the fight, its reward or its exit; `storyWins` reads the story so far in the book's order, for the
  next level's build. A level's boss goal is still `true` where no kind is said.
