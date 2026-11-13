### Emergent gameplay: a game that plays a different map each time

In progress. A level's `roll`: what the session's seed picks on it. The recipe and the page never change; the seed the
game's shell already sends with `game-init` picks, and seed 1 is the reference roll (what a page with no shell, a
capture and the level played in Node show).

- `roll.cover` (`game/roll.js`): groups of the level's `blocks`, named by each block's `id`, of which the seed stands a
  number or any number in a band: `roll: { cover: [{ of: ['wall-a', 'wall-b', 'crate'], stand: [1, 2] }] }`. A rolled
  block is one thing: one render group and one box. Left out, it is gone whole, as if never built: out of the
  colliders, the sight, the nav grid and the scene, with nothing broken and nothing said on the bus.
- The runtime's roll (`worlds/controllable/roll.js`): whole-number dice, so every runtime rolls the same from the same
  seed (the page's against Node's: 305 seeds, none unequal). Emitted only into a page whose level has a roll; a level
  without one keeps every byte.
- A rolled level says `game-shown` only once it has started, so the shell's veil never lifts on the level as it was
  before its roll.
- A level played in Node rolls too: `simLevel` / `levelSim` take the session's `seed`.
- Not yet: the foes, the items and the start a seed picks, the audit over seeds, the level's book, and the room layout
  itself rolled in the page from a kit of rooms.
