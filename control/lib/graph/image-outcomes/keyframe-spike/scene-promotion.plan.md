# Scene staging → MCP promotion (the layer above clips)

Status: proposed (2026-07-13). The promotion deferred by
[mcp-promotion.plan.md](mcp-promotion.plan.md) line 144 ("Scene staging (#4) —
its own promotion"). Parent: [scene-staging.plan.md](scene-staging.plan.md)
(the proven spike) + animation-cheats.plan.md Addendum 4. Rides the SAME two
seams the cel-set promotion rode — render-handoff + forge_motion — not a new
artifact family. Researched against the live code 2026-07-13.

## The finding (why this rides existing rails)

A scene is a COMPOSITE over assets that already exist (character clips + a
plate), emitted as a GIF/MP4. That is a **`forge_motion` `mo_` outcome**, not a
paginated publication (System A / cook) and not — yet — a bespoke `/scene/<ref>`
studio family (the beats template). Concretely:

- **forge_motion has four subject families** (deck / world / camera / effect),
  resolved by `resolveSubject` ([motion.js](../../../mcp/tools/motion.js) ~:119)
  with a terminal throw ~:197. A scene is **family #5**, mirroring the deferred
  `cel_set` family (mcp-promotion.plan.md A3).
- `renderShot` (~:210) dispatches on the family's `kind`; `forgeMotionHandler`
  (~:341) is family-agnostic once it has `framePngs` — the raster branch (~:359,
  gated `isWorld`) already calls `encodeGifBuffers` / `encodeFramesMp4` and files
  the `mo_` as a Motion-Project (ops tag + stash). **Zero new encode/stitch/route
  code**; surfaces free at `/outcomes/<mo_>/motion.{gif,mp4}` + `/api/motion`.
- The plate is an externally-authored render → it rides the **render-handoff
  bicycle** (request → pull → submit → accept) as a new target, with
  `auditStagePlate` as the accept-time machine gate — exactly where the MERU cel
  gate sits for keyframe cels (`render-handoff.js` submit/accept seam).

## Dependency: the clip layer

A scene's cast are finished character clips. Those are `keyframe-animation`
sketches whose cels are accepted (A0–A2, GREEN). Two ways a scene reads them:
- **cel_set `mo_` clips** (cleanest — a cast member is a finished `mo_`): needs
  the deferred cel-set A3 (`forge_motion { cel_set }`) done first.
- **accepted `sk_` cels directly** (via `boundRenderMap` of the keyframe sketch):
  works today once k1/k2 are minted as keyframe-animation sketches.
The spike reads cel PNGs off disk; promotion injects a **cel source** so either
binding works. `renderScene` must not hard-code disk paths.

## The sequence (each slice is one diff, safe-first)

### SP0 — extract the pure frame producer (PREREQUISITE, no MCP surface)

Lift the raster half of [composite-scene.mjs](composite-scene.mjs) into a pure,
tested `scene-composite.js` (promotable to `image-outcomes/`):

    renderSceneFrames(scene, { plate, band, cel, downscale }) -> Promise<framePngs[]>

- `plate` : a plate PNG buffer (the accepted stage plate, or a stand-in).
- `band(ref)` : a band PNG buffer (occluder) or null.
- `cel(clipRef, keyDir, celFile)` : a keyed cel buffer (the injected cel SOURCE —
  disk in the spike, `boundRenderMap` / `mo_` frames in promotion).
- returns the composited `framePngs[]` (what `renderShot` must yield).

Internals lifted verbatim: `resolveSceneFrames` → per-frame depth-sorted layers →
`frameClip` + `shadowClip` → full-frame composite → optional downscale. The
`.mjs` becomes a thin CLI that builds the three providers (stand-in plate,
`celBuffer` off disk) and calls `renderSceneFrames` + `encodeGifBuffers`. Byte-
stable, no Date/Math.random (sharp is fine — same as cel-set `compositeCels`).
Tests: synthetic 1×1 providers → assert frame count = `sceneFrameCount`, buffers
returned, deterministic.

### SP1 — the scene manifest kind (mint via create_sketch)

`scene-manifest.js` (promote beside manifest.js's image-outcomes kinds):
`SCENE_MOTION = 'scene-motion'`, `isSceneMotionKind`, `validateSceneManifest`,
`normalizeSceneManifest`. The stored recipe is the scene object
(`{ fps, frame, stage, cast[], shots[] }`) — cast members carry a clip REF
(keyframe `sk_` or `mo_`), not pixels. Mint through `create_sketch` (no new tool,
the "reuse" directive) → `sk_` row + `/sketches/<ref>` state view. `unit` is the
eye-level fit; `stage.plate` names the plate render target.

### SP2 — the plate render target (render-handoff)

Teach `renderTargets(manifest)` a `scene-motion` expansion → `['plate']` (+ any
occluder bands). The render packet serves the **stage guide** (emit-stage's
`stageGuideSvg`) as the plate target's scaffold; `JOB-STAGE.md` is the
instruction text. Wire `auditStagePlate` as the accept-time gate for the `plate`
target (mirror the MERU cel gate; the register/scale READ stays the accepting
agent's eyes over `stage-overlay.png`). Now the plate rides request → pull →
submit → accept under the scene's `sk_` ref.

### SP3 — forge_motion `scene` subject family (the payoff)

`motion.js`:
- `resolveSubject` (~:197): `if (subject.scene_ref || subject.scene)` → load the
  scene recipe, resolve each cast clip's cels (guard: every clip + the plate
  accepted — the completability gate, mcp-promotion Q1), return
  `{ kind:'scene', scene, plate, celSource, recipeSubject:{ scene_ref } }`.
- `renderShot` (~:210): `isScene` branch → `renderSceneFrames(scene, providers)`
  → `{ framePngs, meta:{ fps } }`.
- `forgeMotionHandler` raster branch (~:359): fire for `isWorld || isScene`
  (already encodes). Extend `subjectDesc` (~:437) for the scene case.
- Schema property + a "FIFTH SUBJECT FAMILY" doc paragraph (~:661).
Re-timing / re-blocking / push-pull re-mints the `mo_` over the SAME accepted
cels + plate — zero generations (the scene-compose `requiredAssets` invariant).

### SP4 — discovery + surface

- A `scene-motion` **sketch_vocab card** (the motion grammar: depth kernel, cuts,
  push/pull, zoom-approach, shadows, face tracks) → `semantic_search` discovery.
- Surface is FREE: the `mo_` outcome shows in `/api/motion` + `/outcomes/<mo_>/`;
  `/sketches/<ref>` shows the plate-accept state + a link to the minted `mo_`.

## Out of scope (this promotion)

- A bespoke `/scene/<ref>` studio + `scene_revisions`/`scene_annotations` (the
  full beats-family template) — only if scenes need in-place revision/annotation;
  the `mo_` outcome is the artifact for v1.
- cel_set A3 itself (a prerequisite tracked in mcp-promotion.plan.md, not here).
- Stitchability of raster `mo_` scenes — `recoverClip`/`encodeStitchMp4` refuse
  raster (frame-SVG-only) today; scenes hit the same wall world clips do. Later.
- A4 light-match re-key; taller-plate wide pull; real occluder bands from Codex —
  all scene-staging.plan.md v2 items, orthogonal to promotion.

## Build log

**Three teeth from the Codex phone-call post-mortem (2026-07-13).** The first
on-substrate outside ride (sk_fndv02m5i5 / mo_5f58ac153248) proved the seams
but exposed three drivable-around holes; all now refuse instead of degrade:

1. **Face-variant completability** — `resolveSceneForge` gates cast face
   tracks against ACCEPTED variant cels (`requiredFaceTargets`, pure +
   tested). Codex declared blink/speech (incl. forcedFrames) over clips with
   no variant targets and the schedule silently fell back to body cels — a
   scene that declares a face track without the cels behind it now refuses at
   forge with the exact missing targets.
2. **No self-accept on animation kinds** — `accept_image_render` for
   keyframe/scene renders now requires `accept_audit.register` (the one-line
   eyes attestation) and `{ source }` differing from the submit's source.
   Codex was painter, auditor, and acceptor in one session and self-accepted
   flat-vector cels — the register gate is now a contract, not a suggestion.
   Non-animation kinds keep the honor-system accept.
3. **Shot-local camera time** — scene shot camera keyframes with `t` outside
   `[0, span duration]` are refused at mint (Codex authored scene-absolute
   keys → the camera froze then jerked; the sampler clamps silently).

**SP4 DONE + the CROSS-CUT (2026-07-13, the GPT talking-phone post-mortem
batch).** The `scene-motion` vocab card landed
([sketch-vocab/scene-motion.md](../../sketch-vocab/scene-motion.md), tier
recipe — routes dialogue / phone-call / staged-scene framings, states the
zero-generation economics + the same capability gate as keyframe-animation).
And the promotion grew the one control capability the off-substrate GPT run
had that the seam could not express — **the cut between settings**:
`shots[].stage` (an optional full stage per shot, normalized with plate ref
`plate-shot-<i>`). Each cross-cut shot adds its own plate render target riding
the same render-handoff bicycle (stage guide via `?plate=1&target=…`, STAGE
gate on submit via `auditStagePlatePng { target }`); `resolveSceneFrames`
plays each shot on `shot.stage || scene.stage` (validator checks headroom +
sole-in-band per shot against ITS stage); `renderSceneFrames`' plate provider
gains a by-ref function form; `resolveSceneForge` loads every accepted plate
and serves them by ref (completability gate covers all plates). Tests:
scene-motion-manifest.test.js (cross-cut describe), scene-composite.test.js
(two-stage cut, provider-call assertions).

**SP1–SP3 DONE + END-TO-END GREEN (2026-07-13).** A scene is now a real mojulo
outcome: `create_sketch` kind `scene-motion` → bind the plate through the
render-handoff seam → `forge_motion { scene_ref }` → an `mo_` GIF/MP4 in
`/api/motion`. Proven end-to-end (throwaway test, since deleted): minted 2
keyframe clips (k1/k2) + bound their real cels, minted the scene + bound the Codex
plate (the stage gate passed on submit — leak 0), forged `mo_c12517e0a7e5` at 36
frames; the composited frame reads correctly (Nera + Lio on the plaza, eye-level
scale, contact shadows). The completability gate fired (refused before the plate
was accepted).

- **SP1** — `KIND_SCENE_MOTION` in [manifest.js](../manifest.js): `normalizeScene
  MotionManifest` (stage with eye-level `unit` fit, cast clip refs, shots with
  camera keyframes; speech spans → `{from,to}`), `isImageOutcomesKind`,
  `normalizeImageOutcomesManifest` router, `renderTargets → ['plate']`,
  `parseSceneTarget`. Tests: scene-motion-manifest.test.js (5). Mint rides the
  existing `mintSketch` image-outcomes fork — no new tool.
- **SP2** — the plate rides the render-handoff bicycle:
  [scene-plate.js](../scene-plate.js) (`emitStageGuidePng` scaffold +
  `auditStagePlatePng` submit gate); the png route serves the stage guide
  (`?plate=1`); `sceneStageInstructions` (JOB-STAGE) in instructions.js; the
  packet's scene scaffold + `sceneReady` bookkeeping in sketches.js; the SUBMIT
  gate (`auditStagePlatePng`) + accept pointer (`forge_motion { scene_ref }`) in
  render-handoff.js. Same two-gate doctrine as the meru cel gate (machine on
  submit; the recession READ stays the accepting agent's eyes over the overlay).
- **SP3** — the `forge_motion` FIFTH subject family:
  [scene-forge.js](../scene-forge.js) (`resolveSceneForge` reads accepted plate +
  cast cels from the store, flood-keys them, runs the completability gate);
  motion.js `resolveSubject` scene branch, `renderShot` `isScene` → `renderScene
  Frames` → framePngs, `forgeMotionHandler` raster branch fires for
  `isWorld || isScene`, schema `subject.scene_ref` + the "raster/character family,
  output = the image model's" note. No new encode/route code — it surfaces free as
  an `mo_`. Existing motion + render-handoff + image-outcomes suites stay green
  (30 + 156).

**SP0 DONE (2026-07-13).** The pure frame producer is extracted:
[scene-composite.js](scene-composite.js) `renderSceneFrames(scene, { plate, band,
cel, downscale }) → framePngs[]` — the exact shape `renderShot` must yield, with
asset sourcing INJECTED (plate buffer, `band(ref)`, `cel(clipRef,keyDir,celFile)`)
so disk (spike) and boundRenderMap/`mo_` (promotion) both bind. `frameClip` +
`shadowClip` lifted and frame-parameterized; band native size now read from the
buffer metadata (dropped the hardcoded plate-width + bush-360×520 specials).
[composite-scene.mjs](composite-scene.mjs) is now a thin CLI over it (stand-in
providers + downscale 416×608), byte-identical render confirmed. Tests:
scene-composite.test.js (3 — frame count, downscale, determinism) + full suite 55
green. Next: SP3 forge_motion `scene` family (touches the shared motion.js — the
one slice with real blast radius; confirm before wiring). SP1/SP2 (scene-motion
kind + plate render target) can precede or follow.
