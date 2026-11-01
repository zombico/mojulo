### Four game breakers: the flight page, the arenas' outcomes, the foes patch, the tiebreak

Four defects an end-to-end sweep of the game types found, each one line where it broke and each held by a test.

- **The flight page plays.** An airspace level (a flight sim, air combat) drew a black page: the terrain LOD and the
  touch pad a game made for a screen carries both declared `__tShown` at the page script's top level, a SyntaxError
  before the first frame. The terrain LOD's is `__lodShown` now. `scene/channels/page-scope.test.js` holds the pair to
  one scope (no shared top-level name, and the two parse as one module); the emit fixture matrix has no terrain or
  screen fixture to catch it.
- **An arena's outcome is saved.** The contests (court, pitch, meet, turns, innings), the versus fighter and the holo
  table posted their outcome without `contractVersion`, so the play shell refused it at the end of every match ("the
  level's outcome could not be applied, so nothing was saved from this run"). Each envelope now opens with its wire's
  version. `game/arena-outcomes.test.js` reads every arena client for the envelopes it posts (a text reader in
  `scripts/test-changed.mjs`).
- **The casting call's patch applies as handed out.** `design_game`'s `next` foes suggestion wrote `{ op: 'add', path }`,
  which the patch door refuses (`add` is `{ into, entry }`, an entry appended to a list of ids); it writes `set` now, and
  the game book card says what `add` takes. The foe cast test applies the proposal through `applyManifestPatch`.
- **A tennis set ends.** A set tied at six all played on without end (a computer exhibition reached 61–61). The contest
  kernel's ladder takes `tiebreak: { at, to, by? }` on a unit above the lowest: tied at `at`, the unit is decided by one
  more of the unit below, counted plainly to `to` ahead by `by`, its serve changing hands after the first point and every
  two after. Tennis (the book's and the arcade rules') breaks its set at six all with a game to seven by two. A ladder
  without one plays as it did; a minted tennis match plays as before until a set reaches six all.
