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
