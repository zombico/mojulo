### The World page's light: one record, the sky in every reflection, a finished frame

- **Under way.** The World page keeps its baked light and gains, opt-in and adding no byte to a page that does not
  ask: one light record (sun, sky, ambient) every lit channel reads (built, below); one capture of the page's own sky
  as what metal, specular faces and water reflect, and rooms that reflect the room; and a frame drawn in linear light
  and finished in the frame pass (bloom, exposure that adapts, a tone curve whose highlights roll off to white,
  dither), with the grade laid over it as today.
- **One light record a page** (`scene/page-light.js` `pageLight`). Where the sun stands is resolved once from a
  payload, from the first that holds: the form render's land (the cube's solved sun), a town's or a city's baked
  buildings, a stage under a sun or a moon, the payload's baked light, the polygonizer's default. Every channel that
  shades by the sun (specular, liquid, shallows, jets, the seaway, crystal, metal) and every one that casts along it
  (the cast shadows, the live light's actors' and hour's maps, a vehicle's form body) reads that record
  (`scene/scene-three.js`), where each took its own argument with its own fallback. A shadow keeps its own rule
  (`shadowToLight`): the world's own direction where it names one, and the shadow's default under a sun on the
  horizon or on a page with no light of its own, so a minted page's shadows stay where they fell. What changes: on a
  gen-7 page whose land, buildings or stage are drawn as form, the shading channels now follow the solved sun as
  the shadows already did (a metal or a specular face there took the baked light's direction). Every page without
  the form render keeps its bytes; the channel pins hold. The record replaces the one-off that set a form page's
  `shadows.toLight` in `worlds/world-scene.js`: the payload no longer carries it, the page's shadows fall where
  they did. A page the form render draws says its record (`window.__mojSun`), and a test holds a shading channel and
  the live shadows of one emitted page to one sun (`lightAgrees`).
- **On a page the land lights, live water brings no light of its own.** The shallows and the seaway each added a
  sun and a sky fill of three's when no light stood in the scene yet; on a gen-7 page whose land is drawn as form
  they ran before the land brought its own, and their fill then lit the land as well, brighter than its solve. There
  they bring none now (`pageLit`): the land's sun and ambient, the record's, are the page's. Elsewhere they are as
  they were.
- **The record on the page.** A page the form render draws carries the record as `__LIGHT` (and `window.__mojSun`,
  the machine gate's probe); a page without it carries neither, and its bytes are as they were.
- **Left as they are, and said**: on a page with no light of its own the shading channels take the polygonizer's
  default sun and a shadow the shadow's default, two directions, as minted pages have them; unifying them would move
  every such page's shadows. A water surface's own sun (`channels/surface.js`, a kind's argument a surface) is not
  the record's yet.
