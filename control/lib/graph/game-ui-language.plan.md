# game UI language — forms · states · gestures · light · sfx as a player-facing vocabulary

Status: DESIGN + SPIKE EVIDENCE, nothing promoted. Drafted 2026-07-07 after a five-spike research
day. Companion to [game-mechanics.plan.md](game-mechanics.plan.md) (rules) and
[game-assets.plan.md](game-assets.plan.md) (objects): mechanics gave levels their VERBS, the asset
plan gives objects their BODIES — this plan gives game state its **appearance**: a closed,
substrate-wide visual vocabulary so that what an object *means* (collectible, locked, dangerous,
goal, charging, hit) is legible on sight, in every mojulo game, without per-level styling.

Origin: a principles read of [LittleJS-AI](https://github.com/KilledByAPixel/LittleJS-AI) (an
agent-native game toolkit). Its neutral tinted-atlas idea survives here transposed to mojulo
first principles — procedural vexar forms instead of pixel tiles, structural guarantees instead
of conventions. The through-line adopted from that comparison: **where an imperative engine keeps
its agent on rails with warnings, mojulo uses structure** (closed shelves, typed bindings,
recipes) so the same mistakes become impossible rather than discouraged.

## The claim

A game is legible when state changes are visible before/when they matter. Individual games buy
this with hand-authored art and effects; a substrate can mint it as a LANGUAGE — a closed set of
forms × state effects with conventional meanings, lowered by mechanics *by default*. Two
properties no per-game author gets:

1. **Visuals cannot lie.** Every effect renders a bus fact (a var, an armed flag, a drained
   event). There is no separate visual state to drift from game state.
2. **Player literacy transfers.** "Shimmer = usable, dim = locked, beacon = goal" is learned once
   and read in every mojulo game — the closed-vocabulary design signature, player-facing for the
   first time.

## The six layers (all spike-proven 2026-07-07)

| Layer | Contents | Mechanism |
|---|---|---|
| **Forms** | 8 icon-grade solids: gem coin key heart star orb flag skull — semantic tint each | lathe/extrude face builders, ~100–300 faces each |
| **States** | float (bob ± spin), dim, shimmer, flash | per-frame transforms + tint modulation (`instanceColor`-compatible) |
| **Gestures** | pop / ghost / dissolve — appear AND disappear, eased | phase-parameterized face transforms (anticipation, easeOutBack overshoot, staggered per-face crumble) |
| **Light** | aura (pulsing), goal-beacon column | raymarch overlay emission fields |
| **SFX** | 12 parameterized verbs — see shelf below | raymarch overlay: emission beads on paths / emission fields / **extinction filaments** |
| **Grammar** | state → (form × tint × effect) bindings, lowered by mechanics | bus facts only: standing states, armed states, one-shot event cues — mirrors `audio.on` |

### The SFX verb shelf

Three physical mechanisms, one composer (JS params → GLSL constants, the
"resolve numbers in JS, evaluate in GLSL" pattern from
[docs/raymarch-effects-layer.md](../../../docs/raymarch-effects-layer.md)):

- **Emission beads on parametric paths** (a bright bead + K decaying trail taps):
  `enchant` (tilted orbit — magic item) · `heal` (rising fountain) · `charge` (inward spiral,
  brightening arrival) · `hit` (radial spokes, easeOut + gravity arc) · `accumulate` (inflow
  gaining prominence at the center — telegraph/wind-up) · `ward` (vertical protective ring) ·
  `sparkle` (hash-scattered sin⁸ twinkles — collectible tell) · `drain` (heal's dark mirror,
  down + away, brightest at the body).
- **Emission fields**: `aura` (pulsing breathing glow — composes under every other verb) ·
  `ssj-aura` (ki envelope: core sheath + white-hot inner + 14 rising elongated flame tongues).
- **Extinction filaments** (darkness as a substance — absorbs, never emits): `kokusen`
  (jagged capsule-segment black lightning, hash-gated flicker, per-frame re-jitter, tip sparks,
  silhouetted against its aura). This mechanism is new to the substrate and opens a
  negative-space family (smoke, void tendrils, shadow) on the same segment/bead machinery.

