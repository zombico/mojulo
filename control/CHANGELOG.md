# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md).

## [Unreleased]

### Historic city

- **In progress.** A historic city becomes its own generator rather than a setting of the metro city,
  built one period at a time from the first cities of Sumer toward the present. A period is read as a
  composition of shared visual patterns (sun-dried earth, flat-roofed cubes, courtyard houses, stepped
  platforms, niched walls, towered ring walls, canals through town), so later cultures reuse them.
- The town is built in two steps. The layout claims ground and asks for buildings by slot: the
  ziggurat site, each house lot facing its lane, each wall run, tower and gate facing out. A per-period
  asset kit builds each slot on its own random stream, so redesigning one building moves nothing else.
  Each kit asset is designed from a massing sheet dreamed on the optional local image worker, then
  rebuilt as plain masses; the sheet is a design aid and is never stored. Until an asset is designed, a
  plain placeholder stands in its slot. The metro city is unchanged.
- Mud brick leans: walls, towers, tiers and platforms are battered, stairs climb on slopes, and the
  reed hall is a round vault. The ground is surfaced for street level — beaten mud alleys, rubble and
  sherd main streets, baked-brick quays, precinct and courts, cracked dry earth outside the wall — and
  the page opens on a street view or a view from the precinct court as well as from the air. Palms are
  low-poly date palms, which cut a whole town's page to about a quarter of its size.
- A town carries its art and its street life. The shared vocabulary gains art (votive figures,
  stelae, door emblems, guardian beasts, friezes, mosaic skins, ritual vessels, altars) and street
  structures (wells, kilns, granaries, boats), each noted where it recurs across cultures, and the
  layout places them by meaning: offerings, guardians and the altar on the sacred axis at the
  ziggurat's stair, the goddess's reed posts at her doors, stelae inside the precinct gate, worshippers
  facing the god, wells where lanes meet, kilns under the wall, granaries by the precinct, boats at the
  quays. Sumer's set includes the cone-mosaic Pillar Hall of Uruk, copper bulls, the Uruk vase and a
  temple portal with its cattle frieze and lion-headed eagle. Round, domed and hooped forms are new
  building blocks.
- Each asset can be drawn as an SVG blueprint from its own parts before it is rendered: front and side
  elevations, plan, dimensions, a parts table and build notes, so a design is checked in pure geometry
  first and the drawing never drifts from the model.
- Walls show what they are made of. A transparent material layer rides over each wall's own lit
  colour, so sun and shade are kept: bare mud brick with a herringbone course on the city wall and the
  platforms, baked brick in dark bitumen joints on the ziggurat's casing, mud render on the houses
  (rain streaks, a fallen patch, the courses showing through where the foot of the wall has worn), and
  lime whitewash with hairline cracks on the temples and pale houses. Each culture says which mass
  wears which material. The coursing is pinned to world height, so neighbouring faces line up. The
  layer shows in the CSS 3D page only; the WebGL World keeps flat colour for now.
- The town can be walked. A loose grid of narrow alleys runs between the blocks, so every house
  fronts a lane and no block is more than two houses deep (before, about a third of the houses had no
  way in), and each house stands a little in from its lot so neighbours read as separate buildings.
- The sacred precinct has room: it is larger, kept clear of the wall's towers, and its temples stand
  by measured clearance from the ziggurat and its long front stair instead of crowding them.
- The canal is a smooth channel sunk below the town between baked-brick embankments, with one quay
  strip along each bank and nothing laid over it. Where a main street crosses, a humped brick bridge
  climbs by stairs over a corbelled opening high enough for a reed boat's horns, and the boats float
  on the water. A canal view looks along the quay at the middle bridge.
- Brick walls read as brick in the walkable World as well as the page: bolder courses with relief,
  the reed-mat layers Sumerian builders laid between courses, a stamped course in the baked brick,
  and a share of houses left as bare brick instead of mud render.
- A second culture, New Kingdom Thebes, on the same template: the Nile along the town, the temple
  of Amun on an axis from its river quay through an avenue of sphinxes, obelisks and colossi, a
  pylon, a court and a hypostyle hall to the sanctuary, a sacred lake, and an unwalled town of
  mudbrick houses and villas. Each culture now brings its own layout; the grid, alleys, house lots
  and slot placement are shared.
- Thebes' temple walls show figures drawn to the Egyptian canon instead of one repeated group: the
  king in the blue crown making offerings to Amun, Mut, Khonsu and Ra-Horakhty, each god with their
  own crown and emblems, in a set of different ritual scenes with hieroglyph captions and
  cartouches. Each wall gets whole registers of scenes, and every scene faces into the temple; each
  pylon tower shows one smiting scene, centred, with the god standing by the gate.
- Thebes' ram-headed sphinxes are modelled in rounded forms instead of blocks: a barrel back,
  rounded shoulders and haunch, forelegs rising into the chest, a ram's head with a long sloping nose
  and horns curled round the ears, on a moulded pedestal. Small carved parts on every asset no longer
  show a jagged fringe at their edges.
- A third culture, Old Kingdom Giza (c. 2515 BCE, under Menkaure), shows the pyramids as they looked
  new: cased smooth in white limestone to the apex, Khafre's foot in red granite, Menkaure's lower
  casing in undressed granite. Each pyramid stands on its court with a mortuary temple on its east
  face, and a causeway runs down to a valley temple on a harbour. The site also has:
  - the Great Sphinx in its quarry, with no beard yet, and its temple before it;
  - Khufu's queens' pyramids and boat pits;
  - mastaba tombs laid out in streets;
  - the Wall of the Crow and the workers' town of galleries, bakeries and houses;
  - ships bringing stone along the canal.
  It is the first site on a raised plateau: the ground falls from the desert down an escarpment to the
  floodplain, and slanted faces now turn and lift with their asset.
- Giza at work: Khufu's and Khafre's satellite pyramids, and Menkaure's temples as a building site with
  stacked blocks, a mud-brick ramp and loaded sledges. The main quarry stands south of Khafre, stepped
  down from its rim, and Tura limestone sits stacked on the quays. Each capstone is plain limestone, as
  the one found at Giza is; `pyramidion: 'electrum'` gilds them as a labelled conjecture, since gilded
  capstones are attested only from the 5th Dynasty on. New views: the building site, and beside the
  Great Pyramid's apex.

### Historic countryside

- **In progress.** A historic city gains sub-scenes for what its people could make and grow, beside
  what they built: the first is the countryside that fed Sumer. A branch canal leads water through
  baked-brick sluices into channels on low banks, with long strip fields between them. Off in the
  fields stands a farmstead: a house round a walled yard (bread oven, reed shade, a ground loom), a
  blind storehouse filled from roof hatches up an end stair (the barn of a dry country), a stable of
  piers and mangers, a reed byre with ringed reed posts through its roof and its dairy jars, a
  reed-fenced sheepfold, a round threshing floor, a tool shed, a shaduf on the canal bank and a palm
  garden.
- The tools are the period's own. An ard plough (a seeder with its funnel in the sowing season),
  clay sickles (Sumer reaped with sickles; the scythe is Iron Age), hoes, mattocks and winnowing
  shovels, a two-wheeled cart and a four-wheeled wagon on solid three-plank wheels, a threshing
  sledge, grain heaps sealed in mud, measures, baskets and jars.
- The scene keeps to a season, because a Sumerian year kept the work apart. At harvest (the default)
  the barley stands and is being cut, sheaves are stooked and carted and the threshing floor is
  busy, while a fallow strip is broken with the plain ard. At sowing the seeder plough is in the
  furrow and the fields are furrowed and sprouting. Fields show as furrows, sown rows, stubble and
  standing barley. The page opens from the air, in the yard, at the threshing floor, at the edge of
  the reaping, or by the plough.
- Tools and buildings only, at rest: people and beasts are left to their own builders, so a plough
  stands with its yoke on the ground, a cart with its pole down, the pens and stalls empty.
- Each piece cites its record, every gap reported. A beam (a straight timber at any slope) joins the
  angled building blocks. Small faces no longer stretch along their length when they are sealed
  against hairline gaps; before, a long roof edge overshot its building by up to a third, in the
  town too.
- A second sub-scene shows the works: how Sumer made its tools and its building stuff, and from
  what. The plain had clay, reed, water and palm, and no stone, ore or tall timber.
  - Its quarry is a clay pit sunk into the plain by a canal. Beside it are treading pits with straw
    for temper, a moulding field of fresh bricks drying in rows (the wooden mould left at the end of
    the last row), stacked hacks, and an updraft brick kiln with its fuel, ash and baked bricks.
  - The potters have a shade over the wheel, greenware drying, stacks of bevelled-rim bowls,
    settling tanks, a wasters heap and the town's beehive kilns.
  - A landing takes in what the plain lacked: stone, basalt querns and flint, with a knapping
    floor. Bitumen boilers cook mastic beside it.
  - The forge is a coppersmiths' yard. Ingots smelted at the mines are melted there in crucibles on
    bowl hearths blown with reed pipes, then cast in stone moulds and finished at an anvil stone.
    Charcoal clamps burn beside it.
  - A wheelwright makes the carts' three-plank wheels.
  - The reed cutters stack and plait at the marsh.
  - The page opens from the air, or at eye level in the brickyard, the forge, the potters', the
    landing, the clay pit or the wheelwright's.
- A slanted panel now turns with its piece, so pieces can carry sloping faces like a pit's cut
  sides. A roof on posts draws its underside.
- A third scene sets the city in its land. The walled town stands in the middle and its canal runs
  on past the walls both ways. Around it the land is zoned by what each place needs:
  - Upstream: the brick and pottery quarter on both banks (clay pits, brick fields and kilns,
    potters' yards).
  - Below the town: the harbour (kar), with its quays and boats, merchants' storehouses, bitumen
    boilers, and the coppersmiths with their charcoal clamps.
  - Along the levees by the walls: palm gardens.
  - North and south: strip fields on their channels, with a farmstead in each quarter.
  - Where the canal runs out: the reed marsh. On the steppe at the edge: sheepfolds.
  - The page opens from the air, from low over the quarter or the harbour, or at eye level in the
    fields, at the harbour or by the kilns.
  - From the air the small things (jars, tools, fence posts) are left out. An eye-level page
    carries only its own view: it leaves out what is behind the camera and draws the ground only to
    about 220 m. Drawing a whole land's ground at that detail runs the page out of texture memory.
- The town can be planned without its own fields and palms outside the walls, and gives the line of
  its canal, so a larger scene can carry the canal on.
- Egypt gets the same sub-scenes, at the date of the Thebes town (about 1250 BCE): a countryside
  and its works, built from Egypt's own tools and buildings.
  - Kept from Sumer: the clay pit, the treading pits, the brick field and the hacks. Egypt made
    brick the same way and did not fire it, so there is no brick kiln.
  - The farm ploughs with a horn-yoked ard and broadcasts its seed. It reaps high with flint-toothed
    wooden sickles, and carries the grain off in rope nets and donkey panniers rather than carts.
  - The cattle trample the threshing floor inside its kerb. Scribes measure the grain under a shade,
    and it is stored in a court of domed silos. The A-shaped hoe sits in the tool shed.
  - Newer things Egypt had: an upright loom, a vineyard on forked-post pergolas with its treading vat,
    pottery beehives, and checkerboard garden beds by a shaduf pool.
  - A third season: the inundation, with the basins under water.
  - The works:
    - a sandstone quarry face with stepped benches and blocks freed by trenches and wedges;
    - sledges on wetted sleepers bringing blocks to a masons' yard, where a colossus stands in its
      scaffold;
    - a stone quay with a barge carrying a granite block;
    - a foundry blown by trodden pot bellows, with oxhide ingots;
    - a glass and faience works;
    - carpenters sawing a plank lashed to a post;
    - a chariot shop making spoked wheels;
    - a boatyard with a plank hull on stocks;
    - the potters' tall kilns and bread moulds;
    - papyrus works by the marsh.
  - The farm opens from the air, in the yard, at the threshing floor, at the reaping, by the plough
    or over the flooded basins. The works open from the air, or at eye level at the quarry face, on
    the sledge road, in the masons' yard, the foundry, on the quay, in the boatyard, the glass works,
    the chariot shop, the brickyard or the potters'.
  - Each piece cites its record, every gap reported.
- The farm's eye-level views (Sumer's too) cut the ground finer near the camera, so it no longer
  drops out in front of the eye.
