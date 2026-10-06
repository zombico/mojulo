---
{
  "id": "fabricate-parts",
  "name": "Solve a physical object from standard parts",
  "summary": "Say what each part must do (fasten, hinge, spin, seal, mount …); get the off-the-shelf parts, the cuts that take them, and what to buy.",
  "when": "\"what screws / bearing / hinge should this use\", \"use off-the-shelf parts where you can\", \"make it with standard hardware\", \"a bill of materials\", \"what do I need to buy to build this\", \"the lid comes off often, how should it close\", \"mount a Raspberry Pi in a box\", \"make it waterproof\", \"design it for real fabrication\"",
  "entry": "fabricate_solid",
  "form": "object"
}
---
→ `fabricate_solid({ needs: [{ function, … }], host? })` — each need names a job (`fasten`, `thread`, `locate`, `hinge`, `slide`, `spin`, `drive`, `transmit`, `retain`, `seal`, `catch`, `mount`, `enclose`, `store`, `frame`), solved from standard parts first, from scratch last. The first call returns the plan: who carries each need out (an OpenSCAD `source`, or a workbench `frames` entry for wood joinery), the bill of materials, the cuts and joints to place, the notices. The second call, with the `source` or the `frames`, mints the row with the plan beside it. Another owner's system (a branded board, mount or brick) is bought or fitted, never reproduced. Placing finished visual parts together is `mint_solid` kind `assembler`, not this. Manual: `get_solid_vocab({ id: 'fabricate' })`. Full family → `get_creative_toolset({ form: 'object' })`.
