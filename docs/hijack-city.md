# Hijack City: a starter for a GTA-like

Hijack City is the open city's crime game, as a rail (`hijack-city`) and a starter. A person who wants their own
GTA-like starts from it, renames it and changes it; it is a template, never their game. Every piece in it is a word of
the gameworld that the book already reads, so growing it is editing words, not writing code.

The rail is a row of [rails.js](../control/lib/graph/gameworld/rails.js); the starter is
[hijack-city.js](../control/lib/graph/gameworld/hijack-city.js); its genre is the `open-city-crime` cube
([cosmos/fixtures.js](../control/lib/graph/cosmos/fixtures.js)), which the sentence door lays as a district
([genre-forms.js](../control/lib/graph/gameworld/genre-forms.js)). The agent's card is `gameworld-hijack-city`
(`get_game_vocab({ id: 'gameworld-hijack-city' })`).

## Start it

```js
design_game({ world: { name: 'Neon Docks', rail: { from: 'hijack-city', locked: true } } })   // the starter laid
design_game({ ref, approve: ['hero:actions'], run: true })                                   // built
export_game({ ref: `${ref}-game` })                                                          // shipped
```

A locked pitch on the rail with no level yet lays the starter under the world
([pitch-start.js](../control/lib/graph/gameworld/pitch-start.js)): every key the person wrote wins (their name, their
law, their district). A brief's words ("a GTA-like", "steal cars", "a wanted level") find the rail
(`nearestRails`), and the producer offers it.

## What is in it

| The word | What it makes | Where it lives |
| --- | --- | --- |
| `levels.<id>.geocity` | a district of a metro: streets, traffic, parked cars to take, passers-by who flee and fall; its suburbs a West Coast tract (`outskirts`) | [geocity/](../control/lib/graph/geocity/) |
| `errands[].mission` | a contact's jobs told as missions: `heat` (stars as the goods are had), `clean` (lose them first), `time`, `final` (the end) | [mission-mechanics.js](../control/lib/graph/game/mission-mechanics.js) |
| `law` | the wanted level: mayhem raises stars, police on foot and in cars, armed from a star, busted and fined | [law.js](../control/lib/graph/gameworld/law.js), [law-mechanics.js](../control/lib/graph/game/law-mechanics.js) |
| (laid with the law) | the street's health, wasted and the bill | [vitals-mechanics.js](../control/lib/graph/game/vitals-mechanics.js) |
| `shops` | a respray garage (lose the police), a gun shop (rounds for the sidearm) and a forger (a fake ID: a heavy machinery licence) | [shop-mechanics.js](../control/lib/graph/game/shop-mechanics.js) |
| (the hero) | bare hands by default, a sidearm drawn with R or 1/2, fired on Q or the click | [arsenal.js](../control/lib/graph/gameworld/arsenal.js) |
| `factions` | crews with turf and rivals, a board of acts (torch, tag, take) | [factions.js](../control/lib/graph/gameworld/factions.js) |
| `errands[].app` | side work on the phone: fares | [errand-mechanics.js](../control/lib/graph/game/errand-mechanics.js) |
| `errands[].vehicle` | driving jobs on the Jobsified app: the bin round, a heavy haul, a bus route, street sweeping, groundskeeping | [jobsified.js](../control/lib/graph/gameworld/jobsified.js) |
| `ui`, `sound`, `music` | the look of the menus and HUD (mana-ui), the car's sounds, the score (walking, the chase, tension) | [docs/mana-ui.md](mana-ui.md), [docs/game-audio.md](game-audio.md) |

The game ships with a title screen, a pause, a save and continue (the level's own save: what was done, kept at the
moments it is done), and a HUD drawn as a game draws one: the money in hand, the stars, the health in cells under the
radar, the gun in hand while it is drawn.

## Grow it

The starter's `HIJACK_GROWS` names what a person changes first, each a key of the world:

