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
- **The finish is asked for** (`light.finish`, `scene/page-light.js` `readFinish`): `true`, a curve's word
  (`neutral`) or `{ curve, reflect }`. It is the opt-in to everything laid over the bake; a world without it, every
  minted one, resolves and emits as it did. An unknown word or key teaches.
- **A specular face reflects the sky** (under the finish, on a page with a painted sky; `channels/specular.js`).
  Beside its highlight a spec face now takes the sky along its reflected view, the dome from horizon to zenith and
  a dark ground under it, weighted by Fresnel from a dielectric's 4% and by the face's own strength. The sky is the
  record's, as an environment (`skyEnv`, `envAt`: the same dome and ground a metal's studio already reflects), stated
  once in JS and held to the shader by a test. A room under no sun reflects none of it.
- **A change to the plan's second step.** The plan captures the page's sky into a cube for every reflective
  surface. A metal already reflects that sky analytically from its zenith and horizon, and a capture of the same
  two colours would add a render at load and no new picture; so outdoors the sky's environment stays analytic (no
  render target, the same frame every time), and a capture is kept for where it shows what the analytic sky cannot:
  a room reflecting the room. That, water under the finish, and the frame's finish (a linear frame, bloom, exposure,
  the curve) are not built yet.
- **Left as they are, and said**: on a page with no light of its own the shading channels take the polygonizer's
  default sun and a shadow the shadow's default, two directions, as minted pages have them; unifying them would move
  every such page's shadows. A water surface's own sun (`channels/surface.js`, a kind's argument a surface) is not
  the record's yet.
