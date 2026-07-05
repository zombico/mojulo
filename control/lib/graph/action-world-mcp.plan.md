# action-world MCP exposure — make "worlds that play back" mintable from a tool

Status: in progress. The events/game-idioms layer is fully built and tested
([event-bus.js](event-bus.js), [game-idioms.js](game-idioms.js)) and the render path already
serves it ([world-scene.js](world-scene.js) dispatches `kind:'controllable'`, reads the `events`
channel, reads `walk`). The ONLY missing seam is the **mint side**: no MCP tool persists an `events`
block, so an MCP-only caller can mint a world it *moves through* (`create_controllable_world`) but
not one where *things happen with consequence*. This plan adds that one tool.

## The gap, precisely

| Layer | State before this plan |
|---|---|
| event-bus runtime (`events` reducer) | ✓ built, tested, deterministic |
| game-idioms (authoring composition) | ✓ built, tested (10 idioms + `compose`) |
| world-scene dispatch (reads `events`/`walk`/stage) | ✓ already wired (the `events` + `walk` channel blocks in [world-scene.js](worlds/world-scene.js)) |
| stage assembler (`assembleControllableScene`, faces/ground, no top-level entities needed) | ✓ ([controllable-world.js:265](controllable-world.js)) |
| persistence (`SketchRepository.create` → `/world` route) | ✓ exists |
| **MCP mint tool that emits an `events` manifest** | ✗ **missing — this plan** |

`create_controllable_world` ([scene-controllable.js](../mcp/tools/scene-controllable.js)) deliberately
persists movement only (entities/camera/figures/faces) and drops `events`/`walk`. The proof worlds
([laser-range.js](laser-range.js), whack-a-mole, newton-cradles) are hand-written builder modules
reachable only from their tests — never minted through a tool.

## Decision: a NEW tool, `create_action_world`

Chosen over extending `create_controllable_world` (2026-06-29). Rationale: MCP tools self-route on
user framing, and "make me a world where moles pop and shots score / a game / a round with a timer"
is a distinct framing from "let me walk a character through X." Keeping them separate keeps each
schema legible and each description self-routing. The new tool reuses the controllable stage +
persistence internally; it does not fork the dispatch path (still `kind:'controllable'`).

## Decision: rules expressed as a declarative IDIOM RECIPE, lowered server-side

The caller passes `idioms: [{ kind:'scoreCounter', name:'score' }, { kind:'countdownClock', from:30 }, …]`.
The tool maps each `kind` to its [game-idioms.js](game-idioms.js) function, runs `compose()`, and
stores the LOWERED `events`. This is the headline: it makes *the idiom layer itself* MCP-able (not
the raw bus), and inherits compose()'s guardrail (a var declared by two idioms throws — an authoring
bug, surfaced loudly). The stored manifest stays a tiny recipe (the lowered events), consistent with
the substrate's regenerate-on-render ethos. A raw `events` fragment passthrough is accepted too, as
an advanced escape hatch, merged through the same `compose()`.

### The two entity concepts (do not conflate)

- **bus props** — the stateful things rules act on (a sphere that toggles on/off). They live INSIDE
  the events block (`compose({ entities }, …)`), i.e. at `manifest.events.entities`. This tool's
  `entities` input ⇒ bus props (matches laser-range exactly).
- **controllable movers** — a driven figure/drone with a per-frame `rule`. Top-level
  `manifest.entities`, owned by `create_controllable_world`. NOT exposed here in v1. An action world
  is navigated first-person via `walk: true` (laser-range's model). "Drive a character IN a game" is
  a later combo (movers + events together) — out of scope for v1, the manifest already allows it.

## Output manifest (what gets stored)

```
{ kind: 'controllable',          // reuse the standalone stage assembler + dispatch
  walk: true,                    // default — action worlds are moved through first-person
  events: <compose(...)>,        // bus props + lowered idioms (+ optional raw events fragment)
  faces | ground,                // bespoke stage geometry, or a default checker floor
  worldFraming?, viewBox?, bg?, title? }
```

`resolveWorldScene` then layers `events` + `walk` (the channel blocks in [world-scene.js](worlds/world-scene.js))
and flags `nonBakeable` (input-driven ⇒ /svg + /scene show frame zero; /world is the live tier).

## Build steps

1. **`lib/mcp/tools/scene-action-world.js`** — `mintActionWorld()` + `createActionWorldHandler` +
   `registerActionWorldTools()`. Idiom registry (kind → fn), adapter for `scoreCounter` (positional
   arg). Validate: known kinds; non-empty (idioms ∨ entities ∨ events); `assembleControllableScene`
   stage check; `compose()` surfaces var collisions. Return `{ ok, ref, worldUrl, url, recipe,
   stats }`. ← THIS STEP
2. **Register** in [server.js](../mcp/server.js) beside `registerSceneControllableTools` (import ~259,
   call ~484).
3. **Routing** ([context.js](../mcp/tools/context.js)) — add a `TOOL_INDEX` line and a `ROUTING_INDEX`
   clause for `create_action_world` (golden rule: keep these current when adding a main-flow tool).
4. **Test** `lib/mcp/tools/scene-action-world.test.js` — parity proof: feed the tool laser-range's
   idiom recipe + props and assert the composed `events` equals `buildLaserRange().events` (the MCP
   surface reaches the same lowered manifest as the hand-written builder). Plus: unknown-kind throws,
   var-collision throws, empty throws, and a `resolveWorldScene` round-trip yields
   `payload.events` + `payload.walk` + `payload.nonBakeable`.

## Non-goals (v1)

- Controllable movers + events in one world (drive a character through a game). Manifest allows it;
  no tool surface yet.
- World→substrate publish. Stays excluded — portability guardrail (see
  [actions-world.plan.md](actions-world.plan.md), [magic-world.plan.md](magic-world.plan.md)). The
  `emit` verb is in-world only.
- New idioms. This exposes the existing v1 catalog; idioms still earn slots by recurring in real
  worlds, in code, not via the tool.
