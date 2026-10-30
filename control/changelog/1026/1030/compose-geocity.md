### Compose geocity: a metro's map, its major streets first, on land that falls to its water

A metro (`lib/graph/geocity/`) laid at its widest grain before anything inside it: its major streets first, carving
its neighbourhoods, each in a ring out from its core, on land that rises and falls. The base is the fractal city's
metro as `city/plan/` reads it into metres (its grammars: sections, towers, skins); the discipline is the geotown's
(every square metre once, laws that advise, a sheet before a scene). Built toward its games: city hunter, and the
Quest Open World (the walled-core dungeon's opposite pole: a map that opens sideways, connected and loaded as it is
passed, a city or an island). Not wired to a kind yet: the map alone.

- **A metro is a card** (`geocity/metro.js` METROS): its extent, its water (a shore along a side; all four an island),
  its core's seat, its land's FALL (metres toward a side: downtown down its spine to the lake) and the hills over it
  (a painted landscape's), its arterials' spacing (tight at the seat, looser past `reach`), its rings' reaches and their
  storeys, its green budget, its city grammar (`city/plan` grammars) and its outskirts' geotown pattern. Two starters:
  `lakeshore` (a Toronto: the core by the lake, the land falling to the shore, the grid loosening northward) and
  `harbour-island` (the core on a harbour at the west shore, hills inland, water all round). A recipe's settings lay
  over its metro's; anything off the card is refused by name.
- **The map** (`geocity/design.js` designGeocity), layer by layer, each its own dice:
  - the LAND inside its water: the natural ground (the fall plus the hills) and the streets' ground, smoothed so an
    arterial keeps the land's grade and not its every hummock;
  - the ARTERIALS: the SPINE through the seat each way, then arterials stepped out to the land's edge, each step rolled
    inside the rail at its distance; each in its grammar's major section, its profile along the ground (its ends'
    heights, its steepest grade);
  - the NEIGHBOURHOODS they enclose, each its RING by its middle's distance from the seat (the four round the seat
    always the core; the frame the lower tall; the outskirts four storeys and lower), its sides (an arterial, the water,
    or the BEYOND past the map's land edge, where a geotown joins later) and its PORTS (each arterial side, its run and
    its ends' heights);
  - the GREEN from the top: the city park reserved whole (a frame neighbourhood clear of the map's edge, by dice), the
    rest of the share given out as quotas by area times the ring's weight;
  - the REGION GRAPH: each neighbourhood a node, each pair across an arterial an edge with its PORTAL and its height,
    and the neighbourhoods open to the beyond: what a Quest Open World streams as it is passed;
  - the LEDGER: water, the arterials (each crossing once), parks and neighbourhoods, by ring.
- **The laws** (`geocity/laws.js`), advice only: `closes`, `grade`, `rings`, `green`, `holds` (every outskirts
  neighbourhood holds a geotown neighbourhood of its pattern, two blocks by two), `ports`, and the Quest Open World's
  `open` (one part) and `sideways` (no bridge in the region graph: always two ways round).
- **The sheet** (`geocity/sheet.js`): the map from above, neighbourhoods by ring shaded by height, the spine darker,
  the park, the portals, the crossings' heights, the ledger and the laws. `scripts/spikes/geocity/geocity.mjs` writes it.
