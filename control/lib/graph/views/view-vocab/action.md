---
{
  "id": "action",
  "name": "Action",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a LIVE world where THINGS HAPPEN with consequence — a GAME or an interactive scene with RULES (moles that pop, shots that score, a timed round that ends, items you collect).",
  "when": "Reach for framing like 'make a game where…', 'a shooting range / whack-a-mole', 'a scene with a score and a timer', 'things that pop up and you click them', 'a coin-pickup level'.",
  "retired_tool": "create_action_world"
}
---

Mint a LIVE world where THINGS HAPPEN with consequence — a GAME or an interactive scene with RULES (moles that pop, shots that score, a timed round that ends, items you collect). The sibling of create_controllable_world: that mints a world you MOVE through; this mints one that PLAYS BACK. Stores ONLY a tiny recipe (`kind:'controllable'` + `events` + `walk`); the world regenerates deterministically on render at `/api/sketches/<ref>/world` (open it / embed it). Reach for framing like 'make a game where…', 'a shooting range / whack-a-mole', 'a scene with a score and a timer', 'things that pop up and you click them', 'a coin-pickup level'. NOT for a world you just drive a character through with no rules — that's create_controllable_world.

RULES are a declarative IDIOM RECIPE (`idioms`), each `{ kind, ...params }`, lowered to the in-world event bus server-side. Idiom kinds:
• `scoreCounter` { name, label } — a tracker var shown on the HUD.
• `countdownClock` { var, from, onZero?, gate?, label? } — a var counting down 1/sec, fires `onZero` (default 'game-over') at zero.
• `gameOverFreeze` { signal?, gate?, banner?, clear? } — on the signal, freeze every gated timer and clear (toggle off) the listed entity ids.
• `spawnOnHeartbeat` { targets:[ids], periods:[secs], field?, rise?, gate? } — each target pops on its own cadence (rise:false to only emit the pop, pairing with ephemeralTarget).
• `ephemeralTarget` { on?, ttl, field? } — a target appears, lives ttl seconds, disappears (one independent timeline per target).
• `deed` { on:'pick'|'key'|'drag', emit, effects:[reactions] } — bind an input to an event + its effects (cursor-pick games).
• `hitConfirm` { on?, emit?, score?, drop?, marker? } — the laser deed: a camera-forward raycast (`fire` input) confirmed into a score + the hit target dropping.
• `onContact` { a?, b?, ...verb } / `pickup` { item, by, score } / `onRest` { body, ...verb } — turn physics contact/rest FACTS into meaning (need a `physics` world; pickup = coin/pot).

`entities` are the BUS PROPS the rules act on: `[{ id, on?, color?, radius?, position:[x,y,z] }]` (e.g. the spheres a heartbeat pops and a hit drops). `faces` is the bespoke stage geometry (walls become walk-colliders AND shot-occluders); omit for a default floor. `walk` defaults true (WASD first-person — set false for an orbit-only scene). Because input makes it path-dependent the world is non-bakeable (/svg + /scene show only frame zero; /world is live).

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `title` (string) — Title for the resulting sketch artifact.
- `idioms` (array) — The RULES, as a recipe of idioms. Each: { kind, ...params }. Kinds: scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, ephemeralTarget, deed, hitConfirm, onContact, pickup, onRest (see the tool description for each idiom's params). Lowered to the event bus and composed server-side; a var declared by two idioms is an authoring error.
- `entities` (array) — The BUS PROPS the rules act on (the stateful things, not a driven character). Each: { id, on?:boolean (starts hidden if false), color?, radius?, position?:[x,y,z] }. Idiom params reference these by id (e.g. spawnOnHeartbeat.targets, gameOverFreeze.clear).
- `events` (object) — Advanced escape hatch: a raw event-bus fragment ({ vars, timers, reactions, watches, inputs, hud, sources, sequences, initial }) merged through compose() alongside the idioms. Prefer `idioms` — reach for this only for a rule no idiom covers.
- `faces` (array) — Bespoke stage geometry as baked face quads ({ corners:[[x,y,z]×4], fill, doubleSided? }). Walls/obstacles become scene solids: they block walking AND occlude shots. Omit for a default checker floor (see `ground`).
- `ground` (object) — Default-floor spec when `faces` is omitted: { size, cell, colorA, colorB }. A 2-tone checker plane at z=0.
- `walk` — First-person WASD navigation. Defaults to true (action worlds are moved through). Set false for an orbit-only scene, or pass a config object.
- `worldFraming` (object) — Initial camera framing { cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov }.
- `viewBox` (object) — Render viewBox { width, height } (default 1120×780).
- `bg` (string) — Background color (default #0b1220).
- `audio` (object) — Optional world AUDIO channel (generic across every base; resolved on the live /world path): { soundtrack?: { beatsRef: '<stored beats ref>' } or an inline beats recipe (compositions loop), sfx?: { beatsRef? | cues?, on? }, footsteps?: true|{ step, jump, land }, wind?: true|{ level, freq }, bindings? (soundtrack channel macros) }. Validated at mint — an unknown beats ref or invalid recipe REFUSES the mint rather than storing a world that fails to render. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