A new verb is ~6 lines of path math on the shared skeleton. Composition = GLSL block
concatenation into one `volSample` (verb + aura proven; per-entity combinations free).

## Doctrine

- **Effects render bus facts, never hold state.** `dim` reads a gate var; `shimmer` reads
  `canUse`; one-shots fire on drained events. Presentation-only, exactly the beats/audio rule —
  probes, audits, and replay guarantees untouched.
- **Closed vocabulary, cards + lowering.** Forms and verbs ship as vocab families
  (`game_glyph`, `game_sfx`) with one card each; mechanics lower defaults; new behavior is a new
  card + lowering, never an open scripting surface.
- **Byte-identical when absent.** The effects channel follows the `audio` contract: no `fx` in
  the manifest ⇒ emitted HTML unchanged; capture-mode emission rules keep the char-net green.
- **Recipes, not renders.** Effects are manifest data (verb + params); geometry/GLSL regenerate
  deterministically. Palette, size, intensity are params — proven by `palette.gif` (one verb,
  three palettes, one bake).
- **Gain budgets are structural.** The overlay path has no tonemap; unbounded additive emission
  whites out the form it decorates (observed: accumulate v1). Every verb card carries a bounded
  peak `emission × kernel-radius`; the productized composer should also add a shared soft-knee
  compressor so no verb stack can white-out.

## Rules learned in the spikes (must survive into cards)

1. **Spin needs asymmetry.** A 6-fold-symmetric gem looks identical every 60° — rotational
   effects belong to asymmetric forms (key, flag); symmetric pickups lead with bob/pulse. Form
   cards declare symmetry; default lowerings pick accordingly.
2. **Thin extinction filaments have a sampling law**: march step ≲ filament width, or rays skip
   the filament and bolts silently vanish. `width` and `steps` are coupled knobs (kokusen tuned:
   σ0.022 → steps 240, uMaxDist 7). Put the coupling in the card.
3. **Param baking needs precision-aware formatting.** `toFixed(3)` rounded a squared width
   (0.000484) to `"0.000"` → GLSL divide-by-zero → invisible geometry with no error. The
   composer must format small/squared constants at adequate precision (f6+ or exponent form).
4. **Ghost wants runtime opacity.** Baked faces have no alpha; the spike faded tint-toward-bg
   (reads against sky, approximate against ground). In-page entities are real meshes — the
   runtime gesture channel uses material opacity; the tint fade is only the headless-filmstrip
   stand-in.
5. **Fit is a preset, not a constant.** Glyph-scale radii (cz 0.6, span 1.0) vs figure-scale
   (cz 0.95, span 1.3) differed exactly as the asset plan's open question predicts. Adopt the
   same size presets (pickup / prop / landmark / figure) and derive anchor + radii from the
   body's bbox.
6. **Face-count degradation.** Gestures are per-face work — fine for glyphs and figures (12.8k
   proven via instancing); cap or coarsen for architecture-scale bodies. Degrade, never crash.

## Process harvests (reusable beyond this thread)

- **Filmstrip GIFs**: all phases as cells in ONE world, identical ground patch per cell, camera
  walking cell-to-cell with a fixed relative offset → pixel-registered frames →
  `encodeGifBuffers`. One page load per gesture. The standard way to judge any
  phase-parameterized visual headlessly.
- **Spatial-phase determinism**: transfer functions derive animation phase from the cell index
  (`floor(p.x/CELL)`), not `uTime` — every frame is a pure function of geometry. Used because
  `frame(spec)` does not pin `__mojClock` (see hardening below).
- **Characters via `repeats`**: one 12.8k-face figure template, 16 instanced filmstrip cells —
  effects proven body-agnostic (glyphs, figures; light layer needs only an anchor, so zones and
  landmarks too).

## Spike evidence (all under lite-template/integration/0707/spike-output/)

