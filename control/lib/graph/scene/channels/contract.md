# The channel contract

_S0 census, channel-registry-formalization.plan.md. Line numbers are the working tree at
census time (channels.js @ 4,825 lines) — they drift; the names and contracts do not.
The mechanical half of this contract is asserted by `channels.contract.test.js`; this doc
carries the half the machine can't check (why, gates, hook inventories)._

## What a channel is

A channel is a generator function returning a JS source STRING (a template literal) spliced
into the World page emitted by `emitThreeWorld` (scene-three.js). All blocks share ONE
page-level lexical scope. Two families:

- **setup** — one-shot blocks spliced at a fixed anchor, no per-frame step of their own
  (sky dome, water, shadow/ink decals, glow, specular, pick).
- **runtime** — rows of `RUNTIME_CHANNELS`, emitted inside the runtime section
  (`channelRuntimeSection`) with an inert `let` binding and, for stepped rows, a
  `__mojStep(t)` slot (`mojStepCalls`). Row order IS step order — "events after physics"
  is semantic. Four more runtime-stepped blocks (`fx`, `spriteSfx`) and two
  loop-independent blocks (`audio`, `game`) splice AFTER the runtime section.

**Byte-identical-when-absent**: a channel not present in the payload contributes ZERO bytes.
The char net (emit-channels.char.test.js) hash-pins the whole fixture matrix; any drift
fails loud. A hash may change only when a plan step says emission changes.

## Emitted page splice order

1. `skyBlock` → 2. `waterBlock` → 3. `shadowBlock` → 4. `inkBlock` → 5. `glowBlock` +
`specBlock` → 6. `pickBlock` → 7. runtime section (registry order: walk, tracers,
sphereRig, planets, movers, comets, fields, surfaces, heatSpheres, starSurfaces, buildups,
transports, deforms, signs, physics, actions, events, controllable) → 8. `let stepFx` /
`let stepSpriteSfx` (iff present) + `function __mojStep(t)` → 9. `fxBlock` +
`spriteSfxBlock` → 10. fog quad (inline in scene-three) → 11. `effectsBlock` (inline) →
12. `audioBlock` → 13. `_freeze` / `const _capture` → 14. `gameBlock` → 15. pause sidecar
→ 16. capture API + rAF loop.

`__mojStep` body order: tracers, planets, movers, comets, fields, surfaces, heatSpheres,
starSurfaces, buildups, transports, deforms, signs, physics, events (+ fx, spriteSfx
appended by scene-three). walk / actions / controllable have NO `__mojStep` slot — walk
and controllable are stepped from the rAF loop / capture `step()`; actions is
listeners-only.

Eval-order couplings enforced by that order (the reason it is pinned):

- `sphereRig` defines `__uvSphereRig`; planets / heatSpheres / starSurfaces call it.
- `planets` registers its meshes into `meshes[pl.group]` at eval time; `movers` binds
  `meshes[mv.group]` at eval time — an orbiting body's sphere must exist first.
- `specular` (setup) defines `__specPatch`; controllable's rig builder probes it
  (`typeof __specPatch === 'function'`) when a rig figure carries spec parts.
- `physics` sets `window.__mojSim`; `actions` requires it (gated on hasPhysics);
  `events` probes it.
- `events` defines `__BUS`; fx / audio / game each WRAP `__BUS.processEvents`
  (chained: fx first, then audio, then game — each captures the previous wrapper).
- `controllable` sets `window.__mojCtrl`; fx / events / audio probe it. `.bodies` is
  exposed ONLY when fx is present (`exposeBodies`).
- `game` reads `_capture`, defined by the page on the line before its splice anchor.
- scene-three's own pause sidecar + capture code consume `__world`, `__MOUSELOOK`,
  `__fireDown`, `__lookDX`/`__lookDY`, `walkMode`, `__busState` (all via `typeof` probes)
  plus the unconditional registry lets — the PAGE itself is a consumer of the contract.

## The census

Families, gates, and normalization site per block. `normalizedBy: registry` = the row's
`normalize` on RUNTIME_CHANNELS; `emitThreeWorld` = bespoke normalization in scene-three.