- Egypt's farm and works now use the Thebes town's own colours and wall skins, so a farm and the town
  beside it are the same Nile mud and the same gypsum wash.
- Thebes in its land: the town on the Nile's east bank, about 780 × 640 m of country around it.
  - The river runs on north and south past the town.
  - Downstream (north): the harbour, with stone quays, a barge and ships, a boatyard and granaries.
  - Upstream (south): the works, set by what each needs. The clay pits are at the water, with brick
    fields behind them. A stone quay and the masons' yard take the sandstone barged down from the
    quarries; then come the potters, carpenters, chariot makers, the foundry and the glass works.
  - East of the town: basins between their dykes, with the estates among them, out to the edge of the
    low desert. Shadufs and palms line the bank.
  - Three seasons: in the flood, the basins lie under water.
  - It opens from the air, in the fields, on a harbour quay, in the works, from a boat on the Nile,
    or in any of the town's own views.
- A region of an unknown culture is an error rather than a Sumerian town.
- The region's ground stays on the ground in the walkable World. A region is large enough that the
  World read the town's thin ground layers as one plane and stacked overlapping strips upward (by up
  to 4 m in Sumer's); its layers are now spread far enough apart to stay separate planes.

### Historic light

- **In progress.** A historic town takes the sixth-gen composer's light: the sun is baked once at build
  time and carried by the page. Each culture has a style card (`lib/graph/historic/style/`) that states
  how its town should look as principles, plus the numbers the builder reads. Each principle has a
  machine check (`style.test.js`).
- Cast shadows on the ground (`lib/graph/historic/light.js`). Every mass stands in an occluder
  heightfield. Battered walls, ziggurat tiers and pyramids are sliced so their slopes cast their true
  stepped profile. One sweep along the sun's azimuth then finds the ground in shade. A palm's crown
  floats and casts a gappy disc from its height.
- Sky occlusion darkens the foot of every wall and the floor of every narrow alley.
- The shade is a cool tint at the card's alpha, never black. It is one map for the whole town (about
  300 KB), laid into every ground face's background at that face's place, so overlapping shadows never
  darken twice.
- Measured on the current plans: Sumer's alleys are about a third in shade, against a twentieth of its
  main streets and a tenth of the precinct court.
- The page's backdrop is the card's sky, hazy blue overhead and pale with dust at the horizon,
  replacing the flat beige.
- `shade: false` leaves both off. The CSS 3D page only: the WebGL World ignores the map and keeps its own
  light. Shadows land on the ground, not yet on walls or lower roofs. The region, farmstead, works and
  asset-sheet scenes are unchanged.

### Historic Hellenic

- **In progress.** The first Greek city: Hellenistic Lindos on Rhodes, c. 180 BCE (`culture: 'lindos'`), and the
  first town on a sea cliff. The sanctuary of Athena stands on a rock 116 m over the water. Below it the town lies on
  the saddle between the great harbour and St Paul's bay. The picture is cropped to what the eye reads (the rock,
  the town, the two bays), not the whole district.
- Its record (`lib/graph/historic/record/lindos.js`) cites the temple (21.65 × 7.75 m, four Doric columns at each
  end), the propylaia, the 87 m stoa with its 42 columns and 21 m stair, the theatre and Pythokritos' ship relief. It
  lists what the scene must not show: the Knights' castle, the white cubic village, whitewash, the 1930s
  restorations, the Lindian Chronicle. Athena's sacrifices were fireless, so her altar never burns. Heights the
  record lacks are marked as conjecture in the kit.
- Rock is made, not drawn (`lib/graph/historic/rock.js`). The layout gives the rock its shape, and the landform
  operators weather it: strata bench and band the faces, joints break them into blocks, talus sheds scree at their
  feet. It is meshed in slices at the bed planes, so the cliff reads in bands. Only steep ground is weathered. The
  summit the temple stands on, the climb, the stair, the theatre and the town keep their exact levels.
- Ground that is not flat, for any culture (`lib/graph/historic/terrain.js`). A layout's height function may jump.
  Where it does, the step stands as a vertical face on the true contour, found by bisection: a cliff (bare rock) or,
  under 4 m, a dry-stone terrace wall. The town is built on terraces 3 m apart, with a street at the foot of every
  terrace wall and stairs climbing between them.
- The land casts. A style card can stand the land in the light bake (`light.terrain`), so the cliffs throw their
  shade on the sea. Lindos' card states six principles, each with a machine check: the value order of stucco,
  plaster, rock and cliff; the cliffs' shade on the water; the climb rising station by station, with nothing higher
  than the goddess; terrace walls no taller than a storey; turquoise shallows and a deep sea; fire in the town,
  never on the altar.
- A kit of the Doric order shared by every building: column, entablature with triglyphs, pediment, tile roof. It
  builds the temple, propylaia, stoa, great stair, theatre, courtyard houses on stone socles, the ship relief, statues,
  towers, kilns, a round tomb, warships and boats. Each was designed from a massing sheet dreamed on the local image
  worker. New patterns: classical order, tile roof, stoa, propylon, theatre, round tomb, peristyle, acropolis,
  terraced hillside, sea cliff, rock relief, statue base. New wall skins: dry stone, stuccoed poros, isodomic ashlar.
- Fire is opt-in (`fire: true`). The plan hands over its house hearths and potters' kilns as fire sources, in the
  fire channel's kinds. Without it the plan carries none.
- The generic Hellenistic polis (`culture: 'polis'`) is the same plan on a gentle hill, with no cliff and no open
  sea, so other Greek towns can start from it.
- **Historic cities on the WebGL World page** (`assembleHistoricWorld`, `renderHistoricCityToWorld`). The CSS 3D
  page draws each face as its own HTML element, and Chrome starts dropping faces when a town's eye-level views pass
  about ten thousand of them. On the World page the same faces are a few draw calls. Lindos loads in under a
  second and holds 60 fps in every view, at about 7.9 MB against 12.4 MB for the CSS page. The World page takes
  the scene as it is, its ground tiles and wall skins resolved to textures and the style card's sky as its sky
  dome. The CSS shade map is not baked for it (the World never reads it). The CSS page stays the light aerial
  preview.
- **Water you can see into.** On the World page the Lindos sea takes the native water look (`lagoon`): ripples,
  the sky reflected more strongly at a grazing angle, a sun glint, and froth where the water thins against the
  shore. Its depth comes from a seabed that shelves gently off the beaches and drops away under the cliffs, worked
  out from the distance to the shore. The water is clear turquoise over the sand in the shallows and opaque blue
  offshore, set by each corner's opacity on one translucent sheet whose pieces never overlap. The seabed (about a
  thousand triangles near the shore) is drawn on the World page only. The CSS page keeps its opaque two-tone sea.
  A culture opts in with `water.look`; terrain water takes `liquid`, `alphaAt`, `sheetFill` and `fine`.
- **Live fire on the World page.** With `fire: true` the potters' kilns and the hearths in the house courts burn
  live: flames, sparks, smoke and their light on the walls and ground. The painted flame cards stand down there,
  and the CSS page keeps them. The fire channel takes a new opt-in `unit` (metres per scene unit;
  `firePageChannel(…, { unit })`). The fires are given and burn in metres, since their buoyancy, smoke and sparks are
  physical, and the page scales them into the world's units, with their light falling off over the same metres.
  Without `unit` the fire script is byte-identical.
- Views: the great harbour from a boat (`bay`), the climb, the stoa's terrace and great stair, the temple court, the cliff from the sea, the
  theatre and a town street. Sumer, Thebes and Giza are byte-identical.

### Historic Qin

- **In progress.** Qin Xianyang and the Lishan works at c. 212 BCE, the first Chinese culture. Qin is the
  earliest Chinese city that still reads as Chinese (grey tile roofs, red columns, raised earth terraces,
  walled axial compounds), and early enough that its roofs are honestly straight.
- Its own record (`lib/graph/historic/record/qin.js`): Xianyang Palace No. 1, Epang's front hall begun,
  the Lishan mound, enclosures, gates and halls, terracotta Pit 1, the Wei bridge and the Zhengguo Canal.
  Each entry is cited and dated, with its confidence and the disputes between sources. Settled by the record:
  - No outer wall at Xianyang has been found, so none is drawn as fact.
  - Upswept eaves and glazed roof tiles are held with their much later dates.
  - The Han analogues (the Gaoyi que, pottery tower models, the Sichuan market brick) carry their CE dates,
    so a Qin scene uses one only by naming it as an analogue.
- A style card with a design language (`style/qin.js`):
  - One batter for every earth face, about 77°, with pounded courses of 6–10 cm.
  - Columns six to eight diameters tall on stone bases, one bracket block each.
  - Straight hip and gable roofs, with eave-end tiles 16 cm across.
  - A palette sampled from reference swatches.

  Each principle is checked on the kit before any town plan exists. The reference drawings, and what each
  one gives the kit, are indexed in `docs/historic/qin/`.
- The town (`culture: 'qin'`, layout `wei-wards`): Xianyang on the north bank of the Wei, with no outer
  wall.
  - The palace enclosure holds Palace No. 1 on its two-tier terrace, a lesser hall either side, and a
    pair of que in its south gate.
  - The axis runs on as a poplar-lined avenue to a timber pile bridge over the river.
  - Walled wards line the avenue, each with its gate on an east–west avenue and lanes of courtyard houses
    inside; the row under the palace is the elite's, with higher walls and tiled, hipped halls.
  - One ward is a walled market with its drum tower (a Han analogue, labelled as one).
  - Across the river, Epang's front hall is a building site of rising earth sections, plank forms, ramps
    and spoil.
  - Loess fields of millet and wheat lie round the town.
  - Views: palace, gate, avenue, ward, market, bridge, works.
