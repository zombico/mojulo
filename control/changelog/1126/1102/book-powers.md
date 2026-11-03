### Book powers: the hero's pages act in play

The game book's actions, adornment, systems and equipment pages are written and read, but in play a power only spent
its resource, put on a look and showed a toast. This theme makes them act.

- **A power's move is the hero's from the stage that gains it** (`levels.js` `startingGrants`). A power with a `move`
  (double jump, glide, high jump, the wall, the line) that the hero gains at the early stage (or any, where the page lays
  no stages) is granted from the first level on every trail and in every building, over the hero's own rule: a high
  jump is half as high again as its own, a second jump at least one. It used to be granted only where the power keyed
  a map's door; one that keys a door is still found there. A power gained later waits on its stage.
- **An attack power lands on the nearest foe in front** (`mechanics.js`, the systems page). A power with an `attack`
  (a beam: orb, fireball, ray…) fires it from the hero's hand when its key is pressed, at the nearest standing foe in
  front of the hero (within 24 m and 0.7 rad of its heading), and takes the hero's power stat × the power's `per` as it
  lands. With no foe in front it flies on at nothing. It used to spend, glow and say its name, its hurt carried as
  data. Seen in an exported page: the example hero's `wind-orb` (key 2) took a grunt from 20 to 8.
- **The cast's beam aims and hurts** (`worlds/controllable/cast.js`, read by `playscape/ui/cast.js`): a cue's
  `{ beam: { who, to: { nearest: { range?, cone? } }, hurt? } }` fires at the nearest standing foe in front of `who` (a
  mind, not its own team, never a seat) and takes `hurt` as it lands, beside the struck fact, as a blow does (a hit, its
  flash, downed at 0). A beam with neither plays as before. The emission pins of every fixture that embeds the
  controllable runtime moved for it.
- **A power fires only once it is the hero's, and only when its spend is there** (`mechanics.js`, the systems page). A
  power gained at a later stage waits on its node in the stats (`hero.<power>` at rank 1 at least, bought on the stats
  page or carried in); a power that spends a resource waits on it. Refused, the key says why in a toast ("wind-orb: not
  gained yet", "not enough <resource>") and nothing fires or is spent. The starting stage's powers are the hero's kit. It used
  to fire whether gained or not, the limit the systems page said.
- **A later power's move is granted when its node is gained** (`levels.js` `laterGrants`, the game channel's
  `powers.bought`). The page hears the stats: the moment the bus holds the power's node, its move (a double jump, a high
  jump…) is the hero's, on a level whose map keys no door as much as on one that does. Seen in an exported page: before
  its node, the example hero's `wind-orb` said "not gained yet" and fired nothing; with `hero.wind-orb` at 1 its orb
  took a grunt from 20 to 8. A game with no later power emits as before, byte for byte. The level contract takes
  `game.powers` without a slice beside `bought` (`game/level-contract.js`), so a level whose map keys no door renders.
- **A level's powers read back as data** (`gameworld/power-record.js` `powerRecord`): each power's key, its holder, when
  it is gained (the start, or its node in the stats), its spend, the toast it refuses with, its look, its attack (a beam
  at the nearest foe in front, its reach and hurt) and its move with what grants it (the held slice, a pickup, the
  stats), read from the level's own keys, cues and `game.powers`. It is for a reader that does not run the page's cues,
  the engine handoff's level record first, and it imports nothing.
