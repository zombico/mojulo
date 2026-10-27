# The table RPG: a pen-and-paper game, played in text first

A tabletop role-playing game is a rules system, a party rolled from it, a world, dungeons, foes, tables and a
referee who says what happens. Mojulo makes one as it makes everything else: a recipe (the **module**) that
regenerates on every read, here into a game that plays fully in text, every die rolled in the open. Pictures come
later and sit over the same module: a text page, then maps, sheets and a dice tray, then a walkable dungeon.

This page is the map: what was researched, the concept the module is built on, which mojulo machinery each part is
composed from, how the game type is exposed without a new tool, and what is still a gap.

Code: [control/lib/graph/table-rpg/](../control/lib/graph/table-rpg/). Play it now from `control/`:

```bash
node scripts/table-rpg.mjs                       # the bundled test module, d20, at a prompt (`help`, `quit`)
node scripts/table-rpg.mjs --system moves        # the same module under another system
node scripts/table-rpg.mjs --packet              # the referee packet an agent runs the game from
node scripts/table-rpg.mjs --commands 'travel standing-stones; look; roll 3d6'
```

## Layers

| Layer | What it is | Where |
|---|---|---|
| Concept (built) | the kernel: dice, resolution, sheets, the world, dungeons, fights, tables, the oracle, the transcript | `table-rpg-kernel.js` |
| Game type (next) | one more game on the game rail, a quick goal of `design_game`: no new MCP tool | below, "Exposure" |
| Text page (next) | the kernel's closure emitted into a console page (transcript and a command line) | the tabletop kernel's `toString()` discipline |
| UI | the map, the sheets and a dice tray over the text page | later |
| Walkable dungeon | the dungeon lowered to a stage and its rooms, the party to `play.rpg` | later; the shapes are already chosen to land there |

## Research

### The book systems are families of one procedure each

Every pen-and-paper system answers three questions: how a character is made, how an uncertain action is decided, and
how a fight is settled. Across published games the second answer falls into a handful of **resolution procedures**,
and a system is mostly the choice of one, plus its numbers:

| Procedure (`check.kind`) | The roll | Read as | Family |
|---|---|---|---|
| `d20` | 1d20 + modifier (+ proficiency) vs a difficulty class | pass / fail, natural 20 and 1 | the SRD 5.2 d20 games |
| `under` | 1d20 at or under the ability | pass / fail | the old-school games (three dice in order) |
| `bands` | 2d6 + stat | 10+ hit, 7–9 hit at a cost, 6- miss | the 2d6 "moves" family |
| `ladder` | 4dF + approach vs a rung | shifts: tie at a cost, +3 with style | Fate Core / Fate Accelerated |
| `percentile` | d100 at or under a score | a fifth of it critical, 96+ fumble | the percentile family |
| `action` | d6 + stat vs two d10 | strong hit, weak hit, miss; doubles twist | Ironsworn |

The kernel normalises every procedure to one **band** (crit, success, partial, fail, fumble), so everything above
the roll (traps, searches, forcing a door, a fight, a level) is written once. The systems themselves are data
(`TABLE_RPG_SYSTEMS` in `table-rpg-systems.js`), and a system can be written out in a module the way a board game is
written out for the tabletop type.

Character creation varies along a few axes that the card states as data: the abilities and their span; the
**generation method** (rolled in order, rolled and placed by the class, a fixed array placed by the class, points
bought against a budget); the modifier rule (a step, a table, none); hit points (a hit die maxed at first level, a
fixed track, derived from abilities); and **progression** (experience thresholds, a mark on every miss, milestones).

Fights differ most in one thing: **who rolls**. In the d20, old-school, ladder and percentile games foes take turns
and roll their own attacks. In the 2d6 and action families the players roll every die: a foe hurts only when a
player's roll fails or succeeds at a cost (`combat.foesAct: false`, `combat.costOn`).

### Licensing: what can be encoded

Rules as mechanics are not copyrightable; the text that states them is. The cards state mechanics in mojulo's own
words, and three come from openly licensed references, each carrying its attribution (printed by the referee packet
and listed in `NOTICE`):

