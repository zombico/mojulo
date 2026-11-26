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
- **A tall foe's aimed blow never breaks its level**: a strike pitch whose pose the rig cannot stand (a boss's planted
  foot out of its leg's reach) is out of reach to the aim's search (`worlds/world-kinds.js` aimedKeys), which draws in
  to the last it can, where it threw and the level failed to build.
- **A flier dives from the air**: a swooper still rising to its perch, met on the ground where it spawned, climbs before
  it braces (`worlds/controllable/foe.js`), where it braced on the ground and its dive ended where it began; a routed
  flier hovers on its wings at rest. The foe audit reads the states a posed move and a thrown weapon play (`brace`,
  `dive`, `throw`), where it asked for a wind-up and a gun's fire they never play.
- **Throwers throw** (the `throw` and `toss` cards): the body winds a real throw and the round leaves at its release.
- **Fable of Artesia's cast**: the goblin band (raiders who chop, a slinger who throws) under orc leaders who maul, and
  the monsters of its wilds, never its small animals: skeletons risen from its ruins with rusted swords, gloomwings (a
  bat grown dire and dark) that dive from the air, a crystal behemoth that braces and charges, a venom serpent lying in
  wait in the grass, a fire salamander that hunts (a family's `extras`, each a beast grown by its oozes or a people; a
  people's `arm` from the armory); foes lit by each level's own cube, the target rim only on a lock.
- **Fable of Artesia's swordswoman, cleaned up** (`gameworld/hero-rows.js`, Lucien's lessons in Fallen Angel carried to
  the anime body): her skirt three petals open at the front over the tights, where a front petal hung between the legs
  as a flap; her cape stood off far enough that her collar and her shoulder caps no longer come through it at the back,
  the caps sat close on the shoulders over it; her arms drawn with a shoulder, a biceps and a forearm by a new muscle
  card of the arms alone (`musculature/cards.js` `arms`: a body's arm groups, its chest and what is drawn on it
  untouched), the arm's girth a little fuller.
- **Her neck, belt and cape**: a fuller neck; the cape behind her, hung from a cowl (a new piece, `cowl`: soft rolls of
  cloth draped round the neck, each lower at the front and wider over the shoulders than the one above, a U at the
  throat, lying over a hood worn down where one is; laid as a necklace's loop is, the two now one `neckLoop`); her braid sewn flat (the bands' `standoff` and
  `thick`); a tall belt cinched at the waist, worked with a pattern and clasped at its middle. On the game body a belt
  piece's `tall` (a cincher's band up to 10 cm, where a belt's is held to 5.5, read row by row so it follows the waist
  in), its `motif` drawn as a pattern on its face (a border top and bottom, a row of diamond plates or a zigzag between:
  `beltPattern`, where the motif's threads were dropped) and its `clasp` a round plate centred on its front
  (`beltClasp`), each bound as the belt's face under it. A hood worn down takes its own `wrap` round the throat; a crest
  made `round` keeps a circle's sides at any target (`adorn-tier.js` ROUND_DISC); a polyline's section may be squashed.
- **Her tunic's fronts cut away**: below the belt it is one piece each side, from a split at the clasp round to the back,
  its fronts curving open over her tights as a tailcoat's do (a panel's `hem: 'cutaway'`: its edge nearer the front swept
  out toward its side as it falls, at most 70 degrees; a panel's `width` up to 2, a front pair that meets at the back),
  her top's own hem at the waist.