- **One HP: where the stats bind the hero's body, its bar is the hp that ends the level** (`runner.js`, `foes.js`
  `onBody`, `game/mechanics.js`, `worlds/controllable/foe.js`). A fighting level of a world with systems kept two hp:
  - the stats' bar on the hero's body (its hp stat, 100 and rising each level);
  - a level hp of 20 beside it, which a foe's touch took 2 from and which alone lost the level, so the bar the player
    watched was not the one that ended the run.
  Now such a level is lost when the body is down, and every hurt takes from the body: a blow, a beam, a foe's touch and
  a hazard. A touch and a hazard cost the same share of the body's hp they cost of the level's (a tenth, a quarter), and
  there is one HP readout.
  - `fail-on-death` and `hazard-damage` take `of: 'body'`: no hp var, the level lost on the body's `down`, a hazard
    through the cast's `hurt`, a lethal fall through its `kill`.
  - A foe's touch takes the pilot's `rule.stomp.hurt` off a body with its own hp, downing it at none.
  - A level a battle plays on (a boss, the party's fights) keeps the level hp its battle reads, and a world without
    systems plays as before.
  - Seen in an exported page: ten touches of a grunt took the one HP bar from 100 to 0, and the level ended in a fail,
    with no level hp beside it.
- **A short foe is touched, not stood on** (`worlds/controllable/foe.js`). A pilot stomped a foe whenever its feet were
  within 0.3 m of the foe's top, standing or falling. A foe shorter than that (a grunt of a quarter of a metre) was
  stomped by a hero walking into it on the same ground, so its touch never hurt. The reach is now half the foe's height
  (0.3 m still on a foe taller than 0.6 m): a hero beside a short foe takes its touch, and one landing on it stomps it.
  Seen in an exported page: the example hero's own 0.24 m grunt took the HP bar from 100 to 0 in ten touches.
- **A world with no systems makes its gear** (`gameworld/character-review.js` `characterReady`). The equipment step
  waited on the stats (`mechanics:stats`), and a world with no systems page (a sentence's hero, which has no powers)
  never lays them. So the sword a crawler's hero carries for its strike was never made as gear, and the run's readout
  waited on it for good. The equipment now waits on the stats only where the world has a systems page; without one it
  is made once the hero is settled. The character book says why. Seen in a composed crawler's run: its sword made as
  `gear-sword`, every step ready, nothing left waiting.
- **An attack's hurt follows the power stat as it rises** (`gameworld/mechanics.js`, `playscape/stats`,
  `worlds/controllable/cast.js`). An attack power took the power stat's base × its `per`, fixed when the level was laid,
  so a hero ten levels on hit as hard as at the start. The systems now bind the power stat to the hero's body
  (`play.stats.bodies.power`, beside `hpMax`), and an attack's beam takes `hurt: { by: 'power', per, base }`: the
  caster's power stat as it fires, raised by every level, × per, or `base` where no stat is bound. The systems page no
  longer lists it as a limit.
- **A JRPG from a sentence runs** (`gameworld/foe-casting.js`, `runner.js`). The casting call cast real-time foes for
  every genre whose hero fights, a JRPG included, whose foes are its party battles' packs. A stage then laid two
  `fail-on-death` (the foes' hits and the battle's own) and the run refused its level ("var 'hp' conflicts (20 vs 1)").
  Now:
  - a genre that fights only turn by turn is not cast real-time foes;
  - on a stage the party battles are fought on, standing foes are cleared but take no second hp: the battle's
    `fail-on-death` is the level's end.
- **Party battles proven in a page.** A JRPG composed from a sentence, run and exported, then played headless:
  - walking up to the first pack opened its fight ("Slime A and Slime B appear!"), and accepting the commands won it
    ("Victory! 8 XP and 6 gold.", `rpg-won:pack-1`), the pack's foe falling on the map;
  - the second ("Wolf and Bat") was won too, the hero rising to level 2;
  - no page errors.
  The sentence's party is the hero alone: the door casts no companions who join it yet.
- **A JRPG's party from its sentence** (`gameworld/genre-forms.js` `heroFrameOf`). A genre that fights turn by turn is
  laid with a casting page (`characters.casting: {}`). The cast's scale is read from the sentence's own words (a party,
  companions, a crew) or a party by default (`casting.js`). Each companion is a cast member made by path, walks the
  field beside the hero and fights in the party battles from the start, each in the class its sheet reads as. "A jrpg
  where a party of heroes battles monsters" lays the hero (a monk) with a cleric, a fighter and a mage, where it laid
  the hero alone.
- **A leg a hair short of its planted toe is clamped, not refused** (`polygonizer/station-loft-rig.js`). Under
  `reach: 'reject'`, a planted leg whose toe sat even 0.0001 m past its reach threw. A JRPG's rolled companion's idle
  (`hairToss`) did so, and the run refused its cast sheet. A miss under a millimetre (`REACH_SLACK`) is float noise,
  clamped as `reach: 'clamp'` does; a pose that misses by more is refused as before. A pose that reached renders byte
  for byte as it did.
- **The bodies act a party battle out** (`playscape/rpg/juice.js`, `scene/channels/rpg-channel.js`,
  `scene/channels/controllable/index.js`). A fight was told in its window (a number's pop, a row's jolt, a puff) while
  the figures on the map stood as props. The battle juice takes an act, `{ act: strike | cast | hurt | fall, at?, for? }`.
  The figure plays its own clip for it at the act's phase on the world's clock, while the fight holds the world still:
  - a strike plays its swing (`swing_neutral`), leaning toward its target and back;
  - a recoil plays its stagger;
  - a fall plays its topple and holds its last frame.
  The defaults bind them: a blow makes its striker swing and its target recoil, a KO a fall. A pack's single figure
  recoils for each of its foes and falls when the fight is won. A figure without the clip plays nothing new. A fight's
  acts end with it. The renderer's part is emitted only into a page that plays party battles (`acts`), so every other
  page is byte for byte as it was.

  Seen in an exported page, the party of four fighting two packs:
  - the fighter and the mage struck with `swing_neutral`;
  - the fighter and the cleric recoiled with `stagger`;
  - the hero and the packs' figures had no such clips, and played none.
- **A genre that fights is played by people who take its blows** (`genre-forms.js` `heroFrameOf`, `compose.js`). A
  sentence whose genre fights (in melee, at range or turn by turn) writes the world's `moves: true`, so the hero, its
  foes and its keepers are made with their own hit, stagger, fall and rise. A turn-based hero carries the blade it
  swings in the party battles.
  Seen in an exported page, a JRPG composed after it:
  - the hero swung (`swing_neutral`) and recoiled (`stagger`);
  - the packs' figures recoiled (`stagger`);
  - the companions swung and recoiled as before.
  Two strikes still have no clip of their own: a pack figure's (no swing) and a caster's.
  The fight keeps the level's follow camera behind the hero, with the pack's figure a metre off, so an exchange does
  not yet read as one: staging the sides and a battle camera are next.
- **A party battle is staged and framed** (`scene/channels/rpg-channel.js`, the controllable channel's `acts`). A fight
  was seen through the level's follow camera behind the hero, the pack's figure a metre off and the party out of frame.
  Now, as a fight opens:
  - the party stands abreast 4.5 m from the pack's figure, each a step aside and a step back of the next (a diagonal a
    side camera sees past), each facing it, on its own ground, and the pack turns to them;
  - the camera stands off to the side, three-quarters, aimed at all the fighters' middle and below it, so they stand
    above the window's panels; its height is both lines' ground, so the uphill side of a slope stays in frame;
  - of its two sides and three heights, it takes the one whose sightlines to every fighter pass clearest over the
    ground (a rock, a rise).
  While the fight holds the world, the staged figures are drawn where they stand and the acting ones play their acts.
  As it closes, every figure and the camera are put back. The page exposes `__mojCtrl.ground` to the battle where
  battles are. Seen in an exported page, a JRPG's two fights: the party of four in a diagonal on the left facing the
  pack on the right, the hero's swing landing, all above the panels.
- **The battle window, the formation and the camera reworked** (`scene/channels/rpg-channel.js`, `events.js`,
  `gameworld/levels.js`).
  - **The window.** The command menu stands in the lower-left corner while a member picks; the foes' box (their
    names, HP bars, the turn order) stands at the lower right. Each fighter's HP and MP ride on a bar over its head,
    with no name. The member picking is outlined and marked ▼, and its statuses (poison, asleep, silenced) are said
    over its head. While a target is chosen, the menu stays on the list the action came from, the action set; the
    target is chosen where it stands: in the foes' box (its cursor) or over an ally's head. Over the target only a ▼
    marks who it is. Clicking a head picks it. A blow's number, a miss or a heal rises over whoever it lands on. The
    banner across the top says only an action's name or a status (a cast, a status taking, a fall, a level), never a
    number. While a round plays out, the window and the bars step aside for the bodies' acts, leaving the numbers
    and the banner, and come back for the next pick. The level's own HUD steps aside for the whole fight. The page
    exposes `__mojCtrl.project` to the battle where battles are.
  - **The formation.** The party stands in a wedge (the hero at its point, the rest in ranks behind on either side),
    never a line.
  - **The camera.** Its distance is fitted to the fighters' spread across the frame (its field, the page's shape, a
    margin), so they fill it, aimed low so they stand above the band.
  - **The book's style.** Every level that plays (its HUD, its menus, its party battles) takes the book's UI direction:
    the systems page's where it writes one, else proposed from one seed of the world's, so all of a game's levels roll
    the same guide; a sentence's JRPG, with no systems page, takes it too. The battle window wears the guide (its
    tokens, its register's frame and plate, its border) as the HUD does. The example hero's run moved for it.
