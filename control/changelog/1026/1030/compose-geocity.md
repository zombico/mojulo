### Compose geocity: a metro's map, its major streets first, on land that falls to its water

A metro (`lib/graph/geocity/`) laid at its widest grain before anything inside it: its major streets first, carving
its neighbourhoods, each in a ring out from its core, on land that rises and falls. The base is the fractal city's
metro as `city/plan/` reads it into metres (its grammars: sections, towers, skins); the discipline is the geotown's
(every square metre once, laws that advise, a sheet before a scene). Built toward its games: city hunter, and the
Quest Open World (the walled-core dungeon's opposite pole: a map that opens sideways, connected and loaded as it is
passed, a city or an island). Built as the geocube kind's `show: 'geocity'`, the whole metro as massing.

- **A metro is a card** (`geocity/metro.js` METROS): its extent, its water (a shore along a side; all four an island),
  its core's seat, its land's FALL (metres toward a side: downtown down its spine to the lake) and the hills over it
  (a painted landscape's), its arterials' spacing (tight at the seat, looser past `reach`), its rings' reaches, its
  heights, its green budget, its streets inside a neighbourhood (`streets`: the collector's span, the civic block's
  least) and its segments' weights by ring, its city grammar (`city/plan` grammars) and its outskirts' geotown pattern. Two starters:
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
  - the BLOCKS inside each neighbourhood (`geocity/blocks.js`), each its own dice: COLLECTORS across a neighbourhood
    wider than the card's span (a geotown main street's section), moved off its park to run along it; a street round
    the park (a strip under a block's least between it and an edge the park's, so it may take a strip of frontage);
    LOCALS between those, each gap cut into whole blocks of its ring's length (the grammar's square pitch in the core
    and the frame, in its minor section; the geotown's long blocks running north and south in the outskirts, in its
    street's section), cut where they would cross the park. Each block a BLOCK SEGMENT by ring (`geocity/segments.js`):
    the core's `tower` (a podium, a tower or two on its corners rising past the block's median, the core's tail; a
    plaza, a laneway, a ramp) and `podium` by weight, its `square` at its middle; the frame's `midrise` (round a planted
    court) on an arterial and `slab` (on its lawn, the lower tall) by weight; the outskirts the geotown's own segments:
    an `edge` where an arterial runs along a block's long side, a `main-street` where a collector does (a short end on
    either is its houses' corners), a `school` at its middle, `houses`, `apartments` and `lowrise` by weight. The civic
    block (the square, the school) the one nearest the middle, off the arterials where one is. Each block's storeys off
    the field inside its ring's rail (on an arterial its frontage's), and its GROUND its segment's shares of its area:
    the geocity's own surfaces (podium, building, plaza, planting, court, lawn, laneway, ramp, lot) in the core and the
    frame, and in the outskirts the geotown's, read from the geotown's own design of each segment with its streets left
    out, so an outskirts block keeps a geotown's measures;
  - the LEDGER: water, the arterials (each crossing once), parks and neighbourhoods, by ring; inside each neighbourhood
    its streets, blocks and park, and every block's ground by surface, summed for the metro; the green budget,
    reserved, given out as quotas, placed as the neighbourhoods' parks and grown as soft ground.
- **The laws** (`geocity/laws.js`), advice only: `closes`, `grade`, `rings`, `green`, `holds` (every outskirts
  neighbourhood holds a geotown neighbourhood of its pattern, two blocks by two), `ports`, and the Quest Open World's
  `open` (one part) and `sideways` (no bridge in the region graph: always two ways round); the heights' `skyline` (each
  ring's builders lower on the whole than the ring inside), `caps` (every interior and frontage inside its rail) and
  `interior` (a neighbourhood keeps ground behind its frontages); `parks` (placed as the quotas ask, inside); the
  blocks' `blocks` (each neighbourhood's ground once, each block's surfaces its area), `pitch` (blocks inside their
  ring's length), `segments` (each its ring's, the civic blocks), `soft` (each neighbourhood's green ground most of its
  quota) and `towers` (past their podiums, inside their rail, the tallest in the core).
