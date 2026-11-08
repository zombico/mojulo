### Level design, its own department: the play layer a block at a time

- **The play layer.** A planned map's level takes `play: { <segment>: { pieces, suggestions? } }`: what level design
  places on a block to make its walk interesting, saved in pure vector space (a point in world metres and a yaw), so a
  terrain rebuilt under it never loses a piece. A piece is a foe (of the bestiary), an obstacle (a crate, a barricade, a
  log, a wall, a pillar, a ledge, an arch), cover, a pickup, a gate, a hazard or a marker, each with the beat it serves.
  The map builds the obstacles in the world's own style (its kit's palette), each a collider; the foes stand where they
  are placed (in place of the encounter marks' rings); the pickups are found where they lie.
- **Pieces that drifted.** A law, `pieces-fit`, says when a piece no longer stands on the land (the land rebuilt
  under it), stands outside its block or inside something solid, and names the nearest spot that fits: the piece is
  dragged there, never lost.
- **Authority.** A block takes the other departments' `suggestions`, each `must` (not overridden), `should` (overridden
  only with a reason, the block's `overrides`) or `may` (a hint); a suggestion `about` a kind of piece is kept when a piece
  of the block has every field it names. Laws: `suggestions-kept` and `casting` (level design recasting the scenario's
  foes is said, and refused only against a must).
- **The department.** Level design is the studio's own department (`level-design`), its chapter the play layer
  (`/levels/*/glyphs/play`: a chapter path's `*` stands for any level), a block its unit (`play:<level>/<segment>`).
  The build reads it.
- **The brief.** `level/play-brief.js` hands a block's level designer everything: its square in world metres, its path
  on the land, what already stands solid on it, the scenario's beats there, the hero's kit (pace, sprint, jump, moves,
  abilities and when they come), the roster it may cast from, the suggestions with their authority, and what it writes
  back.
