# Keyframe animation → MCP promotion (body + face)

Status: proposed (2026-07-13). Scope chosen with operator: **body (#1) + face
(#2)**, landing composites through the existing **image-outcome render-handoff
seam + forge_motion**, NOT a new sketch kind's bespoke render loop. Local rung
(#3) and scene staging (#4) are explicitly deferred.

Parent doctrine: [animation-cheats.plan.md](../animation-cheats.plan.md)
Addendum 4 (whole cels, no parts) + the promotion sketch A0–A4. This plan
supersedes A1–A3 with the concrete code seam mapped 2026-07-13.

## Status (2026-07-13): A0–A3 BUILT + green. A4 pending.

- **A3 (built 2026-07-13, same day, later pass)** — `forge_motion { cel_set: { ref, fps?, onTwos?, cycles?, blink?, speech? } }`:
  [keyframe-composite.js](../keyframe-composite.js) (`clipFrameSelections` over
  face-composite's scheduler + `compositeCels`), `resolveClipForge` in
  [scene-forge.js](../scene-forge.js) (store-backed cel provider, completability
  gate over ALL render targets, no flood-key — a bare clip keeps its painted bg),
  and the `kind:'cels'` branch in motion.js (`motion` defaults to `'clip'`,
  raster-native like world/scene — no SVG flipbook; also fixed the scene path's
  bogus `svg_path`). Re-time knobs re-normalize through the create gate and are
  whitelisted (`fps/onTwos/cycles/blink/speech`) — overriding keys/motion/pose is
  refused (baked into the paint). Tests: keyframe-composite.test.js (pure, 6) +
  motion-celset.test.js (cold e2e through the handoff handlers: refusal before
  accepts, override whitelist, GIF on disk with keys×onTwos×cycles frames,
  zero-generation re-time). The accept gate's "stitch with forge_motion
  { cel_set }" pointer is now a real door.

First diff landed the body+face cels onto the render-handoff accept gate:
- **A0** — pure modules extracted from the CLI harnesses, out of the spike dir
  into `image-outcomes/`: [keyframe-emit.js](../keyframe-emit.js)
  (`computeCanonical` / `emitKeys` / `emitKeyGuide`),
  [keyframe-audit.js](../keyframe-audit.js) (pure `auditCel` + the submit-seam
  `meruAuditCelPng` PNG wrapper). Tests: keyframe-audit.test.js (4),
  keyframe-emit.test.js (real rig, 7). `compositeCels` is deferred to A3 (it's
  the frame producer the `mo_` stitch needs — no point extracting it dead).
- **A1** — `keyframe-animation` kind in [manifest.js](../manifest.js): constant +
  contract, `isImageOutcomesKind`, `normalizeKeyframeAnimationManifest`,
  `parseKeyframeTarget`, and `renderTargets` expansion (body cels then per-key
  face variants). Tests: keyframe-manifest.test.js (10).
- **A2** — the render packet serves meru guides: `getImageRenderPacketHandler`
  keyframe scaffold branch (`?key=N` guide / `&skeleton=1`), `keyframeInstructions`
  (the JOB-K1 / JOB-FACE handoff), `buildLocalRenderParams` keyframe case
  (openpose CN + IP-Adapter identity), the `png/route.js` guide emitter, and the
  **submit-side MERU gate** in `submitImageRenderHandler` (`meruAuditCelPng` →
  deterministic numbers on `worker_audit.meru`, pure-scale auto-heal re-stored in
  place, RETRY note on violation). The accept gate points a finished keyframe run
  at `forge_motion { cel_set }` instead of `final.png`.

Mint: `create_sketch` kind `keyframe-animation` (no new tool). The full seam —
mint → `request_image_render` (one row per cel) → `pull` → `submit` (meru gate) →
`accept` — rides the existing render-handoff bicycle unchanged.

**A3 landed (2026-07-13, see Status):** the `forge_motion { cel_set }` subject
family reads the accepted cels + face schedule and mints the `mo_` GIF/MP4.

**Discovery card DONE (2026-07-13):** [sketch-vocab/keyframe-animation.md](../../sketch-vocab/keyframe-animation.md)
(tier `recipe`) positions keyframe-animation as THE default way to animate a
RASTER character — explicitly contrasted against forge_motion's four DETERMINISTIC
families (mojulo makes every pixel) as the one path that CONSUMES external art, so
**output quality = the image model's, not mojulo's**. Carries the **capability
gate** (ride-check the agent for image-gen — Codex image model or the local
ComfyUI rung — before promising an animation) and routes raster/character-animation
intents (incl. scene staging) to it. Auto-indexed by `reindexAll` (sketch_vocab
pulls every card); run `node scripts/reindex-embeddings.js` to make it live in
`semantic_search`. Loads + catalogs green (35 cards).

## The shape (hybrid — reuse both existing seams)

The spike is CLI-only `.mjs` harness code with one pure module
(`face-composite.js`). Promotion does NOT re-plumb rendering — it reuses two
seams that already exist:

1. **Cels ride the render-handoff bicycle** (request → pull → submit → accept)
   under ONE `sk_` ref, exactly like comic panels do today. The only thing a
   manifest must expose to be enumerable is a `kind` that `isImageOutcomesKind`
   accepts and a `renderTargets()` branch. A keyframe manifest expands to one
   target per body cel (`key-0…key-K`) plus per-key face-variant targets
   (`key-i/face/<vocab>-<state>`). The parked-row lifecycle, the meru audit at
   the accept gate, and the character-identity packet all come for free.

2. **The final GIF/MP4 is a `forge_motion` `mo_` outcome.** A new subject
   family `{ cel_set }` reads the accepted cels + the face schedule and yields
   `framePngs`; `forgeMotionHandler` already turns `framePngs` into GIF/MP4 +
   recipe.json + gallery via `encodeGifBuffers`. Zero new stitch code.

Net: cels are audited/stored under a `sk_` ref; the animation is minted as an
`mo_` outcome that points back at that ref. Re-timing (new blink seed / speech)
re-mints the `mo_` over the SAME accepted cels — zero generations.

## Pure-module extraction (A0 — prerequisite, safe, no MCP surface)

The audits + emitters are inline in `.mjs` harnesses. Extract three pure,
tested functions into new modules under `keyframe-spike/` (or promote to
`image-outcomes/`), byte-stable, no Date/Math.random:

- `keyframe-emit.js` — `emitKeys(motion, K, canvas) → { guides[], canonical,
  nodes[] }`, lifted from `emit-keys.mjs:43-85`. Depends on the existing rig
  exports (`sampleMotionPose`, `figureOpenPose`, `buildOpenPoseSvg`,
  `segmentTransform`, `APOSE/CANVAS/VIEW`). Guides are PNG buffers, not files.
- `keyframe-audit.js` — `auditCel(rgba, canonical) → { compliant, heightRatio,
  groundDelta, healed?, retryTargets }`, lifted from `composite-keys.mjs:41-96`
  (the head-band finder + height/ground compliance + whole-cel similarity heal).
  Face variants use the same gate (`bicycle.mjs:280-304`).
- `keyframe-composite.js` — `compositeCels(celBuffers, schedule) → framePngs[]`,
  lifted from `composite-keys.mjs:97-107`, driven by `resolveFaceFrames` from
  the already-pure `face-composite.js`.

Tests: reuse `k1-nera-wave/` accepted cels as fixtures; assert the audit numbers
match audit.json, and that `compositeCels` frame count = keys×onTwos×cycles.

## A1 — the keyframe-animation manifest kind

`control/lib/graph/image-outcomes/manifest.js`:
- Add `KIND_KEYFRAME_ANIMATION = 'keyframe-animation'` (`:21`) + contract const.
- Branch it into `isImageOutcomesKind` (`:34`) and the
  `normalizeImageOutcomesManifest` router (`:473`).
- `normalizeKeyframeManifest(input)` declares:
  `{ kind, motion, keys:K, fps, onTwos, cycles, character:{ ref|sheet },
     blink?:{ seed, meanGapSec }, speech?:{ spans, flapsPerSec } }`.
  The meru guides are DERIVED at render-packet time from `motion`+`K` (not
  stored) — recipes not renders.
- Teach `renderTargets(manifest)` (`:488`) to expand keyframe → body-cel
  targets + face-variant targets (variants from `requiredVariants`).

`mintSketch`'s `isImageOutcomesKind` fork (`sketches.js:241`) then stores it
with no new persistence code.

## A2 — the render packet serves meru guides

`control/lib/mcp/tools/sketches.js` `getImageRenderPacketHandler` (`:746`):
- Keyframe branch: a per-cel target's `scaffold.pngUrl` serves that key's
  **meru guide** (from `keyframe-emit.js`), not the panel/page scaffold.
- `buildRenderInstructions` / `buildLocalRenderParams` (`:819,824`) get a
  keyframe case = the JOB-K1 / JOB-FACE handoff text the bicycle already emits.
- New scaffold route variant: `/api/sketches/<ref>/png?key=N[&face=variant]`
  emits the guide PNG (deterministic, from the manifest).

The accept gate (`accept_image_render`, `render-handoff.js:197`) calls
`auditCel` for keyframe targets → records the deterministic meru numbers as the
`accept_audit`, RETRY on violation. This is the two-gate doctrine wired: machine
meru gate here; the register/identity gate stays the accepting agent's eyes.

## A3 — forge_motion cel-set subject family

`control/lib/mcp/tools/motion.js`:
- `resolveSubject` (`:119`): `if (subject.cel_set)` → load the `sk_` ref, guard
  kind `keyframe-animation`, pull the accepted cels via `boundRenderMap`, return
  `{ kind:'cels', celBuffers, schedule, recipeSubject:{ cel_set:{ ref, blink,
    speech, fps, onTwos, cycles } } }`.
- `renderShot` (`:229`): `kind:'cels'` skips all generation, calls
  `compositeCels(celBuffers, resolveFaceFrames(...))` → `{ framePngs }`.
- `forgeMotionHandler` (`:341`) then mints the `mo_` GIF/MP4 unchanged.
- Refuse with a clear message if any target of the `sk_` ref is not yet
  accepted (point at `request_image_render`).

## A4 — surface

Option B from the mapping: the animation IS an `mo_` outcome, so the existing
`/api/motion` gallery + `/outcomes/<mo_>/motion.{gif,mp4}` static serving show
it with NO new route. `/sketches/<ref>` shows the cel-render state (accepted /
pending per target) + a link to the minted `mo_`.

## Explicitly out of scope (this pass)

- Local ComfyUI render rung (#3, `local-render.mjs`) — worker-backend, no new
  MCP surface needed; wire later behind the same accept gate.
- Scene staging (#4, `stage*.js`, `scene-compose.js`) — the layer ABOVE clips;
  its own promotion.
- Combined eyes+mouth on one frame (needs a combined render) — v1 selects the
  first active channel (eyes before mouth), per `resolveFaceFrames`.
- A bespoke `animation.gif` route under the `sk_` ref (option A) — not needed;
  the `mo_` outcome is the artifact.

## Known bug — FIXED (2026-07-13, the GPT talking-phone post-mortem batch)

`get_image_render_packet` (the PULL payload) threw for a keyframe-animation clip
whose characters are INLINE (no `ref`): the packet's `characterSheets` block
calls `buildCharacterSheetInstructions(manifest, c.id)`, which rejected the
keyframe-animation kind. Fixed in instructions.js: the helper now accepts
KIND_KEYFRAME_ANIMATION (same `characters[]` shape) with a flat-cel fallback
brief where a renderBrief would be (keyframe manifests carry none). Pinned in
keyframe-manifest.test.js.

## Post-mortem additions (2026-07-13, extracted from the off-substrate GPT run)

An outside Codex session built a talking-phone animation OFF-substrate (see
the operator's `Documents/Codex/2026-07-13/...` folder) — partly because the
discovery card was not yet reindexed, partly because these gaps were real.
Extracted and landed:

- **`blink.forcedFrames`** (directorial override): guaranteed blink CLOSED on
  exact output frames, painted over the seeded schedule (an addition — re-seeding
  never moves a directed beat). resolveBlinkTrack + both manifest normalizers.
- **The HELD-REGION gate** (`auditFaceHold` / `faceHoldAuditPng` in
  keyframe-audit.js, wired into the submit seam): a face-variant cel is diffed
  against its key's base cel OUTSIDE the head band — `holdFrac` recorded in
  `worker_audit.meru.hold`, RETRY above 35%. The GPT run measured 12–50% body/bg
  drift between its face states; this makes "only the face changes" a machine
  number.
- **The cross-cut** landed on scene-motion (see scene-promotion.plan.md):
  `shots[].stage` — the two-setting phone call as ONE scene artifact.
- **The generator attestation gate** (2026-07-13, from the codex-local-svg-worker
  city-intro run — procedural SVG/sharp cels, honestly attested
  `invoked_generator: false` at submit, then self-accepted under a second hat,
  `codex-verifier`): `accept_image_render` for the animation kinds now CONSUMES
  the submit's own `worker_audit` — acceptance requires an affirmative
  `invoked_generator: true` and refuses `conditioned: 'prompt-only'` or a
  missing attestation (omission is not a dodge). The two-eyes contract stays
  honor-based on identity, but the "was this generated at all" question is now
  a machine fact the gate enforces. Pinned in render-handoff.test.js (3 tests).
- **Discoverability (Codex ride 2 feedback: "I can see the worker-side tools
  but not the scene authoring tool")**: minting rides `create_sketch`, but its
  tools/list surface said only "Diagram manifest". Fixed per the routing-card
  doctrine: a new [routing-cards/animate-character.md](../../../mcp/routing-cards/animate-character.md)
  (entry `create_sketch`, form `image-render`, covers both kinds + the
  no-self-accept note) + 2 eval fixture rows (entry + card level, green against
  the real embedder), and `create_sketch`'s `manifest` schema property now
  names the kind-dispatched manifests (image-outcome / sequential-art /
  character-sheet / keyframe-animation / scene-motion → their sketch_vocab
  cards). Reindexed.

## Open questions for the operator

1. Should `create_game`-style completability gating apply (refuse to mint the
   `mo_` until every cel is accepted)? Proposed: yes — forge_motion refuses a
   cel_set with unaccepted targets.
2. New MCP tool `create_keyframe_animation`, or fold minting into `create_sketch`
   with kind `keyframe-animation`? Proposed: `create_sketch` (reuses the mint
   chokepoint + render-handoff), no new tool — matches the "reuse" directive.
