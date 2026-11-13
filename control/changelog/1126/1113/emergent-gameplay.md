### Emergent gameplay: a game that plays a different map each time

In progress. A level's `roll`: what the session's seed picks on it. The recipe and the page never change; the seed the
game's shell already sends with `game-init` picks, and seed 1 is the reference roll (what a page with no shell, a
capture and the level played in Node show).

- `roll.cover` (`game/roll.js`): groups of the level's `blocks`, named by each block's `id`, of which the seed stands a
  number or any number in a band: `roll: { cover: [{ of: ['wall-a', 'wall-b', 'crate'], stand: [1, 2] }] }`. A rolled
  block is one thing: one render group and one box. Left out, it is gone whole, as if never built: out of the
  colliders, the sight, the nav grid and the scene, with nothing broken and nothing said on the bus.
- `roll.items`: groups of the level's pickups, named by each pickup's `id` in its `collect`, of which the seed lays a
  number or a band: `items: [{ of: ['gem-a', 'gem-b', 'gem-c'], lay: [1, 2] }]`. One left out is not there to be
  found: its zone is no source on the bus, and its glyph and its sparkle are not drawn.
- `roll.start`: the places the pilot may set out from, each written as the pilot's own transform is
  (`start: [{ pos: [x, y, z], heading? }, …]`); the seed picks one. A fall's respawn and a level's doors stay where
  the level wrote them.
- The dice keep their order (the cover, then the items, then the start), so a roll that gains a kind keeps every pick
  of the kinds it had.
- The runtime's roll (`worlds/controllable/roll.js`): whole-number dice, so every runtime rolls the same from the same
  seed (the page's against Node's: 305 seeds, none unequal). Emitted only into a page whose level has a roll; a level
  without one keeps every byte.
- A rolled level says `game-shown` only once it has started, so the shell's veil never lifts on the level as it was
  before its roll.
- A level played in Node rolls too: `simLevel` / `levelSim` take the session's `seed`.
- The seeds audit (`game/roll-audit.js`), a machine gate: a level with a roll is many maps, so a sample of its seeds
  (24, from 1) is walked in Node, each rolled by the same dice and held to four laws: the pilot has a body, the way is
  open (from the start the seed picked, through the contract's own walk, and to every pickup it laid), the sample is not one map, and the seeds played through
  (led corner to corner on the nav grid) reach the level's success. It says how many seeds it walked and which failed,
  by seed; it never refuses. `create_game` answers with it (`rolls`) for each level that rolls, and a `design_game`
  run's level audit carries it.
- The browser's walk of a rolled level proves its reference roll: its one-leg plan is led round what seed 1 stands.
- The roll room (`gameworld/roll-room.js`), a practice room: a world whose levels roll (`roll: true`) tries a roll before
  any level, on its own hero and feel template. A flat walled yard whose cover, gems and start a seed picks; R rolls
  the next seed. Its measures are read by `design_game` (`practice.measured.roll`): the seeds audit of the yard, and
  which forms of cover stop this hero, each form laid across a lane and the hero run at it jumping. A hero on its feet
  is stopped by a crate; one with an air jump goes over a 2 m wall. Served at `bible?book=practice&room=roll`.
- The rolled course (`gameworld/roll-course.js`): a hero that runs on momentum (a feel on the pinball base) has an
  obstacle course for its roll room, seen from behind on three lanes. Three asks: a hurdle and a block to jump, posts
  that leave an outer lane open. It is sized by time, measured on the rule the game ships (`paceOf`): each jump's
  window in seconds, a lane change steered as a player learns to. A slot stands every (the neediest ask + a rest) of
  the hero's top speed, and each slot is one group of the level's roll, of which exactly one thing stands, so every
  roll is fair by how it is laid. Its audit is the reaction bot: it sees only so far ahead and acts a reaction time
  after; the laws are fair (a 0.4 s reaction with the sight the course asks runs every sampled seed clean), finishes
  (a 0.8 s one still does) and apart. The sight a course asks is (its need + the reaction) x the hero's speed.
- The course's dress (`gameworld/course-dress.js`): a rolled course is coloured by ROLE (the way: ground, sleeper,
  rail, kerb, wall, sky; the asks: go over, go round; the tells; the exit) from a theme card, the rail yard first
  (ballast, sleepers and steel rails; amber barriers and orange crates to jump, blue wagons to go round). Its own
  machine gate, measured in OKLab: every ask is read against the way, the two kinds of ask are told apart by hue,
  nothing on the way is as vivid as an ask, and each tell is in its ask's hue. A game's seed gives it its own shade of
  the theme. `obstacles: { dress }` names one; the greybox loses every law, and says so.
- Where a course is read (`gameworld/course-view.js`, the principles in `docs/course-dress-principles.md`): the
  screen in thirds from top to bottom, the vanishing point on the line between the first two. The top third is where
  stuff comes from (its key: readability and distinction by the game's intent), the middle where it comes to view
  (readability of form: where a thing is made interesting), the bottom where you react (the character). A course is
  followed by a camera that frames them (`courseCamera`): the way's far end on the upper line, the place the reaction
  begins on the lower, the hero in the bottom band; `viewBands` says where the bands fall for any camera, and the roll
  room's readout whether its own frames them. The practice rooms' usual follow camera frames none of the three.
- The tells: paint on the way that carries what the course was measured by, rolled with its ask. A jump's window is
  painted as a strip (jump while on it); posts' arrows point at the open lane from where a two-lane change must begin.
- A level's `blocks` may carry their own colour (`tint`) and flat paint that goes with them (`marks`).
- A level that is an obstacle course: a gameworld level's `obstacles: true | { slots?, rest? }`, in place of `walk`. A
  run lays the lane for the world's hero (sized by its measured pace), its things as the level's blocks and a roll
  over them, the exit at its end; every play is another course. `create_game` answers with the reaction bot's audit
  for it (the made level read back as a course: its things are jumped and steered round, never walked round).
- The roll room's stand-in hero wears the body its game reads (`game-bodies.js`): a mascot's big head on a small body
  for a runner, a platformer or a game to collect. The rail runner's feel (the one on the pinball base) joins the mascot
  rail, so its hero reads as a mascot wherever a game's body is read from its feel.
- A world's `roll` reaches its levels (`gameworld/roll-lower.js`): `roll: true | { cover?, items? }` on a gameworld, and
  each walking level a run lays on a trail takes a roll on its recipe over what it already holds: its cover (the cover
  concern's own walls and crates by the trail's beats, laid for the roll when the level's concerns laid none), of which
  half or more stand and never all, and its pickups, of which half or more lie and never all. A pilot with no body (a
  first-person walker's) is given one, since no cover stops it without. A level that is no trail walked on foot, and a
  world that does not roll, are as they were.
- A run over levels that roll (`game/game-manifest.js`, the play shell): `run: { length, repeat: true }` lets a run draw
  a level more than once, so a run may be longer than its pool: one level that rolls is a run of its maps. Each draw
  has its own seed (the run's number and step), never the same level twice running when there is another.
  `create_game` says so when a repeated level has no roll. A level that rolls says which map was played on its result
  (`map 202`), and played again is the same map.
- A rolled level opened with no shell takes its seed from the page's own `?seed=` (1 unsaid: the reference roll).
- Not yet: the foes a seed picks, the level's book, and the room layout itself rolled in the
  page from a kit of rooms.