- **name**: the game's own title (the rail's name is ours; the game's is theirs).
- **characters**: the hero (create_character words: body, clothes, how it moves).
- **levels**: the district by a word, `HIJACK_DISTRICTS` (`hijackCityWorld({ district })`): `downtown` (the starter's
  own: the metro's core, its towers, podiums and square, the frame round it), `inner-city` (a Northeast metro's frame: brick walk-ups, four-storey low-rises and main streets among its
  midrises) or `suburbs` (its outskirts: colonials, garden apartments, walk-ups); its suburbs' register
  (`hijackCityWorld({ register })`, `geocity.outskirts`: `west-coast` downtown's, `northeast` the inner city's and the
  suburbs', `tropical`, `san-francisco`, `sunset`, `bay-and-gable`, `old-town`; the two San Francisco ones laying the
  district on the hill city, `bayside`, at its word's ring, in its fog); or another metro (`geocity.metro.from`), where
  in it (`geocity.at`: a neighbourhood's id, or a ring, core, frame or outskirts, its most lived-in neighbourhood), its
  size, its water, a second district beside the first.
- **errands**: the story (the contact, the missions and their heat, clocks and the end), the side work.
- **factions**: the crews, their turf and colours, their boards of work.
- **law**: how many stars, police per star, cars, the star they come armed from, the fine.
- **shops**: the respray and the gun shop, their prices.
- **ui**: a theme card (`playscape/ui/theme-cards/`).
- **music**: the score's moods.

## Era

Hijack City is built in the seventh generation by default (`style.geocube.era: 'gen-7'`): the sun's shadow over the
land, the actors' live shadows, the buildings' baked light and relief near the eye, tone mapping and contact occlusion.
Its frame is held to what it shows: passers-by drawn where they are seen and one draw each, the occlusion's prepass to
its reach, a town's lawn blades near the eye only, one reading of each dressed tile. `gen-6` is the lighter page.

Its style asks the district for its sky as it asks for its hour (`world.js` `skyOfStyle`, carried onto the geocube):
`clouds: 'fair'`, an `air` of haze that pales the far blocks a kilometre off, the `finish` (one tone curve, the sky in
the glass, the lamps' bloom) and the view `cone`. Under the cone the street's kit is drawn as far as it reads, and
traffic past 110 m is drawn as each vehicle's outline, cut on the page from its own model
(`scene/channels/flow.js`, `FLOW_LOD`).

What its surfaces give back, where the finish asks to reflect: the glass (a window's pane, a shop's glazing, a glass
tower's curtain wall) is baked as its walls are and drawn as a surface that mirrors the sky by Fresnel with the sun's
highlight (`form/town-gloss.js`, the form render's `reflect`); a parked car's paint and trim under a clear coat the same
way; the traffic and the car the player takes under the same coat on their own pooled bodies
(`scene/channels/car-paint.js`). A road, a walk and a deck's underside are solved on a face turned as they lie
(`form/sun-light.js` `level`), so a low sun leaves them their own paint, and a deck's underside wears its concrete. No
building stands on air: a wall over ground that falls away from it is carried down to it on a plinth.

Its highways are laid in corridors: an arterial that carries one is laid to the deck's width and 3 m of clearance each
side before its blocks are cut (`geocity/highways.js` `highwayPlan`, `corridorHalf`; each highway's `corridor`), so no
building stands under or against a deck, and nothing taller than the deck's underside stands in the corridor (the
`highway-corridor` law). The city keeps its places (the metro's `civic`, `geocity/blocks.js`): in the core and the frame a church, a mosque or a
temple is built into the city, a lot at a built block's street end among its neighbours (`civic.lot`, its width) or a
small downtown block taken whole, on paving at its walk with bollards and no railing; in the outskirts some
neighbourhoods give a calm block to one (the city library's own buildings, their faith by the metro's weights:
`civic: { faiths: { church, mosque, temple } }`) on a forecourt and a lawn behind a railing, and their largest to a
cemetery (rows of headstones, crosses and ledgers, gravel walks, a chapel by its gate); a whole neighbourhood's park is
laid with promenades crossing at an obelisk, a playground and a pavilion in each quarter, and railed at its streets; a
park block is railed and a car park's streets are lined with bollards. A downtown street (the core's and the frame's own
streets) is dressed as one: its centre line dashed, a zebra at each crossing and where it meets an arterial, cars parked
along both kerbs with a meter every second bay, its trees in their pits between its lamps, a hydrant and newspaper boxes
by its corners (`geocity/scene.js` `DOWNTOWN`). Where a neighbourhood's own street meets an arterial the arterial's walk is opened
across its mouth and the road carried through to the arterial's (`mouthsOf`), nothing of the kerb's stood in it. A
downtown's shops hang blade signs over the walk (`geocity/frontage.js` `blades`), and its roofs are dressed: a tower's
mechanical penthouse and cooling towers, a flat roof's stair bulkhead, its row of air handlers and a cooling tower on the
big ones (`geocity/rooftop.js` `lotRoofPlan`). Its ground level is lived in (`geocity/frontage.js` `lived`, `FRONTAGE.lived`, each
thing by its place's own hash so nothing else moves): blinds drawn and curtains in some windows, a window's air
conditioner on some homes, a shop shut behind its roller shutter (a tag sprayed on some), and before the open ones a
sandwich board, planters at the door, a cafe's table under its umbrella, crates, bags out at the kerb; its streets'
manhole covers, oil stains where cars stand, a utility cabinet, a mailbox and a vendor's cart (`DOWNTOWN.life`). Some
shops' interiors are lit by their own lamps (a warm or cool room, a shelf, a counter and someone at it, its glow the
same at noon and at night: frontage.js `interior`). Each building's walls are its own (`geocity/scene.js` `WALL_VARY`:
its paint's lightness and a nudge warmer or cooler by its place's hash, a facade's stone or brick worn as the other on
some). Work zones stand on some streets and arterial runs (`DOWNTOWN.works`): a crew's works pickup or van, or a
delivery truck, in the kerb lane, a barrier behind it, cones tapered round it; never under a highway's deck nor by a
streetcar's track. Its inner city is cut by ALLEYS (the metro's `alleys`, `geocity/blocks.js`): a share of the
core's and the frame's built blocks split down the middle by a 6 m service lane street to street, each half the block it
was, its walls on the lane windows and never a shop; the lane's ground the neighbourhood's road, opened through the walks
at its mouths and kept clear of parked cars and kerb things there; dumpsters along its walls, bags, stains, a manhole,
wires slung across it overhead, a car or a van in some (`ALLEY`). A downtown walked into below (`under`) keeps its
podiums whole. `alleys: false` cuts none.

## Night

`hijackCityWorld({ hour })` plays the city at any hour; past dusk (`dusk`, `night`, 19:30 to 05:30) it takes its
locale's night (gameworld/locales.js `night`: its street lamps' light, its air and its grade; `HIJACK_NIGHT` where a
locale says none). At night the city's moonlight and sky are dimmed (`geocity/scene.js` `NIGHT_CITY`, its land's with
them), so what is lit stands out of the dark: its windows, its shops' interiors (their own lamps), a pool of light on the
ground under every street lamp, pole lamp and alley wall lamp in the metro's `lamps` colour with a glow at its head, and
its traffic's headlights and tail lights (scene/channels/flow.js, a night page's only). Los Angeles' lamps are sodium
amber in a lit smog, Miami's white over a clear sea air, San Francisco's halos in its fog, Boston's cold white, Toronto's
warm. `civic: false` keeps none of the places.

