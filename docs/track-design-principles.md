# A track's design language: the principles a new map starts from

A raced track (`control/lib/graph/roads/`) is drawn from one **design language**: a card that says what the track is
made of and how its parts are shaped (`roads/track-language.js`). These are the principles a card is written by. They
are starting points: an agent authoring a new map copies a card, changes its premise, and keeps what each principle
asks. They follow from where the eye is on a course run from behind
([course-dress-principles.md](course-dress-principles.md)): the way's far end is where what is coming is read, the
middle of the screen is where a thing is made interesting, and the sides are where speed is seen.

The agent's card is `gameworld-track-language`. The laws are machine laws and advise; whether a track looks right is
the operator's to say on the page.

## The principles

1. **A premise first.** One sentence says what the track is made of (`reads`), and every part is named in it. Candy:
   *a toy track of moulded plastic*. Grand-prix: *a circuit of asphalt, paint and galvanised steel*. Parts chosen one
   by one (a road from one place, a wall from another, a toy from a third) do not make a track.
2. **A small family of materials.** A material is a stuff, a finish and a colour. Few of them. The rail and the posts
   it stands on are one stuff. Two finishes at most on the hard parts: gloss for what is moulded, matte for the way and
   the turf.
3. **The way is quiet and light.** It is the largest thing on the screen. Matte, mid-light, never as vivid as a kerb.
   The kerb parts from it by lightness, and the kerb's two colours part from each other.
4. **A corner is told three times.** Far off, the rail wears its tell in stripes round the *outside* of the corner, so
   the corner is read at the vanishing point. In the middle, chevrons on the way point into it. Near, the kerb. All
   three wear the tell's two colours, and nothing else on the track does.
5. **Seen to move.** The way's own centre does not move across the screen, so speed is read off what passes: the way
   laid in bands of two tones, a centre dash, the verge mown in stripes, posts at one spacing, bunting. A straight
   carries at least two of them.
6. **Asymmetry.** The two sides never mirror. Bunting runs down one side of a straight, the side by turns from
   straight to straight. Chevrons lie on the outside half of the way, where the corner is come at from. The rail's
   tell is on the outside only. A tree's crown is lopsided, no two alike, and a share of the trees are in blossom.
7. **Chunky.** Rounded and stout. Nothing thinner than a hand could hold, a ball on every pole, pillows for kerbs, a
   tube for a rail. Smooth polygons, never cubes.
8. **The sky is the track's, and its sun casts.** Its day, its sun, and clouds built as the track is. Never an empty
   grey. The light is the seventh generation's: a surface carries its colour and its form, and the page lights it, the
   sun's shadow cast live (the static world once, the karts each frame). The sun stands low enough (36°) that a post, a
   ball and an arch lay shadows long enough to be read from the kart, and the sky is so much of the light that a shadow
   is a soft blue, never black. The palette is held on what lies flat (the way, the kerbs, the verge): a colour there
   shows as the card says, and a wall turned to the sun runs brighter than its paint.
9. **The land in the track's shapes.** Trees take the land's own greens and the language's forms.
10. **The trackside is the track's too.** The arch, the braking boards, the castle and the bumpers are made in the
    same family and the same shapes: a stand-in block for each set piece (`pieces.blocks`, taking the piece's own
    params so it is sized in its slot the same way) and every surface group painted in the family's materials
    (`pieces.paint`). A hoop on two balls for an arch, a lollipop for a braking board, balls for battlements.
11. **A town is the track's too: a street circuit** (`candy-city`, asked for as "a kart street circuit", "downtown",
    "through the streets"). The lap runs round a few blocks of a grid, its corners square
    (`roads/course.js` `designStreets`). The town is laid from the geocity's ideas in the track's family
    (`roads/street-frontage.js`): a row of buildings faces the way down each side of every straight, past the rail and
    a sugar-pink sidewalk; they rise toward the town's middle as a geocity's rings do (shops at the edge, flats, a few
    towers at the core); never three of a kind in a row; each a colour of the family by turns, never the one beside
    it. The street's kit near the eye: lollipop lamps down the sidewalks by turns, a signal of three balls at the
    outside of every corner, a zebra across the way at each straight's start. The corners stay open: the boards, the
    arches and the landmark still tell them, and the side pieces give way to the fronts. Two features make it more
    than a loop (`roads/street-features.js`): **a split**, a cobbled alley leaving the way before a corner and cutting
    across its inside to the straight after it, either way the lap (the alley is driven as road, the rail opens at its
    two mouths, no checkpoint stands between them). It is shorter than the way round, but its cobbles drag a kart
    taken over them bare; two boost pads down it pay it back: a racer who hits them gains on the turn, one who misses
    them loses. A shortcut is worth taking only if it asks for something; and **an underpass**, a toy building spanning another
    straight, the street through its ground floor under a berry band and a row of balls, lamps along its ceiling. A
    choice and a dark moment: a lap with both has something to learn and something to feel.
