### The grass as the camera sees it

- **The grass placed once** (`scene/channels/form-grass.js` `STILL_FIELD`). The grass and its drifts are placed once
  over the whole map by the sward's rules (its lengths and their seams, the cover, the claims, the trail, a short sward
  turned from it), the same at every distance, as the gen-6 cards stood: nothing that follows the eye. The near grass on
  grids that walked with the camera, its coarser rings, the carpet's patches with their skirts, tufts and blend rims,
  and the drifts' near and far grids are gone, and with them the drifts' far forms. Drawn in tiles of 24 m, so what is
  out of view is culled.
- **By the camera's mode** (`POV_GRASS`). Aerial, a cutscene's camera, draws the whole field; POV, gameplay's, draws
  real grass out to a third of the map's length, thinning past half of that, each clump going whole at its own
  distance, and past it strands: a sliver each, held a pixel and a half wide whatever its distance, shaded root to tip,
  swaying in the same wind, the colour of what grows where it stands (a standing drift's whole, a flower's at its tip).
  `window.__formGrassView('aerial' | 'pov')` sets it; V toggles it on a walkable page.
- **The grass's height wanders** (`GRASS_HEIGHT`): a slow field over the land, stretches 0.72 to 1.28 × the sward's
  height, and each clump ±20% of its own.
- **Weeds** (`vegetation/wildflowers.js` `WEEDS`, `form/grass-drifts.js` `weedForms`). Four new kinds in the flower
  library, each a head of its own: dandelion (gold rays in two rings), speedwell (many tiny blue four-petalled flowers),
  yarrow (a flat white umbel) and ribwort plantain (a slim brown spike); clover is a weed too. Any grass carries a few,
  every kind in three variants, picked by each cell's dice, gathered in loose patches, standing a little over the grass
  round them; none where a drift has the ground.
- **Leaf litter under the trees** (`scene/channels/form-flora.js` `LITTER`, `form/flora-read.js` a template's
  `litter`). Round each tree's foot, a disc on the ground draws the tree's own fallen leaves as alpha: its outline
  (ovate, lobed, broad, lance, or needles), dark brown, yellowed or its green faded, thickest at the foot and none at the
  rim, in three layers a parallax apart, nothing between the leaves. A leaf is drawn only where it spans a few pixels,
  so seen far or low across the litter thins rather than breaking into dots.
- **The fall** (`era/biocube.js` `flora.autumn`, 0 to 1; `form/flora-read.js` `AUTUMN`). Each deciduous tree turns its
  own way toward its species' colour (maple red, cherry orange-red, beech copper, oak russet, willow yellow), some way to
  the year's yellow, so a wood in the fall is never one colour; conifers and evergreens keep their green. The litter lies
  wider and thicker, less of it brown and more the tree's turned colour. No litter on or at the foot of a stone.
- **No grass in winter** (`form/land-read.js`, `worlds/world-scene.js`). No grass grows where snow lies, whatever its
  depth; a land wholly under snow (a cube's snow with no line) carries no grass on its page at all. Under a snow line
  the grass stands below it.
- **Runnability** (`scripts/runnability.mjs`, `docs/runnability.md`): what a World page asks of Chrome, counted the same
  on any machine: draw calls and triangles a frame at each camera, shader programs, texture and buffer bytes, the JS
  heap, the page's size and its time to first frame.
