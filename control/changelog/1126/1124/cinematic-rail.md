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
  windows' middles, put back by a late press. Not yet: a collapse in the room (it lays no breakable things).
- **A designed game's level takes a set piece** (`levels.<id>.setPiece`, read with the world): laid on its first
  stage, its line, camera, prompts, moments, pursuers and cues added to the level and the rest of it byte for byte as it
  was.
- **Pursuers on the line** (a line's or a set piece's `pursuers`): bodies that run the line behind the hero, held at
  their gap behind a hero who runs faster than their pace and closing on one who slows; within reach the hero is caught
  and put back down the line (`chase:<id>:caught`). The stunt room's two show in its lead frame, over the hero's
  shoulder.
- **The registry**: the track camera (`space.camera=track`), the set piece (`space.levelDesign=set-piece`) and the
  prompt (`power.mechanics=prompt`) are built; the cinematic action probe asks for the set piece and the prompt.
- **Tariq, the template's star** (`gameworld/lost-nomad.js` `TARIQ`, in the hero door's words): a Levantine man in his
  thirties on the realistic body (the face's Levantine ancestry, a strong chin and stubble), in the basic adventurer's
  clothes: a henley with its sleeves pushed up, straight jeans, work boots, a belt and a pouch on the thigh for the
  holster; the free runner's motion. The stunt room stands him where the world has no hero of its own.
- **Set pieces said in words** (`gameworld/set-piece-kinds.js`): a kind is a card that lays its own site (greybox blocks
  at any height, some of them breakable) and its set piece from a few words. `rooftop-run` (the stunt room's, now laid
  from it), `collapse` (down a roof street while the tower beside it comes down a course at a time, a last jump caught)
  and `climb` (up a sheer face by its stones, over its lip onto a ledge that gives, a reach across). A new kind is a
  row.
- **A level's own breakable blocks** (`world-scene.js`, a manifest's `breakables`): a set piece's site carries the
  blocks a beat brings down, their pieces cut by the page. Absent, every byte as it was.
- **A level that is a set piece** (a designed level's `stunt: { kind, …words }`, `stunt-room.js` `stuntLevel`): staged
  and ordered as the kitchen level is, its kind on its own site, the star on it, the level won as its line ends.
- **The template movie** (`lost-nomad.js` `lostNomadWorld`, laid by a locked pitch on the rail, `pitch-start.js`): three
  set-piece levels in order (the souk rooftops, the fall of the tower, the cliffs), Tariq its hero, his looks the hero
  page's fragments composing into his spec. Played end to end in headless Chrome by a bot: each level ordered from the
  template, run to its end, every prompt answered, won.
- **A fall from the line's course** (`chase-line.js`): the last place the hero stood on the course is kept; dropped three
  metres below it (off a roof, into a gap, from a face), the hero is put back there, still the line's, and the bus hears
  `chase:<id>:fell`. Before, a missed gap left the hero on the street, the level's own fall put them back on it, and the
  line ran on in plan under the roofs to its end, so the level counted as won.
- **The track camera keeps a clear view** (`chase-line.js`): it never stands inside the level's blocks, and never with
  one between it and the hero. A place that is either swings round the hero (holding the swing it took last), then
  rises; none clear, it comes in short of the block. An ease that would pass through a block cuts instead. The page's
  follow-camera pull-in no longer acts on it (it cast against every mesh and pulled the camera into the hero's face).
  The `low` frame stands further out beside the hero, `over` looks lower down the way, the climb's profile stands out
  from the face.
- **The framing gate** (`set-piece-framing.test.js`): each kind's level run on the bus by a bot, every directed frame
  held to it: the camera outside every block, nothing between it and the hero, the hero in frame and neither in the lens
  nor lost in the distance.
- **The ledge** (`worlds/controllable/ledge.js`, a rule's `ledge`; `space.traversal=ledge` built, the cinematic adventure
  probe asks for it): the climber's hold. A body in the air at hand height near a lip (any block's top edge, unless a box
  stands on it or it is `hold: false`, or a hold a level lays on a face, `ledges`) catches it and hangs. The stick, read
  as the camera reads it, shimmies along it; jump leaps to the next hold up or along, else pulls up over the lip; held
  away it drops, away and jump kicks off. The bus hears `ledge:catch | pull | leap | drop`. Absent, the page emits none
  of it. A stunt level's hero has it: a short jump at the far roof is caught on its edge, and the climb's face is now
  stones a hand-hold apart, caught from a jump and leapt up, where it was the wall crawl. The framing gate and the
  played levels climb it so.
- **The ledge's poses** (`playscape/player.js` `LEDGE_CLIPS`, `ledgeStates`): a body hung from a lip by its hands, the
  arms up to it and the legs loose, swaying while it holds; the hands drawn together and spread again as it shimmies;
  the elbows driven down and a knee brought up as it pulls over. A stunt level's hero carries them; a stored hero hangs
  on its jump's flight and pulls up on its wind-up. Before, a held hang played the idle (the page plays a body's own
  clip only while it moves), so the hero stood upright against the face. The climb's first stone is raised (4.6 m over
  the approach's top, 2.6), so the feet leave the ground on the first hold.
