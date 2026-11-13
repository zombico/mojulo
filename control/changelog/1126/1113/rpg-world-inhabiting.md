### A world's inhabitants: a goblin kin, foes that carry arms and stand as their game draws them

An action RPG made from a sentence fielded green-skinned villagers who charged like boars, drawn smooth-shaded beside an
inked hero, in a book that counted them on another scale. Its foes are now a people of their own, armed, cast to trade
blows, drawn in the game's style, and said so in its books. Machine gate throughout; nobody has looked but in passing.

- **The goblin, a kin of its own** (`egocube/ancestry.js`, `beast/cards.js`, `creature-heads/relational.js`). A lineage
  below the hero door, built the seventh generation's way on the game's own rig:
  - its HEAD a skull of the relational creature head: a small round vault under a heavy brow, a short broad muzzle that
    is all mouth with its corners back under the eyes, a chin drawn to a point, a long nose of its own carried over the
    mouth to a point, big forward eyes with slit pupils, long thin ears set low and swept back past the skull;
  - its BODY a card: a narrow chest over a round pot belly, thin arms hung forward with big hands, thick thighs on
    short bent legs with the knees forward, big feet, a deep hunch it keeps in its walk; sea green, bare.
  It joins the foe shelf's peoples (`foes/people.js`), so any class that stands on two legs can be skinned as one.
- **Four measures the creature head lacked** (`creature-heads/relational.js`): `earSweep` (the ear laid back toward the
  back of the skull, its length kept), `noseLength`, `noseWidth` and `noseDrop` (a nose of its own, a cone out past
  the muzzle to a point), `chinPoint` (the chin drawn to a point). Each is nothing at its canon value: a skull that
  names none is as it was.
- **A kin's card names its own head and where it stands** (`beast/cards.js` `head`, `stands`; `beast/head.js`). A kin
  whose head is not a library skull's wears the relational head its card names, at the size the card gives it on the
  body (`scale`, a new word of a relational head: a small body under a big head). `stands` is its share of a person's
  height in its rest; the foe shelf measures it by that (`peopleBody`), and a lineage of one build stands at it.
- **A hero that plays strings meets foes that swing a blow, from the first one on** (`gameworld/foe-casting.js`). The
  grunt, the flanker and the elite are cast from the classes that strike (a wind-up, a contact, a recovery the hero
  reads and trades with), never one that braces and charges down a line or hurts by a touch: those are a beast's
  lessons, and a person who charged like a boar read wrong. The elite is such a class a rank up, the grunt's own where
  no other is left, never the boss's body.
- **A people's rank and file stands at its lineage's smallest build**, its elite and its boss at their own roll grown
  by their rank. A person dressed as a crew takes its build from its dress, as before.
- **A people that swings a blow carries its lineage's arm** (`PEOPLE_ARMS`, from the armory's own builds,
  `equipment/armory.js`): the goblin and the orcish rank and file a cudgel, their elite and boss a spiked club, in the
  right hand. A lineage with no row carries what its own roll gives it; a new people's arms is a row.
- **The meadow's era fields goblins first** (`ERA_PEOPLES`): the action RPG's sentence now casts a goblin guard, a
  goblin patrol, an elite guard and a brute boss, each armed (was an orcish charger, a guard, a patrol elite and a
  brute boss, bare-handed).
- **A held weapon never takes the fist guard** (`polygonizer/hero-gesture.js`). The guard is a boxer's, both fists
  before the face, so a blade or a club in the hand stood across the head. A figure asked for the guard with a weapon
  in a hand stands ENGAGED instead, a new stand: the weapon arm carried low and out, the point ahead and clear of the
  body, the off hand open. The record keeps the word it was given, so the guard comes back when the hand is empty; a
  shield on the forearm keeps the guard. Every figure that holds a weapon and was asked for the guard changes its stand.
- **A beast-kin is drawn as its game draws its people** (`egocube/plan.js`, `mcp/tools/create-character.js`). A kin
  rolled in an anime game's setting takes the character light, flat tones stepped once and inked; it was smooth-shaded
  beside an inked hero. The light rides in a beast's spec, where the hero door reads it: beside the spec the door
  dropped it, which the anime head's own default hid for a person. Any other setting, and every person, as they were.
- **The books say it** (`gameworld/foe-cast.js`, `foe-cast-html.js`, `gameworld-cards.js`, `docs/foes.md`):
  - a foe's card says what it carries, by the armory's name;
  - the lineup stands a kin at the height its card gives it (a goblin a little over a metre beside the hero);
  - in a world armed with a kit the book numbers each foe on the kit's scale, the strings its rank takes and the
    health that is, where it counted the foe shelf's blows (two for a grunt that falls to one string, sixty for a boss
    that takes eleven), and writes a boss's phases as its levels carry them;
  - the agent's foes card names a people's `gear`; the foes doc says the kin, the arms and the casting.
