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

## Other walk-ins

The museum is the first row of a shelf: a city's civic buildings walked into the same way (`geocity/walkins.js`).

```js
geocity: { …, enter: ['arcade', 'library', 'aquarium', 'zoo'] }
```

- **The blocks** (`pickWalkins`): each kind the next block of the built fabric after the walk's own and the museum's, at
  least its row's `least` across (a walk-in's front is smaller than the museum's).
- **The fronts** (`geocity/scene.js` `walkinFront`): a `portico` at the row's own measures, the museum's builder with
  fewer, shorter columns (a library's), or a `marquee`: a dark box with glass across its front, its doors in the middle
  and a lit sign band with its trim over them (an arcade's).
- **The door** (`gameworld/levels.js` `walkinDoor`): its zone before the door, the way back out in the forecourt. Its
  inside is the row's `program` in its `kit`, composed to its `compose`, never won and left by its door.
- **What is inside** composes with the rest of the game. An arcade's games floor and a library's reading room keep the
  world's inside minigames (`gameworld/minigames.js` `ROOMS_KEPT`, the book's `minigames: [{ game, where: 'inside' }]`),
  spread over them in order.

- **The aquarium** (`aquarium`): a deep blue marquee; inside, the museum's T of galleries in white and teal under cold
  light, a glass tank in each gallery and a big one in each wing's hall (`era/aquarium.js` `layTanks`: a dark base, sand,
  a tinted block of water and glass round it, both seen through, a box walked round). The row's `tanks` name a
  collection a wing (`[{ title, life: ['<sea species>', …] }]`, `marine/fauna.js`); each gallery's tank holds two of its
  kinds in turn, the hall's all of them. The fish swim on loops held inside their tank's water (`marine/tank.js`
  `tankFauna`), drawn by the walkers channel as the sea's are (`worlds/marine-fauna.js` `lowerMarineFauna`).
- **The zoo** (`zoo`): a `gate` front (railings along the street, two posts and a lit sign over the way in, a ticket
  booth, trees on its grounds); inside, open to the sky (the `island-plaza` kit under the `island-noon` look, laid at
  `scale` 2), the museum's T of wings, each room a pen fenced in see-through mesh (`era/zoo.js` `layPens`) with a walk
  round it, each wing's hall its big enclosure. The row's `pens` name a collection a wing, by the names people say
  (`fauna/entries.js`; the sea's are refused, they belong in a tank). A body too long for a gallery's pen is kept in
  the hall. The animals walk loops inside their pen (`fauna/pen.js` `penFauna`), each by a gait it has (a kangaroo hops).
  The plaza kit is heavy: a zoo's page carries several times the faces of the museum's.

A new kind is a row: its name, front, program, kit, look, hall and colours, and what it keeps (`tanks`, `pens`).

## Gates

- **Machine:** `era/exhibits.test.js` and `geocity/museum.test.js`. The wings are the corridors' rooms, every piece
  stands on its plinth's top inside its own wing, a city with no museum is unchanged, and the door pairs both ways.
- **Eyes:** the person walks in, looks round and walks out. Whether it reads as a museum is theirs to say.

## Not yet

- A caption read on walking up to a piece; the wing's title on a sign at its mouth.
- A second storey, a museum shop, a guide.
- A character's live figure posed on a plinth: pieces are drawn as their faces.
