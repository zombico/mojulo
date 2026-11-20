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
| `temple` | a hall, a tower, else a house | a temple (narthex, nave, sanctuary) | the priest (the rite that raises the fallen is a gap the folk sheet says) |
| `smithy` | a workshop, else a barn | a work floor | the master (mending and bettering gear is a gap) |

The lot keeps its shape, so the street is drawn as it was. Only who keeps the lot and what is inside change. A new
trade is a row.

## The folk talk in the talk box

In a world with the game's UI, each townsperson's lines are a scene (`gameworld/folk-cast.js`, `talk: 'box'`). They
speak it in the talk box: their name over it, their own body drawn live in its portrait, and it plays each time they
are spoken to.
- A keeper of the world's shops opens the shop or the inn.
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
the message line the first time its moment holds, `sets` a story flag as it is said. A composed party RPG's boss is a
party battle (`battles.boss`, the Ember Drake by default) that speaks as it begins and at half its HP.

## What comes next

Each step ends playable, and each is something a person can say that the words did not carry before. An RPG Maker
idea is reached through the primitive that already owns it (a switch is a flag, an event page a scene's `if`, a
transfer a megaworld's way), never rebuilt:
1. **Travel by vehicle:** a ship's or an airship's way, opened by a story flag, its crossing played while the next
   place is built.
2. **The battles' depth as rows:** states as a table (paralysis, blindness, confusion beside poison, sleep, silence),
   and a fight's page that does more than speak (a summons, a heal).
