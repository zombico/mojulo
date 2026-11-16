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

## Limits

- Lamps are literals in every material: `SEA.lamps.most` a page.
- The light down multiplies the page's own light, so a land lit at noon is what the depth is laid over; an emitter
  keeps its light only near white (`SEA.self`), and only as the zone darkens.
- A far range under its own haze (a glyph map's) keeps the page's fog formula and is not taken by the water.
- Engines draw their own water: the exports do not carry it.