| Spike file (control/lib/graph/game/) | Output folder | Proved |
|---|---|---|
| `glyph-forms.spike.gen.test.js` | `glyph-forms/` | 8-form shelf reads at gameplay distance; static state grid (pulse/dim/flash legible) |
| `glyph-forms.spike-lib.js` | — | shared form builders + face/tint transforms |
| `glyph-motion.spike.gen.test.js` | `glyph-motion/` | pop/ghost/dissolve GIFs with animation principles; idle float; first raymarch glow world (auras + beacon) |
| `glyph-wisps.spike.gen.test.js` | `glyph-wisps/` | pathed-emission SFX (enchant/heal/charge/hit); spatial-phase technique |
| `glyph-sfx-variations.spike.gen.test.js` | `glyph-sfx/` | parameterized composer; verb+aura composition; accumulate/ward/sparkle/drain; palette proof; gain-budget lesson |
| `glyph-shonen.spike.gen.test.js` | `glyph-shonen/` | ssj-aura; kokusen extinction filaments; figure-scale via `repeats`; sampling law + precision-baking lessons |

No engine file was touched; every effect used existing machinery (lathe/extrude, vexar, the
`fog` overlay slot, `repeats`, `renderWorldFrames`, `encodeGifBuffers`).

## Runtime design (the promotion shape)

- **`fx` manifest channel** (states + gestures), sibling of `audio`: standing state maps
  (`{entityId: 'float'|'dim'|…}` or var-driven), gesture one-shots on event globs
  (`fx.on: {'collect*': 'burst'}`). In-page: per-frame transforms on entity meshes/groups +
  material opacity for ghost. A `RUNTIME_CHANNELS` row + emit-fixture entries + char-net re-pin,
  per the standing discipline — NOT hand-wired splices.
- **`effects[]` generalization**: the `emitThreeWorld({fog})` param is already a generic
  `{frag, customUniforms, dataTextures}` overlay slot — rename/extend to `effects[]` so glow +
  sfx + fog stack (or compose into one `volSample`, which the spikes show is trivial).
- **SFX composer**: `composeGlyphSfx([{verb, color, fit, …}]) → {frag, customUniforms}` — the
  spike's `VERB.*` table productized, with per-entity anchors as uniforms driven by bus state
  (on/off standing verbs, one-shot envelopes on events), riding `uTime` on live pages.
- **`__mojClock` hardening (E-series candidate)**: `frame(spec)` should pin
  `window.__mojClock = spec.t` the way `step()` pins the traversal clock — makes every clocked
  overlay camera-bake-deterministic and unblocks time-driven effect bakes without the
  spatial-phase workaround.
- **Mechanic default lowerings** (the payoff): `collect` → sparkle + float, burst on pickup;
  `reach-exit` → flag + beacon; `hazard-damage` → red pulse, hit on damage; gated/locked → dim
  until the var flips; `use-target` armed → shimmer (+ charge for emphasis). Deferred mechanics
  arrive speakable: key→door = door ward+dim, key sparkle; unlock = ward dissolve + flash.
- **Cross-channel symmetry**: `sfx.on` beside `audio.on` — one bus fact fires the chime AND the
  wisps; channels structurally cannot desynchronize.

## Phases

- **U0 — plan + evidence (this file).** DONE with the 2026-07-07 spikes.
- **U1 — form shelf promotion. LANDED 2026-07-07.** `game/glyph-forms.js` (builders + symmetry /
  idle / fit metadata, `glyphFormFaces`, `lowerGlyphBodies`) + generated cards
  (`glyph-cards/loader.js`) + the `game_glyph` embeddings kind (CHECK widened via the standard
  rebuild migration; guard token bumped) + `get_game_vocab` scope:'glyph' (four families). Bodies:
  `body:{type:'glyph', form, tint?, scale?, yawOffset?}` lowers in world-scene.js to a
  single-frame `figure-frames` clip (`glyph:<form>[:tint][:s<scale>]`, shared across identical
  variants) — ZERO emitter changes, no char-net impact, glyph-free worlds byte-identical
  (lowering returns null). Spike lib re-exports the promoted registry. Tests:
  `glyph-forms.test.js` (10) + suites green (db 340, game+world-scene 100, create-game 10).
