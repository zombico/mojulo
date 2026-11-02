### Subway tunnels
- **A subway's running tunnel** (network/sections.js `rail` and `tube`, network/passage.js's `rail` finish): `rail` a
  cut-and-cover box 9.6 m wide and 5.2 m high, two tracks with a line of columns between them; `tube` a bored tube, one
  track under a vault on its rings. Each track lies on a darker concrete bed with a drain, sleepers every 0.7 m, two
  running rails at standard gauge (a bright head on a dark web) and a third rail outboard on insulators under its cover
  board; a safety walkway runs a step up along the left wall, its edge lined yellow, a handrail on the wall over it; the
  walls are sooted to a man's height, cable trays run along them on brackets, bulkhead lamps between, a signal on the
  wall now and then; a box's soffit is dark. A section now takes a `profile` (`box`, or `vault`: its walls to their
  springing, an arch over them, met at a junction by the spandrel over it). A rail tunnel holds the line between its two
  track levels (deeper only where its cover wants it; a passage climbs toward the ground), takes no stair, and is
  walked along its walkway, on it where it is raised.
- **A subway station from its floor plan** (a stage recipe's `station`, network/station.js, network/station-plans.js):
  `{ kind: 'stage', station: { plan?, line?, length?, train? } }` lays a platform hall from a card: `island` (one
  platform between two tracks, a mezzanine across one end reached by a stair from the island, a tube to each track),
  `side` (a platform either side of two tracks, a column line between them, a doorway out through each platform's
  wall, one twin box), `terminus` (the island at the end of the line, its tracks ending at buffer stops under the
  mezzanine at its head); a new floor plan is a card. Its look is the original station's (its line's colours, a frieze
  with roundels, white subway tile, tiled columns with their capitals, tactile strips and a white lip at each platform
  edge, benches, bins and a sign, its train at a platform) with the network's panelling over it (back-painted glass
  between steel battens, a stainless kick, a glazed dado in the line's colour, lit glass strips, a coffered soffit, a
  marble mezzanine behind a glass balustrade). Its tracks are laid as a running tunnel's and run on through a portal
  at each open end: each portal is a port a running tunnel meets; each way out is a port a passage meets. Every
  platform is walked end to end and up to each way out, columns, benches, stair and train all standing.
- **A subway line: stations joined by running tunnels, each with its way up to the street** (a stage recipe's
  `subway`, network/subway.js): `{ kind: 'stage', subway: { stations: [{ id, plan?, line?, length?, train? }], gap?,
  depth?, line?, entrances? } }` lays its stations in a row under the street at a depth (14 m by default), joined by
  running tunnels a gap long (120 m by default): a tube to each track of an island (its walkway toward the island), one
  twin box over both tracks of side-platform stations (its walkway under a platform). The tunnels' tracks run on the
  stations' tracks; each station's portals open to the tunnel's width, and steps are cut in a platform's end down to
  the track bed where a tunnel's walkway meets it. Each station's way out climbs an inclined stair in a tiled tunnel to
  a glass pavilion on the street (its stairwell open under the glass behind a balustrade, a band of the line's colour
  round its eaves); `entrances: false` leaves them out. Every tunnel is walked from one platform to the next and every
  entrance from its doorway to the pavement, both ways; its laws (every station reached, cover, grade, run) are in its
  readout. A terminus only ends a line; a line is all tubes or all boxes, its stations' tracks lined up. A rail
  tunnel's walkway may run along either wall (`walkSide`), its finish mirrored.
