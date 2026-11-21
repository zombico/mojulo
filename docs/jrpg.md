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

## Foes that fight to a plan

A foe may carry an **action pattern** (`battles.foes.<id>.pattern`, RPG Maker's action patterns in words): rows of
`{ use, when?, weight? }`. `use` is `attack`, `guard` or a skill; `when` is its HP below or above a share, its nth turn,
every nth, or from its nth on; `weight` (1 to 9) how often it is chosen among the rows that hold. With none holding, it
keeps the rule every foe has.

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

**Traits** (RPG Maker's traits, the three a fight reads), on a class or a piece of gear: `resist` (elements taken at
half), `immune` (elements taken not at all) and `ward` (states warded off). A member carries its class's and what it
wears, gathered as it stands, so a ring against fire is put on before the drake.

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

## The party menu

P opens the party menu: Status, Class, Equip and Skills, and Item (a battle item used outside a fight, on the member in
focus or on all the party) and Formation (two members traded: the order fought in, the first `rules.size` of it at the
front). It saves at save points, never from the menu: the store is written as a level is left.

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
