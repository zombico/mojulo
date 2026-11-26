### The bestiary: foes as bodies with attack cards, lit by their level, a cast of its own for each rail

- **A foe's attack is a card of its own** (`foes/attacks.js`, an entry's `attack`): the class's blow re-skinned, one
  body taking several (a wolf that snaps, the same wolf that mauls; a goblin whose club chops instead of a punch). A
  beast plays the card's strike clip, a person or a kin bakes the card's held swing from what it holds, each at the
  card's timing so the hit lands when the body shows it. Every body says its topology (`foes/fit.js`).
- **Foes walk as their bodies do** on a routed rail (`gameworld/foe-families.js`, Fable of Artesia first): made with
  gaits of their own, their strides measured off the clips they play (`figures/clip-travel.js`), walking on a patrol
  and running in a chase, a beast idling in its relax loop and a flier flying.
- **The foe audit** (`gameworld/foe-audit.js`, `scripts/foe-audit.mjs`): a level's foes read off its page, bodied, lit by
  the level and posed for every state they play.
