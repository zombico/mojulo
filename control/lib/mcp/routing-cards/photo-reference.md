---
{
  "id": "photo-reference",
  "name": "Build from a picture you can see",
  "summary": "Read a picture's perspective, pose, object, landscape or character into mojulo dials — you are the vision adapter.",
  "when": "\"use this image/photo as a reference\", \"match this pose / gesture\", \"rebuild this room's perspective\", \"copy the composition / camera\", \"base it on this picture\", \"make my OC / this character / me from this drawing or photo\", \"turn this picture into a 3D character in anime style\"",
  "entry": "reference_protocol",
  "form": "reference"
}
---
→ `reference_protocol({ target })` returns HOW to read the picture (no key, no image sent to mojulo), then `capture_reference` files what you extracted in a stash. `scene` recovers PERSPECTIVE into a two-point camera; `pose` the GESTURE into the figure's pose dials; `object` a part-graph block-out; `landscape` a painted-landscape recipe. `character` reads a picture of a character into the hero's words in a LOOK (toon, anime, chibi, realistic, statue …) and a REGISTER, told or picked; capture makes the hero through `create_character` and draws it back beside the picture; likeness is your call (an X-like build for trademarked work); sculpt on with `update_character`. A second picture with `stash_ref` refines (a character keeps the words the person changed). Then build inside it. (Contrast: "draw me X" → `create_sketch`; "make X move" → `forge_motion`.) Family → `get_creative_toolset({ form: 'reference' })`.