## The jobs' stops downtown

A contact's jobs stand their pick-ups and hand-ins at the district's shops, at the kerb before each door
(`gameworld/levels.js` `geocityEnds` `places`). A district of shops walked into (a neighbourhood's row of shops, its
`shops` word) uses those. Downtown's towers and podiums have shopfronts but no shop walked into, so there each shop bay's
frame is the place: the kerb before it, its tenant's store named, never a till (`geocity/scene.js`, the level's
`ctx.shopfronts`; nothing drawn by it).

## Jobsified: the city's driving jobs

Jobsified is a phone app (P, its own tab beside TaskFu) that lists jobs done in one of the city's own vehicles. A job on
it is a SHIFT: taken on the phone, done in its vehicle (nothing counts on foot), paid into the money in hand, and a
standing one (`repeat`) worked again. The starter has three (`HIJACK_SHIFTS`):

- **Bin round** (`garbage`, mode `collect`): get into a garbage truck at the works yard. Piles of bags stand at kerbs
  across the district; pull up to one and hold **F** to collect it. Four fill the truck; full, take it to the DUMP and
  drive in to empty it and be paid (its tailgate swings up). Every pile taken, the city lays them all again.
- **Heavy vehicle call** (`heavy`, mode `haul`): a general call for heavy operators, and it asks for a licence: the
  forger at a shop front (`shops.forger`, 150 coin) sells a fake ID, a heavy machinery licence (`fake-id` in the bag,
  kept), and the call is taken on the phone only while it is held (its row's `licence`, the task's `needs`; without it
  the app says what it needs, and its row on the phone says who sells it). Three heavy vehicles stand at kerbs
  by the works yard, trucks and a site's machines turn about (`HEAVY_VEHICLES`: a concrete mixer, a flatbed, a wheel
  loader, a tipper, a skip lorry, a backhoe, a box truck, a wheeled excavator), and the call names them in turn. Take
  the one called and drive it across the district to its building site; arriving pays. Get out there and it goes back
  to the yard, and the next is called; after the last, the first again. Each drives as its own class (its mass, its
  power: roads/vehicles.js); a machine is drawn from the construction shelf as a city's site draws it
  (`geotown/cars.js` `carModel` `site:<archetype>`).
