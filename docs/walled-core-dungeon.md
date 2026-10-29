# The walled-core dungeon

A walled-core dungeon (WCD) is a dungeon built as layers on a critical path toward a final area, the core. Each layer
gates the next and takes the player deeper: across, down or up. It is a concept the level design follows, not a map
shape. Shadow Moses (a dock, a forward base, the interior base, the fortifications, the core) and the three walls of
Attack on Titan (Maria, Rose, Sina) are WCDs. A stealth game is close to a stack of them; a metroidvania is WCDs side by
side, one core's reward opening another's gate.

It lives on a `design_game` world as `wcd` (`control/lib/graph/wcd/wcd.js`); the agent's manual is the `gameworld-wcd`
card (`get_game_vocab`).

## Its parts

- **Inner**: a new dungeon, a place of its own. The core is always an inner.
- **Outer**: a space that binds inners together, crossed to reach the next.
- **Intermediary**: the door between two spaces (a lift, a teleporter, a door, a stair), carrying its gate (a clearance,
  a keycard's level, or a power found in the world). A lift and a teleporter move within one level; a door and a stair
  may join two levels. A one-way door is a shortcut back out.
- **Depth**: 0 the outermost, the core the deepest. A space marked `built: false` is on the path and not made yet, so a
  vertical slice ships with its inner layers alone.

## Its principles

Each is a law read on the recipe; they advise in `design_game`'s readout (`advice.wcd`) and never refuse:
the path deepens at every door and ends in the core; the core is an inner; every outer binds two spaces; every space
is entered through a door that says what opens it; a layer looks unlike the last (construction and palette: the light
is the theme's, set once); a lift or a teleporter stays within one level. The `distinct` law advises; it does not push
a space with no look off the one before.

## How a space is built

A space bound to a building level (`level`) builds it: its `look` composes the stage (the scene composer's construction
and palette, `control/lib/graph/era/compose.js`), its `tone` colours it (`control/lib/graph/era/tone.js`), both carried
on the dungeon so a rerun of the world keeps them. A space's `use` is a building use; a military base's buildings are
`BASE_USES` in `control/lib/graph/era/programs.js`, each on the bay kit of what it is.

A base building's level is always composed, so its rooms are stocked by their uses: the supply chain's tables and laws
in `control/lib/graph/era/stocking.js`, laid by `control/lib/graph/era/compose-dress.js`. The `bunker` construction
(`control/lib/graph/era/style/bay-axes.js`, its fittings in `control/lib/graph/era/bay.js`) is a base's walled layers:
blast-door frames, cable trays, placards.

## The loop

Plan the WCD on a world, read its map in the world's book, give each space its look and tone, approve the book, run the
rail. A hand-edited level is kept on a rerun unless the run says `force: true`.

## Not yet

The outside half (how the spaces join into one map) waits on the geocube work. The book has no page drawing the
dungeon's rings. Two spaces cannot share one level, so a lift between two levels is a stair for now. Characters, foes,
and a zone's security level are out of scope.
