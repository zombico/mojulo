---
{
  "id": "tram-night-market",
  "name": "Tram night market",
  "family": "world",
  "entry": "compose_world",
  "summary": "A curated city roll: seed 7 at night, densified (baseScale 0.7) — a tram boulevard under a dark glass tower, a pagoda on the skyline, lamp-lit park, lit shopfronts. The east-Asian night-city preset.",
  "when": "a night city with a tram; an east-Asian downtown at night; a cozy dense night scene with lamps and a pagoda; a city world for a night-market or noir scene"
}
---

A curated roll of the city generator — this seed is the point of the entry.
At `seed: 7` with `baseScale: 0.7` the pieces land well: the tram corridor
runs the long axis with a train crossing mid-frame, the anchor tower goes
dark-glass against the night sky, the east-asia locale seeds a pagoda onto
the skyline, and the city park catches a glowing lamp among its trees. Same
seed, same city, forever — that is what makes a good roll worth keeping.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — drop `baseScale` back to 1 for a sparser diorama
read, swap the `civic` list for `['town-square']`, or add
`fog: true` at the top level of `overrides` for the raymarched night haze.

## Recipe

See `recipe.json` beside this card — `base: 'city'` with the seed and
overrides above.

Pass the `base`, `seed`, and `overrides` to the world composer. The full
parameter manual for the underlying base is its own card (`id: 'city'`).
