### Mojulo Fighter: a fight on any level, by its lane

A fight's arena is now any level that can say where its fight lane is. The lane (`versus/versus-lane.js`) is
`{ at, heading, half, floor, back? }`: where the lane's centre stands, the way it runs, its walls, its floor and the open
room on the camera's side. The fight level loader (`versus/versus-levels.js`) turns each kind of level's own words into
a world recipe and its lane, one row a kind: `stage` (the arena as it was, its recipe unchanged) and `greybox`. The
runtime draws the whole fight in the lane's frame (bodies, the ring, the fighters' lights, the camera and the overlay),
so a lane turned and off the level's centre plays as the old one did; a stored arena reads as a lane at heading 0 and
keeps its place.

- **The greybox world kind** (`level/greybox-scene.js`): `{ kind: 'greybox', blocks: [{ at, size, turn?, tone? }] }`,
  boxes shaded by value under one sun (floor, wall, prop, edge), no kit's look. A level of boxes, for blocking out.
- **Greybox fight levels**: presets that stress the lane (`flat`; `alley`, walled behind with little room for the
  camera; `rooftop`, on a raised floor; `turned`, off centre at 35°), each overridable by words.
- **A quick fight's arena may name a level**: `arenas: [{ id, level: { kind: 'greybox', preset: 'turned' } }]`; an arena
  without one is the stage as before.
