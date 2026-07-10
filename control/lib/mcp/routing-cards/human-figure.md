---
{
  "id": "human-figure",
  "name": "Pose a human figure",
  "summary": "The protoform human figure posed via dials, optionally clothed or walking.",
  "when": "\"pose a figure\", \"a person reaching\", \"a walking figure\", \"a woman/man mid-stride\", \"a picture of a person standing / sitting / crouching\", \"a male|female body in a stance\", \"a figure wearing X\", \"a human body in a pose\"",
  "entry": "create_figure"
}
---
→ `create_figure` (pose / build / garment / view dials; `motion:'walk'` adds a gait GIF). The figure is a pure function of (pose, proto, garment) — posing = choosing dials, clamped by armature limits. To match a pose from a photo you can see, go through `reference_protocol({target:'pose'})` first and pass the recovered pose dials.
