# Underwater: the sea a geocube is seen through

Code: [control/lib/graph/scene/channels/sea.js](../control/lib/graph/scene/channels/sea.js) (the waters, the zones, the
solve, the page's shader), read in `worlds/world-scene.js`, emitted by `scene/scene-three.js`. Spike:
`node scripts/spikes/sea/depths.mjs` (from `control/`). It is the sibling of the air (`channels/atmosphere.js`) and takes
its seam: three's fog chunk, patched once before any material compiles.

A geocube recipe's `sea` puts whatever the cube makes under water **by its light alone**. No surface is rebuilt and no
asset is swapped: the same land, read through water. It is drawn on a gen-7 page; a painted page and every export are as
they were.

```js
{ kind: 'geocube', cube: 'island-noon', show: 'path', sea: 'reef' }
{ kind: 'geocube', cube: 'island-noon', show: 'path', biocube: 'bare', trail: { ground: { dunes: true } }, sea: 'shallows' }
{ kind: 'geocube', cube: 'gothic-night', show: 'path', sea: { zone: 'midnight', torch: true,
    lamps: [{ at: [30, 12, 4], colour: '#ffd9a0', power: 30 }, { at: [36, 30, 6], aim: [38, 34, 0], cone: 60, power: 90 }] } }
```

## The words

`sea` is a zone's word, `true` (the reef), a depth in metres, or settings over a zone. The lists are `SEA.zones` and
`SEA.waters`; each row says how it reads.

| Setting | What it is |
|---|---|
| `zone` | a depth and how it reads: `SEA.zones` |
| `depth` | metres of water over the walk's ground; alone, it takes its measures between the zones it lies between |
| `water` | what the sea is made of: `SEA.waters` (its attenuation per colour, its visibility, its deep colour) |
| `visibility` | metres to where a dark thing's contrast against the water falls to 2% |
| `level` | the light at the walk's ground as the adapted eye takes it; never 0 |
| `caustics`, `shafts`, `snow` | strengths; `false` for none |
| `lamps` | `{ at, colour?, power?, aim?, cone? }` each, in the page's units; with `aim` a spot |
| `torch` | `true` or `{ colour?, power?, cone? }`: a lamp at the eye |

`sea` and `air` are not asked together.

## What carries the read at each depth

A zone is read, not measured: physics sets the colour, the zone sets what the eye is given to read by.

- **Shallow water reads by pattern.** Caustics on what faces the sun, shafts where its rays pass, the surface overhead as
  a bright rippled window. Colour is still there near the eye.
- **Mid water reads by value.** One colour; shapes are silhouettes against the lighter water over them. Compose for the
  outline: a thing reads from below and against open water, not against the bed.
- **Deep water reads by its own light.** No sun: lamps make pools on what they face and glow in the water, and snow shows
  in their beams. A level places lamps where the eye must go; the level's floor keeps the rest from being black.

## How it cheats

- **The light down** is a multiply on what the page already drew: the sun's light at that height, colour by colour,
  normalised to its strongest colour at the walk's ground and laid at the zone's level. A height takes its reds back.
- **The way back** is Beer-Lambert per colour toward the water's body colour (the light down times what the water
  scatters of it), in the place of the page's fog.
- **Caustics** are 1 / |det| of the refraction's Jacobian over a few waves (`SEA_NET`), divided by their measured mean,
  projected along the sun's rays as they stand under water (Snell), on faces whose normal is read from the pixel's
  neighbours, so every material takes them with no change to it.
- **Shafts** are the same net read at a few steps along the view.
- **The surface from below** is a function of the view's direction alone, drawn on a dome round the eye; what stands
  over the surface is given the dome's colour in the shader, so nothing is seen out of the water.
- **A lamp's glow** is the integral of 1 / distance² along the view, closed (two arctangents), times the water.
- **What the water has taken is not drawn**, nor what stands over the surface: the open water shows in its place.
- **The clock** rides the page's fog density, the one uniform every fog-taking material is given each frame. The fog
  stays an honest one (its density the water's extinction in its clearest colour, a quarter more over the clock's
  period), so what else reads it, the contact occlusion's fade among them, fades by the water.

## What grows on the bed

Code: [control/lib/graph/marine/](../control/lib/graph/marine/) (`forms.js` the primitives, `roster.js` the kinds and the
mixes, `place.js` the lay), drawn by `scene/channels/marine.js`. Spike: `node scripts/spikes/sea/aquarium.mjs`.

A biocube's `flora.marine` lays what grows on a seabed and does not swim (the swimmers and crawlers are the fauna's).
The `seabed` biocube is the desert's baseline with the surface world taken out (no tree, no grass, no bush) and
`marine: true`; the `seabed` biome lays it on the desert's sand, and a scene's words reach it:

