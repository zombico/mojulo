### The JRPG starter, continued: the wilds as a world map

- **The wilds are a world map in the round's second ring.** A party RPG's wilds are now the world map's blocks
  (`gameworld/world-map.js` `wildsLevel`), not a trail walk:
  - three blocks walked out from the town: a road, then ruins, then the far wilds, each laid by its template of the
    trail library;
  - a page a block (zoned), crossed at the plan's gates;
  - the first block has the road back to the town;
  - the far block has the way on to the core, gated by its key;
  - a pack stands on each block's way past the first, met as a battle by walking up to it, and none in the block the
    town opens on.

  A second stretch of wilds reads as its own place: the same blocks under other names. A megaworld's ring now takes a
  zoned map as one of its zones.
- **The wilds' ground is quiet.** The round's grit is the town's stone. Painted over open ground it set every tile in
  relief, and a block's page weighed about four times its quiet weight (128 MB against 36 MB), so the wilds' cube
  wears none (`grit: 0`, said in `brief.round.quiet`). The town and the castle keep it.
- **A JRPG wears the console RPG's plain blue windows.** Its battles, its talk box and its HUD are drawn in a new theme
  card, `classic-rpg` (`playscape/ui/theme-cards/`): the console RPG's blue, a double white rule and a gold marker, with
  nothing behind or over the windows (no brushed metal, no plinth, no heading tab). A composed party RPG names it
  (`ui: { theme: 'classic-rpg', colour: 'theme' }`), and a JRPG's world look by its intent is the same card
  (`playscape/ui/interface-look.js` `INTENT_LOOKS`). A battle whose level names no UI guide of its own now wears the
  level's look, so the battle, the talk box and the HUD are one game's windows; with neither, it draws as before.
- **The battle's command window beside the one acting.** While a member picks, their window (commands, then a skill or
  an item, then a target) stands beside that member's own bar over their head, follows them to wherever the view
  puts them, and is held inside the screen, clear of its bottom; with their bar off the screen it keeps its corner
  (`playscape/rpg/rpg-ui.js` `pick`, `scene/channels/rpg-channel.js` `besideAt`).
- **Picked, the window goes and the action plays.** A member's commands no longer stay drawn under the round while it
  plays (the channel closed only the top screen; it now closes them all).
