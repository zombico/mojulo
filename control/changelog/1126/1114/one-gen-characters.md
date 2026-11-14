### One-gen characters

A character has no era: it is built once at the budget its role affords, its look follows the game's style, and the
cast rig draws it on every page. A world keeps its era.

- **The piloted hero is lit by the cast rig on every page.** It was lit by it on a form land only; on a painted level,
  in a room and on a form-era page without a form land, it stayed paint with its light baked in. Now the body a player
  pilots is read lit (its colour under no light and its normals) on every World page that draws it, so the rig replaces
  the bake rather than stacking on it (`worlds/world-scene.js`). The rig's cube, the first that holds: the form land's
  (as it was), the land's own cube drawn as paint (a geocube, a map's `level.geocube`) at its hour, the hero's own
  `geocube`, else the rig's card (`heroCastSource`). Off a form land the figure's rig carries `surface: 'paint'` (the
  body tones itself; `'form'` on a form room's or town's page, which the renderer tones) and `sun: false`, and the page's
  kit makes the key once from the page's shadow light, or a light of its own along the rig's key
  (`scene/channels/controllable/index.js`). A page with no piloted hero, a form land's page, a model made elsewhere and
  the exports are as they were.
