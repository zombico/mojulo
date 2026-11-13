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
- A world's `roll` reaches its levels (`gameworld/roll-lower.js`): `roll: true | { cover?, items? }` on a gameworld, and
  each walking level a run lays on a trail takes a roll on its recipe over what it already holds: its cover (the cover
  concern's own walls and crates by the trail's beats, laid for the roll when the level's concerns laid none), of which
  half or more stand and never all, and its pickups, of which half or more lie and never all. A pilot with no body (a
  first-person walker's) is given one, since no cover stops it without. A level that is no trail walked on foot, and a
  world that does not roll, are as they were.
- A rolled level opened with no shell takes its seed from the page's own `?seed=` (1 unsaid: the reference roll).
- Not yet: the foes a seed picks, the level's book, and the room layout itself rolled in the
  page from a kit of rooms.
