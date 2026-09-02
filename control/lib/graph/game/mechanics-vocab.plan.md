# mechanics-vocab.plan.md — growing the declarative mechanics vocabulary (the vocab-growth spike)

Status: **V1 RUN 2026-09-02** — the combat trio (`win-when` + `hp-pool` + `defeat-all`)
shipped: lowerings + cards + tests + the producer-rule teaching error, all on existing bus
verbs. See "V1 — run notes" below the V0 findings. `time-limit` / `collect-all` remain open
(low priority); `melee-strike` stays gated on the entity-anchored zone (V3); V2–V4 not started.
(V0 RUN 2026-08-31 — inventory complete, the four open questions answered from code.)

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

## V0 — findings (run 2026-08-31)

Read of MSA's stored manifests (`sk_ms_arena` + all 45 level refs) against
`assessPortability`. **The four open questions are answered at the bottom; two findings
change this plan's shape and one of them is a correctness warning.**

### The 47 flags are 45 copies of one flag, plus two

Recomputed exactly, and it reproduces:

| count | flag |
|---:|---|
| 45 | `no completion mechanic (reach-exit / survive) — the win condition lives in runtime code` |
| 1 | `'setup' shell UI does not travel` |
| 2 | *(with)* `'difficulty' shell UI does not travel` |

No `mechanics outside the vocabulary` flags, no gate flags, and — since the total is
*exactly* 47 — no `skipped_movers` / `skipped_physics` ledger flags either. So "47 flags,
dominated by the win condition" understates it: **the win condition is 96% of the number,
and the other 4% is shell UI that is correctly non-travelling.** There is no long tail.

### MSA declares ZERO mechanics — but its win condition is already data

All 45 levels carry a `game` block of `{ consumes, levelRef, presets, produces }` — career
and roster composition. None carries `mechanics`, `vars`, `reactions`, `events`, `sources`,
`timers`, or `watches`.

But 42 of the 45 carry a **`match` block whose `killTarget` is a plain integer**:

| mode | levels | `killTarget` |
|---|---:|---:|
| solo / ffa / practice | 18 | 3 |
| team | 6 | 6 |
| watch (spectate) | 18 | 5 |
| tutorial (`sk_ms_tutorial_*`) | 3 | *no `match` block* |

So the win condition was never "lost in runtime code" in the sense the flag text implies —
**it is declared, as a number, in a channel `engine-score.js` does not read.** `engine-score`
carries `manifest.game.mechanics` verbatim; `match` is a sibling it ignores.

### ⚠ The correctness warning: a terminal without a producer makes the report LIE

The tempting one-line fix — lower `match.killTarget` into `win-when { var:'kills', gte: N }` —
would clear all 42 flags and set `portable: true`. **It would also be false.** Nothing in
any MSA level declaratively increments a `kills` var: there are no reactions, no emitters, no
`enemy:down` producer. The exported game would assess portable and then never be winnable.