- **One body, many foes: a kin is dressed and sized, never remodelled** (`foes/packs.js`, new). Two words on a kin's
  skin, read by `foes/people.js` and laid over its rolled sheet when the run makes its figure (`gameworld/runner.js`),
  as its `gear` is:
  - `body: { size?, coat? }`: how big it stands over its card (runt, lean, squat, big: the stature and the frame's words
    multiplied; the foe shelf measures it and its collider stands at that size) and its own colour, a lineage swatch by
    word or a hex. A WILD kin is this alone: bare, told apart by size.
  - `pack: { style, colourway?, motif? }`: what its band wears alike. The first style, the raiders: a hide vest, short
    breeches, a cloth hung front and back from a belt, shoulder plates and wrist wraps. A style names no geometry: a cut
    in the outfit grammar, the stylism solver's pieces at a register and budget that rise with the foe's rank, a
    colourway (rust, bone, moss) over the one coat the pack shares, the solver's motif as its mark. Every rank wears the
    same cut and colours; its leaders wear more of it. A people's own cut leaves off what its body does not take.
  - The casting call proposes a kin WILD, sized by role where its lineage has one build, and as a PACK in one rolled
    colourway where the cube's minds hunt as one (`squad: 'pack'`).
  - A kin's collider now stands at its card's height (`stands`) and its size: a goblin's was a person's.
- **The orc is its own creature** (`creature-heads/relational.js`, `creature-heads/dentition.js`, `beast/cards.js`,
  `egocube/ancestry.js`). A lineage `orc`, a kin card and a skull: a deep jaw square at its front and set ahead of a flat
  nose (an underbite), two tusks standing up out of the lower lip, a brow over small eyes, short ears laid out to the
  sides; on a wedge of a body, the head sunk between sloped shoulders, long heavy arms, short bowed legs. The head gains
  `jawSquare` (the jaw's front a bar across) and `tusk` (the lower canines drawn out, on the jaw's bone, the one tooth
  that stands outside the shut skin); both nothing at their canon value, so every other head is as it was. The meadow's
  era fields the orc where it fielded the orcish, with the same arms; the orc wears the raiders bare-chested. `orcish`,
  the near-human on the hero door, is as it was and still what the word "orc" in a character's brief rolls.
- **The books say it**: a foe's card in the foes book has `body` and `pack` rows and its line says wild or which pack;
  the agent's foes card names both words (its ceiling re-pinned, with the reason); the foes doc has the section.
- **Brows, as form** (`creature-heads/relational.js`, `creature-heads/worn.js`, `beast/head.js`). The relational head
  gains `browRidge` and `browSlant`: a bar over each eye from beside the nose out past the eye's corner, its beads
  marched out to the skin and left standing proud of it, its inner end fallen for a scowl. It is a volume, so the
  character light steps on it and the ink finds its edge; its faces are painted a shade under the coat so it tells from
  the forehead at a distance. The goblin and the orc both carry one; nothing at the canon value, so every other head is
  as it was.
- **A kin's hands sized to its arms** (`beast/cards.js` `hands`, `polygonizer/hero-form.js` `heroPlan({ hands })`). A
  card's `mass.hand` only thickened the hand; `hands` sizes it whole, the palm and the digits with their joints. The
  orc's are half again a person's, under arms half again as thick. One at 1, the default, is exact.
- **A kin's headgear, a first shelf** (`creature-heads/headgear.js`, new; `headgear/wear.js`). A person's headgear is
  drawn on a person's cranium; a kin's head is one skin netted from a field, any shape. So a kin's helmet is that
  field set out by a pad and a plate, kept above a rim from over the eyes to the nape, the ears' feet left clear, a
  card's own masses joined on: a skull cap, a helm with a nasal, a horned helm, a spiked cap. One card fits any skull.
  Worn by the hero door's `headgear` word, which on a kin (a new body the word knows, `kin`) lowers to its head's word;
  a person's card is refused on a kin and a kin's on a person, by name. The raiders' leaders wear them by rank (an elite
  the cap, a boss the horned helm); the plate takes the pack's metal.
- Not here yet: the party battles' own "goblin" and "shaman" (`gameworld/battles.js`) are still orcish people, and the
  word "orc" in a brief still rolls the near-human; a kin's headgear has helmets only (no hood, no mask, no cloth) and no row in the
  agent's foes card yet; the brow ridge is a round bar (no arch, no thinning to its tail); the raiders' vest breaks up across a goblin's chest where it is open;
  a row for the action RPG in the pose rails, so its hero stands as its game shows it; the goblin's hips, boxed where
  its thighs thicken; ink on what a hand holds.