| block | family | gate (emitted when) | normalizedBy |
|---|---|---|---|
| skyDomeScript | setup | `sky && (sky.space \|\| (zenith[] && horizon[]))` | emitThreeWorld |
| waterMeshScript | setup | ≥1 face with `water` | emitThreeWorld |
| shadowDecalScript | setup | `collectShadowDecals(faces).length` | emitThreeWorld |
| inkDecalScript | setup | ≥1 face `decal:'ink'` with ≥4 corners | emitThreeWorld |
| glowSpriteScript | setup | `glow` && `collectGlowSprites(faces).length` | emitThreeWorld |
| specularChannelScript | setup | any group/tex spec, or any rig figure part spec | emitThreeWorld |
| pickChannelScript | setup | ≥1 named pick | emitThreeWorld |
| walkModeScript | runtime (loop-stepped) | `walk` truthy | emitThreeWorld |
| tracerChannelScript | runtime | path.length > 1 | registry |
| sphereRigPreamble | runtime (preamble) | planets \|\| heatSpheres \|\| starSurfaces | registry (special-cased) |
| planetChannelScript | runtime | radius > 0 && group string | registry |
| moverChannelScript | runtime | spin/turn/link/pose/fill/pulse/flash/cascade or path>1 | registry |
| cometChannelScript | runtime | path.length > 1 | registry |
| fieldChannelScript | runtime | sets[] \|\| lines[] | registry |
| surfaceChannelScript | runtime | grid && (waves \|\| sources \|\| gw) | registry |
| heatSphereChannelScript | runtime | radius > 0 && coeffs[] | registry |
| starSurfaceChannelScript | runtime | radius > 0 && finite Tbase | registry |
| buildupChannelScript | runtime | positions.length ≥ 3 | registry |
| transportChannelScript | runtime | loop>1 && vectors[] | registry |
| deformChannelScript | runtime | group && (to \|\| basis \|\| terms[]) | registry |
| signageChannelScript | runtime | variant && anchor (also gates #mojSigns div + CSS) | registry |
| physicsChannelScript | runtime | bodies.length > 0 (the one LIVE-nondeterministic channel) | emitThreeWorld |
| actionsChannelScript | runtime (listeners-only) | hasPhysics && actions with `do` | emitThreeWorld |
| eventsChannelScript | runtime | reactions[] \|\| sequences[] | emitThreeWorld |
| controllableChannelScript | runtime (loop-stepped) | entities (rule/body/isCamera) \|\| camera.rule | emitThreeWorld |
| fxChannelScript | runtime (post-section, `stepFx`) | fx.states or fx.on non-empty | emitThreeWorld |
| spriteSfxChannelScript | runtime (post-section, `stepSpriteSfx`) | resolved layers (verb + cc[3]) | emitThreeWorld |
| audioChannelScript | post (own rAF loops) | `audio && !capture` | emitThreeWorld |
| gameChannelScript | post | `game` truthy (capture runs INCLUDED — envelope stays observable) | emitThreeWorld |

## Cross-block symbols (the provides/requires ledger)

Machine-checked by the registry's load-time assertion + `channels.contract.test.js`.
OPTIONAL = consumed behind a `typeof`/null guard; the provider may be absent.

| symbol | provider | consumers |
|---|---|---|
| `__uvSphereRig` | sphereRig | planets, heatSpheres, starSurfaces (REQUIRED) |
| `meshes[group]` planet spheres | planets | movers (eval-time bind) |
| `__specPatch` | specular | controllable rig builder (OPTIONAL) |
| `window.__mojSim` | physics | actions (REQUIRED), events (OPTIONAL) |
| `__BUS` / `__busState` / `window.__mojBus` | events | fx, audio, game (OPTIONAL, wrap processEvents); page sidecar (OPTIONAL) |
| `window.__mojCtrl` | controllable | fx, events, audio (OPTIONAL); page capture (null-guarded) |
| `__ctrlActive`, `__ctrlOwnsCamera`, `stepControllable` | registry lets (assigned by controllable) | page loop (unconditional — lets always exist) |
| `walkOn`, `walkMode`, `stepWalk`, `walkPrevT` | registry lets / walk block | page loop; audio (OPTIONAL probe) |
| `window.__mojGame` | game | controllable match seam (OPTIONAL); shells via postMessage |
| `window.__mojHangar` | controllable hangar sub-block | headless capture inputs |
| `window.__mojShadows` / `window.__mojSmoke` | controllable sub-blocks | debug/capture surfaces |
| `window.__mojActions` / `__mojGrab` / `__mojSpawnN` | actions | physics emitters (OPTIONAL `__mojGrab`) |
| `_capture` | page (line before game splice) | game (REQUIRED), audio gate (emit-time) |
| `window.__mojClock` | page frame()/step() | effects overlays, fx timing |

## Controllable interpolation points (the S4 `ext` seam, today's inventory)

| point | gate |
|---|---|
| `rigSpecHook` (aSpec wiring in `__makeRigGroup`) | any rig figure part carries `spec` |
| `hangarBlock` + `hangarHook` (input dispatch, first line of stepControllable) | `hangar` truthy |
| `shadowBlock` + `shadowHook` (suit contact blobs; `key` folded iff baked light usable) | `shadows` truthy |
| `smokeBlock` + `smokeHook` (projectile smoke + dust) | `smoke` truthy |
| `wreckExplodes`, `spectate` (createWorld arg, omitted when absent) | truthy |
| `match` / `pilot` / `ai` / `colliders` (createWorld args, null when absent) | data-gated at runtime |
| `exposeBodies` (`bodies: __bodies` on `__mojCtrl`) | fx channel present |
| `__MOUSELOOK` const | `camera.turnMode`/`mouseLook`, baked at emit time |

## Landmines carried forward

- Whitespace is behavior: emitted strings are byte-pinned. Run the char test per move.
- `hangarStepperBlock` is `{}`-wrapped (only `window.__mojHangar` escapes); the suit-shadow
  and smoke sub-blocks are NOT wrapped — their `__sh*`/`__smk*` names live at page scope
  beside controllable's own. `__SH` (shadow cfg) vs `__sh` (shield-pip HUD) differ only by
  case — distinct today, fragile; do not add either name family without checking the other.
- The mover block's HUD helpers (`_ebars` … `_machineHud`) come from `MOVER_HUD_JS`
  (views/science/mover-huds.js) and escape at page scope — that file is part of the mover
  channel's contract surface even though it lives outside `scene/`.
- Named IIFE identifiers in the audio block (`__beatsGait` etc.) do NOT escape
  (function-expression name scoping) — not provides.
- Stringified kernels (`buildSim` / `buildControllable` / `buildBus` / `buildBeatsKernel`)
  stay import-free closures in their own modules; never extract shared helpers into them.
