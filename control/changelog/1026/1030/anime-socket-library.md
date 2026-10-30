### The anime head's socket library: the eye socket drawn with the brow

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