- **Built** (`geocity/scene.js`, the geocube kind's `show: 'geocity'`, `geocity: { … }` its recipe): the metro stood
  on the cube's land at its hour, in metres, as MASSING, under a face budget (`faces`, advice): the water a plane along
  each shore carried out to the horizon (a shore looks over open water, an island stands in it); the arterials a road
  between two walks over a kerb, each neighbourhood's ground its streets, a walk round every block, all draped on the
  streets' ground in cells; each block a pad in TERRACES along its long side, each level over its walk at its highest
  corner, retaining faces down to the walk and the terrace below; the buildings by segment on their terraces (a tower
  block's podium and towers, a podium block, a square's planting and kiosk, a mid-rise ring round its court, a slab on
  its lawn and its lot; in the outskirts semi pairs under gables to the street in two rows back to back, an edge's two
  storeys and a main street's three of shops along their street, low-rises, a walk-up, a school and its field), glass
  in the core, stone and brick outward from its grammar's skins; past dusk each tall wall's floors lit in runs (the
  grammar's share and palette), panes no light shades, none by day. Lit and hazed by the cube at its hour (the city's
  haze per metre); seen from its water (the skyline), over it, its core and up its spine, walked from the seat, the
  dummy round the block nearest it. The answer's `geocity`: the counts, the ledger, the neighbourhoods, the region
  graph, the laws. `scripts/spikes/geocity/geocity.mjs --hours noon,night` captures it. Lakeshore: 8,019 buildings,
  131 towers, 87.7k faces by day, 12.5k lit panes at night.
- **Evoked at game scale** (`geocity.evoke`, metro.js EVOKES; design.js `evoked`): a game does not take the metro to
  scale, it evokes a piece of it. `skyline` the whole metro's tall buildings and water; `neighbourhood` one (`at`, by
  default the core's nearest the seat); `corridor` an arterial's frontage end to end (`along`, by default the spine
  from the shore inland: a Yonge); `segment` one block (`at`, by default a tower block by the seat); `metro` every block
  to scale. An evocation is at GAME scale unless it says (`play: 'game' | 'real'`, metro.js PLAY): what a walker covers
  compressed as city/plan's game scale does (the map, the arterials' spacing, the rings, a node's reach, the
  collector's span ×0.6; a frontage's and a block's rows' depth ×0.8; the grammar at its game play; the outskirts'
  geotown blocks), never a storey, a lane or a door. Built in three tiers: the evoked blocks at a building's DETAIL,
  each core and frame mass a lot the facade pipeline wears (city/plan/facades.js: curtainwall, punched stone, brick,
  a tower's shape; its windows lit at night on the facades' own grids) brought from its units back to metres; the
  neighbourhoods round them as massing; the rest its skyline (one coarse drape a neighbourhood, its tall buildings, its
  low fabric a flat mass along each long side). Seen first from over what it evokes and from its own street, where
  its walk starts. Its `evokes` law (advice) holds it to the metro to scale designed beside it on the same seed: each
  ring's mix of segments and its storeys, its green share, its towers a core block. An outskirts block keeps its
  massing at detail until it is a geotown's.
- **Roads** (`geocity/roads.js`, the card's `roads`): each arterial its own cross-section, laid band by band from its
  centre out between the grammar's walks, its right-of-way its own (the neighbourhoods beside it stand off its half;
  the ledger sums each). A major street FOUR LANES, two each way, parking at each kerb; a share carry a SPACER between
  their directions (`median`: a planted median over a kerb), most do not; one-way PAIRS by the core (the two nearest
  parallel arterials off the spine, east-west first: a Richmond and an Adelaide), THREE LANES the same way each, the
  pair's two opposite, a bike lane on one side; STREETCAR rails (Toronto's broad gauge) on the spines and on a share
  of the rest, in the inner lanes, or down the spacer in their own right-of-way where the street has one (a Spadina).
  Lanes never compress at game scale. Each band carries its way (`dir`, the grammar's traffic side: left where it
  drives on the left), so the lines are a lane graph a driver reads later.
