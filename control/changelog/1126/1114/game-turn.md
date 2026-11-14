### The game turn: one level session in named phases

Planned; nothing is built yet. This file is written before the code and says what the theme will hold.

A game's level session becomes a turn with named phases, so that setting up, loading, playing, pausing and the
results are one path every game shares, where today the play shell, the arena shell and versus each keep their own.
The names are internal; the agent and the person read plain words (set up, loading, play, pause, results).

- **The phases:** `turn:untap` (the player picks: mode, difficulty, character, loadout, level), `turn:upkeep` (the app
  checks the picks against the level's contract, seeds, loads and starts the level), `turn:main` (play),
  `turn:cleanup` (the outcome applied to the store, the save written, the unlocks worked out) and `turn:end`
  (results and what next). `interrupt` is the pause over the held game, legal in play only, and is not a phase.
- **Where it runs:** in the flow kernel and the store kernel (`lib/graph/game/`). The flow strings turns together;
  the title, the options and the credits sit outside a turn.
- **mana-ui stays a view:** it draws the picks, the load, the pause and the results, owns cursors and drafts, and
  holds no pick once it is confirmed. The picks are a session record the shell holds and hands to the level.
- **Exits:** a retry starts again at the load with the same picks; a level with nothing to pick passes its set-up at
  once; a quit from the pause is recorded as a level left.
- **Nothing changes for a game with nothing to pick:** its flow and its page are as they were.
