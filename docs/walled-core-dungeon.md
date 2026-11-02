# The walled-core dungeon

Layers on a critical path toward a final area, the core: each gates the next and takes the player deeper, across,
down or up. Shadow Moses and the three walls of Attack on Titan are walled-core dungeons; a stealth game stacks them, a
metroidvania sets them side by side.

A `design_game` world's `wcd` (`control/lib/graph/wcd/wcd.js`); the agent's manual is the `gameworld-wcd` card.

## Parts

- **Inner**: a dungeon of its own. The core is one.
- **Outer**: binds inners; crossed, never the core.
- **Door**: lift, teleporter, door or stair, with its gate (a clearance, a power, or the keys found in the space it
  leaves). A lift and a teleporter stay in one level. `oneWay` is a shortcut back out.
- **Depth**: 0 outermost, the core deepest. `built: false` keeps a space on the path unmade.

## Principles

Laws on the recipe, advice in `design_game`'s readout (`advice.wcd`), never refusals: deeper at every door, the core an
inner, every outer binding two spaces, every space entered through a gated door, each layer unlike the last in
construction and palette, lifts and teleporters within one level, a keyed door leaving an escape room.

## In the book

The world's book draws it as rings to the core, each gate on its join, with each layer's level, look and finishes and
the laws' verdicts. A building level's finishes (`gameworld/finishes.js`) are what its surfaces will wear, painted from
the stage it is built as, toned when it is, with its light: a draft's book is the approval sheet before a run. A level's
style palette does not colour a bay building; its look or its tone does. The book's look is the world's `book: { skin }` (`gameworld/book-skin.js`): a preset (`briefing`) or the
model's own colours, faces, frame and texture.

## The escape room

The smallest a layer can be: a space you are held in, its way out sealed, until N locks are open, each by a key found
inside it or by a step (a truth on the bus reaching a value). A level's `goal: { escape: true | 1…4 }` makes its last
stage one (`gameworld/escape.js`, the `escape-room` mechanic, `game/escape-room.js`): keys along a trail's beats or on a
building's route through its rooms, locks at the way out, the seal turning a walker back until they open. A door's
`gate: { keys: true }` is opened by the keys found in the space it leaves; the law `keys-inside` advises when that space's
level is no escape room. Its keys, locks and seal are named from the recipe (`<level>-key-<n>`, `<level>-lock-<n>`,
`<level>-seal`), so an engine handoff carries them as markers. The book lists each escape room, what is locked and where
its keys lie.

## A space builds its level

Its `look` composes the stage (`era/compose.js`), its `tone` colours it (`era/tone.js`); both live on the dungeon and
survive a rerun. A base building (`BASE_USES`, `era/programs.js`) is always composed, so its rooms are stocked
(`era/stocking.js`); the `bunker` construction (`era/style/bay-axes.js`, `era/bay.js`) dresses its walled layers.

## Not yet

The outside (how the spaces join as one map) waits on the geocube work. Two spaces cannot share a level, so a lift
between levels is a stair.
