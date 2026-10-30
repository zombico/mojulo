### Compose geocity: a metro's map, its major streets first, on land that falls to its water

A metro (`lib/graph/geocity/`) laid at its widest grain before anything inside it: its major streets first, carving
its neighbourhoods, each in a ring out from its core, on land that rises and falls. The base is the fractal city's
metro as `city/plan/` reads it into metres (its grammars: sections, towers, skins); the discipline is the geotown's
(every square metre once, laws that advise, a sheet before a scene). Built toward its games: city hunter, and the
Quest Open World (the walled-core dungeon's opposite pole: a map that opens sideways, connected and loaded as it is
passed, a city or an island). Not wired to a kind yet: the map alone.

- **A metro is a card** (`geocity/metro.js` METROS): its extent, its water (a shore along a side; all four an island),
  its core's seat, its land's FALL (metres toward a side: downtown down its spine to the lake) and the hills over it
  (a painted landscape's), its arterials' spacing (tight at the seat, looser past `reach`), its rings' reaches, its
  heights, its green budget, its city grammar (`city/plan` grammars) and its outskirts' geotown pattern. Two starters:
  `lakeshore` (a Toronto: the core by the lake, the land falling to the shore, the grid loosening northward) and
  `harbour-island` (the core on a harbour at the west shore, hills inland, water all round). A recipe's settings lay
  over its metro's (an object merged all the way down); anything off the card is refused by name.
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
  - the HEIGHTS (`geocity/heights.js`, the card's `heights`), in storeys, the highest read winning at a point: each
    ring's MEDIAN from its outer reach to its inner, geometrically, inside its RAIL (the core's towers, the frame's lower
    tall, the outskirts at four storeys and lower), so the skyline falls outward; secondary NODES, every `every`-th spine
    crossing out past the core (a Yonge and Bloor), the four neighbourhoods round one BUILT as the ring inside theirs and
    the median rising toward it; and each arterial's FRONTAGE, a band `depth` metres deep along a neighbourhood's
    arterial side, rising to its corridor's storeys (a spine's more than an arterial's) where its ring's rail stops short:
    mid-rise lining a main street past the core. Each neighbourhood carries the ring it `builds` as, its interior's
    storeys (median and rail) and each frontage's; `storeysAt(x, y)` reads the field anywhere;
  - each neighbourhood's own PARK (`geocity/parks.js`, the card's `green.park`) out of its quota by its ring's share,
    laid before its streets so they go round it: a band along the shore on the water (a lakeshore park), else a rect
    inside its interior clear of its frontages, its aspect rolled; under the least none, the quota left to its segments;
  - the LEDGER: water, the arterials (each crossing once), parks and neighbourhoods, by ring; the green budget,
    reserved, given out as quotas and placed as the neighbourhoods' parks.
- **The laws** (`geocity/laws.js`), advice only: `closes`, `grade`, `rings`, `green`, `holds` (every outskirts
  neighbourhood holds a geotown neighbourhood of its pattern, two blocks by two), `ports`, and the Quest Open World's
  `open` (one part) and `sideways` (no bridge in the region graph: always two ways round); the heights' `skyline` (each
  ring's builders lower on the whole than the ring inside), `caps` (every interior and frontage inside its rail) and
  `interior` (a neighbourhood keeps ground behind its frontages); `parks` (placed as the quotas ask, inside, clear).
- **The sheet** (`geocity/sheet.js`), two views of one map: `rings` (each neighbourhood by the ring it builds as,
  shaded by its ground's height) and `heights` (each by its median storeys, each arterial frontage band by its own);
  the spine darker, the parks, the nodes, the portals, the crossings' heights, the ledger and the laws.
  `scripts/spikes/geocity/geocity.mjs` writes both.