- **Each foe stands as what it is** (`gameworld/battles.js` `FOE_LOOKS`, `runner.js`, `playscape/rpg/rpg.js`, the
  battle page). One figure, a man with a dagger, stood on the map for every pack ("Slime A and Slime B", "Wolf and
  Bat"). Now:
  - each foe of the presets has a look: a beast where the fauna has one, grown by the mutagen's ooze where it is more
    than an animal (a wolf, a fruit bat, a crystal bear for the golem, a fire raptor for the drake), a person where
    it is a person (a goblin, a bandit, a shaman, a skeleton);
  - the run makes one figure per foe kind its packs stand;
  - each foe of a pack stands as its own figure, the first on the beat and the rest a step aside and back. An
    encounter's `who` names each foe's figure in the foes' order, and the win fells each.
  In a fight:
  - each foe stands in a wedge mirrored to the party's, facing it;
  - each acts and falls on its own;
  - the target's marker and the numbers rise over the foe's own figure.
  A world that writes its own `battles.foe` stands that one look for every foe, as before.
  - A beast stands at a monster's height, not its animal's (`FOE_HEIGHT`: a slime knee-high, a golem over a person):
    its body scaled from its species' measure (`foes/fit.js` `bodyOf`), with its collision and where it is hit.
  - Kept as stand-ins: the spider is a venom-grown rat, the slime a venom-grown frog (the fauna has neither).
  - Made it run: `design_game` makes a person foe kind's figure as a hero (`foe-<kind>`), and a run's record takes
    the key. Seen in an exported JRPG: the slimes and the wolf each recoiled and fell on their own figure, a real wolf
    facing the party. A bat has no reactions and no foe a strike clip yet, so those play nothing.
- **A pack spaced by its foes' size, and the fight's views** (`gameworld/battles.js`, `playscape/rpg/rpg.js`, the battle
  page). A pack's figures stood a person's step apart, so two knee-high slimes overlapped. The step is now as wide as
  the pack's largest reaches round its middle, on the map and in the fight's wedge. A fight is seen from a view the
  battles' rules name (`rules.view`, by the book's `battles.rules`; the side when it names none):
  - `side`: from the side, the two lines facing across the frame;
  - `front`: over the party's shoulders at the foes, as a Dragon Quest fight is seen;
  - `left` and `right`: a three-quarter view from either hand;
  - `overhead`: from above.
  Each is a direction round the fight and an elevation, the camera's distance fitted to the fighters across the frame
  and down it, and the clearer side or a higher stand taken where the ground hides them. The page's
  `__mojRpg.view(name)` re-stages a fight in another view, for a preview.
