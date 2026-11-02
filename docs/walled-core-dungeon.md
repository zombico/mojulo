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

The world's book draws it as rings to the core, each gate on its join, with each layer's level, look and finishes and
the laws' verdicts. A building level's finishes (`gameworld/finishes.js`) are what its surfaces will wear, painted from
the stage it is built as, toned when it is, with its light: a draft's book is the approval sheet before a run. A level's
style palette does not colour a bay building; its look or its tone does. The book's look is the world's `book: { skin }` (`gameworld/book-skin.js`): a preset (`briefing`) or the
model's own colours, faces, frame and texture.

## A space builds its level

Its `look` composes the stage (`era/compose.js`), its `tone` colours it (`era/tone.js`); both live on the dungeon and
survive a rerun. A base building (`BASE_USES`, `era/programs.js`) is always composed, so its rooms are stocked
(`era/stocking.js`); the `bunker` construction (`era/style/bay-axes.js`, `era/bay.js`) dresses its walled layers.

## Several spaces on one level: a complex

A building level's `building: { complex: true }` stands the dungeon's spaces on that level as buildings on one yard
(`network/complex.js`): in the critical path's order, each of its space's use and look, each beside the one before it,
each with a basement. A door between two of them is the passage below grade that joins their basements (`network/`:
a service tunnel by default, `network.section` to change it), whatever its via, both ways. The level is played in at
the first one's front door, down, through the passages, up the last one's stair to its goal room. The network's laws
(every building reached, cover, grade, run, and a way through) advise beside the dungeon's in `advice.wcd`; the book
draws the level as a site plan, and the rings call such a door a passage. `complex: { buildings }` stands buildings of
its own instead, and `complex: { campus }` a campus by its name (`network/campuses.js`: a hospital's emergency
department, wards, plant and theatres joined by a public passage and a service tunnel; a base's hangar, barracks,
armoury and command joined by bunker tunnels). A base's or a hospital's buildings are stocked by their rooms' roles
(`era/stocking.js`), and two buildings a passage joins are held to differ in look (`complex-distinct`).

## Not yet

A gate does not hold a passage shut inside a level: there is no in-level barrier that opens on what the player holds,
so a clearance on a complex's door is drawn and advised, not played. A lift and a teleporter between two buildings of a
complex are built as passages. The outside of a level made of separate building levels waits on the geocube work.
