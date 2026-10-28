### Gen-7 rooms: a room's surfaces as material (continued)

The light is now solved from the room's palette and baked apart from its colour, as a seventh-generation lightmap was;
the page lights only the relief. Where the section above says the room's lights are lit live, cast from cube maps, and
measures a lit room within 1 % of its paint, read these instead:

- **Tiles carry their height**: each room tile carries its height in the ORM's blue (the island's convention), its
  relief's `depth` and its `mean` colour; a card keeps its paint and sends only its mean.
- **The light a room's palette asks for** (`form/room-light.js`, over the colour theorist's `solveLight`): what each
  surface's paint shows at arm's length from the room's median lamp is a target; the bases (each surface's colour under
  no light) and the lamps' light are solved together, as the island solves its sun for its palette. The hues are the ones
  the paint shows (it mixes its light in display units, so a torch shows far less orange than its colour decoded), and
  the contrast is the paint's, held so the lamps always shape the room. The levels are solved under a light without hue,
  so each base keeps its paint's hue, and the ambient and each lamp bring their own: a surface by a warm lamp warms and
  one in the shade cools wherever it stands, as on the paint (solving every base against the median lamp's hue left
  surfaces lit by a lamp of another colour off: a bay's ceiling under its white lamps read brown). A toned room's colour
  is its ramps' (tone.js): its targets are its ramps' colours at its key, its light neutral, its contrast its ramp's own.
- **Baked as a lightmap** (`formLightFaces`, era/stage.js): each corner carries its base under its dirt and, apart, its
  light (`cornerLight`, linear): the ambient, every placed light, brazier and pool by its solved key, its falloff and its
  cosine where its shadow test sees the corner (whatever the recipe's `shadows.torch`), and a bounce in its own room. The
  packer carries the light per vertex (`aLit`, face-mesh.js and scene-three.js; a page without it carries none of it),
  the corner's occlusion on the light, not the colour. A sunlit or night stage stays paint.
- **The page lights only the relief** (`scene/channels/form.js`): each surface's material is the paint's (three's basic
  material; no light of three's is evaluated) multiplied by its baked light, the tile divided by its mean so the base sets
  the colour. Near the eye the four lamps nearest it light the relief (the normal map against the face's own) and add a
  sheen, scaled by how lit the bake says that spot is, so nothing shines in a baked shadow; a lamp entering or leaving
  the four fades. Nearer still each tile's height is marched along the view (parallax occlusion, as the island's scree),
  so a joint sinks and a stone stands. No shadow maps: the live light keeps only what moves (the actors' contact
  shadow), and its contact occlusion is the recipe's to ask for (the bake holds the room's). A toned room's void and haze
  are its ramp's darkest colour. Tone-mapped (Neutral, exposure 1: what the solve solved for). `window.__mojForm` is the
  probe. Measured in Chrome (SwiftShader) on the gritty cube's temple hall from its mouth: a frame 1225 ms against gen-6's
  616 (the first cut, every lamp live and four casting, took 2263 against 432); without the live light's actors' map,
  879, and without relief and parallax, 595. Five rooms from each room's spawn: the brick hall's mean luminance 26.9
  against its gen-6 paint's 33.9, the rendered vault 31.8 against 38.5, the crypt 26.6 against 31.4, the nave 29.3
  against 34.3 (the lamps fall off faster in linear light than the paint's square did); the gritty cube's toned room 118
  against 184, its paint lit almost flat, and its marble's veins grey where the toned page carries them along the ramp.
- **Exports stay paint**: the engine and file exports (GLB, USDZ, 3MF, STL, OpenSCAD, the engine and Blender packs, the
  walk mesh) read with `paint: true` (`resolveWorldScene`), so a cube that names gen-7 exports its rooms as before; only a
  page draws the form render.
- **One input with the island's** (1026-gen7-island, merged): the page's `form` is `{ land, room }`, the island's land
  (`form.land`, `channels/form-land.js`) and a room (`form.room`, `channels/form.js`), each drawn by its own channel. The
  island's `ctx.form` (a builder makes more of the land for the form render: broken boulders, rims, strewn stones; every
  read) stays its own; a room's unlit corners are `ctx.formLit` (a page's read only).
- **The era marks**: `form` is the form render's own input, built in gen-7; a payload that carries it reads its faces and
  tiles as material, no longer approximated. The engine packs refuse an era, so no Godot or Roblox leg carries it (both
  mark it absent). The seventh generation's world note says what is built.
- **Rooms to walk** (`scripts/spikes/form/rooms.mjs`): a brick hall (wire-cut brick, fluted pilasters, a plinth course,
  worn floor slabs), a rendered vault, the crypt, the gritty cube's room and the nave, each written as a walkable World
  page in both eras and captured side by side, wide and close by a torch.
