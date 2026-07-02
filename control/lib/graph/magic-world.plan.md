# magic-world — the orientation behind "action worlds"

Status: orientation / framing doc. Names the feel of the substrate the code calls `actions-world` /
`events`. Companion to [actions-world.plan.md](actions-world.plan.md) (the physics class),
[controllable-world.plan.md](controllable-world.plan.md) (the subject / control), and
[event-bus.plan.md](event-bus.plan.md) (the trigger / consequence layer). Code names are unchanged —
the operational term stays **action world**; this doc only sets the orientation.

<!-- Etymology, kept as a comment: the original orientation for this was *karma* — action bound to
     consequence, a deed never lost. action = karma. We dropped the doctrine from the operational
     text but kept the operational word: "action" world. The surviving one-line idea is just that an
     act and its consequence are lawfully linked. -->

**Scope, decided:** the deliverable is the *running world* — action in the moment, executed with
fidelity. Recording / replay / persistence are explicitly OUT OF SCOPE (see "Out of scope"). The
outcome-capture explorations below the line are kept as appendix, not goals.

## The framing — why we call it "magic"

An action world is a world where **stuff happens, the rules execute, and you don't wire any of it.**
You declare what exists and what reacts; then a deed fires, the rules resolve, the score moves, a
door opens, a splash spawns — automatically. Nothing imperative runs, no callback is hand-threaded,
no frame loop is babysat. It just *works*, the same way every time. That automaticity is the
"magic": not spectacle, but the relief of **not having to worry about it** — declare the rules and
the world keeps itself honest.

The magic has a precise operational definition, and the rest of this file is its consequences:

> **magic = automatic + deterministic + self-resolving.** Deeds happen, consequences propagate
> through the rules with no hand-wiring, and the same act yields the same fruit every run.

What can look like "a stripped-down game engine with some event-sourcing" is, read correctly,
**automation made deterministic** — a world that executes its own rules so reliably you stop thinking
about the execution at all.

## The automation, mapped to the code

| Property of the magic | What it already is in the substrate |
|---|---|
| same act, same outcome — lawful, repeatable | determinism: fixed-dt + seeded; the bus refuses constructs that break it ([event-bus.plan.md](event-bus.plan.md)). Here so the world executes *rightly*, not so it can be replayed. |
| the true state is computed; the picture follows | the bus computes the resolved state each tick; the rendered frame is its read-only projection |
| apparent chance is really seeded fate; true novelty is received | randomness is seeded (deterministic) or resolved in the moment — never an unaccountable gap in causation |
| free action is the only source of novelty | input is the ONLY contracted break in determinism; everything else is automatic consequence |
| a consequence crossing out of the world | the second bus — an in-world deed conditioning the substrate (a bot / app). **Deliberately not built: see "Out of scope" — it would tether the world to this host and break portability.** |

None of this is retrofitted. The inversions that make this *not* a game engine are exactly what make
it feel automatic: you set the rules, the world runs them for you.

## The deliverable: a world that RUNS

The magic-world IS the deliverable — and the deliverable is the **lived run**, not a record of it. A
lawful world, reborn each session, where the subject acts and the world answers *in the moment, at
the moment, rightfully, with fidelity*. Each session is unique because the subject's free action is
the only novelty; everything else is the act's automatic consequence, resolved as it happens.

We make **no attempt to capture or replay** a session. The value is the run itself — the act
executed faithfully, now. If a particular session is worth keeping, that is the operator's screen
capture, not the substrate's concern.

A game simulates a world to be experienced and discards it; an action world is built so the
experience is *executed rightly* — the right consequence for the act, every time — and then it, too,
passes. **The fidelity of the moment is the whole point.**

## The subject

The one who acts and bears the consequence. In the code this is the controllable layer's
camera-entity / avatar ([controllable-world.plan.md](controllable-world.plan.md)). The subject's
deeds are the only novelty; the world's automatic response is everything else.

## Canonical composition — how an action world is built

