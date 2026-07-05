# renderer emitter — pay down the accretion mechanics

Status: E1–E4, E6, E7 LANDED (2026-07-05, one spike); E5 (walk unification) remains PROPOSED.
What shipped vs. the design below, with recorded deviations:

- **E1** — `scene/emit-util.js` (`safeJson`, `escapeHtml`, `b64`, the three.js delivery-mode
  importmaps); applied at all 40+ script-context embeds in scene-three.js/channels.js +
  scene-css3d.js + both standalone emitters. Regression: `emit-util.test.js`.
- **E2a** — `scene/emit-fixtures.js` (36-fixture matrix: every channel alone, face extras,
  capture twins, two kitchen sinks) + `emit-channels.char.test.js` (sha256 pin per fixture +
  a same-process determinism sweep). One mid-spike re-pin of `audio`/`kitchen-sink` hashes:
  beats-kernel.js was edited concurrently at 14:02 (B5 work) and the kernel is stringified
  into the audio block — verified against the beats suite (46 green) before re-pinning.
- **E2b** — scene-three.js 3,672 → ~900 lines. Channel scripts moved verbatim to
  `scene/channels.js`; `RUNTIME_CHANNELS` registry (one row = filter + script + emitted
  header/lets + `__mojStep` slot, order semantic) generates the page's runtime section and
  step chain; byte-identical under the char net. Round-trip: `channels.registry.test.js`.
  Deviation: walk/physics/actions/events/controllable rows stay bespoke-normalized in
  emitThreeWorld (they couple to mesh bounds / capture / each other) and hand blocks into
  the registry-ordered section; audio/game/fog keep their unique splice points, as designed.
- **E3** — `scene/capture-contract.js`; scene-three interpolates the bridge names, the three
  world-frames drivers address the page via a BRIDGE arg (verified live: motion suite runs
  real Chromium, 20 green). Parse gate: `emit-parse.test.js` — every fixture's module script
  through `node --check --input-type=module` (V8 itself; `@babel/parser` turned out not to
  be installed) + contract-publication assertions. repeats.test.js regex helper: NOT done
  (left as-is; do alongside the next rename).
- **E4** — facesToGlb now de-collides globally before grouping (regression in
  scene-gltf.test.js: coincident faces in different groups export at staggered depth), and
  the AO bake there samples post-decollide corners, matching the World path exactly.
  `nonBakeable`: kept + documented as informational (MCP scene-* stats surface it); enforced
  where real — /model.glb responds `X-Mojulo-Degraded: frame-zero` for nonBakeable worlds.
- **E6** — geometry-keyed in-process LRU (16 entries) inside `bakeAmbientOcclusion`; colors
  deliberately outside the key; `subdivide` bypasses; `aoStats.cached` marks hits. Measured:
  17k-face fixture 288ms cold → 12ms hit (the residual is the key hash). Deviation:
  condo-complex NOT AO-defaulted — the kPerCell overflow reads lighter-than-truth there and
  caching doesn't fix quality; revisit with a bigger kPerCell or overflow-aware bake.
- **E7** — `emitBallKickView` → `vehicles/ball-kick-emit.js` (it was silently BROKEN in
  place: still read `../ball-flight.js` after folderization moved the integrator to
  vehicles/ — confirming zero callers); mover HUD formatters → `views/science/mover-huds.js`
  as spliced page-code text, byte-identical.
