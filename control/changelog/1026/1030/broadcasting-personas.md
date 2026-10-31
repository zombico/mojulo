### Broadcasting personas: the realistic head reads a script, for games

- **A persona reads a script in a delivery register** (`control/lib/graph/persona/`). A register is a card, as an emote
  is: its pace and articulation, the gaps it breathes in, the words it stresses (names, numbers, by how many a
  sentence), where it looks (the lens, its notes), its resting face and the body's gestures for its stresses, its
  asides and its close. `readScript` compiles plain text (`*stress*`, `[pause]`, `[pause 1.5]`, `(aside)`, a blank line
  a new paragraph) into the face's beats (perform.js), the lines and their words timed on one clock, captions (SRT,
  VTT) and a body track; the same script in the same register is the same read. First registers: `anchor`, `briefing`,
  `speech`, `documentary`, `play-by-play`.
- **The face is gen-7's** (`speakerFidelity`): a talking face only where a game reads in the `gen-7` era and the speaker
  is a realistic hero; anywhere else the same read gives its audio, its captions and the body's gestures.
- **A persona is a record of its own**: `create_character({ as: 'persona', spec: { hero, voice?, register?, reads } })`
  mints kind `persona`, pointing at a hero (its body and face) and a voice register, keeping the scripts it reads by id;
  every read regenerates from its script. The door answers each read in short (its seconds, lines, words, the words it
  stressed, its captions and gestures) and where its face is drawn. `update_character` merges its reads by id (null
  removes one), checks the record whole and its refs before storing, and keeps what it replaced as a revision. A
  persona is turned and exported as its hero (the object shelf): its World and its GLB play the hero, its reads the
  realistic face's `face:<id>` clips; `export_model` writes each read's captions (`captions/<id>.srt`, `.vtt`) and
  cue sheet (`cues/<id>.json`: lines, words, stresses, gaze, gestures, the clip it rides) beside the model. Manual:
  `get_solid_vocab({ id: 'persona' })`; routing card `persona`.
- **The first host: a news broadcast on a screen in a world.** A world's `broadcasts` key (`[{ persona, read, at, yaw?,
  size?, title?, strap?, package?, loop?, gap? }]`, `persona/screen.js`) stands screens in it, each playing one read on
  a loop on the read's own clock: the set in a broadcast package's glass, the channel's bug, the reader as the body
  plays the read (a nod, a point, a bow on its gestures, its mouth on its words), the lower third and the captions
  (`scene/channels/broadcast-screen.js`, an appended page row: zero bytes when absent). The page draws no talking face
  yet; each screen records the fidelity its world's era gives it. Godot and Roblox mark it absent (the persona's export
  carries the face clips, captions and cue sheets).
