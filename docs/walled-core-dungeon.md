# The walled-core dungeon

Layers on a critical path toward a final area, the core: each gates the next and takes the player deeper, across,
down or up. Shadow Moses and the three walls of Attack on Titan are walled-core dungeons; a stealth game stacks them, a
metroidvania sets them side by side.

A `design_game` world's `wcd` (`control/lib/graph/wcd/wcd.js`); the agent's manual is the `gameworld-wcd` card.

## Parts

- **Inner**: a dungeon of its own. The core is one.
- **Outer**: binds inners; crossed, never the core.
- **Door**: lift, teleporter, door or stair, with its gate (a clearance or a power). A lift and a teleporter stay in one
  level. `oneWay` is a shortcut back out.
- **Depth**: 0 outermost, the core deepest. `built: false` keeps a space on the path unmade.

## Principles

Laws on the recipe, advice in `design_game`'s readout (`advice.wcd`), never refusals: deeper at every door, the core an
inner, every outer binding two spaces, every space entered through a gated door, each layer unlike the last in
construction and palette, lifts and teleporters within one level.

## In the book

The world's book draws it as rings to the core, each gate on its join, with each layer's level and look and the laws'
verdicts. The book's look is the world's `book: { skin }` (`gameworld/book-skin.js`): a preset (`briefing`) or the
model's own colours, faces, frame and texture.

## A space builds its level

Its `look` composes the stage (`era/compose.js`), its `tone` colours it (`era/tone.js`); both live on the dungeon and
survive a rerun. A base building (`BASE_USES`, `era/programs.js`) is always composed, so its rooms are stocked
(`era/stocking.js`); the `bunker` construction (`era/style/bay-axes.js`, `era/bay.js`) dresses its walled layers.

## Not yet

The outside (how the spaces join as one map) waits on the geocube work. Two spaces cannot share a level, so a lift
between levels is a stair.
