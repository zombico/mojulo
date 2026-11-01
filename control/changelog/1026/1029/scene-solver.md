### The scene solver

- **The assets annotated** (`scene-solver/assets.js`). Every asset a scene may place carries a card of what it brings,
  so a solver (and an agent reading it) chooses by what an asset does, not by which biome it came from: a tree species
  (its crown, how much it closes over the walk, the climates it belongs to, evergreen or not, its fall colour, the words
  people say for it), a bush habit, a sward length, a grass kind, a flower or weed, a relief, a water body, dunes, snow.
  How an asset reaches a gen-7 scene is read from the code that places it, never written by hand, and an asset no
  scene can reach yet is named as a gap.
- **A scene's fingerprint** (`scene-solver/reads.js`). What a person walking a scene would notice, measured from its
  resolved payload with no render, in a few tens of milliseconds: how open the sky is from the walk, how much of the
  walk runs under crowns, whether the landmark is hidden early and seen late, how far the walk rises and how steeply,
  its length, what stands (species, heights and their spread), how much of the land is grass and of which lengths, the
  drifts, the fall, and the cube's colours (their hues' spread, key and chroma).
