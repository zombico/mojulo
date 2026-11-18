### Underwater: the sea a gen-7 geocube is seen through

- **A land put under water by its light alone** (`scene/channels/sea.js`, the recipe's `sea` on the `geocube` kind, every
  gen-7 show). Nothing is built for it: the land is the land the cube makes, and the water is what the light does on the
  way down and on the way back to the eye. A zone's word (`shallows`, `reef`, `blue`, `twilight`, `midnight`), `true`
  (the reef), a depth in metres (its measures taken between the zones it lies between), or `{ zone, depth, water,
  visibility, level, caustics, shafts, snow, lamps, torch }`. It is three's own fog chunk, patched once before any
  material compiles (as the air's: the two are not asked together), so every surface that took the page's fog takes the
  water. A painted (gen-6) page and the unshaded export are as they were; the word is read on any geocube.
- **The light at a depth, colour by colour.** A water (`ocean`, `coast`, `murk`) is its diffuse attenuation per metre
  for red, green and blue and a visibility: red goes in the first metres, green next, and the last light keeps the
  water's own deep colour, never a primary. The eye adapts: the light at the walk's ground is laid at the zone's level,
  never black. Along the view the water takes each colour by Beer-Lambert (its absorption and the scattering its
  visibility sets) toward the water's own body colour, lighter looking up and darker looking down.
- **What each depth reads by.** Shallow: caustics on what faces the sun (the surface's ripples as a net of light whose
  mean is 1: light is moved, never made), shafts where the sun's rays pass, and the surface from below (the sky through
  Snell's window, a mirror outside it). Deeper: value alone, shapes as silhouettes against the lighter water over them.
  Where the sun does not reach: `lamps` (up to the page's limit, each `{ at, colour, power, aim, cone }`: a pool on
  what it faces, falling by the square of the distance and by the water, so a warm lamp greens with reach, and a glow
  in the water round it), `torch` (one at the eye), and marine `snow` that shows in their beams.
- **Under the water there is no sky and no waterline**: the page's dome, clouds and sun are hidden, the land's own sea
  sheet with them, and what stands over the surface is not seen from under it.
- **Inside** (a flooded hall, room or cavern) no sun reaches: the room's own light stands, seen through the water.
- A bare, duned land is a sandy bed (`biocube: 'bare'`, a trail's `ground.dunes`): grass reads as seagrass.
  `scripts/spikes/sea/depths.mjs` shoots a land at every zone. `window.__mojSea` is the probe. Absent `sea`, the page
  is byte for byte as it was. How it is built and tuned: `docs/underwater.md`.
