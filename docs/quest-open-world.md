# The quest open world

The walled-core dungeon's opposite pole. A WCD forces the player in: layers on a critical path toward a core, each
gated. A quest open world never does. Its map is regions joined sideways, connected and loaded as they are passed, each
reached without a gate, always two ways round. A lock is optional, a side door, never the only way on. It can be a city
or an island.

A `design_game` world's `qow` (`control/lib/graph/qow/qow.js`); the agent's manual is the `gameworld-qow` card.

## Parts

- **Regions**: a geocity's neighbourhoods (`map: { geocity }`, the geocube's `show: 'geocity'` recipe). Each pair across
  an arterial is joined at its portal (its street, its point, its height). A neighbourhood or a block of it may be a
  geotown's (the geocity's `geotowns`: the tools compose at any grain, anywhere); a region on the map's land edge opens
  to the beyond.
- **Spawn**: where play starts, by default the core's neighbourhood nearest the seat.
- **Locks**: `{ region, gate: { clearance } | { power } }`, the WCD's gates, here never on the way on.
- **Quests**: placed on regions, `main` or `side`, `after` the quests they wait on.
- **Landmarks**: what every region sees to find its way: the core's tallest tower and each secondary node's, by default.
- **Stream**: each region's ring (itself and its neighbours `hops` away), what is loaded as it is passed.

## Principles

Laws on the recipe, advice in `design_game`'s readout (`advice.qow`), never refusals: open (every region reached from
the spawn without a lock), sideways (no region the only way between two others), unforced (no main quest behind a lock,
the quests not one corridor), seen (every region within sight of a landmark), streamed (a region's ring under its
blocks), spread (the quests in more than one ring of the city).

## Not yet

The page does not stream by region yet: the rings are the hook (the geocity's far regions draw as its skyline, its
street kit near the camera only). City hunter is its first player: `level` names the level it is played in.