- **The battle's cinema** (`playscape/rpg/rpg.js` `rules.cinema`, `playscape/rpg/juice.js` `shot`, the battle page). A
  book may play a skill, or every action, as a short film while the round plays out and nobody picks:
  - the actor close as it begins;
  - behind it, over its shoulder at its target, as the blow goes;
  - the target from the side the blow came from as it lands;
  - then back to the fight's view.
  It is written `battles.rules.cinema: { on?: 'skills' | 'all', ui?: 'none' | 'numbers' | 'all', skip?: seconds }`:
  - `ui` is what stays on the screen meanwhile: nothing; the numbers and the action's name (the default); or all;
  - a film longer than `skip` seconds (3) says it may be skipped, and accept (or a click) cuts it to its end.
  Each shot is a camera placed every frame by its figures, the beat held until its shots have run; between films, the
  staged view. A juice step `{ shot: closeup | behind | target | view, at?, for? }` scripts a shot of the author's own.
  Absent, a fight plays as before.
- **The battle's boxes placed by its view** (the battle page). The command menu and the foes' box took the same
  corners whatever the view, so in the front and three-quarter views they stood over the party. Now, once a fight is
  staged (and when its view changes), where its fighters stand on the screen is measured by the scene's projection.
  The two boxes take the corners that cover the party least, the foes' figures next, a low corner over a high one.
  The banner keeps the top's middle. The side view keeps the window's own layout: the menu at the lower left, the
  foes' box at the lower right.