- The Qin kit (`assets/qin.js`) builds every piece from the card's numbers: hall on terrace, que,
  rammed-earth wall, ward gate, courtyard house, market, terrace works, bridge and trees.
  - Roofs are frusta whose top is a ridge line, so they are straight by construction.
  - Two new wall skins: `hangtu` (pounded courses, rammer dimples, the board-form lifts and tie holes) and
    `tile-roof` (cover rows over pan channels). The tile skin is the first laid on a sloped face.
- New shared patterns: rammed earth, tiled roof, timber frame, terrace hall, walled ward, market and bridge.
- The page is about 21 MB, between Giza's and Thebes'. The other cultures are unchanged.
- The Qin ground in two steps, on the shared terrain mesher (`terrain.js`) as Lindos' is: the layout gives one
  height function and the mesher stands the steps up.
  - The palace stands on the lip of the Xianyang tableland, 10 m up. The bluff beneath it is sheer loess,
    ragged except under the palace, and cut by two gullies whose floors climb to the tableland.
  - The wards lie on the plain below. The axis climbs the bluff to the que as a rammed-earth causeway.
  - A new `bluff` view looks along the edge.
- The Wei through the same water channel as Lindos' sea. It uses the native `river` look, silty and flowing
  east, near opaque over the channel and clearer over the bars' shoulders, with a riverbed under it on the
  World page.
  - It is braided round sandbars. Each bar stands out of the bed with a low lip, so the mesher traces its
    outline on the true contour instead of stepping it to the grid.
- The World page is cropped to the town. A layout can ask for a skirt (`plan.world.skirt`): the land runs a short
  way past the frame, its heights carried out from the frame's edge, each corner fading to the sky's horizon
  colour with its distance. Past it there is only sky, so the town stays the focus however the World is turned.
  Qin's runs 260 m. Cultures without a skirt are unchanged.
  - Beyond it, on the World page only, a hazy Qinling in the south and the northern hills. They are brought in
    and scaled so they sit at about their real angle on the horizon.
- The height of the bluff and the line of the river are drawn, not measured. Both are in the record as
  unverified (`xianyang-tableland`, `wei-braided`); the Wei has since moved north over the old town.
- Qin opens on the shared World page (`renderHistoricCityToWorld`) like Lindos: about 15 MB self-contained,
  against about 21 MB for the CSS page.

### Historic entries

- **In progress.** The historic cities reach the agent. Until now they were reachable only from code.
- New world kind `historic`: `create_sketch({ manifest: { kind: 'historic', culture, scene, seed, … } })` mints
  a culture at its period as a walkable World:
  - `scene` is `city` (every culture), or `region`, `farm` or `works` where the culture has one;
  - an unknown culture or scene is refused with the list of ids;
  - the cities, regions, farms and works render as they did, byte-identical.
- Each culture card gains `readAt`, `period` and `place` as data, from its own documented header. Sumer has
  no read-at year yet: its card spans the Uruk and Early Dynastic periods. The generic polis has no place;
  it is invented.
- A caption for every historic scene (`lib/graph/depiction.js` `describeHistoric`), read from the cards.
  It keeps two questions apart: the PERIOD (when and where) and the DEPICTION (the era's budget plus a look).
  For example: "New Kingdom Thebes · New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE) · Thebes, Upper Egypt
  — drawn sixth-gen, to the thebes style card". A field a card lacks is never guessed.
- Encyclopedia entries, generated from the culture, record and style cards (`lib/graph/historic/entries.js`)
  and served as view-vocab cards of a new family `entry`. No tool is added and no tool description names an
  entry. An agent goes from a cold ask to a world in three calls:
  1. `semantic_search` finds the entry;
  2. `get_view_vocab({ id })` reads it;
  3. `create_sketch` mints one of its starters.
- What the cards carry:
  - **An entry** holds the infobox (subject, period, place, depiction, basis, checks), its parts by the ids
    its generators use, its scenes, and STARTERS: `historic` manifests to copy and change.
  - **Its record** (`<id>/record`) lists each record entry with its confidence and sources. It is read on
    demand and kept out of search, so an entry always answers before its sources.
  - **A region with more than one culture** (Egypt, the Greek world) gets a hub listing its entries in time
    order.
  - **BASIS** follows the record: read → ATTESTED, secondary → RECONSTRUCTED, unverified → CONJECTURAL. The
    town plan is never ATTESTED.
  - **SCOPE** says up front that each entry is a general depiction of its period, not one year's town, so
    anachronisms are expected: pieces from across the span side by side, gaps filled from parallels. The
    hubs and the routing card say the same, and the agent is told to say it when it hands a world over.
- Culture cards gain `region`, `aliases` (the words people search with: pharaoh, Luxor, ziggurat) and
  `record`, the record the entry stands on. The entries are found on the default lexical path, with no
  embedding model.
- A card contract test holds what an entry reads off each culture card: `years`, `period`, `readAt` (or null),
  `place` (or null when invented), `region`, `aliases` and `record` (or null). A new culture that lacks a line
  fails with the list of lines its card still needs. A card that says nothing about its place reads "place not
  recorded", never "invented". A region with no row of its own still gets its hub.
- Pompeii and the Forum Romanum (79 CE) are entries too, with their records and a Roman Italy hub: "pompeii",
  "vesuvius", "the roman forum" and "ancient rome" find them.
- `semantic_search` takes English terms, as its description already says. The host model translates first.
- A routing card, `historic`, sends a cold request to the entries. The routing eval gains rows for it.
- `get_view_vocab` takes the `entry` family. create_sketch's `manifest` property names the `historic` kind.
  The `tools/list` payload pin moves from 267,900 to 268,200 (measured 268,159).
- Fix: an upgraded install now indexes cards a release ships. The search index used to be built only when
  empty, so new cards (these entries, and any routing card added since) stayed unsearchable until a manual
  reindex. Once per process, before the first search, a corpus built by a reindex is checked for shipped
  cards it lacks, and one reindex adds them.
- Fix: record cards cite a group author whole ("various", not "various (sxlib").

### Historic on-ramp

- **In progress.** Adding a culture is a card, a registry line and a scaffold, at any depth:
  - depth 0: a card on another culture's layout and kit, in its own colours;
  - depth 1: plus its record and style card;
  - depth 2: plus its own assets;
  - depth 3: plus its own layout.
- Registries, one line per culture or layout: `historic/cultures/index.js`, `historic/layouts/index.js` and
  `historic/regions.js`, beside `historic/style/index.js`. `planHistoricCity` dispatches from the layout table
  and refuses an unknown layout id. A view the scale table does not name renders at eye level instead of an
  undefined scale. Every page is byte-identical.
- Each culture's depth is found, never claimed (`historic/depth.js`): what it shares with a culture
  registered before it, by identity. Its entry says it on a DEPTH line, for example "0 of 3: its own style
  card; record, assets and layout from lindos" for the polis.
- A card's `land` names its farm and works scenes, replacing a table written into three files. The scene lists
  follow the registry.
- `scripts/new-culture.mjs <id> --like <culture> …` scaffolds a culture at depth 0:
  - it writes a card spread from an existing culture, with every contract line filled or null, `record: null`
    and `land: null`;
  - it adds the registry line and `docs/historic/<id>/README.md`;
  - the culture renders, mints and is an entry on the first run;
  - `--dry` prints without writing; bad input is refused with what is on offer.
- A culture checklist test (`historic/cultures.test.js`): every layout is registered, every style card has
  its culture, every entry states its depth, every layout takes a card spread under a new id, and the
  scaffold is checked dry.
- The guide, `docs/historic/README.md`, covers the parts of a culture and their registries, the depths with
  the asset loop, new regions, the gates, and landing a culture on the trunk. A project skill,
  `/historic-culture`, runs it in order.

### Historic lineage

- **In progress.** Cultures draw on cultures. A culture card's `draws` names the earlier cultures it continues,
  inherits from, took forms from by contact, or varies, and what each relation carries (palette, skins,
  patterns, assets, layout, record).
- `historic/lineage.js` reads the tree off the cards. Its brief lists what a new culture can draw on at its
  year: patterns, skins and assets, and the record entries in use then. Drawn record entries stay the source's:
  each is a parallel to verify, never the new culture's own basis.
- What a record carries depends on the kind of relation. A tradition travels as its materials and methods
  (`inherits`, `contact`, `contemporary`); a culture's particular buildings and town form pass only on the same
  ground (`continues`) or to a version of the same town (`variant`).
- The relations now recorded: Thebes continues Giza; the polis is a variant of Lindos; Pompeii and the Forum
  inherit the Hellenistic orders from Lindos; the Forum is Pompeii's contemporary.
- Each entry gains a LINEAGE line, and a `historic-lineage` card in the encyclopedia holds the tree.
- `scripts/new-culture.mjs --draws <culture>:<kind>[:<parts>]` writes the relations on the new card, joins
  the patterns they carry, and writes the brief into its README. Dry runs for a Ptolemaic Thebes
  (continues Thebes, contact with Lindos) and a Byzantine Constantinople (inherits from the Forum and Lindos)
  each list what to start from.
- `historic/lineage.test.js` holds relations to history: every source registered, no culture its own ancestor,
  a source beginning before the culture drawing on it ends, a continuation beginning earlier, a variant on its
  source's layout. Every historic page is byte-identical.

### Historic Rome

- **In progress.** The first Roman culture: Pompeii on a summer morning of 79 CE, before the eruption. It is
  the best-attested Roman town, town-sized like Lindos and Xianyang, and it gives a fixed moment to read at.
  - The scene covers the western half: the forum, the old town, the theatres on the south bluff, the Stabian
    Baths, Via dell'Abbondanza to Via Stabiana, and the Porta Marina climb. That is about Qin's frame, so its
    page budget is known. The amphitheatre, about 1 km east, waits for a later phase.
- Its own record (`lib/graph/historic/record/pompeii.js`): the forum and its temples, halls and porticoes, the
  theatres, the baths, the houses, shops and bakeries, the walls and gates, the water, and the tombs outside
  Porta Ercolano. Each entry is cited and dated, with its confidence and the disputes between sources.
  Settled by the record:
  - Every building carries its state at 79 CE (standing, repaired, damaged, under repair, unfinished, relic).
    Seventeen years after the earthquake of 62 the town is mid-repair, and a scene draws it that way: the
    Capitolium awaits restoration, the Temple of Venus and the Central Baths are unfinished, and only the
    Temple of Isis was wholly rebuilt.
  - Marble is a veneer on a few buildings, much of it stripped or unfinished. The town is tufa, limestone,
    concrete and painted stucco.
  - Vesuvius is one broad mountain, flat-topped and in vines. The eruption and the modern cone are held from 80,
    so a 79 read excludes them; so are the excavated ruins, the 1943 bomb damage and the post-war rebuilds.
- A style card (`style/pompeii.js`) with six principles, each checked on the kit:
  - the podium temple rules the forum;
  - painted walls, never white;
  - low red roofs;
  - the street as a channel of lava between kerbs, with stepping stones;
  - the orders' proportions;
  - a Campanian sky.

  Its roof pitch, kerb and stepping-stone sizes are design numbers, since the sources read give none. Its
  palette is estimated until the reference swatches exist.
- A design brief for the reference drawings (`docs/historic/pompeii/README.md`), in the house style of Qin's,
  with the kit constants and the gaps the record leaves. The drawings themselves are not made yet.
- The town laid out before its pieces are designed (culture `pompeii`, layout `lava-spur`). Every building is a
  placeholder until it is designed, so the asset call lists all of them as still to design and gives the drawing
  brief real sizes.
  - The forum at the record's 143 × 38 m: the Capitolium on its podium at the north end between two arches,
    porticoes on three sides, and the halls round it where they stood.
  - Via dell'Abbondanza at its recorded widths, with the other named streets. Every street runs as lava paving
    sunk between kerbed pavements.
  - The Stabian Baths, the theatre quarter on the south bluff, and the Temple of Venus inside Porta Marina.
  - About 700 houses, those on the main streets with shops, and fountains at the main crossings.
  - The spur over the plain, with the Porta Marina ramp; Vesuvius and the Monti Lattari on the World page's
    horizon.
  - Each monument's slot carries its state from the record: the Capitolium stands roofless, and Venus, the
    Apollo repairs and the travertine colonnade have scaffolding.
- The placeholders are massing blocks in the card's numbers, plus pieces borrowed as they stand from Lindos
  (the courtyard house less its porch, the wall, towers, the theatre, statues). The World page is about 15 MB,
  Qin's size.
- New shared patterns: podium temple, forum, atrium house, taberna, arch, street fountain, kerbed street. The
  other cultures' pages are byte-identical.
- The town's art, sourced into the record first (Mau's *Pompeii, Its Life and Art*, the Naples museum, Pompeii in
  Pictures):
  - **Floors and pools.** About two houses in five have a black-and-white mosaic floor in the atrium (a new ground
    tile, `tessellatum`), and every atrium has its marble-rimmed impluvium.
  - **The House of the Faun.** About 3,000 m², with two atria, the bronze Dancing Faun (0.71 m) in the first one's
    pool, and the Alexander Mosaic (5.82 × 3.13 m) in its four colours on the exedra floor between the two gardens.
  - **Painted fronts.** House fronts in cream, yellow or red stucco, a red field on a black socle. Lots on the main
    streets now face them and open shops on them. Their walls carry the election notices: a new wall skin,
    `dipinti`, with red and black capitals on whitewashed panels at head height.
  - **The forum's statues.** A row of equestrian bases down the west side and four colossal bases across the south
    end. No forum statue survives and they were probably stored after 62, so most bases stand empty; the two
    statues drawn are conjecture.
  - **Burning altars.** Before the Temples of Apollo, Vespasian (newly placed) and Isis. Roman sacrifice was burnt,
    the opposite of Athena Lindia's fireless rite; with `fire: true` the World page burns them live.
