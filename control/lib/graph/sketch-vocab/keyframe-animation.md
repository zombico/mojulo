---
{ "id": "keyframe-animation", "name": "keyframe-animation — hand-drawn / raster CHARACTER animation (external image worker)", "summary": "the default path to ANIMATE A RASTER CHARACTER: whole painted cels per key pose over meru guides, audited for scale + identity, composited on twos into a GIF/MP4 mo_ outcome. Unlike mojulo's deterministic motion families (manji-tree / deck / carved-solid / world — mojulo makes every pixel), this CONSUMES externally-generated art, so its quality is the image model's, not mojulo's. Requires an image-gen-capable worker.", "when": "animate a character, raster / hand-drawn / painted / anime / cartoon character animation, make a drawn figure wave / walk / punch / move, character wave cycle or walk cycle, animate concept art or an illustrated character, a painted character that moves, turn character art into an animation, character over a background scene that moves, staged multi-character scene with camera moves (scene staging), a person/figure animation that is NOT a 3D rig or vector diagram", "tier": "recipe" }
---

`keyframe-animation` is **the way to animate a RASTER character** — a
hand-drawn / painted / anime figure that moves — as opposed to the rest of
mojulo's motion tools. It is minted with `create_sketch` (kind
`keyframe-animation`, no new tool) and rendered to a GIF/MP4 `mo_` outcome via
`forge_motion`.

## Why this is unlike every other mojulo motion tool

`forge_motion`'s four subject families — **camera** (manji-tree), **deck**
(charts), **effect** (carved solids), **world** (three.js) — are all
DETERMINISTIC: mojulo generates every pixel from a recipe, so the output is
byte-stable and its quality is fixed by the recipe. **Keyframe animation is the
exception.** The moving thing is a *painted character*, and mojulo cannot paint
a convincing character — an external **image model** does. mojulo owns only the
discipline around the paint: the per-pose **meru guide** (declared scale + pose
the worker paints over), the **audit** (scale/identity compliance), the
**schedule** (on-twos + holds + blink/speech), and the **composite** (frames →
GIF). The model owns the drawing.

Consequence — **output quality = the image model's capability.** A strong image
worker yields clean, on-model cels and a crisp animation; a weak one yields
drift and artifacts, and no mojulo audit can add drawing skill the worker
lacks. This is the one motion path where "expect output equivalent to the
model" is the honest promise. Set that expectation before you start.

## Capability gate (ride-check FIRST)

This path needs a worker that can GENERATE IMAGES:
- a driving agent with an image model (e.g. Codex with image generation), or
- the local ComfyUI rung (SDXL + OpenPose ControlNet + IP-Adapter identity).

**Before promising an animation, confirm the operator's agent (or a delegated
worker) can generate images.** If neither is available, this path cannot
produce cels — do not mint it; for a NON-raster subject fall back to a
deterministic family (a manji-tree rig, a world, an `image-outcome` still), and
otherwise say plainly that a raster-character animation needs an image worker.

## The flow

1. **Mint** — `create_sketch({ kind: 'keyframe-animation', … })`: motion (wave /
   walk / …), K key poses, fps, on-twos, cycles, character identity (a ref or a
   character sheet), optional `blink` / `speech`. The recipe stores the plan, not
   pixels — the meru guides are DERIVED per key.
2. **Request renders** — `request_image_render` parks one row per cel target
   (`key-0…key-{K-1}` + per-key face variants). The render packet serves each
   key's **meru guide** (the rig mannequin at declared scale/pose) as the
   scaffold the worker paints OVER — covering it, removing the register lines.
3. **Worker paints** — `pull_image_render` → the worker renders the cel over the
   guide (its identity locked to the character key) → `submit_image_render`. The
   **MERU gate** runs here (deterministic scale/ground audit, auto-heals pure
   scale, RETRY on violation). The register/identity READ is the accepting
   agent's eyes.
4. **Accept** — `accept_image_render` per cel, and it is enforced two-eyes:
   pass `accept_audit.register` (a one-line attestation that the cel is a
   painted register — not a vector tracing — with identity/facing/props read
   correctly) and `source` (the acceptor's identity, which must differ from
   the submit's source — the painting worker cannot self-accept). When every
   target is accepted, `forge_motion` composites the cels into a `mo_` GIF/MP4.
5. **Re-time free** — a new blink seed / speech / fps re-mints the `mo_` over the
   SAME accepted cels: zero new generations (the schedule owns time).

## The `motion` field — names, or custom poses (read before authoring)

`motion` is EITHER a known name string OR a keyframe spec object — nothing else:

- **Name string:** `walk`, `wave`, `stretch`, `sprint`, or an emote
  (`nod` / `headshake` / `bow` / `shrug` / `cheer` / `clap` / `point` / `think`).
  An unknown name (e.g. `"custom"`) is REJECTED at mint with the valid set — it is
  not a free-text label.
- **Custom key poses:** `motion: { keyframes: [pose, …], loop? }` where each `pose`
  is exactly a `create_figure` pose — **numeric joint dials, not prose**
  (`{ elbowR: 120, shR: { pitch: -85 }, spine: { axial: 0.2 } }`). A natural-language
  beat like `"arm extends to point"` is NOT a pose and will not render.
- There is **no top-level `poses` / `keyframes` field.** Authored poses go INSIDE
  `motion`; a stray top-level field is rejected with a pointer (it would otherwise
  be silently dropped, minting an empty animation).

This is how you get a two-beat clip (e.g. think → point) as ONE outcome: author
`motion: { keyframes: [thinkPose, holdPose, pointPose] }`. (Contrast: `emote_figure`
plays ONE named emote and returns a sketch ref + side GIF — **not** a `mo_` — so you
cannot `stitch_motion` two emotes into a sequence.)

## Style (optional — the default is flat cel)

A clip may declare a `renderBrief` to paint the cels in a specific discipline — a
`get_style_vocab` preset (`steamboat`, `ukiyo-e`, `photo-realism`, …), a preset +
`overrides` fork, or a fully custom `{ id, style, mood, lighting, lock[], negative[] }`.
Omit it for the historical flat-cel look. This matters for cohesion: when the clip
is staged in a `scene-motion`, the plate INHERITS this style, so the background is
painted to match the characters. The cel background stays a plain field regardless
(the scene plate supplies the setting).

## Scene staging — the layer above (multi-character shots)

A finished keyframe clip is a reusable *character clip*. Staging several clips
over a **background plate** with **depth, cuts, and camera push/pull** is the
**`scene-motion`** kind (its own vocab card): a plate painted by the same image
worker over a **stage guide** (declared ground plane), then clips placed by the
depth kernel — no per-placement calibration, contact shadows and face tracks
free, cross-cuts between per-shot stages, the whole scene re-times for zero
generations. Same capability gate (the plate is an image-worker render); same
"quality = the model" promise.

## Contrast (routing)

- 3D rig / mechanism / molecule that must ROTATE → a **manji-tree** camera motion
  (deterministic).
- city / room / terrain / walkable scene → a **world** motion (deterministic).
- charts / explainer / slideshow → a **deck** motion (deterministic).
- a single directed STILL image (concept art, matte, cinematic frame) →
  **image-outcome** (external model, but one frame, no time).
- a hand-drawn CHARACTER that must MOVE → **keyframe-animation** (this card).
