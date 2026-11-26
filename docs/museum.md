# The museum

A museum is a building of its own in a city level: its front on a block of the district, its door a level's door, and
its inside its own page. Entering does not load the city behind it. Leaving by its door puts the hero back on its
steps, with the city as it was left. It is a place to look round, with nothing to win, and the things in it are things
mojulo made.

## In the city

A geocity's `museum` (on the spec, `geocity/metro.js` reads it):

```js
geocity: { …, museum: true | { name?, exhibits?, scale? } }
```

- **The block** (`geocity/museum.js` `pickMuseum`): of the evoked district's blocks, the built one, wide enough for its
  front, nearest the district's middle after the one its walk starts at. It stands across a street from where the
  hero is set down. A district evoked as a single block has none.
- **The front** (`geocity/scene.js` `museum`): a forecourt paved from its front street, a flight of steps, a portico
  of columns under a pediment, a pale stone hall taller than the portico with a cornice, and banners in the bays
  either side of the door. Its measures and colours are `MUSEUM` in `museum.js`.
- **The door** is an anchor (`kind: 'museum'`) on the hall's front, facing its street. A city that asks for no museum
  is built as it always was.

## The door

`gameworld/levels.js` `geocityEnds` turns the anchor into a level door, `museumDoor`:

- its zone on the portico just before the door;
- the way back out at the foot of its steps, facing the street (`MUSEUM_IN`).

The district's stages gain the museum's inside as an `interior` stage, its own level page, and `gameLinks` pairs the
door with the inside's `out`. This is the pattern a geotown's houses already use. The play shell carries the hero
through (`params.__entry`), and the city's own save comes back on the way out (`params.__resume`).

## The building

The `museum` program (`era/programs.js`): a lobby, a core, and three wings in a T. Every room along a wing is a
gallery and each wing ends in a hall, the last the great hall. It is single storey, laid larger for a third-person
camera (`scale`, 1.5 by default). Nothing is stocked in it but its plinths.

Its look is its own bay kit, `bay-gallery`: a `gallery` value on each of the four axes in `era/style/bay-axes.js`.

- **Construction:** smooth plaster to a slim skirting and a fine cornice, oak boards or a pale stone underfoot, a
  coffered ceiling, and wide doorways in slim frames. No dado and no services.
- **Palette:** warm white walls in most rooms, by a room's dice an oxblood salon or a grey-blue room. Charcoal frames
  and skirting, and warm white plinths.
- **Light:** daylight down through the coffers, warm track light, a soft cove.
- **Dressing:** bare. No grating, pad, services, high bays or crane.

Its level has no goal room. A level must have some way to be won, so it carries `LOOKED_ROUND`, a win on a count
nothing raises. It is never won, only left by its door.

## The exhibits

```js
exhibits: [{ title?, pieces: ['<ref>' | { ref, name?, life? }] }]   // one collection a wing: a (+x), b (−x), c (+y)
```

`era/exhibits.js` lays them:

- **A piece** is any stored sketch that draws faces: a solid from `mint_solid` (a vehicle, an animal, furniture,
  equipment), a workbench piece, another world. It stands on a plinth down the middle of a gallery, fitted to stand
  within the plinth's top. A car becomes a model of itself.
- **A life-size piece** (`life: true`) stands whole on a low dais in its wing's hall, one a wing.
- **The rooms** take a wing's pieces near to far, up to four a room. What does not fit is said in the stage's
  `exhibits.findings`.

Each piece leaves the stage as an `itemRef`. `worlds/world-scene.js` resolves it where the store is, and
`placeItemFaces` fits its faces. The studio floor a thing's own page stands it on is left out.

## Gates

- **Machine:** `era/exhibits.test.js` and `geocity/museum.test.js`. The wings are the corridors' rooms, every piece
  stands on its plinth's top inside its own wing, a city with no museum is unchanged, and the door pairs both ways.
- **Eyes:** the person walks in, looks round and walks out. Whether it reads as a museum is theirs to say.

## Not yet

- A caption read on walking up to a piece; the wing's title on a sign at its mouth.
- A second storey, a museum shop, a guide.
- A character's live figure posed on a plinth: pieces are drawn as their faces.
