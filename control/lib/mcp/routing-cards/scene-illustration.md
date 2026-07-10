---
{
  "id": "scene-illustration",
  "name": "Mint a scene or figure illustration",
  "summary": "Painterly / structural illustration: scenes, portraits, landscapes, scenery, moody atmospheres.",
  "when": "\"illustrate X\", \"a portrait\", \"a painterly landscape\", \"paint me a scene\", \"paint a mountain valley / forest / coastline at dusk / dawn / dusk light\", \"a moody / atmospheric picture of Y\", \"a nature scene\", \"a sunset over Z\"",
  "entry": "sketch_what_possible"
}
---
→ `sketch_what_possible` knob-resolution loop → `create_sketch({recipe:{kind,...}})`. Single-shot natural language → `create_polygonized_sketch`; painted landscape → `compose_world` (base `painted-landscape`; glyphs via `semantic_search({kinds:['painted_landscape']})`, glyph ids in `overrides`); cardinal-grammar structural illustration → `create_manji_tree` (2D or 3D). (Contrast: a diagram/chart → `create_sketch` directly; a posed human body → `create_figure`.)