- A second pass at Porta Marina and the roofs:
  - **The gate.** Its two passages are barrel-vaulted under round arches, ringed in paler stone, with a parapet on top.
    The climb to it is as wide as the gate: a cart ramp up to the wide passage and a stepped footway up to the narrow
    one, between cheek walls, and a paved space inside. The middle cheek wall fills the full width of the pier between
    the passages, and a stone footing carries the gate's front where it stands out past the spur's edge. A walker can
    go from the foot of the ramp through the gate into town without falling.
  - **The roofs.** The borrowed Lindos house roofs rise above the wall top to their outer edge, so they seemed to float.
    They are now closed onto the walls, and the halls' gable ends are closed flush in stucco.
- New shared patterns: mosaic floor, painted notice. The World page is about 19.7 MB. The other cultures' pages are
  still byte-identical.
- A close-scale study beside the town, in progress: the Forum Romanum on the same summer day of 79, about 240 × 160 m,
  where the detail goes into the buildings themselves.
  - **The orders as real parts** (`assets/orders.js`), measured in the column's lower diameter as the Romans wrote
    them. The Attic base has its plinth, tori and scotia; the shaft is fluted in 24 channels and tapers above its
    lower third. The Corinthian capital has two rows of acanthus with raised midribs and drooping tips, the
    caulicoli, corner volutes, inner helices, and the abacus with its flowers. Ionic and Tuscan capitals sit beside
    it. The entablature segment has three fasciae, the frieze, dentils, modillions, the corona and the sima.
  - Each part is built once, to stand many times as an instance on the World page, so the detail costs its faces
    once. A Corinthian column is about 1,200 panels.
  - **The record** (`record/forum.js`), read at Pompeii's moment with Pompeii's states, mostly from Platner & Ashby,
    Digital Augustan Rome and the Parco del Colosseo:
    - Each temple carries its podium and its order with column counts and sizes. The orders are dated methods, so a
      building can use only an order Rome already had.
    - In 79 the Temple of Vespasian does not exist yet, since Vespasian was deified only after his death that June.
      Its plot below the Tabularium stays open.
    - Vesta and the House of the Vestals stand rebuilt after the fire of 64, and the Capitoline temple after 69.
    - Anachronisms are held at their real dates: Saturn's late-antique Ionic porch, Diocletian's brick Curia and
      basilica piers, the Severan Vesta, the Equus Domitiani, the Umbilicus.
    - The disputes are recorded and the scene takes one side of each: Saturn Corinthian in 79, Concord's porch of
      six columns, Divus Julius Ionic.
  - **The style card** (`style/forum.js`), six principles, each measured on the built parts:
    - each order's height, base, capital and taper in lower diameters;
    - the entablature about a quarter of the column;
    - podia with a front stair, and close-set columns;
    - Luna marble brightest, then travertine, tufa, peperino and basalt;
    - the long open square;
    - the summer sky.
    The orders module reads its numbers from the card. The design brief, with nine drawing prompts, is in
    `docs/historic/forum/README.md`.
  - **The site** (`layouts/forum.js`, the `forum` culture): a measured plan, not a generated one. Every monument
    stands at the record's size and in its facing, all of them placeholders:
    - the Tabularium's arcade over its blank wall;
    - Concord's wide cella with its six-column pronaos;
    - Saturn on its 9 m podium;
    - the Rostra with two rows of bronze beaks;
    - the Arch of Tiberius and the Golden Milestone;
    - the Curia with its porch;
    - the Basilica Aemilia's two-storey arcade over the Tabernae Novae, and the Basilica Julia's, with their naves and
      clerestories;
    - Castor, octastyle peripteral with 8 × 11 columns on its 7 m podium, its tribunal part way up the stair;
    - Divus Julius on its beaked platform round the altar niche;
    - the three-bay Arch of Augustus;
    - the Regia, the round Temple of Vesta with its 20 columns, and the House of the Vestals;
    - in the square, the Lacus Curtius, and the fig and the olive with Marsyas.

    The plot where the Temple of Vespasian will stand is left open. On the World page the Capitoline rises behind the
    Tabularium with Vespasian's rebuilt Temple of Jupiter on it, and the Palatine to the south-east. Views: the square
    from Divus Julius, Castor's corner, the Sacra Via, the Rostra, and the Capitoline brow.
  - **Instancing.** The 315 columns, entablature runs and arcade bays are 55 templates (`assets/forum.js`), which the
    World page draws as instances (`repeats`). A part turned to another side is its own template, because templates
    are baked lit; columns never turn. The CSS page draws a light stand-in for each. The World page is about 7.4 MB.
  - New shared patterns: basilica, round temple, rostra. The other cultures' pages are byte-identical.
  - **Roofs, monuments and reliefs**, sourced into the record first (Pliny's *Natural History*, dedicated in 77, says
    what "still stands"; Velleius; Platner & Ashby):
    - **Tiled roofs.** Every slope is a bed of tegulae under rows of imbrices, each tile its own shade, with
      antefixes along the eaves, ridge tiles, and a soffit under the eaves so a roof seen from below closes.
      Jupiter's temple on the Capitol has gilt-bronze tiles, and Vesta's cone bronze ribs.
    - **By the Rostra:** Octavian's horseman on the platform; the three Sibyls and the Hercules in a tunic beside
      it; Duilius's rostral column and Octavian's gilded one with his statue.
    - **In the square:**
      - the Lacus Curtius, moved to its place near the west end, with the Curtius relief on its balustrade and a
        puteal;
      - the fig, the olive and the vine with Marsyas;
      - the praetor's timber tribunal;
      - Surdinus's inscription as written, `L·NAEVIVS·L·F·SVRDINVS·PR`, in bronze letters 30 cm high set into
        the travertine.
    - **Round the square:**
      - the shrine of Ianus Geminus at the Argiletum, its bronze doors shut, as Vespasian left them;
      - Venus Cloacina's railed round shrine and the Lapis Niger;
      - Hercules and Mercury at Concord's stair, and the Victory and statues on the Curia;
      - the kneeling captives in coloured marble and the portrait shields on the Basilica Aemilia's attic;
      - the bronze Vortumnus at the Vicus Tuscus, and Caesar's cuirassed statue;
      - the Dioscuri with their horses at the Juturna basin.
    - **Reliefs and lettering** (new wall skins drawn in `relief-art.js`):
      - an acanthus scroll on Divus Julius's frieze;
      - the Basilica Aemilia's Doric frieze of ox skulls and libation bowls;
      - the Fasti's lists in the Arch of Augustus's side bays;
      - one band of gilt-bronze capitals across the fronts of Saturn and Divus Julius. These are real Roman
        letterforms, but the record holds no text for those dedications, so the letters spell nothing.
    - **Festival dressing (opt-in, `festival: true`).** Livy has the aediles hang shields in the forum only on
      procession days, so the ordinary day shows none. The option hangs gilded shields on the basilicas' piers and
      garlands across the temple fronts. Awnings are Republican one-offs (Pliny) and are not drawn.
    - Fixed: a lifted building now lifts its beams too, so the roofs of temples set on platforms sit on them. The
      World page collects an instanced template's textures, so friezes and lettering show on it.
    - The World page is about 11.9 MB, or 12.3 MB with the festival.
  - **The Basilica Julia, opened.** In the forum, as at Rome generally, decorated floors were indoors: the square was
    travertine. The record gives the Julia a coloured-marble pavement in its central hall and white marble in its
    aisles, and about 80 game boards scratched into its steps and floor (Platner & Ashby). The basilica is now a hall to
    walk into:
    - steps up from the Sacra Via onto its podium;
    - the façade arcade on all four sides;
    - aisles all round, two deep along the long sides (the five aisles);
    - inner pier arcades on two storeys carrying the galleries;
    - the nave, 82 × 16 m, rising to clerestory windows under a trussed timber roof.

    Two new floor tiles in `ground.js`:
    - `opus-sectile`: panels of cut, veined marble framed in white, alternating a giallo field round a pavonazzetto
      lozenge and an africano roundel with a porta santa field round a cipollino ring;
    - `lusoria`: white marble slabs with merels boards, the eight-spoked wheel and twelve-line boards scratched in.

    A walker crosses from the nave through the arcades to the front aisle on the floor. The page is about 12.6 MB.
  - **The Temple of Castor, as Platner & Ashby describe it, and opened.**
    - **The stairs, corrected.** The platform's front is a sheer face, a speakers' platform with a balustrade, and is
      reached by "two narrow staircases, at the ends and not in front". The broad flight of eleven steps runs from the
      platform up to the porch.
    - **The podium's vaults:** chambers in its flanks behind bronze grilles, the banks and strongrooms of the fiscus and
      of private depositors.
    - **The cella:** at the record's 16 × 19.7 m, its bronze doors swung back. Inside are the Tiberian black-and-white
      mosaic floor (later replaced by coloured marble, date unknown: recorded as a dispute), smaller columns of giallo
      antico along the walls (Italian Wikipedia), and a coffered ceiling. The twins' cult statues stand on a base at
      the back; their form is unverified.
    - A walker goes from the porch through the doorway down the cella on its floor. The page is about 13.2 MB.

