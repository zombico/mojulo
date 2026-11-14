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
- **One body, many foes, and no gear designed by hand** (`foes/packs.js`, new; `egocube/outfit.js`, `egocube/plan.js`,
  `foes/people.js`, `gameworld/runner.js`). A kin's foes are told apart by what they wear and how big they stand, and
  what they wear is what the FRAME-ADORNED PRINCIPLES give them (`adornFromSheet`: role, station, archetype, anatomy,
  concept, restraint; each piece with its reason). Those principles were written for the creature biped and their answer
  was dropped on the tiered body, the ledger saying so.
  - **The bridge.** A kin on the tiered body made with a designed dress (the cube's default) now wears its adornment: an
    outfit with no cut, the pieces on its bare frame (`heroAdornOf`). A kin character made from a sheet is adorned from
    here on; one already made is as it was.
  - **Three words on a kin foe's skin.** Wild: neither, bare (the run's order says so, since the cube would now adorn
    it), a rabble told apart by `body: { size?, coat? }` (runt, lean, squat, big; a lineage swatch or a hex).
    `adorned: true`: each by its own sheet. `pack: { style, colourway?, motif? }`: the same principles with what a band
    shares pinned.
  - **The pack is the principles, not a design.** A pack style names no piece: it pins the character every member is
    read as (the raiders a hero's: one great shoulder plate the focal, a warrior's trophies and paint), its order, its
    cloth (short breeches and a cloth hung front and back, the chest left bare for the pieces), its colourways and its
    marks. A member's class gives its role's gear and its rank its station and how many pieces it keeps
    (`adornFromSheet` takes a `station` and a `room`). So two of one class and rank wear the same whoever they are, a
    fighter is told from a caster, and a leader wears all the rank and file does and more. The laws are read again in
    the pack's colours, and the colourways (rust, bone, moss) were set to keep them; a caster of the rank and file, at
    three pieces, carries the trim once where the law asks twice (its belt's fittings, which the law does not count,
    are the second).
  - A kin whose card is one body is rolled at its lineage's one build (a goblin rolled a brute stood 1.7 m).
  - **The casting call reads which a kin's cast is off the game's minds** (`gameworld/foe-casting.js`). Creatures of
    the place (they guard a ground, they wander): WILD, sized by role where the lineage has one build. A force come for
    the hero (the cube's motivation hunts) or one that hunts as one (`squad: 'pack'`): a PACK in one rolled colourway,
    and a band of two kins is led by the bigger (`KIN_BANDS`: the goblin under the orc), its elite and its boss that
    kin where the style is cut for it and the class fits. So the action RPG made from a sentence fields goblin raiders,
    a guard and a lean patroller, under an orc elite and an orc boss, one pack; it fielded bare goblins of four sizes.
  - A kin's collider now stands at its card's height (`stands`) and its size: a goblin's was a person's.
- **The orc is its own creature** (`creature-heads/relational.js`, `creature-heads/dentition.js`, `beast/cards.js`,
  `egocube/ancestry.js`). A lineage `orc`, a kin card and a skull: a deep jaw square at its front and set ahead of a flat
  nose (an underbite), two tusks standing up out of the lower lip, a brow over small eyes, short ears laid out to the
  sides; on a wedge of a body, the head sunk between sloped shoulders, long heavy arms, short bowed legs. The head gains
  `jawSquare` (the jaw's front a bar across) and `tusk` (the lower canines drawn out, on the jaw's bone, the one tooth
  that stands outside the shut skin); both nothing at their canon value, so every other head is as it was. The meadow's
  era fields the orc where it fielded the orcish, with the same arms. `orcish`,
  the near-human on the hero door, is as it was and still what the word "orc" in a character's brief rolls.
- **The books say it**: a foe's card in the foes book has `body` and `pack` rows and its line says wild, adorned or
  which pack; the agent's foes card names the three words (its ceiling re-pinned, with the reason); the foes doc has
  the principles as a table and the three words.
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
  the cap, a boss the horned helm).
