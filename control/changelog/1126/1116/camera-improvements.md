### Camera: the frame read, framing by words, the named moves, camera styles and the contact sheet

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
- **Camera styles** (`actor/camera-styles.js`, a screenplay's, a film's or a scene's `camera`): how a scene's coverage
  shoots its cuts, a card each: classical (the coverage as it was, byte for byte), verite, planimetric, still, oner,
  kinetic and observational. A card says the opening, what a line, the turn and a move are shot as, the singles' size,
  lens, angle, side and place, the least a framing holds, a reaction beat, a one-camera long take, its shake and the
  director's notes it answers by design. Its shake rides the Blender pack's and the native film's cameras.
- **The contact sheet** (`shoot/contact.js`, `motion/contact-sheet.js`, the shoot door's `contact`): each shot of a
  shoot plan at its start, middle and end, captured on the world's own page and laid a row a shot, the rule of thirds
  over each frame and the frame read under it, one PNG in the world's outcome folder. Seconds where the film takes
  minutes: what an agent looks at before it renders. The skill `/direct` is the director's loop round it: the shots in
  words, the why, the read, the sheet, three rounds of words at most, the eyes gate the person's.
- **A scene's frame and its contact sheet** (`actor/frame-read.js`; a screenplay's `shot.params.contact` with `export:
  'film'`): a scene's coverage read as a shoot plan is, its actors the subjects, rides the screenplay's answer as
  `framing` beside the director's notes; its contact sheet is the film shot in mojulo at each cut's start, middle and
  end. A style's framings are solved in the film's 16:9 frame, its singles say whom they frame, the same actor within a
  size is no cut, a two-shot is framed in words, and a long take's glides are read as on their way.