Every action world composes from **four primitive families**. This is the model to author and
reason in; the `events` schema stays flat and general — these are *roles*, not new schema groups.

| Family | Role | The fields that play it |
|---|---|---|
| **Sources** | what happens + who acts | physics facts (`sources`), recurring `timers`, sequence `await` timers, conceptual `watches`, `inputs` (key / pointer / pick) |
| **Triggers** | consequence — happening → effect | `reactions` (`on` / `match` / `do`), scope-keyed `sequences` |
| **Tracker** | stakes — the quantified, goal-bearing state | `vars` + `set` / `inc`, read by `watches` |
| **Projection** | feedback — state made perceivable | marker meshes / `__syncBus`, `hud`, the pick raycast |

Sources + Triggers are the **trigger layer**; the **tracker layer** is `vars` + `watches`. Sources
feed both; projection closes the loop back to the subject.

### Gameness is a coupling, not a category

A game is not a kind of world — it is the shape that appears when one loop is closed:

> **deed → trigger → tracker → goal** — the subject's action causally moves a quantified state
> toward a condition that resolves the experience, run against a stream of automatic occurrences.

You climb into it *by degrees*, adding one family at a time:

| Shape | What's wired | Example |
|---|---|---|
| **Toy** | sources + triggers, no tracker | the cradles — things happen, nothing counts |
| **Puzzle** | + a watch, but the tracker is *binary* | the vault — a goal, no score |
| **Game** | + a *quantified* tracker + a goal-watch + agency coupled to it | whack-a-mole |

### Design stance (load-bearing)

- **Keep the schema flat and general.** The four families are a lens for authoring, not nested schema
  groups. An author asks: *what are my sources, what's my tracker, what closes the loop?*
- **Do NOT add a `game` property.** Game is a *configuration* reached by degrees; a dedicated category
  would make the toy→puzzle→game continuum discontinuous and trip the rule against paradigm-specific
  branches downstream of config composition. Generality is the asset — it is what lets unforeseen
  shapes emerge from the same vocabulary.
- **The one honest extension point is projection.** Feedback is currently thin (`hud` + marker
  meshes). General projection bindings (any var/entity → colour / scale / text / position) would
  deepen *feel* without adding a category — the "extend" worth queuing when more game-feel is wanted.

## Why determinism, then — fidelity, not replay

Determinism is not here so we can reproduce a session. It is here so the world executes *rightly*:
lawful cause and effect, the same act yielding the consequence it should, responsive and faithful in
the moment. The magic is in the faithful, automatic execution, not in any ledger.

This is also where novelty (incl. RNG) lands cleanly with no recording machinery: in the lawful
core, randomness is either **seeded** — apparent chance that is really fixed fate, resolved
deterministically — or, if it is genuine outside entropy, **received and resolved in the moment**.
Either way the run is *right* as it happens; nothing needs keeping for it to have been faithful.
`hashState` and the seeded/pure discipline ([event-bus.plan.md](event-bus.plan.md)) stay — now as
tools for *correctness of execution* (proving the world behaves lawfully), not a recording layer.

## Out of scope (deliberately)