- **Dig and load** (`excavator`, mode `dig`): a side game at a building site, and it asks for the licence too. The
  site's excavator (the one it stages on the band beside its building) is the player's to operate: get in, and the keys
  are an operator's levers, **A/D** swing, **W/S** arm out and in, **↑/↓** boom, **←/→** bucket curled and opened.
  Dig the bucket into the pile of spoil and curl it shut to scoop; swing over the tipper waiting along the band and
  open it to tip. Three loads fill the truck, which pays and goes off empty. The machine is drawn from the
  construction shelf as an operator rig (`construction-shelf/con-operate.js`: each part's placement under its parent
  sampled across its own joint, so the page moves the boom, the arm, the bucket and their rams exactly without running
  the chain), on the page by `scene/channels/operate.js`, which says each scoop and tip to the bus.
- **Delivery orders** (`freight`, mode `haul`, given at the Dockers' HQ): the story's turn after the dig. Once the
  first truck is loaded the foreman calls: the pit is dug but the building materials never arrived; does the player
  know a logistics outfit? The Dockers' contact (the faction's, on its turf) is their HQ: checking in there, once the
  call has come, takes their delivery orders. Three trucks stand at the dock's bays (`FREIGHT_VEHICLES`: a container
  truck, a flatbed of steel, a box truck of fittings, a stake truck of timber), called in turn; each driven to a
  building site pays, and goes back to the dock once left there. The errand says it waits on the dig (`after`), the row
  that it is given at a faction's HQ (`given`) and told by a call (`story`).
- **Bus route** (`bus`, mode `route`): a bus stands at the kerb by the bus depot (by the start where the district keeps
  none). Its stops come in order, each a bus-stop sign with people waiting. Pull up and hold **F** to open the doors:
  those waiting walk to the bus and board, and those who boarded at the stop before get off and walk away. The last stop
  pays, and the route begins again.
