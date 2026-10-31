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
- **The far field** (`scene/channels/far-field.js`): past the cone's reach the page paints an impression, in one geometry
  pass. The grass there is a blanket in the ground's own shader, one colour offset by each cell's dice (a standing
  drift's colour, a flower's on a share of a flowering cell), lit and shadowed as the ground is; and the frame, drawn
  once into an image with its depth, takes one 2D pass that stands strands a few pixels tall only on the land's contour,
  where the grass's edge meets the sky or a farther slope, before its tone curve. F toggles it.
- **No strands past the reach** (`scene/channels/form-grass.js`): the 0.45 m strand rows and their meshes are gone; a
  far map, one strand a cell of the grass map (its height, colour, dice and the ground's height), is what the far field
  paints from (`window.__formFar`).
- **The surveyor** (`form/survey.js`, `scripts/far-survey.mjs`): what an eye sees of a sketch's form land, solved from
  its recipe rather than rendered. Each sample of the image is a ray over the land's triangles, read against the grass
  map: sky, inside the reach, or past it as grass, bare, outside the grass map, or the contour, counted by land class and
  charted as text, camera by camera.
