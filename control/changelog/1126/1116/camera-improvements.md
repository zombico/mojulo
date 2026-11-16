### Camera: the frame read, framing by words and the named moves

- **The frame read** (`shoot/frame.js`): what each shot of a shoot plan frames, in a cinematographer's words: the
  subject it is about, its shot size by where the frame cuts the figure (extreme close-up to extreme wide, a row each in
  `SIZES`), its headroom, its eyes against the upper third, its lead room against the way it faces, and at each cut a
  jump cut (the same subject within 30° and one size) or a mover's screen direction flipping. The shoot door answers
  with it as `composition`, advice with a fix, never a refusal.
- **Framing by words** (`shoot/framing.js`, the shoot op `frame`): a camera placed from `size`, `angle`, `side`,
  `place`, `lens` and `dutch` on a subject, riding it when it moves; the frame read of the key gives back the words.
- **Named moves** (`shoot/moves.js`, the shoot op `move`, a key's `move`): push in and pull out, the dolly zoom, the
  arc, the crane up and down, the tracking shot (a truck on a still point), the whip pan and the crash zoom, each laid
  as keys framed in words on its subject, so a move on a walker rides it and reads back as its sizes. Framing from
  where a camera stands (`solveFromStand`): a pan and a zoom, the lens the distance asks for.
- **Shake** (`shoot/shake.js`, a camera's `shake`): handheld, steadicam, run and rumble, a style a row, seeded and
  laid over the keyed path by the sampler, so the render, the page's track and the Blender frames shake alike.
