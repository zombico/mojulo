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