- **Street sweeping** (`sweeper`, mode `sweep`): a street sweeper (`SWEEPERS`, the road shelf's `streetSweeper`) stands
  at the kerb by the works yard. Litter lies in heaps along the kerb side of the streets nearest the yard
  (`sweepRoute`: `SWEEP.stretches` stretches of `SWEEP.length` m, a heap every `SWEEP.every`, `SWEEP.kerb` off the
  street's middle); nothing is held, driving over a heap sweeps it. A line on screen counts them, a word comes at each
  quarter, and the last one pays; the streets get dirty again for the next round.
- **Groundskeeping** (`groundskeeper`, mode `mow`): the parks' grounds crew is off sick, so the parks office takes
  anyone with a licence (the fake ID again; its `pitch` is what the office says as it is taken). No mower stands about
  the city: the park nearest the start gets a groundskeeper's shed beside its path (`lawnOf`: `MOW.spot` up a path from
  the park's edge, at the end nearest the start that is level with the walk outside it, `MOW.step`, since a park on a
  terrace is walled over its walk), open to the path, its ride-on mower (`MOWERS`, the car shelf's `rideOnMower`) kept
  inside. Taking the mower out starts a ROUND in the engine, on the park's own lawn: its long grass laid in cells
  (`MOW.cell` squares round its paths, its things, the shed and its trees' trunks, the `MOW.most` nearest the shed), its
  clock at `MOW_ROUND.time`. Each cell driven over is cut, its tufts down to stubble over a stripe light or dark by the
  way the mower went; a line on screen says how much is cut toward the goal and the time left. `MOW_ROUND.goal` of it
  cut pays; the clock run out ends the round and the grass grows back; getting off puts the mower back in the shed and
  ends a round still running. The scene tells a level its parks (`ctx.parks`, geocity/scene.js; `ends.parks`).

```js
errands: [{ id: 'bin-round', giver: 'district', vehicle: 'garbage', repeat: true, reward: [{ item: 'coin', n: 40 }] }]
```

`vehicle` is a row of `SHIFTS` (`gameworld/jobsified.js`): its mode, the yard it starts from, the vehicle as it is
called, its stops or piles, a collect's `load`, the seconds a place is held at (`hold`), and where its vehicle comes from:
the depot's own (the works yard's garbage trucks) or ISSUED (`issuedOf`): a row with a `fleet` one of the fleet's (the
bus), a row with `vehicles` its `calls` of a list's in turn (the heavy call), each stood at the kerb before one of the
places nearest its yard. A new kind of driving job is a row. The errand's list may be left
out (the row's item, its stops as its count). A shift is given by Jobsified unless it names its own `app`; it has no
contact and is never a mission.

Where it is laid (`gameworld/levels.js`): the scene tells a level its yards and their vehicles (`ctx.yards`), its empty
lots and building sites near the eye (`ctx.lots`), and its dump (`ctx.dumpAt`), drawing nothing for the telling; a kerb
beside a place is `ends.kerbAt`. A depot's vehicles and the issued ones are made cabs after the level's nearest cars
(`gameworld/cars.js` `levelCars` `roles`, `issue`), so no other car's id moves. Stops and piles are the district's
places, each about `SHIFT.hop` from the one before and `SHIFT.apart` from the rest (and the dump); a haul's site is the
building site past `SHIFT.haul`, farthest first, a call each in turn. A district with no such depot, no place to send it or no room for its piles
lays none of it: the errand proof says so.

THE DOCK is a district's word too (`geocity.dock: true`, Hijack City's on): the main shore's waterfront segment
before the evocation is built as a working PORT (`waterfront.js` `port`, never picked by the dice): its yard of
asphalt, a warehouse with a row of truck bays before it (where the Dockers' trucks stand), container stacks with lanes
between them and a ship-to-shore crane at its quay, its arterials reaching it along the boulevard. With it the
district's highways are DRIVEN: every land highway is given RAMPS (`highways.js` `rampsOf`, `RAMP`): at each arterial
it crosses one each side, beside its deck in the room its corridor now keeps, from the deck's top down to the street
short of the crossing the way its traffic runs on that side, the deck's barrier left open where it meets; and one from
the shore's highway down into the port. A ramp is a surface the runtime's ray down finds, so a car drives up it onto
the deck and down again (`scene.js` `geocity:ramp`); the level knows the dock (`ends.dock`, its bays) and the ramps
(`ends.ramps`, each top and foot). Where a dock re-cuts the district so that no car park is left for the DUMP, the dump
is built in the port instead, a waste transfer hall at its far end.

THE DUMP is a district's word (`geocity.dump: true`, Hijack City's on): of its car parks drawn near the eye, the one
farthest from its works yard is built as a tipping hall (`geocity/scene.js` `DUMP`, `dumpOf`): a concrete apron and,
at the back, corrugated walls under a flat roof, open across its front to the street, held as any building is. A
district with no car park large enough has no dump; its bin round empties at the works yard.

How it plays (`game/errand-mechanics.js` `lowerShift`, the mechanic card `shift`): getting into one of its vehicles
(`mounted`) once the job is taken clocks in. Holding at a pile or a stop is the key's going down and up said to the bus
(`scene/channels/job-stops.js`, F) and counted on its timer. The guide goes to a job's steps the moment it is taken
(`scene/channels/guide.js` `rounds`), its collect step pointing at the nearest pile not yet taken (`near`), and a
standing job's round loops on itself; the journal ticks its steps, the map marks them and the phone's Jobsified tab shows
what it pays. On the screen a line says the load or the next stop and who is aboard, and how far the hold has gone. On
the HUD, a job paid is a card ("Round complete", "Route complete", "Delivered" over its pay), and the money counts up as
it lands. The errand proof works each on the bus (the getting in given: the proof cannot drive); the driving is the
person's to play.

What is seen (`scene/channels/job-stops.js`): the piles, heaps of bags that pop away as they are taken; the bus stops,
a sign and their people (simple figures, not the street's realistic people); the garbage truck's tailgate swung up as it
is emptied, the truck drawn from its body baked apart from its tailgate (`geotown/cars.js` `carModel` `gate`,
`car-designer/road-civic-works.js` `refuseGate`), pooled only for a page that asks and swung by
`scene/channels/cab-pool.js` `gate`; every other vehicle is drawn as it was.

Not yet: the works pickups and vans (their roof beacon is not carried by a cab), a stop that asks the vehicle to stand
still, a shift against the clock, the street's own people riding the bus.

## Pedestrians, in sixes

The played district's pavements are walked by SIXES (`geocity/crowd.js`): six different people (each rolled a person of
their own, gameworld/people.js `streetPeople`) walking one block's walk together and apart, two pairs side by side and
two on their own, each group its own pace and its own way round. Each walked block asks for sixes by its walk's length
and what it is (`KIND_WEIGHT`: a square, towers and a main street ask more than houses), and the district stacks sixes
where they are asked, nearest its middle first, up to its crowd's most. The metro's `crowd` word sets how heavy:
`quiet` (one six of people rolled, at most four sixes walking), `busy` (two rolled, eight walking) or `packed` (three
rolled, twelve walking); a district in the core or the frame is busy and one in the outskirts quiet unless it says. The
people a level rolls follow its crowd (gameworld/runner.js `crowdSets`), and every six on the pavement is six of one
roll, so no two in a six are alike. The scene's readout says what it laid (`counts.crowd`: the word, the sixes, the
rolls).

