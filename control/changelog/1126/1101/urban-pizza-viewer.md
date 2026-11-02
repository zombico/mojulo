### The urban pizza viewer: a city drawn by the view cone

- **A city on the cone** (`scene/channels/city-cone.js`): a geocity whose world asks for the view cone (`cone`: true for the
  screen's reach, or metres), read for the live page, draws its street as a gen-7 outside draws its land: in full where the
  screen can show it, an impression past it, nothing the cone cannot see. Its street was drawn in tiles within a 320 m ring
  of the eye, every tree at the one level the scene's bookmark cameras picked for it; on the cone:
  - **the trees** are grown twice, at their near level (`cone: 'in'`) and at L0 (`cone: 'out'`) on one grid of 48 m tiles:
    the page shows a tile's near level inside the cone's reach and its L0 past it, by the live eye. The two are
    complementary by construction (one distance, one reach): no tree is drawn twice and none goes missing;
  - **the kit** (lamps, signals, benches, scaffolding, a composed geotown's repeats; `cone: 'kit'`) is drawn while its height
    covers two pixels at the tile's nearest point;
  - **the air** (`air`, channels/atmosphere.js) leaves out a tile whose top lies under an optical depth of 6 (a quarter of
    a percent of contrast): the fog has already taken it. The air's probe answers the optical depth (`__mojAir.depth`);
  - all within the ring a tile without the cone keeps, so a high camera sees the street it saw.
  A lakeshore neighbourhood's street camera drew 1.63M triangles in 569 draws; on the cone 0.71M in 577, looking the same
  (its crossing 2.27M to 1.19M, its evocation's camera 2.28M to 1.11M); under a 150 m fog 0.58M in 348.
- **The air takes the far on every gen-7 page** (`ATMOSPHERE.cull`, an optical depth of 6; the air's probe answers
  `__mojAir.taken`): past it the far trees (`channels/form-flora.js`: whole or as their card) and the far structures'
  tiles (`channels/far-structures.js`: neither live nor carded, the ladder run again as the fog's density changes) are
  not drawn, nor do they cast, on a trail, a path and a geotown alike. A geotown neighbourhood's street camera under fog
  leaves out 333 of its plants and 34 of its tiles; its triangles hardly move (a far card is two of them), so outside the
  city this is the far kept tidy rather than a saving. A gen-7 geotown is drawn by the form render and so was already on
  the cone: its trees cards past the reach, its buildings tiles carded and culled.
- An export reads the geocity as before (one level a tree, the ring), and so does a page without `cone`: not a byte
  changes. Not yet: the micro-city and the geotown (`cone` is not their setting), and the far structures' 128-tile skip
  for a metro (its buildings are cheap massing).
