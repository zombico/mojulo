# game assets — interactive objects for game levels (appearance · state · interaction)

Status: DESIGN ONLY, nothing implemented. Drafted 2026-07-06 as the companion to
[game-mechanics.plan.md](game-mechanics.plan.md). Mechanics gave levels their RULES (win/lose,
outcomes, the store contract, verification). This plan is the OTHER half: the interactive
OBJECTS a level is made of — what they look like, what states they hold, and how the player
acts on them. It builds directly on the mechanics layer (zones, the bus, the store) and the
existing asset generators; it adds no new runtime.

## The gap, precisely (three sub-layers, three maturities)

"Interactive object" is not one thing. Today the three layers sit at very different depth:

1. **Appearance (geometry).** An entity body can be a primitive (`{ type:'mesh', shape:'box'|'sphere' }`)
   or a figure (`figure-frames`/`figure-rig`, from `create_figure`). That's it. So a `collect`
   pickup renders as a box marker and a hazard is an invisible zone — even though the substrate
   has rich object generators (`create_workbench`, `create_carved_solid`, `create_manji_tree`)
   whose output cannot currently be an entity body. **Placeholder.**
2. **State.** This EXISTS but is shallow: the event-bus tracks present→taken (collect toggles the
   marker's `.on` off), switch off→on, counters in `vars`. What's missing is a MULTI-state object
   with a visible transition — a chest closed → *opening* → open-and-empty is, today, "box shown" →
   "box hidden," not an object that changes. **Real but binary.**
3. **Interaction verb.** The walking player's only way to act on an object is PROXIMITY (walk into
   its zone; M0-pre). There is no "press to use / open / loot." Deliberate interaction exists in
   OTHER regimes (click-pick in physics worlds, line-of-sight fire) but not for the first-person
   walker. **Thin.**

This plan raises all three, in that order (each is independently shippable and each makes the
DEFERRED mechanics — `loot-cache`, `key→door`, `switch→gate` — actually good).

## Doctrine (inherited, decided)

- **Generated, never imported.** Objects are the output of the existing generators
  (`create_workbench` / `create_carved_solid` / `create_manji_tree` / `create_figure`), referenced
  by sketch ref and baked into the entity body at resolve time — the `figures` / `beatsRef`
  precedent (a ref is authoring-time indirection; the emitted page stays self-contained). No
  `.glb` / `.png` / asset upload, ever. This is the pure-vector constraint, unchanged.
- **Recipes, not renders.** A body stores `{ ref }`, not baked geometry; the geometry is
  regenerated deterministically on render, exactly like figure bodies today.
