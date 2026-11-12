### Skandart: debris that has a cause, laid where it would come to rest

A room gathers what has happened to it. Skandart asks a room what falls, wears off, is dropped or grows there and where
it comes to rest, and lays the answer as clumps: each built once in its own frame, stamped where the room's structure
puts it, and lit where it lies. What is too small to be read where it is seen is left out; the rest is built at the
size it would be.

- A recipe's `skandart` (`true`, a number from 0 to 1, or `{ amount }`) asks for it on a kit that answers the question
  on its card. The ashlar crypt (`gothic-ashlar`) is the first: at each wall's foot a heap a bay long, its render's
  flakes, the ashlar's spall and a fallen block, filling the gutter and spilling over its lip, the bays in the wall's
  rhythm (the full heap and the lesser one, the same heap lower with less on it); a deeper heap in each corner against
  the pilasters' feet, a block or two at its toe; the tomb's candles' wax poured on the dais and pooled at its foot; the
  webs within reach swept, those over it left. A kit that answers no debris question says so. Without the key every
  room is as it was, byte for byte.
- A heap is a body and the pieces on it. The body is the fall's fines standing at their angle of repose (rupa's `phi`:
  sand's for the fines, gravel's for loose stone), a wedge along a bay with a hip at each end or a quarter cone in a
  corner, clipped where it meets the ground so its toe runs as a contour. The pieces lie on its face, square to it and
  part buried, sorted as a fall sorts them: the bigger, the farther down, so blocks come to rest at the toe and chips up
  the face. The amount raises the body and deals the next of the same pieces: more is always the same heap with more on
  it.
- The debris shelf (`era/debris-shelf.js`): the things that pile up, one row each under the words people say, with its
  matter, its sizes, its shape and how it comes to rest (it rolls, or it lies): spall, a fallen block, brick, render
  flakes, slate, roof tile, sherd, plank, beam, splinter. Its shapes are a broken chip, a dressed block with a broken
  arris (never a box), a plate flat or bent, a length of timber broken off on the slant. A kit's card names a heap's
  pieces off the shelf; a new thing that piles is a row.
- Asked for, it replaces the crypt's gutter rubble and the fallen stone among its corner things (stones, a boulder,
  debris); every other corner thing stands where it stood (`cornerThings`' `leave`: a kind placed by the dice and not
  built).
- A new law, `too-small-to-read` (`era/laws.js`, the builder's in both eras): what is too small to be read where it is
  seen is not made, neither built nor painted in. A thing under the eye spot (12 pixels of the frame its era reads at)
  at the distance the player meets it is left out; `eyeSpot(distance, screenPx)` beside `EYE_SPOT_PX` in
  `playscape/objects/laws.js` measures it. The debris is its first reader, as filler (met at six metres): in the sixth
  generation's 640×448 a piece under about 19 cm goes, in the form render on its target's lines (1080 by default) one
  under about 8 cm. The dice fall for every piece first, so the coarser frame keeps the same heap with fewer of its
  small pieces; a flake that lay on a stone left out lies on the ground instead.
- The debris rides to the page as instanced repeats, one geometry a clump and one transform a stamp: a two-room crypt
  in the form render lays 39 heaps from 8 clumps, about 13,500 triangles in all (35 from 7, about 6,500, in the paint),
  its worst view 61,387 triangles against the room's 53,235 without it, the page no larger. Each stamp takes
  the room's light at the middle of its mass and a share of the grime of the ground it lies on (a fresh fall has not lain
  there as long as the floor), in the paint and in the form
  render; a clump is shaded only by how its faces turn up, so a stamp may turn and still be lit where it lies.
- The form render lights instanced repeats in a room under no sun when they carry their light (until now only under a
  sun). A page without them is as it was.
- The form render's bake answers the light at points that are no face of the room and the base a paint takes in it,
  when asked; asked nothing, it is as it was.
- A room's condition (`condition`, `era/condition.js`): one word for its state of repair sets its debris, its grime and
  whether anyone still sweeps, together, on a ladder: `kept`, `worn`, `neglected`, `derelict`, `ruined`, or a word for
  one ("abandoned" is derelict, "crumbling" is ruined). From neglected up nobody sweeps, so the webs within reach stay.
  A kept room is one where nothing has come down: it lays no heap and keeps none of its kit's fallen stone. A recipe's
  own `skandart` or `grime` stands over the word's. On a kit that answers no debris question the word sets the grime
  and the room says what it could not (`condition.unanswered`); every room asked in a condition says it (`condition`:
  its step, the dials it set). A room kit's card lists the word among its options, and a kit that answers the debris
  question lists `skandart` too.
