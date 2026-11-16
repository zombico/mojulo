### Underwater: what grows on the bed

- **A seabed laid as an aquarium is** (`control/lib/graph/marine/`, a biocube's `flora.marine`, drawn on a gen-7 geocube
  page by `scene/channels/marine.js`). The surface world is taken out and the bed's own flora laid in its place: the
  hardscape first (reef rock in lumpy mounds), then what grows on it, what sits round its foot, what stands apart in
  groups, and what carpets the sand in drifts, with open sand left between. Nothing that swims or crawls: those are the
  fauna's.
- **The primitives** (`marine/forms.js`, one import-free kernel run by the laws and inlined into the page, so a page
  carries only where each copy stands): forking branches, a plate on a stalk, a ribbed dome, upright fingers, a fan in
  one plane, whips, a barrel, open tubes, an anemone's column and crown, tube worms and their plumes, a sea pen, kelp's
  stipes and hanging blades, a tuft of seagrass, sea lettuce, and reef rock. Each is a mesh at its true size with its
  colour (no light in it) and how far each vertex moves in the current: nothing in the bed moves.
- **The roster** (`marine/roster.js`): a kind is a row (the words people say, its primitive, its size, its sway, its
  colours, where it sits in a composition, and the depth it lives under); a composition is a mix (`reef`, `kelp`,
  `meadow`, `wall`, `deep`, `vents`). `flora.marine: true` grows the mix its sea's zone grows; a kind that does not live
  at the depth is left out and named in the readout (nothing that needs the sun in the dark), never refused.
  `{ mix, density, kinds: { <kind>: weight }, seed }` tunes it.
- **The lay** (`marine/place.js`): read off the land as built (its ground and its trail), along the walk; the trail kept
  clear; a fan set on a rock's flank facing out; a drift wholly one kind; thinned evenly to the page's budget with the
  rocks kept. The same lay from the same seed.
- **On the page**: each template is grown there and drawn as one instanced mesh, lit in the vertex by the cube's sun and
  sky (a blade lit through from either side), swaying by where it stands so a stand of kelp leans together, then taken
  by the page's fog: under a `sea` its reds go with the depth as the land's do. `window.__mojMarine` is the probe.
- **The `seabed` biocube and biome**: the desert's baseline with no tree, grass or bush and `marine: true`; the biome
  lays it with the desert's sand and palette and locks the land's grass role to sand. With `flora.marine` and no grass
  the gen-7 land grows none.
- **Words**: a scene's `underwater`, `undersea`, `seabed`, `seafloor`, `reef`, `coral`, `abyss` lay the seabed biome on
  low dunes, open, under a `sea` at the word's depth. In a game these words lay the bed without its water yet.
- `scripts/spikes/sea/aquarium.mjs` shoots a bed from words or by zone and mix, and `--sheet` stands every kind in its
  colours. Absent `flora.marine`, every page is byte for byte as it was.