- **The battle foes made through the character doors** (`design_game`, party battles). The goblin, the shaman and the
  skeleton were one plain person each in another shirt colour. Now each foe of a pack stands in the look the character
  doors make:
  - a beast through the animal door (`{ species, ooze?, stylism? }`);
  - a people from its own sheet (`{ people, facets?, dress? }`), rolled in the game's setting as the egocube rolls one.
    A people is a lineage, the beast-kin (feline, lupine, ursine, avian…) or the undead (skeleton, zombie, ragged,
    rotting, risen…). It is rolled as a caster where its foe fights by magic, else as a fighter, and made by
    `create_character { egocube }` with its moves, at its sheet's stature;
  - a person through the hero door.
  The goblin and its shaman are orcish, the skeleton is a skeleton, and a new `zombie` foe (slow, tough, weak to fire
  and light, bites) is a zombie. A book names its own look per foe with `battles.looks: { <foe>: … }`. The one
  `battles.foe` that stands for every pack may now be a people too. Each kind's sheet is its own row
  (`foe-<kind>-sheet`), so the whole depth of the character doors (facets, build, age, role) is open on it.
- **The foes a sentence names** (`design_game` composing a game that fights turn by turn). "Skeletons and zombies",
  "orcs", "beast folk", "werewolves", "lizardfolk" and "demons" were unread words, and the game fought the default
  slimes and wolves. Now they write the party battles' packs and looks (`gameworld/foe-words.js`). The packs grow from
  one foe to three, walked round the kinds in the sentence's order. Each foe is in the look its word asks for: the
  undead and the orcish from their own sheets, beast folk as the lupine and feline kin, a beast through the animal door.
  The words are in the brief's read. A sentence that names no foe fights as before.
- **A merchant and an inn on the way** (party battles). Battles paid gold into the bag, and nothing spent it. Now each
  stage that fights opens with a merchant and an innkeeper beside where the party comes in:
  - The merchant sells what that far along calls for: the starter gear first, then iron and silver, then the dearer
    cures. It buys the bag's priced things back at half.
  - The inn's night (full HP and MP, cured) costs more the further on. It is the stage's rest, so the free rest at
    the start goes where an inn stands.
  - A book writes `battles.shops: { wares?, inn? }` for its own wares and price, `inn: false` for no inn, and
    `shops: false` for neither.
  Underneath, `play.rpg.shops: { <id>: { name?, wares?, buys?, inn? } }`, opened by a cue's `rpg-shop:<id>`:
  - The page's shop window has Buy, Sell and Stay, the party and the gold beside, keys, pad and mouse.
  - Every deal goes through the bag, so it is carried between levels.
  - Items and gear have a `price`, the presets theirs. A world with no shops carries no prices.
- **A town every way leads back to** (`design_game` composing a game that is returned to). The party RPG's cube asks
  for a hub ("a centre to return to"), and its levels were a line.
  - **The layout:** a genre whose cube's topology is a hub (the party RPG, the top-down adventure, the story adventure)
    is now laid round a town. The first level is the town, and every other level is a stretch of the wilds joined to
    it both ways. The game leaves the town by a way to each and comes back by the way behind each one's start.
  - **The town:** its street stands on the ground. No battles are fought there. The merchant and the inn stand in it, so the wilds have no shops and
    no free rest. The last stretch of the wilds still raises its castle.
  - **The world key:** `hub: '<level>'` names a map world's centre (topology `interconnected`). The "a centre to
    return to" concern now reads as laid.
  - **What stays as before:** a single level, a building, or a genre with its own form of levels.
