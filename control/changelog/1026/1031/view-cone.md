### The view cone

- **The cone, not a ring** (`scene/channels/view-cone.js`, emitted by the form channel). Full detail is where the
  screen can show it: the camera's frustum, cut off at a reach. `window.__mojCone` holds the eye, the frustum, the reach
  in metres and the pixel at a metre, set before each frame's render list is built, so what the cone does not see is
  left undrawn the same frame. The reach is the screen's by default: the distance at which a tall grass blade's width
  covers `VIEW_CONE.px` pixels, at the camera's field of view and the canvas's height, so a bigger screen sees real
  grass further. It replaces the grass's third-of-the-map rule.
- **The reach adjustable**: a geocube outside's `cone` fixes it in metres (`cone: 40`; refused indoors or out of
  range); live, `[` and `]` shrink and grow it, and `\` returns it to the screen's. `window.__mojCone.set(m | null)`
  does the same from a script.
- **The grass reads the cone** (`scene/channels/form-grass.js` `POV_GRASS`): real grass inside it, thinning over its last
  half, strands past it; a tile is drawn only if the frustum sees it and its band of distance reaches it. The aerial
  camera still draws the whole field.
- **The far field** (`scene/channels/far-field.js`): past the cone's reach the grass is its colour on the ground,
  nothing standing, in the ground's own shader: the grass's (a standing drift's where one holds the cell), offset by each
  cell's dice, lit and shadowed as the ground is, and speckled with world-anchored specks about a pixel and a half at
  their distance (the grain snapped to powers of two, so it holds while the eye walks): a flower's colour where flowers
  grow, a weed's head in the weeds' patches, a lighter or a darker fleck. No draw, no triangle. F toggles it.
- **The far trees** (`scene/channels/form-flora.js` `FLORA_FAR`): in gameplay's camera a plant climbs a ladder by the
  screen's own rule, each rung where its own grain goes under a pixel: whole inside the cone's reach (where its old
  hand-set 25 m was); past it, its own far form; and past where its card's texel is under a pixel, its card. The card is
  itself from that side at the card's grain, solved from the recipe rather than rendered: its near crown's own leaves
  (each clump's turned as the tree's recipe turns them, so the leaf mass lies the way its clusters do, gaps kept, no
  volume the leaves do not hold) and its wood's own triangles, baked once a template from eight bearings, lit as the
  land is by each leaf's clump's facing, at each leaf's own tone, casting its silhouette from the sun's side.
  Every far plant is one draw. A needled crown and a culm keep their own far form; the aerial camera keeps the old
  ladder.
- **No strands past the reach** (`scene/channels/form-grass.js`): the 0.45 m strand rows and their meshes are gone; a
  far map, one strand a cell of the grass map (its height, colour slot and dice), is what the far field paints from
  (`window.__formFar`).
- **The surveyor** (`form/survey.js`, `scripts/far-survey.mjs`): what an eye sees of a sketch's form land, solved from
  its recipe rather than rendered. Each sample of the image is a ray over the land's triangles, read against the grass
  map: sky, inside the reach, or past it as grass, bare, outside the grass map, or the contour, counted by land class and
  charted as text, camera by camera. And what it hands the art (`surveyRegions`): the far field as regions of one
  substance (grass where the map covers it, else the land's class), each with its main colour, its horizontal bounds,
  and column by column its upper bound (the land's top from the eye, less what stands on it: the grass's height there in
  pixels at its distance) and its lower bound (where the far field begins).
  Its contour scan (`contourScan`: from a point of view, on each bearing of a full turn, where the ground peaks against
  the sky or ground well past it) is kept for what stands past the reach, trees, rocks and buildings, not the grass.
