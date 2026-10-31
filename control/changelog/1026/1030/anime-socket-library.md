### The anime head's socket library: the eye socket drawn with the brow and the lid

Each brow drawing carries its own eye socket, a base table for every anime head: animating the brows animates the
socket for that frame, since the socket is part of the drawing's build and so of its 7G target, and snaps with it. Hero
laws 20: a row minted before keeps the drawings it had. The eyes gate is the operator's.

- **The socket word** (`anime-form.js` drawing word `socket`): `ridge` (the brow's ridge over the eye forward, back when
  negative), `deep` (the socket's upper plane deeper or shallower), `pinch` (its inner end bunched toward the nose, a
  scowl, or eased back, worry), `outer` (its outer end hooded or lifted). Above the top of the widest lid's lash band
  only, so the eye, its lenses and its lash band never move; ramped in to the bottom of the brow as drawn, so the brow
  block moves whole and the strip under it is the ridge's overhang; faded out to the temple and above the brow.
- **The base table** (`anime-sockets.js` `SOCKETS`, tuned in clay on Shonen High's pair): raised, the ridge back and the
  socket shallow and open; low, the ridge forward and the outer end hooded; angry, the ridge forward, the socket deeper
  and its inner end bunched; worried, the inner end eased and the outer end hooded. The rest brow keeps the head's own
  socket. Its ranges are the drawing word's, so the head refuses what the table may not hold.
- **The rig** (`anime-face-rig.js`): under laws 20 each brow drawing's target and its correctives (over each lid, over
  the shut eye) are built with its socket, so a drawn face is still the exact sum of its drawings; the lid, gaze and
  mouth targets are unchanged. The targets are cached per socket reading, so a laws-19 row never shares them.
- **Hero laws 20** (`hero-form.js`): the anime head's form under it reads the table; laws 1 to 19 draw every brow over
  the head's one socket, its rim only tied to the brow's middle.
- **Tried and set aside**: easing the ridge in up to the brow's middle (to soften the overhang) left a lowered brow's
  bottom row behind its top and tipped the brow forward like a visor; the brow sits just over the lash band (its
  clearance of the eye), so the ease ends at the drawn brow's bottom instead.
- **Held** (`anime-sockets.test.js`): the table in range; read under laws 20 on the form only; nothing at its neutral;
  the eye never moved; the brow block moved whole; its clearance of the eye never less; the rig's brow targets carry it,
  its lid targets unchanged. The deep sweep builds every socketed brow drawing, every socket word at both ends of its
  range, and every brow over every lid on every cast with its socket and without.
- **The lid family: the squint and the smiling eye.** Two new lid drawings, each on an open eye: `lids.squint` (both
  lids drawn in, the upper lowered and the lower raised) and `lids.smile` (the lower lid pushed up into a half-moon,
  most at its middle, the upper a little lowered). New lid words for them (`low`: the upper lid lowered whole; `lower`:
  the lower lid raised whole; `smile`: the lower lid raised most at its middle, never above a quarter of its height at
  rest, past which its curve grew too steep for the iris's clip), the lenses sized by the lids at rest so a drawing
  never resizes them. Their socket is the new word `cheek`: the cheek under the eye pushed up into it, below the eye's
  lower outline at rest only, over the eye's own span, so the white, the lenses, the lid band's tail and the lashes
  never move with it. The rig merges a brow's socket and a lid's (their words disjoint), so a scowl over smiling eyes is
  still the exact sum of its drawings.
- **The reading** (`face-acting/anime-read.js`): the cheek raised (AU6) is drawn as the smiling eye and the lid tightened
  without it (AU7) as the squint, where the squint drew the angry lid and both only closed the eye a little; while one
  of them is drawn, the eye's closure is the blink's alone (a partial closure would snap the eye to a knot and drop the
  lid's shape). Happiness now reads with smiling eyes.
- **Seen in clay**: the squint narrows the opening by about a third from both lids, the smile by about a quarter from
  below; the cheek rises softly under the eye with no edge to it. Where the raised lower lid crops the iris, the clay
  shows the iris's cut edge in a slight relief (the lower lid has no band over it, as the upper has); in colour it
  reads as the lid cropping the iris.
- **hero-live's held shots**: a hold now replaces every morph weight and a shot without one releases it; before, holds
  stacked (each shot kept the last shot's weights), so a sheet's later rows showed the earlier drawings too.
- **The skull's mass slid: the orbit squeezed** (sampled on the squint first, before the other drawings take it): the
  socket word `rise` slides the mass over the eye, the brow's ridge and the forehead, up or down along the face, the
  skull's shape terms there read from that far below or above (from the top of the widest lid's lash band, eased in to
  the drawn brow's bottom, up through the forehead, gone before the side seam). The squint's socket slides it down onto
  the eye beside its cheek pushed up: the skin at the brow comes forward and the forehead above it goes back. The eye,
  its lenses and lash bands and the socket's cut keep their place. A word both of two drawings name adds when they are
  drawn together.
- **The brows with it**: the brow block rides the slid mass too, brought down onto the squinting lid, so the orbit
  squeezes at the brow as well as round the eye (on Shonen High's male about 4 mm, its rim following it). A drawing
  that slides the brow clears the lid as it draws it, not the widest lid any drawing draws (principle 1's one
  exception): the brow still never covers the eye (at the strong slide, 0.6 mm over the squinting lid at its least),
  and the rig's correctives keep a scowl over a squint the exact sum of its drawings.
  Tried and set aside: a matching slide of the cheekbone's mass up toward the eye, which moved nothing where a style's
  cheek is flat under the eye (Shonen High's); the cheek's push forward carries the squeeze's lower half instead.