- **The town drawn from the game's art direction** (`design_game`, a level's town street). A street laid by a
  level's `places` took only its civilization's language and the kit's colours. It never laid its road, kerbs and
  lamps, and on a level a geocube paints it missed the cube's look. Now, where a geocube paints the level, the street
  is in that cube's look (`era/geocube.js cubeStreetLook`):
  - its roofs, frames, boards and painted things in the cube's colours, moved by the world's palette as the land is;
  - its walls dressed in the cube's builders' material words and colours where the cube is gritty or names a style;
  - its road and its lamps laid through it.
  The civilization's language (the book's builders and their tunnelled words) still builds it. The composer, where no
  word names who builds, now takes the builders of the cube the levels stand on instead of rolling one, so a town no
  longer contradicts the land it stands on. The seed's roll is still made, so nothing else it decides moves. The
  book's geocube colour key says what each colour paints on its streets.
- **The hub town's folk, and faces that vary** (`design_game`, a composed hub). A composed hub now asks for its folk
  (`characters.folk`): the town's people, grown from its houses in the game's setting, each to talk to.
  - **Who keeps the shops:** the town's own shopkeeper opens the shop, and a second shopkeeper (or the head of the
    first house, letting a bed) the inn. No keeper of the shops' own stands there, and none is made.
  - **Built through `design_game`:** a town's folk bodies (`folk-<town>-<body>`) were never routed by
    `design_game`. They fell through to the gear door and failed, and the made record refused their keys, so a book's
    folk could not be built. They are now minted through the hero door, as a guard is.
  - **A clothed child mints:** the hero door's `detail: 'clothed'` refused a child's body. Its cuffs and leg
    wraps sit on the ring halfway down the forearm and the shank, and the child build's limbs (on the chibi form's
    rings) have no such ring. So a town's children, dressed like everyone else, could not be made. Now the cuffs and
    wraps sit on the limb's own ring nearest the one they name (`polygonizer/hero-dress.js`). Every body that has the
    ring is as it was.
  - **Folk on a geocube level:** they now stand on a level a geocube paints. They read the cube's look as the street
    is drawn in it; before, the folk could not be laid there at all.
  - **Pooled bodies by sex:** the pooled bodies (the households, the apprentices, the watch) are now pooled by sex
    too, so a woman never wears a man's body for want of a woman's.
  - **The nearest body:** past a pool's own bodies, each person wears the one nearest them, their age first and then
    their skin's lightness, the nearest few in turn. Before, it was whichever came next, so six young men of three
    ancestries stood in one pale youth's body and an elder could wear a youth's. On the test town, the bodies minted
    went from 11 to 14 and the young men from one body to three.
- **The one you face answers** (the page's reach prompt). A town's folk stand a step apart (1.1 m), and each can be
  talked to from 1.6 m. Walking up to one entered their zone first and their neighbours' after, and the last zone
  entered was the one in reach, so the person in front of you never answered. Now, where usable zones overlap, the
  nearest to the walker is in reach (`interact-channel.js`). Only the overlapping zones carry their centres, and the
  nearest-pick is emitted only then, so a page with no overlapping uses is byte for byte as it was.
- **The townsfolk dressed and standing their own way, and the shop part of the world** (a town's folk, the hub).
  - **Garb by role:** the folk all wore the world's underlayer, one outfit repeated. Now each person's garb is cut
    for their role, varied by their own dice within the town's culture (its cloth and its shoes,
    `folk/garb.js`):
    - the keeper's shirt under an open vest;
    - the elder's long coat;
    - the work floor's and the fields' short sleeves, shorter legs and boots;
    - a child's short sleeves and knee-length legs;
    - the townsfolk's sleeves, hems and legs of their own, a grown woman of the house in a long skirt as often as
      not.
  - **Stances:** each person holds a stand minted into their body (relaxed, a hand on the hip, a turn or a tilt of
    the head; a child relaxed). While standing, they either hold it, breathe on the shared idle, or crouch at their
    work (a worker, a farmhand, a child at play). The keeper and the elder hold theirs.
  - **The underlayer on a geocube level:** folk on a cube-painted level now wear the underlayer of the cube's base
    kit; before, they had none and kept their rolled detail.
  - **Walk-in uses:** a street's `walk: [uses]` (`era/stage-buildings.js`, a level's `places.street.walk`) walks the
    uses named into as part of the world, while the others entered keep their door into a scene of their own. Absent,
    a street is as it was.
  - **The hub's walk-in shop:** the composed hub enters its hall and its first shop (`walk: ['shop']`), their keepers
    inside at their counters. The merchant now stands at the shop floor, not on the street. Each more building
    walked into takes a later house's ground, so the hub enters two of six.
  - **Interiors on a map:** a map world's ways no longer chain through a building's inside, which is joined only by
    its door.
