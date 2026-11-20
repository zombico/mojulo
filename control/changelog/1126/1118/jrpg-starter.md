### The JRPG starter: a party RPG from a town to its first boss

A party RPG made the way an RPG Maker game is made, from mojulo's own pieces (`docs/jrpg.md`).

Built:
- **A JRPG intent lays its world round its town.** The words name a party RPG with a castle and a dungeon, and the
  world is laid as:
  - the town at the centre (the hub, where the game starts);
  - the wilds;
  - the castle's level;
  - the dungeon, last, with the boss at its end.

  Before, a dungeon named turned every level indoors and the town was lost.
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
- **The round travelled as a mandala.** A round of three levels or more is laid in rings (the megaworld,
  `gameworld/megaworld.js`); a town and one stretch of wilds stay a plain hub:
  - the town is the first ring, where the game starts;
  - the wilds and the castle are the second, each a road from the town;
  - the last level is the core, reached from the farthest wilds through a gate its key opens: the key lies in the
    castle when the castle is not the core (`crypt-key`), else in the farthest wilds (`castle-key`).

  The travel screen draws the rings with the core at the centre, a fight won stays won when a place is gone back to,
  and the core's first win ends the game. A world with a book (its battles) now carries a megaworld's atlas and its
  core into its game too; before, only a world without one did.

Planned next, each said in words on mojulo's own pieces rather than an editor's:
1. The wilds as a zoned world map in their ring: battles met on the map's marks, a rest on the road.
2. Talk that follows the story: a townsperson's lines keyed to what has happened.
3. Save slots and save points.
4. Travel by ship or airship, opened by the story: the crossing played while the next place is built.
5. The battles' depth as rows: foe patterns, states, troops.
