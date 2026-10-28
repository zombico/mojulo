### The gloss wheel: painted with the sixth generation's cheats, lit by the seventh's

The cartoon racer's wheel was a faceted drum with a flat disc on it. On the gloss finish it is now turned on a lathe,
decorated the way the late sixth generation painted its light, and lit, in the form render, the way the seventh does.

- **Turned** (`era/blocks.js`, the opt-in `lathe`):
  - **The rim.** A running drum (a wheel's rim, its cap, its hub) is a deep dish, not a flat drum: from the barrel to a
    raised lip, a step down into a dish a quarter of its length deep, a boss rising at its middle. Every wheel design
    takes it: the slick's bar, the disc's stripe, the star's five spokes, the chunky's cross and the wire's six spokes
    now stand over a dish or round a polished hub.
  - **The tyre's decals.** Tread blocks two facets long, staggered row to row, across the crown and the shoulders, and
    a stripe round each sidewall, tagged as decals (`decal`) for the finish to paint.
  - Within the wheel's own radius and width (the true round, where the prism was a polygon inside it).
- **Decorated: the sixth generation's cheats** (`car-designer/racer-shade.js` `bakeWheel`):
  - The character bake stack's painted light (`polygonizer/surface-bake.js` `bakeChannels`): each corner darkened by
    occlusion (the bead in the rim, the dish under its lip, the spokes' roots) and lifted at an edge (the lip's rim, a
    tread block's shoulder).
  - Only the channels a turning wheel keeps: a sky band, a height or a rise would turn with it, so the bake is the same
    at any turn of the wheel.
  - The decals paint in the machine's own palette: the tread blocks its tyre a stop down, the sidewall stripe its trim
    (a whitewall on a light trim), the lip and the boss polished.
- **Lit: the seventh generation's capabilities.**
  - The decals are material slots of their own (`KART_MATERIALS`): the tread rougher than the rubber it stands in, and
    the lip and boss chrome (metal, polished), reflecting the world's sky in the form render.
  - Each corner's painted albedo rides into the form (`packFormMesh` reads a face's `cornerAlbedo`), so the decoration
    is painted and the light is the renderer's.
  - In the paint render (`light: 'paint'`) the same decoration is baked under the racer's toon light.
- **Held** (`race-machines.test.js`):
  - the lathed tyre and rim within the wheel's round and width, their decals tagged, the dish's lip, dish and boss;
  - the decals' slots and materials;
  - every gloss wheel corner's albedo painted, and the bake the same within 3 levels in 255 a third of a turn on;
  - a corner's albedo carried into the form.
  - The gloss finish alone changed: a smooth or cel racer, and every other block, as it was.
  - Seen in machine screenshots: every wheel design up close, cel against gloss painted and gloss lit. The eyes gate is
    open.
- **Not built, said:**
  - Tread as geometry (the blocks are paint).
  - Lettering on the sidewall.
  - The chunky tyre's facets: on the lathe it is round, its tread blocks the chunk.
