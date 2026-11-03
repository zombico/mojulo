### The game design studio, abstracted: the compile bounded, each level checked a step at a time

A game book's run (`design_game` `run: true`) made every ready step in one call, and the last of them, the game, walked
every level in headless Chrome inside create_game. On the meadowmark reference book (five stages), one call took six
minutes, and the walks were 71% of it (a level's walk alone is 20–60 s). A book of ten levels could not finish inside one
tool call, so an agent session timed out on the compile. This is the first step of a larger change: the design steps
become chapters each department works alone, so the compile is one loop that makes what was designed.

- **A run has a budget** (`design-game.js` `RUN_BUDGET_MS`, about two minutes; `MOJULO_RUN_BUDGET_MS` sets it, 0 for
  none). Once it is spent, the run starts no new step. It says the steps it left as `pending`, keeps the record of what
  it made, and its next move is `{ step: 'run', pending }`. The next run takes up where it stopped. Each run makes at
  least one step, and no step is cut partway. The world a run leaves is the same however many calls it took.
- **Each level is walked in its own step.** The game is made at once (unaudited, create_game's waiver). After it, a game
  whose levels the audit can prove (reach or survive) has one `audit-level-<level>-<n>` step per level
  (`gameworld/runner.js` `auditSteps`). Each walks that level (`create-game.js` `auditGameLevel`, in an installed browser,
  never a download) and keeps its verdict in the record (`made.<key>.verdict`). A level remade is walked again (a remade
  game was never re-audited before); a level that did not move is not. A walk that no browser could take is said as
  skipped and taken once a browser can. The readout counts them: `audits: { gate: 'machine', proved, of, unproved }`.
- **The first frame renders once a run.** It renders for the levels made or remade, or for all of them when something
  they all show moved. Before, create_game rendered every level and design_game rendered them all again.
- **Measured** on meadowmark with real Chrome: the compile now takes two calls, 224 s and 157 s, where it was one call of
  374 s (the same work, 381 s in all). A call holds its budget, the one step it started before the budget ran out (a
  walk is up to a minute) and the first frames of the levels it made, so its length no longer grows with the book.
- A game made before this is remade once on its next run, in place (its order no longer carries `auto_audit`), and its
  levels are walked after it. No level, hero or game kernel moved: the composed-world and meadowmark order pins hold as
  they were.
