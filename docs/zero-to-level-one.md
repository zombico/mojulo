# From nothing to a first level

How a game is made in mojulo, in one place: the premise, the rail an agent rides, what composes into a level, how it
is checked, and what holds today. The deep pages are linked from each part; this page is the map between them.

## The premise

Mojulo is a modular 3D creative studio, built for agents to help a person make content that is composable, editable
and theirs for good. Every tool, rail and composition is an assistive guide toward that.

Game makers before us turned their craft into words: a core loop, game feel, a walled-core dungeon, an enemy trail, a
casting call, a cue sheet. Those words are concepts. Mojulo binds each to code that runs the same way every time, so
three parties each do the part they are suited to:

- **The person brings taste and material:** an idea, drawings, a map, lore, rules. They approve by playing.
- **The agent writes the recipe.** Nothing is "interpreted from a document into a drawing" by mojulo. A language model
  is well suited to reading what a person brought and writing it down in the studio's words (a hero's `form`, a
  world's `feel`, a level's `goal`), and that is its job here.
- **Mojulo compiles the recipe:** the same recipe gives the same character, level and game on any machine, and one
  word changed in it changes everything made from it.

For games the goal is narrow on purpose: take a person from nothing to **level one**, a first level that the machine
has proved can be won and that the person has played and called theirs. A whole game is more of the same rail.

## The rail

One door, `design_game`, holds a **gameworld**: one recipe row that the departments write into (`DEPARTMENTS` and the
chapters each owns are in `control/lib/graph/gameworld/chapters.js`). The agent's manual is the vocab card
`gameworld-guide`; the studio card (`gameworld-studio`) says how to work the chapters in waves and what a first
session leaves.

1. **The producer leads.** The person talks to the producer; the producer hands the director the work. One agent
   wears both seats and says which a move is made from (`gameworld-producer`). A new game's readout carries the
   producer's steps before the goalposts, each with the one question it asks, and `producer.ask` names the one to ask
   this turn (`gameworld/goalposts.js` `producerSteps`):
   - **What was brought** (`intake`). Asked once. Each item is recorded on the world's `intake` with what it says and
     where it went, or why it has no place yet (`gameworld/intake.js`). Bringing nothing is an answer. The quick path
     and the sentence door are not asked.
   - **The rail and the size** (`rail`). The game is placed on a rail: a game type mojulo builds, as a TEMPLATE the
     person's own game starts from, never the game itself (`gameworld/rails.js`; the `gameworld-rails` card is every
     rail in a line, `gameworld-rail-<id>` one rail's sheet). The step carries the rails the person's words point at
     and any type no door makes yet, said before anything is built. The size is called first, the least that answers
     the ask: a pixelizer game, a quick game, a table game or the designed game (`sizeCall`).
   - **The lock** (`lock`). The pitch is said back (a gameworld's `rail`: the template, the size, where the game
     departs in level, action, character and world) and locked on the person's yes. Structure is locked, content never.
     A locked pitch on a book with no level is given the rail's starter first level and stored, nothing built
     (`gameworld/pitch-start.js`); a locked pitch moved to another rail is a re-plan, said.
   - **The brief** (`brief`), a designed game's only: why it is played and how it is shaped (`gameworld/gmn.js`).
   - **The hand-off** (`hand-off`). The first level as a req the ledger takes, its remit filled from the pitch and the
     brief, proposed for the agent to raise as the director (`gameworld/hand-off.js`).
2. **The goalposts.** Every readout carries `goalposts` (`gameworld/goalposts.js`): what game it is, its shape, its
   look, its play, its plan, the first level's plan, the first level made. Each is met, partial or open, and an open
   one carries the question only the person can answer. The first open one is also a step in `next`
   (`step: 'goalpost'`), so the list of moves and the goalposts say the same thing. A game built while a design
   goalpost is open is a draft: its play and share steps say `draft`, and the question leads.
   A quick game is not a draft: once built, the question rides last (`grow`), for the person who wants to go on.
   Where the person brought material, the question is asked before the run whatever the world's mode.
3. **The chapters.** The agent writes or patches the world; `next` answers with step ids, each with its card and often
   a ready patch (`gameworld-next`). `{ ref, chapter }` is one chapter's view, a department's.
4. **Try the play before the levels.** The practice door builds a room from the recipe alone, chosen by how the game
   plays, and measures the feel on the real runtime: [practice-rooms.md](practice-rooms.md),
   [game-room.md](game-room.md).
5. **The build.** `run: true` makes every ready step through the real doors (each level a world row, then the game
   row), keeping what did not move. Its `compile` readout is the pre-build check: blockers, advises, an estimate.
6. **The machine gate.** `run: true, check: true` walks each level in headless Chrome to its win (`audits`), and for a
   fight level sends a scripted player that must win and a still one that must not (`playthrough`).
7. **The eyes gate.** The `play` step. The person plays it; nothing in mojulo ever says a person has looked.
8. **Keep it.** `export_game` writes the web build (or a desktop app); `export_model { engine }` hands a team's engine
   the levels and assets. Where it is built and where it can be seen: [workshop.md](workshop.md).

### Ways in

