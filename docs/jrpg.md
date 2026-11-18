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
| the wilds | Trails with the party's packs: each stretch rolls its own (`battles.random` draws from that stretch's packs). |
| the castle (when the words name one) | **The castle walked:** its ward on the trail, closed by the castle's own fortification, and its keep entered at its door. Inside the keep are the gatehouse, the great hall, the chapel, the solar and the treasury (`era/programs.js` `keep`). |
| the dungeon (when the words name one) | A building of its use (a crypt by default), the boss at its end. Reached through a gate. |

Every level is an exit from the town and back to it.
- `brief.round` says what was laid: the castle's level, the dungeon, and the trades on the street.
- A party RPG's world carries the game's UI (`ui: { theme: 'world' }`), so its levels host the talk box.

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

## What comes next

Each step ends playable:
1. **Events with pages:** a page's conditions, self switches, named events another calls, and a fight that branches
   on how it ends.
2. **The database's depth:** states and traits as rows, troops with battle pages, and foes with patterns.
3. **The menu and saving:** the menu's Item, Formation and Save, save slots, and a save point.
4. **The screen and the sound as words.**
5. **A staged battle screen** as a choice beside the battle over the field.
