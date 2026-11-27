### The Hydra: a big boss of heads that take turns and fall in an order

- **The hydra** (`boss/vehicles.js`, the first of the big bosses): a many-headed beast rooted in its lair, turning to
  face you, its five heads each an element and an attack of its own (Ember breathes an arc of fire, Venom spits, Rime
  calls hail down, Storm's lightning follows and strikes, Gloom lashes at the chest). Its heads take TURNS round the
  ring: the awake head's eyes light, it attacks, then it hangs low and gasping, its opening, the only time it can be
  cut. They must be severed in an ORDER that is not the turn order; a head struck out of its order shrugs the cut off
  and every head rears at once (its retort). A severed head's turn is skipped; with the last one down its heart is bare.
- **New words on the vehicle shelf**: a part's `order` (its place in the sequence the parts fall in) and `open` (struck
  only in its turn's opening), a state's `head` (a part's turn, passed over once that part is broken), a vehicle's
  `retort` (its move when a part is struck out of order), the `blow` hit kind (a blade's: the director judges a swing
  that lands on a vehicle boss by part, as a round). `outOfOrder`, `nextInOrder`, `turnPast`; the `order-reached` law
  (each part in its place reached in a turn by what is in hand, with a retort). The director says the head to strike
  next (`state.bosses[id].next`), and a way on by parts broken comes before one by seconds.
- **The hydra drawn as itself** (`figures/hydra.js`, `gameworld/beast-boss.js`): a sea serpent's humped body in the
  water and five copies of its rising front fanned round its breast, one skeleton, each head tinted toward its element's
  colour; every neck sways, the awake one rears, strikes as its move lands and hangs its head low and gasping through
  its move's opening (`boss/vehicles.js` turnTimes: the clip timed to the director's own move), where the head's box
  is (a test holds the boxes to the figure). A severed head's neck is hidden (the boss view's bone hook, now a beast's
  too); a vehicle boss with a `figure` stands as a figure-rig and plays its states' clips; no part marks over a beast.
- **Fable of Artesia's boss is the hydra** (`foe-families.js` `boss: { vehicle: 'hydra' }`): a bestiary entry may stand
  as a boss of the boss shelf (`vehicle`, `gameworld/foes.js` isDirected), fought by its director under the foe's own id
  (so a page won by its foes down counts it), its figure built on the page from its row (`{ beastBoss }`,
  `worlds/world-scene.js`), no figure minted for it. Its lair, a level of its own after the castle heights, is next.