That is a worse outcome than the honest flag we have today, and it cuts against this plan's
own invariant ("every success terminal carries an audit, or its card says plainly that
promotion stays manual"). **Flag-clearing and playability are different goals and V1 must not
be allowed to blur them.** For MSA specifically, the terminal is worthless without the
producer — which means `hp-pool` (Tier B) is not optional follow-on work, it is part of the
minimum honest slice.

### Recommended V1 scope (narrower than this plan assumed)

`win-when` + `hp-pool` + `defeat-all` — terminal, producer, and counter together, so the
first word that clears an MSA flag also makes the level winnable. `time-limit` and
`collect-all` are cheap and correct but serve OTHER games (crypt-of-the-rune-key shapes);
they can ride along or wait without affecting the MSA number. The 3 tutorial levels are out
of scope for V1: with no `match` block their completion is tutorial-step state, which needs
`tutorial-mode.plan.md`'s own notion of done.

### The four open questions, answered

1. **Can a zone source anchor to a moving entity today?** **No — and it is the one new bus
   primitive.** `inZone(p, s)` in `worlds/event-bus.js:449` reads `const at = s.at || [0,0,0]`,
   a static literal; `s.watch` globs which entities are *tested*, never where the zone *is*.
   The change is small and the data is already in hand: `deriveZoneEvents(entities, prev,
   sources)` receives every entity, so `at: { entity:'<id>' }` resolves in-function. Determinism
   obligation: resolve all anchors from the tick's entity snapshot BEFORE any containment test,
   so order-invariance holds exactly as it does today.
2. **Does the inputs channel carry a bindable attack action on both instruments?** **No, on
   either.** `channels/actions.js` has `{ on:'key', … }` but its verbs act on physics BODIES
   via `window.__mojSim` and it is gated on the physics channel; the controllable walker reads
   raw `e.code` into a fixed axis map (`controllable/index.js:776`), and the Godot kernel
   hardcodes `Input.is_physical_key_pressed(KEY_W)` in `walker.gd`. There is no shared, score-
   carried action binding. **`melee-strike` must therefore specify its own binding**, on both
   instruments — that cost belongs in the word, not in a pre-existing channel.
3. **`projectile` — in or out?** **Out, deferred.** MSA produces no `skipped_physics` flag,
   meaning its levels do not use the physics channel at all; its projectiles are runtime/AI
   code. A physics-lowered `projectile` would therefore not describe MSA's own combat, while
   inheriting the one channel the ledger already says does not travel. Revisit when a level
   actually declares physics-based shooting.
4. **Does `win-when` need an all/both combinator?** **No.** Every one of the 42 match-carrying
   levels declares exactly one predicate (`killTarget`); team mode scopes the count but does not
   add a second condition. One predicate per word instance covers 100% of MSA. Defer the
   combinator until a level asks.

### Word list, marked

- `win-when` — **IN (V1) — SHIPPED 2026-09-02.** Clears the flag class. Must ship with a producer; see the warning.
- `hp-pool` — **IN (V1), promoted from Tier B — SHIPPED 2026-09-02.** It is the producer that makes `win-when`
  honest for MSA. All-existing verbs; the open question is only per-entity var naming.
- `defeat-all` — **IN (V1) — SHIPPED 2026-09-02**, paired with `hp-pool` as its `enemy:down` source.
- `time-limit` — **IN, low priority.** Correct and cheap; no MSA level asks for it.
- `collect-all` — **IN, low priority.** Serves collection-shaped games, not MSA.
- `melee-strike` — **IN (V1-late / V3)**, gated on the entity-anchored zone landing in the bus
  first (Q1) and on carrying its own input binding (Q2).
- `projectile` — **DEFERRED**, reason in Q3.
- AI / `party-battle`, movers / live physics, `checkpoint` — **unchanged, still deferred.**


## V1 — run notes (2026-09-02)

The trio landed in `mechanics.js` + `mechanic-cards/` (win-when / hp-pool / defeat-all cards,
mechanics-guide + the `get_game_vocab` drawer row updated), with lowering, compose-rule, and
live-bus end-to-end tests in `mechanics.test.js`. Existing goldens byte-identical (game / worlds /
scene suites + the tool-descriptions ceiling all green). Design decisions recorded:

- **The producer rule is enforced generically.** A lowering may declare `emits:[…]` (hp-pool →
  `enemy:down`) and `needs:[…]` (defeat-all); compose refuses an unmet need with a hint. The
  escape is explicit: `defeat-all { producer:'runtime' }` acknowledges that hand-authored world
  reactions emit `enemy:down` — the honest seam for MSA-shaped levels, named in the card.
- **The V0 warning recurses one level down, accepted and documented.** `hp-pool` makes downs
  declarative, but nothing in the vocabulary can DEAL hits until `melee-strike` (V3) — so
  `hit:<id>` production is the same seam one layer lower. The hp-pool card says so plainly;
  a combat level is fully declarative only after V3.
- **`defeat-all` infers its count** from a sibling `hp-pool`'s entity list (compose-time hints
  prepass over raw params); explicit `count` wins; standalone-with-neither is refused teaching
  the inference. No auto-audit — nothing can drive a win yet, so its card states promotion
  stays manual, per the invariant.
- **`win-when`** validates its predicate against the bus comparator keys, defaults its event to
  `win:met` (nameable via `event` for multiples), takes an opt-in `hud` label, and passes a
  hand-named `walkto`/`idle` audit through after shape-checking it.
- **`engine-portability.js` deliberately untouched.** A level using the new words still flags —
  honest until the kernel performs them (V3) behind the performed-vocabulary registry (V2).
  The success-terminal refusal message now derives its kind list from the registry.

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
