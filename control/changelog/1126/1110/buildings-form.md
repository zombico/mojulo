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
