---
{
  "id": "human-figure",
  "name": "Pose a human figure (a woman or man, standing or mid-stride)",
  "summary": "A picture of a single human body — the protoform woman or man posed via dials, optionally clothed (wardrobe keys or inline piece specs), painted with a diffusion skin, or walking mid-stride.",
  "when": "\"pose a figure\", \"a person reaching\", \"a walking figure\", \"a woman/man mid-stride\", \"a picture of a woman/man mid-stride or walking\", \"a picture of a person standing / sitting / crouching\", \"a male|female body in a stance\", \"a figure wearing X\", \"a human body in a pose\", \"design a character's outfit\", \"make pants/boots/clothing for a character\", \"paint / skin a 3D character\"",
  "entry": "mint_solid",
  "form": "illustration"
}
---
→ `mint_solid({ kind: 'figure', spec })` (spec: pose / proto / garment / view dials; `motion:'walk'` adds a gait GIF). The figure is a pure function of its dials — posing = choosing values, clamped by armature limits. `garment` takes wardrobe keys or inline piece specs, layered in one array. Read the manual first via `get_solid_vocab({ id: 'figure' })`. To match a pose from a photo you can see, go through `reference_protocol({target:'pose'})` first. To PAINT the figure → `edit_solid({ op: 'skin', ref })` (paint the filled `?control=1` scaffold, then bind the PNG); to make it EMOTE (nod / bow / shrug / …) → `edit_solid({ op: 'emote', ref })`. Full family → `get_creative_toolset({ form: 'illustration' })`.
