---
{
  "id": "animate-character",
  "name": "Animate a hand-drawn character / stage an animated scene",
  "summary": "Raster character animation: whole painted cels per key pose (meru-registered), optional blink/talking face variants, staged over painted background plates with depth, camera moves, and cuts — composited into a GIF/MP4 motion outcome.",
  "when": "\"animate this character / make her wave / a walk cycle\", \"a talking head\", \"two characters on a phone call\", \"an anime / cartoon scene\", \"put the animated character in a setting / on a background\", \"cut between two rooms / cross-cut\", \"lip sync / mouth flaps / blinking\"",
  "entry": "create_sketch",
  "form": "image-render"
}
---
→ `create_sketch` with kind `keyframe-animation` (ONE character clip: K key-pose cels, optional `blink`/`speech` face-variant cels; meru guides keep every cel scale-registered) or kind `scene-motion` (finished clips staged over background PLATES: depth marks, camera shots, cuts — a shot may carry its own `stage` for a cross-cut). Read both sketch_vocab cards first (`get_sketch_vocab`: `keyframe-animation`, `scene-motion`) — they carry the manifest contracts. Cels and plates ride the render handoff (`request_image_render` → `pull_image_render` → `submit_image_render` → `accept_image_render`; the accept pass requires a DIFFERENT `source` than the submit — no self-accept). Finish with `forge_motion({ subject: { scene_ref } })` → the `mo_` GIF/MP4 (stage even a single clip as a one-cast scene). Needs an image-gen-capable worker; output quality = that model's. Full family → `get_creative_toolset({ form: 'image-render' })`.
