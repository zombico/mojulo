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
- **The requisition ledger** (`design_game({ ref, req })`, `gameworld/reqs.js`, the `gameworld_reqs` table). The director
  asks for one unit at a time: `req: { unit, remit?, staffing? }`, where a unit is a chapter or `level:<id>`.
  - **Pull-through.** Asking for a unit first raises, each as its own req, the chapters upstream of it that the book
    holds and has not settled, in book order. A chapter that is settled, already asked for, or has no review of its
    own is not raised.
  - **One at a time.** The first live req is the current one; the rest are queued. A unit asked for while another is
    open is queued after it and the readout says so; it is never refused. A unit asked for twice is asked for once.
  - **Status is read from the book, never stored.** A unit is accepted when the creator approves every part of it, and
    goes stale if a part changes after. It is "sent back" when a part is sent back. A unit with no review part is
    accepted on the creator's word (`req: { id, accept: true }`), against the print of its pages. A req can also be
    cancelled, and a level that leaves the world is gone.
  - **What a unit reads besides its chapter.** Its view (`{ ref, chapter: unit }`) carries its `req`: the remit, the
    staffing and its budget, and the precedent. The precedent is the last accepted unit of its kind with its remit (a
    level's is the last accepted level), plus the creator's notes on everything they sent back so far. Those notes are
    kept in the ledger the first time the door reads them.
  - **A level's remit** names its way in and out, how hard it is, the one new idea it teaches, its foes and its beat.
    What it leaves out is advised, never required.
  - **Staffing** is `soloist` (one author: the quick path) or `studio`, each with a budget of what the server can count.
    The jobs that spend it come next.
  - The readout's `reqs` gives the current unit, the queue and the counts, and its next moves gain `req`. The ledger
    never touches the recipe: a world reads, renders and exports the same with or without it (tested). The
    `gameworld-next` card's ceiling moves from 4096 to 4352 bytes for its one `req` line.
- **Fixed: a run's first-frame record no longer reverts a page written while it rendered.** It was the last
  whole-world write after a run; it now uses the same rebase as the run's own writes.
- **The jobs inside a req** (`gameworld/jobs.js`, the `gameworld_req_jobs` table). Each job is the size of one agent's
  turn: the exact call it reads with, the pages it may write, the call it reports with, and the tier of judgment it
  needs. Starting a req (`req: { id, start: true }`) issues its authors, by its staffing.
  - **A soloist** gets one author. Its report applies its patch at once.
  - **A studio** gets its diverge authors (`budget.diverge`), each given a different angle on the remit: the plainest
    reading, the boldest, and the one furthest from the precedent. Their patches are held. The director (or the
    creator) keeps one with `req: { id, keep: 'j2' }`: that patch is applied, and the others are declined and kept on
    record.
  - **Critics** are issued once a proposal is kept (`budget.critics`). Each reads with a lens (design against the
    remit, play as a player, look as a viewer), never the maker's reasoning, and reports findings.
  - **A report goes through `design_game` itself:** `req: { id, job, patch, decisions }` for an author,
    `req: { id, job, findings }` for a critic. A decision with no `because` is counted as uncited: a choice the seed
    made. A patch past the unit's pages is applied and reported, never refused. A job reports once.
  - **The budget bounds what is issued.** Every job counts, a reissue among them (`req: { id, reissue: 'j1' }`). A job
    past the budget is not issued, and the readout says so.
  - **What the director does next** is in the unit's view and the ledger's current req (`does`): start, work, keep,
    critique or review. The unit's view lists each job: an issued job's brief, or a reported job's report (what it
    wrote, its cited and uncited decisions, its findings).
  - **No new listed tool:** a job's whole allowlist is `design_game`. The ledger's own card (`gameworld-ledger`, the
    build chapter's) teaches the reqs, the jobs, the received gate and the composite; the studio card points to it.
  - **An author's report can say what it could not make:** `asks` lists what the remit wants that no word of the recipe
    reaches. It is kept on the job and reported to the director, so a gap is said, never faked.
  - **A level's author is handed a level page's manuals.** A level unit's view names the world card (a level's walk,
    goal, places and style) and the foes card (a level's own foes) before its chapter's own cards. A test holds that
    each key a level page writes is taught on one of them.
  - **Tried with a live agent.** A fresh agent given only one author job's brief read its view, authored a level of the
    reference book and reported. It was refused once with a readable error and corrected itself. Its job was kept,
    with every decision cited. It found the two gaps above: the view pointed it at neither of the cards that teach a
    level page, so it missed a level's own `foes` key; and the remit's tide (a passage that opens and closes) is a
    capability no word of the recipe has, which it could only say in prose.
- **The received gate** (`gameworld/reqs.js` `receiptOf`): a unit's machine gate, before the creator's verdict. It
  holds when a proposal is kept, every decision in it is cited, every critic has reported, and no law of the machine
  gate advises on the unit's parts. A level also needs its stages made and played by the probe as they stand, after
  the proposal was kept. What it does not hold on it reports: the kept proposal's asks and the critics' findings. A unit
  whose gate holds is **received**, a status between open and accepted. Received is not accepted: the creator's
  verdict still decides. A unit's view carries its `receipt`.
- **The play probe** (`game/level-probe.js`, `req: { id, probe: true }`, a machine gate). Each of a level's stages is
  played on its World page, in an installed browser (never a download), for 17 seconds of simulated time under a simple
  script: forward the whole time, fire, jump and interact now and then. It says four things:
  - **loads:** no uncaught error while the page loads and plays;
  - **not lost:** the level is not over after a second standing still;
  - **opposed:** a level whose goal is to survive, fight, sneak or race has a foe, a hazard or a rival in it, read from
    the stage's own manifest;
  - **clean:** no debugging text on the page (`0 events → store`, `NaN`, `undefined`, `[object Object]`).

  It keeps a frame at 5, 11 and 17 seconds for a look critic, under the outcomes folder. It cannot aim, so it says
  nothing of balance. Its verdict is kept as the req's ride job: the server's own work, which spends none of the
  budget. With no browser it is skipped, and the loop goes on to the creator. Each check is tested against the starter
  that failed it in play.
- **What the director does next** gains `probe` (a level whose stages have not been played as they stand) and `fix`
  (the probe does not hold: back to its author), before `review`.
- **An accepted unit goes stale when a chapter it reads moves.** The ledger keeps the prints of a unit's upstream
  chapters the first time it reads the unit accepted. If one moves, the unit is stale, and the creator can accept it
  again on their word (`req: { id, accept: true }`) once they have looked.
- **The game is built up to its last accepted level** (`gameworld/runner.js` `composedStages`). When a world's ledger
  asks for levels one at a time, its game is made of the levels the creator has accepted, as they stand: their stages in
  the book's order, the gates chained over them alone, and the links and a map's exits between them only. So the game is
  always playable to its last accepted level, and it ends when the last planned level is accepted. A stale level stays
  out until it is accepted again.
  - **A composite build** (`run: true`) makes the accepted levels' stages and everything they share (the hero, the
    casts, the foes), never a level no one has worked yet: a level's stages are its own unit's to make. Only the
    accepted levels are walked after the game. With none accepted there is no game yet.
  - **The readout asks for it.** Once an accepted level is missing from the game as made, `next` gains `composite` (the
    levels it would be made of; `first` when no game exists yet), and the ledger's `reqs.composite` says whether the
    game holds them. The pre-compile check, the run and the proofs all read the same composite.
  - **A world that asks for no level is unchanged.** With no composite the runner's steps are byte-identical (tested on
    a book with its hero and on a world before its people).
