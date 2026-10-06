---
{
  "id": "copper-teapot",
  "name": "Copper teapot",
  "entry": "mint_solid",
  "family": "object",
  "summary": "A ready-to-mint workbench study: a squat copper teapot at literal kitchen scale — a lathed body and lid, a swept spout, a wood-handled sweep — the classic form-study object as a polygomer.",
  "when": "a teapot or kettle model; a classic form-study object; an everyday kitchen object built from primitives; a lathe + sweep worked example; the Utah-teapot exercise"
}
---

A worked example over the workbench kind: the classic teapot as four
monomers on the measured grid. Two lathes make the body (a squat belly
peaking at 7.5 cm radius) and the domed lid with its knob; a swept tube
rising from the belly wall is the spout; a second sweep — wood-tinted,
`caps: false` since both ends embed in the body — is the handle. All at
literal kitchen scale (`units: 'cm'`, about 22 cm wide over the spout).

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — the profile arrays are the whole form language:
squash the belly for a saucepot, stretch the body taller for a coffee pot,
or add `harmonics` to the body lathe for a fluted period piece. Check
`stats.warnings` for anything floating off the grid after edits.

## Recipe

See `recipe.json` beside this card — `kind: 'workbench'` with the spec
above.

Pass the `kind` and `spec` to the solid mint. The full parameter manual for
the underlying kind is its own card (`id: 'workbench'`).
