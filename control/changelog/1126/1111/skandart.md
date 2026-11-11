### Skandart: debris that has a cause, laid where it would come to rest

A room gathers what has happened to it. Skandart asks a room what falls, wears off, is dropped or grows there and where
it comes to rest, and lays the answer as clumps: each built once in its own frame, stamped where the room's structure
puts it, and lit where it lies. Smaller than a hand, debris is relief in the floor's tile and is never built; bigger, it
is built at the size it would be.

- A recipe's `skandart` (`true`, a number from 0 to 1, or `{ amount }`) asks for it on a kit that answers the question
  on its card. The ashlar crypt (`gothic-ashlar`) is the first: flakes of its render and spall of the ashlar behind it in
  the gutter at each wall's foot, a strip a bay in the wall's rhythm (the full strip and the lesser one, the same strip
  with less on it); spall heaped in the corners against the pilasters' feet; the tomb's candles' wax poured on the dais
  and pooled at its foot; the webs within reach swept, those over it left. A kit that answers no debris question says
  so. Without the key every room is as it was, byte for byte.
- Asked for, it replaces the crypt's gutter rubble and the fallen stone among its corner things (stones, a boulder,
  debris); every other corner thing stands where it stood (`cornerThings`' `leave`: a kind placed by the dice and not
  built).
- The debris rides to the page as instanced repeats, one geometry a clump and one transform a stamp: a two-room crypt
  lays 39 clumps from 8 of them, about 7,700 triangles in all, a few thousand of them in any one view. Each stamp takes
  the room's light at the middle of its mass and the grime of the ground it lies on, in the paint and in the form
  render; a clump is shaded only by how its faces turn up, so a stamp may turn and still be lit where it lies.
- The form render lights instanced repeats in a room under no sun when they carry their light (until now only under a
  sun). A page without them is as it was.
- The form render's bake answers the light at points that are no face of the room and the base a paint takes in it,
  when asked; asked nothing, it is as it was.
