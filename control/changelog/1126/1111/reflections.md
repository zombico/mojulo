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
- A downpour (`wet: 'downpour'`): water stands over nearly all the ground, in a few wide sheets, and the rain strikes
  hard (more of the ground struck at once). A ring's crest catches a faint line of the sky, so rain reads on water that
  holds no lamp; standing water is darker than the film round it.
- A yard's containers wear corrugated steel sheet (`containerSkin`, a made cut as a shed's wall is): its flutes upright
  on the sides and across the top, the line's colour its tint, read by the form render as relief, so light and wet
  work on them as on any wall. The painted rib stripes give way to it.
- A container has its frame: a square rail round its foot and its head and a post up each corner, a hand proud of the
  sheet (`geocity/industry.js`, the one builder: a metro's containers and a yard's alike).
- A weather and its wetness are one thing said once: a geocube recipe with buildings that names a weather and no `wet`
  is as wet as that weather leaves a place (`wetOfWeather`: rain raining, a downpour or a thunderstorm a downpour,
  drizzle wet, mist damp), beside the weather's own falling rain and sky.
- Rain's rings are one system: on a page whose wet surfaces are struck in their own material, the weather channel
  stands none of its own (they lay at the camera's height, in the air beside a raised eye). A place with buildings
  under a wet weather and no clouds named takes the weather's own sky and its dimmer light.
- While it rains no puddle shows apart from the sheet (`raining` and `downpour` stand no pools; they stand out once it
  has stopped, `wet`); a downpour's sheet is deeper.
- Nothing falls under a roof: a building's footprint up to its roof is kept dry of the weather's falling drops, so it
  rains outside the door and not within.
- A net under a building's ground: one unseen level face a hand under its apron and a stride past its edge, so a
  walker who finds a gap lands on it and never falls through.
- An apron's skirt: the kerb round its edge goes down to the land wherever the land lies (the lowest land at the edge
  and a stride out, and a hand further), stretch by stretch, so no part of it hangs over ground that fell away where
  the site was filled. A test walks the skirt and finds none hanging.
- A night's weather takes a third of the light a day's does (a night is dark already), on a page lit by the form
  render; a yard's floodlights are brighter and reach further.
- Rain's film on what stands: while it rains a wall's and a crate's side sheet, thin runs of the sky's own light
  sliding down the face by its length, of no thickness, as the floor's film is; and the land wears the film too
  (`form.land.rain`, from the recipe's wetness): darker, smooth, the sky held in it, running in streaks where it
  stands steep, so a cliff reads wet. A land it does not rain on is as it was.
- A walker stands parked: a level's `parked` takes a vehicle word for a mecha shelf frame (a field walker, a siege
  walker), standing at its stance, fitted for a `role` where it names one, solid over what it takes up; a geocube's
  level carries parked vehicles as a stage's does. A building's `look` takes a `dressing`, and the `garage` dressing
  leaves a tall room's height and its middle clear for what is parked there: no crane, no great object.
- The sun indoors, in a building on a land: a room's faces turned to the land's sun carry its light and its share of
  theirs, no shadow baked, and the page's hour map takes that share away wherever no opening lets the sun in. A window
  lays its patch on the floor and the far wall, what stands outside it its shadow in the patch; the lamps stand lower
  by day beside it; the painted patches at the windows give way to the real ones. A face turned from the sun takes
  none of its cast (a tree outside drew its shadow on the inner face of the wall it stood behind).
- What lies loose in a wet room is wet with it: the debris's heaps and the vessels join the room's wet surfaces, each
  by its own group, in the form render (its instanced repeats take a surface as its faces do).
- A parked walker under its world's light: read in the form render, a dressed frame carries its faces' materials and
  is lit as a field vehicle is, by its world's sky and sun, wet when its weather is. A body that stands still for the
  whole level is the static world's: it casts into the hour's map wherever it stands, not only near the player.
