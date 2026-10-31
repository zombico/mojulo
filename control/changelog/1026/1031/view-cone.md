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
