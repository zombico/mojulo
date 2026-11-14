### Game audio: the sound sheet on every level, and a score by request

- **A game on the sound sheet hears it on every level** (`gameworld/sound-sheet.js` `levelSheet`, `onSheet`). A game
  that writes a `sound` of its own, even an empty one, now gets the sheet's sounds and its stage's bed on every level
  it builds: the designed game's levels and a world walked before its people, which were built with no audio at all,
  as well as a quick game's. A quick game that names another `sfx` keeps that. A stage that wrote its own soundtrack,
  `sfx` or bed keeps each. A game with no `sound` builds the levels it built.
- **Fixed: a game's `sound` reached no level.** The world reader checked `sound` and did not carry it, so a quick
  game on the sheet played the solved sheet and ignored the game's own style, slots and cues.
- Planned, not built yet: the sheet covering the whole arsenal, guns, foes' attacks and rides; a music department
  that sets the game's audio direction (play keeps the SFX and reads it) and whose cue sheet answers each
  department's request for music (the flow's screens, the levels, the fights, the cinematics, the outcomes) on the
  game's one score identity; a title theme (the menu and the credits the same tune at another energy) and a cue
  that ends, written to a cinematic's length.
