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
