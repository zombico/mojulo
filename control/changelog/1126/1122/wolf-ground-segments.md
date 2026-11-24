### Wolf Squadron's ground stages: laid in segments, under the flight sky, a sci-fi colony, terrain on the holo table

Wolf Squadron's Canyon run is now a long route down Moon IV in three stretches, open dust flats, the Red Canyon colony
on the way, then the canyon to the gunship, under Pilot School's flight sky and over ground laid at a pilot's scale.
Its briefing is told over the moon's real ground.

- **A route map** (`skyscape/map.js`, `map.route: true`). A rail stage's long field:
  - its reach is the field and a narrow band (the rail keeps the craft on its way);
  - its haze sees ahead rather than corner to corner;
  - its one grid spends the same cell budget along its length (about 50 m cells on a 15 km route, where a square map of
    its length is about 130);
  - its laws are its own (`way-seen`; no turn-room).

  Every other map plans as it did.
- **Ground in segments** (`skyscape/ground.js`, `ground.segments`). The field's length is cut into stretches about the
  gorge's line, eased over 600 m at a join:
  - `canyon` keeps the walls;
  - `open` is a broad valley with no walls;
  - `colony` stands a settlement on the line.

  A route's line weaves by the metre. The rail stage keeps its hazards out of a colony, checks its walls only down a
  canyon, and sweeps its box over the roofs (`topIn`), so the way rises over a spire rather than through it.
- **The colony style** (`skyscape/country.js`, `country.style: 'colony'`, a new `colony` settlement card: a town's grain
  round a core of towers). The same generator's masses dressed as a sci-fi colony:
  - composite panels with one lit band of glazing, not a grid of windows;
  - teal glass, spires with a crown set back and a lit mast (in the roof grid, so a craft can hit them);
  - habitat modules under domes and flat-roofed halls (no gables);
  - radar domes for water towers;
  - a colony's plan: dark roads, landing aprons, hydroponic greens, no garden trees;
  - the cover leaned to its world's colours.

  It is data only: the page's facade shader is unchanged, and an earth country is byte-identical.
- **A stage's route in segments** (`campaign/stage.js`). `route.segments` (each `canyon`, `open` or `colony` and its
  seconds) and `route.sky` (a flight sky, an afternoon's fair-weather cloud by default) lay one long route
  (`routeGround`). Its stretches sit at their shares of the way, and its ground is coloured for its world
  (`worldGeocube`: a rust moon's dust and red rock, not an island's grass). It has no airfield.
- **Terrain on the holo table** (`campaign/stage-ground.js`). A ground stage's table is drawn over the level's real land:
  - a heightfield sampled along the way, its heights stretched three times so a canyon reads;
  - the way as flown;
  - each wave where it is posted and the boss where it waits;
  - the pillars and the colony's masses.

  It works on the level page and in the game's briefing book once the level is built. A space stage's table, and a
  mission's, draw as they did.
- **The Canyon run redesigned**: 25 s open, 25 s colony, 50 s canyon, four waves across them, its briefing in six steps.
  The flight proof's attentive pilot wins it; a still one loses it.

The clouds and the aerial country are the live page's (the dashboard's `/world` route, which the game shell iframes). A
game exported to files bakes the country to faces and draws no clouds, as it does for every airspace level.
