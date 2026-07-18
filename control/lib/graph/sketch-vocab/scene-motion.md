---
{ "id": "scene-motion", "name": "scene-motion — staged multi-character SCENES over painted plates (cuts, depth, camera)", "summary": "the layer ABOVE keyframe clips: stage finished character clips over a painted background PLATE with a declared ground plane — blocking at depth, camera pan/zoom, CUTS between shots (each shot may play on its OWN stage: the cross-cut), speech/blink tracks, contact shadows — composited to a GIF/MP4 mo_ outcome with ZERO generations over the clips and plates. The plate is an external image-worker render (same capability gate and quality promise as keyframe-animation).", "when": "two characters talking, a phone call between two people, a dialogue scene, characters in a scene / on a background, stage the clips, cut between shots or locations, cross-cut, multi-character shot with camera moves, put the animated character in a setting, a short animated scene or sequence, block a scene at depth", "tier": "recipe" }
---

`scene-motion` composes finished `keyframe-animation` clips into a **scene**: a
stage (painted plate + declared ground plane), a cast (clip refs placed at
marks and depths), camera shots (pan / zoom / cuts), and one clock. Minted with
`create_sketch` (kind `scene-motion`, no new tool); the finished artifact is a
`forge_motion { scene_ref }` `mo_` GIF/MP4.

## The economics

A scene costs **zero generations over its assets**. The only image-worker
renders are the PLATE(s) — everything else (blocking, depth scale, parallax,
cuts, push/pull, face tracks, contact shadows) is deterministic compositing
over the clips' already-accepted cels. Re-timing, re-blocking, re-cutting, or
re-seeding blinks re-mints the `mo_` with no new paint.

## The flow

1. **Finish the cast** — each cast member is a `keyframe-animation` clip whose
   body cels are ACCEPTED (the completability gate refuses otherwise). A
   talking head is a 1-key clip with `speech`/`blink` face variants. A cast
   entry's face track must be BACKED by that clip's accepted variant cels —
   the forge refuses a declared track with no cels behind it (no silent
   fallback), so mint the clip WITH blink/speech if the scene will talk.
2. **Mint the scene** — `create_sketch({ kind: 'scene-motion', … })`: `stage`
   (horizonY / groundYRef / plate dims — the declared ground plane), `cast`
   (clipRef + markX + depth + optional face tracks), `shots` (span + cast +
   camera keyframes).
3. **Paint the plate(s)** — the `plate` render target rides the render-handoff
   bicycle. The scaffold is the **stage guide** (magenta horizon + tick figures
   at depths); the worker paints a background over it, removing every mark. The
   STAGE gate audits on submit; the recession READ is the accepting agent's
   eyes over the overlay.
4. **Forge** — `forge_motion({ subject: { scene_ref } })` → the `mo_` GIF/MP4 in
   `/api/motion`.

## Style cohesion (shared source, not a check)

A scene reads as ONE look because the plate is painted in the SAME style as the
characters — the shared source, not a post-hoc score. Each `keyframe-animation`
clip may declare a `renderBrief` (a `get_style_vocab` preset, a preset + `overrides`
fork, or a fully custom `{ id, style, mood, lighting, lock[], negative[] }`). At
mint the scene **inherits the lead cast clip's style** onto its plate, so
"background watercolor = character watercolor" holds by construction. Pass an
explicit scene `renderBrief` only to override the plate style deliberately. There
is no cohesion gate — a 3D-rendered ("unreal-engine") look is as valid as a
watercolor one; cohesion is just applying the same style to both surfaces.

## The cross-cut (per-shot stages)

A shot may carry its **own `stage`** — a different setting entirely. That shot
plays on its own plate (render target `plate-shot-<i>`, its own stage guide +
gate), and the cut between shots IS the location change. This is how a
phone-call scene cross-cuts between two rooms: one scene, two stages, two
plates, one clock — still a single `mo_` artifact.

## Directorial knobs

- `shots[].camera` keyframes: camX/camY/zoom + ease (a cut = the next shot).
- `cast[].depthKeys`: the zoom-approach cheat (walk toward camera as a ramp).
- `cast[].face.blink.forcedFrames`: guarantee a blink's closed phase on an
  exact frame, over the seeded schedule.
- `cast[].phase` / `onTwos`: per-actor cycle offset and step.

## Contrast (routing)

- ONE character moving, no setting → `keyframe-animation` (mint the clip first
  — it is this card's prerequisite anyway).
- a walkable / 3D world with camera flythrough → a **world** motion.
- a single painted still of a scene → **image-outcome**.
- panels on a page (comics) → **sequential-art**.
