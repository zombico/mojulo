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
- **levels**: its suburbs' register (`geocity.outskirts`: `west-coast` by default, `tropical`, `san-francisco`,
  `sunset`, `bay-and-gable`, `old-town`; `hijackCityWorld({ register })`, the two San Francisco ones laying a hill
  city's district, `bayside`, in its fog), another metro (`geocity.metro.from`), its size, its water, a second
  district beside the first.
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

## What it does not do yet

One district is one level; a city of several districts is several levels joined by their portals. Online play is out
of scope. The machine gate walks each errand on the bus; the fights, the chases and the drive between them are played
by the person (the eyes gate is theirs).
