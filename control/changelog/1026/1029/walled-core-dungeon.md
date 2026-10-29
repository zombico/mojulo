### Walled-core dungeon: an interior military base, its maps, terrain and load-bearing doodads

A walled-core dungeon (WCD) is a dungeon built as layers on a critical path toward a final area, the core: inners (each
a dungeon of its own), outers (the spaces that bind them) and intermediaries (the lifts, teleporters and doors between,
each carrying its gate). Its principles are laws read on the recipe. Started with an interior military base: its uses,
panels and load-bearing doodads, stocked by use. Built so far:

- **The recipe** (`wcd/wcd.js`): a design_game world's `wcd: { core, spaces: { <id>: { kind: inner | outer, depth,
  level?, use?, look?, built? } }, doors: [{ from, to, via: lift | teleporter | door | stair, gate?, oneWay? }] }`,
  read against the world's levels and refused by name when malformed. A gate is a clearance (a keycard's level, 1 to 9)
  or a power. `built: false` keeps a space on the path unmade, so a vertical slice ships the inner layers alone. The
  critical path runs from the outermost spaces to the core, a one-way door (a shortcut back out) no way in.
- **The principles, as laws** (advice in design_game's readout, `advice.wcd`; never refused): `deeper` (the path
  deepens at every door and ends in the core, the deepest space), `core-inner`, `outers-bind` (an outer joins two
  spaces or more; the outermost binds the world outside to what it joins), `gated` (every space past the outermost is
  entered through a door, and a door inward names its gate), `distinct` (two spaces a door joins differ in construction
  or palette, read through the composer; the light is the theme's, set once), `same-level` (a lift or a teleporter moves
  within one level).
- **The card** `gameworld-wcd` (`get_game_vocab`), its words the tables' own.