```js
sceneOfWords('an underwater coral reef')        // the seabed biome, low dunes, sea: 'reef'
{ kind: 'geocube', cube, show: 'path', sea: 'shallows', biocube: 'seabed' }
{ kind: 'geocube', cube, show: 'path', sea: 'blue', biocube: { from: 'seabed', flora: { marine: { mix: 'wall', density: 1.5, kinds: { fan: 2, whip: 0 } } } } }
```

- **A kind is a row** of `MARINE_KINDS`: its primitive, its size, how far it sways, its colours, where it sits in a
  composition (`MARINE_SEATS`) and the depth of water it lives under. A new thing is a row; a new shape is a way of
  growing in the kernel.
- **A composition is a mix** (`MARINE_MIXES`), laid the way an aquarium is: the rock first, what grows on it, what sits
  round its foot, what stands apart, what carpets the sand, and open sand between. `marine: true` grows the mix its
  sea's zone grows (`MARINE_OF_ZONE`).
- **Depth is a law, said and not refused**: a kind asked for where it does not live is left out and named in the
  readout's `left`.
- **The page grows the templates**: the kernel is inlined, so a page carries only where each copy stands. Each is lit in
  the vertex by the cube's sun and sky and sways by where it stands; the sea then takes it as it takes the land.
- **The budget** (`MARINE_BUDGET`): a crowded bed is thinned evenly, its rocks kept.

It casts and takes no shadow, and the exports do not carry it yet.

## Who lives there

Code: [control/lib/graph/marine/fauna.js](../control/lib/graph/marine/fauna.js) (the rows, the search, the call, the
loops), [control/lib/graph/worlds/marine-fauna.js](../control/lib/graph/worlds/marine-fauna.js) (the figures). From
`control/`: `node scripts/marine.mjs search|cast|list`.

A biocube's `fauna.sea` calls the encyclopedia's own sea animals into the water. No animal is modelled here: a row of
`MARINE_FAUNA` names a species `fauna/` or `bugs/` already builds and says how it lives in a sea.

```js
biocube: { from: 'seabed', fauna: { sea: true } }                         // who the flora's mix calls
biocube: { from: 'seabed', fauna: { sea: 'sharks and rays' } }            // by words
biocube: { from: 'seabed', fauna: { sea: { cast: { seaTurtle: 2, tuna: null }, find: 'a crab', density: 1.5 } } }
```

- **A habit is a path's rule** (`MARINE_HABITS`): over an anemone, round a rock, on the bed, lurking, a school, a cruiser.
  Each animal swims a closed loop of its own on the page's walkers channel.
- **The call keeps its laws** (`MARINE_CALL`): depth, room, habitat, salt and the pyramid. What a law leaves out is named
  with its reason in the readout's `left`; who else lives there is in `offered`. Nothing is refused.
- **Asking**: a name asks for that animal (a count keeps its number, `null` never calls it); words that only describe
  (a family, a habit) are preferred where they fit.
- **Searching**: `searchMarine(words, { depth, what })` finds flora and fauna alike by the words people say and says of
  each whether it fits the depth. A new animal is callable the day its row lands; a new sea animal in the encyclopedia
  with no row is not called.

**One skin.** A rig is packed in parts, a triangle handed whole to the bone its corners vote for, so a body that bends
along its whole length opens a sawtooth between its parts when each part rides its bone rigidly. The sea's animals ask
the walkers channel for its `blend` instead: each corner is placed by the bones it is weighed to (the weights every
layered pack already carries), in the vertex shader, so two triangles that share a corner meet in every frame. It is the
drawer's, not an animal's: any figure on a loop can ask for it.

A skin is measured before it is asked (`walkerSkinStretch`: the most the blend stretches one of its own edges over its
gait, against the body's size; `WALKER_BLEND.holds`). Where a species' own binding sets neighbouring corners on bones
that part, one skin would show it as a spike, so that animal swims in rigid parts and is named in the readout's
`rigid` with its measure: a defect of its binding, and the measure is how to find it. The measure found one: a loft
with shaping rings was bound by the wrong names (`fauna/rig.js` `stationsOf`), so each whole ring took the bone of the
one before it and a shaping ring fell to the part's first bone; mended, every sea animal's skin holds.

The same skin on land: a herd's animal (`worlds/fauna-units.js`) asks the controllable drawer's skinned mesh
(`skin: true`, the path a ridden mount already took) where its skin holds over every clip it carries, so a crocodile's
or a lizard's back bends as one skin too.

They do not mind the walker, each other or the rocks. The exports do not carry them yet.

## Limits

- Lamps are literals in every material: `SEA.lamps.most` a page.
- The light down multiplies the page's own light, so a land lit at noon is what the depth is laid over; an emitter
  keeps its light only near white (`SEA.self`), and only as the zone darkens.
- A far range under its own haze (a glyph map's) keeps the page's fog formula and is not taken by the water.
- Engines draw their own water: the exports do not carry it.