- A body under the land's sun stands in its building's shade: the land's sun's map is drawn with the static world in
  it (at the hour's pass and whenever the land asks for it again), so a hero or a vehicle indoors takes the sun only
  through an opening (it took it through the roof).
- The hour's map fitted to the built place: on a land whose own sun shades it, the map covers its buildings' aprons
  and a margin for what stands by them, not the whole land, so its texels are centimetres: a tree's leaves read in its
  shadow on a wall, a window's patch has an edge.
- A floodlight's shadow: a yard's first two floods each carry a map of their own, drawn once with the static world in
  it, so what stands under a flood (a container, a parked walker, a building's corner) throws its shadow across the
  slab and up the next thing.
- A wet yard gives back the place: where a land's buildings are wet, a capture of the yard as it stands lit, taken from
  the widest strip of slab beside them, is what its wet slab, walls and containers hold (the buildings, the containers,
  the land), corrected to that strip's box and read along the ray past it. Standing water out of doors gives back more
  than a film does, so what stands by a puddle reads in it.
- The light of where a body stands: on a land with buildings, a body under the cast rig (the hero, a parked walker, a
  foe) carries its own light and takes the light of its place, eased as it walks: a room's lamps overhead and its
  floor's bounce indoors (lower by day, as the room is), the sky out of doors, a flood it stands under. A form body
  gives back less of the sky indoors.
- The whole cast under the land's one sun: on a page whose land is drawn as form, every body an entity wears (a foe, a
  walker, one that stands still) is read lit and carries the rig solved from the land's cube, as the piloted hero did
  alone.
- Fixed: a person's shadow was lost on a land with buildings. The hour's map was fitted to the built place only on a
  page with no entities (the fit was asked before the land was read), so with a cast it stretched over the whole land
  again and its bias swallowed anything a person's size; the fit is asked once the land is read. A whole level's test
  holds it (`worlds/built-light.e2e.test.js`).
- A yard's floods are dark by day: lit when the sun is down or low, so what stands under a mast by day wears the
  sun's shadow.
- The land's own casters (its ground, its trees) stay in the maps drawn with the static world, so its trees shade
  what is built.
- The form render takes the finish by default: a page drawn as form (a land, a land's buildings) wears the default
  `light.finish` (its tone curve, its bloom) where its recipe says nothing of one, so its lamps, its floods and its lit
  windows spill their light; `light.finish: false` says otherwise.
- Day and night for a land's buildings are told by the land's light (a sun clear of the horizon under a sky that gives
  light, or the moon): by night the floods are lit and their heads glow, the rooms' lamps stand at their full level and
  the moon's patches through the windows are faint; by day the floods' heads are dark.
- The cast's materials told apart by how they answer the light (`color-theorist/cast-response.js`): a hero read lit
  says each of its palette's groups' class (skin, hair, an eye, cloth, leather, metal: a roughness and whether it is
  metal), and under the cast rig each corner takes its class off its own colour: cloth is matte, skin takes a soft
  highlight, an eye a wet one, leather a worn sheen, a metal the rig's sky in its own colour. No map, no new geometry;
  a body with a painted texture, and the cel register, are as they were.
- A realistic hero's relief under the cast rig: the lit read asks for the body as the skinned export gets it, so a
  realistic hero brings its normal map (its skin's relief, its clothes' creases, seams and grain) and its roughness
  (each cloth's own, a leather's satin, wool's dullness: `epidermis/cloth-relief.js`), and the page's cast material
  reads both on the paint's atlas. The tangents, the parallax's depth and the correctives stay the engine export's.
- A geocube's level takes `fxStyle` (its effects' style and the cast's register: `register: 'anime'` draws its cast in
  cel), as a stage's does.
- Page pack (`scene/page-pack.js`, `scripts/pack-page.mjs`): a World page made smaller with nothing cut. Its module
  script is gzipped and the page carries a few lines that inflate it (the browser's own `DecompressionStream`) and run
  it as the module it was. One file (the script as base64 in the document) for a page a person opens, or parts (a
  small `index.html` and the script in binary files beside it, each under a size) for a host that limits a file. The
  day facility's page goes from 38 MB to 25 MB as one file and 19 MB in parts; with a realistic hero, 129 MB to 40 MB
  and 30 MB. The packed page was run in a browser both ways and draws as the page it was.
- Page pack's text form (`bundlePage({ form: 'text' })`, `pack-page.mjs --parts --text`): the script as it is, in
  `.txt` parts that each end on a whole character, for a host that serves only a web page's file types. A Claude
  artifact refused the binary parts by their extension (`.bin`, `.gz`) and took the text parts of the CDN build. A
  packed page whose host refuses a blob as a script now writes the script into the document as an inline module; seen
  to run that way under a policy that allows only inline and CDN scripts.
- Said once: two parked vehicles that are the same vehicle in the same dress are one figure stood twice.
- A face's blend shapes said once and only where they move (`figures/morph-sparse.js`): a faced part carried a row a
  corner, every target at every corner; now the corners that share a row share it, and each target's column holds only
  the rows it moves, in the same 16-bit steps, exactly (sparse then dense is the input byte for byte). A dressed
  realistic hero's face goes from 36 MB to 2.5 MB. The page's two players read it (`__mz`); an export keeps its floats.
  The lit read's face rows, which came as an export's floats, are written the page's way too: the facility's page with
  a realistic hero goes from 129 MB to 59 MB, 25 MB packed in parts.
- A realistic hero's geometry as the page reads it (`pageFigures`, `full: 1`): a part that carries its paint's place,
  its normals or a face's rows was a corner a triangle, every number a float32; it is now welded (the corners that are
  the same corner are one), its places and its paint's places on 16-bit grids over their own range, its normals signed
  bytes, and its face's rows named by the welded corners. A part with an engine's tangent, corrective or metal stays as
  it came. The facility's page with a realistic hero goes from 59 MB to 48 MB, 22.7 MB packed in parts; the hero itself
  from about 21 MB to about 10 MB.
- The far lift, in progress (`scene/channels/far-lift.js`, a land's `farLift`, opt-in): the grass past the view
  cone's reach given its height. The ground is drawn a second time where grass grows, pushed up to the sward's height
  × its cover (so it comes down to the ground where the grass ends), in the far field's colour, rising from nothing at
  the reach. Rendered on the island trail with it on and off: the far grass stands over the bare ground behind it and
  hides the feet of far trunks. It replaces a first attempt drawn as a wireframe box.
- The grass's economy, in progress: the tall and medium swards a fifth shorter (their width kept, so the cone's reach
  is unchanged) and about a fifth denser, thinning sooner (from 0.42 of the reach), so the density is spent near the
  eye; the far lift stands over the blades' tips (× 1.3). A change to every gen-7 page's grass; its change-reach tests
  pass.
- The grass lines, in progress (`GRASS_LINE`, `form-grass.js`): between the thinning and the reach half the clumps
  stand (`POV_GRASS.keep`); past the reach a share of them stand again on a crest (the ground behind falls below the
  line of sight) and at a patch's near edge, out to three reaches, wider and taller with distance, on the far lift
  where there is one: the land's layers and the lift's side read by a line of blades, solved from the camera each
  frame. A tile's rows are ordered by their dice and it draws only those that can stand at its distance. Not yet seen
  drawn; its tests not yet run.
- The far lift's seam, in progress: the lift begins where the blades begin to thin and is whole at the reach, rising
  among them and filling in as a stipple of blade-sized cells, so there is no stretch where the blades have gone and
  the lift has not come. The grass lines' patch-edge clumps are removed; the crest lines stay. Not yet seen drawn.
- The far lift's walls, in progress: a raised plain stands at its full height to a patch's edge and comes down to
  the ground there as a steep side of the same triangles and material, drawn where no grass is mapped too (the
  grass's own colour), so it is closed all round; the side's lower part fills in with the seam's stipple. Not yet seen
  drawn.
