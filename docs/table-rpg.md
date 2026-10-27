# The table RPG: a pen-and-paper game, played in text first

A tabletop role-playing game is a rules system, a party rolled from it, a world, dungeons, foes, tables and a
referee who says what happens. Mojulo makes one as it makes everything else: a recipe (the **module**) that
regenerates on every read, here into a game that plays fully in text, every die rolled in the open. Pictures come
later and sit over the same module: a text page, then maps, sheets and a dice tray, then a walkable dungeon.

This page is the map: what was researched, the concept the module is built on, which mojulo machinery each part is
composed from, how the game type is exposed without a new tool, and what is still a gap.

Code: [control/lib/graph/table-rpg/](../control/lib/graph/table-rpg/). Play it now from `control/`:

```bash
node scripts/table-rpg.mjs                       # the bundled test module, the target starter, at a prompt (`help`, `quit`)
node scripts/table-rpg.mjs --system bands        # the same module under another procedure
node scripts/table-rpg.mjs --packet              # the referee packet an agent runs the game from
node scripts/table-rpg.mjs --commands 'travel standing-stones; look; roll 3d6'
node scripts/table-rpg.mjs --book out.html --pdf out.pdf --style zine   # the game book, and its print
```

## Layers

| Layer | What it is | Where |
|---|---|---|
| Concept (built) | the kernel: dice, resolution, sheets, the world, dungeons, fights, tables, the oracle, the transcript | `table-rpg-kernel.js` |
| Game book (built) | the module as a book in a style, printed to PDF: maps, keyed rooms, stat blocks, roll tables, sheets | `table-rpg-book.js`, `table-rpg-maps.js`, the press ([books.md](books.md)) |
| Game type (built) | `create_game({ table_rpg })`, the board-game type's sibling: the row, the page, the book, the export | below |
| Text page (built) | the kernel's closure in a page: the transcript, the moves as buttons, a line to type | `table-rpg-page.js` |
| UI | the map, the sheets and a dice tray over the text page | later |
| Walkable dungeon | the dungeon lowered to a stage and its rooms, the party to `play.rpg` | later; the shapes are already chosen to land there |

## Research

### Rules are procedures, and a game is a choice of one

Every pen-and-paper game answers three questions: how a character is made, how an uncertain action is decided, and
how a fight is settled. The second answer falls into a handful of **resolution procedures**, and a game is mostly the
choice of one plus its numbers. Mojulo holds the procedures; the numbers are a card.

| Procedure (`check.kind`) | The roll | Read as |
|---|---|---|
| `target` | 1d20 + modifier (+ a trained bonus) vs a target number | pass / fail, natural 20 and 1 |
| `under` | 1d20 at or under the ability | pass / fail, 1 and 20 |
| `bands` | 2d6 + stat | 10+ hit, 7–9 hit at a cost, 6- miss |
| `shifts` | 4dF + stat vs a rung | the margin as shifts: a tie at a cost, three over a critical |
| `percent` | d100 at or under a score | a fifth of it critical, 96+ fumble |
| `challenge` | d6 + stat vs two d10 | strong hit, weak hit, miss; matching d10s twist it |

The kernel normalises every procedure to one **band** (crit, success, partial, fail, fumble), so everything above
the roll (traps, searches, forcing a door, a fight, a level) is written once.

Character creation varies along a few axes the card states as data: the abilities and their span; the **generation
method** (rolled in order, rolled and placed by the class, an array placed by the class, points bought against a
budget); the modifier rule (a step, a table, none); hit points (a hit die maxed at first level, a fixed track, derived
from abilities); and **progression** (experience thresholds, a mark on every miss, milestones).

Fights differ most in one thing: **who rolls**. Under `target`, `under`, `shifts` and `percent` foes take turns and
roll their own attacks. Under `bands` and `challenge` the players roll every die: a foe hurts only on the bands the
card says cost (`combat.foesAct: false`, `combat.costOn`).

### Affordances, not implementations

