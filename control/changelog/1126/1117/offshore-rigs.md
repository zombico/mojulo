### Offshore rigs: a level of open decks over the sea

A stealth level of no walls. A rig (`lib/graph/offshore/`) is decks stacked over the sea, laid from three tiles and the
modules on them, held to the laws a sneaking body needs, and built as a played page. Craft in `docs/offshore-rigs.md`.

- **The tiles** (`offshore/tiles.js`):
  - Floors: plate, grating and the helideck, a glyph each in a deck's map.
  - Rails: a guard rail stops a body and no gaze, a bulwark hides a crouch, a wind screen hides a standing body.
  - Pillars: a leg runs from the sea bed through every deck; a column carries one deck from the next one down.
  - Modules stand on the tiles. What each hides is read from its height.
- **The plan** (`offshore/plan.js`): decks as maps of glyphs at their heights, with legs, stairs and modules. The rails
  and the columns are found, not written:
  - A rail runs along every open edge except a stair's head: the deck's own kind, a wall kind on the side it faces,
    an inner kind round a hole.
  - A column stands at every n-th node, on the deck under it or the sea bed. It never drops through a moonpool and
    never stands in a flight.
  - A stair is a switchback of three cells by two, with its well cut through the deck it climbs to.
- **The laws** (`offshore/laws.js`): railed, joined, carried, stairs-clear, modules-placed, sight-broken and
  cover-in-reach.
- **Built** (`offshore/build.js`): faces shaded once under the sun, each deck shadowing the ones under it. Decks,
  pillars, walls and modules are colliders. Guard rails and a stair's sides are barriers. The sea is a sheet of ocean
  water. A tread's box stands a quarter metre under the tread drawn over it, so a body's footprint spanning two treads
  climbs.
- **The drilling platform** (`offshore/rigs.js`) has four decks:
  - The boat landing.
  - The cellar deck, a forest of columns under the main deck.
  - The main deck's yard, its quarters, and a hall of columns under the drill floor.
  - The drill floor under its derrick, with the helideck beside it.

  Each deck has rounds watching it, and the route search finds a way across unseen on every one.
- **In the game book**: the facility maps book draws the rigs after the facilities: each deck from above
  (`offshore/map.js`) with its rounds, and the rig's laws beside them.
- The spike `scripts/spikes/mission/rig.mjs` proves the plan (`--plan`) and builds the page (`--out`), starting in
  invisible mode.
