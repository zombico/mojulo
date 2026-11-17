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
11. **One primitive, two tunings.** A realistic circuit answers the same questions soberly: the look's own asphalt and
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
    verge:   { mown: { every, lift } },
    bunting: { min, every, h, sag, flags, drop, pole, materials: [...] },
    tree:    { profile: 'lollipop', blossom: { share, materials: [...] } },
    pieces:  { blocks: { <set piece>: <its stand-in> }, paint: { <surface group>: <material> } },
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

## The light in code

A chunky kart track is lit by the page unless a word bakes it ("baked"; "gen 7" and "shadows" name the page-lit one):
the kit's `form: true`. Its faces are built in their colours alone (`roads/chunky-look.js` `CHUNKY_FORM_LIGHT`), their
normals kept, then baked as the gen 7 town's buildings are (`roads/track-form.js` over `form/sun-light.js`): each corner
its base and the day's light apart, and the sun's share of it. The page lays the sun's shadow from a static map fitted to
the track and the karts' map that follows the action (`scene/live-light.js`). A mood (golden, dusk, night, rain)
relights a baked track and is not read on a page-lit one yet.

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
