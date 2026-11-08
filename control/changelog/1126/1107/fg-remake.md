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
- **The anime register in the fight**: a character drawn in the character light (the anime head's) is played in it.
  Its tones are the light's own (each group's shade swatch, the eyes unlit as drawn), baked twice, every group lit and
  every group in shade, and the arena steps between them by its own key as the body turns, so both fighters are lit
  from the camera's side whichever way they face. No outline is drawn on them. Every other body is lit as before.
- **The training ground** (`greybox` preset `training`): a fight's graybox stage, its middle the focus. Between its
  walls the floor is the light tone, ruled a line every metre (every fifth lighter), the centre a bold band on the floor
  and up the back wall; past the walls the floor falls dark and unruled. A wall stands at each of the lane's ends, a
  body's width past the sim's, banded light up its front edge, along its foot and on the floor where it stands, so
  where it is reads from the camera. The camera is near. A fight made now is fought there, stamped at mint
  (`arenas: [{ id: 'training', level: { kind: 'greybox', preset: 'training' } }]`) when it names no arenas; a fight
  minted before keeps the ring, the plaza and the nave.
- **A level's view**: a greybox level's `view` (`genre` | `near`, its preset's by default) says how near the camera
  frames the fight; `near` is the ring's framing (a fighter near two thirds of the picture), now any level's.
- **CI**: `design-game.vary.test.js` pins its order's roll (it drew one at random each run, and about one roll in
  four hundred lifts most of a late tier's ornaments past their 0–3 scale, the gate leaving two variants of three).
