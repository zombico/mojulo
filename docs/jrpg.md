# The JRPG starter

A party RPG made the way an RPG Maker game is made, from mojulo's own pieces. RPG Maker's three ideas map onto
mojulo's:
- **The database is the recipe's `play.rpg`:** the party, classes, skills, items, gear, foes and encounters
  (`playscape/rpg/`).
- **The map is a place the cubes grow:** a fortified town, a castle, the wilds and a dungeon.
- **The event is a thing with pages, written in words.** Its lines go through the talk box, and it is lowered onto the
  cues and scenes the page already runs.

The aim is parity of outcome, not of editor. mojulo grows a 3D world rather than drawing one tile by tile, the hero
walks freely rather than stepping on a grid, and battles are drawn over the field.

## What a JRPG intent lays

Words that name a party RPG (`design_game { compose: { prompt } }`, a `jrpg` intent) lay the world round its town
(`gameworld/compose.js`):

| level | what it is |
|---|---|
| the town (the hub, where the game starts) | A walled street: the shop walked into, and the **inn** and the **temple** entered at their doors. Its folk live there. |
| the wilds | The world map's blocks (`gameworld/world-map.js` `wildsLevel`): a road, ruins and the far wilds, a page a block crossed at its gates, a pack on each block's way past the first. Their ground is quiet (no grit: on open ground it weighs a page four times over). |
| the castle (when the words name one) | **The castle walked:** its ward on the trail, closed by the castle's own fortification, and its keep entered at its door. Inside the keep are the gatehouse, the great hall, the chapel, the solar and the treasury (`era/programs.js` `keep`). |
| the dungeon (when the words name one) | A building of its use (a crypt by default), the boss at its end. Reached through a gate. |

**What it is about.** A party RPG's words compose its **game brief** (`gameworld/gmn.js`): a motivation (the why:
save the princess, save the world, reunite with family, solve the mystery, find the treasure, stop the virus) and a
labour (the how: storm the citadel, conquer the map, cross the great sea, be the very best…), each read from the words
people say for it (`GMN_WORDS`: princess, citadel, sea, sister…), the first named the lead. Where the words name none, a
JRPG's own: save the world by storming the citadel. The brief is stamped as any is: its stakes, its ending, its acts,
its colour script and light, and its orders (the first level, the climax), said in `brief.round.brief`.

The labour's shape is the round's (`gameworld/megaworld.js`), the town where it sets out and the core gated by its key,
found in the zone the round reaches before it; the core's first win ends the game in each:

| shape | labours | the round |
|---|---|---|
| mandala | storm the citadel | rings travelled inward: the town, then the wilds and the castle round it, the core at the centre |
| chain | cross the great sea, the Campbellian journey | map after map, one way on: the wilds in order, the castle last, the core the far end |
| hub | be the very best, catch them all | the town joined to every zone, the core among them (the megaworld's `end`) |
| open | conquer the map, 100% the tasks | one ring, each zone joined to its neighbours, none the only way on (its `end` the core) |

The travel screen draws each shape's rings; save points, the game over, the chests and the quest are laid in each.

**Its era.** A party RPG's round is reskinned in its setting's era (the world's kit's era, `cast-setting.js`
`ERA_OF_KIT`; `gameworld/round-eras.js`): the presets' numbers kept (each foe's, item's and gear's stats, prices and
drops), what each is called and how each foe looks the era's. A fantasy era (rustic, myth) is the presets as they are.

| era | its foes | its items | its boss | its citadel |
|---|---|---|---|---|
| future (an alien world: "sci-fi", "space", "futuristic", "alien"…) | machines in an animal's shape (the `techno` and `transmetal` oozes: a Nanite Blob, a Hound Unit, a Heavy Mech), the hive's insect people, troopers | Med-kits, Energy Cells, a Plasma Blade, a Flak Vest | the Core Sentinel | barracks, a lab, command |
| modern | strays and vermin, thugs, a cult leader | First-aid Kits, Energy Drinks, a Baseball Bat | The Boss | guardhouse, a warehouse, an office |

Its levels are named by its place word (a colony, not a meadow); a foe in an era's look holds no kind's arms. A new era
is a row.

