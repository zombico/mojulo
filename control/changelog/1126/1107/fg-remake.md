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
- **Attack priority** (`versus-library.js` PRIORITY): two strikes landing on the same frame, the higher level's lands and
  the other's does not (a `priority` event, PRIORITY on the overlay); equal levels trade as before. It scales with
  strength (light 1, medium 2, heavy 3, punches and kicks alike), a special's is its own (a rush 2 · 3 · 4 by strength, a
  spinning kick 2 · 2 · 3, an overhead 3, a fireball 1), a super's 4, and a reversal's (the DP, `rps: 'reversal'`, and
  the rising super) 0: its invincibility is how it wins. Any move takes `tune: { priority }` (0 to 5). Two laws keep it
  a balance: `priority-pays` (no grounded normal outranks one that starts no slower than it) and `reversal-yields` (a
  DP's priority is 0).
- **Joint limits**: a pose is held within the bends a body makes as it becomes joints (`versus-rig.js` RIG_LIMITS: a knee
  one way and not past 155°, the ankle from a pointed toe to the foot drawn up, the head 55° off the trunk, an arm no
  further than 45° behind the back), and the body in the round within its own (`versus-figure.js` FIG_LIMITS: no elbow
  past 150°, no knee past 155°, the spine twisted no further than 60°, the hips turned with the chest; a foot never folded
  up into the shin as it is drawn). A knee bends toward its own thigh's front (up when the thigh is raised),
  never sideways.
- **The body keeps out of itself** (`versus-figure.js` FIG_BULK, from the body's own skeleton): a hand, a forearm or an
  elbow that would pass into the trunk, the head, a thigh or the other arm is moved across the plane (the hand's depth,
  the elbow turned out), or the chest turned until the arm clears it (a rear straight squares the shoulders); a leg into
  the other is moved out. All in depth, so the side view, and the boxes, stay the sim's. `scripts/spikes/fighter/
  joints.mjs` reads every pose of every fighter against the limits and the bulk.
- **One look a game: the fight's register** (`register: anime | western`, stamped at mint from the setting's drawing
  tradition, western when it names none): every fighter is rolled in it and drawn its one way, under one light, on every
  arena of the game. `western` lit as an engine lights it (its albedo, relief and roughness), the shadows soft; `anime`
  cel, three tones stepped from the same light, the shadows stepped and the shade cool. The rig: a warm key from the
  camera's side and above that casts, onto the floor (a shadow catcher over the lane) and across the body itself; on a
  greybox it is the level's own sun (`GREYBOX_SUN`), so the room and the bodies share one light; a low cool fill so the
  shadows stay deep; a rim from behind; a sky over a dark ground. The key follows the fight, its shadow's box tight round
  the fighters. Every body is baked as the lit export under a register (the stick figure lit the same way). A fight minted
  before carries none and draws each body as it always did. `styles.mjs --register` bakes a matchup in either look.
- **CI**: `design-game.vary.test.js` pins its order's roll (it drew one at random each run, and about one roll in
  four hundred lifts most of a late tier's ornaments past their 0–3 scale, the gate leaving two variants of three).