Mojulo ships one **starter** card per procedure (`TABLE_RPG_SYSTEMS` in `table-rpg-systems.js`): generic, named for
the procedure, in mojulo's own words and numbers. It does not hold any published game. A game the person names is
written out as a card by their own model from the rules they supply, the way the tabletop type has a board game
written out; the kernel's `compile` checks the card and says what is missing, and a card may carry its own
`attribution`, which the referee packet prints. The fine tuning (a game's exact tables, its class list, its foes) is
the person's model's; mojulo's part is the procedures, the portable words, the checks and the text play.

Disclosure, in one line: *the rules starters are generic procedures in mojulo's own words and numbers; a named game is
written out by the person's model from rules the person supplies.*

### Playing in text

A text RPG needs a referee. Three ways to have one, all supported by the same kernel:

1. **The kernel referees** (`tableAct`): a typed command, the dice, the outcome in prose. Solo play and the page.
2. **The agent referees in prose** from the **referee packet** (`refereePacket`): the rules digest, the sheets as
   rolled, every room keyed, the foes in the card's numbers, the tables, and a **dice tape** of pre-rolled d20, d6,
   d10 and d100 for the seed, read in order, so the agent never chooses a roll.
3. **A person referees** at a real table from the same packet.

Solo play needs answers nobody wrote: an **oracle** (`ask <question> [likely|even|unlikely]`: a d100 against the
odds, read as yes / no with an *and* or a *but* at the edges) and **tables** (`table <id>`: a die, rows, a row that
raises foes or gives an item). Both are generic, not any published oracle.

The state is a pure function of the module and the commands, so **the command list is the save**: play state never
needs to leave the table, which matches mojulo's posture that play data stays client-side.

### Scenarios, worlds and dungeons

- **World as a point-crawl.** Places (town, wild, landmark, the mouth of a dungeon) and roads measured in days, with
  a danger table rolled on each day of travel. A hex map is the same graph with coordinates; the epoch map already
  draws a point-crawl in 3D, so the world lowers to it (`toEpochMap`).
- **Dungeon as a graph.** Rooms and links (open, door, stair, locked, secret, one way), keys and locks, a trap, a
  wandering table. The well-tried structures are its tests: loops so the party has a choice and a retreat (a
  "jaquayed" dungeon), a key placed off the way to its lock, something hidden to reward a search, the goal reachable.
  `checkDungeon` reads exactly those: reach with keys as a fixpoint, a key behind its own lock, a lock with no key and
  no force, the goal out of reach, a room with no way back, loops and dead ends. All findings advise; `ok` is false
  only when a room or the goal cannot be reached.
- **Scenario as beats.** A hook, a goal (an item brought back, a room or place reached, a room cleared, a flag), beats
  that fire on first arrival (a line, a flag, a milestone), and an ending line.

## The concept: a module written in portable words

A module never names a card's numbers. It says:

- a check's **faculty**: might, agility, grit, wits, insight, presence, stealth (`FACULTIES`), each card mapping
  them onto its own abilities (insight is Wisdom in the target starter, Careful in shifts, Wits in challenge);
- a **difficulty**: easy, medium, hard (a target number, a shift, a rung or a share of the score, as the card reads it);
- a foe's **rank** from 1 (a minion) to 5 (a boss), statted by the card's own `foes` table; a trap's harm as a rank;
- a member's **role** (the egocube's roles: frontline, flanker, support, controller, caster, ranged, non-combatant),
  played as the card's first class that takes it;
- healing as `some` or `all`.

So one scenario plays under every card: the bundled test module (`fixtures/sunken-chapel.js`) is played through to
its goal under each resolution procedure in the tests. Character creation stays scoped to the one game: the party is
the module's, rolled on the module's seed, one stream per member, so adding a member never moves another's dice.

## Composition: what each part is made of

| Need | Composed from | How |
|---|---|---|
| A pure stepper a page can emit | the tabletop kernel's discipline (`tabletop/tabletop-kernel.js`) | one closure, `toString()`-equal (tested), `legal` / `apply`, mulberry32 on the state |
| Seeded streams | `city/plan/dice.js` (`streamOf` convention) | `<seed>\|<layer>-v1\|<key>`: sheet, session, tape |
| Who a character is | the egocube (`egocube/egocube.js` `rollEgocube`) | `egocube: true \| { brief, facets }` on a member: a persona, and the class from its role; the same sheet `create_character { egocube }` draws a body from |
| Stats and level progression in a live game | the live RPG (`playscape/rpg/`) | `toLiveParty`: each sheet as a `play.rpg` member of the live class its class plays as, its abilities read as the live stats; `readRpg` takes it and the battle kernel fights it (tested) |
| A dungeon from a building | programs (`era/programs.js`) | `dungeonFromProgram({ use })`: the program's rooms by role, a loop, the goal locked and keyed; the use rides along for the lowering |
| A world map in 3D | the epoch map (`board/board-map.js`) | `toEpochMap`: places as dots, roads as roads; `readMapSpec` takes it (tested) |
| The walkable dungeon | the stage and atlas (`era/stage.js`, `era/doors.js`, `era/atlas.js`) | the target of the lowering: rooms and links, `doors[].locked: '<item>'`, items; not built |
| Fights in 3D | the live RPG's encounters | a room's foes become `play.rpg` encounters; not built |
| Board play at the table | the tabletop type (`tabletop/`) | separate: a board or card minigame inside a scenario stays a tabletop game |