| Source | License | Used |
|---|---|---|
| System Reference Document 5.2 (Wizards of the Coast) | CC BY 4.0, irrevocable | the `d20` card: abilities, modifiers, the array and point buy, the XP thresholds |
| Fate Core / Fate Accelerated SRD (Evil Hat) | CC BY 3.0 | the `ladder` card: approaches, 4dF, the ladder |
| Ironsworn SRD (Shawn Tomkin) | CC BY 4.0 (the rulebook text itself is BY-NC-SA, not used) | the `action` card: the action roll, the five stats |
| Cairn (Yochai Gal) | CC BY-SA 4.0 | not used: share-alike would bind the recipe book |
| Pathfinder 2e Remaster | ORC | not used yet; mechanics licensed, setting reserved |

The `classic`, `moves` and `percentile` cards are generic family mechanics with no source text and invented names.
No published setting, monster or adventure is encoded; a module asked for by a published name is written out from
the rules the person explains, as the tabletop type does with board games.

### Playing in text

A text RPG needs a referee. Three ways to have one, all supported by the same kernel:

1. **The kernel referees** (`tableAct`): a typed command, the dice, the outcome in prose. Solo play and the page.
2. **The agent referees in prose** from the **referee packet** (`refereePacket`): the rules digest, the sheets as
   rolled, every room keyed, the foes in the system's numbers, the tables, and a **dice tape** of pre-rolled d20, d6,
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

A module never names a system's numbers. It says:

- a check's **faculty**: might, agility, grit, wits, insight, presence, stealth (`FACULTIES`), each system mapping
  them onto its own abilities (insight is Wisdom in d20, Careful in the ladder, Wits in the action family);
- a **difficulty**: easy, medium, hard (a DC, a shift, a rung or a share of the score, as the system reads it);
- a foe's **rank** from 1 (a minion) to 5 (a boss), statted by the system's own `foes` table; a trap's harm as a rank;
- a member's **role** (the egocube's roles: frontline, flanker, support, controller, caster, ranged, non-combatant),
  played as the system's first class that takes it;
- healing as `some` or `all`.

So one scenario plays under every system: the bundled test module (`fixtures/sunken-chapel.js`) is played through to
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

## Exposure: one game type, no new tool

The game rail already makes a game whose characters are rolled sheets: `design_game`'s quick goal `fight` writes the
fighters' egocube sheets, mints each fighter through `create_character { egocube }`, and stores a game row of its own
engine. The table RPG takes the same path:

- `design_game({ quick: { goal: 'table-rpg', system?, … the module } })`: the members' sheets (egocube), their bodies
  when asked for, the game row `{ kind: 'game', engine: 'table-rpg', title, tableRpg: <module> }`; the answer carries
  the referee packet. `quick` is an untyped object in the tool's schema, so the `tools/list` payload does not move.
- The engine's branches beside the tabletop type's: the `update_sketch` gate, the play route, the export.
- Cards: `get_game_vocab({ id: 'table-rpg' })` (a guide, a card per system, the dungeon and world grammar) and a
  routing card whose phrasings are pen-and-paper ones (game master, roll for stats, character sheet, one-shot,
  theatre of the mind), with collision rows against the live RPG.
- The two RPGs read apart: the **live RPG** is "battles in the 3D field, a party in the game you walk"; the **table
  RPG** is "a pen-and-paper game played in text, rolled from a book system".

## Gaps

- No MCP door yet (the next layer); the game plays from the kernel, the tests and the CLI.
- Spells, class features, conditions, equipment beyond a weapon, saving throws, skills apart from abilities, and
  morale or reaction rolls: the cards hold the procedures, not the catalogues.
- Ladder aspects and invokes, the 2d6 family's moves as written moves, the action family's momentum and progress
  tracks: simplified to checks, harm and a health track.
- A dungeon's lowering: a tree of rooms lays through `planProgram`, a loop needs its own layout pass.
- A room's own check beyond a trap, NPC talk, shops and rumours in towns.