Recording, replay, session persistence, tick-quantized *authoritative* time, and carry-forward
seeding (one session's end-state conditioning the next) are explicitly **not** goals. They are
explored in the appendix below and are sound, but they serve a record we are not building. If they
ever return, they return as an optional layer on top of a world that already runs — never as a
prerequisite. Focus: **run it.**

Also out of scope, for a different reason: the **second bus** — any world→substrate consequence
(`emit_chat_signal` / `bind_trigger` / a call into the agent). This is excluded to preserve
**portability**: a self-contained world is just HTML+JS and runs anywhere with zero dependency on
mojulo, the agent, or the localhost MCP transport. The instant a world calls back into the
agent/substrate it is tethered to *this host* and is dead on arrival anywhere else. Note this is the
same contract as determinism viewed from another angle — fixed-dt + seeded + **no outbound calls**
is what makes the run both byte-reproducible and portable; agent-in-the-loop breaks both. The `emit`
verb therefore stays in-world (drives `reactions`); it must never quietly become an outbound signal.
If the second bus ever returns it is an explicit opt-in export mode that trades portability away,
never a runtime default.

---

## Appendix — recording explorations (NOT goals; kept for reference)

## Deed-recording (the capability that would make the session the deliverable)

A session's entire unfolding is a function of exactly two things, because everything except input is
automatic consequence (pure functions of state):

```
session  =  world-seed  +  deed-log
```

- A **deed** is the minimal record of novelty entering the lawful core: `{ tick, event }` — an
  input-originated bus event stamped with the tick it entered on.
- The **deed-log** is the ordered, hash-chained list of deeds — the session's ledger.
- **Replay** re-runs the same deterministic loop, injecting each deed at its tick. Because the world
  is lawful, the whole history reconstructs byte-for-byte; `hashState` checkpoints verify integrity.

### Why it is abstracted — one recorder for every action-world

Deed-recording hooks the **deed boundary** (where novelty enters), not world logic. It never needs
to know whether the world is a cradle, a vault, or something unbuilt. It is world-agnostic by
construction:

1. `(seed, deeds)` fully determines any lawful world — nothing world-specific is stored.
2. the deed format is neutral — a tick and an event object.
3. a deed generalizes to ANY entry of novelty: keypress today, pointer, later an external /
   second-bus injection. Anything nondeterministic from outside the lawful core is, by definition, a
   deed.

That last point is the universality: **a deed is any novelty crossing into a lawful world.** Today
the subject is human; tomorrow it is an external trigger — the same ledger, the same recorder.

### The one invariant it requires: quantized time

For `(seed, deeds)` to reproduce a session exactly, time must be **tick-quantized**: the world
advances on a fixed integer tick, and deeds bind to tick indices — never wall-clock. Today the
integrator steps on a fixed internal dt, but the number of steps per frame is frame-paced and the
bus's `stepTime` takes wall-clock dt, so the live unfolding currently depends on frame timing — not
purely on `(seed, deeds)`.

The fix is a refinement, not a rewrite: make the **tick** the authoritative unit of time (one fixed
dt per tick, an integer tick counter driving physics + bus together), stamp deeds by tick, and let
the renderer interpolate for visual smoothness on top. This is the single prerequisite before
deed-recording is exact — and it tightens determinism generally (a strict improvement). The
nondeterminism discipline is otherwise already in place: the lawful layers are seeded/pure and the
substrate forbids `Date.now` / `Math.random` there, so once time is quantized, input is genuinely
the only novelty.

## Carry-forward seeding (optional, later)

If a session's end-state seeds the next session's initial conditions, the world is reborn not
identically but *conditioned by prior deeds*. The deed-log plus the final `hashState` already contain
everything needed to carry state forward.

## Status

- BUILT — the lawful core: physics (+ tether constraint), the controllable subject, the event bus
  (sources: physics facts / one-shot + recurring timers / conceptual watches / input incl.
  **pointer-pick**; conceptual state via `vars`; verbs incl. `toggle to:`, `set`, `inc`; scope-keyed
  sequences; the `hashState` oracle; a var→screen `hud`), and the `/world` + `world-scene` wiring.
  Three worlds now span the range: [newton-cradles.js](newton-cradles.js) (physics-driven),
  [conceptual-vault.js](conceptual-vault.js) (purely conceptual), and [whack-a-mole.js](whack-a-mole.js)
  (a full conceptual GAME — moles pop on recurring timers, click-to-score via the tracker `var`, a
  10s countdown watch ends it).
- FOCUS — **run it**: the live, faithful, in-the-moment execution at `/world`. Pointer-pick is now
  built (every conceptual world is directly clickable). Remaining priorities: closing the standing
  visual-confirmation gap (eyes on a rendered page), and reaction-spawns-physics-body.
- OUT OF SCOPE — recording, replay, persistence, tick-quantized-for-replay, carry-forward seeding
  (appendix only).