| The person says | The door | What it is good for |
|---|---|---|
| one level, one goal | `design_game({ quick })` (`gameworld-quick`) | the fastest playable thing; a work sim ([worksim.md](worksim.md)) |
| a sentence | `design_game({ compose: { prompt } })` | a first reading to edit: it answers what it `read` and what it left `unread` |
| an idea, or documents | `design_game({ world: { name } })` first (it answers the producer's one question, nothing stored); a locked pitch (`rail: { from, locked: true }`) stores the game on its rail's starter level; then patches | the designed game: the agent writes the recipe |
| a board game, a pen-and-paper RPG, a fight | `create_game` with its own key | game types with their own machines ([table-rpg.md](table-rpg.md), [broadcast.md](broadcast.md)) |

A platformer has a rail of its own under the designed path: a world that plays a platformer's feel and has no course
is offered its first level and the flow that plays it as a ready patch (`next: first-level`,
`control/lib/graph/gameworld/platformer-game.js`). It is a side-scroller (one strip, one turn) unless the camera or the
brief says the round; the 3D platformer lays courses up a hill, a turn each, entered from a courses screen.

The sentence door is a keyword reader, not the agent's judgment. It is a starting recipe; the words it lists as
`unread` are the agent's to write in.

## What composes into a level

Each row is a word on the gameworld, the department that owns it, and its page. A word left out contributes nothing,
and the game still builds.

| Part | Words on the world | Read more |
|---|---|---|
| What game it is | `intent`, the core loop, `mode` | the `gameworld-intent` card |
| The place | `style`, `geocube`, `civilizations`, a level's `kit`; the two big shapes, `wcd` and `qow` | [walled-core-dungeon.md](walled-core-dungeon.md), [quest-open-world.md](quest-open-world.md) |
| The hero | a hero made by `create_character`, or a genre's row; `camera`, `screen` | [realistic-body.md](realistic-body.md), [garment-principles.md](garment-principles.md), [plating.md](plating.md) |
| How it feels | `feel`, `arsenal`, `loadout`, `juice`, `styleMeter` | [sword-arts.md](sword-arts.md), [practice-rooms.md](practice-rooms.md) |
| Who is fought | the foes and their casting call, `fights`, `battles` (a party RPG's, from a monster manual or a skill tree) | [foes.md](foes.md), [game-room.md](game-room.md) |
| The level's play | a level's `goal` and its tasks, its play layer, `roll` (a different map each play), `obstacles` | [practice-rooms.md](practice-rooms.md), [course-dress-principles.md](course-dress-principles.md) |
| What plays when | `flow`, `setup` (the picks asked before each level), the story's moments | [game-flow.md](game-flow.md), [cinematics.md](cinematics.md) |
| Menus and HUD | `ui`, a genre's HUD grammar | [mana-ui.md](mana-ui.md) |
| Sound and score | `sound`, `music` | [game-audio.md](game-audio.md), [sfx-shelf.md](sfx-shelf.md) |
| Colour | the colour chapter's directions | [colour.md](colour.md) |

The game's books are pages of its bible (`/bible?book=…`; the list is in
`control/app/api/sketches/[ref]/bible/route.js`). They are how the person reads a plan before anything is built.

A worked example of the whole path, recipe included: [examples/fallen-angel/](examples/fallen-angel/README.md).

## What holds today

Measured on this branch on 2026-11-16 in a cloud box (software rendering), through the CLI
(`node scripts/mcp-stdio.mjs call …`), from one sentence with nothing else written:

- The sentence became a gameworld of three levels in under 15 seconds, and `run: true` built its stages and the game
  row in about 20 more. The export to a web folder took under 20 seconds and its first level loaded in Chrome with no
  page errors.
- `check: true` walked every stage in under two minutes and proved all but one. The one it could not prove it had
  already named before the build, with the reason and the fix (`compile.advises`: its exit is up a ladder and the
  default hero only walks).
- Of a nine-word sentence the door read one word (the hour). The goalposts said so: one of them met, the rest open
  or partial, each with its question. That is the rail working as meant, and it is also the distance left: the
  sentence door alone does not give the game that was asked for, the agent writing the recipe does.
- On that run the readout led with `run`, and after the build with "the game is complete: ask how to share it",
  while the goalposts beside it said one of them was met. The goalpost step and the draft wording (above) were added
  after this run, to close that.

What that shows:

- **Reliable:** the rail itself (write, build, check, export, rebuild the same), a walk to an exit on generated
  terrain, the honest readout (unread words, advises, unproved levels), the plan read as books before the build.
- **Reliable when the recipe says it:** a designed hero, a foe cast and an enemy trail, a feel measured in a practice
  room, fights kept on the world and laid into a building, sound and score, the flow from title to results, menus
  and HUD in a look. Each has machine gates; most have not been played by a person.
- **Known seams** (each stated by the code or its theme, none hidden):
  - The sentence door lays a level whose exit its own default hero cannot reach, advises against it, and builds it.
  - An action game from a sentence gets no weapons kit; an action game's foes cannot carry elements.
  - The scripted player has no dodge, specials or air strings, so some fights (the gallery) cannot be machine-proved.
  - A beat-em-up and a run & gun are quick goals (`brawl`, `rungun`): one open screen of a street, the crowd in
    waves, the heroes characters. The crowd is drawn as jointed figures, and the gated street and its boss are the
    sim's alone.
  - Each page's own "Not yet" section is the list for its part; the flow's is in [game-flow.md](game-flow.md).

What can be made, counted over rolled worlds, and what to build next is the generated
[tool-surface/hillclimb.md](tool-surface/hillclimb.md). That page counts worlds; this one is about whether the ones
that build are understood.