- **Reuse the bus, add no runtime.** State transitions are bus `toggle`/`set`/sequence over baked
  appearance frames (the `ephemeralTarget` idiom's shape); the interact verb is a bus `input`
  gated by a proximity `var`. No new reducer, no skeletal animation of objects.
- **Closed vocabulary.** A small set of object KINDS (pickup / prop / door / chest / lever), each
  a card + a lowering — not an open object-scripting API. New object behavior is a new kind, the
  same discipline as mechanics.
- **Levels stay pure.** Everything lowers to declarative world+contract at author time; muted
  capture stays byte-identical; a level without objects emits byte-identical HTML.

## Layer A — appearance: asset bodies (objects that look like something)

A new entity body type: `body: { type:'asset', ref:'sk_…', scale?, offset?, spin? }`. At resolve
(world-scene.js, beside the `figures` baking), fetch the referenced sketch, resolve its STATIC
geometry (faces — not its full traversable world), and bake it into the entity's body positioned
at the entity transform, scaled/offset to fit. A pickup becomes a modeled coin (a small carved
solid), a prop becomes a workbench object, a totem becomes a manji-tree.

- Mechanics gain an optional `body`/`asset` per placed entity: `collect`'s pickups, the `reach-exit`
  goal, a hazard's emitter marker — each `{ item, at, asset?:'sk_…' }`. Absent ⇒ today's box marker
  (so this is additive; existing mechanic levels are unchanged).
- Determinism + deletion: the ref resolves at render like `beatsRef`; a deleted asset either
  snapshots into the manifest at mint or blocks deletion-in-use (decide per the user-assets
  render-time-resolution invariant).
- **Collision is a separate flag.** An asset body is VISUAL by default (decorative — you walk
  through the coin to collect it). A `blocks:true` object (a crate you can't walk through) must
  join the walk `solids` set — which is STATIC today (the same gap doors hit; see prerequisite).

Exit: a `collect` pickup rendered as a carved-solid coin; a goal marker that's a real object;
byte-identical when no `asset` is given.

## Layer B — state: multi-state objects (objects that change)

A `stateful-object` primitive: an entity with named STATES, each a baked appearance, with
bus-driven transitions. Reuses the flipbook + toggle model (no skinning):

```
{ id, states: [{ name:'closed', body }, { name:'open', body }],
  initial:'closed', on:{ '<event>': { to:'open', via?:'opening', dwell? } } }
```

Lowers to: one bus entity per state (only the active one `on`), and reactions that toggle the
visible state on the trigger event — optionally through a brief intermediate state (`via`, shown
for `dwell` seconds, the `ephemeralTarget` scope-sequence shape) so a chest visibly *opens* rather
than snapping. State is a `var` (queryable by watches/gates), so a mechanic can react to it.

This is what makes the DEFERRED gate mechanics good: `key→door` (a door object closed→open),
`switch→gate` (a lever off→on that shifts a barrier), `loot-cache` (a chest closed→open that grants
its bundle). Those mechanics lower a `stateful-object` + the store wiring.

- **Blocking transitions need the solids toggle.** A door that BLOCKS until opened requires
  removing a solid from the walk-collision set at runtime — the static-`solids` gap. Non-blocking
  stateful objects (a chest, a lever, a visual door) work without it.

Exit: a chest that visibly opens on interaction and grants loot; a lever that flips a barrier's
state; the state readable by a gate.

## Layer C — interaction: a "use" verb for the walker

A `use-target` primitive: a proximity zone (M0-pre) that ARMS on enter (sets `canUse=<id>`, shows a
HUD prompt) and DISARMS on exit, plus a `use`-key `input` (the bus `deed`/`inputs` seam) that, while
armed, fires `interact:<id>`. So: walk near the chest → "press E" prompt → press → `interact` fires →
the chest's `stateful-object` opens and the store gets its loot.

- Pure bus composition: enter zone → `set canUse`; use input → `emit interact` gated on `canUse`;
  exit → clear. One new input binding, no new runtime. Reuses the walker's existing key handling.
- This is the deliberate-interaction layer the walker lacks — the difference between "walk over
  loot" (proximity, fine for coins) and "open the chest / throw the lever / read the sign" (a
  choice the player makes).

Exit: "press to open / use / loot" works in walk mode; the prompt renders; muted capture unaffected.

## World-affordance prerequisites (like the mechanics zone source was)

- **Runtime solids toggle (for BLOCKING objects/doors).** The walk rule collides against a STATIC
  `solids` set (verified during the mechanics work). A crate you can't walk through, or a door that
  blocks until opened, needs a solid added/removed at runtime — a small, deterministic mutation of
  the collision set the walk rule reads each tick. Non-blocking objects (decorative props,
  walk-through pickups, visual doors) DON'T need it, so Layers A/B/C ship without it; blocking is a
  follow-on gated on this one affordance. Flag, don't hide (the combat-idiom pattern).

## Phases

- **A0 — asset bodies.** `body:{type:'asset',ref,scale?,offset?}` baked in world-scene beside
  figures; `collect`/`reach-exit`/`hazard` gain an optional per-entity `asset`. Node + emit tests:
  a pickup bakes a referenced solid's faces; absent asset ⇒ byte-identical.
- **A1 — stateful objects.** The `stateful-object` primitive (baked states + bus toggle + optional
  timed `via`); rewire the deferred `loot-cache` / `key→door` / `switch→gate` mechanics to lower it.
  Tests: state swap on event through the real bus; a gate reads the state.
- **A2 — the use verb.** `use-target` (armed-proximity + use input → `interact`) + the HUD prompt.
  Tests: interact fires only while armed; drives a stateful object.
- **A3 — blocking (after the solids-toggle affordance).** `blocks:true` bodies + doors that block
  until opened. Gated on the prerequisite.
- **A4 — cards + discovery.** A `game_object` vocab family (object KINDS: pickup / prop / door /
  chest / lever) mirroring `game_mechanic` — embeddings kind, `get_game_vocab` scope, index rows —
  so the agent finds an object type by intent.

## Non-goals

- **Asset import** — generate + ref, never upload. Unchanged.
- **Skeletal animation of objects** — state is baked-frame swap (± a timed intermediate), the
  figure/flipbook model; no rigged object deformation.
- **New object generators** — reuse workbench / carved-solid / manji-tree / figure. A new *kind* of
  generator stays code-only (the STATUS.md boundary).
- **Physics-body interactive objects for the walker** — bodies are visual; collision is the solids
  set / zones, not rigid-body simulation (that regime exists separately for physics worlds).
- **An inventory/dialogue UI** — the interact verb fires a bus/game event; what it MEANS (grant,
  open, toggle) is the mechanics/store layer already built. No menu system here.

## Open questions (flagged, not decided)

1. **Scale convention.** Workbench objects are at real-world scale; a "coin" carved solid may not be.
   A per-body `scale`/fit, or a small set of size presets (pickup / prop / landmark)? Decide in A0.
2. **Asset deletion in use.** Snapshot the baked geometry into the level manifest at mint, or block
   deleting an in-use asset? Follow the user-assets render-time-resolution invariant; decide in A0.
3. **Prompt rendering.** Where/how the "press E" affordance shows (HUD text vs. a world-space label).
   A2.
4. **How many object kinds in v1.** pickup + prop + door + chest + lever covers the deferred
   mechanics; more (pressure-plate, breakable, container-with-inventory) only on demand.