- **A JRPG fights one turn at a time.** A composed party RPG's battles are on the timeline (`rules.turns:
  'timeline'`): each member picks when their turn comes and acts at once, the foes between them, never the whole
  party choosing before a round plays.
- **A bar over every fighter, up when it matters.** A foe now has the same bar over its head as a member (its HP as a
  bar, its numbers kept back, where the book shows foes' HP: a JRPG's `rules.foeHp: 'bar'`), and the foes' box and the
  turn order are gone. The bars are up on the player's turn; while a round plays they are down, but for a fighter whose
  numbers just moved (a blow, a heal, a spell's cost), shown for as long as it takes to read.
- **Townspeople who follow the story: a person's pages.** A person's `characters.folk.say` may be a list of pages,
  `[{ if?, say }]` (`folk/pages.js`), RPG Maker's event pages in words: read top to bottom, the first whose `if` holds
  is what they say, and a page with no `if` always holds. Its conditions are a scene's (`flag`, `not`, `has`, `done`,
  `chapter`, `var`). In the talk box each page is a scene on the person's one talk, held to its own `if` and to every
  page above it failing, so exactly one is said each time. In a talk menu (a world without the game's UI), the default
  page. A level whose folk read the store carries the story's flags and reads the bag and the campaign for them, as
  its story's scenes do.
- **A JRPG's priest follows its gate.** A composed party RPG's priest says where the core's key is kept until it is
  held, then that the way is open (`brief.round.talk`); the operator's own `say` takes its place.
- **Save points: saving steps out.** A megaworld may name the zones that keep a save point (`megaworld.saves`). Where
  the party comes into such a zone, a press asks "Save your journey here?", and yes takes a way out to the same map
  (`reach-exit`'s new `by`: a way taken by an event, never walked into). The store is written as at any crossing, so
  a save keeps the rule that the store is written only when a level is left, and the map loads again with the party
  set down beside the save point. Saving completes nothing. A composed party RPG keeps one in its town and in each
  stretch of its wilds, none in the castle or the core.
- **Save slots.** A game may offer its title several saves (`slots`, 2 to 4, `game/game-manifest.js`): in the play
  shell's mana-ui front, start or continue first asks which slot, each said by where its party stands, the one in use
  marked. Each slot keeps its own store, the flow's steps it has seen and a level's own progress; slot 1 is the game's
  own keys, so a game saved before it had slots continues as its first. Starting in a slot begins it anew; continuing
  an empty one starts it. A game's runs and bests stay the game's. A game whose megaworld keeps save points offers
  three.
- **A foe's action pattern.** A foe may say what it does and when (`play.rpg.foes.<id>.pattern`, and so a world's
  `battles.foes`): rows of `{ use: 'attack' | 'guard' | '<skill>', when?: { hpBelow?, hpAbove?, turn?, every?, after? },
  weight?: 1-9 }`. On its turn, a row whose `when` holds and that it can pay for, chosen by weight on the battle's own
  dice; with none holding, the rule every foe keeps (a skill by chance, else an attack). A guard it takes lasts until its
  next turn. A foe without one fights as it did.
- **A fight's own pages (RPG Maker's troop events).** An encounter may carry `pages` (`play.rpg.encounters[].pages`, and
  a world's boss fight through `battles.bossPages`): `{ when: { start: true } | { foe?, hpBelow } | { round }, say, who?,
  sets? }`, each said once in the message line the first time its moment holds; the page channel says `rpg-page:<fight>:<n>`
  on the bus, and the flag it sets.
- **A JRPG ends on a boss battle.** A composed party RPG's boss is a party battle (`battles.boss`: the Ember Drake, the
  core's last pack, no escape from it), with a line as the fight begins and one at half its HP; before, the words' boss
  was a real-time goal's and stood in the crypt without a fight.
- **A battle's opening says all it has.** The opening played only its first beat and went to the picks; it now plays
  each in turn, so a fight's opening page, and on the timeline the foes who act before the first pick, are seen.
- **States as a table.** A fight's states are no longer only poison, sleep and silence: a world may name its own
  (`play.rpg.states`, and a world's `battles.states`), each by what it does: `skip` (its turns held), `noCast` (no skill
  that costs MP), `miss` (a share of its blows go wide), `wild` (its blows at anyone at all), `tick` (a share of its HP
  each turn, hurting or mending), `wake: 'hit'` (a blow ends it), lasting its `rounds`. The starter book's: paralysis,
  blindness, confusion, burn, regen (`presets.js` STATE_PRESETS), pulled in where a skill or an item names one. A skill
  inflicts one and an item or a skill cures one as the three were; a fallen fighter is rid of them; the bar over its head
  says them; a member held by one is not asked to pick. A fight that meets none rolls the same dice as before.
- **Crossings: travel by ship or airship.** A megaworld may name ways taken aboard beside its rings' own
  (`megaworld.crossings: [{ from, to, by: 'ship' | 'airship', needs? }]`): each a link (`links[].by`) shut until its
  story flag where it names one (a quest's, or the boss's `battles.sets`), out and back, and an exit's `crossing` in the
  game. Leaving by one, the play shell shows the trip while the next map is built in place of the loading veil: a ship
  bobbing on drifting waves under a low sun, or an airship over drifting clouds, "Sailing to" or "Flying to" the place,
  for 2.6 s at least and until the map is drawn. A crossing can join the world further than its rings: an isle, or
  another mandala.
- **The screen and sound as words.** A cue's (or a scene's `do`) `screen` effect: `{ fade: 'out' | 'in', tint:
  '#rrggbb' | 'none', flash: '#rrggbb', for? }`, a fade to black and back, the world washed in a colour, a flash,
  undone after `for` seconds or when the cue ends, drawn by the page's screen layer (`scene/channels/screen-fx.js`,
  emitted only where a level uses it). A cue's `sound: '<word>'` plays a sound off the SFX shelf by its word as it
  fires (`sfx:<word>` on the bus, voiced by the level's sound sheet). A composed party RPG is sounded and scored (its
  `sound` and `music`), as the action RPG's world map is.
- **Battle music.** A world of party battles asks its cue sheet for a fight's score on every level it fights on (not its
  hub) and the boss's on its last; the level's score turns to it while a battle is up and back after, the meter held
  full by `rpg.battle` however long the picks take (`audio.tension.held`, `beats/adaptive-music.js`: a bus var that pins
  the meter while it is set). A building level of a sounded game (a dungeon, a keep) now has its sounds and score as a
  trail's level does; before, it was silent.
- **The party menu's Item and Formation.** Two tabs beside Status, Class, Equip and Skills:
  - Item: a battle item from the bag used outside a fight, on the member in focus or, an item for allies, on all the
    party (a heal, MP, a revive, a cure); one that would do nothing is not spent (`kernel.js` fieldUse).
  - Formation: the member in focus traded for the one picked, the order the party fights in and, where it fights fewer
    than it has (`rules.size`), who is at the front and who in reserve (`kernel.js` swap). The order rides the party's
    save once it is set; a save that never set one is as it was.
- **The conversation's path to a JRPG.** A party RPG's pitch, locked with no level yet, is laid as the round (the
  `isekai-party` rail's own `starter`, `gameworld/rails.js`: a walled town, the wilds, a castle and a dungeon with a
  boss, four levels), not one plain level of its genre. Its designed chain teaches the round's steps before its first
  level (a rail's `steps`): the round (the mandala, its save points, a crossing), the battles (the party, the boss with
  its pattern and pages, the states) and the talk (the townspeople's pages), each on the card that owns it; its first
  level is said as what is laid. The cards teach the new words: the world card the megaworld's `saves` and
  `crossings`, the folk card a person's pages, the battles card and play.rpg's (PARTY BATTLES) a foe's pattern, a
  fight's pages and the world's own states.
- **Traits on classes and gear.** A class or a piece of gear may carry `resist` (elements taken at half), `immune`
  (elements taken not at all) and `ward` (states warded off): a member takes its class's and what it wears as it
  stands. A world that names none fights as it did.
- **The temple and the smithy keep shop.** A party RPG's town with a temple on its street has the temple's rite (a
  shop's `raise`: each fallen member raised, healed and cured, for its gold; `rpg-raised:<shop>` on the bus), opened by
  its priest; one with a smithy, the smithy's arms and armour, opened by its master. A keeper whose say is paged says
  their page, then opens the shop as the talk ends. A trade's shop is laid only where its lot's door is on the town's
  stage (a small town's square may leave one without frontage). The folk sheet's shrine is built; the smith's mending
  and bettering stay a gap.
- **A fight's page that acts.** A fight's page may give a foe back a share of its HP (`heal`: the foe its moment names,
  else every foe standing) and call foes into the fight (`summon: [foes]`, six fighting at most), fought and counted in
  the spoils like the rest. A summoned foe's figure is the next in the encounter's `who`, minted dormant and woken in
  smoke where it stands. A fight whose pages only speak is as it was.
- **A change of music from an event.** A cue's (or a scene beat's `do`) `music`: a mood of the score (a field mood, or
  a club's) played in place of the place's, `stop` for silence, `place` for the place's own again. Each mood a level
  names is a piece of its audio in the soundtrack's identity (`audio.pieces`, `beats/beats-world.js`), faded in on an
  engine of its own as the score fades out; while it plays, a fight's change of score waits. A level that names none
  emits not a byte of it.
- **A number put in.** A menu of kind `number` (`ask`, `var`, `digits` 1 to 8, `min`, `max`, `then`): its digits turned
  up and down and moved along, accept writing the number to its var, held to its bounds, before its effects; a cue that
  reads the var after the pick is a code lock or a count.
- **A walk that finds its way.** A cue's walk may say `find: true`: each leg walked round what stands in the way (the
  runtime's pathfinder, `worlds/controllable/nav.js`), arriving only at the places it named, by an opt-in builder
  (`worlds/controllable/route-find.js`) composed into a page only when a cue of its world walks so. Without it, a walk
  is as it was: straight lines, stopped at a wall.
- **The fights acted out, and varied.** The member picking steps out of the line; one who attacks runs up to its target,
  strikes and goes back; one who casts or uses an item steps out; a foe lunges the same way (the page's stepping,
  `rpg-channel.js`, played by the controllable channel's battle acts with the run clip on the way in). Every party
  member and a battles world's hero are made with a party battle's repertoire (`egocube/moves.js` `battleMovesOf`):
  three attacks by role, a cast and an item gesture, three recoils beside the stagger, a ready stance held through the
  fight and a win pose the whole party strikes. The page plays a figure's strikes and recoils in turn, so no blow
  repeats the one before. The acts reach the page by name (`fig.battle`), not as second copies of their clips. Before,
  the hero had no strike at all and each companion one move.
- **Weapons in hand by class.** In a world of battles, each party member who is a person, and the hero, is made holding
  its class's weapon (`egocube/moves.js` `WEAPON_OF_CLASS`: the fighter a greatsword, the knight a sword and a shield,
  the rogue a dagger, the mage a short staff, the cleric a mace; the monk its fists; a long staff is swung from the
  wrong end, so a caster's is on an arm's haft), passed to its mint as the hero door's `gear`.
  Its three attacks are the held swings (the cut, the thrust, the cleave) that the page bakes on its own rig at the
  weapon's weight, so the fists are not minted for one who holds a weapon. Before, the party fought with fists, its
  swords and staves numbers alone.
- **The foes' own repertoires.** A party battle's foes on the field are made with their own moves (on a board, as
  made):
  - A beast has its lunge and its other ways at a foe (`fauna/behavior/strike.js`, each a clip of its own built from
    its posed body): the **snap** (barely gathered, a quick bite), the **maul** (reared up, brought down low and far;
    a body on legs only) and the **roar** (up tall, the head high, held). It plays the lunge, the snap and the maul in
    turn (`egocube/moves.js` `beastMovesOf { battle }`). The animal door takes them too, as words (`snap`, `maul`,
    `roar`) or `motion.strikes`. A body that cannot strike yet (a bat, a swimmer) has none.
  - A people or a person foe carries a member's repertoire by its role and a roar (`foeBattleMovesOf`; a people's
    sheet made with `moves: 'battle'`).

  Before, a beast in a party battle had no blow at all, and a person foe one.
- **A boss's roar and heavier lunge.** A boss's fight opens with its foes' roar (the `boss` juice: `act: roar, at:
  foes`). A boss runs up slower, strikes longer, and the camera shakes as it lands.
- **A summoned foe's entrance.** A foe a page calls in roars as it appears out of the smoke (the `summon` juice).
- **Everyone channels.** A new pose, `channel` (`polygonizer/hero-aura.js`, the `spell` family): feet set broad, both
  hands drawn up from below to cup a gathering power before the chest, palms to each other, the eyes on it, swelling as
  it fills. Any hero takes it as a motion word. In a party battle every fighter has one: each party member and the
  hero (`battleMovesOf`), each person foe, and each beast that can strike (its own way, `channel`, in
  `fauna/behavior/strike.js`: drawn in, then hunkered low, the head down and still). A skill used channels first and
  then casts: the `cast` juice is `act: channel, then: cast` (an act's new `then`: an act it goes on into, the beat held
  while the first plays). One without its own channel stands in its ready stance while it gathers.
