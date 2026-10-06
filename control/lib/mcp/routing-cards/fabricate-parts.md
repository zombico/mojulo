---
{
  "id": "fabricate-parts",
  "name": "Solve a physical object from standard parts",
  "summary": "Say what each part must do (fasten, hinge, spin, seal, mount …); get the off-the-shelf parts, the cuts that take them, and what to buy.",
  "when": "\"what screws / bearing / hinge should this use\", \"use off-the-shelf parts where you can\", \"make it with standard hardware\", \"a bill of materials\", \"what do I need to buy to build this\", \"the lid comes off often, how should it close\", \"mount a Raspberry Pi in a box\", \"make it waterproof\", \"design it for real fabrication\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'scad', via: 'fabricate', spec: { needs: [{ function, … }], host? } })` — each need names a job (`fasten`, `thread`, `locate`, `hinge`, `slide`, `spin`, `drive`, `transmit`, `retain`, `seal`, `catch`, `mount`, `enclose`, `store`, `frame`) and is solved from standard parts first, from scratch last. No `source` → the plan: the strategy per need and why, the bill of materials, the `mj_*` cuts to place, the notices. Then call again with the `source` → a scad row with the plan frozen beside it. Another owner's system (a branded board, mount or brick) is bought or fitted, never reproduced. Placing finished visual parts together is the assembler (`kind: 'assembler'`), not this. Manual: `get_solid_vocab({ id: 'scad' })`, section "Fabricate". Full family → `get_creative_toolset({ form: 'object' })`.
