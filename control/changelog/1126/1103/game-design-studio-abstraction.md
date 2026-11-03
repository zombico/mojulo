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
- **The pre-compile check** (`design-game-check.js`, the readout's `compile`, machine gate). It finds what a run would hit
  before anything is made, where it used to surface minutes into the run after the steps before it were made. It reads
  the run's plan, and each order as its door would read it where that check is cheap and needs nothing made:
  - every hero-door spec, for the hero, its cast, its foes and its folk;
  - every level's houses and bodies;
  - the game as create_game makes it, over the planned levels: its manifest, each level's contract dry-run against the
    game's store, its links and its menu;
  - every sketch an order names, which must be one a step makes or one that is stored (an adopted hero with no row, a
    building played by a ref that is gone).

  A refused plan is said on the chapter its field belongs to. Each blocker names its chapter: the build's view sees them
  whole, and each other chapter sees its own, with a `compile` next move. It also prices the build left (what a run makes
  now and what waits on approvals) at the step times measured on the reference book, divided by the run's budget, as
  `estimate: { seconds, calls }`: an order of size, not a promise. It runs on a run and on a chapter's view, never on a
  plain read; it advises, and a run goes ahead whatever it says. The world door's full resolve and the gear's workbench
  are not run, since they need what the run makes.
- **A climb's top is in reach** (`gameworld/levels.js` `climbLadders`). Two of the five meadowmark levels were never
  proved, and the reason was in the level, not the audit: each is a climb (a local meru) whose exit is its tower's
  deck, up a ladder. The meru draws a stand-in ladder ("until playscape's ladder stands there"), and the hero's platform
  rule climbs only a `climbable` entity, which nothing laid. So the hero could reach the summit but not the deck, and the
  level could not be finished. A climb's game level now lays, after its other entities, the climbable surface that
  playscape's ladder lowers for each climb site. A level with no climb is as it was. The reference books' order pins
  moved by the ladders alone, and each order without its ladders keeps the print it had (tested).
- **The audit walks a climb its own way up** (`levels.js` `climbRoute`, `motion/world-frames.js`). The walker steers by
  x,y, so a walk straight to a climb's top stood on a lower tier under it, and its leg "arrived". A level whose exit is
  off the ground is now walked by its climb's flights in height order, then by a climb leg for each ladder: stand off
  its foot on the climber's side, then walk into it until the climb rule mounts the lip. The climb leg is new in the
  traversal compiler. It runs Node-side, so no page changes, and the greedy walk leg's stuck check, which reads x,y
  progress, could not drive a climb. The audit steps take every level's walk again, once (their order names the walk).
  Measured with a real browser on the meadowmark book: all five levels proved (machine gate), where three were, in three
  calls of 186, 125 and 84 s.
- **An unproved walk says where it stopped** (`create-game.js` `auditGameLevel`, `auto-audit-runner.js` `runLevelWalk`):
  the leg that stopped and where, or, if every leg arrived, where the walker stood against the exit. A climb no walker can
  take is said as such.
- **A level that cannot be finished is said before the build** (the pre-compile check's `advises`, by chapter). A level
  whose exit is up a ladder, piloted first person (a world with no hero is walked by a walker, whose rule does not
  climb), is made but cannot be finished. The check says so on the levels chapter: give the world a hero, or end the
  level on a tier its stairs reach. The walker's climbing is the runtime's to add, and is not in this change.
