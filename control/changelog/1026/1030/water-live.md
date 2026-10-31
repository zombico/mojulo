### Water live: a geocube's river and falls drawn as they move in gen-7

- **The water's plan** (`era/out-water.js` `plan`): a trail's river (its line downstream, its levels, its width, how far
  it falls) and its falls (the lip, the drop, the width, the brook to it, the pool's carved bed) as data, each body's
  painted faces carrying its id (`waterBody`).
- **Drawn live in gen-7** (`era/water-live.js`, read in `worlds/world-scene.js`): a gen-7 read on the World page draws
  the river on the surface channel's river (ripples and streaks running downstream, lanes along the banks, a narrow
  band of foam at them, the river look tinted by the cube's water, its current as fast as its bed falls), and the falls
  as a sheet jet off the lip (glassy over the brink, whitening as it falls, mist at its foot) into its pool, a shallows
  pond in the pool's own carved bed that the fall churns; the brook to the lip a small river. The painted sheets they
  replace are left out, so the form render never draws them as its still mirror. gen-6, an export (`paint`) and a
  cavern keep the painted water, every byte as before.
- **A pool in its own bed** (`materials/shallows.js`): a pond takes a world's carved basin (`bed`: a grid of depths
  under its level) instead of its lobed bowl.
- **A falls' pool on a river**: where a far-side river runs past the falls' foot, the pool is laid at the river's level
  there, so the fall drops into the river. Before, the river's channel cut the pool's rim and its water stood over the
  channel beside it, its edge in the air (both eras).
- `scripts/spikes/water/live.mjs`: a geocube's water from each still in gen-6 and gen-7, each at two moments apart.
