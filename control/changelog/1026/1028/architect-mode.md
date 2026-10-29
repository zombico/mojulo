### Architect mode: a house built for what it is for, a game read at a glance or a show at its best

The scene composer's first question is what a place is for. A house carries `purpose: 'game' | 'show'`, stamped at
mint (`era/compose-purpose.js`): a `level` is a game, any other house a show, and a house minted before purposes is
built as it was, byte for byte.

- **The game's rail: readability, never face overdrive.** Each piece is drawn from its own faces at a coarser grain
  (`scene/readable-rung.js`: vertices snapped to the mean of a 7.5 cm cell, collapsed faces gone, shared vertices still
  shared), whatever made it, and nothing is set on a table. A room's pieces are laid in rank within an allowance of
  faces (`allowance: { room }`, the rail's by default): what the room is for (the bed, the sofa, the kitchen run)
  always stands, the rest while the allowance holds, a cheap piece tried after a costly one is left out. The World
  reads the spend as `rails`, room by room, with what each left out and a room over its allowance said. A furnished
  two-storey villa falls from 36,464 faces to 10,329, its furniture from about 31,000 to 4,900.
- **The show's rail: fidelity.** Every piece as its maker drew it, every table set: the house as it always was.