**The quest in the journal.** A round laid as a mandala keeps a quest in the journal (J: `play.quests`, every level
keeping it, its flags carried), named for what the round is about (its motivation: "Save the city, the kingdom, the
world", "Save the princess") and walked as the round is: find the core's key where it is kept ("Find the crypt key in the
castle."), go into the core, and, where the core keeps a boss, bring it down. Each step's flag is raised by what happens:
the key's pickup on the stages of the level that keeps it, the core begun, the boss's fall (`battles.sets`). A world's
quest step may be raised so by any event (`{ log, done, on: '<event>' | 'start', at?: '<level>' }`, `story.js`
`questRaises`), as well as by a moment's or an answer's flag.

**The citadel.** Where the labour's climax is a citadel (storm the citadel), the round's core is a **walled core**
(`wcd/wcd.js`) over its level, layer on layer on its critical path: a guardhouse (an outer, crossed), its vault (the
dungeon the words name, else a crypt), and its sanctum at the heart (the `citadel` program's rooms), each built as a
building of the core's complex and fought through (the packs in the rooms on the way, the boss in the sanctum). Its
doors' gates are design words (the WCD's principles read them); the way in is the mandala's key. A citadel the words name
("citadel", "fortress", "stronghold", "lair") is always laid, its boss with it; the JRPG's own labour, unnamed, builds it
only where the words lay a dungeon, so a round of a town and its wilds stays one. Said in `brief.round.citadel`.

A round of three levels or more is laid as a **mandala** (`gameworld/megaworld.js`), rings travelled inward (a town
and one stretch of wilds stay a plain hub):
- the first ring is the town, where the game starts;
- the second is the wilds and the castle, each a road from the town and back;
- the core is the last level (the dungeon, else the castle, else the farthest wilds). Its way in runs from the farthest
  wilds and is gated by a key found on the way: in the castle when the castle is not the core, else in the farthest
  wilds (`crypt-key`, `castle-key`).

The megaworld lays the links, so the shell's travel screen draws the rings with the core at the centre, a fight won
stays won when a place is gone back to, and the core's first win ends the game. The town stays the hub, its keepers the
world's shops.
- `brief.round` says what was laid: the castle's level, the dungeon, the trades on the street, and the mandala (its
  core, its key and where the key lies).
- A party RPG's world carries the game's UI (`ui: { theme: 'classic-rpg', colour: 'theme' }`), so its levels host the
  talk box. Its battles, talk box and HUD wear the console RPG's plain blue windows (the `classic-rpg` card: a double
  rule, a gold marker, nothing behind or over them). A party game's layers (stacked plates, metal, a heading tab) are
  not a JRPG's.
