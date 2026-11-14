### The game turn: one level session in named phases

In progress. Built so far: the turn's shape, its reader and its kernel (`lib/graph/game/turn.js`), and the play
shell running it ([docs/game-flow.md](../../../../docs/game-flow.md), "A level step is a turn"). A game whose level
steps say no turn carries none of it. The arena shell and versus still keep their own set-up. The rest below is what
the theme will hold.

- **Built: the play shell runs a turn.** The picks are drawn by mana-ui, one screen a pick, in the game's `ui` or
  the greybox; back unwinds one. The level is handed the game's own words as `params.__picks` and, of a consumed
  slice, the members picked. A retry and the pause's restart keep the picks. A start trigger's scene is staged on
  the level's page, or its video plays over the held level, once a save, with no pause while it plays. An end
  trigger's video plays after the level's end card. Not yet: an end trigger that is a scene, a locked row, a quit
  from the pause recorded.
- **Built: the pick screen** (`mana-ui/idioms-front.js` `pick-screen`), an idiom on the board, and what the play
  shell draws a pick with. The question and a line under it, how far along the choices it is, what was chosen
  before, and the rows beside the one in focus: options as a list with what each means, a party slice as a grid of
  faces with each member's tags, level and figures, a carried thing with its count. A row that cannot be taken says
  why; a pick of several marks its rows and is confirmed. On a tall frame the face is drawn once and the figures
  give way to the words. A pick says `ask` and `hint`; an option may be `{ id, name?, about? }`.
- **Built: a world's set-up** (`lib/graph/gameworld/setup.js`). A gameworld says `setup: { difficulty?, picks? }`
  once, and `design_game` asks it before every level that asks nothing of its own: the run lowers it into the level
  steps of the flow the game is made with (the default, the world's own, or the one started in play). `difficulty`
  is the engine's tiers (easy, medium, max) in default words or the game's; the play shell hands the level the pick
  as `params.difficulty`, the dial its foes' minds already read. The review's `flow:sequence` says what each level
  asks; the flow's card teaches the set-up and a level step's turn; `/setup` is the flow chapter's. A world that
  says none hands its game the order it did.
- **Fixed in mana-ui's mount:** a view mounted on an element with no box of its own (the play shell's, the preview
  page's) never measured its frame, so a spec that branches on the frame always drew wide. It measures its root's
  box there now. The brawl and holo pages, which inline the kernel, are re-pinned for it and for two new words.
- The play shell's cutscene video and the triggers' share one player; every play shell page's inlined code changes
  by that and by the turn's hooks.

- **Built: a level step's turn.** A level step takes `picks` (what the player chooses before it loads, from the
  game's own options or from a slice the level consumes), `start` and `end` (a scene or a video as play starts and
  as it ends). `readFlow` teaches each fault, a pick's slice checked against what the level consumes. The kernel
  steps the phases: a choice that cannot stand keeps the pick and says why, back unwinds one pick, a failed load
  goes back with its reason, a retry keeps the picks and never replays the start, the pause is legal in play only.

A game's level session becomes a turn with named phases, so that setting up, loading, playing, pausing and the
results are one path every game shares, where today the play shell, the arena shell and versus each keep their own.
The names are internal; the agent and the person read plain words (set up, loading, play, pause, results).

- **The phases:** `turn:untap` (the player picks: mode, difficulty, character, loadout, level), `turn:upkeep` (the app
  checks the picks against the level's contract, seeds, loads and starts the level), `turn:main` (play),
  `turn:cleanup` (the outcome applied to the store, the save written, the unlocks worked out) and `turn:end`
  (results and what next). `interrupt` is the pause over the held game, legal in play only, and is not a phase.
- **The load's screen:** `turn:upkeep` is the app's work, and the loading screen is all it shows.
- **Main's triggers:** a level may name a scene or a video for the start of play and for its end (by outcome: won,
  lost, left). Each plays on the level's page with control held, can be skipped, and the start plays once a save. A
  level that names none waits on nothing.
- **Where it runs:** in the flow kernel and the store kernel (`lib/graph/game/`). The flow strings turns together;
  the title, the options and the credits sit outside a turn.
- **mana-ui stays a view:** it draws the picks, the load, the pause and the results, owns cursors and drafts, and
  holds no pick once it is confirmed. The picks are a session record the shell holds and hands to the level.
- **Exits:** a retry starts again at the load with the same picks; a level with nothing to pick passes its set-up at
  once; a quit from the pause is recorded as a level left.
- **Nothing changes for a game with nothing to pick:** its flow and its page are as they were.
