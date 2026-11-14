### The game turn: one level session in named phases

In progress. Built so far: the turn's shape, its reader and its kernel, read by the flow and walked headless
(`lib/graph/game/turn.js`; [docs/game-flow.md](../../../../docs/game-flow.md), "A level step is a turn"). No shell
runs a turn yet, so nothing a game emits has changed. The rest below is what the theme will hold.

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
