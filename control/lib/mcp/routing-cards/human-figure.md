---
{
  "id": "human-figure",
  "name": "Pose a human figure (a woman or man, standing or mid-stride)",
  "summary": "A picture of a single human body — the protoform woman or man posed via dials, optionally clothed (wardrobe keys or inline piece specs), painted with a diffusion skin, or walking mid-stride.",
  "when": "\"pose a figure\", \"a person reaching\", \"a walking figure\", \"a woman/man mid-stride\", \"a picture of a woman/man mid-stride or walking\", \"a picture of a person standing / sitting / crouching\", \"a male|female body in a stance\", \"a figure wearing X\", \"a human body in a pose\", \"design a character's outfit\", \"make pants/boots/clothing for a character\", \"paint / skin a 3D character\"",
  "entry": "create_figure",
  "form": "illustration"
}
---
→ `create_figure` (pose / build / garment / view dials; `motion:'walk'` adds a gait GIF). The figure is a pure function of (pose, proto, garment) — posing = choosing dials, clamped by armature limits. `garment` takes wardrobe keys AND inline piece specs ({ id, pieces, cuts?, … } — a piece authored as data fits ANY body; its mugen clearance is its looseness), layered in one array. To match a pose from a photo you can see, go through `reference_protocol({target:'pose'})` first and pass the recovered pose dials. To PAINT the figure: `get_skin_packet({ ref })` → paint the filled `?control=1` scaffold → `skin_polygomer` → the figure wears it at `/skin.png`. Full family → `get_creative_toolset({ form: 'illustration' })`.

**Multi-beat motion:** `emote_figure` plays ONE named emote (returns a sketch ref + GIF, not a `mo_`, so emotes can't be `stitch_motion`'d). For a sequence like "think, then point" in one clip, pass `create_figure` `motion: { keyframes: [pose, …] }` — each `pose` is numeric joint dials (not prose).