- **The hero is designed, as everyone else in its game is** (`gameworld/hero-design.js`, new; `gameworld/compose.js`,
  `egocube/outfit.js`, `gameworld/hero-looks.js`, `gameworld/cast-setting.js`). A game laid from a sentence rolled and
  dressed its cast, its folk and its foes by principle and left its hero the door's stock body in plain clothes: the
  one figure nobody designed. Where no body rail designs it (the action RPG, the stylish action game, the party RPG),
  the sentence door now rolls the protagonist as a person of its world (the Egocube, in the game's own setting; a game
  with a casting page takes its cast's anchor, so the hero is the person the party was rolled against) and writes the
  looks pages from its sheet, each in the page's own words: its build, its face, its hair, its colours, and as its
  underlayer the cut and the pieces the outfit principles design (the role's gear, the one focal, the trim repeated).
  - **The protagonist reads against its ground.** The outfit designer takes a garment colour given it
    (`outfitFromSheet({ garment })`); the hero's is the world's accent, the colour its palette keeps apart from the
    land, and every other role of the outfit's palette still follows from the garment by the palette's own rules. A
    world with no palette keeps the archetype's colour. Before, the hero's shirt was a stop of the grass ramp.
  - The base wears its cloth at ornament 0, which took the belt a cut closes on: the belt is worn as a piece.
  - The brief keeps what was decided (`brief.hero.design`: the roll, the garment, the pieces, the reasons) and the
    character bible's base page says it ("How it was designed"); the agent's looks card says the pages come written
    and are rewritten like any other. A hero with pages of its own, an adopted hero and a railed one are untouched.
  - **A painted world keeps its setting's clothes** (`hero-looks.js` `underlayerFor`, `cast-setting.js`
    `quickFigure`). A palette or a look repaints a kit under an id of its own, and the underlayer rail was looked up
    by that id: a painted world's hero, and a quick game's rolled figures, fell back to plain casual clothes. The rail
    is the stock kit's the world was painted from.
- **The game's colour, chosen with the colour theorist** (`color-theorist/figures.js`, `color-theorist/directions.js`,
  `gameworld/colour.js`, `gameworld/colour-book.js`, `gameworld/world-palette.js`, all new; `docs/colour.md`). The
  theorist solved a palette for a world and nothing coloured the people in it against that world: the goblin, the orc
  and the old hero each sat within a hair of the grass they stood on. Colour had been decided spike by spike (a coat
  taken to the kit's ramps here, a hand-picked colourway there); this is one bridge and one aid, the same for any game.
  - **Figures on a ground.** A figure is measured by its distance from the ground it stands on and the foliage behind
    it, and solved clear of them and of the figures before it, for every eye. A creature keeps its hue family: its
    value and chroma move, its hue turns last and never past its family (a goblin stays green, an orc olive). A mark
    wears the world's second accent, or the protagonist's complement where the two accents are neighbours. Laws
    advise: figures clear, figures apart, colour vision, families kept, the protagonist the loudest.
  - **Colour directions**, rows the same for every game: a quiet land (three bands of value, low in chroma, colour
    spent on who matters) and a colour script across the levels. A direction never picks a hue.
  - **The options, and the colour book** (`/bible?book=colour`). For any gameworld: what its colour is now, measured,
    and each way it could go (the same land with the cast painted clear of it; each direction the world can take with
    the cast solved against the land that makes), every one a patch and every one painted into the same small landscape
    with the cast on its ground. The machine names its pick; the choice is the eyes gate's. `design_game`'s readout says
    when a figure sinks (a `colour` step), the agent's card is `gameworld-colour`, and `pick_palette` points at both.
  - **Who is read**: the hero's garment, a kin foe's skin, a pack's mark. A crew's dress and a beast's coat are said
    unread; a new kind of figure is a reader.
  - **A pack's mark takes a colour given it** (`foes/packs.js` `pack.accent`), and a kin's coat was already a colour
    (`body.coat`): the two words the options write.
  - **The sentence door colours a game once, when it is stored** (`mcp/tools/design-game.js`, `gameworld/compose.js`):
    the cast painted against the ground the world is stored with, what moved kept in `brief.colour`; and a genre with a
    direction chosen for it laid in it (`GENRE_COLOUR`, a row per decision: the action RPG in a quiet land). An existing
    world is untouched until an option is taken.
- **How a game starts: the controls, then an enemy trail** (`gameworld/world-map.js`, `level/guide.js`,
  `scene/channels/guide.js`, `level/map-sketch.js`; `docs/game-flow.md`). The action RPG's world map opened on a first
  zone of three blocks and five foes, its controls shown only as each came up and its first frame a look at the far
  ruins with the hero out of it. The opening sequence is the flow's own step (a cinematic before play), so the level
  no longer does its work. The map now starts on an OPENING: its first block alone, a page of its own.
  - **The controls first, with the hero in hand.** The arrival teaches moving, looking, the jump and the sprint, and
    the guide explains them as LESSONS: one at a time, each staying up until the pilot does it (walks a few metres,
    turns the camera, leaves the ground, runs at its sprint) or its patience runs out. An arrival that teaches one
    verb shows its keys as before.
  - **Then the enemy trail**: a lone foe on the way through the block (the blow), then two at its way out (the
    lock-on and the dodge), each fight's keys shown where it stands; the way out is held until both are won.
  - **No bigger than its tasks**: one block and three foes. The first zone is the next two blocks on one page and
    teaches nothing new: it tests what the opening taught.
  - The brief says it (`brief.worldMap.opening`); the hand-laid first zone (`level/first-zone.js`) is as it was.
- **Foes that come at the hero** (`foes/classes/pursuer.js`, new; `level/map-sketch.js`, `gameworld/foes.js`,
  `level/guide.js`, `scene/channels/guide.js`, `gameworld/playthrough.js`). Every blade on the shelf either held a
  post (a guard, a patrol) or was a boss's body, so a game whose minds hunt still fielded a rank and file that waited
  to be walked up to, and could be walked round.
  - **The pursuer**: a class that hunts by what it sees, from a fair way off, at an even pace, and holds no post. The
    casting call takes it for the grunt of a game whose minds hunt by its own score (its motivation is the game's);
    a game whose minds guard their ground is cast as before.
  - **A fight that comes after another** (a scenario beat's `after`): its foes are minted asleep and woken when every
    foe of the fight before it is down, a banner saying so. The stage's cues do it (the play layer's own `down`,
    `add`, `spawn`); a stage with no such fight lays none.
  - **The opening's trail comes to the hero, one fight at a time**: the lone foe is posted at the far end of the way,
    beyond its sight of the start, so the controls have their room and it comes down the trail once the hero heads up
    it; the pair come from the same way out only when it has fallen.
  - **The guide follows the fight**: a scenario's fight is won by its falls, wherever it was fought, and its keys show
    when its foes have come within a few strides, not only near its mark; the controls lessons give way to a foe at
    hand. The scripted player no longer walks at a foe that is not there yet.
- **A game starts in play, its opening a cutscene** (`game/flow.js`, `game/play-shell.js`, `gameworld/game-flow.js`,
  `gameworld/runner.js`, `gameworld/compose.js`). The opening sequence was a cinematic before the title on a first
  boot, a prologue after New Game and an attract loop, so a made game stood behind a press and a menu before anyone
  moved.
  - **The `cutscene` step**: a sequence made elsewhere and played whole. A `video` plays over the shell and the game
    goes on as it ends (or cannot play); a directed `scene` is staged as a cinematic is; with neither, the slot is
    empty and is passed at once. Skipped by a key or a click once it has been up a moment, unless `skip: false`.
  - **`flow: 'play'`** on a gameworld: the default flow started in play (`startInPlay`): that cutscene, then the
    save's level, else the first, with no attract, title or prologue before it. The story's opening moment fills the
    slot where there is one; the title stays, where quitting goes. The storyboard says the slot and that an empty one
    waits on nothing.
  - **A game laid from a sentence says it**, and its brief says how it starts. A game that says no flow plays as it
    did.
  - **A gameworld's flow reaches the game made of it** (`lib/mcp/tools/design-game.js`, `create-game.js`). The run
    ordered a game with its flow (its own, the story's cinematics placed in the default, now the start in play) and the
    door made the game without it, so a made game always played the default. The flow and the front go with the
    game, made or remade; `create_game` carries a `flow` it is handed (unlisted: the flow is the gameworld's page).
- **The opening level as a place** (`level/grid-scene.js`, `scene/channels/guide.js`, `gameworld/compose.js`).
  - **No designer's posts in a played level.** A sketch's marks (a post and a tooltip a beat: "encounter: …") were drawn
    on every page; on one a player pilots they are left out, the marks themselves read as before.
  - **No pillar of light on a fight.** The guide's pillar marks a place to go to; a fight's stood on its foe.
  - **A world map grows.** A cube's land takes grass only where a biocube brings it, and the map's cube named none, so
    it was bare ground. A meadow kit's map takes the meadow's own flora unless the cube or the sentence names what
    grows; the brief says so.
- **The meadow card's colours as the action RPG's world, each place derived from it** (`color-theorist/directions.js`,
  `gameworld/world-palette.js`, `world-map.js`, `colour.js`, `level/grid-scene.js`). Supersedes the quiet land the
  action RPG was laid in: a choice made again at the eyes gate.
  - **`kit-card`, a colour direction**: the land given back to its kit's card, as a palette the theorist solves to the
    card exactly and can move. The action RPG's row in `GENRE_COLOUR` is now this; any game on a kit with a row is
    offered it in its colour options.
  - **Each place its own light** (`PLACE_LIGHT`): the village and its road are home, unmoved; the ruins, the towns
    between and the castle heights are the same palette shifted, a row and a sentence a place. A region's
    `palette: { shift }` moves the level's cube for its tiles.
  - **The cast is painted clear of every place** (`landsOf`): the figure solver sees each place's land at once, so the
    sentence door's cast and every colour option hold across the whole map.
- **The action RPG's protagonist, designed at the eyes gate** (`gameworld/hero-rows.js`, new; `hero-design.js`). A genre
  may have a protagonist kept as a row (`GENRE_HERO`): its looks pages whole, given to a game of that genre laid from
  a sentence in place of the rolled person. The action RPG's is a young swordswoman in red and gold under a short plum
  cape, blonde, every colour on her the meadow card's. A creator's own pages still take it away.
- **Clothing words the design needed** (`polygonizer/outfit-plan.js`, `body-garment.js`, `outfit/styles.js`,
  `outfit/expand.js`). Each is an option on the outfit any hero can wear; absent, a piece is built as before.
  - **A drape panel's `hem: 'petal'`**: its corners drawn up in a curve, the middle the longest.
  - **A cloak's `lining`** (a second cape just inside the first, in its own colour) and a `hem` given as a place
    between the length words.
  - **`crest`** (a six-sided plaque with a gem standing proud of it, on the breast or on the centre line at the
    waist), **`bands`** (lines of braid across the front of the chest), **`midriff`** (the belly's cloth in another
    cloth's colour).
  - **A waist belt of pouches on the torso** (`on: 'torso'`, with one pouch alone at the front or the back), a belt
    with no buckle of its own, a belt or a sash worn lower (`drop`), a hip belt's `window` and `standoff`.
  - **A plain shoulder cap in any colour** (`plain`), its `size`, `crown` and `standoff`; **anklets** anywhere on the
    shin (`window`: a boot's rim), on a hero's shank as on a creature's shin.
- **The action RPG is heard** (`gameworld/compose.js`). A world map's game laid from a sentence is put on the sound
  sheet and given a score (an empty `sound` and an empty `music`): its sword, its ground underfoot, its foes' voices
  and a bed a place solved from the game, every level scored from the cue sheet. Play's sounds only: the interface
  keeps its own sound set. The brief says so; a game with no map is laid silent as before.
- Not here yet: a cape does not drape over what is worn on a belt (a pouch at the back shows through it); the hero's
  cloth takes no texture on the anime body; whether the cape and the panels move in play is not checked; the back of
  light hair shades brown; the bell bob is the stock bob's clumps moved (no hair form of its own), its lined strands
  blocky at the sides; a crest's and a band's place are offsets tuned on one body; a cutscene's video has no file carried into the export by the game's own door (it names a path the
  page can reach); the land beside an opening's path is still walkable (its fights hold the way out; a solid gate that
  opens on a win is not in the level kit); a pursuer gives up a hero it can no longer see (it hunts by sight, not by
  memory); the lessons name the keyboard's keys only; a crew's dress, a beast's coat and a quick
  game's rolled people are not read as figures; the colour
  book paints the theorist's small landscape, not the game's own level; the options are not yet a `pick_palette`
  argument (the readout and the book carry them); a hero on a body rail (a comic hero, a fighter, a mascot) is still dressed plain; the hero's dress
  rides in its underlayer, though the book calls dress a later page (the adornment page holds equipment only); the
  party battles' own "goblin" and "shaman" (`gameworld/battles.js`) are still orcish people, and the
  word "orc" in a brief still rolls the near-human; a kin's headgear has helmets only (no hood, no mask, no cloth) and no row in the
  agent's foes card yet; the brow ridge is a round bar (no arch, no thinning to its tail); the foes book does not yet list a pack member's pieces and their reasons (the principles give them);
  a row for the action RPG in the pose rails, so its hero stands as its game shows it; the goblin's hips, boxed where
  its thighs thicken; ink on what a hand holds.