- Its battles are fought a turn at a time (`battles.rules.turns: 'timeline'`): the member whose turn it is picks in a
  window beside their own bar, which goes as the action plays; then the next turn, a member's or a foe's. Every
  fighter, a foe too, has a bar over their head (no foes' box, no turn order): up on the player's turn, and while a
  round plays only over one whose numbers just moved.

## The town's trades

A street's `enter` may name a **trade** where it names a use (`era/town-trades.js` `TOWN_TRADES`):

| trade | stands on | inside | kept by |
|---|---|---|---|
| `inn` | a shop, else a house letting beds | a tavern (taproom, kitchen, snug, cellar) | the innkeeper: the world's inn, the party's rest |
| `temple` | a hall, a tower, else a house | a temple (narthex, nave, sanctuary) | the priest: the temple, where the fallen are raised for gold |
| `smithy` | a workshop, else a barn | a work floor | the master: the smithy, its arms and armour (mending and bettering gear is a gap the folk sheet says) |

The lot keeps its shape, so the street is drawn as it was. Only who keeps the lot and what is inside change. A new
trade is a row.

## The folk talk in the talk box

In a world with the game's UI, each townsperson's lines are a scene (`gameworld/folk-cast.js`, `talk: 'box'`). They
speak it in the talk box: their name over it, their own body drawn live in its portrait, and it plays each time they
are spoken to.
- A keeper of the world's shops opens the shop, the inn, the temple or the smithy. One whose say is paged says their page
  first and opens it as the talk ends.
- One in a sidequest's chain keeps its menus.
- In a world without the game's UI, the folk keep their talk menus.

## Talk that follows the story

A person's `characters.folk.say` may be a list of pages (`folk/pages.js`), RPG Maker's event pages in words:

```json
{ "say": { "priest": [
  { "if": { "has": "crypt-key" }, "say": ["You carry the crypt key.", "The way to the crypt is open to you now."] },
  { "say": ["The crypt is sealed.", "Its key is kept in the castle."] }
] } }
```

- Read top to bottom: the first page whose `if` holds is said; a page with no `if` always holds.
- `if` is a scene's condition, or a list of them: `flag`, `not`, `has: '<item>'`, `done: '<level>'`, `chapter`, `var`.
  A won fight sets `won-<encounter>` under a megaworld, so `{ flag: 'won-<encounter>' }` is "after that fight".
- In the talk box each page is a scene on the person's one talk, held to its own `if` and to every page above it
  failing, so exactly one page is said. In a talk menu, the default page.
- A composed party RPG's priest follows the mandala's gate: where the core's key is kept, then that the way is open.

## Saving

The play shell writes the game's store whenever a map is left, and a megaworld's Continue resumes on the map the party
is on. A **save point** (`megaworld.saves: [zones]`) stands where the party comes into a saving zone: pressed, it asks,
and yes steps out by a way to the same map. The store is written as at any crossing (the store's rule: written only when
a level is left, so a save can be replayed), and the map loads again with the party beside the save point. A composed
party RPG keeps one in its town and in each stretch of its wilds.

**Save slots** (`slots` on the game, 2 to 4): the title's start or continue asks which save, each said by where its
party stands. A game with save points offers three.


**Game over.** A composed party RPG (a round of battles fought on the field, lost as a defeat) ends a lost fight in a
game over (the game's `gameOver`, `game/game-manifest.js`). The fight lost is never kept: the store stays as it was last
written, where the journey was last kept (its last way taken, or a save point). The game over screen offers continue,
which takes the journey up there (the save's continue level, the map the party was on), or quit to title. In the play
shell's flow it is a screen of its own, `gameover` (`continue`, `home`): a lost level goes there in place of the result
(`game/flow.js` `defaultFlow`). Any play-shell game may ask for it (`gameOver: true`).

## Foes that fight to a plan

A foe may carry an **action pattern** (`battles.foes.<id>.pattern`, RPG Maker's action patterns in words): rows of
`{ use, when?, weight? }`. `use` is `attack`, `guard` or a skill; `when` is its HP below or above a share, its nth turn,
every nth, or from its nth on; `weight` (1 to 9) how often it is chosen among the rows that hold. With none holding, it
keeps the rule every foe has. A row with `charge` (true, or the line said, `{name}` the foe's) is **telegraphed**: the
foe spends that turn gathering, said in the message line and played as its channel (the juice's `charge`), and on its
next turn lets the blow or the skill go at twice its power (the juice's `unleash`). A guard takes half of it, as of any
blow, so the turn between is the party's to brace or mend.

A foe may take **phases** (`phases: [{ below, say?, pattern?, weak?, resist?, absorb?, immune?, atk?, def?, mag?, spd? }]`,
each `below` under the one before): the first time its HP falls under a phase's share it takes that form, what the
phase names replacing its own (its pattern, its traits, its numbers) on that fight's foe alone, said in the message line
(`say`, `{name}` the foe's; else "<name> changes!") and roared (the juice's `phase`). A hit through two shares brings
both, in order. A page at the same share still speaks first, so a boss's line leads into its change.

```json
{ "foes": { "warden": { "hp": 400, "atk": 14, "def": 12, "mag": 10, "spd": 6, "boss": true, "pattern": [
  { "use": "guard", "when": { "turn": 1 } },
  { "use": "firestorm", "when": { "every": 3 } },
  { "use": "heal", "when": { "hpBelow": 0.5 }, "weight": 9 }
] } } }
```

A fight may say things as it goes (`pages` on an encounter, a world's boss fight's through `battles.bossPages`, RPG
Maker's troop events): `{ when: { start: true } | { foe?, hpBelow } | { round }, say, who?, sets? }`, each said once in
the message line the first time its moment holds, `sets` a story flag as it is said. A page may also act as it is said:
`heal: share` gives back that share of HP to the foe its `when` names (else to every foe standing), and `summon: [foes]`
calls foes into the fight, six fighting at most. A summoned foe's figure is the next in the encounter's `who` past its
foes', minted `dormant` (hidden), and woken in smoke where it stands (a pack's one figure stands for all its foes). A composed party RPG's boss is a
party battle (`battles.boss`, the Ember Drake by default) that speaks as it begins and at half its HP.

**The boss, measured.** The Ember Drake is tuned to the party the round's ladder makes. `gameworld/boss-law.test.js`
walks it for real on sixteen seeds (`battles.js` `PACKS` in order, resting between fights as at an inn), so the party
meets the drake with the levels, class points and spells it earned (level 6 or 7, Blizzard and Thunder learned), then
plays the boss four ways: careful (bracing for the charge, mending, striking its weakness as it stands, an ether when
the mage runs dry), the same unbraced, the same striking the weakness it first showed after it has changed, and
careless (only attacking). It holds the drake to a boss's shape: the careful party wins nearly always and the careless
one mostly falls, a party that skipped the ladder's last two fights wins less often, bracing and reading its second
form are each worth winning, and the fight lasts 8 to 20 rounds. The drake breathes a charged blast every third turn;
under half its HP its scales blaze (its second form): it drinks the cold that hurt it and fears thunder, bites and
breathes harder, and charges its breath every second turn. A boss retuned, or a new one, answers to the law.

**The story's bosses.** A party RPG's boss is the one its story calls for (`gameworld/round-bosses.js`, by the brief's
labour, `gmn.js`): the Ember Drake guards a citadel and the innermost cave, a Leviathan waits at the far shore of a sea
voyage, the Champion in the final hall of a tournament, the Warlord in the last stronghold of a conquest, the
Thunderbird at the end of the map when the party is catching them all, and the Colossus beneath what opens once every
task is done. Each is a preset foe (`playscape/rpg/presets.js`) with a telegraphed blow and a second form that turns its
weaknesses round, a look and its kind's arms (`battles.js` `FOE_LOOKS`, `FOE_ARMS`), a height, and lines as its fight
begins and at half its HP; each has its era's version (`round-eras.js`, its name and look among the era's foes), and each
is held to the boss law (`gameworld/boss-law.deep.test.js`). A story the words named always lays its boss at the core.

**Editing a boss.** A composed world writes its boss out whole in its battles, so every part of it is the person's to
change with `update_sketch`:

```json
{ "battles": {
  "boss": ["leviathan"],
  "foes": { "leviathan": { "name": "Old Tidecaller", "hp": 720, "atk": 24, "def": 12, "mag": 21, "spd": 9, "boss": true,
    "weak": ["thunder"], "absorb": ["ice"], "skills": ["tidal-wave", "bite"],
    "pattern": [{ "use": "bite" }, { "use": "tidal-wave", "when": { "every": 3 }, "charge": "The sea rises behind {name}…" }],
    "phases": [{ "below": 0.5, "say": "{name} sheds its frozen scales!", "weak": ["fire"], "absorb": ["ice", "thunder"] }] } },
  "looks": { "leviathan": { "species": "seaSerpent", "ooze": "frost" } },
  "heights": { "leviathan": 3 },
  "bossPages": [{ "when": { "start": true }, "say": "The water begins to churn." }]
} }
```

Its numbers, its pattern and phases, its look (any beast in a character door's words, a people with `gear` of its
own), its height (`heights`, 0.3 to 12 m, a beast's) and its lines are each a field. `boss` may name another preset, or
a foe of the world's own defined in `foes` beside it, with its own look and height: a person's own boss is laid as
readily as a starter. A boss retuned answers to the boss law where it is a preset.

**Traits** (RPG Maker's traits), on a class or a piece of gear: `resist` (elements taken at half), `immune` (elements
taken not at all) and `ward` (states warded off); the **rates**, each a share added to the fight's own: `hit` (its
blows surer), `eva` (blows at it go wide) and `crit` (its blows critical more often); what a **plain blow carries**:
`element` (a flame sword's fire, so it strikes a weakness) and `inflict: { is, chance?, rounds? }` (a poison dagger's,
left only where the blow lands); and the skills it `grants` while worn or held (an ember ring's Fire, to a fighter). A
member carries its class's and what it wears, gathered as it stands (the weapon's element and inflict over the
class's), so a ring against fire is put on before the drake. A foe names its rates, element and inflict as its own
fields, and a state may carry rates (a haze that makes its bearer hard to hit). The rates only move the fight's own
dice, never add one: a world that names none fights exactly as it did. The starters: the Venom Dagger, the Flame
Sword, the Hunter's Charm, the Shadow Cloak and the Ember Ring, sold from the second and third shops on.

**Effects** (what a skill or an item does beside its blow), on a skill: `hits` (2 to 8 strikes, each its own swing,
while the target stands); `damage` in another form: `gravity` (its power the share of the target's HP as it stands:
a quarter, whatever its guard; the bosses are immune, `immune: ['gravity']`), `fixed` (its power exactly), `pierce` (no
defence against it) or `mp` (taken from the MP, not the HP); `drain` (the share of what it dealt the user takes back,
HP, or MP for MP damage); and `steal` (a foe's first drop into the bag, once a foe; with power, a mug). An item may leave
a `status` (a sleep powder's on every foe) or give a `buff` (a tonic's on an ally). None of them rolls a die where it
is not used, so a world that uses none fights as it did. The starters, bought on the class trees (never learned
unasked): the rogue's Steal and Mug, the fighter's Armor Pierce and Twin Cut, the mage's Drain, Osmose and Gravity; and
the Power Tonic, the Sleep Powder and the Smoke Bomb in the shops.

**What a state does** (`play.rpg.states`, a world's own or a preset's by name): beside holding a turn (`skip`), barring
casting (`noCast`), sending blows wide (`miss`), striking anyone (`wild`) and HP each turn (`tick`), a state may scale
its bearer's numbers (`stats`: a haste's speed ×1.5, a slow's ×0.6), scale the damage it takes (`takes: { blow?, spell? }`:
a barrier's blows, a shell's spells), put it in a frenzy past commanding (`berserk`), turn a spell aimed at it alone
back on its caster (`reflect`), draw the foes' aimed blows and spells to itself (`taunt`), fell it as it runs out
(`doom`), and carry rates. `stack` says what a second cast on a bearer already in it does: `refresh` (its rounds anew,
the default), `keep` (nothing: a second Doom is no reset) or `add` (its rounds added, nine at most). The presets: haste,
slow, barrier, shell, berserk, reflect, taunt, doom, and the skills that cast them (Haste, Slow, Barrier, Shell,
Reflect, Provoke, Frenzy, Doom), a world's to put on a class's tree or grant: they sit on no preset tree, so a world that
names none carries no states table. The bosses are immune to Doom. Petrify (a fighter out of the fight but not fallen)
is not yet a behaviour.

**Reactions** (what a fighter does on another's turn), a trait on a class or gear, a foe's own field, or a state's:
`counter` (the chance it strikes back with a plain blow at one whose blow was aimed at it alone; a counter is never
countered), `cover` (it steps before an ally under 40% of its HP whom a foe's blow is aimed at, the first standing
coverer) and `revive` (the share of its HP it rises with as it falls, once a fight; a state's second life, Reraise, is
spent with it). Only a counter rolls a die, and only for a bearer that has one. The starters: the Riposte Ring and the
Guardian Crest in the second shop, the Phoenix Charm in the third; Reraise a world's to put on a tree or grant.

**Costs** beside a skill's MP: `hpCost` (the HP it costs, paid as it is used; its user must have more), `limit` (a limit
break: used only when its user's gauge is full, emptying it; the gauge fills with the blows the member takes, by their
share of its HP, shown in the skill list as LIMIT n%; a world with no limit break keeps no gauge) and `cooldown` (how many
of its user's turns it rests after use, shown as wait n). A foe pays as a member does, and never uses a limit break.
The starters: the fighter's Blood Blade (12 HP) and the mage's Meteor (rests three turns), bought on their trees; two
limit breaks, Braver and Healing Wind, a world's to put on a tree or grant.

**Rows and scan.** A world that asks for rows (`rules.rows: true`) stands its party in a front and a back row
(`party[].row`, the front unsaid): a member in the back deals and takes half from blows, never from spells or from a
ranged blow (a skill's `ranged`, or a weapon's: the Hunting Bow), and the Row command moves it, its turn spent; a save
keeps where each stands. A world without rows has no Row and halves nothing. `scan` on a skill or an item reads a foe
into the message line: its HP and what it is weak to, resists, absorbs and is immune to (the mage's Scan, bought on its
tree; the Scan Lens in the first shop).

**Openings.** A world that asks (`rules.openings: true`, or `{ first, ambush }`, the chance of each, an eighth unsaid)
opens a fight now and then with the party striking first (the foes sit out the first round; on the timeline the
party's gauges start full) or ambushed (the reverse, and where the party stands in rows, the rows turned about for the
fight). Never at a fight with no escape: a boss's opens as written. An encounter may say its own (`opening: normal |
first | ambush`), a scripted surprise. A composed party RPG asks for them.

**Key items, locked chests and mimics.** The party menu's Key tab lists what the bag holds that is no battle item, gear
or gold: the world map's keys (the crypt key that opens the way to the core), a locked chest's key, a quest's piece; a
world names them as `play.items` of kind `key`, else each is called by its id. A book's chests may be a share locked
and a share mimics (`battles.chests: { n, locked?, mimics? }`): a LOCKED chest says so until its Iron Key is won from
one of its stage's packs (never the boss), the bag holding it then opening the chest (and keeping it); a MIMIC is a
fight the chest stands for, sprung as the party walks up, its treasure had when it is won. A composed party RPG keeps
two a stage, one in four locked and about one in seven a mimic. The citadel's own gated doors are met in play as locks,
each opened by the key its guard carries (docs/walled-core-dungeon.md, Met in play).

**Joint techs** (`play.rpg.techs`, a book's `battles.techs`: true for every preset, a list, or the world's own
`{ needs, …a skill }`): a blow or a spell two or three members make together, each knowing one of its `needs`. A member
sees each tech it could make a part of in its skills, with whom it would be made, or "no partner"; picked, each maker
pays its own part's MP, the partners' turns are spent on it (in rounds they are reserved as the round is picked, so
none moves first; on the timeline their gauges empty), and it is made with their stat summed, so it outhits any one of
them. A familiar never starts one. The presets: Fire Strike and Frost Strike (a fighter's Power Strike with a mage's
Fire or Blizzard), Holy Cross (Power Strike and a cleric's Heal), Venom Flame (a rogue's Poison Blade and Fire, on every
foe) and Trinity (all three, on every foe). A composed party RPG asks for them.

**The round's story.** A composed party RPG is written a starter story from what it is about (`gameworld/round-story.js`,
the brief's motivation: saving the princess, the world, a family, solving a mystery, finding a treasure, stopping a
virus): its OPENING in the town (the game's opening slot: the flow's opening cutscene, staged on the town's page), a line
as the CORE begins, and its ENDING in the core (the game's ending slot: staged on the core's page, a citadel's too, after
the round's first full clear). Each is a story moment in the world's `story`, to change. A moment binds to a building's
stage (its start, its goal room, its boss's spot, its rooms by order and by name), and a level won or lost while a scene
is up ends as the scene closes, never under it.

**The temple and the smithy.** A party RPG's town whose street keeps a temple has a temple shop (`shops.<id>.raise`,
the gold to raise each fallen member, healed and cured); one that keeps a smithy has the smithy's, the arms and armour
among the town's wares. Each is opened by its keeper, and only where its lot's door is laid on the town's stage.

**States** (RPG Maker's states, `battles.states`): beside poison, sleep and silence, a world's own, each by what it does
(`skip`, `noCast`, `miss`, `wild`, `tick`, `wake: 'hit'`, `rounds`), or the starter book's (paralysis, blindness,
confusion, burn, regen) by name. A skill's `status: { is }` inflicts one, a `cure` lifts it.

## Treasure chests

A book's battles may keep treasure off the path (`battles.chests: n`, 0 to 4 a fighting stage; a composed party RPG
keeps two), each a chest standing a step aside from the way on a beat the packs leave free (`gameworld/chests.js`):
- **Opened** with E where it stands, everything in it goes into the bag at once and the find is said ("Found 2 potions
  and an ether!"), with the shelf's `chest-open` sound. Its loot is by how far on (`CHEST_LOOT`, the shops' tiers):
  potions, gold and starter gear first, then ethers and rings, then the dearer cures.
- **Opened again**, it says it is empty. Emptied, its shut body (the glyph shelf's `chest`) gives way to an open one
  (`chest-open`).
- **Kept opened.** What each still holds is a holder's count, kept in the store's `chests` slice by the bag (`holders`),
  so a level gone back to, or a save loaded, finds it open and empty.

It is a chest menu looted whole (`play.menus` `{ kind: 'chest', holds, loot: 'all' }`, RPG Maker's treasure event):
any level can stand one by hand.

## Travel by ship or airship

A megaworld may name **crossings**, ways taken aboard beside its rings' own:

```json
{ "megaworld": { "shape": "mandala", "rings": [["town"], ["wilds", "castle"], ["crypt"]],
  "crossings": [{ "from": "town", "to": "sky-isle", "by": "airship", "needs": "drake-slain" }] } }
```

Each is a way out and back, shut until its story flag where it names one (a quest's, or the boss's `battles.sets`).
Leaving by it, the play shell shows the trip while the next map is built: a ship on the waves, or an airship over the
clouds, "Sailing to" or "Flying to" the place. A crossing joins the world further than its rings (an isle, another
mandala), so the trip covers the load that a far place costs.

## A fight's results

A fight won ends on its results (the RPG's `rpg-spoils` screen, `playscape/rpg/rpg-ui.js`), once its last beat is told:
- what it paid: its XP, its gold, and what the foes dropped;
- for each member standing: its level and an XP bar to the next (or max level);
- a level gained: a Level up! badge and each stat it raised, before → after (the level beat carries both,
  `playscape/rpg/kernel.js` `gain`);
- a class rank risen and the skills learned.

Continue (or back) closes the fight, as before. A fight lost or fled has none.

## The party menu

P opens the party menu: Status, Class, Equip and Skills, and Item (a battle item used outside a fight, on the member in
focus or on all the party) and Formation (two members traded: the order fought in, the first `rules.size` of it at the
front). It saves at save points, never from the menu: the store is written as a level is left.

## What a member wears, seen

`battles.wardrobe: true` mints each party member once more for each armour its class may wear: its own body and dress
under the armour's build (the hero door's `adorn`), a figure per look (`gameworld/wardrobe.js`). The armour slot alone
sets the look, since it is what changes the outline; weapons are held as before. The presets are a row per armour of
the starter gear (leather armour a laced jerkin, the armour library's `leather` family; chain mail a hauberk of rings
with its coif, its `mail` family); `wardrobe: { <armour>: { adorn } | null }` is the
book's own over them (any armour card: plate, lamellar, leather, mail), null for an armour that changes nothing. Worn
over a member's outfit, the armour takes the place of its outer layer and its own armour pieces (a mantle, pauldrons,
bracers). The looks are the run's steps (`hero-look-<armour>`,
`cast-<id>-look-<armour>`). Every level lays them on the members' figures (`wardrobe.js` `wearLooks`: an entity's `looks: { base,
by: { <armour>: <figure> } }`); the page builds each look up front, and the RPG channel shows the one the member's armour
slot names, every frame: put on from the party menu, carried in from the store as a level loads, taken off by a class
change. The fight is played by the map's figures, so a member fights in what it wears. Dialogue heads stay the base
portrait.

The world bible's battles section shows what each wears: each member in its own clothes and in each armour its class may
wear, photographed where the run has made the look (`lib/mcp/tools/wardrobe-portraits.js`), else named. An engine
handoff's level record carries each member's looks on its marker (`looks: { <armour>: { figure, ref } }`): the ref is the
look's own made body, which `export_model` hands off as an asset. On the anime head mail is worn without its coif's head pieces (the drape over the
shoulders kept); a plate helm is refused there. Each look adds its own body to the level's page (about 0.8 MB a look on
the starter's party).

## The screen and sound in words

A cue's (or a scene beat's `do`) effects may touch the screen and play a sound:
- `screen: { fade: 'out' | 'in', tint: '#rrggbb' | 'none', flash: '#rrggbb', for? }`: a fade to black and back, the world
  washed in a colour, a flash; undone after `for` seconds or when the cue ends.
- `sound: '<word>'`: a sound off the SFX shelf by its word (a chime, a door), played as it fires.
- `music: '<mood>' | 'stop' | 'place'`: the music changes, crossfaded: a mood of the score (`sorrow`, `tension`,
  `prayer`…) in the level's key in place of the place's, silence, or the place's own again. While a mood plays, a
  fight's score waits.

A composed party RPG is sounded and scored, so its levels have the music the cue sheet gives each place, and the
score turns to the fight's while a battle is up (the boss's in the core), back to the place's after.

## A number put in, and routes that find their way

A menu of kind `number` (RPG Maker's input number) asks for a number: `{ id, kind: 'number', ask, var, digits?, min?,
max?, then? }`. Up and down turn the digit in focus, left and right move along; accept writes the number to `var`, held
to its bounds, and does `then`. A cue that reads the var after its pick (`when: { on: 'menu-pick:<id>:0' }, if: { var,
eq }`) is a code lock, a count, a bet.

A cue's walk may find its way (`walk: { who, to, find: true }`, RPG Maker's move route): each leg is walked round what
stands in the way (the page's pathfinder, A* over the world's colliders), arriving only at the places it named. Without
`find` a walk goes in straight lines and stops at a wall, `stuck`.

## The fight's shot kept clear

A fight on the map is seen from a camera the fight places round its fighters (`rpg-channel.js` stage: `rules.view`,
fitted to every fighter across the frame and down it, its sightlines kept above the ground). Whatever else stands in
that shot is cleared while the fight is on and put back as it ends (`scene-three.js` `__mojClip`, on every page with
party battles): the fight's footprint (its fighters' extent and 2.5 m round it) and the corridor from the camera to it
(as wide as the frame is at the fight, up to 12 m each side). A prop in either (a rock, a wall, a roof) is cut away, the
land kept; a tree whose crown reaches either is left out (`form-flora.js`); whoever is not in the fight and stands there
is hidden. `rules.stage: 'arena'` clears its own arena the same way. The guard is
`gameworld/fight-clear.live.test.js` (the e2e tier): on the starter's first three fighting levels, the whole party in the
fight, nothing but the land covers more than 5 % of the frame before the fight; the measure is
`control/scripts/spikes/fight-clear/` (a grid of rays through the screen).

## The command window beside the one acting

Each fighter's HP and MP stand parked over its head. On a member's turn the command window opens beside its bar, to
the right first, never over the member: of the places beside the bar (its top at the bar's, rising from its foot, over
it, under the member's feet; then the same to its left), held inside the screen, the one that covers the acting
member's figure least, then the rest of the party's, then the foes' (`rpg-channel.js` besideAt). The guard is
`gameworld/fight-clear.live.test.js`: the acting member uncovered, no other member more than 15 % covered.

## The fights acted out

The fighters move on their own line, as a console RPG's do:
- the member picking steps out of the line toward the foes;
- one who attacks runs up to its target on the beat that says so, strikes there, and stands back in its place after;
- one who casts or uses an item steps out;
- a foe lunges the same way.

Every member of the party (a cast's `bond: 'party'`) and the hero of a world of battles are made with a **party battle's
repertoire** (`egocube/moves.js` `battleMovesOf`):
- three attacks by its role: a frontliner's cross, hook and uppercut; a flanker's jab, body hook and thrust;
- a **channel** (`hero-aura.js` `channel`): feet set broad, both hands drawn up from below to cup a gathering power
  before the chest, palms to each other, the eyes on it, swelling as it fills; the set-up a spell or an ability plays
  before it goes off;
- a cast pose by its role and a thumbs-up for an item;
- three ways to take a blow beside its stagger, and its fall;
- its ready stance, held while the fight lasts, and its **victory pose**, struck by the whole party when the fight is
  won.

**Victory poses.** Each class strikes its own when a fight is won (`egocube/moves.js` `WIN_OF_CLASS`, the `victory`
family of `polygonizer/hero-aura.js`), a weapon in the right hand riding the pose:

| class | its victory |
|---|---|
| fighter | the champion (`victoryRaise`): feet broad, the right fist and its blade thrust straight up, the left on the hip |
| knight | the salute (`victorySalute`): heels together, the hilt brought up before the chin |
| rogue | the ease (`victoryShoulder`): the weight on one leg, the fist cocked by the shoulder, a hand on the hip, grinning |
| mage | the triumph (`victoryStaff`): the staff planted low at the side, the other hand raised open to the sky |
| cleric | the thanks (`victoryPrayer`): the palms pressed before the chest, the head bowed, the eyes closed |
| monk | the martial salute (`victoryBow`): a fist set into the open palm, bowing from the hips |
| no class | the cheer (`victoryCheer`): both fists up in a V |

A world names its own per class, any pose of the hero door's (`battles.wins: { knight: 'giorno' }`): the hero and each
member of that class are made with it and strike it. A new starter is a row of the `victory` family and of
`WIN_OF_CLASS`; a pose of a character's own is a motion word on its hero door.

**Weapons in hand.** In a world of battles, each party member who is a person, and the hero, holds its class's weapon
(`egocube/moves.js` `WEAPON_OF_CLASS`):

| class | holds | its three attacks |
|---|---|---|
| fighter | a greatsword | the cut, the thrust and the cleave, heavy and slow |
| knight | a sword and a shield | the same at a one-hand sword's pace |
| rogue | a dagger | the same, quick and short |
| mage | a short staff | the same, swung head first |
| cleric | a mace | the same |
| monk | its fists | the boxer's three by its role |

A held weapon's three attacks are the swings the page bakes on the figure's own rig (`world-kinds.js`, the held
strike), timed by the weapon's weight. So a weapon costs no clips at the mint, and the fists are not minted.

The page plays a figure's strikes and recoils in turn, each figure from a place of its own, so no two blows in a row
look alike. A figure without its own falls back to the clip it has. A world's juice can name the acts (`act: strike |
channel | cast | use | hurt | fall | win | roar`, `at: party` for the win, `at: foes` for every standing foe, `then:
<act>` for an act it goes on into).

**Channelling before a cast.** A skill used channels first, then goes off: the `cast` juice is `act: channel, then:
cast`, the beat held while the power gathers, so the blow or the heal lands after the cast pose. Every fighter has a
channel: each party member and the hero, each person foe, and each beast that can strike (a beast's: drawn in, then
hunkered low, the head down and still, held). One without its own stands in its ready stance while it gathers. A
world's juice can name its own (`cast:<skill>`), with or without the channel.

**The foes' own repertoires.** A party battle's foes, fought on the field, are made with theirs (on a board, as they
were):
- **A beast** has its lunge and its other ways at a foe (`fauna/behavior/strike.js`), each a clip of its own built from
  its own posed body, as the lunge is:
  - the **snap**: barely gathered, a quick bite an eighth of its length out;
  - the **maul**: reared up and drawn back, then brought down low and a quarter of its length forward, slow and heavy (a
    body on legs only);
  - the **roar**: gathered low, then up tall with the head high, held, no reach;
  - the **channel**: hunkered low, the head down and still, held long.

  It plays the lunge, the snap and the maul in turn (`egocube/moves.js` `beastMovesOf { battle }`); a snake, with no
  maul, varies its two. A body that cannot strike yet (a bat on its folded wings, a swimmer) has none.
- **A people or a person** (a goblin, a skeleton, a bandit) carries a member's repertoire by its role (three attacks,
  a cast, three recoils, its ready stance) and a **roar**: the deep squat, both fists flexed by the head, the face
  shouting (`foeBattleMovesOf`; a people's sheet made with `moves: 'battle'`).
- **Armed by its kind** (`gameworld/battles.js` `FOE_ARMS`, rows of the armory, `equipment/armory.js`), and its three
  attacks are then the held swings, as a party member's are:

  | foe | holds |
  |---|---|
  | goblin | a cudgel (its lineage's rank-and-file arm, `foe-casting.js` `PEOPLE_ARMS`) |
  | shaman | a bone club, its fetish staff |
  | skeleton | a rusted sword and a cracked round shield |
  | zombie | nothing: it claws |
  | bandit | its dagger (its spec's) |

  A look the world writes with its own `gear` (`battles.looks.<id>.gear`) holds that; the one look every foe stands in
  (`battles.foe`) holds only its own. A new kind's arms is a row.

**A boss's roar and heavier lunge.** A boss's fight opens with every foe's roar (the `boss` juice: `act: roar, at:
foes`, before the flash and the shake). A boss runs up to its target slower, its strike plays longer, and the camera
shakes as it lands.

**A summoned foe's entrance.** A foe a page calls in roars as it appears out of the smoke (the `summon` juice).

## What comes next

Each step ends playable, and each is something a person can say that the words did not carry before. An RPG Maker
idea is reached through the primitive that already owns it (a switch is a flag, an event page a scene's `if`, a
transfer a megaworld's way), never rebuilt:
1. **A bat's strike from the wing**, and a beast-kin's and a mascot's channel (their rigs have no person's hands).
