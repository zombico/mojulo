### The body rails: what kind of body a game puts in it

A small table of what body a kind of game puts in it (`control/lib/graph/gameworld/game-bodies.js`), as the underlayer
rails are what a world's setting makes a person wear: a new kind of body is a row. Each rail names the games it is for
(their genres, feel templates and quick goals) and, per role (the hero, the henchman a cast fields), the hero-door words
it lowers, in a style the world's own primitives choose. Heads and light are not a rail's. The book hero, the casting call and
the quick games read it.

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
- **The book hero takes its game's body** (opt-in): `characters.direction.body` names a rail, `'game'` (the rail its feel,
  genre or quick goal reads) or `{ rail, style?, muscle? }`. The rail's words are laid under the body page, which now
  also takes `form`, `physique`, `animeBody` and `muscleShirt`; the page's own words win, each departure in the ledger.
  The character bible's body page says the rail, its style and why. A world with a book and no body is proposed one by
  design_game (`next: [{ step: 'body', suggest: 'game' }]`), never given one; a world that names none is composed as before.
- **The henchmen take their game's body**: a dress (`foes/dress.js`) takes `rail` (and `muscle`), the henchman's words
  over the grunt's in the game's tradition: on the anime frame its codename (Armstrong or Kale, by the grunt's pole),
  western on the realistic body for a realistic or a fighting game, a mascot's frame; drawn in ink, the crew's own builds
  stand. The casting call dresses its crew with the rail the book's `direction.body` reads; a book that names none
  dresses it as before. A people foe rolled on the Egocube (not dressed) takes the same body: the words the rail
  changes over the sheet's person are laid over it when its character is made (`create_character { egocube, spec }`,
  a word set to null left off).
- **Quick games take a body**: `quick.body` (a rail, `'game'` for the one its goal reads, or `{ rail, style?, muscle? }`)
  lays the rail's hero under the hero spec's own words (a cast word naming the pole; the anime frame's codename takes the
  anime head where the spec names none) and its henchman under each foe, gunner, tower and guard the run rolls; a
  farmhand or an athlete stands as rolled, a hero by ref or a mascot is its own. Absent, every step as before.
- **The head fitted to the body**: each body codename has a home head (Toji, Mizuki, Armstrong and Kale Z-Fighter's;
  Satoru, Maki and Shonen High's own Shonen High's), and a head worn from another style is scaled half the way toward the
  home head's size (`anime-bodies.js` `headFit`): the body keeps the proportion it was drawn to, the style half its own
  (a School-Kid Hero head is still the big one). A style's head size is one number against Shonen High's per pole
  (`HEAD_SIZE`, measured: two heads' ratio is the same on every body to half a percent), held to the measure by its test.
  The NECK follows the head it carries (`neckFit`): its girth half the fitted head's remaining departure from the home
  head's size, so a bigger head stands on a thicker neck and a smaller on a slimmer, the join nearer the home pair's.
  The fit rides the body's stamp with the style it was fitted under, and fits again when the style changes; a row minted
  before, its stamp without a fit, is drawn as it was.

