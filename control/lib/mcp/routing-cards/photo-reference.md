---
{
  "id": "photo-reference",
  "name": "Build from a photo you can see",
  "summary": "Read a photo's perspective or pose into mojulo dials — you are the vision adapter.",
  "when": "\"use this image/photo as a reference\", \"match this pose / gesture\", \"rebuild this room's perspective\", \"copy the composition / camera\", \"base it on this picture\"",
  "entry": "reference_protocol",
  "form": "reference"
}
---
→ `reference_protocol({ target:'scene'|'pose' })` returns HOW to read the photo (no key, no image sent to mojulo), then `capture_reference` files what you extracted as a reusable cage + insights in a stash. `scene` recovers PERSPECTIVE (horizon / vanishing points / floor) into a two-point camera; `pose` recovers the GESTURE into the figure dummy's pose dials. One photo is the normalized anchor; pass `stash_ref` with a second view to GROUND it (multi-pass triangulation). Then build inside it (preload the cage / `create_figure({pose})` / `forge_motion` a turntable) and `bind_stash({role:'reference'})` to anchor a build. (Contrast: "draw me X" → `create_sketch`; "make X move" → `forge_motion`.) Full family → `get_creative_toolset({ form: 'reference' })`.
