### The game view: a light view layer, verification on every level (spike)

A first, low-fidelity view of mojulo's work, built from plain HTML with no framework: games first, then levels, then
characters, then objects, and on every level what proved it, by which gate, and what is still the person's to play.

- **The view** (`control/lib/view/`, `node scripts/view.mjs`): pure renderers over the store, one stylesheet, a
  `node:http` server with no dependency. A game shows its path to a first level and each level's gates; a level plays in
  the page and carries its gates and the person's stamp.
- **The still check** (a new machine gate, spiked): a level stood still for three seconds in the headless simulator
  (game/level-sim.js); one that ends without a press is reported with the event and its second. On a designed stealth
  game it found four of eight levels lost at their spawn, each stamped `pass` by the first-frame check.
- **The view as a folder** (`mojulo script view --out <dir>`, lib/view/export.js): every page written as a static file
  with relative links and each level's page inlined, so the folder opens from disk or an artifact host with no server
  (`--no-play` leaves the playable pages out, `--game <ref>` picks games). A static page has no stamp: it says to tell
  the agent, until a person's decisions have a record of their own. A relative `--out` lands where the command was run
  (the CLI passes the folder on as `MOJULO_INVOKE_CWD`).
- **Read only, for now.** The view, served or static, writes nothing: a level's eyes gate says to tell the agent, until
  a person's decisions have a record of their own. (A spike's stamp, kept in a file beside the database, was taken out
  rather than shipped as a second store to migrate later.)
- **What the still check found, fixed:**
  - *A sneak's foes stood in sight of the spawn and on the guards' posts* (gameworld/foes.js `foePlacements`): on a stage
    with guards, a foe now stands on no guard's post and on no beat its class's sight (mind/vocab.js SIGHTS, and two
    metres more) reaches the spawn from; a beat that close is left empty. Lantern Keep, rebuilt: 8 of 8 levels stand
    still for 3 s without being seen (4 were lost at 0.07 s). Its first five levels keep their guards and no longer
    stand the wide-sighted foes, whose sight reaches every free beat there.
  - *An anime book's henchman body was laid over a beast kin* (gameworld/runner.js): a people foe drawn on the beast's
    tiered body has a body and a skull of its own, and the henchman's (an anime body brings the anime head) made the
    hero door refuse the run. It is laid over a person only now.
