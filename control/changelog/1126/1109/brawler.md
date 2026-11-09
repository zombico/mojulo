### The brawler: the belt

- A brawl's ground, the fight's lane opened up (`brawl/brawl-belt.js`): a straight BELT along a level with a depth band
  across it, cut into screens the camera scrolls through, a gate holding the camera at a screen's end until its wave is
  beaten, the last screen the boss's. The camera follows the body furthest on, never goes back and never shows past
  what is held; a body stays inside the view and the band. The camera's angle is locked per stage, a recipe word
  (`classic`, `high`, `low`, `ahead`), and never orbits.
- The levels a brawl is fought down (`brawl/brawl-levels.js`), a new kind a row: the greybox `street` (a road between
  kerbs, building fronts with framed doorways, lamps and things on the far pavement, the near side open to the camera,
  each held screen's line on the road), its belt's words over the preset's; `brawlLevel` gives the greybox world and its
  `brawl` block. A greybox takes a `brawl` block as it takes a fight's `versus`.
- The spike `scripts/spikes/brawler/belt.mjs` shoots the street from each angle.
- The brawl's sim (`brawl/brawl-core.js`): many bodies down a belt, two sides, each body a compiled fighter, so a thug's
  jab and a player's are the fight's frame data (the same frame, the same damage, the same recovery as in the fight,
  checked frame by frame). A blow lands only on bodies lined up across the belt, on every one of the other side its box
  meets; no block; a thrown body knocks down the bodies of its own side it flies into; a body rising from the floor is
  untouchable a moment; bodies push each other only when lined up; each faces its nearest foe. The camera goes on with
  the players and holds at a gate. Deterministic and hashed like the fight; the fight's own core is untouched.