### Sixth-gen composer

- Planned: levels authored the way PS2, GameCube and Xbox levels were built. They use kit pieces on a
  grid, small painted tiles and trim sheets, two-tile vertex blends and hand-placed lights baked into
  vertex colour. The character stays slightly more detailed than the world through a measured fidelity
  ratio.
- Era card and reference moods (Devil May Cry 3, Pokémon Colosseum, Super Mario Sunshine, Metal Gear
  Solid 3) in `lib/graph/era/sixth-gen.js`.
- `measureFidelity` (`lib/graph/era/fidelity.js`): renders a z-buffer at the era's 640×448 frame from
  one camera. It reports triangles, vertices and texels per pixel for the cast and for the world, and
  the cast-to-world ratio. It is advisory only.
- New world kind `stage` (`lib/graph/era/stage.js`). It takes rooms on a grid joined by doorways and
  dresses them from a kit card. The first card, `gothic-stone`, adds plinths, cornices, pilasters,
  ceiling ribs, door frames and stone tiles. Torches are seated automatically or placed by hand. Each
  one is baked into the vertex colour of nearby corners, drawn as a sconce with a glowing flame, and
  exported as a point light in the GLB. The reference's fog becomes distance haze. The stage is walkable.
- A stage is built in three layers that never share a material: the floor, a band where floor meets wall,
  and the walls.
  - The floor is flagstone paving, a different shape from the coursed walls. It is laid one tile per
    structural bay, so its long joints line up with the pilasters, and each bay uses its own variant.
  - The band is a recessed gutter in front of the plinth, with basalt rubble from the rock pool fallen
    into it.
- New `flagstone` surface tiles (`flagstone`, `flagstone-warm`, `flagstone-slate`, four variants each).
  Square and oblong flags of mixed sizes sit on a grid, with wandering joints and worn, grimy edges.
  Some flags are cracked, and the odd one is lost to its gravel bed. Every tile edge is a joint, so
  each variant can have its own layout.
- The `gothic-nave` stage kit, with curved geometry in `lib/graph/era/gothic.js`. Pointed arches have
  real depth: a recess, reveals, a soffit and a moulded ring. Engaged columns are 10-sided. The ceiling is
  a tall pointed barrel vault with transverse ribs, a ridge rib and filled end walls. Each bay has a blind
  arcade arch, a string course, and a clerestory lancet whose glass glows and casts cool light. Torches
  stand on alternate columns.
- A stage room can leave sides `open`, a set seen from the open side for iterating on one view. The
  view is then framed from the open corner.
- First exterior stage kit: `delfino-plaza`, an open-air square (`lib/graph/era/plaza.js`).
  - Each side is a row of house fronts of different heights, giving a stepped skyline. Each house has its
    own stucco colour, a stone base band, an arched door, windows with surrounds and projecting sills,
    sometimes a balcony, and an eave over a pitched terracotta roof.
  - A raised pavement step runs along the house fronts, and the square is paved in warm flagstone bays.
- The `delfino-plaza` exterior is lit by a baked sun (`lib/graph/era/sun.js`). Each vertex is tested
  against the scene for a cast shadow, and faces that look down or sideways get a sky fill and warm
  ground bounce. It is drawn under the reference's painted sky dome.
- `trail-valley` stage kit: a nature level built to a style card. The card
  (`lib/graph/era/style/nature-trail.js`) states the art style as principles and also holds the numbers
  the builder reads. The builder (`lib/graph/era/nature.js`) makes:
  - faceted ground, with material chosen by slope;
  - a trail as a curved ribbon with grass edges;
  - a cliff of leaning rock bands with ledges, buttresses and gullies, with fallen rocks at its foot;
  - spruce trees planted in clusters;
  - red trail-marker posts;
  - ridges that fade into the fog.

  Moss, wet stains and wear are applied by cause. The scene is lit by the baked sun, and trees cast shadows.
  Each principle has an automated check, including the brightness order trail > rock > grass > foliage.
- The trail level is composed by where the eye lands. The style card names focus areas: a trailhead, and a
  boulder gate at a bend.
  - Inside a focus area, rocks are chipped (more detailed) and each one is different, grass tufts are
    fuller and denser, and two boulders frame the trail.
  - Outside, cheaper rocks and tufts repeat.
  - The trail's width and grass edges vary along its length, with pebbles along the edges.
  - Grass is instanced tufts (tussock, meadow, sedge), darkened where shade falls. Every boulder and tree
    sits on a soft contact shadow.
- The trail's cliff is now real geology on one heightfield with the valley, using mojulo's landform
  operators: a scarp, rock beds that form benches, jointed facets and a talus apron. Fallen rock lies where
  the scree came to rest.
- Debris on and beside the trail: roots surfacing from nearby trees, a fallen log with bark, sticks and
  cones, flat stones worn flush, and a puddle with wet soil around it.
- Walk mode on the trail no longer falls through the ground: the spawn is at eye height above the trail.
- The trail level's sky has weather: mojulo's cloud deck, lit by the level's sun.
- `composeCloudDeck` takes `depthClip`. With it, the deck reads the scene's depth and no longer paints over
  trees, cliffs or buildings that stand in front of it. `emitThreeWorld` gives any effect layer that asks
  for depth a shared depth pass before each render. Worlds that don't ask are unchanged.
- `jungle-trail` stage kit: a late sixth-gen jungle in the manner of Metal Gear Solid 3, built to the
  `jungle-mgs3` style card (`lib/graph/era/style/jungle-mgs3.js`) by `lib/graph/era/jungle.js`. It reuses the
  trail's ground, trail ribbon, rocks and debris, with a low mossy ravine wall and a mud trail. On it stand:
  - giant figs grown by mojulo's vegetation engine, kept for their wood (trunk, limbs, buttresses, barked near
    the trail). Their crowns are leaf cards placed at the grown tree's own leaf clusters;
  - tree ferns, fern and broadleaf understory, leaf litter on the floor, hanging vines and sagging lianas;
  - a canopy roof with holes, which opens over the trail;
  - layered walls of foliage beyond the visible area that fade into the fog.

  Detail is revealed by ring out from the trail: dense and distinct near, sparser and coarser further out,
  and only the fading walls beyond. Sunlight reaches the floor only through the canopy's holes, as dapples,
  with soft light shafts standing where it does. A filmic grade pulls every colour toward olive and sepia.
  Each principle has an automated check, including the brightness order dapples > trail > trunks > foliage
  > shade.
- The jungle trail blends into the floor. Trail, edge and floor share one mud tile mapped the same way, so
  there is no seam. The trail is told apart by brightness and wear instead: a packed, lighter centre that
  wanders out into the darker, patchier floor. Leaf litter piles along the edges, some lies on the trail,
  and twigs lie across it.
- Jungle shade is deeper, while sunlit dapples and shafts stay bright. Leaves carry their own shade: plants
  darken toward their base, crown clumps toward their undersides, and soft shadows lie under the plants
  near the trail.
- Each giant near the trail has its own bark (oak, chestnut or beech) and small ferns and broadleaf plants
  growing on its big limbs. Moss, pale lichen and dark wet streaks are applied by cause to the trunks and to
  the tree-fern trunks.
- The jungle's flora draws on mojulo's tropical plants, and twists:
  - Giants grow with stronger kinks and a stronger reach toward light, using the vegetation grower's own
    settings, so their limbs bend toward the canopy's gaps.
  - A banyan stands at the gate. Its pillar roots land on both sides of the trail, never on it, so the
    path runs between them. Each pillar wanders, flares at its foot and is braided with a thinner strand.
    Its hanging roots are curtains of a new root card.
  - Lianas wind up the trunks.
  - Clumps of mojulo's clumping bamboo stand on the wet ground at the foot of the ravine wall, with their
    foliage drawn as a new bamboo card. Culms on the wall side stand upright instead of leaning into the rock.
- The jungle takes five more principles from Snake Eater's own frames, each with a check:
  - The floor is two materials blended. A painted moss tile (`floor:moss`, `lib/graph/era/floor-tiles.js`)
    fades in over the soil at each corner. It is worn off the trail, thick in patches and in shade, and climbs
    the massive trunks.
  - The floor undulates. The style card's optional `lumps` adds mounds, hollows and banks either side of the
    trail, which sits sunk between them. Styles without it are unchanged.
  - Occasional massive trunks: low-poly boles 2.7–3.4 m across, lumpy and flared. They carry oak bark at a
    larger crack scale, buttress roots on the side away from the trail, and moss.
  - Tall grass is cards of broad blades (`card:grass`), placed where sunlight reaches the floor. It is lit
    and shaded with the rest of the scene, and walked through.
- The `trail-valley` kit takes three principles back from the jungle, each with a check:
  - One ground, two tiles. The trail ribbon and the meadow within 9 m of it share one soil, mapped the floor's
    way, so the ribbon's edge has no seam. The grass returns over it as a blend: worn off the trail, wandering
    at its edge, thinned under the spruce and in bare patches, and whole where the meadow tile takes over.
  - Foliage is painted cards. Spruces are grown (`vegetation/conifer.js`): the trunk is barked near the trail,
    and the crown is bough cards (`card:bough`) placed at the grown limbs. Cards are finer near the trail and
    coarser further off, and dark toward the trunk. Grass tufts are cards (`card:meadow`, `card:grass`) instead
    of instanced tufts, so they take the scene's light and shade. The sun falls through the cards' gaps.
  - The ground is never flat: mounds and hollows at three scales, and a bank either side of the trail. Roots
    surface in pieces instead of running as rails, and the trail's stones are its own rock.