- **The walled town** (a town's street on a stage, the hub). The fortified town (the town's `fortified` dial, its
  curtain, towers, gatehouse and ditch: `era/out-fortress.js`) was drawn only in the book's sheets. A game's town is
  its street, its houses seated beside the trail rather than on the town's plan, so its walls are now the street's
  (`era/stage-walls.js`):
  - a gatehouse over the trail before the first house and after the last;
  - the curtain behind the houses on both sides, with towers at its corners and along it;
  - all of it in the town's paint and light, each a collider, its gates open, its ground kept clear of what grows.
  A street writes `walls: true | <fortification>` (`places.street.walls` on a level). `true` is the town's own
  fortification, derived from its building language rather than a preset (`out-fortress.js fortOfLanguage`): the
  curtain in the stone its houses stand on, a crenellated parapet over a stone town or a loopholed one under its roofs'
  tile over plaster, and towers crowned as its houses are roofed (square towers under hips, drums under cones or
  domes) in its roofs' cover. Naming a fortification still chooses one. The composed hub is walled; absent, a street
  is as it was.
- **A town's buildings inside** (the scene composer's vernacular register; a street's `inside`). A town building
  walked into was laid on the stone room kit with its crypt dressing (moss, rubble, candles, niches, a gutter), so a
  shop looked like a dungeon. The scene composer's registers were all modern, and nothing furnished a room by what it
  is for.
  - **The vernacular register** (`era/style/bay-axes.js`): lime-rendered or stone walls over a stone socle, boarded
    ceilings on timber beams, timber posts and wall-plates, flagged or boarded floors, small glazed windows letting in
    the day, warm lamplight. A construction may now lay no air (`air: false`: no ducts, vents or returns).
  - **Furnished by role** (`era/stocking.js TOWN_STOCK`): each room by its role, from new pieces.
    - the shop floor: a counter, shelves of goods, barrels and sacks;
    - the hall: long tables with their benches, a settle, the dais's high seat;
    - the tavern: a counter, tables, barrels and settles;
    - a house: its kitchen's hearth, its chamber's bed and chest;
    - the work floor: workbenches.
    A town's building holds none of a game's set pieces (no prize on a pedestal, no find, no sign).
  - **Built as the town's houses are:** each town's interior is a construction made from its building language,
    registered under its print (`registerConstruction`), so the inside and the outside are one style library.
    - Its walls are in the language's own materials: a timbered town's boards, a stone town's ashlar, a plastered
      one's lime render.
    - Its windows are the language's lights (their width, sill and height), glazed in crown glass between lead cames
      (`glass:crown-leaded`, a bay window's `cames`), not modern float glass, and with no glints.
  - **The town's own colours:** a palette made from the town's exterior paint (its houses' plaster, stone, timber and
    tile, the cube's where a geocube paints the stage), registered under its print (`registerPalette`). No preset.
  - **The street's `inside: true`:** lays its walked-in buildings so. The composed hub's are. A keeper kept inside
    stands behind the counter at the room's middle. Absent, a street is as it was.
- **A town's building wears its town's outside.** A walked-in town building whose inside is the vernacular wore a
  modern bay exterior (`style/bay-exterior.js`: textured cladding, a large gridded window). Now it wears its town's
  outside as the street's houses do: its language's wall and roof, painted and dressed as theirs. Its windows are cut
  through for its leaded lights, each under a lintel and over a sill in its language's ornament. Absent the vernacular,
  a building is as it was.
- **A town's furniture from the furniture door, in fantasy skins.** The furniture door (`mint_solid` kind `furniture`,
  `furnishings/forms.js`) gains a town's furniture before the machine age, styles over the same forms in dark oak and
  walnut: `trestle-table`, `tavern-table`, `settle`, `high-seat`, `shop-shelves`, `counter` and `iron-bound-chest`.
  Each mints as a display piece. In a town's rooms, a counter, shelves, tables, a settle, the high seat and a chest are
  now drawn from these styles' locked builds (`compose-dress.js`). Each is filled to its piece's size, turned to face
  into the room, and keeps its own finish, in place of the boxes. Barrels, sacks, crates, the hearth, the bed and the
  workbench stay boxes for now.
- **A reference party RPG, Hollin Vale.** `design_game({ example: 'hollin-vale' })` makes it, the test asset for the
  gameworld's town, folk, battles and shops (`gameworld/examples.js`). Where the book can decide, it names no preset id:
  - **The town's builders:** written as their language's elements (lime-rendered rubble, a hipped red tile roof,
    round-headed lights under keystones), so its walls follow from them (loopholed render, square towers under hipped
    roofs).
  - **The hill fort:** belongs to an older people with their own language and their own fort.
  - **The look:** the art direction is a palette in words over a morning cube.
  - **The cast:** the hero, the party of four, the packs (the raiders beastfolk) and the feel are the book's own.

  Its hub, Hollin, is the walled street every way leads back to: the shop walked into, two houses entered at their
  doors, the town's people in it.
- **A beast-kin's tail streamers no longer break its figure.** A trickster or a noble of a people near the beast wears
  streamers on a tail that shows, and a tail ring rides the tail too. Both were tied to `tail1`, a chain's second link,
  but the hero-door beast-kin's tail is one part (`tail`) and a mascot's brush or thick tail is one shape (`tail0`).
  On those bodies the figure threw, and with it the whole `design_game` run that made it: Hollin Vale's wolf-folk
  raider stopped it. Each now rides the tail part the body has (`outfit-plan.js`); a chain's is `tail1` as before.
- **Two tests caught up with this branch.** The composed-goals byte pin is re-pinned: a composed world's builders are
  its cube's when the prompt names no building language. The own-moves test reads the per-foe steps: people foes play
  the hero door's reactions plus their swings, beasts play their own flinch, fall and rise, and a bat has no fall at all.
- **The book reads the battles back.** The gameworld bible has a Battles part (`gameworld/battles-page.js`), so what
  the run lays can be read in the book:
  - **The party:** each member and their class.
  - **The road:** every pack in the order it's met across the stages, the boss last.
  - **The foes:** each one as it stands (a beast, a people, a person), with the book's own looks marked, and as it
    fights.
  - **The shops:** what the merchant sells at what price, and the inn's night.
  - **The hub:** the town every way leads back to, its street, walls and rooms, and the folk who keep its shop and its
    inn.

  The agent's battles card (`gameworld-battles`) names `looks`, `shops` and `hub` as well, and its byte ceiling is
  raised to 4864. Hollin Vale's road is written out whole: eleven packs and the boss over its six fighting stages, so
  the last pack no longer repeats.
- **A crenellated tower carries its roof cover.** A town's own fortification (`fortOfLanguage`) left a crenel-crowned
  tower without its cover or value, and its turret's roof then drew with no colour. Seeded forts always carried both;
  it now does too.
- **A `design_game` run keeps its record as it goes.** Each step made or remade is written into the stored world at
  once (in place: a gameworld keeps no revisions), instead of only at the run's end. A run cut off partway, by its
  process ending or a host's time limit, used to leave every row it made unrecorded, and every later run read those
  rows as hand edits and left them alone (`taken`) until a forced run remade the whole game. Now the next run keeps
  them as its own.
- **The book can name a rolled party member without moving the roll.** A casting page's `cast.<id>: { name }` (or
  `joins`) alone is the scale's own member under the book's words: `party-2: { name: 'Wren' }`. It used to be refused
  for want of a relation. Hollin Vale names its party: Aldren, Rowan, Wren and Sorrel, its hero a fighter. Unnamed, a
  member's box still reads its archetype.
