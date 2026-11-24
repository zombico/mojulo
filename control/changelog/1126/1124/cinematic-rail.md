### Lost Nomad: the cinematic action rail, its set pieces directed in play

- **In progress.** A rail for the cinematic action game, after Uncharted as Steel Serpents is after Metal Gear: a
  realistic-register Silk Road adventure. Tariq, son of Middle Eastern diplomats raised partly in London, follows a
  family member's final request through a fictional Levantine country and is caught between a rogue Taliban cell and
  ex-Russian special forces. The template is never the game: a person starts a cinematic action game of their own
  from it.
- **Steel Serpents is pure stealth again.** Its genres are the stealth and espionage cubes; the cinematic action core
  and its adventure are Lost Nomad's (gameworld/rails.js), with a feel of its own (feel/cards.js `lost-nomad`: a looser,
  quicker realistic than Steel Serpents', a longer jump and the sprint a chase's pace).
- **The chase line** (`worlds/controllable/chase-line.js`, a world's `chase: { lines: [{ id, path, half?, when? }] }`): a
  set piece's way through a level. While it holds the hero the stick is read along it, never the camera: up runs down
  the line whichever way the camera faces, so a directed camera can swing round in front of the hero without the
  controls turning with it. A soft wall keeps the hero inside its corridor; the line takes them as they enter it (or by
  name, `when: 'cue'`), lets them go at its end, and the bus hears `chase:<id>:start` and `chase:<id>:end`.
- **The track camera** (the camera rule `track`: `{ target, path, keys: [{ s, frame, cut?, blend?, fov?, shake? }] }`):
  the camera directed by where the hero is along the line, while the player keeps the stick. A key's frame is a place
  round the hero in the line's own frame: `lead` ahead of them looking back at them and what chases them, `chase` low
  behind, `profile` beside, `wide`, `low`, `over`, `overhead`, `close`, each a set of dials a key may override. Between
  keys the camera swings round the hero (never through them) over the `blend` metres before the next; a `cut` key cuts.
  Its heading eases round the line's corners; a key's field of view and shake are laid on the page. The follow camera's
  wall pull-in keeps a wall from hiding the hero.
- **The quick-time prompt** (`worlds/controllable/prompt.js`, a world's `prompts`; a cue's `{ prompt: id }`): a beat the
  stick cannot do, asked as one button in a window. A press, a mash, a hold, or the stick pushed toward a mark. Held to
  its laws as it is read: told (shown at least 0.35 s before it opens), fair (open at least 0.4 s, on the screen's
  clock however slow the world), one button, and a miss that says its cost (back to the checkpoint, a hurt, or play
  goes on). It may slow the world while it waits; its button does only this while it is up; the bus hears
  `prompt:<id>:up | hit | miss`. Drawn on mana-ui (`scene/channels/prompt-mana.js`): the button as the device draws it
  in the middle of the screen, its word under it, a ring round it that closes as the window runs out, a flash on a hit
  and a shake on a miss.
- **The set piece** (`gameworld/set-piece.js`): an insane run or stunt as one recipe (its line, its camera keys, its
  beats and its prompts), lowered onto the chase line, its track camera, the prompts and the level's cues. A beat is a
  cue on a mark along the line, its effects the world's own verbs; a prompt's miss puts the hero back on the line a few
  metres before it. Its laws advise: on the line, directed (keyed from the start, in more than one frame), few (a prompt
  each 15 m at most) and readable (each prompt over before the next comes at the hero's pace). The principles:
  `docs/set-pieces.md`.
- **The stunt room** (`gameworld/stunt-room.js`, the practice door's `stunt` for a world on Lost Nomad's feel): one set
  piece on greybox rooftops. A run east under a camera that goes from low behind to ahead looking back, a gap jumped on
  a low cut onto a roof whose edge gives (a slowed Grab), a blast and a shake on a wide frame, a turn north beside the
  hero, a drop onto a lower roof and its lip climbed (a mashed Climb). Played in headless Chrome by a bot: cleared on the
  windows' middles, put back by a late press. Not yet: a designed game's level does not take a set piece, a collapse
  needs breakable blocks the room does not lay, and nothing chases the hero yet.
- **The registry**: the track camera (`space.camera=track`), the set piece (`space.levelDesign=set-piece`) and the
  prompt (`power.mechanics=prompt`) are built; the cinematic action probe asks for the set piece and the prompt.
