---
{
  "id": "creature",
  "name": "Build a creature (a dragon, a monster, an invented body with a detailed head, rigged)",
  "summary": "An invented organic body as a layered solid: rings along a spine with detail pinned by address, dials that reshape it in place, and an optional rig with clips that plays on the World page and exports skinned.",
  "when": "\"a dragon\", \"a monster / a beast / a creature\", \"an invented animal that is not a real species\", \"a character that is not a person\", \"a body I can rig and animate\", \"a creature head with eyes, brows, nostrils and scales\", \"keep the jaw / tail / snout editable by dials\", \"a family of casts from one creature recipe\", \"a hulking humanoid with lizard legs\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'layered', spec })`; from a sentence, the loop is the `creature-from-plan` catalyst (a worker prints a ring plan, `via: 'plan'` expands it). Read the manual first via `get_solid_vocab({ id: 'layered' })`: the recipe is stations × slots (named rings along a spine, mirrored by name), details pinned to named faces with local offsets, declared dials (`scale` / `offset` / `hinge` / `chain` / `stretch`), and optionally a `rig` (joints, bones, chains, planted legs) with `clips`. The worked recipes are `docs/examples/dragon-body` (rigged, wearing the detailed head) and `docs/examples/dragon-layered` (the head alone, six casts). Iterate in place (`update_sketch` patching `/dials/<name>` or `/plan/...`), never re-mint; a rigged recipe plays its clips on the World page and exports skinned. A REAL animal with a real skeleton is kind `animal` (card `animal`); a person is kind `figure` (card `human-figure`); a lamp / vessel / machine is the object loop (card `workbench-object`). Full family → `get_creative_toolset({ form: 'object' })`.
