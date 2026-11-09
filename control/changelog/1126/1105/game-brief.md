### The Game Brief: what the game is about, ordered as maps and set pieces, joined as a mandala

- **A game-motif-narrative above the genre.** The genre says how a moment plays; `gameBrief.gmn` says what the game is
  about, as a mix of MOTIVATIONS (the why: stakes, ending, the acts, the cast's relations, the palette's arc and the light
  act by act) and LABOURS (the how: the world's shape, its climax, what a beat is played as, its side content, the genres it
  suits), each a row (gameworld/gmn.js). The mix is read once at authoring and stored: the largest labour decides the
  structure, the others at a tenth or more bring their side content; the largest motivation decides the stakes and the
  colour script, the others add cast and flags; less is said and dropped.
- **The brief orders the game's key places.** With a labour said, it lays its orders for the scene composer, each with
  the colour theorist's notes (how far along the script, its light): the first level, which sets the tone, and the climax,
  a citadel or the labour's own set piece; a hub's home where its shape has one. A list already there is the operator's;
  `orders: 'reroll'` lays them again.
- **A pillar, in conversation.** The brief is the intent chapter's: its mix and orders are in the part the creator
  accepts, so a change sends it back. The pitch stays in `brief`, the creator's words. The readout says what it decided and
  offers the main quest's spine and the labours' genres, never writing either (`gameworld-brief`, the asks in order).
- **The megaworld: maps joined as a topology, the loaded map the current map.** `megaworld: { shape, rings, gates? }`
  (gameworld/megaworld.js) writes a game's zones in rings (a mandala's last its core, a chain's one a ring, a hub's home
  alone in the first, an open world's one ring, each zone joined to its neighbours), lowered at authoring into the links a
  map world already walks, its laws WCD's at the world's scale. A glyph map is a zone: its ends carry its ways, and one with
  no way on keeps its goal, reaching it the level's win; a mandala's core is the game's final level.
- **The current map.** A megaworld's store keeps where the player is (`atlas`, a flags slice), so a save resumes on the map
  it left, arrived at by the way it was come in by. Leaving a map by a way is travel and completes nothing; a zone is found
  by having been next to it. What is won stays won, the world's flags carried from map to map. The shell's home is a travel
  screen, the zones on their rings, the core at the centre, a found one travelled to by a touch.
- **A door carries the store as it stands.** A door handed the next level the session's starting params; what was gathered
  before it reached the store but not the level on the other side.