- **The street, near** (`geocity/kit.js`): the metro city's own doodads at true size, its kerb lamps and signals,
  street-name signs and tram poles (fractal-city.js `kerbLamp`, `intersectionDoodads`) made round by its round kit
  (city/round-kit.js: a tapered standard on its collar, a lathed head, lenses, galvanized posts), each baked once a
  facing; and the paint and rails as flat pieces. Along every arterial: its lane lines dashed between lanes one way, a
  double yellow between a two-way street's directions where no spacer parts them, solid white at its parking and bike
  lanes, a bike lane painted green; its rails end to end and the overhead (a pole at each kerb, a span across, a
  contact wire over each track); lamps at both kerbs at the metro's stride, staggered. At each crossing crosswalks on
  every arm, a signal on each corner (every crossing signalled, the metro's way) its mast over the lanes, a street-name
  sign, and on a streetcar line a stop each way past it (a platform and its shelter down a right-of-way). All stamped
  as instanced repeats drawn only NEAR the camera: from far the blocks suffice. A `crossing` camera on an evocation.
- **The ground, near** (visual interest where the eye is): the ground and the masses in their material words laid as
  tiles (era/arch-style.js `wordTile`, era/town-dress.js `dressTownFace`, texel × the baked light): the roads asphalt,
  the walks scored pavement, a hard block's pad (a tower's, a podium's, a square's, a mid-rise's) flags, a streetcar
  right-of-way setts, retaining faces sawn stone; houses, shops, mid-rise, low-rises and schools brick, podiums sawn
  stone, slabs precast. A glass tower's walls take the sun's sheen (`spec`, the specular channel). The furniture, near:
  on the arterials a bin by each crossing, hydrants, and where close-built benches with bike rings, newspaper boxes at
  a corner, a bench at each streetcar stop, street trees in their pits clear of the lamps; on a neighbourhood's own
  streets wooden hydro poles with their crossarms, wires and hung lamps and verge trees in the outskirts, the metro's
  kerb lamps and bins in the core and frame; round a square benches, bins and bollards (kit.js: the metro's park bin,
  bollard, power pole and bench at a person's size, round by its kit). The trees grown from the vegetation library
  (`plantPool` / `plantRepeats`, crowns raised over the walk), drawn near the camera like the kit. Lit live: under
  live shadows (`ctx.liveSun`) every face carries its sun share (city/plan's key share), a lit window its own light.
  Not yet: relief on the paved ground (gen-7's ground parallax reads natural soil and scree only, so a paved kind is a
  new shader's), and a sky's reflection on outdoor glass (only water, a wet road and a room's panes take one).
- **The city changing** (`segments.js` LIVELY, the card's `lively`: each ring's shares, on each block's own dice, off
  its civic block): a share of the blocks a BUILDING GOING UP (`construction`: what it `becomes` and its `progress`, its
  columns and floor slabs risen that far, its concrete core above them, a tower crane over it, seen from afar; near the
  camera scaffolding up its long faces, a bay every 2 m and every lift, plywood hoarding along its streets and
  temporary fence panels round the rest, barriers and cones on its walk), a surface PARKING lot (asphalt, its stalls in
  rows across an aisle, their lines and cars in most, each its paint as an instance's tint), a VACANT lot (scrub over
  old gravel behind temporary fencing). New kit (kit.js): scaffold bay, fence panel, hoarding, barrier, cone, car,
  stall line; new surfaces `site` (gravel) and `scrub` (soft).
- **The geotown composed in** (`geocity/towns.js`, the recipe's `geotowns`): the two tools composable at any grain and
  anywhere (the edge or the core), on the metro's land (the geotown's design and scene take the metro's natural ground
  in their frame: `field`, geotown/scene.js's `ctx.field`, absent as before). A NEIGHBOURHOOD (`'D3': true`) laid by the
  geotown fitted inside it: the outskirts' pattern to scale (compressed as the metro's own at game scale), as many
  blocks as it holds (a block segment of its ring's where none fits), its streetscape by its ring (leafy in the
  outskirts, snug in the frame, urban in the core), centred, the green round its frame; or the town its recipe asks
  (`{ neighbourhood: 'annex' }`, a layout, an evocation: named, its evocation implied). A BLOCK (`'D3.2.1'`) laid by
  one of the geotown's block segments (the block's own if it is one, else its ring's: houses, a low-rise, a main
  street; or `{ segment }`): its rows as deep as the metro's block shares across them (a lane's or an alley's share
  given back) and as many houses, shops or low-rises along them as the block runs, cropped to its block and centred in
  the metro's, its ground the town block's ledger and the green round it. Built by the geotown's own scene in its place
  (its trees near the camera only); as the skyline, its houses as boxes. A geotown's laws are its own advice, read
  beside it; the metro's `geotowns` law holds each inside its place. A quest open world's regions take them as they
  are (a geotown's neighbourhood is a region).
- **The quest open world** (`lib/graph/qow/qow.js`, a `design_game` world's `qow`; `docs/quest-open-world.md`; the
  `gameworld-qow` card): the walled-core dungeon's opposite pole. Its regions a geocity's neighbourhoods and its region
  graph (`map: { geocity, seed? }`), its `spawn` (the core's by the seat), optional `locks` (the WCD's gates: a
  clearance or a power, never the way on), `quests` (main or side, `after` others), `landmarks` ('auto': the core's
  tallest tower and each node's, seen thirty times their height off), its `stream` rings (a region and its neighbours
  `hops` away, what is loaded as it is passed), the `level` it is played in. Its principles as laws, advice in
  design_game's readout (`advice.qow`): `open`, `sideways` (no cut vertex among the open regions), `unforced`, `seen`,
  `streamed`, `spread`. Malformed is refused by name.
- **Near repeats** (`scene/scene-three.js`): a repeat may say `near` (world units): the page cuts its instances into
  square tiles, each its own instanced mesh on the shared geometry, shown only while the camera stands within `near`
  of it, checked before each render (so a capture, a frozen frame and the live loop agree); a textured template's faces
  (a tree's bark) tiled the same on their own material. A world without one gains not a byte.
- **The sheet** (`geocity/sheet.js`), three views of one map: `rings` (each neighbourhood by the ring it builds as,
  shaded by its ground's height), `heights` (each by its median storeys, each arterial frontage band by its own) and
  `blocks` (its streets, the collectors darker, its blocks by segment, the towers on them); `focus` crops it round a
  few neighbourhoods; the spine darker, the parks, the nodes, the portals, the crossings' heights, the ledger and the
  laws. `scripts/spikes/geocity/geocity.mjs` writes each, and the blocks cropped round the core.
