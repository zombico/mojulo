### A course's walls and its backdrop, designed with the way and the asks as one dress

In progress. A rolled course's dress (`gameworld/course-dress.js`) gains its two outer layers, so the whole screen is
one design: the way and its asks (as before), the WALLS beside it, and the BACKDROP behind its far end.

- The walls (`gameworld/course-scenery.js`): the flanks beyond each kerb, laid a slice a segment. A slice is data: boxes
  in the slice's own measure (along it, off the kerb, up), each in a role of the dress. Two kinds a course: A, the
  complex one, and B, the plain one, ordered along each side by the walls' rule (never three alike, never a pair
  repeated), the two sides differently. The rail yard's: a goods shed, a fence before an embankment, stacked
  containers. A slice may be named or written in place.
- The backdrop: the sky from its horizon to its zenith, a far skyline of silhouettes, and the land beyond the way. It
  stands far past the course's end, so it stays in the top third from the first step to the last.
- New roles in a dress: flank, flank2, trim (the walls), land, far, horizon (the backdrop).
- One gate across every layer (machine; it advises): the asks are read against the walls and the backdrop as against
  the way; nothing in either is as vivid as an ask; `receding` (the further a layer, the nearer the sky: the skyline
  nearer the horizon's colour than the walls are); `interest` (A is the more complex slice); `rhythm` (each side
  keeps the walls' rule, and the sides differ); `banded` (the skyline is seen at the start and still inside the top
  third at the end).
- A level's `obstacles.dress` is a theme's name or the dress written out: `{ theme?, palette?: { <role>: '#hex' },
  walls?: { a?, b?, order? }, backdrop?: { skyline?, bands? } }`, each part falling back to the theme's.
- The course sheet (`gameworld/course-sheet.js`): the design book's page where the layers are seen together without
  running the game. The screen as the course's camera frames it, drawn from the course's own faces, with its thirds
  ruled across it; each slice in elevation; the palette by layer; every law. Served at
  `bible?book=practice&room=roll&view=sheet`, for a level by `&level=<id>`.
- The design loop: `design_game`'s readout carries the dress's laws for each course level; the roll room wears the
  first course level's dress; the agent's card (`gameworld-course-dress`) says the layers, the words, the laws and
  who works which, read by the world's and the levels' chapters.
- A dress has a PREMISE: one sentence every thing on the screen answers to, and what each thing is in it. A dress of
  parts chosen role by role (a brick wall across a track, a shed whose door opens onto the rails, a skyline that
  could be anywhere) does not cohere, however well each part reads. New law `premise`: the theme states one and names
  its lanes, its asks, their tells, its walls, its backdrop and its end; a slice or a backdrop written in place
  carries its own name. The rail yard, which has none, now loses that law and says so.
- Last train (`last-train`, now the dress unsaid): a kid late for the last train home runs down the tracks into the
  terminus at dusk. The three lanes are three running tracks. A hurdle is a striped crossing barrier, a block a row of
  crates, posts two wagons stabled on two of the three tracks (the open lane is the clear track). A jump's window is
  hazard hatching between two lines; posts' arrows gain a lit indicator on each kerb where the change must begin. The
  walls are a station platform under an iron canopy (A) and the brick cutting between stations (B). The backdrop is
  the city, the terminus's roof and its lit clock where the tracks meet the horizon. The end is a signal gantry
  showing clear over every track, buffer stops, and the train with its doors open. Brick for what is built into the
  ground, iron for what stands on it, lamplight the one accent (new roles `iron`, `lamp`).
- What a thing is drawn as (`gameworld/course-things.js`) is drawing over the box the course was measured with: one
  box a thing, one collider, its tell where it was sized. A themed ask is a single box (the plain themes' asks stay
  walls laid in courses). A thing the theme draws longer than the ask was measured with (a wagon, 3.2 m) is met all
  along it, and each segment grows by as much, so the rest after it is still the rest: found by the reaction bot,
  which a slow hero's 7 m segments failed on 10 seeds of 12 before it.
- A skyline silhouette may be a light (`role: 'lamp'`): set near the top of the silhouette it stands on.
- The course sheet opens with the premise and what each thing is in it.
- Last train, three things seen on the game's page and put right. The crates read as crates: each a framed panel
  with a brace, every other one a shade deeper, wide gaps between. The end is seen from the start: a train shed over
  the end of the line, its ribs taller than anything on the way and a lit departure board under the first. The top
  of a tall frame is not the far sky alone: the overhead line (a theme's `overhead: 'line'`), a portal at every
  slice's end and a wire over each outer track, running to the vanishing point, all of it over any jump.
- Last train's palette, again, for contrast and colour: an indigo sky over a rose horizon, violet ballast, red brick,
  near-black iron, and brighter asks (amber, orange, a stronger blue). Every colour of the way is now about as rich
  as the gate's `quiet` lets it be beside asks this bright (the way's chroma was near grey before); the values are
  spread to the dark side, since anything on the way as light as an ask stops the ask being read. Holds every law on
  200 seeds' shades.
- The test game asks for its juice and its grade (`juice: 'auto'`, `grade: 'auto'`, the world's own words): the
  effects' floor in its register (anime) and its game type's movement juice (pinball: a trail at the feet past
  running pace, the air streaking by near top speed, speed lines on a surge), and the frame graded vivid.
- Last train in daylight. The look was too much a diagram of a runner: flat boxes, paint that explains, a dark
  scene, a small hero. Against what works in this kind of game it is now late afternoon with the sun low ahead: pale
  ballast, dark soot-brick stations with cream stone and green ironwork, a gold horizon under a soft blue sky, and
  the asks read ON a light way by their colour and their shadow (an orange-red to go over, a blue to go round), where
  before the way was kept darker than the asks. The gate is unchanged and holds on 200 seeds' shades.
- Three tones and a shadow (a theme's `sun: 'ahead'`): every box of the walls is lit on top, as it is toward the way
  and in shade toward the runner; an ask's top is lit and its face shaded, and it throws its shadow toward the runner
  as long as it is tall; each overhead beam lays a bar of shadow across the way, a segment apart.
- A jump's tell may be its window's two lines alone (`edges`): the coins say the rest.
- THE COINS (`gameworld/roll-course.js`, a platformer's `coins`): five with each ask, laid only where that ask
  stands. Over a jump an arc in the middle track from where the jump is pressed to where it lands; beside wagons a
  line down the clear track. They trace the way through and are what a map is scored by.
- A roll's `with` (`game/roll.js`, the runtime's roll): `{ '<pickup id>': '<block id>' }`, a pickup that lies only
  where that rolled block stands. No dice of its own, so every pick a roll made before is the pick it makes now. A
  roll may name a coin as it names a collect's pickup.
- A course's camera stands nearer (`course-view.js` `COURSE_NEAR`) and a tall frame uses a longer lens
  (`COURSE_TALL_FOV`, 32 degrees across): the hero is about a fifth of a phone's height, where it was a ninth, with
  the three bands where they were.
- The sky is mixed straight through OKLab: a gold horizon under a blue sky passes through cream, not green.