- **U2 — `fx` channel (states + gestures). LANDED 2026-07-07.** The `fx` manifest channel:
  standing states (`float` / `spin` / `pulse` / `dim` / `shimmer`) + one-shot disappear gestures
  (`pop` / `burst` / `ghost` / `dissolve`) decorating controllable entities by id
  (`fxChannelScript` in [scene/channels.js](scene/channels.js), wired in
  [scene/scene-three.js](scene/scene-three.js)). Verified end-to-end by
  [fx-channel-verify.spike.gen.test.js](game/fx-channel-verify.spike.gen.test.js): a glyph gem
  visibly BOBS across sim-time (deterministic), and a coin walking a zone fires `enter` → BURST
  (scale-up + fade → hidden). Evidence in `integration/0707/spike-output/fx-channel/`. Char-net:
  standalone `fx` fixture pinned green; new reds = zero (the 5 pre-existing reds are the material +
  game-bus threads). Parse gate green.

  *Design decisions, and why (each cost real debugging):*
  - **NOT a `RUNTIME_CHANNELS` row** (the plan's earlier guess) — a registry row emits inert
    scaffolding into EVERY world (like `stepTracers`), breaking the stricter "absent fx ⇒
    byte-identical" promise. fx is a **bespoke splice like audio/game**, emitted only when the
    manifest carries a non-empty `fx` — but driven by `__mojStep(t)` (not audio's own rAF) so it
    stays deterministic in capture (frame `spec.t` / step `__capT`), unlike fog's `__mojClock`.
    So it is NOT capture-gated: states/gestures render in bakes + audits (presentation-only →
    probes untouched).
  - **`__mojStep(t)` drives `t` in MILLISECONDS** (live rAF `performance.now`, `__capT`, the
    `?t=` freeze). fx converts to seconds internally (`t/1000`); a states-in-seconds / envelope-in-
    ms mismatch makes gestures complete in 0.5 ms (instant, invisible) and live states flicker at
    kHz. Any new `__mojStep` consumer must treat `t` as ms.
  - **Decorates only the free transform seams `__syncEntity` never writes**: the inner figure
    mesh's LOCAL position/rotation/scale (bob/spin need a figure body — `canMove` guards plain
    meshes to scale + tint only), outer scale (any body), and `material.color` (multiply →
    darkens cleanly under vertexColors) / opacity. `__mojCtrl.bodies` is exposed by the
    controllable channel ONLY when fx is active (else byte-identical).
  - **`fx.on` gestures ride the bus, so they need the events channel present** (`hasEvents` =
    non-empty reactions/sequences). A mechanic level always has one (M1 lowers reactions), so this
    is free in practice; a fx-only level with no other reactions gets no bus. U5 wires the mechanic
    defaults, closing this naturally.
  - **U1 frame-shape fix folded in**: a figure clip frame is `{ faces }` (packFigureFrames reads
    `frame.faces`), not a bare faces array — the glyph lowering now emits the right shape (only
    surfaced once a glyph rendered as an entity; no char fixture uses glyph bodies, so no re-pin).
  - Deferred to U3+: brighten-`flash` (needs emissive/additive — basic-material multiply only
    darkens); per-face live `dissolve` (approximated as spin+shrink+fade; true crumble is a
    capture-only nicety); appear/spawn gestures (`pop-in` / `ghost-in`).
- **U3 — effects overlay generalization + clock pin. LANDED 2026-07-07.** `emitThreeWorld` gained
  an `effects: [{ frag, customUniforms, dataTextures }]` param — N stacked premultiplied raymarch
  quads over the world (glow / wisps ride beside fog), each camera-fed and renderOrder-stacked
  above fog (100001+i). `overlayExtras` factors the per-layer uniform emission shared by fog and
  effects. `frame()` now pins `window.__mojClock = spec.t` so uTime-driven overlays bake
  deterministically under `renderWorldFrames` (previously camera bakes fell back to wall-clock —
  the reason the glow/wisp spikes used the spatial-phase workaround; no longer needed). Verified by
  [fx-effects-stack.spike.gen.test.js](game/fx-effects-stack.spike.gen.test.js): fog + a uTime-
  pulsing glow composite over one world, and the SAME sim-time baked twice → byte-identical PNGs
  (clock pin works), a later time → different (truly clocked). Evidence in
  `integration/0707/spike-output/fx-effects-stack/`.

  *Byte-discipline (each cost a debugging pass):*
  - **fog stays byte-identical** — `fog` routes through the same `overlayExtras` but its quad block
    is unchanged; `effects:[]` ⇒ no bytes. The green `fog` fixture is undisturbed.
  - **The `__mojClock` pin is gated on `capture && hasOverlay`.** `frame()` code is emitted (as
    dead code) even in NON-capture pages, so gating on `hasOverlay` alone leaked the pin line into
    the live `fog` fixture and turned it red. Gating on the build-time `capture` too keeps every
    non-capture and every overlay-free page byte-identical — only capture pages that actually run
    an overlay carry the pin. Zero new char reds.
  - New fixtures `effects` (live) + `fog-effects` (fog + 2 effects + capture, pinning the stack +
    the clock pin) auto-pinned green; `effects` folded into kitchen-sink (already red).
- **U4 — SFX composer + `game_sfx` family. LANDED 2026-07-07.** [glyph-sfx.js](game/glyph-sfx.js):
  the **11-verb** shelf (enchant/heal/charge/hit/accumulate/ward/sparkle/drain/aura/ssj-aura/
  kokusen — "12" earlier double-counted enchant across two spikes) as a registry + pure composer.
  `composeGlyphSfx(layers) → { globals, maxSteps, maxDist }` sums every layer's verb GLSL into ONE
  `volSample`; `finalizeSfxLayer` wraps it via `buildVolumeFrag` into an `effects[]` layer. Manifest
  surface: `sfx: [{ verb, at:[x,y,z] | on:'<entityId>', color?, params? }]` → `resolveSfxLayers`
  (anchor resolution) → composed → `payload.effects` in [world-scene.js](worlds/world-scene.js)
  (mirrors the fog splice; additive, absent ⇒ untouched). `game_sfx` embeddings kind (CHECK widened
  + migration guard bumped) + generated cards ([sfx-cards/loader.js](game/sfx-cards/loader.js)) +
  `get_game_vocab` scope:'sfx' (five families now). Verified: unit tests (13, incl. the
  resolveWorldScene integration) + a driven bake ([glyph-sfx-compose.spike.gen.test.js](game/glyph-sfx-compose.spike.gen.test.js)):
  all 11 verbs compile + render in one pass off `uTime` (U3), color/params round-trip to the pixels,
  the soft-knee bounds an absurd gain-40 stack (no white-out), and the same sim-time bakes
  byte-identically. Evidence: `integration/0707/spike-output/glyph-sfx-compose/`. Suites green
  (486 across scene/worlds/game/db); zero new char reds (no fixture uses `manifest.sfx`; the
  `effects[]` path was pinned in U3).

  *The three spike lessons, now enforced in the composer (not just documented):*
  - **Gain budget** — a soft-knee `emis = emis/(1+emis)` closes every `volSample`, so no verb stack
    can white out the form (the accumulate blow-out is now structurally impossible).
  - **Precision** — anchors + squared constants format at f6 (kokusen's `width²` → f3 → 0.000 →
    div-by-zero → invisible-bolts bug can't recur).
  - **Sampling coupling** — each verb declares a `steps` floor; the composer takes the max. Cost
    note surfaced by the bake: one kokusen (240 steps) in a layer raises the WHOLE layer's march
    cost (the all-11 grid took ~86s). Cards warn to use kokusen sparingly alongside others; the
    natural fix (a per-verb layer split) is a later optimization, not a U4 blocker.

  *Scope line for U5:* U4 lands STATIC anchors (baked into GLSL) — the common case, since pickups/
  hazards/exits sit at fixed level positions, which is exactly what U5's mechanic defaults need.
  MOVING per-entity anchors (a wisp trailing a walker) and bus-driven one-shot sfx envelopes are
  deferred (a wisp one-shot overlaps the fx-gesture channel; U2 already covers "burst on collect").
- **U5 — mechanic default lowerings. LANDED 2026-07-07 — THE PAYOFF.**
  [mechanic-decor.js](game/mechanic-decor.js): `decorateMechanics(mechanics)` lowers a level's
  `game.mechanics` into default UI-language dressing, merged into the manifest by
  [world-scene.js](worlds/world-scene.js) BEFORE the entities/glyph/fx/sfx steps:
  - `collect` → a **glyph pickup** per item (`formForItem`: coin→coin, gem→gem, key→key, …, else
    gem) + fx `float` + sfx `sparkle` + fx `burst` on collect; the mechanic's box marker is
    **suppressed** (the glyph replaces it).
  - `reach-exit` → a `flag` glyph + a green `aura` beacon.
  - `hazard-damage` → a red danger `aura` per hazard.
  - `survive` / `fail-on-death` → no spatial decoration (stateful, their HUD suffices).
  Default-ON; `game.decorate:false` opts out; hand-authored `entities`/`fx`/`sfx` compose on top
  (`mergeDecorFx`, hand keys win). Verified end-to-end by
  [mechanic-decor.spike.gen.test.js](game/mechanic-decor.spike.gen.test.js): a **verbs-only,
  zero-styling** level resolves to floating sparkling pickups + a flag beacon + a red hazard, and a
  driven traversal shows the coin **burst and vanish on collect**. Evidence:
  `integration/0707/spike-output/mechanic-decor/`. Tests: unit (7) + resolve integration; suites
  green (75 across game/vocab); fx char fixture re-pinned; zero new char reds.

  *Two load-bearing fixes this phase required (both general, beyond U5):*
  - **`payload.fx` was never set from `manifest.fx`** — U2's fx channel never rendered on the
    stored `/world` path (U2 tested via direct `emitThreeWorld`). Now wired in `resolveWorldScene`;
    hand-authored fx levels render too.
  - **The fx bus-wrap only sees TOP-LEVEL events.** `processEvents` drains `emit`-ted events
    recursively INSIDE itself (depth+1 loop), so a wrap on `processEvents` never sees emitted
    events — only the `incoming` facts. So burst-on-collect binds to the pickup's **zone**
    (matched against the top-level `enter` event's `ev.source`), not to an emitted `pickup:*`
    signal. The wrap now matches a binding against `ev.type` OR `ev.source`/`ev.zone`, and fx.on
    accepts `{ gesture, target }` for an explicit per-binding target. (Same constraint applies to
    audio stingers — they too only fire on top-level facts.)

  *Known limitation (the honest edge):* sfx layers are STATIC world overlays baked at the pickup
  position, so a collected pickup's `sparkle` **lingers** after the glyph bursts. The glyph (the
  actual pickup) vanishes correctly; only its ambient twinkle persists. Fixing it needs the
  deferred **dynamic/per-entity sfx** work (sfx anchors driven by uniforms + on/off by entity
  state) — the U4→post scope line. Flagged, not hidden.

Each phase independently shippable; U1/U2 don't depend on U3.

## V — the sfx COST MODEL (2026-07-08): geometry sprites REPLACE the raymarch overlay for game sfx

**DECISION (operator, 2026-07-08): the sfx raymarch overlay is RETIRED for game sfx. The additive-
sprite (geometry) path is THE backend. Do not keep a hybrid — the fullscreen-march perf drain was
too severe to justify stacking it on a mesh world, even bounded.** The raymarch machinery stays
where it belongs (the whole-frame science views: atom/galaxy/black-hole/…); it is simply not a
game-decoration renderer. Everything below is spiked; promotion (the real channel) is the remaining
work.

SPIKE + EVIDENCE. Origin: a minted walkable showroom
(`compose_world` base `controllable`, a verbs-only `collect`+`reach-exit`+`hazard-damage` level →
U5 decoration) was **unrunnable in-browser** — WASD never registered. Diagnosis found TWO
independent costs; the sfx overlay is the one that matters here.

**Root cause (why the sfx overlay tanks, when the science raymarch views fly).** The sfx
`effects[]` layer and the atom/galaxy science views use the *same* machinery
([volume-raymarch.js](effects/volume-raymarch.js) `buildVolumeFrag`), but in opposite ways. The
science view is fast because it (a) **IS the whole frame** — a single fullscreen quad, no mesh
scene ([emitRaymarchWorld](scene/scene-three.js)); (b) samples an **O(1) closed-form field** (atom
`psi()` = a few exp/poly); (c) **gates the march on a bounding sphere** (`vrSphereT`) and breaks on
opacity; (d) caps DPR at 1.5. The sfx overlay violates every one:
- it is an **extra pass stacked on a full, lit, log-depth mesh world** (glyphs + figure + ground) —
  the GPU pays mesh rasterization AND the raymarch every frame;
- per sample it runs **Σ over anchors** of nested verb loops (enchant 16 taps, accumulate 30,
  kokusen 72, …) — O(anchors), not O(1), evaluated at *every* march step;
- **`overlay:true` DROPS the bounding sphere** — [volume-raymarch.js:145](effects/volume-raymarch.js)
  marches `t0=0 … t1=uMaxDist` at **every pixel** (the opaque path at :146 keeps the `vrSphereT`
  gate; overlay silently lost it), and because verbs *emit*, transmittance stays ≈1 so the opacity
  break rarely fires — so nearly all 96–240 steps run on every pixel of the screen;
- it inherits the mesh world's **DPR cap of 2** over the full framebuffer.
So a pixel of empty sky, nowhere near any glyph, still runs ~96 steps × every verb's inner loops.

**The geometry backend, spiked end-to-end** (all under `integration/0708/spike-output/sfx-geometry/`):

- **Cheap + smooth** ([glyph-sfx-geometry.spike.gen.test.js](game/glyph-sfx-geometry.spike.gen.test.js),
  [glyph-sfx-live-perf.spike.gen.test.js](game/glyph-sfx-live-perf.spike.gen.test.js)). Every verb is
  an **additive camera-facing sprite** — the existing [glowSpriteScript](scene/channels.js) primitive
  (radial-gradient texture, `AdditiveBlending`, `depthWrite:false`) — cost = N sprite draws, no
  fullscreen pass. `geometry-showroom-{0,1}.png` (8 forms + sparkle/aura/beacon/hazard) and two live
  walkable A/B worlds: **`live-geometry.html` (sprites) walks smooth; `live-raymarch.html` (identical
  scene, the overlay) is the unrunnable one — operator confirmed.** That A/B is the evidence behind
  the decision above.
- **Colour + motion paths transfer** ([glyph-sfx-motion.spike.gen.test.js](game/glyph-sfx-motion.spike.gen.test.js),
  [glyph-sfx-motion-world.spike.gen.test.js](game/glyph-sfx-motion-world.spike.gen.test.js)). The
  bead-on-path verbs are just parametric point positions over time = exactly what an animated sprite
  does. The `SFX_VERBS` path math ports to JS verbatim; `verb-motion.gif` and the live walkable
  `live-motion-world.html` show enchant/heal/charge/ward/drain/sparkle animating along their real
  orbits/spirals/spokes in per-verb colour — O(beads) per frame, the same near-free cost class as the
  static sprites. So the closed vocabulary survives the backend swap: **colour = sprite material
  colour; motion = the same path, evaluated in JS and pushed to `sprite.position` each frame.**
- **Why not just bound the raymarch?** `bounds-heatmap.png` proves a per-anchor sphere-union gate
  would cut the march to **0.4% of the pixels (233× fewer)** for this view — the overlay dropped the
  `vrSphereT` gate the opaque science path keeps ([volume-raymarch.js:145 vs :146](effects/volume-raymarch.js)).
  Kept as the diagnosis of *why* the overlay is doomed, **but NOT adopted**: per the decision, even a
  bounded fullscreen march stacked on the mesh world is not worth it when sprites cost ~nothing. This
  finding only matters if the raymarch overlay is ever reused OUTSIDE the game path.

**Promotion — LANDED 2026-07-08 (geometry-only).** The sprite backend is the game sfx renderer;
the raymarch overlay is out of the game path.
1. **Verb-path evaluator** ([glyph-sfx-sprites.js](game/glyph-sfx-sprites.js)) — the `SFX_VERBS`
   path math promoted from the retired GLSL into JS as the authoritative shelf: `beadsFor(verb, cc,
   ph, params) → [{p, w}]`, pure + deterministic in phase. Nine sprite verbs (enchant, heal, charge,
   hit, accumulate, ward, sparkle, drain, aura) + a new `beacon`. `resolveSpriteSfxLayers` mirrors the
   old resolver (the `sfx`/`on` manifest surface is unchanged). 7 unit tests.
2. **Sprite sfx CHANNEL** ([spriteSfxChannelScript in channels.js](scene/channels.js)) — a
   `glowSpriteScript` sibling: one additive camera-facing sprite per bead, one pool per layer,
   `stepSpriteSfx(t)` evaluates the verb each frame (the bead fns are `.toString()`-embedded from the
   evaluator, so the module stays the one source of truth). Wired into [scene-three.js](scene/scene-three.js)
   the same way as `fx` — a `let stepSpriteSfx` declared when present, assigned by the block, called in
   `__mojStep(t)` (deterministic in every mode → renders in bakes too). O(beads)/frame, no fullscreen march.
3. **Routing** — [world-scene.js](worlds/world-scene.js) `sfx` → `resolveSpriteSfxLayers` →
   `payload.spriteSfx`; the `composeGlyphSfx`/`finalizeSfxLayer` → `effects[]` overlay path is GONE
   from the game path (glyph-sfx.js kept but unused there). Verified end-to-end: the stored
   `glyph-showroom-lite` recipe (once unrunnable) re-renders through sprites — sprite channel present,
   `volSample`/`__eMat0` absent, 358 KB, glyphs + sparkle/aura/beacon/hazard all render.
4. **`kokusen` + `ssj-aura` deferred** — extinction absorbs light (no additive equivalent); excluded
   from the shelf (`DEFERRED_VERBS`), dropped by the resolver. Later dark-mesh treatment, NOT raymarch.
5. **Free win landed** — sprite anchors are real scene objects that hide with their entity, so U5's
   "lingering sparkle after burst" is structurally fixed.
6. **Char-net** — new `sprite-sfx` fixture pins the channel emission (green). Absent-sfx worlds stay
   byte-identical (the block emits zero bytes without `spriteSfx`) — verified: every other fixture's
   bytes unchanged. (The 5 standing reds — audio/events/game/kitchen-sink/kitchen-sink-capture — are
   the branch's pre-existing material/game-bus threads, untouched by this work.)

**Remaining polish (not blocking):** per-frame sprite twinkle animation is on (paths animate live);
sprite size/opacity for `aura`/hazard reads a touch small vs the old raymarch glow — a decor `size`
default tune. `kokusen` dark-mesh treatment is the one real follow-up. Co-residing `spriteSfx` into
the `kitchen-sink` char fixture waits until the branch's standing kitchen-sink red is resolved.

The separate load-weight cost (a `figure-frames` player bakes ~15 MB of inline vertex-frames →
multi-second parse freeze; `delivery:'rig'` → 3.7 MB, a mesh body → 0.36 MB) is a `controllable`
figure-defaulting issue, tracked apart from the sfx model.

## Non-goals

- **Open effect scripting** — verbs are cards + lowerings; a level cannot inject GLSL.
- **Pixel assets of any kind** — the LittleJS atlas idea arrives as procedural forms only.
- **Simulation feedback** — effects never write to the bus/store; a wisp cannot gate a door.
- **Skeletal/deforming effect geometry** — beads, fields, filaments, face transforms only.
- **HUD/menu system** — this is world-space language; screen-space UI is its own thread.

## Open questions

1. **Reserved semantic palette** — fix red=harm / gold=value / green=goal substrate-wide (I lean
   yes; it's half the language), or leave color fully per-game?
2. **Default spawn gesture** — ghost-in (gentle, "the level begins") vs pop-in ("you earned
   this") as the mechanic default?
3. **Pop's vanish** — borrow a one-frame shard scatter from dissolve for more punch?
4. **Where the soft-knee lives** — per-verb clamp vs one shared compressor in the composer
   skeleton (lean: shared skeleton).
5. **Effect LOD** — do SFX verbs drop taps/steps by distance-to-camera, or is the per-entity
   uniform gate (only nearby armed entities glow) enough?
