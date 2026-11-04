### Requisitions: one chapter or one level at a time, to quality, and then again

The design for producing a game one unit at a time. A unit is a chapter of the game book or one level. The director
(the person's agent) raises a **requisition** for the next unit, and it goes to the department that owns that unit's
chapter. Units are authored one by one, so a mistake stays inside its unit and an accepted unit is settled ground for
the next. Subagents work inside a unit rather than across units: **diverge** orders make alternatives of the same unit
and keep one, and **critic** orders review it with a fresh context. A unit is **received** when its machine gate holds
and **accepted** when the person approves it (for a level, once they have played it). The person's notes on what they
sent back carry into the next requisition. The game is built up to its last accepted level as each level lands, and it
ends when the last planned level is accepted. A quick game is one unit, made by a single author. The ledger is kept
apart from the recipe and adds nothing to any render or export. The design is in progress; its first piece, below, is in the code.

- **Fixed: a run no longer reverts what was written while it ran.** A `design_game` run read the world once and wrote
  its whole copy back at each checkpoint, on a failure partway and at its end. So a page another chapter wrote during
  the run, or the creator's verdict, was quietly undone. Each write now lays only the run's own changes (its record, a
  pinned hero base and the approval kept with it) onto the world as it is stored at that moment
  (`gameworld/rebase.js`). A run with nothing written beside it writes what it always wrote.
- **One level is a unit of its own** (`design_game({ ref, chapter: 'level:<id>' })`, `chapters.js` `unitOf`). It is the
  levels chapter narrowed to one level: its review part, its page, the links in and out of it, and its next moves. Its
  state is its part's stamp. On the meadowmark reference book that is 1.7 KB, where the levels chapter is 2.6 KB and the
  whole readout 7.0 KB. Its run (`run: true`) makes that level's stages and what their orders name (the level's pilot),
  never a sibling level's. A level the world does not have is refused before anything is made. A write past the level
  is written and reported (`outside`), never refused. The id mirrors the level's review part, so `tools/list` is
  unchanged.
- **The studio card works one unit at a time.** The chapters are listed in the order they read each other, worked one
  at a time to quality so a mistake stays in its unit, and each level is a unit. A subagent is handed the next unit once
  the last one is settled. Before, the card said a wave's chapters could be worked side by side.
