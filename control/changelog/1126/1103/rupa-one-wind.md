### One wind: plants, grass, cloth and destructible physics feel the same air

- **A physical level's** blocks, dust, smoke and drifting leaves now take the level's own `wind`, the one its trees,
  grass and hung cloth sway in. The two profiles are matched exactly at 2 m and 10 m (within 2% between); the level's
  `matter.wind` still overrides it for the physics.
- **A geocube's `wind`** is its outside levels' wind when the recipe names none.
- **Trees in the wind solver**, by species, sized by geometric similarity: the wind that snaps one is the same at every
  size, about 39 m/s at a broadleaf's crown and 31 for a conifer, near the 42 m/s storms break trees of every size at.
  A stand stands still in a breeze, bends in a fresh wind, and goes to the physics in a storm. Bamboo is hollow.
- A level without a wind, and every world not physical, changes no byte.
