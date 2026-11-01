### The body rails: what kind of body a game puts in it

A small table of what body a kind of game puts in it (`control/lib/graph/gameworld/game-bodies.js`), as the underlayer
rails are what a world's setting makes a person wear: a new kind of body is a row. Each rail names the games it is for
(their genres, feel templates and quick goals) and, per role (the hero, the henchman a cast fields), the hero-door words
it lowers, in a style the world's own primitives choose. Heads and light are not a rail's. Not yet read by any world: the
book hero, the casting call and the quick games are next.

- **The rails**: `comic` (superheroes and their henchmen: a city stalker, a brawler), `realistic` (people as they are: a
  story, survival horror, stealth, a shooter, a dungeon crawler, tactics), `muscular` (the fighters) and `mascot` (the
  platformer's: a collectathon, a runner, a racer).
- **The styles**: the anime tradition draws on the anime frame's bodies (Shonen High's for a realistic lead, Toji and
  Mizuki the grown base, Armstrong and Kale the hulking); the western on the tiered builds (a comic drawn in ink) or the
  realistic body (a material look, a realistic or a fighting game); a pixel world's mascot on the lowpoly register.
- **The muscle shirt is optional**: an anime role names the definition it would wear, and it is put on only when the
  world asks (`muscle: true`, or a definition).
- **Shonen High's body is a body codename** (`animeBody: 'shonen-high'`, either pole, its tune read from the style), so a
  game can put the lead's lean body under any anime head; under its own head it draws as the default always has.