### Realistic people

A district's `people: 'realistic'` (`hijackCityWorld({ people: 'realistic' })`; `geocity/crowd.js` `PEOPLE_WORDS`,
`quick` the default) walks its pavements with the street's cast instead of the quick figures: each six is
`gameworld/street-cast.js` `streetSix`, six realistic heroes (three men and three women, six ages, slight to heavy
builds, everyday outfit cards in colours of their own), their ancestries drawn from the locale's mix (`mix`, set from
the level's locale) with no more than two of one in a six. Each is drawn at the realistic CROWD GRADE
(`figures/crowd-figure.js` `realCrowdFigure`, `REAL_CROWD`), two figures from one bake:

- a NEAR figure (about 16k triangles): the face texture baked into the vertex colours, skin under the clothes taken out
  before the mesh is simplified (so it never pokes through), the head kept at a third of the budget so the face holds,
  the hair cards and the face's morph-pinned parts kept whole;
- a FAR figure (about 3k triangles): the near figure sampled again on the crowd's grid.

A walker is drawn as its near figure within `WALKER_DETAIL.near` of its own heights of the camera and as its far figure
past it (`scene/channels/walkers.js`, the near rig built the first time it is wanted); a page with no near figure is the
channel as it was. A realistic person is LIT (`lit`): its colours are its painted skin and cloth, so it is drawn in the
scene's light (the sun by day, the lamps by night), never darker than `WALKER_LIT.floor` of its own colours, since a
street's lamp pools are painted on the ground and light no one. A quick figure's colours carry their light and stay unlit.
A six's people keep their places on their walk (`startFrac`: its groups a quarter of the loop apart, its pairs a step
apart), so no two are drawn on one spot. A realistic person takes a minute or so to bake, so a level's people are baked once and kept
(`figures/crowd-kept.js`, under `MOJULO_CROWD_DIR`, else `~/.mojulo/cache/crowd`), keyed by the person, the grade and
the realistic laws: a level's second read takes them from disk.

