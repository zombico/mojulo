### Secret walls in the metroidvania box

- A box's pocket can be a secret: `pockets: [{ gate: 'secret', holds }]`. Its wall looks like the walls round it and
  is marked nowhere, not in play and not on the map. No power opens it: the hero finds it by striking the wall, and its
  prize appears on the map once the wall is down.
- Destructible terrain where the game asks for it: under `destruction: 'physical'` a secret wall is matter. It is the
  room's own wall stone (the geocube's), calibrated to break in a few blows at the hero's power, and it comes apart by
  rupa's physics, its debris that stone. Without it, a secret wall still breaks by counted blows.
- Vampire Sonata and XenoJager each hide a secret or two. The game book's ring cards say each one.
