### The World page's light: one record, the sky in every reflection, a finished frame

- **Under way.** The World page keeps its baked light and gains, opt-in and adding no byte to a page that does not
  ask: one light record (sun, sky, ambient) every lit channel reads (built, below); one capture of the page's own sky
  as what specular faces and water reflect, and rooms that reflect the room; and a frame with headroom finished in
  the frame pass (bloom, exposure that adapts), with the grade laid over it as today. All of it is asked for by
  `light.finish`.
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
  a room reflecting the room. That, water under the finish and exposure that adapts are not built yet.
- **Bloom, over a frame with headroom** (under the finish; `channels/frame-pass.js`, `scene/page-light.js`). The
  plan drew the frame in linear light and finished it in the pass. That would put every painted colour through the
  curve's inverse, in every custom shader a page has (sky, water, panes, sprites), and one missed is a colour moved.
  Instead the frame stays as it is drawn, display-referred, in the pass's half-float target, where an emitter may
  write past white. What is past white is the bloom (`bloomBright`): drawn down a chain of halves, the first with a
  Karis weight so one hot pixel does not flicker, and back up through a tent, each wider level counted a little more
  (`FRAME_PASS.wide`), then laid over the frame by `strength` under the grade. A pixel at or under white gives
  nothing, so no pixel of a page changes but round an emitter. The chain is five levels, four at the half tier,
  none at off (`BLOOM_LEVELS`). Under the bloom a glow sprite is its emitter's core, smaller and past white
  (`channels/glow.js` `GLOW_HOT`), and the bloom draws its halo from its light. `light.finish` takes
  `bloom: false` or `{ strength, radius }`. What this gives up: a tone curve chosen a page (it stays each
  material's own). Measured in Chrome on a lamp against a dark wall: with the finish the core clips to white and
  its light spreads past the sprite, where the same page without it is the painted halo. The probe is
  `window.__mojFrame.bloom`.
- **A page's emitters are drawn past white** (under the finish's bloom). A face that says it emits, a lit window's
  pane or a sign (`emissive` with its strength, what the lit export already reads) and a fixture's face (`glow`), is
  drawn once more over itself in the frame's headroom, one mesh a page a hair toward the eye
  (`channels/hot-faces.js`), so the bloom draws its light from the face itself and a lamp's face no longer sits cold
  inside its glow. The sun's disc on a painted sky (`channels/sky-dome.js` `SUN_HOT`) and a fire's halo
  (`channels/fire.js` `FIRE_HOT`) go past white with them. The chain's levels are laid back over the root of their
  weights' sum, between a wide emitter, which their sum would multiply, and a point, which the chain thins. Seen in
  Chrome: a lit window, a lamp and a neon sign each with its own halo on a test wall; on an island plaza at night
  the lit window over the square glows. Not past white yet: a lantern's flame (a fixture with no emitting face), the
  form sky's sun, and an emitter inside a repeat.
- **A torch's flame is live in the form render** (a room read in gen-7; `scene/channels/flames.js`). The sixth
  generation draws a torch's flame as two crossed polygons, and the fire channel draws real fire at a real cost: a
  ray marched through every flamelet, embers, smoke, and every material on the page patched for its light. Between
  them: every flame on a page is one instanced quad turned to the eye, its shape a formula of the clock in its
  shader (a teardrop that sways more toward its tip, eddies rising through it, white at its root to orange at its
  tip), added over the frame. One draw call for all of them, no state, no render target; the light they give is
  the bake's, as it was. A torch keeps its iron and a bed of coals in its bowl, which carries its glow and what an
  engine reads as its light (`era/stage.js` `torchFaces`). Under a world's bloom a flame is drawn past white. A
  room with live fire (`fire`) keeps the fire channel's; gen-6 and an engine's read keep the polygons. Seen in
  Chrome on a gothic-stone room, beside gen-6 and under the finish.
- **Left as they are, and said**: on a page with no light of its own the shading channels take the polygonizer's
  default sun and a shadow the shadow's default, two directions, as minted pages have them; unifying them would move
  every such page's shadows. A water surface's own sun (`channels/surface.js`, a kind's argument a surface) is not
  the record's yet.
