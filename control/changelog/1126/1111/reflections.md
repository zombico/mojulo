### Reflections: built things under a live sun, a wet ground that mirrors

- The sun's shadow on a built thing outdoors is live, never baked into its corners. A building's shell and its yard's
  containers carry the sun's share of each corner's light, and the page's hour map takes it away where the sun is
  hidden. Open: under a strong sun a container's faces draw in uneven bands. The cause is the live shadow map: the
  bands go when the containers are kept out of it (`shadows.noCastGroups`), so they are shading themselves in error.
  The map's fit and bias on a land page are the next thing to set.
- A sun for rooms indoors. A room kit's recipe takes `daylight: { elevation, azimuth?, color?, gain? }`, and the form
  render takes it live: every corner turned to the sun carries its share, and the page's hour map (which a room's page
  did not have) takes it away where a roof or a wall hides it, so the sun comes in at a window as its own shape on the
  floor. Glass, sky cards and the painted sun patches let it by, and the painted patches give way. A painted page lays
  none, and a room without the word is as it was. `alone: true` turns the lamps off: the room lit by the day alone.
- A daylight's `gain` stands the sun over its paint: the solve lays a sunlit surface as painted, and the sun is then
  that many times it.
- Samples: a recipe's `samples: [{ of, at, size? }]` sets a material down in a room to be looked at: a liquid (`oil`,
  `water`) a pool on the floor, a metal (`chrome`, `steel`) a cube, each with its own roughness and metal to the form
  render. What they show today: a room gives a mirror nothing to hold but a plain gradient, so a pool is dark and a
  chrome cube a dark box; neither holds the windows, the sun on the floor or each other.
- A room's capture. Where a room's page asks for reflection with a `probe`, the form render takes one cube of the room
  as it stands lit, a few frames in (after the hour's map is drawn), and a glossy surface looks it up along its
  reflected ray where that meets the room's own box, down its mips by its roughness. A pool holds the wall's lamps and
  a chrome cube the floor's markings; a rougher metal holds them blurred. A room with samples asks for it.
- A liquid stands proud of what it lies on: a pool's face is its `thick` over the floor (oil 14 mm, water 9 mm), its
  edge a rounded lip down to it, so the lip turns the light and the pool reads as lying on the floor.
- A pool's outline is a smooth one (slow waves round it by its dice, no corner). A liquid may be seen through
  (`clear`): square on it keeps a share of its own colour and the floor shows under it, darker where it is wet; the
  lower it is looked along the more it mirrors. Water is so. A fuel carries a thin film on its face (`film`): what it
  gives back is coloured by the film's thickness and the eye's angle. `gasoline` joins the samples.
- A liquid is seen as what it is. `rupa/liquid-look.js` reads a liquid's look off its matter: its thickness from the
  puddle its surface tension holds against its weight (and what a yield stress holds over that), its smoothness from
  whether it flows; its colour, clearness and film beside (`LIQUID_OPTICS`, a row a liquid, held to the matter table's
  own list). A room's samples take any of the table's liquids and draw them from it. `gasoline` and `crude` join the
  matter table.
- Footfalls in a liquid (visual cues, no solve). A step that comes down inside a pool's outline rings it: the rings
  bend what the pool holds and die as its liquid lets them (`liquidLook().ripple`: water rings, honey barely, mud not
  at all). The steps after it, past the pool's edge, are wet: a dark print each, fainter step by step, drying away
  (`print`, the liquid's own count). A step is a piloted figure's gait or the walk's own stride.
- Wet with no depth (`wet-hugs-the-surface`). A room kit's `wet: true | 0 to 1` wets its floor as a state of the
  surface: no thickness and no edge of its own, the relief kept, the water lying by the tile's own height (its joints
  fill first and lie mirror-smooth, its faces darken and take a sheen), thinner and thicker over the floor by the
  world's place. It holds the room's capture and, under lamps alone, each lamp's highlight. Past brimming it is a
  pool, which has a thickness. The form render's; a painted page lays none.
- On a wall a wetness runs: streaks down the face by the wall's own length, heaviest at its foot and thinning up it;
  a ledge or a joint still holds it. A wet room's walls, plinth and trim take it with its floor.
- Out of doors a wet recipe wets every built thing with no depth: the apron, the walls, the roofs and a yard's
  containers, each by the same law (the slab's joints full and its faces dark, the walls and containers run with it).
- Degrees of wetness (`era/wetness.js`). A recipe's `wet` is true, a degree (`damp`, `wet`, `raining`), 0 to 1, or
  `{ degree?, amount?, spots? }`. The rules: water finds the low ground first (joints, then hollows, then faces); a
  wetness has a cause (rain is everywhere and shows no edge; a leak or a spill is a spot that fades from its heart and
  may stand as a pool there); a wall is wet by what runs down it and never wetter than the ground under it; while it
  rains the standing water is struck with rings. Out of doors `wet` and `raining` stand pools in the ground's hollows;
  under a roof no rain falls and only a spot pools.
- Floodlights: a building's `yard: { floods }` stands masts along its yard's edge. Each is a lamp no bake holds, laid
  whole by the page with its highlight (the nearest four, apart from a room's own lamps).
- A yard's slab is laid in bays three metres square with a sealed joint (`yardSlab`, a floor's dressed cut), as a
  room's flags are, so its joints hold water.
- A built thing out of doors casts into the shadow map by its far faces only (it is closed and drawn both sides), so
  its lit faces no longer shade themselves in bands: the fault on the containers and the slab.
- What a floodlight lays is not the sun's or the moon's to take: the hour's shadow leaves it standing.
- Open, on a wet yard at night: a floodlight casts no shadow of its own; standing pools and rain rings are faint; the
  slab is plainer than a room's worked floor.
- While it rains every face out of doors that is not a floor is wet all over (darkened and smooth as a film of water),
  its runs only the heavier part.
- A floodlight's head is turned down (a cone under it, soft at its edge), and a yard's floods may stand down its
  middle (`yard.floodsAt: 'middle'`).
- Splatter patterns (`rupa/splatter.js`): the shapes a liquid leaves on a flat, as primitives that join (a disc, a
  capsule; where two meet they run into one). `blot`, `splash` (a body and the drops flung off it), `drips` (a trail),
  `run`, `seam` (held in a line), and `puddles` (rain over a rect by the share that stands, none with its heart in a
  box kept out); `join`, a field, and a raster for a page.
- Puddles on a flat. A wet place whose degree stands pools lays `puddles` over every slab apron, rastered once, and
  the form render stands water where the pattern's depth passes its edge: level with the slab, no thickness, a soaked
  rim round it, struck with rings while it rains.
- While it rains the whole ground wears a film: a skin of water over every face that looks up, thin enough that the
  joints show through, and struck everywhere with small rings (each cell on its own beat), larger and slower where
  water stands deep.
