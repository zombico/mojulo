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