12. **Underground is the track's too: a mine** (`candy-mine`, asked for as "a kart race through a gem mine",
    "underground", "tunnels", "caves"; `roads/mine.js`, the card's `mine`). The whole arena is underground: the lap
    runs round the floor of one great cavern inside a chocolate mountain (`mine.cavern`). Its outline is a ring round
    the lap, as far out at each bearing as the lap reaches and a margin past it. Its walls bulge and lump up to a domed
    ceiling. Stalactites hang from the ceiling and stalagmites stand clear of the way. Its floor is the track's own
    ground in the family's dust, and the verge is the rock's colour mown in stripes (a language's `verge.material`).
    Lantern posts lean over the rail down the lap, the two sides by turns, and crystal clusters glow on the floor in the
    family's bright colours, each a pool of its own colour. One skylight is the day: it is set where the sun, coming
    down through it, falls toward the yard, and in its shaft a kart casts its shadow. The page's haze is the cave's
    dark, and a kart is lit dimmer than the open day. The miners bored on through rock masses on the cavern's floor:
    its galleries are laid where the way bends gently enough for their walls, never over the grid,
    the longest one first and a short one after it. Each is a bore past the rail with a ledge for the cart line, under a
    lumpy hill of the family's rock, frosted along its crest, that rises toward the gallery's middle and falls to each
    mouth as a hillside. Each mouth is a timber portal with a board of gems. Inside, the miners' sets (log posts and a
    cap, a set every few metres) mark the speed, lantern pairs hang over the kerbs, gems glow in the walls, and carts
    heaped with gems stand on the line. Outside its longest gallery is the yard: a headframe with its wheel and a heap
    of spoil, under the shaft of day. Its light is the cave's (`era/cave.js`): under the hill a corner sees the day only through the mouths, less
    the deeper it is, and the lanterns lay warm pools in the cave's torch register, scaled to the bore's width as a big
    cave's lamps are. The open air has its own rhythm, light and dark; underground the rhythm is the lamps': a hall
    of warm pools, a timbered gallery, a shaft of day.
13. **One primitive, two tunings.** A realistic circuit answers the same questions soberly: the look's own asphalt and
    paint, one steel for the guardrail and its posts. A principle is a question, and candy is one answer to it.

## A card

```js
{ reads: '<the premise>', suits: ['kart'],
  materials: { fondant: { of: 'fondant', finish: 'matte', hex: '#7f7aae' }, /* … */ },
  parts: {
    way:     { material, bands: { every, material }, dash: { every, len, w, material },
               chevrons: { before: [m…], w, len, t, materials: [a, b] } },   // or { from: 'kit' }: the look's asphalt
    edge:    { profile: 'bead', w, h, material },
    kerb:    { profile: 'pillow', h, materials: [a, b] },
    rail:    { profile: 'tube' | 'w-beam', r, z, material, tell: [a, b],
               post: { profile: 'round' | 'i', r, every, material, cap: { r, material } } },
    verge:   { material?, mown: { every, lift } },
    bunting: { min, every, h, sag, flags, drop, pole, materials: [...] },
    tree:    { profile: 'lollipop', blossom: { share, materials: [...] } },
    pieces:  { blocks: { <set piece>: <its stand-in> }, paint: { <surface group>: <material> } },
    city:    { sidewalk, margin, paving, crossing, zebra, lamps, facades: [...], heights: { core, edge, flat, tower },
               blocks: { shop, flat, tower }, kit: { lamp, signal } },   // a street circuit's town
    mine:    { galleries: [{ share, least, most }], clearStart, apart, dark, depth, cavern?: { margin, wall, crown, segs,
               rings, lump, floor, skylight: { r, strength }, dark, stalactites, stalagmites, posts, crystals, haze },
               bore: { ledge, flank, spring, crown, cover, lump, round, step, peak, frost, lean, boulders },
               rock, frost, floor, timber, lantern, sets: { every, r }, lanterns: { off, drop, r, gain },
               gems: { share, colours: [...], glow, size }, line: { gauge, rail }, carts: { inside, body, rim },
               board: { w, h, material, edge }, yard: { back, off, r, headframe, wheel, wheelMaterial } },   // a mine
  },
  sky: { zenith: [r, g, b], horizon: [r, g, b], sun: { u, h }, puffs: { count, hex, alt: [lo, hi], size: [lo, hi] } } }
```

