### Skandart: debris that has a cause, laid where it would come to rest

A room gathers what has happened to it. Skandart asks a room what falls, wears off, is dropped or grows there and where
it comes to rest, and lays the answer as clumps: each built once in its own frame, stamped where the room's structure
puts it, and lit where it lies. What is too small to be read where it is seen is left out; the rest is built at the
size it would be.

- A recipe's `skandart` (`true`, a number from 0 to 1, or `{ amount }`) asks for it on a kit that answers the question
  on its card. The ashlar crypt (`gothic-ashlar`) is the first: flakes of its render and spall of the ashlar behind it in
  the gutter at each wall's foot, a strip a bay in the wall's rhythm (the full strip and the lesser one, the same strip
  with less on it); spall heaped in the corners against the pilasters' feet; the tomb's candles' wax poured on the dais
  and pooled at its foot; the webs within reach swept, those over it left. A kit that answers no debris question says
  so. Without the key every room is as it was, byte for byte.
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
  in the form render lays 39 clumps from 8 of them, about 6,900 triangles in all (35 from 7, about 3,000, in the
  paint), a few thousand of them in any one view. Each stamp takes
  the room's light at the middle of its mass and the grime of the ground it lies on, in the paint and in the form
  render; a clump is shaded only by how its faces turn up, so a stamp may turn and still be lit where it lies.
- The form render lights instanced repeats in a room under no sun when they carry their light (until now only under a
  sun). A page without them is as it was.
- The form render's bake answers the light at points that are no face of the room and the base a paint takes in it,
  when asked; asked nothing, it is as it was.
