### The game design studio, abstracted: the book in chapters, the compile bounded, each level checked a step at a time

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
- **The book in chapters** (`gameworld/chapters.js`). Each page of the game book is a chapter, and each chapter sits in
  one of the studio's six departments. A chapter's contract names the recipe paths it owns, the review parts it answers,
  the steps a run makes for it, the cards it is written from, the chapters upstream it reads, and the rail outcome its
  parts are drawn under. It is derived from what the book already is (the guide's loop, the readers' parts, the runner's
  steps, the ready table), not a new rule. A guard test (`chapters.test.js`) gives every recipe key, every review part,
  every step a run lays (one world per procedure that lays its own) and every card exactly one chapter, so a new page
  that joins no department fails. The rail's grouping of parts is read from it (`partOutcome`), which now also shows the
  casting page (`characters:cast`), a part the rail used to leave out.
- **The readout says the chapters** (`design_game` `chapters`): each chapter the world holds, with its department, its
  state (open, advised, settled, or written for pages with no review of their own), how many of its parts are settled,
  the ones still open once some are, and the chapters upstream it `waits` on. The orchestrating agent reads the book a
  chapter at a time and hands a department its own chapter; the `gameworld-next` card says so.
- **Fixed: a town's people kept in the record.** A run made a town's folk (`folk-<town>-<who>`), but the record reader
  refused the key, so a world with folk could not be read again after its run. The guard test found it.
- **A chapter's own readout** (`design_game({ ref, chapter })`, `gameworld/chapter-view.js`). The whole readout projected
  onto one chapter, so the two never disagree: its parts with their stamps and advice, its pages (the recipe at its
  paths, a deeper chapter's keys left to that chapter), the chapters upstream it reads as a digest (each one's state and
  the print of its pages, so a department sees when upstream moved without reading it), its own next moves (a review of
  its parts, a wait on it, a form ask for it; a run left pending is every chapter's), what a run made for it, its place
  in its bible, and the whole book as one word a chapter. On the meadowmark reference book a chapter's view is 0.8 to 2.6
  KB with its pages, where the whole readout is 7.2 KB without any. A write outside the chapter is written and said
  (`outside`), never refused. Every part of the book is in exactly one chapter's view (tested), and every next move the
  `gameworld-next` card documents belongs to a chapter. The tools/list payload holds under its pin.
- **A chapter's run** (`design_game({ ref, chapter, run: true })`, `chapters.js` `chapterSteps`). A department checks its
  chapter without making the whole book. The run makes the chapter's own steps and every step their orders name: a
  level's pilot, the foes and folk standing in it, a cast member's casting row, the hero the systems name. A step that
  waits on approvals is made ahead of them and says so (`ahead`: the parts it did not wait for). It is made at its own ref
  from its own order, so the build keeps it when its approvals come and the book has not moved, and remakes it when the
  book has (tested: a gated book's levels made ahead, then approved and built, are kept, not remade). A level can be
  checked, and its first frame read, before the characters are approved. The build is never a need (no game, no walks),
  and the build chapter's run is the whole run. A chapter's run does not report the compiler's resonance gaps, which
  belong to the whole run.
