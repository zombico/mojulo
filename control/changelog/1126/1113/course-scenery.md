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
