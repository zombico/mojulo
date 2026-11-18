### The JRPG starter: a party RPG from a town to its first boss

A party RPG made the way an RPG Maker game is made, from mojulo's own pieces (`docs/jrpg.md`).

Built:
- **A JRPG intent lays its world round its town.** The words name a party RPG with a castle and a dungeon, and the
  world is laid as:
  - the town at the centre (the hub, where the game starts);
  - the wilds;
  - the castle's level;
  - the dungeon, last, with the boss at its end.

  Every level is an exit from the town and back to it. Before, a dungeon named turned every level indoors and the town
  was lost.
- **The town's trades: an inn, a temple and a smithy.** A street's `enter` may name a trade where it names a use
  (`era/town-trades.js`). The lot keeps its shape, and its door, its inside and its keeper become the trade's:
  - the inn's innkeeper at its taproom keeps the world's inn;
  - the temple's priest stands at its sanctuary (the rite that raises the fallen is a gap the folk sheet says).

  A party RPG's town keeps an inn and a temple on its street.
- **The castle walked.** A level that raises a castle and names no town of its own stands the castle's ward on its
  trail:
  - its curtain and gatehouses are the castle's fortification;
  - its ranges are the ward's houses;
  - its keep is entered at its door: the gatehouse, the great hall, the chapel, the solar and the treasury.

  Before, a castle was drawn only in the bible and the atlas.
- **The folk talk in the talk box.** In a world with the game's UI, each townsperson's lines are a scene they speak:
  their name over the box, their own body drawn live in its portrait, played each time they are spoken to. A party
  RPG's world carries the game's UI. Built on the talk box (`1117-mana-ui-talking-heads`, merged here).

Planned next:
1. Events with pages, in words.
2. The database's depth: states, traits, troops and foe patterns.
3. The menu and save slots.
4. The screen and the sound as words.
5. A staged battle screen.
