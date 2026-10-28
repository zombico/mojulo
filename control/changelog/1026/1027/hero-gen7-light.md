### The hero under the seventh generation's light: the theorist's rig (exploration)

- `color-theorist/hero-light.js` `heroFormLight(cube, { palette, surfaces, K })` draws a cube's cast light as a rig
  instead of a bake: the key from its sun or moon, the sky's fill over the floor's bounce, and the horizon as a rim.
  - A solved palette lends the rig its hues and exposure (`skinDirection`'s light, which `worldSkin` drops today), at
    the cube's levels.
  - It reads the hero as lit: the form (the key-to-fill ratio), the shade (no group a hole), the focal step on both
    sides of the light, and the separation from the horizon. A failed separation raises the rim.
  - Nothing in the mint or the World page reads it. No row or render changes.
- `scripts/spikes/form/hero-three-ways.mjs`: a pack member as gen-6 paint, as the form with one response (the `lit`
  export today), and as the form by response (the static export's material buckets), lit by the rig, with the reads
  printed beside them.
- [docs/hero-form-light.md](../docs/hero-form-light.md) records what the reads found on the pack: the night looks read
  flat at gen-7, and the realistic body's plating groups have no material row. It also lists what is missing before a
  mint can draw a hero in the form render.