## Locales

`hijackCityWorld({ locale })` stands the game in a place (`gameworld/locales.js` `LOCALES`, one row each): its suburbs'
register, the part of town it stands in unless one is named, the geocube it is lit by and its hour, its clouds, its air
(a haze or a mist, its colour, how far it sees) and the world's colour `grade`. Every word a person names over a locale
wins (`register`, `district`, or the style's own words). With no locale the starter is as it always was.

| Locale | Suburbs | Light | Sky and air | Grade |
| --- | --- | --- | --- | --- |
| `los-angeles` | `west-coast` | the valley cube at the golden hour | clear; a warm smog, 2.6 km | `warm` |
| `miami` | `tropical` | the island cube at noon | fair cumulus; a bright sea haze, 4.2 km | `vivid` |
| `san-francisco` | `san-francisco`, on `bayside` | the valley cube in the morning | overcast; the mist lying low | `cold` |
| `boston` | `northeast`, its inner city | the upland cube in the afternoon | overcast; a soft haze, 3 km | `film` |
| `toronto` | `bay-and-gable` | the valley cube, its own hour | fair; a light haze, 3.5 km | none |

Each row may also carry its CITY (`city`): the district's own geocity settings over its metro's, the old fractal
city's theming brought in. Its `grammar` is a document over one of the legacy metro's Earth flavours
(`city/city-flavors.js`): the masses' cladding mix and palettes, the towers' share and shapes, the facades'
affectations (awnings, balconies, fire escapes, rooftop tanks) and the green. Its `hills` and `fall` are the land, and
its `heights` the storeys by ring, its `segments` its core's towers against its podiums, its `lively` its parking.

| Locale | Its grammar | Its land and heights |
| --- | --- | --- |
| `los-angeles` | North American: stucco in cream, sand and salmon, awnings, fan palms | a basin, nearly flat to its shore; a downtown of a few towers among podiums and parking, a low frame and outskirts |
| `miami` | the Gulf's: white render and blue-green glass, slender towers, stacked balconies, coconut palms | flat to the water; a tall core |
| `san-francisco` | North American: white and grey stone and glass, French balconies | the hill city's own, steep |
| `boston` | New York's brick and brownstone, without its fire escapes and water tanks | low hills, drumlins; a cluster of moderate towers |
| `toronto` | the metro's own | the metro's own |

A new locale is a row. Night locales wait on the night pass (lamps that light, headlights, bloom at night).

## The driving view

The camera behind a car the hero drives is framed by the vehicle's size (`scene/channels/cab-pool.js` `cabView`): a car
keeps the chase it always had (`gameworld/cars.js` `CAB.camera`); a bigger vehicle is seen from further back, its rear
`back` metres off the lens, and from higher, so the eye's line over its roof's back edge lands on the road `see` metres
past its bumper, looking at a point over it in proportion to its height (`CAB_VIEW`). A parked cab is framed by its
model when the level makes it, a vehicle taken from the traffic by its own template when it is taken. The chase keeps
`CAB.pullIn` metres off a wall between it and the car (`worlds/controllable/mount.js` `pullIn`, only while it is ridden), so a rig's long chase does not stand
inside the building behind it.

## What it does not do yet

One district is one level; a city of several districts is several levels joined by their portals. Online play is out
of scope. The machine gate walks each errand on the bus; the fights, the chases and the drive between them are played
by the person (the eyes gate is theirs).
