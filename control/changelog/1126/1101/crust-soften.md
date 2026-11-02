### The crust softened: the impressions past the view cone's reach read as distance

- **`cone: { reach?, soften? }`** (`scene/channels/view-cone.js` `readCone`, drawn by `scene/channels/frame-pass.js`): past
  the cone's reach a gen-7 page draws impressions (a tree its card, a tile of buildings its card, the grass its colour
  speckled at a pixel's grain); `soften` spreads them by their distance past it, none at the reach and its most (`true`, a
  pixel and a half, the impressions' grain; or 0.5 to 4 css pixels) at three reaches, the sky at its most, so the far reads
  as the same world seen far off, with or without any air. A near thing never spreads onto the far behind it; nothing
  inside the reach is softened. The geotown and the micro-city take `cone` too (a geotown, drawn by the form render, was
  already on the cone at the screen's reach).
- **One frame pass** (`scene/channels/frame-pass.js`): the air's blur (`air.blur`, channels/atmosphere.js) moved into it, so
  the air and the soften share one target and one composite, each pixel taking the larger. `window.__mojFrame` is its probe
  ({ air, soften, passes, set }); `__mojAir.set({ blur })` reaches it.
- **A cavern's page draws again** (`form/land-read.js`, `scene/channels/form-land.js`): an underground trail has no sky
  colours, and the form land built its reflections' dome and the gen-7 sky from them, so every gen-7 cavern page threw
  before its view cone, its air or its soften could start. A land with no sky now carries `sky: null`: no gen-7 sky over
  it, its reflections in the rock's dark.
