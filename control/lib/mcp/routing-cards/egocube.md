---
{
  "id": "egocube",
  "name": "Design a character to reuse (an Egocube: a character's design notes, across games and across time)",
  "summary": "A character rolled from an archetype into design notes (face, stance, silhouette, dress, colouring) and kept as a recipe, optionally across ages on a fate thread; the same person is then made in any game, at any age, through create_character.",
  "when": "\"design a character I can reuse in different games\", \"a character concept first, then the model\", \"a stubborn girl who grows up to be a knight\", \"the same hero at 11, 16 and 26\", \"roll me a character from an archetype\", \"design notes for my hero\", \"a cast of different peoples from one design method\", \"my character in a sequel, older\"",
  "entry": "create_sketch",
  "form": "character"
}
---
→ `create_sketch({ kind: 'egocube', roll: { brief?, facets?, seed?, years?, chapters? }, dress? })`: the sheet is rolled where it is written and kept by value (facets: age, pole, ancestry, build, role, archetype, motivation, order; `years` and `chapters: [{ chapter: 'time', years, words? }]` make a fate thread). The preview is the character at each age of its thread, side by side. Then make it: `create_character({ egocube: '<ref>', years? })` (a person through the hero door, a lineage below it through the creature door; `dress: 'designed'` by default, the outfit designed from the notes, or `'kit'`); a hero's `spec` lays over the sheet's words. The character records the sheet it came from and `update_character` says when the sheet has moved since. A game takes the character by ref (`characters.hero.ref`). Revise the sheet with `update_sketch` on `/roll/...` (it rolls anew). A cartoony brief ('sonic-like', 'mascot') or `roll.tuning: 'mascot'` rolls a MASCOT instead (card `mascot`): no age, its own facets. The form's tools: `get_creative_toolset({ form: 'character' })`.
