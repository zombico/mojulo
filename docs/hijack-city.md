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
| `shops` | a respray garage (lose the police) and a gun shop (rounds for the sidearm) | [shop-mechanics.js](../control/lib/graph/game/shop-mechanics.js) |
| (the hero) | bare hands by default, a sidearm drawn with R or 1/2, fired on Q or the click | [arsenal.js](../control/lib/graph/gameworld/arsenal.js) |
| `factions` | crews with turf and rivals, a board of acts (torch, tag, take) | [factions.js](../control/lib/graph/gameworld/factions.js) |
| `errands[].app` | side work on the phone: fares | [errand-mechanics.js](../control/lib/graph/game/errand-mechanics.js) |
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
big ones (`geocity/rooftop.js` `lotRoofPlan`). `civic: false` keeps none of the places.

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