A part left out is the class's plain one. The shelf is `TRACK_LANGUAGES`; `LANGUAGE_OF_CLASS` says which a track from
words takes. A new language is a card, by name on the shelf or written out in a level's `roadway.language`.

## The laws

`languageLaws` (machine; they advise): `premise`, `family` (small, and every part draws from it), `one-metal` (the rail
and its post of one stuff), `finish`, `kerb-read`, `tell` (the tell is not the rail's colour), `suits` (the class it
is laid on), `drawn` (nothing drawn outside the family). A roadway level's gate says them as `language:<law>` beside
the track's own laws and the trackscape's.

## Items

A kart track from words lays item boxes (a track's `items`: true, or `{ every, across, back, odds, catchup }`;
`roads/kart-items.js`). They stand in rows across the way on the straights, never on the grid, a row every so many
metres of the lap. Each box is something to drive at, said three ways at once:
- **Its shape:** a rounded golden core with a "?" on every face.
- **Its rim:** a glassy shell lit at its rim in colours that run round it (a fresnel: the more the shell turns from the
  eye, the brighter and the further round the wheel), standing apart from the family's flat colours.
- **Its motion:** it turns on a tilted axis and bobs, where nothing else on the track moves.

Driving through a box takes an item if the kart holds none. The box pops and comes back after a few seconds. The items
are the candy family's own:
- a **sugar rush**: a boost, the drive rule's own
- a **toffee**: a sticky blob dropped behind, which slows and spins the kart that drives over it
- a **gumball**: a ball rolled ahead down the track's line, which knocks the first kart it meets

What a box hands out depends on where the kart stands (catch-up). The race keeps each kart's progress round the lap on
the track's line and ranks the field from it. Each item's weight is scaled between the leader's and the last's
(`ITEM_BOXES.catchup`): the last mostly gets sugar rushes to come back with, and the leader mostly toffee to defend with
and few boosts to run away on. `items: { catchup: false }` draws flat.

The pilot uses its item on F (or right Shift, or the pad's left face), listed on the pause sheet's controls. Rivals use
theirs by judgement: a boost at once, a toffee with a kart close behind, a gumball with one ahead in reach.

The HUD's held item is one large slot at the top's middle, there all race, and it says nothing in words: it is read at
a glance, as the genre's item box is, never read through. Empty, its frame is dashed; holding an item, the item's
pictogram fills it and its frame turns the accent, so a box just taken catches the eye, with the key that uses it in
its corner. Each item names its pictogram (`icon`, on the game UI's icon shelf: a
wrapped sweet with a bolt through it, a toffee splat, a gumball), drawn in a colour the HUD's plate reads against: the
sweet in the accent's lemon, as its burst is; the gumball in the sky, as it rolls; the splat in the cream ink. A new
item is a row of a known kind on `ITEMS`, with its pictogram.

## The race's HUD

The HUD is read from the kart as the track is, so it keeps the same screen: the corners and the right edge, never the
way ahead or the kart (`gameworld/race-hud.js`). It wears the track's family: a candy track's HUD is berry plates with a
cream rim and lemon for what matters (`kart-candy`); a circuit's is the timing tower, near-black and quiet (`pit-wall`).
Its map draws the track's own line. Its lights are a start gantry's: five, one a beat, out together for GO.

## The light in code

A chunky kart track is lit by the page unless a word bakes it ("baked"; "gen 7" and "shadows" name the page-lit one):
the kit's `form: true`. Its faces are built in their colours alone (`roads/chunky-look.js` `CHUNKY_FORM_LIGHT`), their
normals kept, then baked as the gen 7 town's buildings are (`roads/track-form.js` over `form/sun-light.js`): each corner
its base and the day's light apart, and the sun's share of it. The page lays the sun's shadow from a static map fitted to
the track and the karts' map that follows the action (`scene/live-light.js`). A mood (golden, dusk, night, rain)
relights a baked track and is not read on a page-lit one yet. Under a mine's hill a light pass follows the bake
(`roads/mine.js` `mineLight`): it dims what the day gives a corner by its depth in the gallery and adds the lamps'
light, both before the page draws, and the gems and lanterns are kept from the bake as their own light.

## Looking

```bash
cd control && node scripts/trackscape.mjs "a kart track" out.html
```

A piece is judged as it is seen coming down the way from behind the kart, not from above.

## Not yet

The rock formations in the land (the arches, the buttes) and the stadium bowl a kart venue may stand in are not yet in
the language. The flanks between
the rail and the land are not laid in slices. The light is baked: the page does not yet light the track as it lights
the kart.
