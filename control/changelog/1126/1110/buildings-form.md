### Buildings as material: a town's and a city's walls in the form render

- **A town's tiles are material.** A detail tile (`matte-paint/detail.js`: a wall or a roof dressed by a word, a land's
  rock) is read by the form render from the dressed cut it was painted from (`form/room-form.js` `formMaterialOf`: its
  normal, its occlusion, roughness and height, by its own metres), where it was read back from its paint's light as any
  stock tile is. A room that wears one draws its true relief; a bonded-brick floor's detail is read from its paint as
  before.
- **The sun as a baked light** (`form/sun-light.js` `sunLitFaces`; nothing reads it yet). A building's faces baked as
  a room's are, their colour and their light apart, under the light a cube solves in the place of lamps: each corner
  its base (its paint's colour shown square to the sun under the whole sky, the land's own reference, over the light
  there) and the light the day lays on it, the sky by how much of it the face sees, what the ground throws back onto a
  face turned down, and the sun by its cosine where a shadow test says the sun reaches the corner; beside it the share
  of that light the sun gives, by which a live shadow darkens it.
- **A town's buildings are drawn as form** (a geotown read in gen-7, by day; gen-6, a town at night, and the engine
  handoff's read are as they were). Its buildings, its street's furniture and its paved ground (the `town:` and
  `geotown:` faces) carry their paint as it shows lit, never darkened by their turn to the sun, and are baked with
  their colour and their light apart (`geotown/scene.js`, `form/sun-light.js`): the sun's shadow is tested against the
  town itself, so an eave shades its wall and a house the one beside it, which the paint never drew; a wall in shade
  takes the sky and what the town's paving throws back. The page's form channel draws them (`scene/channels/form.js`,
  the payload's `form.town`): the sun is its one lamp, set far off along its way, and lights the tiles' relief and
  sheen near the eye only by the share of the bake the sun gave, so nothing shines in a baked shadow. They are toned
  with the land. A live shadow darkens a face by its sun share, so a tree no longer shades a wall the sun does not
  reach. A detail tile's material keeps the colour the page already draws (set to the detail's mean), its hue the
  face's. A room's page is byte for byte as it was. Seen in Chrome on an island-noon town, beside gen-6 and the
  gen-7 read before it.
- **A town's first read in gen-7 is quicker, and its relief whole.** A detail tile's material brings no colour of its
  own (the page's tile stays, never painted a second time), and a town's maps are read once at full size, with no
  byte budget and so no second, smaller read of every tile: an island-noon town resolves in about a minute where the
  first cut took a minute and three quarters (a little over half a minute before its buildings were form; what is
  left is the tiles' relief being painted, once a process). Its page grows by the maps (49 MB against 30).
- **Buildings and land shade each other.** Measured on the page: every `town:` and `geotown:` mesh casts into the
  land's sun map, so a house's shadow lies on the grass; a paved face takes a tree's by the live light, by its sun
  share.
- **A patch of grass ends on a ragged edge, not on squares** (every gen-7 land). The far blanket (the grass drawn in
  the ground past the blades' reach, `scene/channels/far-field.js`) read the ground map a cell at a time, so from
  above a lawn's edge and a bare patch's were stair steps half a metre wide; the cell is now found at a place that
  sways and scatters in a fine grain (`FAR_FIELD.edge`), and the blades themselves read their cover between the map's
  cells along a wandering line (`scene/channels/form-grass.js` `GRASS_EDGE`), thinning out toward it. Inside a patch
  nothing changes.

