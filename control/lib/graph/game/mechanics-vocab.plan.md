# mechanics-vocab.plan.md — growing the declarative mechanics vocabulary (the vocab-growth spike)

Lineage: `game-mechanics.plan.md` M0 shipped the five v1 words (`reach-exit` / `survive` /
`collect` / `hazard-damage` / `fail-on-death`) and the mechanics-guide card deferred combat
words "behind a combat world idiom." `godot-handoff.plan.md` G6 then proved the words travel:
one score, two instruments (game-shell.js on web, `godot-kernel/level.gd` in Godot). This plan
grows the vocabulary itself — the engine-neutral upstream move that upgrades the web build,
the Godot leg, and the planned Unreal leg at once, and that clears the portability flags MSA
wears today (47 named flags, dominated by "mechanics outside the vocabulary" and "the win
condition lives in runtime code, which does not travel").

## Why this is the right layer

The export ceiling is not any engine's idiom — it is `MECHANICS_VOCAB`. The score
(`engine-score.js`) carries `manifest.game.mechanics` verbatim and stays engine-blind; each
kernel performs the words natively. So one new word costs, in full:

1. a **lowering function** in `mechanics.js` (word → event-bus fragments + contract fragments
   + audit recipe) — this alone makes it play on the web, because the bus verbs already ship
   in the runtime;
2. a **mechanic card** in `mechanic-cards/` (the parameter manual `get_game_vocab` serves);
3. a **kernel arm** per engine that performs it (a `match` branch in `level.gd`; later the
   Unreal twin);
4. a row in the **performed-vocabulary registry** (see V2) so portability stays honest while
   engines lag.

The bus is richer than the v1 words use: `emit` / `spawn` (content-derived idempotent ids) /
`set` / `inc` (with min/max clamp) / `toggle` / `impulse` / `move` (+ controllable warp),
zone sources, timers, var watches, and scope-keyed sagas with event/timer awaits. Most of the
combat vocabulary lowers to primitives that already exist.

## Invariants (carried, not new)

- **Closed vocabulary.** A word lowers to existing bus primitives or it doesn't ship — no
  runtime mechanic code, ever. If a word needs a new primitive, the primitive lands in the
  bus first, deterministically, with its own tests; the word lowers to it second.
- **Truth travels, feel doesn't.** Declare numeric truth: hp, damage, counts, timers, win/lose
  predicates. Combat *feel* — tuning curves, animation blending, AI personality, camera shake —
  stays `skipped_runtime` in the honest-loss ledger. The score must never become a game-engine
  spec; the reference performance remains the web build.
- **Engine-blind score.** No engine names in words or params; z-up, raw meters, exactly as
  `engine-score.js` pins.
- **Append-only for shipped words.** Existing games re-resolve byte-identical; mint goldens
  pin it. New words are new keys, never changed semantics of old ones.
- **Every success terminal carries an audit** (G4 completability) or its card states plainly
  that promotion stays manual and why.
- **Vocab payload budget.** `get_game_vocab` and tool descriptions grow at routing grade;
  parameter manuals stay in cards, and the tools/list ceiling is consciously re-checked.

## The word list

### Tier A — lower to existing primitives today (no new bus work)

- **`win-when` / `lose-when`** — the generic predicate terminals:
  `{ kind:'win-when', when:{ var:'kills', gte: 5 } }` lowers to a watch + `on → end`. This is
  the single highest-value word: it clears "the win condition lives in runtime code" as a
  *class*, for every level whose victory is a number. Audit caveat: a generic predicate cannot
  synthesize its own completability recipe — the word takes an optional `audit` param
  (walkto / idle / waypoints, hand-named); absent it, the card says promotion is manual. The
  specialized terminals (`reach-exit`, `survive`) stay preferred where they fit, precisely
  because their audits are automatic.
- **`time-limit`** — the fail dual of `survive`: countdown → `end fail`. Timer + inc + watch,
  all existing. Composes with `reach-exit` for timed runs.
- **`collect-all`** — terminal form of `collect`: gathering every pickup ends in success.
  Lowering rides collect's own reactions plus one counter var and a watch. Clears the
  completion flag for collection-shaped levels; audit synthesizes as waypoints through the
  pickups.
- **`defeat-all`** — terminal that counts `enemy:down` events to N → success. Deliberately
  split from *how* enemies go down (Tier B emitters produce `enemy:down`); the terminal itself
  is just a counter watch and ships in Tier A so `win-when`-style arenas read declaratively
  even while damage-dealing is still hand-authored bus reactions.

### Tier B — the combat idiom (small new surface, decided by V0)

- **`hp-pool`** — per-entity health as namespaced vars (`__hp_<id>`), clamped `inc` on a
  `hit:<id>` event, `toggle` off + `emit enemy:down` at zero. All existing verbs; the open
  design question is only naming discipline (mergeVars must keep per-entity vars conflict-free).
- **`melee-strike`** — attack input + player-within-reach-of-entity → `emit hit:<id>`.
  The one likely NEW primitive lives here: zone sources today sit at a fixed `at`; a strike
  against a *moving* enemy needs an **entity-anchored zone** (`at: { entity:<id> }`) or an
  equivalent proximity fact. V0 verifies whether `deriveZoneEvents` can already watch
  entity-to-entity distance; if not, the anchored zone lands in the bus first (with the same
  determinism obligations as every source), and the word lowers to it.
- **`projectile`** — `spawn` + `impulse` exist and are deterministic, and contact facts exist
  on the physics channel — but the physics channel is exactly what the ledger says does not
  travel. The word can still travel (kernels perform it natively, as with every word), but its
  web lowering leans on the physics step. V0 decides: in-scope with a bus-facts lowering, or
  explicitly deferred with the reason recorded here. Do not let this word block Tier A/B —
  a melee duel proves the idiom without it.

### Deferred, by name, with reasons

- **AI / `party-battle`** — behavior is feel; practice-mode AI stays runtime
  (`MSG_AI` wire), per the truth-vs-feel invariant.
- **Movers / live physics channels in the score** — unchanged ledger entries; they are
  runtime state, not declarations.
- **`checkpoint`** — wants the fall policy's respawn `to` to dereference a var, which the
  verb layer doesn't do today (`resolveRef` reads event paths only). Small bus extension,
  real but not combat-critical; parked until a level actually asks.

## Phases

- **V0 — inventory & ratify (the spike's spike).** Read MSA's level manifests and enumerate
  what its hand-authored reactions/runtime actually do; classify each of the 47 flags as
  *data-expressible* (a Tier A/B word covers it) or *feel* (stays ledgered). Verify the three
  bus questions above (entity-anchored zones; inputs-channel shape for an attack key;
  projectile lowering). Exit: the word list above amended in place, each word marked
  in / out / deferred-with-reason.
- **V1 — Tier A words.** Lowering functions + cards + tests + audits in `mechanics.js` /
  `mechanic-cards/`; `composeMechanics` teaching errors extended (e.g. `defeat-all` with no
  `enemy:down` producer in the level is refused with a hint, same idiom as the
  success-terminal rule). Web plays them immediately. Goldens: existing games byte-identical.
- **V2 — the performed-vocabulary registry.** Today `engine-portability.js` hardcodes its own
  copy of the word list; once words can outrun kernels that is a lie in waiting. Split the
  registries explicitly: `MECHANIC_KINDS` (what mojulo lowers) vs a per-engine performs matrix
  (`web` / `godot` / `unreal`) that `assessPortability` reads, so a level using a word the
  Godot kernel hasn't learned yet flags as `mechanic 'X' not yet performed by godot` — the
  flag names the lagging engine, not the word. `portability.json` gains the matrix row.
- **V3 — kernel arms (Godot).** `level.gd` match-arms for V1 words, then the Tier B idiom
  (anchored-zone strike check is a `_body_distance`-style test against the entity node;
  `hp-pool`/`defeat-all` are dictionary state exactly like `bag`). Kernel `VERSION` bump;
  the `godot-verify` gate re-run; the performs matrix flips rows as arms land.
- **V4 — proof & re-audit.** A new founding level, **`duel`**: one enemy, `hp-pool` +
  `melee-strike` + `defeat-all` + `fail-on-death` + `time-limit`. Exit criteria:
  (a) `duel` assesses portable, zero flags; (b) `export_game { target:'godot' }` pack plays
  the duel through the kernel, machine gate clean; (c) MSA re-audited — the flag count delta
  is the spike's headline number, recorded here honestly (feel-class flags will and should
  remain); (d) mechanics-guide + changelog updated; existing goldens still byte-identical.

## Open questions (answered by V0, not by opinion)

1. Can a zone source anchor to a moving entity today, or is the anchored zone the one new
   primitive this plan adds to the bus?
2. Does the inputs channel already carry a bindable attack action on both instruments (web
   keys + kernel input map), or does `melee-strike` also specify the binding?
3. `projectile`: in or out for this spike?
4. Does `win-when` need a `both`/`all` combinator (`when: [{...},{...}]`), or is one predicate
   per word instance enough for everything MSA actually declares?