## The game book

The book is the product a table game is used through, and the first game type with a direct use for PDF. The module
is set by the press ([books.md](books.md)) in a style from its library (a look, a format, faces): a title page; how
the rules run, in the card's own numbers, with the faculties and difficulties; the world, its point-crawl map and its
places lettered; each dungeon, its flowchart map and its rooms keyed by the map's numbers (ways, doors, stairs, locks
and their keys, hidden ways and the search that finds them, traps, foes, what fires on first entering); the foes as
stat blocks; the tables; the party's sheets, a page each, as rolled; the dice tape; the colophon (a card's own
attribution when it carries one). A one-sheet format keeps what the table needs in play (the title, the dungeons, the
foes, the tables): the one-page adventure. The maps are drawn in the look's colours; a dungeon's numbers are its
key's (`roomNumbers`), so the map and the text never disagree.

## The game type: `create_game({ table_rpg })`

The table game is a sibling of the board-game type (`create_game({ tabletop })`): its own engine, its own page, no
store and no levels. One property on the door, no new tool (the flat payload pin re-pinned for it, with its reason).

- **The row**: `{ kind: 'game', engine: 'table-rpg', title, tableRpg: <the module's keys, book?> }`
  (`table-rpg-manifest.js`). The page, the book and the sheets regenerate from it on every read; `update_sketch`
  plays an edit through the kernel before it lands.
- **The quickest game**: `table_rpg: { starter: { use: 'crypt' }, system? }` (`table-rpg-starter.js`): a town, the road
  and its table, the building's program as a dungeon (a loop, the goal locked and keyed, minions, the boss guarding the
  prize, a wandering table), the goal to bring the prize back. What the module writes itself wins over the starter's.
- **Character creation** is the party: each member rolled by the card's method on its own dice, `egocube` rolling who
  they are (a persona, a name when none, the role when none), three rolled when no party is named (a frontline, a
  flanker, a support). The mint's answer says every sheet as rolled and how it was made; the checks' findings ride
  beside it, advice only.
- **The party's bodies**: each member rolled on the egocube is made a real character through the character loop at mint
  (an egocube row from the very roll its persona came from, then `create_character { egocube }`, as the fight goal makes
  its fighters), recorded on the member as `character: <ref>`; `characters: false` skips it, and a member may name one
  already made. The book photographs each character's World page in headless Chromium (the character bible's colour
  turnaround): the party lined up on the title page, each bust heading its sheet, on the book's own paper; without a
  browser the sheets print without them.
- **Where it is**: played at `/api/sketches/<ref>/game` (the text page: the kernel's own closure, the moves as buttons
  and typed, every die in the open, the moves kept in the player's browser as the save); its book at `/bible`
  (`?parts=party` the characters' sheets alone, `?style=` another preset); the rail's exits play, book and characters.
- **Export**: `export_game` writes `game.html`, `book.html`, `characters.html`, and `book.pdf` and `characters.pdf` when
  a browser is on the machine (never fetched for an export: without one, the pages print from any browser), with the
  recipe and a README.
- **Cards**: `get_game_vocab({ id: 'table-rpg' })` (the grammar, every starter, character creation, the book's
  styles, read from the tables that define them); a routing card whose phrasings are pen-and-paper ones, with
  collision rows against the live RPG ("a JRPG where my party walks a dungeon" stays `design_game`'s).
- The two RPGs read apart: the **live RPG** is battles in a 3D field, a gameworld on `design_game`; the **table RPG**
  is a pen-and-paper game played in text and printed. When the walkable dungeon lands, the table game lifts into a
  gameworld there (its dungeon a stage, its party `play.rpg`), which is where `design_game` meets it.

## Gaps

- A balance probe: a module autoplayed over many seeds (how often it is won, who falls, how long the fights run), so a
  card the person's model writes is measured rather than tuned by hand. The tests hold the starters to one such run.
- Spells, class features, conditions, equipment beyond a weapon, saving throws, skills apart from abilities, and
  morale or reaction rolls: the cards hold the procedures, not the catalogues.
- Narrative currencies (aspects, momentum, written moves, progress tracks) as their own procedures: simplified for
  now to checks, harm and a health track; a card cannot yet declare one.
- A dungeon's lowering: a tree of rooms lays through `planProgram`, a loop needs its own layout pass.
- A room's own check beyond a trap, NPC talk, shops and rumours in towns.
