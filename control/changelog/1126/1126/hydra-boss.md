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
- **The hydra taller and set off its ground**: its necks rise 6.5 m, its heads hanging 8.7 m out in their openings (the
  boxes with them); its coils and lower necks drawn toward its own `body` colour (`hydraFigure` `body`, the row's: a warm
  bronze), so it stands off a cold cave's rock.
- **A faced foe on the chase camera** (`worlds/controllable/rules-basic.js` follow `face`, with `faceRate`, `faceMix`,
  `faceH`): the chase held behind its target on the line from a foe, its look lifted toward it, so a boss looms over the
  hero whichever way she turns (a boss arena's). Absent, the chase as it was.
- **The hydra's lair, a level of its own** (`gameworld/lair.js`, `levels.js` lairLevelOrder): a world map whose climax
  calls a boss of the boss shelf has it taken off the climax (the castle heights end at their keep's door, which leads
  on) and fought in a cave chamber after the last page: cold, mid-dark rock under one live fire so the beast stands off
  it, the hero come in at its mouth with the world's own fighting pilot, the chase held low behind her on the line from
  the boss, looking up at it; won by bringing it down. A world whose climax boss is a foe like any, as it was.
- **The hydra's skin read**: a pack's corner colours are linear light, and its tints now are too (they were mixed toward
  sRGB values, washing the body out flat); each tint moves a corner's hue and keeps its value, so the serpent's dark back
  and pale belly read its form under any colour. Its necks SEGMENTED: a seam ring every 0.3 m up each neck, standing
  just off its skin (its girth read off its tube, the fin's spines aside), in the neck's own colour a step down in value.
- **Its heads come at you**: an awake head swings from its place in the fan onto what the body faces, the hero (the
  director turns the body on her), as it wakes, and is held on her through its strike and its opening (the parts' boxes
  moved with them, in front of its breast).

- **A lair lit by itself** (`color-theorist/cave-rig.js`, a manifest's `castLight: { cave }`): a place with no sky draws
  its bodies under the cast rig solved from its own light, the fire's warm key thrown high from one side, the rock's
  cold fill, the floor's bounce, the walls' faint rim (as bright as the place's light, never lifted with a dark body, so a
  thin wing seen edge-on is not lit white). A boss's lair asks for it, so the hero, the hydra and a dragon (both its
  forms, built lit: `animalFigure`'s `lit`, `dragonFormFigure`'s) are drawn under the level's light and not each its own
  baked one: the foe audit's foe-lit holds there.