- Known unrelated failure at spike end: `education-module.test.js` (13-kinds pin vs the new
  `heat-sphere-view`, whose payload rides the `heatSpheres` channel the test's content check
  doesn't know) — pre-existing drift from the math-worlds thread, not touched here.

Sequel to [renderer-ladder.plan.md](renderer-ladder.plan.md)
(raised the ceiling) and [renderer-convergence.plan.md](renderer-convergence.plan.md) (made the
rungs compose). This plan touches neither capability nor visuals: it applies the world-kinds
medicine to the emitter itself, so the next ten channels land cheap. The diagnosis: the
renderer's bets have all landed and compose; the risk is no longer capability, it is that
[scene/scene-three.js](scene/scene-three.js) (3,672 lines, 42 options on `emitThreeWorld`,
~25 hand-wired channel blocks) grows a new arm per feature while the registry pattern that
saved world-scene.js sits unapplied one file over.

## Invariants (unchanged by every step)

- Same recipe → byte-identical world. Every step below ships behind a characterization net
  proving emission is unchanged (or changed ONLY where the step says so).
- One engine-agnostic payload out of `resolveWorldScene()`; no step forks it per backend.
- Baked lighting only; the World stays UNLIT. No step adds runtime lights.
- The byte-identical-when-absent channel doctrine survives the refactor: a channel not present
  in the payload emits NOTHING, before and after.
- The `.toString()` kernel pattern (buildSim / buildControllable / buildBus / buildBeatsKernel)
  is load-bearing, not debt. Steps may move the call sites; they may not introduce a second,
  drifting copy of any kernel.

## Step E1 — `safeJson` + title escaping (an hour; do first)

**The bug.** 45 raw `JSON.stringify` embeds in scene-three.js plus an unescaped
`<title>${title}</title>` ([scene-three.js:2938](scene/scene-three.js)). Any manifest string —
a sign's text, a pick label, a game name — containing `</script>` terminates the script tag
and kills the page. Agents mint manifests from user prose, so this WILL eventually fire.
scene-css3d.js and the raymarch/ball-kick emitters have the same exposure.

- Add one helper (in scene-three.js or a tiny shared `scene/emit-util.js`):
  `safeJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c')` — valid JSON, inert in HTML.
- Apply at every `JSON.stringify` site that lands inside a `<script>` in scene-three.js,
  scene-css3d.js, `emitRaymarchWorld`, `emitBallKickView`.
- Escape `${title}` (and any other raw string interpolation into markup) with a minimal
  HTML-entity escape.

Verify: characterization — emission of a fixture set (one world per major channel) is
byte-identical for payloads containing no `<`; a sign whose text contains `</script><b>x`
renders a parseable page (assert via the E3 parse gate, or a simple "count `</script>`
occurrences == count of script closes" check until E3 lands).

## Step E2 — the channel registry (the world-kinds move, applied to channels)

**The disease.** Adding a channel to `emitThreeWorld` today touches five places: the options
bag ([scene-three.js:2599](scene/scene-three.js)), the list-filter block (~:2824–2909), a
`let stepX = () => {}` binding, the `${block}` splice (~:3162–3222), and the `__mojStep` call
(:3227). Capture/live interaction rules (audio suppressed under capture :2905, game kept
inert-but-observable :2906) live in scattered comments. This is bit-for-bit the pre-registry
world-scene.js disease; the cure is the same and it worked
([worlds/world-scene-registry.plan.md](worlds/world-scene-registry.plan.md)).

Sequenced exactly like that plan:

1. **Characterization net first.** Snapshot-pin `emitThreeWorld` output for a fixture matrix:
   bare world; each channel alone; the composed-demo recipe (convergence exit criterion); a
   capture-mode variant; a kitchen-sink combo. Snapshots land in
   `scene/__snapshots__/` beside the worlds ones. Nothing else in E2 starts until this is green.
2. **Extract `scene/channels.js`** (or `scene/channels/` if the mover split in E7 lands first):
   one descriptor per channel —
   `{ key, normalize(raw) → list|null, script(list, ctx) → js, stepName?, live?, capture: 'emit'|'suppress'|'inert' }`.
   The existing `xxxChannelScript` functions become the `script` fields unchanged; the filter
   expressions (:2824–2909) become `normalize`. Order is an explicit array (step order in
   `__mojStep` is semantic — events after physics — so the registry preserves it as data).
3. **Fold the five touch-points**: the options bag keeps its keys (public API unchanged), but
   the body iterates the registry to normalize → emit blocks → emit `let` bindings → emit the
   `__mojStep` chain. Capture behavior (`suppress` for audio, `inert` for game) moves onto the
   descriptor.
4. Snapshots must stay byte-identical throughout (whitespace of generated code included — the
   splice points are mechanical, so this is achievable, and it is the proof the refactor is
   pure).

Exit: adding a hypothetical channel = one registry row + one script function; a test asserts
every registry row round-trips (absent → no emission; present → its `stepName` appears in
`__mojStep` exactly once).

## Step E3 — parse gate + shared capture contract (turn string seams into checked contracts)

Two seams exchange names purely through strings today:

- **The `__mojCapture` bridge**: method names, spec fields, and the probe shape are defined in
  scene-three.js (:3263–3357) and consumed as string literals in
  [../motion/world-frames.js](../motion/world-frames.js) (ready-poll, `.frame/.step/.probe/
  .compileWalkTo`, hidden selectors `'.hud'`/`'.hint'`, the `#wrap` screenshot target).
- **The emitted-page syntax itself**: 25 blocks × combinatorial presence, only ever
  syntax-checked by launching Chromium in spike tests. A typo in a rare channel combination
  ships silently.

Moves:

1. `scene/capture-contract.js`: exported constants for the bridge method names, probe field
   names, capture CSS selectors. scene-three.js emits from them; world-frames.js drives from
   them. Pure rename-safety — no behavior change.
2. A node test that emits the E2 fixture matrix, extracts each `<script type="module">`, and
   parses it with `@babel/parser` (the repo's sanctioned JSX/module parser per CLAUDE.md — no
   browser). Every combination must parse. This is the cheap gate that makes E1's injection fix
   assertable and catches future channel typos at test time.
3. While here: [scene/repeats.test.js](scene/repeats.test.js) greps emitted consts by regex
   (`/const REPEATS = .../`). Leave the assertions but route them through one
   `extractPageConst(html, name)` helper in the test utils, so the next rename updates one
   place. Do NOT rename the in-page consts in this plan.

## Step E4 — backend fidelity: glb global de-collide + the `nonBakeable` phantom

Two parity items that are bugs, not recorded deferrals:

- **glb de-collides per-group** ([scene-gltf.js:274](scene/scene-gltf.js)) while the World
  de-collides globally BEFORE grouping ([scene-three.js:2624](scene/scene-three.js)) — the
  comment there calls cross-group coincident faces "the worst z-fight case," and the .glb
  export still has it. Fix: mirror the world seam — expand → global `decollideFaces` → group →
  `faceListToMesh(fs, { decollide: false })` in facesToGlb. (The AO seam is already mirrored;
  this makes the whole geometry pipeline structurally identical in both emitters.)
- **`nonBakeable` is set but never read.** [worlds/world-scene.js](worlds/world-scene.js) sets
  `payload.nonBakeable = true` for physics/entities/events worlds; the claimed contract
  ("/svg + /scene stills degrade to frame zero") is enforced nowhere. Decide it: either (a) the
  still/scene routes read the flag and record the degradation in the response (enforce), or
  (b) delete the flag and the comment (an invariant living only in a comment is worse than no
  invariant). Grep all consumers before choosing; default to (a) if any surface already
  branches on it.

Verify: repeats/gltf test suites green; a fixture with coincident faces in DIFFERENT groups
exports a .glb with no coplanar duplicates at the same depth (assert lifted offsets, the same
way the world-path decollide is pinned).

## Step E5 — unify the two walk implementations (the biggest item; last)

Two steering cores exist: the `walk:true` FPV mode (`walkModeScript` — gravity, wall-slide,
head-bob; [scene-three.js:1916](scene/scene-three.js)) and the controllable `walk` rule
([worlds/controllable-world.js](worlds/controllable-world.js)). `compileWalkTo` only drives
controllable entities — it returns `{stuck, reason:'no controllable world'}` on a plain
walk-mode world. Consequence: **the walkability audit cannot run on dungeon-designer or
suite-layout worlds**, the interior kinds that need it most.

Direction (decided here): make the FPV player a controllable entity under the `walk` rule —
one steering core, two consumers — rather than teaching the compiler a second driver. The
convergence plan already made the analogous call for NPC locomotion ("one steering core, two
consumers"). Sketch:

1. Extend the `walk` rule with the FPV extras it lacks (eye height / minEye, head-bob hook,
   the derived speed/gravity/jump scaling from :2793–2810) as rule params.
2. `walk:true` becomes sugar: world-scene lowers it to a camera-owning controllable entity
   with the walk rule (keeping the manifest surface unchanged), the walkModeScript block
   retires behind the characterization net.
3. `compileWalkTo` now works on every walkable world by construction. Add the dungeon fixture
   walkability audit (mint → compile walk to exit → probe-assert arrival) as the flagship
   verify case, per convergence step 3.

Risks to respect: the FPV feel (damping, slide, bob) is tuned and user-visible — A/B the two
implementations under fixed input scripts (Phase-3 replay makes this cheap: same ticks through
old and new, compare probe streams + a strided PNG diff) before retiring the old block.
This step ships LAST and only if the spike has room; it is independently shippable later.

## Step E6 — performance headroom (measured, opt-in, doctrine-clean)

- **AO memoization.** The bake re-runs on every render; 692ms/74k faces is why condo-complex
  is not AO-defaulted ([worlds/world-kinds.js:195](worlds/world-kinds.js)). Same recipe → same
  bake is guaranteed by the determinism invariant, so an in-process LRU keyed by
  (manifest-hash, ao-opts) is a cache, not persistence — doctrine-clean. Cap entries (~16) and
  measure: second render of condo-complex should drop the bake to ~0. Then AO-default
  condo-complex and re-run its snapshot.
- **Backface culling as an opt-in kind flag.** Everything renders `side: DoubleSide` (2×
  fragment work). Generators with consistent winding (audit first — the polygonizer's quad
  emission order) can set a descriptor flag lowered to `FrontSide`. Opt-in per kind, never
  default, so nothing visually regresses.
- **Log-depth revisit (note only, no action).** `logarithmicDepthBuffer` exists for cm-proud
  decal faces; if decal `polygonOffset` ever replaces it, early-Z comes back. Record as a
  deferred marker beside the renderer flag, don't attempt in this spike.

## Step E7 — evictions (altitude hygiene)

- `emitBallKickView` (~230 lines, [scene-three.js:3444](scene/scene-three.js)) has zero
  production callers. Move to `views/science/ball-kick-emit.js` beside its plan, or delete if
  ball-flight.plan.md considers it superseded — check the plan before choosing.
- `moverChannelScript` is ~400 lines, half of it domain HUD logic (engines, motors, reactors,
  submarines, cascade — :457–:568). Split the HUD formatters into
  `views/science/mover-huds.js` (they are view-domain, not renderer) and have the channel
  script import-and-stringify them. After E2 this is one registry row's `script` getting
  shorter.
- Target state: scene-three.js trends toward "payload → page compiler" and nothing else.

## Order and parallelization

Serialized: `E1 → E2 → E3 → E7 → E4 → E6 → E5`. In practice:

- **E1 first** (everything else carries it along), then **E2's characterization net** — the
  net is the spike's spine; E3's parse gate rides the same fixture matrix.
- **E4 ∥ E6-AO** any time — different files (scene-gltf.js / ao-bake.js call sites), no
  dependence on the registry.
- **E7 after E2** (channel split makes the mover eviction mechanical), though ball-kick can
  move any time.
- **E5 last**, gated on spike room; independently shippable later. Its A/B harness (replay same
  ticks through both walk implementations) is the only genuinely new test machinery in the plan.

## Deliberately out

- Any new channel, kind, or visual capability — this plan is emitter mechanics only.
- Renaming in-page consts / bridge methods (E3 makes renames SAFE; it does not perform them).
- SVG/CSS-3D `vao` + `repeats` lowerings — already recorded deferrals in
  [renderer-convergence.plan.md](renderer-convergence.plan.md) 1d, unchanged here.
- Persisted bake artifacts — the AO cache is in-process LRU only; nothing hits disk.
- A pathfinding graph, vertex skinning, runtime lights — per the ladder's standing list.
