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
- **A foe's blow is thrown at the hero** (`foes/zones.js`, the strike zone by height): a goblin cuts low at the legs from
  alternate sides, stepping in and stopping where its club connects; a wolf snaps at the legs; a tall foe brings it down
  from above. Its swing is carried by its whole body (staggered feet, the weight moved, the off hand countering) and its
  hit is its weapon's: reach and cone measured off the weapon's tip, or a beast's head, through the blow.
- **Throwers throw** (the `throw` and `toss` cards): the body winds a real throw and the round leaves at its release.
- **Fable of Artesia's cast**: the goblin band (raiders who chop, a slinger who throws) under orc leaders who maul,
  wolves, a boar that braces and charges, cave bats; foes lit by each level's own cube, the target rim only on a lock.
- **Fable of Artesia's swordswoman, cleaned up** (`gameworld/hero-rows.js`, Lucien's lessons in Fallen Angel carried to
  the anime body): her skirt three petals open at the front over the tights, where a front petal hung between the legs
  as a flap; her cape stood off far enough that her collar and her shoulder caps no longer come through it at the back,
  the caps sat close on the shoulders over it; her arms drawn with a shoulder, a biceps and a forearm by a new muscle
  card of the arms alone (`musculature/cards.js` `arms`: a body's arm groups, its chest and what is drawn on it
  untouched), the arm's girth a little fuller.
