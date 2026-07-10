---
{
  "id": "diagram-chart",
  "name": "Mint a diagram or data chart",
  "summary": "Static diagrams, flows, and data charts minted as persistent sketches.",
  "when": "\"draw me X\", \"chart these numbers\", \"a flow of Y\", \"diagram how Z works\", \"visualize this data\", \"sketch out our pipeline as boxes and arrows\", \"map the flow of X\", \"a flowchart / org chart / bar chart / donut\"",
  "entry": "create_sketch"
}
---
→ `create_sketch`. Chart vocabulary via `semantic_search({kinds:['sketch_vocab']})` + `get_sketch_vocab`; iterate in place with `update_sketch`; compare two with `diff_sketches`. Sketches persist at `/sketches/<ref>` and embed into picture-book / comic / field-guide / visual-guide cooks via `sketch`-typed stash items. (Contrast: "make it move" → `forge_motion`; a scene/figure illustration → `sketch_what_possible`.)