- The `gothic-nave` kit is dressed to a style card (`lib/graph/era/style/gothic-nave.js`, dressing in
  `lib/graph/era/nave.js`), with a check for each principle:
  - Light leads, measured: glass > torchlit stone > the shafts' pools > the open floor > the vault. The vault's
    stone is darker than the shell's ceiling.
  - Each clerestory lancet facing the light throws a shaft across the nave as soft translucent sheets. Where it
    lands, a pool of light is baked into the floor. Pools are not exported as lights and leave no soot.
  - Two-tile blends by cause: moss (`floor:moss`) rises up the wall bases and fills the gutter. Grime
    (`floor:grime`, new; `lib/graph/era/floor-tiles.js` now holds the stage's painted tiles) gathers at the floor's edges and is worn off the walking line.
  - Painted cutouts, each placed for a reason: ivy spills from the string course, cobwebs sit in the angle
    between column and wall at the plinth and at the arcade's springing, and banners hang in alternate bays
    from iron rods. No two neighbouring bays are both bare.
  - A scale break at the focus: the end wall holds a great door (`portal` in `lib/graph/era/gothic.js`) in
    three stepped orders under a hood moulding, with an oak leaf banded in iron. It rises half again the
    arcade's height, with an oculus (`oculus`) above it and a torch on each flank.
  - The ceiling is its own material: the vault's web is plaster painted night-blue with gilt stars
    (`vault:stars`), flaked where damp has lifted it, between the stone ribs.
  - The floor is not the walls' grid: a runner of hexagonal tiles (`floor:hex`) down the walking line between
    slate kerbs, and irregular flags with no two alike (`floor:incertum`, opus incertum) either side.
  `gothic-stone` and `delfino-plaza` are unchanged.
- The `delfino-plaza` kit is dressed to a style card (`lib/graph/era/style/delfino-plaza.js`, dressing in
  `lib/graph/era/plaza-dress.js`), with a check for each principle:
  - Hard sun, measured: sunlit stucco > sunlit paving > the shade (a pale blue, never black) > terracotta.
  - A fountain at the square's centre: a lathed marble basin, pedestal, bowl and finial, water standing in
    basin and bowl and falling from the bowl's lip in streams, ringed by sandstone paving.
  - The floor is fan-pattern setts (`floor:fan`, new): overlapping arcs, no two setts alike.
  - Blends by cause: sand blown against the house fronts and drifted deepest into the corner, worn off at
    the doors and along the way in; the ring round the basin dark where it splashes.
  - Painted cutouts on the fronts: flower boxes under windows, striped awnings over doors whose shade is
    striped (the sun reads the card), and laundry strung across the corner.
  - The town goes on: rows of rooftop cards beyond the closed sides, each row carried toward the reference's
    horizon colour by its distance (aerial perspective after the light, not baked).
  - No two neighbouring houses dress alike.
  - A Renaissance order (`lib/graph/era/piazza.js`): a portico of grey-stone columns and round arches along
    the sunlit side, with blue-and-white roundels in the spandrels. Its roof is a walkway of hexagonal cotto.
    The shade under it is warm, lit from below by the square (measured: warmer than a wall turned from the
    sun, darker than the paving). Houses behind it carry no balconies, and their doors no awnings.
  - Walkways railed in stone: lathed balusters between a plinth and a rail, pedestals on the column lines
    carrying urns, and a stair of even treads climbing the portico's front to a landing, with a raking rail.
  - Two red granite obelisks on stepped pedestals, either side of the fountain across the line from the way
    in, standing over every eave, with bronze balls under the shaft and a cross on the point.
  - Long-and-short quoins up every house edge.
  - The sky is a place: a cloud deck (`effects`, the `undershot` deck the trail uses) over the square, and
    the town's ribbed dome and banded bell tower over the roofs, faded toward the horizon like the rooftop
    rows. A stage carries `effects` only when its dressing names clouds.
  `plazaWall` takes an optional `record` that receives each house's door and windows. The nave's dressing and
  the plaza's share one shape the stage composes. `lathe` moves to `lib/graph/era/geom.js`. `gothic-stone`
  and `gothic-nave` are unchanged.
- `card` and `crossed` (one painted card, and cards crossed about a vertical axis) move to
  `lib/graph/era/geom.js`, and `dice` is exported from `lib/graph/era/nature.js`, shared by the trail and the
  jungle. The jungle's output is unchanged.
- `emitThreeWorld` draws faces marked `blend: true` in their own translucent pass: a second texture faded in
  per corner by `cornerAlpha`, multiplied by the baked colour, drawn over the surface beneath it without
  flickering. This is the era's two-tile vertex blend. Worlds without blend faces are unchanged.
- Leaf cards (`lib/graph/era/leaf-cards.js`): painted RGBA leaf textures (`card:broadleaf`, `card:fern`,
  `card:spray`, `card:vine`, `card:litter`, `card:roots`, `card:bamboo`, `card:grass`, `card:bough`,
  `card:meadow`, `card:ivy`, `card:cobweb`, `card:banner`, `card:flowers`, `card:laundry`, `card:awning`,
  `card:roofs`), resolved through the surface-texture registry. New
  `encodePngRgba` in `lib/graph/landscape/surface-textures.js`.
- `emitThreeWorld` takes `cutouts`, a list of texture keys whose alpha is cut out (alpha-tested). Those
  surfaces drop their clear texels, including from the depth pass, and are not walk colliders, so foliage
  is walked through. Worlds that don't pass it are unchanged.
- `makeSunShadow` takes `maskOf`, so a cutout card blocks the sun only where its texture is opaque.
- Dirt is baked into the vertex colour by cause (`lib/graph/era/dirt.js`):
  - soot above torches;
  - streaks under the cornice;
  - damp wall bases;
  - a worn walking path and grimy floor edges.

  The recipe's `dirt` scales each cause. Baked ambient occlusion is on for the `stage` kind.

### Stage isekai

- A new stage kit, `isekai-meadow`, for the open-field anime look of current-era games. Its reference cards are
  Genshin Impact and Breath of the Wild (`lib/graph/era/current-gen.js`). It is built only from sixth-gen parts:
  - painted 256-px tiles;
  - baked vertex light;
  - cutout cards.
- A PALETTE LOCK (`lib/graph/era/palette.js`): the style card names ramps of colour stops. Every baked colour on a
  locked group is projected onto its ramp, so shading moves a colour along its ramp and never off it.
- PIXEL-LOCKED rocks and cliffs:
  - The tiles (`lib/graph/era/isekai-tiles.js`, the `isekai:` resolver) are painted only in their ramp's stops.
  - They are drawn unlit, and the light lives in the choice of tile: each facet takes a lit or a shade tile by the
    sun and its cast shadow. That gives two-tone cel bands with no new renderer.
  - The cliffs are the landform's own geology drawn with strata tiles.
  - The rocks are new chunky boulders, lofted from an irregular footprint to a flat top.
- HATS: a boulder's top wears a grass cap with a ragged fringe hanging round its rim, and every cliff lip gets the
  same fringe hanging over the face.
- Trees are crowns of overlapping round masses on a short trunk, with one hero tree where the eye lands. Grass is
  crossed blade cards, pixel-locked, and within reach of the trail it stands as one continuous field of blades.
- DEPTH BY PAINTED LAYERS:
  - Far ranges stand as rings round the site, each its own colour from the far ramp, with a peaked skyline.
  - The nearest layer is a skirt of land from the site's own edge up to its skyline, banded from grass to the
    hills' colour.
  - The haze is thin, so each layer keeps its colour.
- THE PAINTED SKY: heaped cumulus cards stand behind the ranges, pixel-locked to a cloud ramp and lit in crescents.
  The sun sits on the dome where the bake's sun is.
- Other stage kits are byte-identical.

### Stage isekai groves

- Two smaller isekai levels in the same art style. Every isekai level is a style card, and the builder reads it:
  - **`isekai-bamboo`:** clumps of bamboo culms. Each culm is a pole pixel-locked in a striped `culm` tile with pale
    node rings, two-toned by the sun. Cutout leaf sprays fan from the upper culm, and the sun bake reads their alpha,
    so the floor is dappled.
  - **`isekai-sakura`:** sakura trees. Dark leaning trunks fork into limbs under crowns of round masses locked to a
    pink blossom ramp, with petal litter on the ground beneath.
- New pixel-locked tiles: `culm`, `spray` and `petals`. The meadow is unchanged.
- With `wind`:
  - both groves take the live grass;
  - crowns, culms and sprays sway;
  - the sakura's petals fall, carried by the same gust field.

### Stage isekai sakura pass

- The sakura grove's trees are grown, not heaped: a branching skeleton (trunk, limbs, branches, twigs) with blossom
  clumps at its tips.
  - **Hero trees:** two framed sakura at full depth, with a `hero` camera under one crown's edge.
  - **The rest:** the same tree at a lower depth, so the limbs show in the gaps of the crown.
  - New pixel-locked tiles: `bark` (the sakura's horizontal lenticel bands), `bloom` (packed five-petal flowers on
    each clump) and `sprig` (cutout flower clusters that break each clump's silhouette).
- The petal litter is repainted as notched sakura petals in drifts.
- With `wind`:
  - live 3-D petals lie round the walker, pixel-locked like the grass and stirred by gusts. They gather in piles (drifts,
    the path's edges, the feet of the trunks) and stay thin on open grass, so the grass stays the main read;
  - falling petals take the same notched, cupped shape and tumble.
- The meadow and the bamboo grove are unchanged.

### Stage trail blend

- A trail no longer sits on the ground as a separate ribbon. The outdoor trail primitive has a blended rim along both
  edges: a narrow band out from the edge and its mirror in. In the band, the trail's soil and the outer ground meet
  along one ragged boundary that wanders both ways about the edge, so soil bleeds into the grass in some places and
  grass creeps over the trail in others.
- The isekai levels draw the rim in two new pixel-locked cutout tiles, `rim` and `creep`, painted from one shared noise
  field so the two sides meet. The boundary frays in a stipple of palette colours, so the colour lock holds. Each strip
  takes the palette stop nearest the baked colour of the lane it continues, so the blend matches the light on both
  sides. The meadow, bamboo and sakura trails all take it.
- The jungle takes it too, through the same primitive's shared edge (`trailEdgeCover`): one wandering boundary between
  the trail and the floor. The moss now gives out along that line, and the trail's packed-soil wear follows it too,
  so moss and mud meet along one edge instead of fading on two separate noises.
- The nature trail, which has its own grass blend, is unchanged.

### Stage live grass

- `wind` on an isekai recipe turns on a LIVE FIELD of grass on the World page (`lib/graph/scene/channels/stage-grass.js`).
  - Grown stylized blades stand within 30 m of the walker, placed in the page from grids the stage ships: heights, a
    grass mask that keeps them off the trail, rocks, trunks and the cliff, and the sun's shade.
  - They thin with distance and bend in the terrain's gust field.
- The palette lock holds through the motion. Each blade's colour is looked up from a nearest-filtered ramp texture of
  the grass stops by its height and its lit or shade window, so only palette stops reach the screen.
- A gust above the mean steps the upper blade up the ramp: the gust is seen as a bright band rolling across the field.
- Blades near the walker bend away from it.
- The static blade cards stay as the floor and as the band beyond 30 m. Inside the field's reach they dissolve, dithered
  across its edge.
- The tree crowns sway in the same gust field, weighted by height above the ground.
- Absent `wind`, the payload is byte-identical.

### Stage doors

- A stage recipe can name DOOR ENDS (`doors: [{ id, at, to: { map, door } }]`), resolved by
  `lib/graph/era/doors.js` from what the kit already knows (a plaza house door, the nave's great portal, a point
  on a wall). Each end carries a trigger in front of it and a spawn further in, facing into the room. The payload
  carries `doors` only when the recipe names them.
- The World page's doors channel (`lib/graph/scene/channels/doors.js`): walking into a trigger asks the parent
  page to cross (`map-door`); the parent places the walker at an end (`map-enter`). Absent doors, the page is
  byte-identical.
- A wall-point end on a closed wall gets a door: an oak leaf in a stone frame, in the middle of its bay, standing
  proud of the wall's plinth.
- ITEMS (`items: [{ id, at: [x, y] }]`): a thing on a plinth (a gold key, turning) in its own group. Walking up to
  it takes it; the page hides it and reports the taking.
- A LOCKED end (`locked: '<item id>'`) refuses the crossing until the run holds that item; the page says what the
  door needs.
- An ATLAS (`lib/graph/era/atlas.js`) joins maps by their door ends. `validateAtlas` checks that:
  - every end names an end that names it back;
  - every lock's item is held by some map;
  - no item is placed twice.

  `emitAtlasShell` hosts one map at a time, crosses on `map-door`, and carries the run's state across: the
  crossing log, the refusals, visits per map, the items held, and each map's own state. A key taken stays taken
  when you come back.
- Played maps are closed rooms. The plaza dressing no longer assumes the open-sided set:
  - the portico stands clear of a closed side it meets;
  - the obelisks take the way in from the square's first door, and their symmetric spread shrinks until both
    pedestals clear the walls and the portico.

  The open set is byte-identical.

### Stage decay

- `decay` on a stage whose style card carries one (the lab's): a number 0–1 for every event at that strength, or
  `{ collapse, leak, breach, blackout, abandon, seed }`, each 0–1. Every event is a cause, and the mess it leaves has
  a place it came from (era/decay.js picks where, from the rooms and the bays alone):
  - **collapse**: a bay of the roof came down. The deck is open over it, with torn sheets hanging from the edges.
    The duct broke at the bay's trusses (one length down to the floor, a stub drooping), one troffer hangs from a
    single chain and another lies in the debris heaped under the hole.
  - **leak**: a pipe burst at the service band. Streaks and rust run down the wall under it, there's a puddle at its
    foot and, with `water`, a thin stream.
  - **breach**: the tank broke. Its glass is a jagged ring, the liquid is drained to a skim, the glow is out and a
    hoop lies on the dais. The spill spreads toward the side it split, with shards strewn the same way.
  - **blackout**: most troffers are dead, the clerestory is dark and the screens are black but for a few on their
    batteries. Red emergency lamps on the columns are baked red, the ambient is down and the air thicker.
  - **abandon**: chairs tipped and shoved, monitors face down on the floor, the cart rolled and over, the
    extinguisher down and glassware broken. Papers are strewn, more of them against the walls. There's dust on
    everything that faces up, and the walked path has faded.
- The things are records, so abandonment changes them before they are built (`tip` lets a thing down onto the
  floor). The dressing hands the stage its extra lights, its dirt (`leaks`, `dust`) and its water. Spills and
  puddles take the water look with `water`.
- Dying lamps flicker on the page (scene/channels/stage-flicker.js): some troffers that survive the blackout stutter
  (baked on, they go off in bursts, taking their pool and their tube with them), and a troffer hanging by one chain
  sparks (baked off, it flashes now and then). The page scales each lit mesh's baked vertex colour by the lamp's change
  near it, so exports keep the floor (the bake). Absent `flicker` ⇒ the channel isn't emitted.
- The tank now has a frame of four struts, so its cap stands on something.
- The style card's decay principles are machine checks (lab-decay.test.js). The derelict lab is in the page budget.
  No decay (absent, 0, or every event at 0) is the clean lab, byte for byte. Other stages are byte-identical.

### Stage lab

- A fourth stage kit and the first modern one: `research-lab`, after a new reference card `doom3` (Doom 3's UAC
  labs). It's a tall closed lab whose structure shows (era/lab.js):
  - a vinyl tile floor with a darker band and a rubber skirting;
  - walls of steel I-columns at the bays, a kick band, painted panels, a service shelf and a clerestory of
    observation windows glowing cool;
  - a corrugated deck high up with trusses across the short span, two ducts and a cable tray down the long one, and
    troffers hung on chains between the trusses (the light);
  - a blast door with chamfered top corners, a hazard-striped surround and a red status lamp.
- Its painted surfaces are the stage's own `lab:` tiles (era/lab-tiles.js): vinyl tile, steel panel, corrugated deck,
  grating, hazard stripes, a screen, a server rack's face, a whiteboard.
- The dressing (era/lab-dress.js, style/research-lab.js):
  - a containment tank at the centre on a hazard-ringed dais, glowing, with cables down its steps into grated
    trenches that run to three walls (never across the way in);
  - benches in two rows, each carrying different things from its neighbours (monitors with lit screens, a
    microscope, glassware, papers, a toolbox), with chairs pulled out;
  - server racks, lockers, a whiteboard, an extinguisher and a cart.
  - Every thing is placed as a record first and built in its own frame after, so a later pass can move, tip or
    break it.
- The style card's principles are machine checks (era/lab.test.js), and the lab is in the page budget. Other stages
  are byte-identical.

### Stage night

- `time: 'night'` on a stage whose style card carries a night (the plaza's does): the card's moon becomes the bake's
  key (cool and low, casting the obelisks' long shadows) under a deep blue ambient, and the reference's air and dome
  give way to the night's. The sky shows stars and a phase-carved moon placed on the dome where the moonlight comes
  from, and the cloud deck is lit by the moon. The town beyond is dimmed.
- The placed light makes the picture (era/plaza-night.js): lanterns on iron brackets by most doors, lanterns hung in
  the portico's bays, a glow under the fountain's water, and some windows lit warm with their light spilled on the
  sill. All of it is baked like the nave's torches; the lanterns' panes glow and carry a halo.
- The style card's night has its own principles, each a machine check (plaza-night.test.js). `time: 'day'`, or no
  `time`, is the plaza as before, byte for byte; a kit without a night refuses one.
- Jets take an opt-in `lit` colour for the light their white water is seen in (`jetLight` on the page). The night
  fountain uses it so its falling sheets aren't daylight-white. Jets without it emit as before.

### Stage page budget

- A stage's World page now costs about 5 MB to open with every element on (the plaza was 8.7 MB), under a budget
  (`STAGE_PAGE_BUDGET`, 7 MB) a test holds each stage to.
- `pack` on `emitThreeWorld` (opt-in; a stage's payload sets it): each textured sub-mesh is welded, so corners equal
  in position, uv and colour are shared through an index, and its baked colour goes as 8-bit sRGB decoded back to
  linear in the page. Renders differ by at most 2 levels in 255. Without `pack` every page is byte-identical.

### Stage elements

- Sixth-gen is a floor, not a ceiling: a stage takes the merged fire and water elements as opt-ins, and without them
  it is byte-identical (the baked torches, the painted spill).
- `fire` on a stage (`true` or the fire object): its torches go to the fire channel as fires its bake already holds,
  so the page only flickers their light. The stage keeps an iron arm and a collar on the wall and leaves the staff
  and the flame to the channel. The nave's style card sizes its torches up (`fire.torch`) and stands two braziers by
  the great portal, their light baked into the room like the torches'.
- `water` on a stage: the plaza fountain's basin and bowl take the water look (a tinted `lagoon`, its shore foam
  turned down for a basin a hand deep). The bowl brims over its lip in falling sheets (`jets`) in place of the
  painted strips.
- Jets whose `controls` are all false carry no flow panel; pages with any other jets are byte-identical.
- `wind` on a stage (`true` or the terrain's wind object): the dressing's hung cloth swings in the terrain's gust
  field (the same GLSL, now shared as `WIND_AT_GLSL`; the terrain page is byte-identical). Each style card names the
  groups that take the wind (`sway`): the plaza's washing billows on its lines, an awning's valance flaps and the
  flowers nod; in the nave the wind is the draught through the doors (`draught`), and the banners and ivy stir. Those
  cards are cut into a small grid so they bend down their length; the bake and the sun's shadow stay at rest.

### Flame depiction

- Fire in worlds (`fire`, opt-in on any world): campfires, braziers, torches and candles drawn as live flames that puff at their own rate, lean in the wind and throw embers and smoke, and whose flicker lights the world around them. `fire: true` on a dungeon lights its chambers with braziers and its tunnels with torches; `fire: { sources }` places fires anywhere, on the ground in terrain worlds. Absent ⇒ byte-identical.
- Coloured fire (`fire.color`, or per source): as fireworks are coloured, by a metal salt in the flame (sodium, calcium, strontium, lithium, barium, boron, copper, potassium, or a mix), or any `'#rrggbb'` for a fire no salt gives. A coloured flame burns clean and lights the world in its hue; a dungeon bakes the hue into its walls. `smokeColor` gives a source a signal smoke.
- Fire that burns up and down (`life`: kindling, dying back; `flares`: a whoosh now and then; the wind feeding a fire it does not blow out), fireballs (`kind: 'fireball'` on a `path`: the tail is where the ball was a moment ago, and it bursts where it lands, swelling and throwing a shell of sparks), and grass fires on terrain (`fire.spread`: the front runs downwind as an ellipse after Rothermel and Anderson, with flames sized by Byram's law, black ground and a band of embers behind it, stopping at water and burning out at `extent`).
- Fire in a Blender Cycles still: a world with `fire` exported through the Blender pack (`export_model({ format: 'blender', fire_t })`, which writes the same pack as `scripts/export-blender.mjs --fire-t <seconds>` and hands back the render command) carries its fire at that instant as the World page draws it. Each flame becomes a volume of light (the page's flame shader evaluated per voxel, written to OpenVDB inside Blender), each fire's smoke a density volume, and the embers, coals and props come as mojulo geometry; each fire gets a light, and a `Fire` camera frames the brightest. `import_mojulo.py --mode render` renders a still at any resolution. All of it stays in a `mojulo-fire` collection that the machine gate and the return leave out. The props are now one description (`firePropParts`) shared by the page and the pack.
- A lit match (spike, `scripts/spikes/flame/`): fire drawn as a consumer of the wind's air field. The flame is a streakline, the burning gas rising on its own buoyancy while the room's air (`windField`, plus a breath) carries it sideways, so it leans downwind, flickers when a draught passes and blows out past a speed that grows with its size. φ = 0 stands it straight up in any wind. The match strikes (a flare and sparks), burns its head, then creeps along the stick at a rate set by its angle (head down races, head up starves); the stick chars, curls and glows at the front; blown out, the ember lets go a wisp that rises as a thread and snakes as it goes unstable. The page marches the flame as emission against the scene's depth, lights the scene from it in a match's balance of brightness, and shimmers the air above it.

### Wind element

- Terrain `wind` (opt-in, flat worlds with `grass` or `plants`): one seeded gust field that the live World page's grass and trees bend in. Gusts travel downwind and reshape as they go; a tuft or a tree sways as one stem of its height, lagging the gusts and ringing at its own frequency, its shape the production elastica under the wind's load (baked once, read as a 3D texture by a vertex shader). New principle, **flaccidity**: the share of the wind's push a thing takes, 0 for everything that existed before (unchanged, byte-identical pages without `wind`), 1 for grass and plants unless `flaccidity: { grass, plants }` says less. `compose_world` carries `wind` to the stored recipe. Exports carry none.
- Wind debris: fallen leaves and dust around the camera ride the same gust field (one self-contained field function shared by the shader's texture and the particles), lying still until a gust passes their lift, then tumbling downwind and settling. On by default with `wind`; `debris: false` for none, `flaccidity.debris` to dial it.
- Cherry grove (spike, `scripts/spikes/sakura/`): a `cherry` species in full bloom (Rauh made decurrent through a new species `over`; `bloom` recolours its leaves as blossom and `bloom.fill` fills its clusters), `plants.kinds` to grow named trees in place of the climate's, and petals as a new kind of wind debris, given off by crowns in bloom in gusts, fluttering down, carpeting the ground and lifting again. Other species and worlds without a cherry are byte-identical.
- Hero cherry grove (spike, `scripts/spikes/sakura/hero-grove.mjs`): a standalone close-up scene built from the ground up. The cherries are grown with the species' hand and smooth axes (below). Blossom sits in umbels at the ends of the shoots, and each flower is built from its parts with fractal-edged petals. Levels go by distance: whole flowers near the eye, one lit disc per flower beyond, then the pool's levels. One wind drives tree sway, flower flutter, the lawn and the petals, and the frame goes through an HDR lighting pass. The page has a season dial (bud, bloom, petal fall, leaf-out), a petal carpet that builds where petals land, three lighting moods, and compact encodings (8.5 MB).
- Trees with a hand (`arch.hand`, opt-in): new internodes are turned as they grow (a consistent twist, a winding lean, zig-zag laterals). Smooth axes (`arch.smooth`, opt-in) bend between nodes instead of kinking. The cherry has both; other species grow and mesh byte-identically.
- `vegetation/blossom.js`: where a grown tree carries its flowers (umbels at the shoot tips) and one flower built from its parts at its levels of detail.
- Terrain worlds draw a tree in bloom flower by flower: at L1 and L2, its bare wood plus one disc per flower (lit in the world's light, bent by the wind, at most about ten pixels), up to 1.2M flowers, largest trees on screen first; past that a tree keeps its clusters. Worlds without a species in bloom are byte-identical.
- Trees of many ages (`growth` on a species): one variant is grown at each age, some in a stand, so height, girth and clear trunk come from growth rather than scale. Each plant picks its age by its height in the species' range. The cherry has five ages, from 8 to 21 years. Other species are unchanged.
- Research spike behind it (`scripts/spikes/wind/`): one seeded wind field (gusts carried downwind, log profile, veer) that bends plants and carries debris. Introduces flaccidity φ ∈ [0, 1], the share of the air's push an element takes; everything before is φ = 0 and stays byte-identical. Plant poses reuse the production elastica through a baked table; debris (dust, leaves, twigs) lifts and settles by kind. Standalone interactive preview, no schema, exporter or runtime integration.

### Aqua rendering

- **Water has a look of its own.** A water preset (`ocean`, `lagoon`, `lake`, `river`, `canal`, `pool`,
  `falls`) shades it on the World page with light-weight maths instead of a flat tint: fine ripples
  layered over the waves, the sky reflected more strongly the lower you look (water is a mirror at a
  grazing angle and nearly clear head-on), and a sharp sun glint that softens with distance so far
  water does not shimmer.
- **Foam forms where waves fold.** The animated oceans, beaches, rivers and spillways now place
  whitecaps where the wave surface folds over itself, and draw foam as a lacy pattern of bubbles
  rather than a white tint. Shore breakers, river banks and the foot of a falling sheet froth the same
  way.
- **Rivers flow along their banks.** A river's surface runs in lanes parallel to its banks that turn
  with every bend; ripples stream downstream along them and foam gathers in lines that drift with the
  current.
- **You can see into the water.** Water now fades with depth the way real water does: sand and riverbeds
  show through the shallows in the water's own clear tint (turquoise for a lagoon, olive for a river), and
  deep water turns opaque. Where water is thin, against a beach, a bank or a floating buoy, it froths
  in bands that lap toward the edge. The beach view gains a seabed that falls away offshore so its water
  shades from shallows to deeps. Open sea with nothing beneath it looks as before.
- **Water leaves with the scene.** Exported GLBs carry each body of water as its own `water:<kind>` node
  with a clear-water material (transmission, index of refraction 1.333, and absorption that keeps
  blue and loses red), which Blender reads. Animated seas, beaches and rivers, which no export carried
  before, leave as one frozen frame with their foam baked in; the ocean view now exports at all. Godot
  packs (kernel 0.4.0) shade that water live with a water shader: the seabed seen through the water,
  bent by the ripples and fading red-first with depth, foam where the water thins, sky reflection and
  sun glint, and drifting ripples. The waves themselves stand still in an export.
- **Pools and ponds you can touch (groundwork).** A page can now carry shallow bodies of water whose
  surface is simulated rather than drawn: still until something disturbs it, with waves that slow in
  the shallows, bounce off a pool's walls and die out on a pond's bank. Walking in slows you with depth,
  splashes on entry and leaves a frothing wake; floating toys and leaves bob on the live surface and get
  pushed aside; rain rings it; a click splashes it. Everything that touches the water goes through one
  interface, `window.__aqWater` (`query`, `disturb`). The floor is seen through the water, bent by the
  ripples, with caustics where crests focus the sun. No world kind emits them yet.
- **Wet sand follows the swash.** On an aqua beach the swash now runs a thin sheet of water up the
  sand, with a lace of foam on its leading edge, then drains: the sheet shines with the sky and the
  sun for a second or two, and the sand it leaves stays dark while it dries, with a damp band above
  the highest reach. It is worked out from the swash's own timing, so it costs only a shader and an
  export carries the band as it stands at the first frame. Beaches take `detail`
  (`'still' | 'animated' | 'touch' | 'showpiece'`, default `'animated'`); `'still'` keeps the baked band.
- **Footprints in the sand (`detail: 'touch'`).** A beach at the touch tier opens in walk mode facing
  the sea, and the sand around you takes footprints: a bed of loose sand (3 cm cells) follows you as
  you walk and blends into the beach with no visible edge. Damp sand holds a print's walls, dry sand
  up the beach slumps them into soft dimples, and the backwash levels any print it runs over. The
  ground kernel graduated from the soft-ground spike with per-cell moisture, a window that slides
  with the walker, and slopes measured on the sand alone so loose sand never slides off the beach
  face; with neither in use it replays the spike byte for byte. The beach declares its unit
  (1 unit = 1 m at scale 1).
- **Wading into the surf.** At the touch tier the sea around you answers too: walking in slows you
  with depth, splashes on entry, and leaves a wake and a cloud of stirred-up sand in the water. The
  disturbance is simulated in a small window that follows you and rides on top of the existing
  waves (it reaches the water shader as a texture, so it adds no geometry and no seams). One step
  routes by depth: on dry or shallow ground it prints the sand, in the surf it prints the sand and
  stirs the water, and past waist depth only the water answers.
- **The swash strands its foam.** On every animated beach the foam the uprush carries is left on the
  sand where the sheet stops: it slides back with the backwash while the water still covers it, stays
  put once the water leaves, and opens into holes and pops over a few seconds. The backwash's edge
  carries no foam line of its own.
- **A faucet and the basin it fills (study).** A falling stream (`jets` on the World page) is drawn on
  the GPU along its fall: it thins as it speeds up, carries a ripple from the spout that grows until a
  thin stream breaks into a string of beads, and below a threshold set by the spout's width it drips
  instead. An aerator turns it white. Where it lands on a dry or barely wet floor it spreads into a
  hydraulic jump; in standing water it plunges, with a crater, rings and foam that push floating
  things away. Its basin is a new `basin` kind of shallow water whose level moves: it fills with the
  plug in, drains through the plug hole with it out, and stops at the overflow, and a duck in it rides
  up and settles on the floor when it empties. The page has a panel for flow, plug and aerator.
- **Waterfalls (`create_view` kind `waterfall`).** The same falling water, at landscape scale: a river
  runs along a plateau, pours off the cliff, falls, and plunges into a pool that drains away as a
  second river. Three kinds: `veil` (a tall thin ribbon that frays to streaks), `curtain` (a broad,
  heavy block of water) and `horsetail` (a round spout shot through a slot in the rock). Over the lip
  the water is glassy and pours at the depth a river takes going over an edge; it whitens as it falls
  and, past a break-up length set by how much water there is, frays into streaks and fingers and
  spreads, with mist at its foot. The pool's surface is simulated, so the fall churns it into foam and
  rings and pushes floating leaves away. A flow slider on the page turns the fall down to a trickle or
  up to five times its size. Falling water can now be a sheet over a lip as well as a round stream,
  so any world can place one.
- **Recipes choose the water.** The ocean, beach and river views and painted-landscape lakes take
  `aqua: '<kind>'` to pick another preset, or `aqua: false` to keep the previous look; canal cities
  use `canal`.
- **Glass is untouched.** Windows share the old translucent-water pass; only faces tagged `liquid`
  take the new look, and pages without water emit the same bytes as before.

### Particle vacuum spike

- Isolated development experiment: frozen wave-manji carriers activated by spatial contact events, with deterministic replay and a standalone interactive preview. No level schema or runtime integration.
- Wave-ground follow-up: conservative sand depth over sampled wave-field terrain, with 3D surface preview and slope-driven redistribution.
- Lightweight sand follow-up: bounded occupancy grid, sleeping grains, local support-change wakeups, hopper gate and editable terrain preview.
- Grain physics follow-up: integer gravity with terminal speed, work–energy Coulomb friction (dynamic μ sets the heap angle instead of the grid's 45°), static friction with avalanche hysteresis, and inelastic impact in the sand kernel; still no library.
- Sand-bed follow-up: integer depth layer where walking leaves persistent footprints (displaced sand forms a rim biased toward the push) and a pushed crate plows a berm, relaxed by the same static/sliding friction pair; walkable standalone preview, no production channel yet.
- Soft-ground materials: the same bed with a compaction ratio (snow packs under the boot and bears load, little rim) and viscosity (mud oozes back over seconds); dry sand, damp sand, fresh snow and mud presets in the walkable preview.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
