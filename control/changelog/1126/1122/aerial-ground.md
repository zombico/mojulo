### The aerial ground: a pilot's country of fields, woods, roads, towns and a metro

A flight level's land was the terrain kernel's ramp coloured per vertex: from altitude, flat paint over rolling hills,
and its city plain boxes on a plinth. `airspace.ground.country` lays settled country on it, drawn at a pilot's grain:
what reads from the air (a block's buildings at their heights, their windows, the streets as paint, a highway on its
piers, a tank farm, a pylon line), never a walker's detail. See `docs/flight-games.md`, "The ground from the air".

- **The country** (`skyscape/country.js`): every settlement is the geocity's design laid on the map's own natural
  ground, at a card by its size: a metro (a geocity metro card; sited on the coast where the sea allows, its water side
  turned to the sea, its harbour dredged, its shore expressway and waterfront the sea's), a market town and a village
  (the same generator at smaller cards: a low core, houses outward, nothing over seven storeys in a town or three in a
  village). Each is graded onto its streets' ground with a kernel grade layer. A minimum spanning tree of roads joins
  them and the airfield, each road routed across the land on the map's grid (grade a cost, the sea and the pads walls;
  a metro's link to a town a highway, a village's a lane). A pylon line runs from a substation out to the reach, away
  from the field. Water towers stand on the settlements' high edges and a lit mast on the field's highest ground. Ask:
  `country: true | { metro?, towns?, villages?, settlements?, roads?, power?, landmarks? }`.
- **The land's cover** (`skyscape/cover-kernel.js`): woods, crops, heath and sand read off the land (woods on slopes
  too steep to plough, on high ground and in woodlots, cleared round the settlements; crops on the flat low ground
  near them; pasture the rest). It is self-contained, like the terrain kernel; the page inlines it and bakes it.
- **The page** (`scene/channels/aerial.js`, carried by the terrain channel as `aerial`, packed by `skyscape/aerial.js`):
  - The ground's shader draws the cover per pixel: field systems turned with the land, their parcels hedged, furrowed,
    cropped or grazed; woods as a canopy; heath; sand. The settlements' plans and the roads are painted from a canvas.
    Each pattern fades to its mean under a pixel, and all of it is lit as the land is.
  - Every building is an instance of a unit box under a facade shader, its windows a storey and a bay by its skin
    (curtain wall, office, flat, hall's ribbon, house), its glass catching the sky as the eye grazes it. Houses and
    halls have gables. Tanks, spheres, stacks, water towers, highway decks and their piers stand too, and pylons as
    lattices of lines with their conductors sagging.
  - A map without a country carries none of it: the terrain channel's script is byte for byte as it was.
- **The craft's ground**: the settlements' roofs, the water towers and the mast join `roofs`, so a craft can hit them.
  A settlement's approach is a bookmark.
- **Exports** carry the buildings as faces. The cover stays the page's.
- **Pilot School**'s island airfield is farmed country now: a market town, two villages, the lanes between them and the
  field, a line of pylons and a mast.
- The flight card (`gameworld-flight`) names `airspace.ground.country`.
